from __future__ import annotations

import math
import re
import time
from collections import Counter
from typing import Any

import jieba
from sqlalchemy import String, cast, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.config import get_settings
from app.db.models import Asset, AssetChunk, AssetMetadata
from app.providers.glm import GlmClient
from app.schemas.asset import (
    AssetRead,
    FacetCount,
    FacetsResponse,
    SearchFilters,
    SearchHit,
    SearchRequest,
    SearchResponse,
)
from app.services.analysis_service import STOPWORDS
from app.services.serializers import asset_to_read
from app.services.vector_store import get_vector_store

settings = get_settings()


def query_tokens(query: str) -> list[str]:
    tokens: list[str] = []
    for token in jieba.lcut_for_search(query):
        token = re.sub(r"\s+", "", token).strip().lower()
        if len(token) < 2 or token in STOPWORDS:
            continue
        if token not in tokens:
            tokens.append(token)
    return tokens or [query.strip().lower()]


def _filters_conditions(filters: SearchFilters):
    conditions: list[Any] = []
    if filters.file_types:
        conditions.append(Asset.file_type.in_(filters.file_types))
    if filters.category:
        conditions.append(
            or_(Asset.category == filters.category, AssetMetadata.category == filters.category)
        )
    for tag in filters.tags:
        conditions.append(cast(AssetMetadata.tags, String).like(f'%"{tag}"%'))
    return conditions


def _cosine(left: list[float], right: list[float]) -> float:
    if not left or not right:
        return 0.0
    dot = sum(a * b for a, b in zip(left, right, strict=False))
    norm_left = math.sqrt(sum(a * a for a in left))
    norm_right = math.sqrt(sum(b * b for b in right))
    if not norm_left or not norm_right:
        return 0.0
    return max(-1.0, min(1.0, dot / (norm_left * norm_right)))


async def _query_embedding(query: str) -> list[float] | None:
    if settings.use_mock_ai or not settings.glm_api_key:
        return None
    try:
        client = GlmClient(settings)
        vectors = await client.embed([query])
        return vectors[0] if vectors else None
    except Exception:
        return None


async def _keyword_hits(
    session: AsyncSession,
    request: SearchRequest,
    tokens: list[str],
) -> tuple[list[SearchHit], int]:
    conditions = [Asset.status == "ready", *_filters_conditions(request.filters)]
    keyword_conditions = []
    for token in tokens:
        keyword_conditions.append(AssetMetadata.search_text.ilike(f"%{token}%"))
        keyword_conditions.append(Asset.name.ilike(f"%{token}%"))
    conditions.append(or_(*keyword_conditions))

    base = (
        select(Asset)
        .join(AssetMetadata, AssetMetadata.asset_id == Asset.id)
        .where(*conditions)
        .options(selectinload(Asset.metadata_rel))
    )
    count_stmt = (
        select(func.count(Asset.id))
        .select_from(Asset)
        .join(AssetMetadata, AssetMetadata.asset_id == Asset.id)
        .where(*conditions)
    )
    total_candidates = int(await session.scalar(count_stmt) or 0)
    assets = list(
        (await session.scalars(base.order_by(Asset.created_at.desc()).limit(100))).unique().all()
    )

    hits: list[SearchHit] = []
    query_lower = request.query.lower()
    for asset in assets:
        meta = asset.__dict__.get("metadata_rel")
        haystack = " ".join(
            [
                asset.name,
                (meta.search_text if meta else "") or "",
                " ".join(meta.tags or []) if meta else "",
            ]
        ).lower()
        matched = [token for token in tokens if token in haystack]
        ratio = len(matched) / max(len(tokens), 1)
        score = 0.62 + ratio * 0.31
        if request.filters.category and asset.category == request.filters.category:
            score += 0.03
        if meta and any(tag in query_lower for tag in (meta.tags or [])):
            score += 0.02
        score = round(min(score, 0.97), 2)

        reason_parts = []
        if matched:
            reason_parts.append(f"命中关键词「{'、'.join(matched[:4])}」")
        if meta and meta.category:
            reason_parts.append(f"分类为「{meta.category}」")
        if meta and meta.tags:
            reason_parts.append(f"标签：{'、'.join((meta.tags or [])[:3])}")
        reason = "；".join(reason_parts) or "素材元数据与查询相关"

        snippet = (meta.summary if meta else None) or asset.name
        hits.append(
            SearchHit(
                asset=asset_to_read(asset),
                score=score,
                match_reason=reason,
                snippet=snippet,
            )
        )
    return hits, total_candidates


