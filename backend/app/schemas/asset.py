from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field


class AssetChunkRead(BaseModel):
    id: str
    chunk_index: int
    content: str
    token_count: int
    meta: dict = Field(default_factory=dict)


class AssetRead(BaseModel):
    id: str
    name: str
    original_name: str
    file_type: str
    mime_type: str
    file_size: int
    checksum: str
    status: str
    error_message: str | None = None
    category: str | None = None
    tags: list[str] = Field(default_factory=list)
    summary: str | None = None
    description: str | None = None
    keywords: list[str] = Field(default_factory=list)
    width: int | None = None
    height: int | None = None
    page_count: int | None = None
    char_count: int | None = None
    ai_model: str | None = None
    thumbnail_url: str | None = None
    file_url: str
    created_at: datetime
    updated_at: datetime


class AssetDetail(AssetRead):
    chunks: list[AssetChunkRead] = Field(default_factory=list)
    analysis_version: str | None = None


class AssetListResponse(BaseModel):
    items: list[AssetRead]
    total: int
    page: int
    page_size: int


class AssetUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=255)
    category: str | None = Field(default=None, max_length=64)
    tags: list[str] | None = None


class UploadItem(BaseModel):
    asset: AssetRead
    duplicate: bool = False


class UploadError(BaseModel):
    filename: str
    message: str


class UploadResponse(BaseModel):
    items: list[UploadItem]
    errors: list[UploadError] = Field(default_factory=list)


class SearchFilters(BaseModel):
    file_types: list[str] = Field(default_factory=list)
    category: str | None = None
    tags: list[str] = Field(default_factory=list)


class SearchRequest(BaseModel):
    query: str = Field(min_length=1, max_length=500)
    filters: SearchFilters = Field(default_factory=SearchFilters)
    top_k: int = Field(default=8, ge=1, le=30)
    mode: Literal["keyword", "hybrid"] = "keyword"


class SearchHit(BaseModel):
    asset: AssetRead
    score: float
    match_reason: str
    snippet: str


class SearchResponse(BaseModel):
    query: str
    interpreted: dict
    items: list[SearchHit]
    total_candidates: int
    took_ms: int
    mode: str


class FacetCount(BaseModel):
    value: str
    count: int


class FacetsResponse(BaseModel):
    file_types: list[FacetCount]
    categories: list[FacetCount]
    tags: list[FacetCount]
    statuses: list[FacetCount]


class StatsResponse(BaseModel):
    total: int
    ready: int
    processing: int
    failed: int
    storage_bytes: int
    categories: list[FacetCount]
    top_tags: list[FacetCount]
    last_updated: datetime | None = None


class HealthResponse(BaseModel):
    status: str
    database: bool
    storage: bool
    model_configured: bool
    version: str


class PublicConfig(BaseModel):
    app_name: str
    version: str
    max_upload_mb: int
    max_files_per_request: int
    allowed_extensions: list[str]
    text_model: str
    vision_model: str
    embedding_model: str
    embedding_dim: int
    search_mode: str
