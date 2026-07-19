"""Stress tests, concurrency tests, and parser regression tests for production readiness."""

from __future__ import annotations

import os
import sys
from concurrent.futures import ThreadPoolExecutor, as_completed

import pytest

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if ROOT not in sys.path:
    sys.path.insert(0, ROOT)


class TestBM25Stress:
    """Stress tests for the BM25 inverted index."""

    def test_concurrent_add_and_query(self):
        from intelligence.retrieval.persistent_bm25 import PersistentBM25Index

        idx = PersistentBM25Index()
        errors = []

        def add_docs(start, end):
            try:
                docs = [
                    (f"doc_{i}", f"document number {i} about topic {i % 10}")
                    for i in range(start, end)
                ]
                idx.add_documents(docs)
            except Exception as e:
                errors.append(str(e))

        def query_docs():
            try:
                for _ in range(50):
                    idx.query("document topic", top_k=5)
            except Exception as e:
                errors.append(str(e))

        with ThreadPoolExecutor(max_workers=10) as executor:
            futures = []
            for i in range(10):
                futures.append(executor.submit(add_docs, i * 100, (i + 1) * 100))
            for _ in range(5):
                futures.append(executor.submit(query_docs))

            for f in as_completed(futures):
                f.result()

        assert not errors, f"Errors during concurrent access: {errors}"
        assert idx.num_documents == 1000

    def test_concurrent_remove_and_query(self):
        from intelligence.retrieval.persistent_bm25 import PersistentBM25Index

        idx = PersistentBM25Index()
        errors = []

        for i in range(500):
            idx.add_document(f"doc_{i}", f"content about item {i}")

        def remove_docs(start, end):
            try:
                for i in range(start, end):
                    idx.remove_document(f"doc_{i}")
            except Exception as e:
                errors.append(str(e))

        def query_docs():
            try:
                for _ in range(50):
                    idx.query("content item", top_k=10)
            except Exception as e:
                errors.append(str(e))

        with ThreadPoolExecutor(max_workers=10) as executor:
            futures = []
            for i in range(5):
                futures.append(executor.submit(remove_docs, i * 20, (i + 1) * 20))
            for _ in range(5):
                futures.append(executor.submit(query_docs))

            for f in as_completed(futures):
                f.result()

        assert not errors, f"Errors during concurrent remove/query: {errors}"


class TestRetrievalCacheStress:
    """Stress tests for the retrieval cache."""

    def test_concurrent_cache_access(self):
        from intelligence.cache.retrieval_cache import RetrievalCache

        cache = RetrievalCache(maxsize=100, ttl_seconds=300)
        errors = []
        hit_count = [0]
        miss_count = [0]

        def cache_worker(worker_id):
            try:
                for i in range(100):
                    ns = f"ns_{worker_id}"
                    query = f"query_{i}"
                    result = cache.get(ns, query, 5, 1, False, False)
                    if result is not None:
                        hit_count[0] += 1
                    else:
                        miss_count[0] += 1
                        cache.put(ns, query, 5, 1, False, False, [f"chunk_{i}"])
            except Exception as e:
                errors.append(str(e))

        with ThreadPoolExecutor(max_workers=20) as executor:
            futures = [executor.submit(cache_worker, i) for i in range(20)]
            for f in as_completed(futures):
                f.result()

        assert not errors, f"Errors during concurrent cache access: {errors}"
        stats = cache.stats()
        assert stats["total"] > 0

    def test_cache_memory_pressure(self):
        from intelligence.cache.retrieval_cache import RetrievalCache

        cache = RetrievalCache(maxsize=10, ttl_seconds=300)
        for i in range(1000):
            cache.put("ns", f"query_{i}", 5, 1, False, False, [f"chunk_{i}"])
        assert cache.stats()["size"] <= 10


class TestConcurrencySafety:
    """Tests for thread safety across components."""

    def test_embedder_thread_safety(self):
        from intelligence.cache.embedding_cache import EmbeddingCache

        cache = EmbeddingCache(maxsize=100, ttl_seconds=300)
        errors = []

        def cache_worker():
            try:
                for i in range(200):
                    text = f"embedding_text_{i % 50}"
                    cached = cache.get(text)
                    if cached is None:
                        cache.set(text, [float(i)] * 384)
            except Exception as e:
                errors.append(str(e))

        with ThreadPoolExecutor(max_workers=15) as executor:
            futures = [executor.submit(cache_worker) for _ in range(15)]
            for f in as_completed(futures):
                f.result()

        assert not errors


class TestParserRegression:
    """Regression tests for document parsers."""

    def test_pdf_parser_edge_cases(self):
        from intelligence.ingestion.document_loader import load_document

        with pytest.raises(ValueError):
            load_document(b"not a pdf", "application/pdf")

    def test_text_encoding_edge_cases(self):
        from intelligence.ingestion.document_loader import load_document

        content = "Hello " * 1000
        result = load_document(content.encode("utf-8"), "text/plain")
        assert len(result) > 0

    def test_empty_text_handling(self):
        from intelligence.ingestion.document_loader import load_document

        result = load_document(b"", "text/plain")
        assert result == ""


class TestMemoryPressure:
    """Tests for memory behavior under pressure."""

    def test_large_embedding_cache(self):
        from intelligence.cache.embedding_cache import EmbeddingCache

        cache = EmbeddingCache(maxsize=10000, ttl_seconds=300)
        for i in range(10000):
            cache.set(f"text_{i}", [float(j) for j in range(384)])
        stats = cache.stats
        assert stats.size <= 10000

    def test_bm25_large_corpus(self):
        from intelligence.retrieval.persistent_bm25 import PersistentBM25Index

        idx = PersistentBM25Index()
        docs = [(f"doc_{i}", f"This is document {i} " * 50) for i in range(2000)]
        idx.add_documents(docs)
        assert idx.num_documents == 2000
        results = idx.query("document", top_k=10)
        assert len(results) == 10


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
