from __future__ import annotations

import json
import logging
import time
from collections.abc import Awaitable, Callable
from functools import wraps
from typing import Any

from langgraph.graph import END, START, StateGraph

from app.agents.events import event_bus
from app.agents.persistence import save_step
from app.agents.state import AgentState
from app.core.config import get_settings
from app.db.session import SessionLocal
from app.providers.glm import GlmClient, GlmError
from app.schemas.asset import SearchFilters, SearchRequest
from app.services.retrieval_service import search_assets as run_search

logger = logging.getLogger(__name__)
settings = get_settings()
client = GlmClient(settings)

INTENT_PROMPT = """你是电商素材 Agent 的意图识别节点。只输出 JSON，不要 Markdown：
{{
  "intent": "search | analyze | generate | recommend | clarify",
  "rewritten_query": "适合检索的简短中文查询",
  "filters": {{
    "file_types": ["image" 或 "pdf" 或 "docx" 或 "txt" 或 "md"],
    "category": "场景图/产品图/模特图/海报/生活方式/行业报告/品牌资料/文案/文档 或 null",
    "tags": ["标签"]
  }}
}}

用户需求：{query}
只提取真实出现的约束，不要编造筛选条件。"""

GENERATE_PROMPT = """你是电商营销文案 Agent。基于给定素材生成 3 个版本的中文文案。

只输出 JSON，不要 Markdown：
{{
  "headline": "一句有画面感的主标题",
  "tone": "文案语气",
  "variants": [
    {{"id": "social", "label": "小红书文案", "content": "正文，150-250 字"}},
    {{"id": "product", "label": "商品介绍", "content": "正文，120-200 字"}},
    {{"id": "ad", "label": "广告短文案", "content": "正文，40-80 字"}}
  ],
  "hashtags": ["#标签"],
  "rationale": "说明文案如何基于素材"
}}

要求：只使用素材中可见的信息，不虚构品牌、价格、成分或参数。

用户需求：{query}
素材：
{assets}"""

REWRITE_PROMPT = """把下面的素材检索需求改写成一个更宽泛、更容易命中的中文查询。
只返回 JSON：{{"query": "改写后的查询"}}
原需求：{query}"""


async def _json_call(prompt: str, *, max_tokens: int = 1000) -> dict[str, Any] | None:
    if settings.use_mock_ai:
        return None
    messages = [{"role": "user", "content": prompt}]
    for model in (settings.glm_model, settings.glm_fallback_model):
        if not model:
            continue
        try:
            parsed, _usage = await client.chat_json(
                messages, model=model, max_tokens=max_tokens
            )
            return parsed
        except GlmError as exc:
            logger.warning("agent model %s failed: %s", model, exc)
            continue
    return None


def _heuristic_intent(query: str) -> dict[str, Any]:
    if "分析" in query:
        intent = "analyze"
    elif any(word in query for word in ("写", "文案", "生成", "种草", "标题", "介绍")):
        intent = "generate"
    elif "推荐" in query:
        intent = "recommend"
    else:
        intent = "search"

    file_types: list[str] = []
    if any(word in query for word in ("图", "场景", "照片", "画面", "视觉", "海报")):
        file_types.append("image")
    if any(word in query for word in ("报告", "PDF", "规范", "文档")):
        file_types.extend(["pdf", "docx"])
    category = None
    if "场景" in query:
        category = "场景图"
    elif "产品" in query:
        category = "产品图"
    elif "模特" in query or "街拍" in query:
        category = "模特图"

    tags = [
        tag
        for tag in (
            "防晒",
            "夏季",
            "清爽",
            "通勤",
            "礼物",
            "母亲节",
            "耳机",
            "咖啡",
            "家居",
            "香氛",
            "护肤",
        )
        if tag in query
    ]
    return {
        "intent": intent,
        "rewritten_query": query,
        "filters": {"file_types": file_types, "category": category, "tags": tags},
    }


