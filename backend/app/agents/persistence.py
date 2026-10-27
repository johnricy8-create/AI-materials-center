from __future__ import annotations

from typing import Any

from app.db.models import AgentTaskStep
from app.db.session import SessionLocal


async def save_step(
    *,
    task_id: str,
    step_index: int,
    node_name: str,
    input_data: dict[str, Any],
    output_data: dict[str, Any],
    duration_ms: int,
    status: str,
    error: str | None = None,
) -> None:
    async with SessionLocal() as session:
        session.add(
            AgentTaskStep(
                task_id=task_id,
                step_index=step_index,
                node_name=node_name,
                input=input_data,
                output=output_data,
                duration_ms=duration_ms,
                status=status,
                error=error,
            )
        )
        await session.commit()
