from app.core.config import get_settings
from app.db.models import Asset, AssetChunk
from app.schemas.asset import AssetChunkRead, AssetDetail, AssetRead

settings = get_settings()


def _chunk_read(chunk: AssetChunk) -> AssetChunkRead:
    return AssetChunkRead(
        id=chunk.id,
        chunk_index=chunk.chunk_index,
        content=chunk.content,
        token_count=chunk.token_count,
        meta=chunk.meta or {},
    )


def asset_to_read(asset: Asset, *, include_chunks: bool = False) -> AssetRead | AssetDetail:
    meta = asset.__dict__.get("metadata_rel")
    chunks = asset.__dict__.get("chunks") or []

    common = dict(
        id=asset.id,
        name=asset.name,
        original_name=asset.original_name,
        file_type=asset.file_type,
        mime_type=asset.mime_type,
        file_size=asset.file_size,
        checksum=asset.checksum,
        status=asset.status,
        error_message=asset.error_message,
        category=asset.category or (meta.category if meta else None),
        tags=list(meta.tags or []) if meta else [],
        summary=meta.summary if meta else None,
        description=meta.description if meta else None,
        keywords=list(meta.keywords or []) if meta else [],
        width=meta.width if meta else None,
        height=meta.height if meta else None,
        page_count=meta.page_count if meta else None,
        char_count=meta.char_count if meta else None,
        ai_model=meta.ai_model if meta else None,
        thumbnail_url=(
            f"{settings.api_prefix}/assets/{asset.id}/thumbnail"
            if asset.thumbnail_path
            else None
        ),
        file_url=f"{settings.api_prefix}/assets/{asset.id}/file",
        created_at=asset.created_at,
        updated_at=asset.updated_at,
    )

    if include_chunks:
        return AssetDetail(
            **common,
            chunks=[_chunk_read(chunk) for chunk in chunks],
            analysis_version=meta.analysis_version if meta else None,
        )
    return AssetRead(**common)
