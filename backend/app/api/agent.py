from __future__ import annotations

import asyncio
import json
from typing import Any

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.agents.events import event_bus
from app.agents.runner import reset_task, run_agent_task
from app.db.models import AgentTask
from app.db.session import SessionLocal, get_session
from app.schemas.agent import (
    AgentStepRead,
    AgentTaskCreate,
    AgentTaskListResponse,
    AgentTaskRead,
)

router = APIRouter(prefix="/agent/tasks", tags=["agent"])


def task_to_read(task: AgentTask) -> AgentTaskRead:
    return AgentTaskRead(
        id=task.id,
        user_query=task.user_query,
        intent=task.intent,
        status=task.status,
        result=task.result,
        error=task.error,
        model_usage=task.model_usage or {},
        created_at=task.created_at,
        finished_at=task.finished_at,
        steps=[
            AgentStepRead(
                id=step.id,
                step_index=step.step_index,
                node_name=step.node_name,
                input=step.input,
                output=step.output,
                duration_ms=step.duration_ms,
                status=step.status,
                error=step.error,
                created_at=step.created_at,
            )
            for step in (task.steps or [])
        ],
    )


def sse(event: dict[str, Any]) -> str:
    payload = json.dumps(event, ensure_ascii=False)
    return f"event: {event.get('type', 'message')}\ndata: {payload}\n\n"


@router.post("", response_model=AgentTaskRead, status_code=202)
async def create_task(
    payload: AgentTaskCreate,
    background_tasks: BackgroundTasks,
    session: AsyncSession = Depends(get_session),
) -> AgentTaskRead:
    task = AgentTask(
        user_query=payload.query.strip(),
        intent="search",
        status="queued",
    )
    session.add(task)
    await session.commit()
    await session.refresh(task)
    task = await session.scalar(
        select(AgentTask)
        .options(selectinload(AgentTask.steps))
        .where(AgentTask.id == task.id)
    )

    background_tasks.add_task(run_agent_task, task.id)
    return task_to_read(task)


@router.get("", response_model=AgentTaskListResponse)
async def list_tasks(
    status: str | None = None,
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    session: AsyncSession = Depends(get_session),
) -> AgentTaskListResponse:
    conditions = [AgentTask.status == status] if status else []
    stmt = (
        select(AgentTask)
        .options(selectinload(AgentTask.steps))
        .where(*conditions)
        .order_by(AgentTask.created_at.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
    )
    count_stmt = select(func.count(AgentTask.id)).where(*conditions)
    total = int(await session.scalar(count_stmt) or 0)
    tasks = list((await session.scalars(stmt)).unique().all())
    return AgentTaskListResponse(
        items=[task_to_read(task) for task in tasks],
        total=total,
        page=page,
        page_size=page_size,
    )


@router.get("/{task_id}", response_model=AgentTaskRead)
async def get_task(
    task_id: str,
    session: AsyncSession = Depends(get_session),
) -> AgentTaskRead:
    task = await session.scalar(
        select(AgentTask)
        .options(selectinload(AgentTask.steps))
        .where(AgentTask.id == task_id)
    )
    if task is None:
        raise HTTPException(status_code=404, detail="任务不存在")
    return task_to_read(task)


@router.get("/{task_id}/events")
async def task_events(task_id: str):
    queue = await event_bus.subscribe(task_id)

    async def generator():
        try:
            async with SessionLocal() as session:
                task = await session.scalar(
                    select(AgentTask)
                    .options(selectinload(AgentTask.steps))
                    .where(AgentTask.id == task_id)
                )
                if task is None:
                    yield sse({"type": "error", "message": "任务不存在"})
                    return
                for step in task.steps or []:
                    await queue.put(
                        {
                            "type": "node_end",
                            "node": step.node_name,
                            "step": step.step_index,
                            "duration_ms": step.duration_ms,
                            "summary": step.output or {},
                        }
                    )
                if task.status in {"succeeded", "failed"}:
                    await queue.put(
                        {
                            "type": "done" if task.status == "succeeded" else "error",
                            "result": task.result,
                            "message": task.error,
                        }
                    )

            while True:
                try:
                    event = await asyncio.wait_for(queue.get(), timeout=15)
                except TimeoutError:
                    yield ": heartbeat\n\n"
                    continue
                yield sse(event)
                if event.get("type") in {"done", "error"}:
                    break
        finally:
            await event_bus.unsubscribe(task_id, queue)

    return StreamingResponse(
        generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


@router.post("/{task_id}/retry", response_model=AgentTaskRead)
async def retry_task(
    task_id: str,
    background_tasks: BackgroundTasks,
    session: AsyncSession = Depends(get_session),
) -> AgentTaskRead:
    task = await reset_task(task_id)
    if task is None:
        raise HTTPException(status_code=404, detail="任务不存在")
    background_tasks.add_task(run_agent_task, task_id)
    refreshed = await session.scalar(
        select(AgentTask)
        .options(selectinload(AgentTask.steps))
        .where(AgentTask.id == task_id)
    )
    return task_to_read(refreshed or task)


@router.post("/{task_id}/cancel", response_model=AgentTaskRead)
async def cancel_task(
    task_id: str,
    session: AsyncSession = Depends(get_session),
) -> AgentTaskRead:
    task = await session.scalar(
        select(AgentTask)
        .options(selectinload(AgentTask.steps))
        .where(AgentTask.id == task_id)
    )
    if task is None:
        raise HTTPException(status_code=404, detail="任务不存在")
    if task.status not in {"succeeded", "failed"}:
        task.status = "canceled"
        await session.commit()
    return task_to_read(task)
