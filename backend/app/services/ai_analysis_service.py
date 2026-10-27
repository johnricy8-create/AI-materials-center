from __future__ import annotations

import logging
from pathlib import Path
from typing import Any

from app.core.config import Settings
from app.providers.glm import ALLOWED_CATEGORIES, GlmClient, GlmError
from app.services.analysis_service import (
    AnalysisResult,
    ChunkResult,
    _chunk_text,
    analyze_basic,
    build_search_text,
)
from app.services.parser_service import ParsedContent, prepare_image_for_vision

logger = logging.getLogger(__name__)


def _clean_text(value: Any, limit: int) -> str:
    if not isinstance(value, str):
        return ""
    return value.strip()[:limit]


def _clean_list(value: Any, limit: int) -> list[str]:
    if not isinstance(value, list):
        return []
    result: list[str] = []
    for item in value:
        text = str(item).strip()[:40]
        if text and text not in result:
            result.append(text)
        if len(result) >= limit:
            break
    return result


def _to_result(
    raw: dict[str, Any],
    *,
    name: str,
    file_type: str,
    parsed: ParsedContent,
    basic: AnalysisResult,
    model: str,
) -> AnalysisResult:
    actual_model = _clean_text(raw.pop("_model", ""), 128) or model
    summary = _clean_text(raw.get("summary"), 220) or basic.summary
    description = _clean_text(raw.get("description"), 800) or basic.description
    category = _clean_text(raw.get("category"), 64)
    if category not in ALLOWED_CATEGORIES:
        category = basic.category
    tags = _clean_list(raw.get("tags"), 8) or basic.tags
    keywords = _clean_list(raw.get("keywords"), 10) or basic.keywords
    use_cases = _clean_list(raw.get("use_cases"), 3)

    if file_type == "image" and category == "产品图":
        scene_hint = f"{summary} {description} {' '.join(tags)}"
        if any(
            word in scene_hint
            for word in ("风景", "花卉", "自然风光", "天空", "海边", "沙滩", "草地", "旅行")
        ):
            category = "场景图"

    if file_type == "image":
        chunks = [
            ChunkResult(
                index=0,
                content=(
                    f"{name}。{summary}。{description}。"
                    f"标签：{'、'.join(tags)}。适用：{'、'.join(use_cases)}"
                ),
                token_count=len(summary) + len(description),
                meta={"type": "image", "model": actual_model},
            )
        ]
    else:
        chunks = _chunk_text(parsed.text)
        if not chunks:
            chunks = [
                ChunkResult(
                    index=0,
                    content=f"{name}。{summary}",
                    token_count=len(summary),
                    meta={"type": "empty"},
                )
            ]

    search_text = build_search_text(
        name,
        category,
        f"{summary} {' '.join(use_cases)}",
        description,
        tags,
        keywords,
    )
    return AnalysisResult(
        summary=summary,
        description=description,
        category=category,
        tags=tags,
        keywords=keywords,
        search_text=search_text,
        chunks=chunks,
        model=actual_model,
        version="m2",
    )


async def analyze_asset(
    *,
    name: str,
    file_type: str,
    parsed: ParsedContent,
    original_path: Path,
    settings: Settings,
    client: GlmClient,
) -> AnalysisResult:
    basic = analyze_basic(name, file_type, parsed)
    if settings.use_mock_ai or not client.configured:
        return basic

    try:
        if file_type == "image":
            image_bytes = await _prepare_image(original_path)
            raw = await client.analyze_image(name, image_bytes, "image/jpeg")
            return _to_result(
                raw,
                name=name,
                file_type=file_type,
                parsed=parsed,
                basic=basic,
                model=settings.glm_vision_model,
            )

        if not parsed.text.strip():
            return basic

        raw = await client.analyze_text(name, file_type, parsed.text)
        return _to_result(
            raw,
            name=name,
            file_type=file_type,
            parsed=parsed,
            basic=basic,
            model=settings.glm_model,
        )
    except GlmError as exc:
        logger.warning("GLM analysis failed for %s: %s", name, exc)
    except Exception as exc:  # noqa: BLE001 - always produce a usable asset
        logger.exception("AI analysis failed for %s: %s", name, exc)
    return basic


async def _prepare_image(path: Path) -> bytes:
    import asyncio

    return await asyncio.to_thread(prepare_image_for_vision, path)
