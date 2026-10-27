from __future__ import annotations

import logging

from sqlalchemy import select

from app.agents.events import event_bus
from app.agents.graph import agent_graph
from app.db.models import AgentTask, utcnow
from app.db.session import SessionLocal

logger = logging.getLogger(__name__)


async def run_agent_task(task_id: str) -> None:
    async with SessionLocal() as session:
        task = await session.get(AgentTask, task_id)
        if task is None:
            return
        task.status = "running"
        task.error = None
        await session.commit()
        user_query = task.user_query

    state = {
        "task_id": task_id,
        "user_query": user_query,
        "intent": "search",
        "filters": {},
        "rewritten_query": user_query,
        "candidates": [],
        "selected_assets": [],
        "retry_count": 0,
        "max_retries": 1,
        "evaluation": {},
        "generated": None,
        "answer": "",
        "error": None,
        "steps": [],
    }

    try:
        final = await agent_graph.ainvoke(state, config={"recursion_limit": 20})
        result = {
            "answer": final.get("answer", ""),
            "assets": final.get("selected_assets", []),
            "copy": final.get("generated"),
            "intent": final.get("intent", "search"),
            "retry_count": final.get("retry_count", 0),
        }
        async with SessionLocal() as session:
            task = await session.get(AgentTask, task_id)
            if task is None:
                return
            task.status = "succeeded"
            task.intent = final.get("intent", "search")
            task.result = result
            task.error = None
            task.finished_at = utcnow()
            await session.commit()
        await event_bus.publish(task_id, {"type": "done", "result": result})
        logger.info("agent task succeeded id=%s", task_id)
    except Exception as exc:  # noqa: BLE001 - task boundary
        logger.exception("agent task failed id=%s", task_id)
        async with SessionLocal() as session:
            task = await session.get(AgentTask, task_id)
            if task is not None:
                task.status = "failed"
                task.error = str(exc)[:1000]
                task.finished_at = utcnow()
                await session.commit()
        await event_bus.publish(
            task_id,
            {"type": "error", "message": str(exc)[:500]},
        )


async def reset_task(task_id: str) -> AgentTask | None:
    async with SessionLocal() as session:
        task = await session.scalar(
            select(AgentTask).where(AgentTask.id == task_id)
        )
        if task is None:
            return None
        task.status = "queued"
        task.result = None
        task.error = None
        task.finished_at = None
        from sqlalchemy import delete

        from app.db.models import AgentTaskStep

        await session.execute(delete(AgentTaskStep).where(AgentTaskStep.task_id == task_id))
        await session.commit()
        return task
