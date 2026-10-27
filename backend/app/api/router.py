from fastapi import APIRouter

from app.api import agent, assets, search, system

api_router = APIRouter()
api_router.include_router(system.router)
api_router.include_router(assets.router)
api_router.include_router(search.router)
api_router.include_router(agent.router)
