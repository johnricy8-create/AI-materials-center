from __future__ import annotations

import mimetypes
import zipfile
from dataclasses import dataclass
from io import BytesIO
from pathlib import Path
from typing import Literal

from PIL import Image, UnidentifiedImageError

from app.core.config import Settings

AssetType = Literal["image", "pdf", "docx", "txt", "md"]

EXTENSION_TYPES: dict[str, AssetType] = {
    "jpg": "image",
    "jpeg": "image",
    "png": "image",
    "webp": "image",
    "pdf": "pdf",
    "docx": "docx",
    "txt": "txt",
    "md": "md",
}

DEFAULT_MIME_TYPES = {
    "image": "image/jpeg",
    "pdf": "application/pdf",
    "docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "txt": "text/plain",
    "md": "text/markdown",
}


class FileValidationError(ValueError):
    pass


@dataclass(frozen=True)
class FileInfo:
    original_name: str
    safe_name: str
    extension: str
    file_type: AssetType
    mime_type: str
    size: int


def safe_filename(name: str) -> str:
    base = Path(name or "asset").name
    cleaned = "".join(char for char in base if char.isprintable() and char not in '\\/:*?"<>|')
    cleaned = cleaned.strip(" .")
    return cleaned[:255] or "asset"


def extension_of(name: str) -> str:
    return Path(name).suffix.lower().lstrip(".")


def detect_file_type(name: str) -> AssetType | None:
    return EXTENSION_TYPES.get(extension_of(name))


def validate_file(
    filename: str,
    content_type: str | None,
    data: bytes,
    settings: Settings,
) -> FileInfo:
    safe_name = safe_filename(filename)
    extension = extension_of(safe_name)
    file_type = EXTENSION_TYPES.get(extension)

    if not file_type or extension not in settings.allowed_extension_set:
        raise FileValidationError(f"不支持的文件类型：{extension or '无扩展名'}")
    if not data:
        raise FileValidationError("文件为空")
    if len(data) > settings.max_upload_bytes:
        raise FileValidationError(f"文件超过 {settings.max_upload_mb} MB 限制")

    if file_type == "image":
        if len(data) > 40 * 1024 * 1024:
            raise FileValidationError("图片文件过大")
        try:
            with Image.open(BytesIO(data)) as image:
                image.verify()
        except (UnidentifiedImageError, OSError) as exc:
            raise FileValidationError("图片文件无法识别或已损坏") from exc
    elif file_type == "pdf":
        if not data.startswith(b"%PDF"):
            raise FileValidationError("PDF 文件头无效")
    elif file_type == "docx":
        try:
            with zipfile.ZipFile(BytesIO(data)) as archive:
                if "word/document.xml" not in archive.namelist():
                    raise FileValidationError("DOCX 缺少 document.xml")
        except zipfile.BadZipFile as exc:
            raise FileValidationError("DOCX 文件已损坏") from exc

    mime_type = (
        (content_type or "").split(";")[0].strip()
        or mimetypes.guess_type(safe_name)[0]
        or DEFAULT_MIME_TYPES[file_type]
    )
    if file_type == "md":
        mime_type = "text/markdown"
    if not mime_type.startswith("image/") and file_type == "image":
        mime_type = DEFAULT_MIME_TYPES["image"]
    if file_type == "image" and mime_type not in {"image/jpeg", "image/png", "image/webp"}:
        mime_type = mimetypes.guess_type(safe_name)[0] or "image/jpeg"

    return FileInfo(
        original_name=safe_name,
        safe_name=Path(safe_name).stem[:200] or "asset",
        extension=extension,
        file_type=file_type,
        mime_type=mime_type,
        size=len(data),
    )
