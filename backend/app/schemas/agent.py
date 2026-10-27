from datetime import datetime
from typing import Any

from pydantic import BaseModel, Field


class AgentTaskCreate(BaseModel):
    query: str = Field(min_length=2, max_length=1000)
    mode: str = "auto"


class AgentStepRead(BaseModel):
    id: str
    step_index: int
    node_name: str
    input: dict[str, Any] | None = None
    output: dict[str, Any] | None = None
    duration_ms: int
    status: str
    error: str | None = None
    created_at: datetime


class AgentTaskRead(BaseModel):
    id: str
    user_query: str
    intent: str
    status: str
    result: dict[str, Any] | None = None
    error: str | None = None
    model_usage: dict[str, Any] = Field(default_factory=dict)
    created_at: datetime
    finished_at: datetime | None = None
    steps: list[AgentStepRead] = Field(default_factory=list)


class AgentTaskListResponse(BaseModel):
    items: list[AgentTaskRead]
    total: int
    page: int
    page_size: int
