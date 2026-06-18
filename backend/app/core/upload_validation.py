"""Shared upload validation for import endpoints."""

import os
import re
from pathlib import Path

from fastapi import HTTPException, UploadFile

from app.core.config import settings


def sanitize_filename(filename: str | None) -> str:
    base_name = Path(filename or "upload").name
    sanitized = re.sub(r"[^A-Za-z0-9._-]", "_", base_name)
    return sanitized or "upload"


async def validate_import_upload(
    file: UploadFile,
    *,
    allowed_extensions: set[str],
    allowed_content_types: set[str],
    label: str,
) -> str:
    sanitized_name = sanitize_filename(file.filename)
    extension = os.path.splitext(sanitized_name)[1].lower()
    content_type = (file.content_type or "").lower()

    if extension not in allowed_extensions:
        raise HTTPException(
            status_code=400,
            detail=f"{label} must use one of: {', '.join(sorted(allowed_extensions))}",
        )
    if content_type not in allowed_content_types:
        raise HTTPException(
            status_code=400,
            detail=f"{label} content-type must be one of: {', '.join(sorted(allowed_content_types))}",
        )

    current_position = file.file.tell()
    file.file.seek(0, 2)
    size_bytes = file.file.tell()
    file.file.seek(current_position)
    if size_bytes > settings.UPLOAD_MAX_SIZE_MB * 1024 * 1024:
        raise HTTPException(
            status_code=400,
            detail=f"{label} exceeds the {settings.UPLOAD_MAX_SIZE_MB} MB upload limit",
        )

    return sanitized_name