def _summarize(update: dict[str, Any]) -> dict[str, Any]:
    summary: dict[str, Any] = {}
    for key in ("intent", "rewritten_query", "retry_count", "answer"):
        if key in update:
            summary[key] = update[key]
    if "evaluation" in update:
        summary["evaluation"] = update["evaluation"]
    if "candidates" in update:
        summary["candidates"] = len(update["candidates"])
    if "selected_assets" in update:
        summary["assets"] = [asset.get("name") for asset in update["selected_assets"]]
    if "generated" in update and update["generated"]:
        summary["headline"] = update["generated"].get("headline")
    return summary


def traced(node_name: str):
    def decorator(
        fn: Callable[[AgentState], Awaitable[dict[str, Any]]],
    ) -> Callable[[AgentState], Awaitable[dict[str, Any]]]:
        @wraps(fn)
        async def wrapper(state: AgentState) -> dict[str, Any]:
            task_id = state["task_id"]
            step_index = len(state.get("steps", []))
            started = time.perf_counter()
            await event_bus.publish(
                task_id,
                {"type": "node_start", "node": node_name, "step": step_index},
            )
            try:
                update = await fn(state)
            except Exception as exc:
                duration_ms = int((time.perf_counter() - started) * 1000)
                await save_step(
                    task_id=task_id,
                    step_index=step_index,
                    node_name=node_name,
                    input_data={
                        "query": state.get("user_query"),
                        "rewritten_query": state.get("rewritten_query"),
                        "retry_count": state.get("retry_count", 0),
                    },
                    output_data={},
                    duration_ms=duration_ms,
                    status="failed",
                    error=str(exc)[:1000],
                )
                await event_bus.publish(
                    task_id,
                    {
                        "type": "error",
                        "node": node_name,
                        "message": str(exc)[:500],
                    },
                )
                raise

            duration_ms = int((time.perf_counter() - started) * 1000)
            summary = _summarize(update)
            await save_step(
                task_id=task_id,
                step_index=step_index,
                node_name=node_name,
                input_data={
                    "query": state.get("user_query"),
                    "rewritten_query": state.get("rewritten_query"),
                    "retry_count": state.get("retry_count", 0),
                },
                output_data=summary,
                duration_ms=duration_ms,
                status="succeeded",
            )
            step = {
                "step_index": step_index,
                "node_name": node_name,
                "output": summary,
                "duration_ms": duration_ms,
                "status": "succeeded",
            }
            update["steps"] = [*state.get("steps", []), step]
            await event_bus.publish(
                task_id,
                {
                    "type": "node_end",
                    "node": node_name,
                    "step": step_index,
                    "duration_ms": duration_ms,
                    "summary": summary,
                },
            )
            return update

        return wrapper

    return decorator


@traced("understand_intent")
async def understand_intent(state: AgentState) -> dict[str, Any]:
    query = state["user_query"]
    parsed = await _json_call(INTENT_PROMPT.format(query=query), max_tokens=700)
    if not parsed:
        parsed = _heuristic_intent(query)

    intent = str(parsed.get("intent") or "search").lower()
    if intent not in {"search", "analyze", "generate", "recommend", "clarify"}:
        intent = "search"
    if any(word in query for word in ("写", "文案", "生成", "种草", "标题", "介绍")):
        intent = "generate"
    elif "分析" in query:
        intent = "analyze"

    filters = parsed.get("filters") if isinstance(parsed.get("filters"), dict) else {}
    file_types = filters.get("file_types") if isinstance(filters.get("file_types"), list) else []
    tags = filters.get("tags") if isinstance(filters.get("tags"), list) else []
    rewritten = str(parsed.get("rewritten_query") or query).strip() or query

    return {
        "intent": intent,
        "rewritten_query": rewritten,
        "filters": {
            "file_types": [str(item) for item in file_types][:5],
            "category": filters.get("category") or None,
            "tags": [str(item) for item in tags][:8],
        },
        "retry_count": state.get("retry_count", 0),
        "max_retries": 1,
    }


