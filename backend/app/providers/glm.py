from __future__ import annotations

import asyncio
import base64
import json
import logging
import re
from dataclasses import dataclass
from typing import Any

import httpx

from app.core.config import Settings

logger = logging.getLogger(__name__)

ALLOWED_CATEGORIES = [
    "产品图",
    "场景图",
    "模特图",
    "海报",
    "生活方式",
    "行业报告",
    "品牌资料",
    "文案",
    "文档",
    "图片",
    "其他",
]

METADATA_PROMPT = """你是一个电商素材分析助手。请根据素材信息生成结构化元数据。

只输出一个 JSON 对象，不要输出 Markdown、解释或多余文字。字段如下：
- summary: 80-120 字中文摘要，说明画面/内容、风格和适用场景
- description: 150-300 字中文描述，包含主体、环境、色调、材质或文档要点
- category: 从以下枚举中选择一个：{categories}
- tags: 5-8 个中文标签
- keywords: 5-10 个中文/英文关键词
- use_cases: 3 个适用场景
- audience: 目标人群
- content_type: 内容类型，如 product_scene / product_shot / report / copy

要求：只基于提供的素材信息，不要虚构品牌、价格、成分或参数。

素材名称：{name}
素材类型：{file_type}
内容/文本：
{content}
""".strip()

VISION_PROMPT = """请分析这张电商素材图片，只输出一个 JSON 对象，不要 Markdown。
字段：
- summary: 80-120 字中文摘要
- description: 150-300 字中文画面描述，包含主体、场景、构图、光线、色彩、风格
- category: 从以下枚举中选择一个：{categories}
- tags: 5-8 个中文标签
- keywords: 5-10 个中文/英文关键词
- use_cases: 3 个适用场景
- audience: 目标人群
- content_type: product_scene / product_shot / model_shot / poster / lifestyle

只描述图片中真实可见的信息，不虚构品牌和参数。图片文件名：{name}
""".strip()


class GlmError(RuntimeError):
    pass


@dataclass
class GlmUsage:
    model: str
    prompt_tokens: int = 0
    completion_tokens: int = 0
    total_tokens: int = 0


def _extract_json(text: str) -> dict[str, Any]:
    cleaned = text.strip()
    cleaned = re.sub(r"^```(?:json)?\s*", "", cleaned, flags=re.IGNORECASE)
    cleaned = re.sub(r"\s*```$", "", cleaned)
    try:
        value = json.loads(cleaned)
        if isinstance(value, dict):
            return value
    except json.JSONDecodeError:
        pass

    start = cleaned.find("{")
    end = cleaned.rfind("}")
    if start != -1 and end > start:
        value = json.loads(cleaned[start : end + 1])
        if isinstance(value, dict):
            return value
    raise GlmError("模型返回的 JSON 无法解析")


def _string_list(value: Any, limit: int) -> list[str]:
    if not isinstance(value, list):
        return []
    result: list[str] = []
    for item in value:
        text = str(item).strip()
        if text and text not in result:
            result.append(text[:40])
        if len(result) >= limit:
            break
    return result