async def _vector_candidates(
    session: AsyncSession,
    request: SearchRequest,
    query_vector: list[float],
) -> dict[str, tuple[Asset, float, str]]:
    conditions = [
        Asset.status == "ready",
        *_filters_conditions(request.filters),
    ]

    vector_store = get_vector_store()
    vector_hits = vector_store.search(query_vector, limit=100) if vector_store.available else []
    if vector_hits:
        by_chunk = {hit.chunk_id: hit for hit in vector_hits}
        stmt = (
            select(AssetChunk)
            .join(Asset, Asset.id == AssetChunk.asset_id)
            .join(AssetMetadata, AssetMetadata.asset_id == Asset.id)
            .where(AssetChunk.id.in_(list(by_chunk)), *conditions)
            .options(
                selectinload(AssetChunk.asset).selectinload(Asset.metadata_rel),
            )
        )
        chunks = list((await session.scalars(stmt)).unique().all())
        best: dict[str, tuple[Asset, float, str]] = {}
        for chunk in chunks:
            hit = by_chunk.get(chunk.id)
            if hit is None:
                continue
            asset = chunk.asset
            current = best.get(asset.id)
            if current is None or hit.similarity > current[1]:
                best[asset.id] = (asset, hit.similarity, chunk.content)
        if best:
            return best

    # Fallback for databases created before the sqlite-vec index existed.
    fallback_conditions = [
        *conditions,
        AssetChunk.embedding_json.is_not(None),
    ]
    stmt = (
        select(AssetChunk)
        .join(Asset, Asset.id == AssetChunk.asset_id)
        .join(AssetMetadata, AssetMetadata.asset_id == Asset.id)
        .where(*fallback_conditions)
        .options(
            selectinload(AssetChunk.asset).selectinload(Asset.metadata_rel),
        )
        .limit(500)
    )
    chunks = list((await session.scalars(stmt)).unique().all())

    best = {}
    for chunk in chunks:
        vector = chunk.embedding_json
        if not isinstance(vector, list) or not vector:
            continue
        similarity = _cosine(query_vector, vector)
        asset = chunk.asset
        current = best.get(asset.id)
        if current is None or similarity > current[1]:
            best[asset.id] = (asset, similarity, chunk.content)
    return best


async def search_assets(session: AsyncSession, request: SearchRequest) -> SearchResponse:
    started = time.perf_counter()
    tokens = query_tokens(request.query)
    hits, total_candidates = await _keyword_hits(session, request, tokens)
    mode = "keyword"
    vector_map: dict[str, tuple[Asset, float, str]] = {}

    if request.mode == "hybrid":
        query_vector = await _query_embedding(request.query)
        if query_vector:
            vector_map = await _vector_candidates(session, request, query_vector)
            if vector_map:
                mode = "hybrid"

    if vector_map:
        keyword_by_id = {hit.asset.id: hit for hit in hits}
        merged = {hit.asset.id: hit for hit in hits}
        for asset_id, (asset, similarity, chunk_text) in vector_map.items():
            semantic = max(0.0, similarity)
            existing = keyword_by_id.get(asset_id)
            if existing is not None:
                semantic_score = 0.45 + 0.55 * semantic
                combined = 0.45 * existing.score + 0.55 * semantic_score
                existing.score = round(min(0.98, combined), 2)
                existing.match_reason = (
                    f"语义相似度 {semantic:.2f}；{existing.match_reason}"
                )
                existing.snippet = existing.snippet or chunk_text[:220]
            else:
                meta = asset.__dict__.get("metadata_rel")
                merged[asset_id] = SearchHit(
                    asset=asset_to_read(asset),
                    score=round(min(0.95, 0.45 + 0.55 * semantic), 2),
                    match_reason=(
                        f"语义相似度 {semantic:.2f}；"
                        f"分类为「{asset.category or (meta.category if meta else '未分类')}」"
                    ),
                    snippet=chunk_text[:220],
                )
        hits = list(merged.values())
        total_candidates = max(total_candidates, len(vector_map))

    hits.sort(key=lambda hit: (hit.score, hit.asset.created_at), reverse=True)
    took_ms = int((time.perf_counter() - started) * 1000)
    notes = (
        "M3 混合检索：Embedding-3 语义召回 + jieba 关键词召回；"
        "当前向量存储为 SQLite JSON，后续迁移 sqlite-vec。"
        if mode == "hybrid"
        else "M1 使用关键词与元数据检索；向量不可用时自动降级。"
    )

    return SearchResponse(
        query=request.query,
        interpreted={
            "semantic_query": request.query,
            "tokens": tokens,
            "filters": request.filters.model_dump(),
            "mode": mode,
            "notes": notes,
        },
        items=hits[: request.top_k],
        total_candidates=total_candidates,
        took_ms=took_ms,
        mode=mode,
    )


async def get_facets(session: AsyncSession) -> FacetsResponse:
    assets = list(
        (
            await session.scalars(
                select(Asset)
                .where(Asset.status == "ready")
                .options(selectinload(Asset.metadata_rel))
            )
        )
        .unique()
        .all()
    )

    type_counts: Counter[str] = Counter()
    category_counts: Counter[str] = Counter()
    tag_counts: Counter[str] = Counter()
    status_counts: Counter[str] = Counter()

    all_assets = list((await session.scalars(select(Asset))).unique().all())
    for asset in all_assets:
        status_counts[asset.status] += 1
    for asset in assets:
        type_counts[asset.file_type] += 1
        if asset.category:
            category_counts[asset.category] += 1
        meta = asset.__dict__.get("metadata_rel")
        if meta:
            for tag in meta.tags or []:
                tag_counts[tag] += 1

    def to_facets(counter: Counter[str]) -> list[FacetCount]:
        return [
            FacetCount(value=value, count=count)
            for value, count in counter.most_common()
        ]

    return FacetsResponse(
        file_types=to_facets(type_counts),
        categories=to_facets(category_counts),
        tags=to_facets(tag_counts),
        statuses=to_facets(status_counts),
    )


def asset_to_search_dict(asset: AssetRead) -> dict:
    return asset.model_dump(mode="json")
