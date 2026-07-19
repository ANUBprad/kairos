"""Integration tests for the intelligence engine — ingestion, retrieval, caching, and memory."""

from __future__ import annotations

import os
import sys
import time
from unittest.mock import MagicMock

import pytest

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if ROOT not in sys.path:
    sys.path.insert(0, ROOT)


class TestDocumentLoader:
    """Test document loading with various inputs."""

    def test_load_text_document(self):
        from intelligence.ingestion.document_loader import load_document

        content = b"Hello world. This is a test document."
        result = load_document(content, "text/plain")
        assert result == "Hello world. This is a test document."

    def test_load_text_empty(self):
        from intelligence.ingestion.document_loader import load_document

        result = load_document(b"", "text/plain")
        assert result == ""

    def test_load_unsupported_type(self):
        from intelligence.ingestion.document_loader import load_document

        with pytest.raises(ValueError):
            load_document(b"test", "image/png")


class TestStreamingLoader:
    """Test streaming document loader."""

    def test_streaming_text_loader(self):
        from intelligence.ingestion.streaming_loader import StreamingDocumentLoader

        loader = StreamingDocumentLoader(max_text_length=1000)
        content = b"Hello " * 500
        result = loader.load_text(content)
        assert len(result.text) <= 1000
        assert result.truncated is True

    def test_streaming_text_no_truncation(self):
        from intelligence.ingestion.streaming_loader import StreamingDocumentLoader

        loader = StreamingDocumentLoader()
        content = b"Hello world"
        result = loader.load_text(content)
        assert result.text == "Hello world"
        assert result.truncated is False

    def test_estimated_memory(self):
        from intelligence.ingestion.streaming_loader import estimate_processing_memory

        result = estimate_processing_memory(100000)
        assert result["input_bytes"] == 100000
        assert result["estimated_chunks"] > 0
        assert result["estimated_total_mb"] > 0


class TestUploadValidator:
    """Test upload validation with magic bytes."""

    def test_validate_text_upload(self):
        from intelligence.ingestion.upload_validator import validate_upload

        result = validate_upload(
            b"Hello world", "text/plain", "test.txt", max_size_mb=10
        )
        assert result.valid is True
        assert result.mime_type == "text/plain"

    def test_validate_empty_file(self):
        from intelligence.ingestion.upload_validator import validate_upload

        result = validate_upload(b"", "text/plain", "test.txt")
        assert result.valid is False
        assert "empty" in result.error

    def test_validate_oversized_file(self):
        from intelligence.ingestion.upload_validator import validate_upload

        result = validate_upload(
            b"x" * (1024 * 1024 * 60), "text/plain", "test.txt", max_size_mb=50
        )
        assert result.valid is False
        assert "too large" in result.error

    def test_detect_pdf_magic(self):
        from intelligence.ingestion.upload_validator import detect_mime_type

        assert detect_mime_type(b"%PDF-1.4 fake") == "application/pdf"

    def test_sanitize_filename(self):
        from intelligence.ingestion.upload_validator import sanitize_filename

        assert sanitize_filename("../../../etc/passwd") == "passwd"
        assert sanitize_filename("normal_file.txt") == "normal_file.txt"
        assert sanitize_filename("") == "unnamed"


class TestEmbeddingCache:
    """Test embedding cache behavior."""

    def test_cache_set_get(self):
        from intelligence.cache.embedding_cache import EmbeddingCache

        cache = EmbeddingCache(maxsize=100, ttl_seconds=300)
        cache.set("hello", [1.0, 2.0, 3.0])
        result = cache.get("hello")
        assert result == [1.0, 2.0, 3.0]

    def test_cache_miss(self):
        from intelligence.cache.embedding_cache import EmbeddingCache

        cache = EmbeddingCache(maxsize=100, ttl_seconds=300)
        result = cache.get("nonexistent")
        assert result is None

    def test_cache_eviction(self):
        from intelligence.cache.embedding_cache import EmbeddingCache

        cache = EmbeddingCache(maxsize=2, ttl_seconds=300)
        cache.set("a", [1.0])
        cache.set("b", [2.0])
        cache.set("c", [3.0])
        assert cache.get("a") is None
        assert cache.get("b") == [2.0]
        assert cache.get("c") == [3.0]

    def test_cache_ttl_expiry(self):
        from intelligence.cache.embedding_cache import EmbeddingCache

        cache = EmbeddingCache(maxsize=100, ttl_seconds=1)
        cache.set("key", [1.0])
        time.sleep(1.1)
        result = cache.get("key")
        assert result is None

    def test_cache_hit_rate(self):
        from intelligence.cache.embedding_cache import EmbeddingCache

        cache = EmbeddingCache(maxsize=100, ttl_seconds=300)
        cache.set("key", [1.0])
        cache.get("key")
        cache.get("missing")
        assert cache.hit_rate == 0.5