class GlmClient:
    def __init__(self, settings: Settings) -> None:
        self.settings = settings
        self.base_url = settings.glm_base_url.rstrip("/")

    @property
    def configured(self) -> bool:
        return bool(self.settings.glm_api_key and self.settings.glm_model)

    async def _post(self, path: str, payload: dict[str, Any]) -> dict[str, Any]:
        if not self.configured:
            raise GlmError("GLM 未配置")

        headers = {
            "Authorization": f"Bearer {self.settings.glm_api_key}",
            "Content-Type": "application/json",
        }
        last_error: Exception | None = None
        attempts = self.settings.glm_max_retries + 1

        for attempt in range(attempts):
            try:
                async with httpx.AsyncClient(
                    timeout=httpx.Timeout(self.settings.glm_timeout_seconds)
                ) as client:
                    response = await client.post(
                        f"{self.base_url}{path}", headers=headers, json=payload
                    )
                if response.status_code == 200:
                    return response.json()
                if response.status_code in {429, 500, 502, 503, 504} and attempt < attempts - 1:
                    await asyncio.sleep(1.2 * (attempt + 1))
                    last_error = GlmError(
                        f"模型服务暂时不可用（HTTP {response.status_code}）"
                    )
                    continue
                detail = response.text[:400]
                raise GlmError(f"模型调用失败（HTTP {response.status_code}）：{detail}")
            except (httpx.TimeoutException, httpx.NetworkError) as exc:
                last_error = exc
                if attempt < attempts - 1:
                    await asyncio.sleep(1.2 * (attempt + 1))
                    continue
                raise GlmError(f"模型网络错误：{exc}") from exc

        raise GlmError(str(last_error) if last_error else "模型调用失败")

    async def chat_json(
        self,
        messages: list[dict[str, Any]],
        *,
        model: str | None = None,
        json_mode: bool = True,
        temperature: float = 0.2,
        max_tokens: int = 1600,
    ) -> tuple[dict[str, Any], GlmUsage]:
        payload: dict[str, Any] = {
            "model": model or self.settings.glm_model,
            "messages": messages,
            "temperature": temperature,
            "max_tokens": max_tokens,
        }
        if json_mode:
            payload["response_format"] = {"type": "json_object"}

        try:
            data = await self._post("/chat/completions", payload)
        except GlmError:
            # Some multimodal endpoints reject response_format; retry once without it.
            if json_mode:
                payload.pop("response_format", None)
                data = await self._post("/chat/completions", payload)
            else:
                raise

        try:
            choice = data["choices"][0]
            content = choice["message"].get("content") or ""
            usage = data.get("usage") or {}
            parsed = _extract_json(content)
            return parsed, GlmUsage(
                model=data.get("model") or payload["model"],
                prompt_tokens=int(usage.get("prompt_tokens") or 0),
                completion_tokens=int(usage.get("completion_tokens") or 0),
                total_tokens=int(usage.get("total_tokens") or 0),
            )
        except (KeyError, IndexError, TypeError, json.JSONDecodeError) as exc:
            raise GlmError(f"模型响应格式异常：{exc}") from exc

    async def analyze_text(self, name: str, file_type: str, content: str) -> dict[str, Any]:
        prompt = METADATA_PROMPT.format(
            categories="、".join(ALLOWED_CATEGORIES),
            name=name,
            file_type=file_type,
            content=content[:6000],
        )
        messages = [{"role": "user", "content": prompt}]
        model = self.settings.glm_model
        try:
            parsed, usage = await self.chat_json(messages, model=model, max_tokens=1000)
        except GlmError as exc:
            fallback = self.settings.glm_fallback_model
            if not fallback or fallback == model:
                raise
            logger.warning("primary model unavailable, using fallback %s: %s", fallback, exc)
            model = fallback
            parsed, usage = await self.chat_json(messages, model=model, max_tokens=1000)
        parsed["_model"] = usage.model
        return parsed

    async def analyze_image(self, name: str, image_bytes: bytes, mime_type: str) -> dict[str, Any]:
        encoded = base64.b64encode(image_bytes).decode("ascii")
        prompt = VISION_PROMPT.format(
            categories="、".join(ALLOWED_CATEGORIES),
            name=name,
        )
        messages = [
            {
                "role": "user",
                "content": [
                    {
                        "type": "image_url",
                        "image_url": {"url": f"data:{mime_type};base64,{encoded}"},
                    },
                    {"type": "text", "text": prompt},
                ],
            }
        ]
        parsed, usage = await self.chat_json(
            messages,
            model=self.settings.glm_vision_model,
            json_mode=False,
            max_tokens=900,
        )
        parsed["_model"] = usage.model
        return parsed

    async def embed(self, texts: list[str]) -> list[list[float]]:
        payload = {
            "model": self.settings.embedding_model,
            "input": texts,
            "dimensions": self.settings.embedding_dim,
        }
        data = await self._post("/embeddings", payload)
        rows = sorted(data.get("data", []), key=lambda item: item.get("index", 0))
        return [row["embedding"] for row in rows]
