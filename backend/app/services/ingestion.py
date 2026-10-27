from __future__ import annotations

import asyncio
import logging

from sqlalchemy import delete, select
from sqlalchemy.orm import selectinload

from app.core.config import get_settings
from app.db.models import Asset, AssetChunk, AssetMetadata, utcnow
from app.db.session import SessionLocal
from app.providers.glm import GlmClient
from app.services.ai_analysis_service import analyze_asset
from app.services.parser_service import parse_file
from app.services.storage import get_storage
from app.services.vector_store import get_vector_store

logger = logging.getLogger(__name__)
_processing_semaphore = asyncio.Semaphore(2)
settings = get_settings()


async def _embed_chunks(
    client: GlmClient,
    chunks: list,
) -> list[list[float]] | None:
    if not chunks or settings.use_mock_ai or not client.configured:
        return None
    try:
        vectors: list[list[float]] = []
        for start in range(0, len(chunks), 16):
            batch = chunks[start : start + 16]
            vectors.extend(await client.embed([chunk.content for chunk in batch]))
        return vectors if len(vectors) == len(chunks) else None
    except Exception as exc:  # noqa: BLE001 - embeddings are optional for retrieval
        logger.warning("embedding failed for %s chunks: %s", len(chunks), exc)
        return None


async def ingest_asset(asset_id: str) -> None:
    async with _processing_semaphore:
        storage = get_storage()
        async with SessionLocal() as session:
            asset = await session.scalar(
                select(Asset)
                .options(selectinload(Asset.metadata_rel), selectinload(Asset.chunks))
                .where(Asset.id == asset_id)
            )
            if asset is None:
                logger.warning("asset %s not found for ingestion", asset_id)
                return

            asset.status = "processing"
            asset.error_message = None
            await session.commit()

            try:
                path = storage.absolute(asset.file_path)
                parsed = await asyncio.to_thread(parse_file, path, asset.file_type)
                analysis = await analyze_asset(
                    name=asset.name,
                    file_type=asset.file_type,
                    parsed=parsed,
                    original_path=path,
                    settings=settings,
                    client=GlmClient(settings),
                )

                if parsed.thumbnail_bytes:
                    thumbnail_path = asset.thumbnail_path or storage.new_thumbnail_path()
                    await asyncio.to_thread(
                        storage.write_bytes, thumbnail_path, parsed.thumbnail_bytes
                    )
                    asset.thumbnail_path = thumbnail_path

                embeddings = await _embed_chunks(GlmClient(settings), analysis.chunks)

                await session.execute(
                    delete(AssetChunk).where(AssetChunk.asset_id == asset.id)
                )
                await session.execute(
                    delete(AssetMetadata).where(AssetMetadata.asset_id == asset.id)
                )
                await session.flush()

                metadata = AssetMetadata(
                    asset_id=asset.id,
                    summary=analysis.summary,
                    description=analysis.description,
                    category=analysis.category,
                    tags=analysis.tags,
                    keywords=analysis.keywords,
                    search_text=analysis.search_text,
                    width=parsed.width,
                    height=parsed.height,
                    page_count=parsed.page_count,
                    char_count=parsed.char_count,
                    ai_model=analysis.model,
                    analysis_version=analysis.version,
                )
                session.add(metadata)
                chunk_models = [
                    AssetChunk(
                        asset_id=asset.id,
                        chunk_index=chunk.index,
                        content=chunk.content,
                        token_count=chunk.token_count,
                        embedding_json=(
                            embeddings[chunk.index]
                            if embeddings and chunk.index < len(embeddings)
                            else None
                        ),
                        meta=chunk.meta,
                    )
                    for chunk in analysis.chunks
                ]
                session.add_all(chunk_models)
                await session.flush()

                if embeddings:
                    vector_rows = [
                        (
                            chunk.id,
                            asset.id,
                            embeddings[chunk.chunk_index],
                        )
                        for chunk in chunk_models
                        if chunk.chunk_index < len(embeddings)
                    ]
                    vector_store = get_vector_store()
                    vector_store.delete_asset(asset.id)
                    vector_store.upsert_many(vector_rows)

                asset.category = analysis.category
                asset.status = "ready"
                asset.error_message = None
                asset.updated_at = utcnow()
                await session.commit()
                logger.info(
                    "asset ingested id=%s type=%s chunks=%s",
                    asset.id,
                    asset.file_type,
                    len(analysis.chunks),
                )
            except Exception as exc:  # noqa: BLE001 - task boundary must persist errors
                await session.rollback()
                logger.exception("asset ingestion failed id=%s", asset_id)
                asset = await session.scalar(select(Asset).where(Asset.id == asset_id))
                if asset is not None:
                    asset.status = "failed"
                    asset.error_message = str(exc)[:1000]
                    asset.updated_at = utcnow()
                    await session.commit()
