"""Streaming document loader for large files with bounded memory and cancellation support."""

from __future__ import annotations

import io
import logging
import threading
from dataclasses import dataclass

from pypdf import PdfReader

logger = logging.getLogger(__name__)

MAX_TEXT_LENGTH = 10_000_000
STREAM_CHUNK_SIZE = 8192


@dataclass
class LoadResult:
    text: str
    page_count: int
    truncated: bool
    memory_bytes: int


class CancellationError(Exception):
    pass


class StreamingDocumentLoader:
    """Process large documents with bounded memory usage and cancellation."""

    def __init__(self, max_text_length: int = MAX_TEXT_LENGTH):
        self._max_text_length = max_text_length
        self._cancelled = False
        self._cancel_event = threading.Event()

    def cancel(self):
        self._cancelled = True
        self._cancel_event.set()

    def load_pdf(self, content: bytes) -> LoadResult:
        """Load PDF page-by-page with bounded memory."""
        self._cancelled = False
        self._cancel_event.clear()

        try:
            reader = PdfReader(io.BytesIO(content))
        except Exception as e:
            raise ValueError(f"Cannot read PDF: {e}")

        pages = len(reader.pages)
        parts: list[str] = []
        total = 0
        truncated = False

        for i in range(pages):
            if self._cancelled:
                raise CancellationError("Document loading cancelled")

            try:
                text = reader.pages[i].extract_text() or ""
            except Exception as e:
                logger.warning("Failed to extract page %d: %s", i, e)
                continue

            remaining = self._max_text_length - total
            if remaining <= 0:
                truncated = True
                logger.warning("PDF truncated at page %d/%d", i, pages)
                break

            if len(text) > remaining:
                text = text[:remaining]
                parts.append(text)
                truncated = True
                break

            parts.append(text)
            total += len(text)

        return LoadResult(
            text="".join(parts),
            page_count=pages,
            truncated=truncated,
            memory_bytes=sum(len(p) for p in parts),
        )

    def load_text(self, content: bytes) -> LoadResult:
        """Load plain text with truncation."""
        self._cancelled = False

        try:
            text = content.decode("utf-8")
        except UnicodeDecodeError:
            raise ValueError("Cannot decode text file: invalid UTF-8")

        truncated = len(text) > self._max_text_length
        if truncated:
            text = text[: self._max_text_length]

        return LoadResult(
            text=text,
            page_count=1,
            truncated=truncated,
            memory_bytes=len(text),
        )

    def load(self, content: bytes, mime_type: str) -> LoadResult:
        if mime_type == "application/pdf":
            return self.load_pdf(content)
        elif mime_type == "text/plain":
            return self.load_text(content)
        else:
            raise ValueError(f"Unsupported MIME type: {mime_type}")


def estimate_processing_memory(content_length: int) -> dict:
    """Estimate memory needed to process a file of given size."""
    est_chunks = max(1, content_length // 1000)
    est_embeddings = est_chunks * 384 * 4
    return {
        "input_bytes": content_length,
        "estimated_chunks": est_chunks,
        "estimated_embeddings_bytes": est_embeddings,
        "estimated_total_mb": round(
            (content_length + est_embeddings) / (1024 * 1024), 2
        ),
    }
