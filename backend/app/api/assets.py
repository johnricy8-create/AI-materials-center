from __future__ import annotations

import asyncio
import hashlib
from pathlib import Path
from typing import Literal

from fastapi import APIRouter, BackgroundTasks, Depends, File, HTTPException, Query, UploadFile
from fastapi.responses import FileResponse
from sqlalchemy import String, cast, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.config import get_settings
from app.db.models import Asset, AssetMetadata
from app.db.session import get_session
from app.schemas.asset import (
    AssetDetail,
    AssetListResponse,
    AssetRead,
    AssetUpdate,
    UploadError,
    UploadItem,
    UploadResponse,
)
from app.services.analysis_service import build_search_text
from app.services.file_service import FileValidationError, validate_file
from app.services.ingestion import ingest_asset
from app.services.serializers import asset_to_read
from app.services.storage import get_storage
from app.services.vector_store import get_vector_store

router = APIRouter(prefix="/assets", tags=["assets"])
settings = get_settings()
storage = get_storage()


def _get_asset_query(asset_id: str):
    return (
        select(Asset)
        .options(selectinload(Asset.metadata_rel), selectinload(Asset.chunks))
        .where(Asset.id == asset_id)
    )


@router.post("", response_model=UploadResponse, status_code=201)
async def upload_assets(
    background_tasks: BackgroundTasks,
    files: list[UploadFile] = File(...),
    session: AsyncSession = Depends(get_session),
) -> UploadResponse:
    if not files:
        raise HTTPException(status_code=400, detail="请选择至少一个文件")
    if len(files) > settings.max_files_per_request:
        raise HTTPException(
            status_code=400,
            detail=f"单次最多上传 {settings.max_files_per_request} 个文件",
        )

    items: list[UploadItem] = []
    errors: list[UploadError] = []
    queued: list[str] = []

    for upload in files:
        filename = upload.filename or "asset"
        try:
            data = await upload.read()
            info = validate_file(filename, upload.content_type, data, settings)
            checksum = hashlib.sha256(data).hexdigest()

            existing = await session.scalar(
                select(Asset)
                .options(selectinload(Asset.metadata_rel))
                .where(Asset.checksum == checksum)
            )
            if existing is not None:
                items.append(UploadItem(asset=asset_to_read(existing), duplicate=True))
                continue

            relative_path = storage.new_asset_path(f".{info.extension}")
            await asyncio.to_thread(storage.write_bytes, relative_path, data)

            asset = Asset(
                name=Path(info.safe_name).stem[:200] or "asset",
                original_name=info.original_name,
                file_type=info.file_type,
                mime_type=info.mime_type,
                file_path=relative_path,
                file_size=info.size,
                checksum=checksum,
                status="processing",
            )
            session.add(asset)
            await session.flush()
            items.append(UploadItem(asset=asset_to_read(asset)))
            queued.append(asset.id)
        except FileValidationError as exc:
            errors.append(UploadError(filename=filename, message=str(exc)))
        except Exception as exc:  # noqa: BLE001 - keep multi-upload resilient
            errors.append(UploadError(filename=filename, message=f"上传失败：{exc}"))
        finally:
            await upload.close()

    await session.commit()

    for asset_id in queued:
        background_tasks.add_task(ingest_asset, asset_id)

    return UploadResponse(items=items, errors=errors)


@router.get("", response_model=AssetListResponse)
async def list_assets(
    q: str | None = Query(default=None, max_length=200),
    file_type: str | None = None,
    status: str | None = None,
    category: str | None = None,
    tag: str | None = None,
    sort: Literal["recent", "name", "size"] = "recent",
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=24, ge=1, le=100),
    session: AsyncSession = Depends(get_session),
) -> AssetListResponse:
    conditions = []
    needs_metadata_join = False

    if q:
        needs_metadata_join = True
        pattern = f"%{q.strip()}%"
        conditions.append(
            or_(
                Asset.name.ilike(pattern),
                Asset.original_name.ilike(pattern),
                AssetMetadata.summary.ilike(pattern),
                AssetMetadata.description.ilike(pattern),
                AssetMetadata.search_text.ilike(pattern),
            )
        )
    if file_type:
        conditions.append(Asset.file_type == file_type)
    if status:
        conditions.append(Asset.status == status)
    if category:
        conditions.append(or_(Asset.category == category, AssetMetadata.category == category))
    if tag:
        conditions.append(cast(AssetMetadata.tags, String).like(f'%"{tag}"%'))

    stmt = select(Asset).options(
        selectinload(Asset.metadata_rel),
        selectinload(Asset.chunks),
    )
    count_stmt = select(func.count(func.distinct(Asset.id))).select_from(Asset)

    if needs_metadata_join or category or tag:
        stmt = stmt.outerjoin(AssetMetadata, AssetMetadata.asset_id == Asset.id)
        count_stmt = count_stmt.outerjoin(AssetMetadata, AssetMetadata.asset_id == Asset.id)

    if conditions:
        stmt = stmt.where(*conditions)
        count_stmt = count_stmt.where(*conditions)

    if sort == "name":
        stmt = stmt.order_by(Asset.name.asc())
    elif sort == "size":
        stmt = stmt.order_by(Asset.file_size.desc())
    else:
        stmt = stmt.order_by(Asset.created_at.desc())

    total = int(await session.scalar(count_stmt) or 0)
    assets = (
        await session.scalars(stmt.offset((page - 1) * page_size).limit(page_size))
    ).unique().all()

    return AssetListResponse(
        items=[asset_to_read(asset) for asset in assets],
        total=total,
        page=page,
        page_size=page_size,
    )