@traced("search_assets")
async def search_node(state: AgentState) -> dict[str, Any]:
    filters = state.get("filters") or {}
    file_types = filters.get("file_types") or []
    if state.get("intent") in {"generate", "recommend"} and not any(
        word in state["user_query"] for word in ("文档", "报告", "PDF", "规范")
    ):
        file_types = ["image"]
    category = filters.get("category")
    query = state.get("rewritten_query") or state["user_query"]

    # Intent extraction can hallucinate tag names that do not exist in the
    # library. Use file type/category as soft constraints and drop hard tags.
    response = None
    for attempt in range(3):
        request = SearchRequest(
            query=query,
            filters=SearchFilters(
                file_types=file_types if attempt < 2 else [],
                category=category if attempt == 0 else None,
                tags=[],
            ),
            top_k=8,
            mode="hybrid",
        )
        async with SessionLocal() as session:
            response = await run_search(session, request)
        if response.items:
            break

    candidates = [item.model_dump(mode="json") for item in (response.items if response else [])]
    return {
        "candidates": candidates,
        "selected_assets": [item["asset"] for item in candidates[:3]],
        "evaluation": {"sufficient": False, "mode": response.mode if response else "keyword"},
    }


@traced("evaluate_results")
async def evaluate_results(state: AgentState) -> dict[str, Any]:
    candidates = state.get("candidates", [])
    intent = state.get("intent", "search")
    top_score = float(candidates[0]["score"]) if candidates else 0.0
    minimum = 2 if intent in {"generate", "recommend"} else 1
    sufficient = len(candidates) >= minimum and top_score >= 0.52
    evaluation = {
        "sufficient": sufficient,
        "top_score": top_score,
        "count": len(candidates),
        "retry_count": state.get("retry_count", 0),
    }
    return {
        "evaluation": evaluation,
        "selected_assets": [item["asset"] for item in candidates[:3]],
    }


@traced("rewrite_query")
async def rewrite_query(state: AgentState) -> dict[str, Any]:
    query = state["user_query"]
    parsed = await _json_call(REWRITE_PROMPT.format(query=query), max_tokens=300)
    rewritten = str((parsed or {}).get("query") or f"{query} 场景 素材").strip()
    return {
        "rewritten_query": rewritten,
        "retry_count": state.get("retry_count", 0) + 1,
    }


def _fallback_copy(query: str, assets: list[dict[str, Any]]) -> dict[str, Any]:
    names = [asset.get("name", "素材") for asset in assets]
    primary = assets[0] if assets else {}
    summary = primary.get("summary") or primary.get("name") or "这组素材"
    return {
        "headline": "让素材自己说话",
        "tone": "简洁、自然、有画面感",
        "variants": [
            {
                "id": "social",
                "label": "小红书文案",
                "content": (
                    f"这次想分享一组很适合「{query}」的素材。\n\n"
                    f"{summary}\n\n画面干净、信息克制，适合直接作为内容封面或正文配图。"
                ),
            },
            {
                "id": "product",
                "label": "商品介绍",
                "content": (
                    f"从真实素材出发，保留画面原本的光线与质感。"
                    f"这组素材包含 {len(names)} 个可复用画面，适合商品详情页、"
                    "社交媒体和活动传播。"
                ),
            },
            {
                "id": "ad",
                "label": "广告短文案",
                "content": "好素材，自己会说话。\n从一张图，到一次完整的表达。",
            },
        ],
        "hashtags": ["#内容创作", "#素材灵感", "#品牌表达"],
        "rationale": f"基于 {len(names)} 个检索结果生成，未引入外部商品参数。",
    }


