from __future__ import annotations

import asyncio
from collections import Counter

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.db.models import Asset
from app.schemas.asset import FacetCount, StatsResponse
from app.services.storage import get_storage


async def get_stats(session: AsyncSession) -> StatsResponse:
    rows = (
        await session.execute(select(Asset.status, func.count(Asset.id)).group_by(Asset.status))
    ).all()
    counts = {status: count for status, count in rows}

    category_rows = (
        await session.execute(
            select(Asset.category, func.count(Asset.id))
            .where(Asset.category.is_not(None))
            .group_by(Asset.category)
            .order_by(func.count(Asset.id).desc())
        )
    ).all()

    assets = list(
        (
            await session.scalars(
                select(Asset)
                .options(selectinload(Asset.metadata_rel))
                .where(Asset.status == "ready")
            )
        )
        .unique()
        .all()
    )
    tag_counts: Counter[str] = Counter()
    for asset in assets:
        meta = asset.__dict__.get("metadata_rel")
        if meta:
            for tag in meta.tags or []:
                tag_counts[tag] += 1

    last_updated = await session.scalar(select(func.max(Asset.updated_at)))
    storage_bytes = await asyncio.to_thread(get_storage().total_size)

    return StatsResponse(
        total=sum(counts.values()),
        ready=counts.get("ready", 0),
        processing=counts.get("processing", 0),
        failed=counts.get("failed", 0),
        storage_bytes=storage_bytes,
        categories=[
            FacetCount(value=value, count=count)
            for value, count in category_rows
            if value is not None
        ],
        top_tags=[
            FacetCount(value=value, count=count)
            for value, count in tag_counts.most_common(10)
        ],
        last_updated=last_updated,
    )
