from functools import lru_cache
from pathlib import Path

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict

BACKEND_DIR = Path(__file__).resolve().parents[2]
PROJECT_ROOT = BACKEND_DIR.parent


class Settings(BaseSettings):
    app_name: str = "AI Asset Hub"
    version: str = "0.1.0"
    api_prefix: str = "/api/v1"
    environment: str = "development"
    debug: bool = True

    database_url: str = (
        f"sqlite+aiosqlite:///{(BACKEND_DIR / 'data' / 'asset_hub.db').as_posix()}"
    )
    storage_dir: Path = PROJECT_ROOT / "storage"

    max_upload_mb: int = 25
    max_files_per_request: int = 10
    allowed_extensions: str = "jpg,jpeg,png,webp,pdf,docx,txt,md"
    cors_origins: str = (
        "http://127.0.0.1:5173,http://localhost:5173,"
        "http://127.0.0.1:4173,http://localhost:4173"
    )

    # Model service: keep the key server-side only.
    glm_base_url: str = "https://open.bigmodel.cn/api/paas/v4"
    glm_api_key: str = ""
    glm_model: str = "glm-4.7-flash"
    glm_fallback_model: str = "glm-4-flash-250414"
    glm_vision_model: str = "glm-4v-flash"
    embedding_model: str = "embedding-3"
    embedding_dim: int = Field(default=1024, ge=128, le=4096)
    glm_timeout_seconds: int = 90
    glm_max_retries: int = 2
    use_mock_ai: bool = False

    processing_timeout_minutes: int = 15

    model_config = SettingsConfigDict(
        env_file=BACKEND_DIR / ".env",
        env_file_encoding="utf-8",
        extra="ignore",
        case_sensitive=False,
    )

    def model_post_init(self, __context: object) -> None:
        if not self.storage_dir.is_absolute():
            self.storage_dir = (BACKEND_DIR / self.storage_dir).resolve()

    @property
    def allowed_extension_set(self) -> set[str]:
        return {item.strip().lower() for item in self.allowed_extensions.split(",") if item.strip()}

    @property
    def cors_origin_list(self) -> list[str]:
        return [item.strip() for item in self.cors_origins.split(",") if item.strip()]

    @property
    def max_upload_bytes(self) -> int:
        return self.max_upload_mb * 1024 * 1024


@lru_cache
def get_settings() -> Settings:
    return Settings()
