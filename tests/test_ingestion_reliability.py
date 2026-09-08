"""Reliability tests for the ingestion pipeline failure normalization.

Every stage (parsing, chunking, embedding, indexing) must translate its
failures into a `ValueError` with a stage-prefixed message so the gRPC layer
can map it to INVALID_ARGUMENT (or UNAVAILABLE via ConnectionError) rather
than leaking a raw 500.
"""

from __future__ import annotations

from unittest.mock import MagicMock

import pytest

from intelligence.ingestion.pipeline import IngestionPipeline  # noqa: E402


class _MockEmbedder:
    def embed_batch(self, chunks):
        return [[0.1] * 8 for _ in chunks]


def _pipeline(store, chunker=None, embedder=None):
    return IngestionPipeline(
        embedder=embedder or _MockEmbedder(),
        chunker=chunker or MagicMock(chunk=lambda text, strat: ["chunk1"]),
        store=store,
    )


class TestStageFailureNormalization:
    def test_unsupported_mime_raises_stage_prefixed(self) -> None:
        store = MagicMock()
        pipeline = _pipeline(store)

        with pytest.raises(ValueError, match="Document Loading failed"):
            pipeline.compute(b"data", "ns", 0, "application/octet-stream", "f.bin")

    def test_embedding_failure_normalized(self) -> None:
        store = MagicMock()

        class _FailingEmbedder:
            def embed_batch(self, chunks):
                raise ConnectionError("embedding backend down")

        pipeline = _pipeline(store, embedder=_FailingEmbedder())

        with pytest.raises(ValueError, match="Document embedding generation failed"):
            pipeline.compute(b"some text", "ns", 0, "text/plain", "f.txt")

    def test_indexing_connection_failure_normalized(self) -> None:
        store = MagicMock()
        store.upsert.side_effect = ConnectionError("chroma down")
        pipeline = _pipeline(store)

        with pytest.raises(ValueError, match="Vector store indexing failed"):
            pipeline.compute(b"some text", "ns", 0, "text/plain", "f.txt")

    def test_indexing_value_error_normalized(self) -> None:
        store = MagicMock()
        store.upsert.side_effect = ValueError("bad collection")
        pipeline = _pipeline(store)

        with pytest.raises(ValueError, match="Vector store indexing failed"):
            pipeline.compute(b"some text", "ns", 0, "text/plain", "f.txt")

    def test_empty_content_short_circuits_before_embedding(self) -> None:
        store = MagicMock()

        class _EmptyFriendlyChunker:
            def chunk(self, text, strat):
                return [] if not text or not text.strip() else ["chunk1"]

        pipeline = _pipeline(store, chunker=_EmptyFriendlyChunker())

        result = pipeline.compute(b"", "ns", 0, "text/plain", "f.txt")

        assert result == 0
        store.upsert.assert_not_called()

    def test_success_upserts_and_reports_chunk_count(self) -> None:
        store = MagicMock()
        chunker = MagicMock(chunk=lambda text, strat: ["a", "b", "c"])
        pipeline = _pipeline(store, chunker=chunker)

        result = pipeline.compute(b"abc", "ns", 0, "text/plain", "f.txt")

        assert result == 3
        store.upsert.assert_called_once()
