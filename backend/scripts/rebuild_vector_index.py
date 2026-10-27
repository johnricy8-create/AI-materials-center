"""Rebuild the sqlite-vec index from asset_chunks.embedding_json.

Run from backend/:
    uv run python -m scripts.rebuild_vector_index
"""

import asyncio
import logging

from sqlalchemy import select

from app.db.models import AssetChunk
from app.db.session import SessionLocal, init_db
from app.services.vector_store import get_vector_store

logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")
logger = logging.getLogger("rebuild-vectors")


async def main() -> None:
    await init_db()
    store = get_vector_store()
    if not store.available:
        raise SystemExit("sqlite-vec 不可用")

    async with SessionLocal() as session:
        chunks = list(
            (
                await session.scalars(
                    select(AssetChunk).where(AssetChunk.embedding_json.is_not(None))
                )
            ).all()
        )
    rows = [
        (chunk.id, chunk.asset_id, chunk.embedding_json)
        for chunk in chunks
        if isinstance(chunk.embedding_json, list) and chunk.embedding_json
    ]
    ok = store.upsert_many(rows)
    logger.info("indexed %s chunks: %s", len(rows), ok)
    logger.info("vector count: %s", store.count())


if __name__ == "__main__":
    asyncio.run(main())