class TestRetrievalCache:
    """Test LRU retrieval cache."""

    def test_retrieval_cache_put_get(self):
        from intelligence.cache.retrieval_cache import RetrievalCache

        cache = RetrievalCache(maxsize=10, ttl_seconds=300)
        cache.put("ns", "query", 5, 1, False, False, ["chunk1", "chunk2"])
        result = cache.get("ns", "query", 5, 1, False, False)
        assert result == ["chunk1", "chunk2"]

    def test_retrieval_cache_miss(self):
        from intelligence.cache.retrieval_cache import RetrievalCache

        cache = RetrievalCache(maxsize=10, ttl_seconds=300)
        result = cache.get("ns", "query", 5, 1, False, False)
        assert result is None

    def test_retrieval_cache_invalidate(self):
        from intelligence.cache.retrieval_cache import RetrievalCache

        cache = RetrievalCache(maxsize=10, ttl_seconds=300)
        cache.put("ns", "query", 5, 1, False, False, ["chunk1"])
        cache.invalidate_namespace("ns")
        result = cache.get("ns", "query", 5, 1, False, False)
        assert result is None

    def test_retrieval_cache_stats(self):
        from intelligence.cache.retrieval_cache import RetrievalCache

        cache = RetrievalCache(maxsize=10, ttl_seconds=300)
        cache.put("ns", "q", 5, 1, False, False, ["c1"])
        cache.get("ns", "q", 5, 1, False, False)
        cache.get("ns", "missing", 5, 1, False, False)
        stats = cache.stats()
        assert stats["hits"] == 1
        assert stats["misses"] == 1
        assert stats["hit_ratio"] == 0.5


class TestStructuredLogging:
    """Test structured JSON logging."""

    def test_correlation_id(self):
        from intelligence.logging.structured_logging import (
            set_correlation_id,
            correlation_id_var,
        )

        cid = set_correlation_id("test-123")
        assert cid == "test-123"
        assert correlation_id_var.get() == "test-123"

    def test_generate_correlation_id(self):
        from intelligence.logging.structured_logging import generate_correlation_id

        cid = generate_correlation_id()
        assert len(cid) == 16
        assert cid.isalnum()


class TestBM25Index:
    """Test persistent BM25 index."""

    def test_add_and_query(self):
        from intelligence.retrieval.persistent_bm25 import PersistentBM25Index

        idx = PersistentBM25Index()
        idx.add_documents(
            [
                ("doc1", "machine learning is a subset of AI"),
                ("doc2", "deep learning uses neural networks"),
                ("doc3", "natural language processing handles text"),
            ]
        )
        results = idx.query("machine learning", top_k=2)
        assert len(results) <= 2
        assert results[0][0] == "doc1"

    def test_remove_document(self):
        from intelligence.retrieval.persistent_bm25 import PersistentBM25Index

        idx = PersistentBM25Index()
        idx.add_documents([("d1", "hello world"), ("d2", "foo bar")])
        assert idx.num_documents == 2
        idx.remove_document("d1")
        assert idx.num_documents == 1

    def test_empty_index_query(self):
        from intelligence.retrieval.persistent_bm25 import PersistentBM25Index

        idx = PersistentBM25Index()
        results = idx.query("test", top_k=5)
        assert results == []


class TestChunker:
    """Test chunking strategies."""

    def test_fixed_size_chunking(self):
        from intelligence.ingestion.chunker import Chunker

        mock_embedder = MagicMock()
        chunker = Chunker(embedder=mock_embedder, chunk_size=100, overlap=10)
        text = "word " * 200
        chunks = chunker.chunk(text, 0)
        assert len(chunks) > 1

    def test_structural_chunking(self):
        from intelligence.ingestion.chunker import Chunker

        mock_embedder = MagicMock()
        chunker = Chunker(embedder=mock_embedder, chunk_size=100, overlap=10)
        text = "Page 1 content\fPage 2 content"
        chunks = chunker.chunk(text, 2)
        assert len(chunks) == 2

    def test_invalid_strategy(self):
        from intelligence.ingestion.chunker import Chunker

        mock_embedder = MagicMock()
        chunker = Chunker(embedder=mock_embedder, chunk_size=100, overlap=10)
        with pytest.raises(ValueError):
            chunker.chunk("test", 99)


class TestPipelineMetrics:
    """Test ingestion pipeline timing."""

    def test_pipeline_compute_with_mock(self):
        from intelligence.ingestion.pipeline import IngestionPipeline

        mock_embedder = MagicMock()
        mock_embedder.embed_batch.return_value = [[0.1] * 384]
        mock_store = MagicMock()
        mock_chunker = MagicMock()
        mock_chunker.chunk.return_value = ["chunk1"]

        pipeline = IngestionPipeline(mock_embedder, mock_chunker, mock_store)
        result = pipeline.compute(b"test content", "ns", 0, "text/plain", "test.txt")
        assert result == 1
        mock_store.upsert.assert_called_once()


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