@traced("generate_content")
async def generate_content(state: AgentState) -> dict[str, Any]:
    assets = state.get("selected_assets", [])
    if not assets:
        return {"answer": "没有找到可用于生成文案的素材，请换一种描述或先上传素材。"}

    compact = [
        {
            "name": asset.get("name"),
            "summary": asset.get("summary"),
            "tags": asset.get("tags", []),
            "category": asset.get("category"),
        }
        for asset in assets
    ]
    prompt = GENERATE_PROMPT.format(
        query=state["user_query"],
        assets=json.dumps(compact, ensure_ascii=False, indent=2),
    )
    parsed = await _json_call(prompt, max_tokens=1000)
    if not parsed:
        generated = _fallback_copy(state["user_query"], assets)
    else:
        variants = parsed.get("variants") if isinstance(parsed.get("variants"), list) else []
        cleaned_variants = []
        for index, item in enumerate(variants[:3]):
            if not isinstance(item, dict):
                continue
            cleaned_variants.append(
                {
                    "id": str(item.get("id") or f"variant_{index}"),
                    "label": str(item.get("label") or ("小红书文案" if index == 0 else "文案")),
                    "content": str(item.get("content") or "").strip(),
                }
            )
        if len(cleaned_variants) < 3:
            fallback = _fallback_copy(state["user_query"], assets)
            cleaned_variants.extend(fallback["variants"][len(cleaned_variants) :])
        hashtags = parsed.get("hashtags") if isinstance(parsed.get("hashtags"), list) else []
        generated = {
            "headline": str(parsed.get("headline") or "让素材自己说话").strip(),
            "tone": str(parsed.get("tone") or "自然、可信").strip(),
            "variants": cleaned_variants[:3],
            "hashtags": [
                tag if str(tag).startswith("#") else f"#{tag}" for tag in hashtags[:6]
            ],
            "rationale": str(
                parsed.get("rationale") or f"基于 {len(assets)} 个素材生成。"
            ).strip(),
        }

    return {
        "generated": {
            **generated,
            "used_asset_ids": [asset.get("id") for asset in assets],
        }
    }


@traced("analyze_asset")
async def analyze_asset(state: AgentState) -> dict[str, Any]:
    assets = state.get("selected_assets", [])
    if not assets:
        return {"answer": "没有找到可分析的素材。可以换一个更具体的描述再试。"}
    asset = assets[0]
    answer = (
        f"对「{asset.get('name')}」的分析：\n\n"
        f"{asset.get('summary') or '暂无摘要'}\n\n"
        f"分类：{asset.get('category') or '未分类'}\n"
        f"标签：{'、'.join(asset.get('tags') or []) or '暂无标签'}\n"
        f"适用场景：{'、'.join(asset.get('use_cases') or []) or '待补充'}"
    )
    return {"answer": answer}


@traced("finalize")
async def finalize(state: AgentState) -> dict[str, Any]:
    if state.get("answer"):
        return {"answer": state["answer"]}
    assets = state.get("selected_assets", [])
    if state.get("generated"):
        return {
            "answer": (
                f"已基于 {len(assets)} 个素材生成 3 个版本的文案。"
                "你可以切换小红书、商品介绍或广告短文案，并直接编辑。"
            )
        }
    if state.get("intent") == "search":
        return {
            "answer": (
                f"我找到了 {len(assets)} 个最相关的素材，并附上了匹配理由。"
                if assets
                else "没有找到足够相关的素材，建议换一种描述或补充筛选条件。"
            )
        }
    return {"answer": "任务已完成。"}


def route_intent(state: AgentState) -> str:
    intent = state.get("intent", "search")
    return "finalize" if intent == "clarify" else "search_assets"


def after_evaluate(state: AgentState) -> str:
    evaluation = state.get("evaluation", {})
    if (
        not evaluation.get("sufficient", False)
        and state.get("retry_count", 0) < state.get("max_retries", 1)
    ):
        return "rewrite_query"
    if state.get("intent") == "generate":
        return "generate_content"
    if state.get("intent") == "analyze":
        return "analyze_asset"
    return "finalize"


builder = StateGraph(AgentState)
builder.add_node("understand_intent", understand_intent)
builder.add_node("search_assets", search_node)
builder.add_node("evaluate_results", evaluate_results)
builder.add_node("rewrite_query", rewrite_query)
builder.add_node("generate_content", generate_content)
builder.add_node("analyze_asset", analyze_asset)
builder.add_node("finalize", finalize)

builder.add_edge(START, "understand_intent")
builder.add_conditional_edges(
    "understand_intent",
    route_intent,
    {"search_assets": "search_assets", "finalize": "finalize"},
)
builder.add_edge("search_assets", "evaluate_results")
builder.add_conditional_edges(
    "evaluate_results",
    after_evaluate,
    {
        "rewrite_query": "rewrite_query",
        "generate_content": "generate_content",
        "analyze_asset": "analyze_asset",
        "finalize": "finalize",
    },
)
builder.add_edge("rewrite_query", "search_assets")
builder.add_edge("generate_content", "finalize")
builder.add_edge("analyze_asset", "finalize")
builder.add_edge("finalize", END)

agent_graph = builder.compile()
