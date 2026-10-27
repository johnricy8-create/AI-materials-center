from __future__ import annotations

import logging
import math
import sqlite3
import threading
from contextlib import closing
from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path

import sqlite_vec
from sqlite_vec import serialize_float32

from app.core.config import get_settings

logger = logging.getLogger(__name__)


def _sqlite_path() -> Path:
    url = get_settings().database_url
    if not url.startswith("sqlite"):
        raise RuntimeError("sqlite-vec 仅支持 SQLite 数据库")
    raw = url.split("///", 1)[1] if "///" in url else url.split("//", 1)[-1]
    path = Path(raw)
    if not path.is_absolute():
        path = Path.cwd() / path
    return path


@dataclass
class VectorHit:
    chunk_id: str
    asset_id: str
    distance: float
    similarity: float


class VectorStore:
    """Small sqlite-vec adapter.

    Vectors are stored in a vec0 virtual table in the same SQLite file.
    The application keeps a JSON copy on asset_chunks as a graceful fallback
    and for easy debugging.
    """

    def __init__(self, dimension: int) -> None:
        self.dimension = dimension
        self.path = _sqlite_path()
        self._lock = threading.Lock()
        self.available = self._ensure_table()

    def _connect(self) -> sqlite3.Connection:
        connection = sqlite3.connect(self.path, timeout=10, check_same_thread=False)
        connection.enable_load_extension(True)
        sqlite_vec.load(connection)
        connection.enable_load_extension(False)
        return connection

    def _ensure_table(self) -> bool:
        try:
            with closing(self._connect()) as connection:
                connection.execute(
                    f"""
                    CREATE VIRTUAL TABLE IF NOT EXISTS asset_vectors USING vec0(
                        chunk_id TEXT PRIMARY KEY,
                        asset_id TEXT,
                        embedding float[{self.dimension}]
                    )
                    """
                )
                connection.commit()
            return True
        except Exception as exc:  # noqa: BLE001 - fallback to JSON vectors
            logger.warning("sqlite-vec unavailable: %s", exc)
            return False

    def upsert_many(self, rows: list[tuple[str, str, list[float]]]) -> bool:
        if not self.available or not rows:
            return False
        try:
            with self._lock, closing(self._connect()) as connection:
                connection.executemany(
                    "DELETE FROM asset_vectors WHERE chunk_id = ?",
                    [(chunk_id,) for chunk_id, _, _ in rows],
                )
                connection.executemany(
                    "INSERT INTO asset_vectors(chunk_id, asset_id, embedding) VALUES (?, ?, ?)",
                    [
                        (chunk_id, asset_id, serialize_float32(_normalize(vector)))
                        for chunk_id, asset_id, vector in rows
                    ],
                )
                connection.commit()
            return True
        except Exception as exc:  # noqa: BLE001
            logger.warning("sqlite-vec upsert failed: %s", exc)
            return False

    def delete_asset(self, asset_id: str) -> None:
        if not self.available:
            return
        try:
            with self._lock, closing(self._connect()) as connection:
                connection.execute("DELETE FROM asset_vectors WHERE asset_id = ?", (asset_id,))
                connection.commit()
        except Exception as exc:  # noqa: BLE001
            logger.warning("sqlite-vec delete failed: %s", exc)

    def search(self, vector: list[float], limit: int = 50) -> list[VectorHit]:
        if not self.available or not vector:
            return []
        try:
            with self._lock, closing(self._connect()) as connection:
                rows = connection.execute(
                    """
                    SELECT chunk_id, asset_id, distance
                    FROM asset_vectors
                    WHERE embedding MATCH ? AND k = ?
                    """,
                    (serialize_float32(_normalize(vector)), limit),
                ).fetchall()
            return [
                VectorHit(
                    chunk_id=chunk_id,
                    asset_id=asset_id,
                    distance=float(distance),
                    similarity=max(0.0, 1.0 - (float(distance) ** 2) / 2.0),
                )
                for chunk_id, asset_id, distance in rows
            ]
        except Exception as exc:  # noqa: BLE001
            logger.warning("sqlite-vec search failed: %s", exc)
            return []

    def count(self) -> int:
        if not self.available:
            return 0
        try:
            with self._lock, closing(self._connect()) as connection:
                return int(
                    connection.execute("SELECT count(*) FROM asset_vectors").fetchone()[0]
                )
        except Exception:
            return 0


def _normalize(vector: list[float]) -> list[float]:
    norm = math.sqrt(sum(value * value for value in vector))
    if not norm:
        return vector
    return [value / norm for value in vector]


@lru_cache
def get_vector_store() -> VectorStore:
    return VectorStore(get_settings().embedding_dim)