@router.get("/{asset_id}", response_model=AssetDetail)
async def get_asset(
    asset_id: str,
    session: AsyncSession = Depends(get_session),
) -> AssetDetail:
    asset = await session.scalar(_get_asset_query(asset_id))
    if asset is None:
        raise HTTPException(status_code=404, detail="素材不存在")
    return asset_to_read(asset, include_chunks=True)


@router.patch("/{asset_id}", response_model=AssetRead)
async def update_asset(
    asset_id: str,
    payload: AssetUpdate,
    session: AsyncSession = Depends(get_session),
) -> AssetRead:
    asset = await session.scalar(
        select(Asset)
        .options(selectinload(Asset.metadata_rel), selectinload(Asset.chunks))
        .where(Asset.id == asset_id)
    )
    if asset is None:
        raise HTTPException(status_code=404, detail="素材不存在")

    data = payload.model_dump(exclude_unset=True)
    if "name" in data and data["name"]:
        asset.name = data["name"]
    if "category" in data:
        asset.category = data["category"]

    meta = asset.metadata_rel
    if meta is None and ("tags" in data or "category" in data):
        meta = AssetMetadata(asset_id=asset.id, tags=[], keywords=[], search_text="")
        session.add(meta)

    if "tags" in data and data["tags"] is not None:
        assert meta is not None
        meta.tags = list(dict.fromkeys(tag.strip() for tag in data["tags"] if tag.strip()))[:12]
    if meta is not None and "category" in data:
        meta.category = data["category"]

    if meta is not None:
        meta.search_text = build_search_text(
            asset.name,
            asset.category or meta.category or "",
            meta.summary or "",
            meta.description or "",
            meta.tags or [],
            meta.keywords or [],
        )

    await session.commit()
    await session.refresh(asset, ["metadata_rel", "chunks"])
    return asset_to_read(asset)


@router.delete("/{asset_id}")
async def delete_asset(
    asset_id: str,
    session: AsyncSession = Depends(get_session),
) -> dict[str, str]:
    asset = await session.scalar(select(Asset).where(Asset.id == asset_id))
    if asset is None:
        raise HTTPException(status_code=404, detail="素材不存在")

    file_path = asset.file_path
    thumbnail_path = asset.thumbnail_path
    await session.delete(asset)
    await session.commit()
    get_vector_store().delete_asset(asset_id)

    await asyncio.to_thread(storage.delete, file_path)
    await asyncio.to_thread(storage.delete, thumbnail_path)
    return {"id": asset_id, "status": "deleted"}


@router.post("/{asset_id}/reanalyze", response_model=AssetRead)
async def reanalyze_asset(
    asset_id: str,
    background_tasks: BackgroundTasks,
    session: AsyncSession = Depends(get_session),
) -> AssetRead:
    asset = await session.scalar(
        select(Asset)
        .options(selectinload(Asset.metadata_rel), selectinload(Asset.chunks))
        .where(Asset.id == asset_id)
    )
    if asset is None:
        raise HTTPException(status_code=404, detail="素材不存在")

    asset.status = "processing"
    asset.error_message = None
    await session.commit()
    background_tasks.add_task(ingest_asset, asset.id)
    return asset_to_read(asset)


@router.get("/{asset_id}/status")
async def get_asset_status(
    asset_id: str,
    session: AsyncSession = Depends(get_session),
) -> dict:
    asset = await session.get(Asset, asset_id)
    if asset is None:
        raise HTTPException(status_code=404, detail="素材不存在")
    return {
        "id": asset.id,
        "status": asset.status,
        "error_message": asset.error_message,
        "updated_at": asset.updated_at,
    }


@router.get("/{asset_id}/file")
async def get_asset_file(
    asset_id: str,
    download: bool = False,
    session: AsyncSession = Depends(get_session),
):
    asset = await session.get(Asset, asset_id)
    if asset is None:
        raise HTTPException(status_code=404, detail="素材不存在")
    try:
        path = storage.absolute(asset.file_path)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail="非法文件路径") from exc
    if not path.exists():
        raise HTTPException(status_code=404, detail="原文件不存在")
    return FileResponse(
        path,
        media_type=asset.mime_type,
        filename=asset.original_name,
        content_disposition_type="attachment" if download else "inline",
    )


@router.get("/{asset_id}/thumbnail")
async def get_asset_thumbnail(
    asset_id: str,
    session: AsyncSession = Depends(get_session),
):
    asset = await session.get(Asset, asset_id)
    if asset is None:
        raise HTTPException(status_code=404, detail="素材不存在")
    if not asset.thumbnail_path:
        raise HTTPException(status_code=404, detail="缩略图不存在")
    try:
        path = storage.absolute(asset.thumbnail_path)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail="非法缩略图路径") from exc
    if not path.exists():
        raise HTTPException(status_code=404, detail="缩略图不存在")
    return FileResponse(path, media_type="image/jpeg")
