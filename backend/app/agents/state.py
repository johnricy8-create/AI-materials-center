from __future__ import annotations

from typing import Any, TypedDict


class AgentState(TypedDict, total=False):
    task_id: str
    user_query: str
    intent: str
    filters: dict[str, Any]
    rewritten_query: str
    candidates: list[dict[str, Any]]
    selected_assets: list[dict[str, Any]]
    retry_count: int
    max_retries: int
    evaluation: dict[str, Any]
    generated: dict[str, Any] | None
    answer: str
    error: str | None
    steps: list[dict[str, Any]]
