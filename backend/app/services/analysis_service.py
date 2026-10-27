from __future__ import annotations

import re
from dataclasses import dataclass, field
from pathlib import Path

import jieba

from app.services.parser_service import ParsedContent

STOPWORDS = {
    "的",
    "了",
    "和",
    "是",
    "在",
    "有",
    "与",
    "及",
    "或",
    "一个",
    "我们",
    "这个",
    "可以",
    "进行",
    "素材",
    "文件",
    "图片",
    "文档",
    "the",
    "and",
    "for",
    "with",
    "jpg",
    "jpeg",
    "png",
    "webp",
    "pdf",
    "docx",
    "txt",
    "md",
}


@dataclass
class ChunkResult:
    index: int
    content: str
    token_count: int
    meta: dict = field(default_factory=dict)


@dataclass
class AnalysisResult:
    summary: str
    description: str
    category: str
    tags: list[str]
    keywords: list[str]
    search_text: str
    chunks: list[ChunkResult]
    model: str = "basic-m1"
    version: str = "m1"


def _tokens(text: str) -> list[str]:
    result: list[str] = []
    for token in jieba.lcut(text):
        token = re.sub(r"\s+", "", token).strip().lower()
        if len(token) < 2 or token in STOPWORDS:
            continue
        if token.isdigit():
            continue
        if token not in result:
            result.append(token)
    return result


def _filename_tokens(name: str) -> list[str]:
    stem = Path(name).stem
    pieces = re.split(r"[_\-\s.·]+", stem)
    tokens: list[str] = []
    for piece in pieces:
        for token in _tokens(piece):
            if token not in tokens and not token.startswith("20"):
                tokens.append(token)
    return tokens


def _category_for(name: str, file_type: str, text: str) -> str:
    haystack = f"{name} {text[:300]}"
    if file_type == "image":
        if "海报" in haystack:
            return "海报"
        if "模特" in haystack or "街拍" in haystack:
            return "模特图"
        if "场景" in haystack or "生活" in haystack:
            return "场景图"
        if "产品" in haystack or "商品" in haystack:
            return "产品图"
        return "图片"
    if file_type == "pdf":
        return "行业报告" if "报告" in haystack else "文档"
    if file_type == "docx":
        return "品牌资料" if any(word in haystack for word in ("品牌", "规范", "VI")) else "文档"
    return "文案"


def build_search_text(
    name: str,
    category: str,
    summary: str,
    description: str,
    tags: list[str],
    keywords: list[str],
) -> str:
    return " ".join(
        dict.fromkeys(
            _tokens(
                f"{name} {category} {summary} {description} "
                f"{' '.join(tags)} {' '.join(keywords)}"
            )
        )
    )


def _summary_for(name: str, file_type: str, parsed: ParsedContent) -> tuple[str, str]:
    if file_type == "image":
        size = f"{parsed.width}×{parsed.height}" if parsed.width and parsed.height else "未知尺寸"
        summary = (
            f"图片素材「{name}」，尺寸 {size}。"
            "已完成基础解析，视觉理解将在接入 GLM-4V 后补充。"
        )
        description = (
            f"文件「{name}」已保存并生成缩略图。当前版本可依据文件名、类型和标签检索；"
            "接入视觉模型后会生成画面描述、场景与适用渠道。"
        )
        return summary, description

    clean = re.sub(r"\s+", " ", parsed.text).strip()
    if not clean:
        return (
            f"文档「{name}」已上传，但未提取到可用文本，可能是扫描件或空文档。",
            "建议检查原文件，或后续接入 OCR 后重新解析。",
        )
    summary = clean[:160] + ("…" if len(clean) > 160 else "")
    description = clean[:500] + ("…" if len(clean) > 500 else "")
    return summary, description


def _chunk_text(text: str, size: int = 800, overlap: int = 100) -> list[ChunkResult]:
    clean = re.sub(r"[ \t]+", " ", text).strip()
    if not clean:
        return []
    if len(clean) <= size:
        return [ChunkResult(index=0, content=clean, token_count=len(clean))]

    chunks: list[ChunkResult] = []
    start = 0
    index = 0
    while start < len(clean):
        end = min(start + size, len(clean))
        if end < len(clean):
            boundary = max(clean.rfind("\n", start, end), clean.rfind("。", start, end))
            if boundary > start + size // 2:
                end = boundary + 1
        content = clean[start:end].strip()
        if content:
            chunks.append(
                ChunkResult(
                    index=index,
                    content=content,
                    token_count=len(content),
                    meta={"char_start": start, "char_end": end},
                )
            )
            index += 1
        if end >= len(clean):
            break
        start = max(end - overlap, start + 1)
    return chunks


def analyze_basic(name: str, file_type: str, parsed: ParsedContent) -> AnalysisResult:
    summary, description = _summary_for(name, file_type, parsed)
    category = _category_for(name, file_type, parsed.text)
    filename_tokens = _filename_tokens(name)

    if file_type == "image":
        tags = list(dict.fromkeys([*filename_tokens, "图片", category]))[:8]
        keywords = list(dict.fromkeys([*filename_tokens, category]))[:8]
        chunks = [
            ChunkResult(
                index=0,
                content=f"{name}。{summary}。标签：{'、'.join(tags)}",
                token_count=len(summary) + len(name),
                meta={"type": "image"},
            )
        ]
    else:
        text_tokens = _tokens(parsed.text[:3000])
        tags = list(dict.fromkeys([*filename_tokens, *text_tokens]))[:8]
        keywords = list(dict.fromkeys([*text_tokens, *filename_tokens]))[:10]
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

    search_text = build_search_text(name, category, summary, description, tags, keywords)
    return AnalysisResult(
        summary=summary,
        description=description,
        category=category,
        tags=tags,
        keywords=keywords,
        search_text=search_text,
        chunks=chunks,
    )
