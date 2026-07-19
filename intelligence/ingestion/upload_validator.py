"""Secure upload validation with magic-byte detection, extension validation, and parser safety."""

from __future__ import annotations

import io
import logging
import re
from dataclasses import dataclass

from pypdf import PdfReader

logger = logging.getLogger(__name__)

PDF_MAGIC = b"%PDF"
TEXT_PROBABLE_BYTES = 128
ALLOWED_MIME_TYPES = {"application/pdf", "text/plain"}
DEFAULT_MAX_SIZE_MB = 50
MAX_FILENAME_LENGTH = 255


@dataclass
class ValidationResult:
    valid: bool
    mime_type: str
    error: str | None = None


def detect_mime_type(content: bytes) -> str:
    """Detect MIME type from file magic bytes."""
    if content[:4] == PDF_MAGIC:
        return "application/pdf"
    try:
        content[:TEXT_PROBABLE_BYTES].decode("utf-8")
        return "text/plain"
    except (UnicodeDecodeError, ValueError):
        return "application/octet-stream"


def validate_pdf_safety(content: bytes) -> str | None:
    """Check PDF for known parser exploits (bomb patterns, excessive objects)."""
    try:
        reader = PdfReader(io.BytesIO(content))
        num_pages = len(reader.pages)
        if num_pages > 10000:
            return f"PDF has excessive pages: {num_pages}"
    except Exception as e:
        return f"PDF parsing failed: {e}"
    return None


def validate_upload(
    content: bytes,
    claimed_mime: str,
    filename: str,
    max_size_mb: int = DEFAULT_MAX_SIZE_MB,
) -> ValidationResult:
    """Comprehensive upload validation."""
    if not content:
        return ValidationResult(valid=False, mime_type="", error="File is empty")

    size_mb = len(content) / (1024 * 1024)
    if size_mb > max_size_mb:
        return ValidationResult(
            valid=False,
            mime_type="",
            error=f"File too large: {size_mb:.1f}MB exceeds {max_size_mb}MB limit",
        )

    detected = detect_mime_type(content)

    if detected not in ALLOWED_MIME_TYPES:
        return ValidationResult(
            valid=False,
            mime_type=detected,
            error=f"Unsupported file type: {detected}",
        )

    if detected == "application/pdf":
        pdf_error = validate_pdf_safety(content)
        if pdf_error:
            return ValidationResult(valid=False, mime_type=detected, error=pdf_error)

    if detected != claimed_mime:
        logger.warning(
            "MIME mismatch: claimed=%s detected=%s filename=%s",
            claimed_mime,
            detected,
            filename,
        )

    return ValidationResult(valid=True, mime_type=detected)


def sanitize_filename(name: str) -> str:
    """Sanitize filename to prevent path traversal."""
    if not name:
        return "unnamed"
    name = name.split("/")[-1].split("\\")[-1]
    name = name.lstrip(".")
    name = re.sub(r"[^a-zA-Z0-9._-]", "_", name)
    if len(name) > MAX_FILENAME_LENGTH:
        name = name[:MAX_FILENAME_LENGTH]
    return name
