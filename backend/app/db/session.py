from collections.abc import AsyncIterator
from datetime import UTC, datetime, timedelta
from pathlib import Path

from sqlalchemy import event, select, update
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.core.config import get_settings
from app.db.models import Asset, Base

settings = get_settings()

engine = create_async_engine(
    settings.database_url,
    echo=False,
    future=True,
)

SessionLocal = async_sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autoflush=False,
)


@event.listens_for(engine.sync_engine, "connect")
def _sqlite_pragmas(dbapi_connection, _connection_record) -> None:
    if settings.database_url.startswith("sqlite"):
        cursor = dbapi_connection.cursor()
        cursor.execute("PRAGMA foreign_keys=ON")
        cursor.execute("PRAGMA journal_mode=WAL")
        cursor.close()


async def get_session() -> AsyncIterator[AsyncSession]:
    async with SessionLocal() as session:
        yield session


async def init_db() -> None:
    if settings.database_url.startswith("sqlite"):
        db_path = settings.database_url.split("///")[-1]
        if db_path and db_path != ":memory:":
            Path(db_path).parent.mkdir(parents=True, exist_ok=True)

    settings.storage_dir.mkdir(parents=True, exist_ok=True)
    (settings.storage_dir / "assets").mkdir(parents=True, exist_ok=True)
    (settings.storage_dir / "thumbnails").mkdir(parents=True, exist_ok=True)

    async with engine.begin() as connection:
        await connection.run_sync(Base.metadata.create_all)

    if settings.database_url.startswith("sqlite"):
        from app.services.vector_store import get_vector_store

        get_vector_store()


async def recover_stale_processing() -> int:
    """Mark assets left processing by a previous process as failed.

    M1 uses in-process BackgroundTasks, so a process restart cannot resume a task.
    The user can retry from the UI; a durable queue can replace this later.
    """

    cutoff = datetime.now(UTC) - timedelta(minutes=settings.processing_timeout_minutes)
    async with SessionLocal() as session:
        result = await session.execute(
            update(Asset)
            .where(Asset.status == "processing", Asset.updated_at < cutoff)
            .values(
                status="failed",
                error_message="服务重启或处理超时，请重新解析。",
            )
        )
        await session.commit()
        return result.rowcount or 0


async def db_is_healthy() -> bool:
    try:
        async with SessionLocal() as session:
            await session.execute(select(1))
        return True
    except Exception:
        return False
