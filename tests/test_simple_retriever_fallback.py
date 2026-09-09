"""Tests for the SimpleRetriever degraded-mode BM25 fallback."""

from __future__ import annotations

from unittest.mock import MagicMock

import pytest

from intelligence.retrieval.simple_retriever import SimpleRetriever  # noqa: E402


class _FakeEmbedder:
    def embed(self, query: str):
        return [0.1] * 384


def _fake_store(chunks=None, raise_on_query=False, raise_on_get_all=False):
    store = MagicMock()
    if raise_on_query:
        store.query.side_effect = ConnectionError("chroma unreachable")
    else:
        store.query.return_value = {"documents": [chunks or []]}
    if raise_on_get_all:
        store.get_all_chunks.side_effect = ConnectionError("chroma unreachable")
    else:
        store.get_all_chunks.return_value = chunks or []
    return store


class TestDegradedModeFallback:
    def test_marks_degraded_when_query_fails(self) -> None:
        store = _fake_store(raise_on_query=True, raise_on_get_all=True)
        retriever = SimpleRetriever(store=store, embedder=_FakeEmbedder())

        result = retriever.retrieve_top_k("ns", top_k=5, query="hello world")

        assert retriever.degraded_mode is True
        assert result == []

    def test_bm25_fallback_returns_chunks_when_get_all_works(self) -> None:
        chunks = [
            "the quick brown fox jumps over the lazy dog",
            "hello world this is a longer test chunk of text",
        ]
        store = _fake_store(raise_on_query=True, raise_on_get_all=False)
        store.get_all_chunks.return_value = chunks
        retriever = SimpleRetriever(store=store, embedder=_FakeEmbedder())

        result = retriever.retrieve_top_k("ns", top_k=5, query="hello world test")

        assert retriever.degraded_mode is True
        assert len(result) > 0
        assert any("hello world" in chunk for chunk in result)

    def test_dense_only_when_get_all_chunks_fails(self) -> None:
        chunks = ["a fairly long chunk of text about kairos retrieval systems"]
        store = _fake_store(raise_on_query=False, raise_on_get_all=True)
        store.query.return_value = {"documents": [chunks]}
        retriever = SimpleRetriever(store=store, embedder=_FakeEmbedder())

        result = retriever.retrieve_top_k("ns", top_k=5, query="hello")

        assert retriever.degraded_mode is True
        assert result == chunks

    def test_not_degraded_on_normal_hybrid_path(self) -> None:
        chunks = ["a fairly long chunk of text about kairos retrieval systems"]
        store = _fake_store(raise_on_query=False, raise_on_get_all=False)
        store.query.return_value = {"documents": [chunks]}
        store.get_all_chunks.return_value = chunks
        retriever = SimpleRetriever(store=store, embedder=_FakeEmbedder())

        result = retriever.retrieve_top_k("ns", top_k=5, query="hello")

        assert retriever.degraded_mode is False
        assert result == chunks

    def test_chromadb_value_error_is_normalised_to_connection_error(self) -> None:
        """chromadb 1.5.x raises bare ValueError on connect failure; ChromaStore
        must re-raise as ConnectionError so the BM25 fallback can trigger."""
        from intelligence.vectorstore.chroma_store import ChromaStore

        class _ConnectErrorClient:
            def get_collection(self, **kwargs):
                raise ValueError(
                    "Could not connect to a Chroma server. Are you sure it is running?"
                )

        store = ChromaStore.__new__(ChromaStore)
        store.HOST = "localhost"
        store.PORT = 19999
        store.client = _ConnectErrorClient()

        with pytest.raises(ConnectionError):
            store.query("ns", 5, [0.1] * 384)

    def test_real_chromadb_unreachable_triggers_bm25_fallback(self) -> None:
        """End-to-end: ChromaStore raising ConnectionError (as it does when
        chromadb 1.5.x reports a connect failure) must degrade to BM25 instead
        of crashing the retriever."""
        from intelligence.vectorstore.chroma_store import ChromaStore

        store = ChromaStore.__new__(ChromaStore)
        store.HOST = "127.0.0.1"
        store.PORT = 19999

        class _UnreachableClient:
            def get_collection(self, **kwargs):
                raise ValueError(
                    "Could not connect to a Chroma server. Are you sure it is running?"
                )

            def get(self, **kwargs):
                raise ValueError(
                    "Could not connect to a Chroma server. Are you sure it is running?"
                )

        store.client = _UnreachableClient()

        retriever = SimpleRetriever(store=store, embedder=_FakeEmbedder())
        result = retriever.retrieve_top_k("ns", top_k=5, query="kairos retrieval")

        assert retriever.degraded_mode is True
        assert result == []
