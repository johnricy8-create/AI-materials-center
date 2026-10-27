"""Backfill embeddings for existing chunks.

Run from backend/:
    uv run python scripts/backfill_embeddings.py
"""

import asyncio
import logging

from sqlalchemy import select

from app.core.config import get_settings
from app.db.models import AssetChunk
from app.db.session import SessionLocal, init_db
from app.providers.glm import GlmClient

logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")
logger = logging.getLogger("backfill-embeddings")


async def main() -> None:
    settings = get_settings()
    if settings.use_mock_ai or not settings.glm_api_key:
        raise SystemExit("USE_MOCK_AI=true 或未配置 GLM_API_KEY，无法生成向量")

    await init_db()
    client = GlmClient(settings)
    updated = 0

    async with SessionLocal() as session:
        chunks = list(
            (
                await session.scalars(
                    select(AssetChunk).where(AssetChunk.embedding_json.is_(None))
                )
            ).all()
        )
        logger.info("pending chunks: %s", len(chunks))

        for start in range(0, len(chunks), 16):
            batch = chunks[start : start + 16]
            try:
                vectors = await client.embed([chunk.content for chunk in batch])
            except Exception as exc:  # noqa: BLE001
                logger.error("embedding batch failed: %s", exc)
                break
            for chunk, vector in zip(batch, vectors, strict=False):
                chunk.embedding_json = vector
                updated += 1
            await session.commit()
            logger.info("embedded %s / %s", updated, len(chunks))

    logger.info("done: %s chunks updated", updated)


if __name__ == "__main__":
    asyncio.run(main())
