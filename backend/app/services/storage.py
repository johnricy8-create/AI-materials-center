from __future__ import annotations

from datetime import datetime
from functools import lru_cache
from pathlib import Path
from uuid import uuid4

from app.core.config import get_settings


class StorageService:
    def __init__(self, root: Path) -> None:
        self.root = root.resolve()
        self.root.mkdir(parents=True, exist_ok=True)

    def ensure_ready(self) -> bool:
        try:
            self.root.mkdir(parents=True, exist_ok=True)
            probe = self.root / ".write_probe"
            probe.write_text("ok", encoding="utf-8")
            probe.unlink(missing_ok=True)
            return True
        except OSError:
            return False

    def _relative(self, folder: str, suffix: str) -> str:
        now = datetime.now()
        return f"{folder}/{now:%Y}/{now:%m}/{uuid4().hex}{suffix}"

    def new_asset_path(self, suffix: str) -> str:
        return self._relative("assets", suffix)

    def new_thumbnail_path(self) -> str:
        return self._relative("thumbnails", ".jpg")

    def absolute(self, relative_path: str) -> Path:
        candidate = (self.root / relative_path).resolve()
        if not candidate.is_relative_to(self.root):
            raise ValueError("非法存储路径")
        return candidate

    def write_bytes(self, relative_path: str, data: bytes) -> Path:
        target = self.absolute(relative_path)
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_bytes(data)
        return target

    def delete(self, relative_path: str | None) -> None:
        if not relative_path:
            return
        try:
            self.absolute(relative_path).unlink(missing_ok=True)
        except (OSError, ValueError):
            return

    def total_size(self) -> int:
        total = 0
        for path in self.root.rglob("*"):
            if path.is_file():
                total += path.stat().st_size
        return total


@lru_cache
def get_storage() -> StorageService:
    return StorageService(get_settings().storage_dir)
