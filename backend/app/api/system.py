from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.db.session import db_is_healthy, get_session
from app.schemas.asset import HealthResponse, PublicConfig, StatsResponse
from app.services.stats_service import get_stats
from app.services.storage import get_storage

router = APIRouter(tags=["system"])
settings = get_settings()


@router.get("/health", response_model=HealthResponse)
async def health() -> HealthResponse:
    database_ok = await db_is_healthy()
    storage_ok = get_storage().ensure_ready()
    model_ok = bool(settings.glm_api_key and settings.glm_model)
    status = "ok" if database_ok and storage_ok else "degraded"
    return HealthResponse(
        status=status,
        database=database_ok,
        storage=storage_ok,
        model_configured=model_ok,
        version=settings.version,
    )


@router.get("/stats", response_model=StatsResponse)
async def stats(session: AsyncSession = Depends(get_session)) -> StatsResponse:
    return await get_stats(session)


@router.get("/config/public", response_model=PublicConfig)
async def public_config() -> PublicConfig:
    return PublicConfig(
        app_name=settings.app_name,
        version=settings.version,
        max_upload_mb=settings.max_upload_mb,
        max_files_per_request=settings.max_files_per_request,
        allowed_extensions=sorted(settings.allowed_extension_set),
        text_model=settings.glm_model,
        vision_model=settings.glm_vision_model or "同账号 GLM-4V 系列",
        embedding_model=settings.embedding_model,
        embedding_dim=settings.embedding_dim,
        search_mode="keyword",
    )
