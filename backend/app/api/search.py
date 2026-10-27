from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_session
from app.schemas.asset import FacetsResponse, SearchRequest, SearchResponse
from app.services.retrieval_service import get_facets, search_assets

router = APIRouter(tags=["search"])


@router.post("/search", response_model=SearchResponse)
async def search(
    payload: SearchRequest,
    session: AsyncSession = Depends(get_session),
) -> SearchResponse:
    return await search_assets(session, payload)


@router.get("/facets", response_model=FacetsResponse)
async def facets(
    session: AsyncSession = Depends(get_session),
) -> FacetsResponse:
    return await get_facets(session)
