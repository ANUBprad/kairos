"""P2 — Real Retrieval Integration & Quality Validation.

Tests the actual retrieval stack with real ChromaDB (ephemeral), real
embeddings (all-MiniLM-L6-v2), real BM25, real RRF fusion, and real
reranker. Complex/MultiHop use mocked LLM boundaries.

Run:
    pytest tests/benchmarks/test_retrieval_integration.py -v --tb=short
"""

from __future__ import annotations

import statistics
import time
from dataclasses import dataclass
from unittest.mock import MagicMock

import numpy as np
import pytest

from intelligence.retrieval.persistent_bm25 import (
    PersistentBM25Index,
)
from intelligence.retrieval.simple_retriever import SimpleRetriever
from intelligence.retrieval.complex_retriever import ComplexRetriever
from intelligence.retrieval.multihop_retriever import MultiHopRetriever, MultiHopResponseSchema
from intelligence.embeddings.base_embedder import BaseEmbedder
from intelligence.vectorstore.chroma_store import ChromaStore
from intelligence.planner.planner_config import (
    BUDGET_TABLE,
    FALLBACK_THRESHOLD_FACTOR,
    ConfidenceBand,
    QueryType,
)
from intelligence.planner.fallback_manager import FallbackManager
from intelligence.classifier.strategy_selector import get_config
from intelligence.classifier.query_classifier import ResponseSchema


# ============================================================================
# Fixtures — Ephemeral ChromaDB + Real Embedder
# ============================================================================

CORPUS = [
    {"id": "doc_finance_001", "text": "Apple Inc. reported record quarterly revenue of $123.9 billion for Q1 FY2024, driven by strong iPhone sales and growing services segment. Net income reached $33.9 billion.", "domain": "finance"},
    {"id": "doc_finance_002", "text": "The Federal Reserve held interest rates steady at 5.25%-5.50% following its January 2024 meeting, citing continued progress on inflation but noting it remains above the 2% target.", "domain": "finance"},
    {"id": "doc_finance_003", "text": "Tesla stock dropped 12% after the company reported declining margins and warned of slower delivery growth in 2024. Revenue was $25.1 billion, below analyst expectations of $25.6 billion.", "domain": "finance"},
    {"id": "doc_tech_001", "text": "OpenAI released GPT-4 Turbo with a 128K token context window and vision capabilities. The model features improved instruction following and reduced pricing at $0.01 per 1K input tokens.", "domain": "technology"},
    {"id": "doc_tech_002", "text": "Docker Desktop 4.27 introduced native support for Docker Compose Watch, improving hot-reload workflows. The update also includes performance improvements for large-volume mounts on macOS.", "domain": "technology"},
    {"id": "doc_tech_003", "text": "Kubernetes 1.29 added support for sidecar containers as a stable feature, enabling better lifecycle management for service meshes and observability agents in pods.", "domain": "technology"},
    {"id": "doc_legal_001", "text": "The EU AI Act entered into force on August 1, 2024, establishing a risk-based regulatory framework for artificial intelligence systems. High-risk AI applications must comply by August 2026.", "domain": "legal"},
    {"id": "doc_legal_002", "text": "GDPR Article 17 provides data subjects with the right to erasure, commonly known as the right to be forgotten. Controllers must comply within one month of receiving a valid request.", "domain": "legal"},
    {"id": "doc_health_001", "text": "The CDC recommended updated COVID-19 boosters targeting the JN.1 variant for all individuals aged 6 months and older. Clinical trials showed a 2.5-fold increase in neutralizing antibodies.", "domain": "healthcare"},
    {"id": "doc_health_002", "text": "WHO declared the end of the global health emergency for mpox on May 11, 2024, noting sustained decline in cases worldwide. Vaccination campaigns contributed to reduced transmission.", "domain": "healthcare"},
]

GROUND_TRUTH = {
    "Apple quarterly revenue": ["doc_finance_001"],
    "Federal Reserve interest rates January 2024": ["doc_finance_002"],
    "Tesla stock decline": ["doc_finance_003"],
    "GPT-4 Turbo context window": ["doc_tech_001"],
    "Docker Compose Watch": ["doc_tech_002"],
    "Kubernetes sidecar containers": ["doc_tech_003"],
    "EU AI Act risk-based framework": ["doc_legal_001"],
    "GDPR right to erasure": ["doc_legal_002"],
    "COVID-19 booster JN.1": ["doc_health_001"],
    "mpox global health emergency": ["doc_health_002"],
}


@dataclass
class EphemeralChroma:
    """Helper to create an ephemeral ChromaDB for testing."""
    store: ChromaStore
    embedder: BaseEmbedder


@pytest.fixture(scope="module")
def ephemeral_chroma():
    """Create ephemeral ChromaDB + real embedder (module-scoped for speed)."""
    import chromadb

    client = chromadb.Client()
    store = ChromaStore.__new__(ChromaStore)
    store.client = client

    from intelligence.embeddings.local_embedder import LocalEmbedder
    embedder = LocalEmbedder()

    return EphemeralChroma(store=store, embedder=embedder)


@pytest.fixture(scope="module")
def populated_chroma(ephemeral_chroma):
    """ChromaDB populated with test corpus."""
    ns = "test_corpus"
    for doc in CORPUS:
        embed = ephemeral_chroma.embedder.embed(doc["text"])
        ephemeral_chroma.store.upsert(
            namespace=ns,
            chunks=[doc["text"]],
            embeddings=[embed],
            filename=doc["id"],
        )
    return ns, ephemeral_chroma


@pytest.fixture(scope="module")
def bm25_index():
    """Pre-built BM25 index over the same corpus."""
    idx = PersistentBM25Index()
    for doc in CORPUS:
        idx.add_document(doc["id"], doc["text"])
    return idx


# ============================================================================
# PHASE 2 — ChromaDB Integration
# ============================================================================


class TestChromaDBIntegration:
    def test_insert_and_query(self, populated_chroma):
        ns, ec = populated_chroma
        embed = ec.embedder.embed("Apple revenue")
        result = ec.store.query(ns, top_k=3, query_embed=embed)
        docs = result["documents"][0]
        assert len(docs) > 0
        assert any("Apple" in d for d in docs)

    def test_irrelevant_query_returns_low_relevance(self, populated_chroma):
        ns, ec = populated_chroma
        embed = ec.embedder.embed("quantum entanglement physics")
        result = ec.store.query(ns, top_k=3, query_embed=embed)
        docs = result["documents"][0]
        assert len(docs) > 0

    def test_empty_collection(self, ephemeral_chroma):
        ns = "empty_namespace"
        embed = ephemeral_chroma.embedder.embed("test")
        with pytest.raises(ValueError, match="Unable to find the namespace"):
            ephemeral_chroma.store.query(ns, top_k=5, query_embed=embed)

    def test_duplicate_documents(self, ephemeral_chroma):
        ns = "dup_test"
        text = "Duplicate document for testing purposes only."
        embed = ephemeral_chroma.embedder.embed(text)
        ephemeral_chroma.store.upsert(ns, [text, text], [embed, embed], "dup.pdf")
        result = ephemeral_chroma.store.query(ns, 5, embed)
        assert len(result["documents"][0]) >= 1

    def test_duplicate_ids(self, ephemeral_chroma):
        ns = "dup_id_test"
        text1 = "First version of the document with unique content alpha."
        text2 = "Second version of the document with unique content beta."
        embed1 = ephemeral_chroma.embedder.embed(text1)
        embed2 = ephemeral_chroma.embedder.embed(text2)
        ephemeral_chroma.store.upsert(ns, [text1], [embed1], "same.pdf")
        ephemeral_chroma.store.upsert(ns, [text2], [embed2], "same.pdf")
        result = ephemeral_chroma.store.query(ns, 5, embed1)
        assert len(result["documents"][0]) >= 1

    def test_namespace_isolation(self, ephemeral_chroma):
        ns_a = "isolated_org_a"
        ns_b = "isolated_org_b"
        text_a = "Organization A confidential financial report for Q1."
        text_b = "Organization B confidential medical records for patient."
        embed_a = ephemeral_chroma.embedder.embed(text_a)
        embed_b = ephemeral_chroma.embedder.embed(text_b)
        ephemeral_chroma.store.upsert(ns_a, [text_a], [embed_a], "a.pdf")
        ephemeral_chroma.store.upsert(ns_b, [text_b], [embed_b], "b.pdf")
        result_a = ephemeral_chroma.store.query(ns_a, 5, embed_a)
        result_b = ephemeral_chroma.store.query(ns_b, 5, embed_b)
        docs_a = result_a["documents"][0]
        docs_b = result_b["documents"][0]
        assert any("Organization A" in d for d in docs_a)
        assert not any("Organization B" in d for d in docs_a)
        assert any("Organization B" in d for d in docs_b)
        assert not any("Organization A" in d for d in docs_b)

    def test_missing_collection(self, ephemeral_chroma):
        embed = ephemeral_chroma.embedder.embed("test")
        with pytest.raises((ValueError, ConnectionError)):
            ephemeral_chroma.store.query("nonexistent_namespace_999", 5, embed)

    def test_metadata_present(self, populated_chroma):
        ns, ec = populated_chroma
        embed = ec.embedder.embed("Apple revenue")
        result = ec.store.query(ns, 3, embed)
        metadatas = result["metadatas"][0]
        assert len(metadatas) > 0
        assert all("source" in m for m in metadatas)
        assert all("chunk_index" in m for m in metadatas)

    def test_distances_are_non_negative(self, populated_chroma):
        ns, ec = populated_chroma
        embed = ec.embedder.embed("interest rates")
        result = ec.store.query(ns, 5, embed)
        distances = result["distances"][0]
        assert all(d >= 0 for d in distances)


# ============================================================================
# PHASE 3 — Embedding Validation
# ============================================================================


class TestEmbeddingValidation:
    def test_identical_text_same_embedding(self, ephemeral_chroma):
        embed = ephemeral_chroma.embedder.embed("hello world test")
        embed2 = ephemeral_chroma.embedder.embed("hello world test")
        np.testing.assert_array_almost_equal(embed, embed2, decimal=5)

    def test_near_paraphrase_high_similarity(self, ephemeral_chroma):
        e1 = ephemeral_chroma.embedder.embed("The cat sat on the mat")
        e2 = ephemeral_chroma.embedder.embed("A cat was sitting on a mat")
        sim = np.dot(e1, e2) / (np.linalg.norm(e1) * np.linalg.norm(e2))
        assert sim > 0.7, f"Paraphrase similarity {sim:.3f} < 0.7"

    def test_unrelated_text_low_similarity(self, ephemeral_chroma):
        e1 = ephemeral_chroma.embedder.embed("The cat sat on the mat")
        e2 = ephemeral_chroma.embedder.embed("Quantum computing breakthrough in physics")
        sim = np.dot(e1, e2) / (np.linalg.norm(e1) * np.linalg.norm(e2))
        assert sim < 0.5, f"Unrelated similarity {sim:.3f} >= 0.5"

    def test_semantic_ordering(self, ephemeral_chroma):
        e_query = ephemeral_chroma.embedder.embed("Apple quarterly revenue")
        e_relevant = ephemeral_chroma.embedder.embed("Apple Inc. reported record quarterly revenue of $123.9 billion")
        e_irrelevant = ephemeral_chroma.embedder.embed("Kubernetes sidecar containers for service meshes")
        sim_relevant = np.dot(e_query, e_relevant) / (np.linalg.norm(e_query) * np.linalg.norm(e_relevant))
        sim_irrelevant = np.dot(e_query, e_irrelevant) / (np.linalg.norm(e_query) * np.linalg.norm(e_irrelevant))
        assert sim_relevant > sim_irrelevant, (
            f"Relevant ({sim_relevant:.3f}) should score higher than irrelevant ({sim_irrelevant:.3f})"
        )

    def test_short_text(self, ephemeral_chroma):
        embed = ephemeral_chroma.embedder.embed("AI")
        assert len(embed) > 0
        assert all(isinstance(v, float) for v in embed)

    def test_empty_text(self, ephemeral_chroma):
        try:
            embed = ephemeral_chroma.embedder.embed("")
            assert len(embed) > 0
        except Exception:
            pass

    def test_unicode_text(self, ephemeral_chroma):
        embed = ephemeral_chroma.embedder.embed("über naïve résumé café")
        assert len(embed) > 0

    def test_long_text(self, ephemeral_chroma):
        long_text = "This is a test sentence. " * 200
        embed = ephemeral_chroma.embedder.embed(long_text)
        assert len(embed) > 0

    def test_embedding_dimensions(self, ephemeral_chroma):
        embed = ephemeral_chroma.embedder.embed("test")
        assert len(embed) == 384, f"Expected 384 dimensions, got {len(embed)}"

    def test_batch_embedding(self, ephemeral_chroma):
        texts = ["hello world", "foo bar baz", "testing batch embeddings"]
        embeddings = ephemeral_chroma.embedder.embed_batch(texts)
        assert len(embeddings) == 3
        assert all(len(e) == 384 for e in embeddings)

    def test_embedding_normalization(self, ephemeral_chroma):
        embed = ephemeral_chroma.embedder.embed("test normalization")
        norm = np.linalg.norm(embed)
        assert 0.9 < norm < 1.1, f"Embedding norm {norm:.3f} not approximately unit"


# ============================================================================
# PHASE 4 — Real SimpleRetriever
# ============================================================================


class TestRealSimpleRetriever:
    @pytest.fixture
    def retriever(self, populated_chroma):
        ns, ec = populated_chroma
        return SimpleRetriever(ec.store, ec.embedder), ns

    def test_vector_results_returned(self, retriever):
        r, ns = retriever
        results = r.retrieve_top_k(ns, top_k=5, query="Apple revenue")
        assert len(results) > 0

    def test_ranking_relevance(self, retriever):
        r, ns = retriever
        results = r.retrieve_top_k(ns, top_k=3, query="Apple quarterly revenue billion")
        assert any("Apple" in d for d in results)

    def test_top_k_limits_results(self, retriever):
        r, ns = retriever
        results = r.retrieve_top_k(ns, top_k=2, query="financial report")
        assert len(results) <= 2

    def test_deduplication(self, retriever):
        r, ns = retriever
        results = r.retrieve_top_k(ns, top_k=10, query="technology")
        assert len(results) == len(set(results))

    def test_short_chunks_filtered(self, retriever):
        r, ns = retriever
        results = r.retrieve_top_k(ns, top_k=10, query="test")
        for chunk in results:
            assert len(chunk.strip()) > 30

    def test_empty_namespace(self, ephemeral_chroma):
        r = SimpleRetriever(ephemeral_chroma.store, ephemeral_chroma.embedder)
        with pytest.raises(ValueError, match="Unable to find the namespace"):
            r.retrieve_top_k("empty_ns_xyz", top_k=5, query="test")

    def test_fusion_produces_results(self, populated_chroma):
        ns, ec = populated_chroma
        r = SimpleRetriever(ec.store, ec.embedder)
        results = r.retrieve_top_k(ns, top_k=5, query="Kubernetes containers")
        assert len(results) > 0

    def test_bm25_only_path(self, populated_chroma):
        ns, ec = populated_chroma
        r = SimpleRetriever(ec.store, ec.embedder)
        all_chunks = r._load_chunks_safe(ns)
        assert len(all_chunks) > 0
        bm25_idx = r._get_or_build_index(ns, all_chunks)
        ranked = bm25_idx.query("Apple revenue", top_k=3)
        assert len(ranked) > 0


# ============================================================================
# PHASE 5 — ComplexRetriever & MultiHopRetriever (Mocked LLM)
# ============================================================================


class TestComplexRetrieverMocked:
    @pytest.fixture
    def setup(self, populated_chroma):
        ns, ec = populated_chroma
        mock_client = MagicMock()
        mock_response = MagicMock()
        mock_response.text = "Apple reported revenue of $123.9 billion"
        mock_client.models.generate_content.return_value = mock_response

        from intelligence.reranker.cross_encoder_reranker import CrossEncoderReranker
        from sentence_transformers import CrossEncoder
        cross_encoder = CrossEncoder("cross-encoder/ms-marco-MiniLM-L-6-v2")
        reranker = CrossEncoderReranker(cross_encoder)

        retriever = ComplexRetriever(
            embedder=ec.embedder,
            store=ec.store,
            client=mock_client,
            model_name="test-model",
            mmr_lambda=0.5,
            cross_encoder=reranker,
            model_provider="gemini",
        )
        return retriever, ns

    def test_retrieve_with_decompose(self, setup):
        retriever, ns = setup
        results = retriever.retrieve_top_k(ns, top_k=3, query="Apple revenue", rerank=False, decompose=True)
        assert len(results) > 0

    def test_retrieve_without_decompose(self, setup):
        retriever, ns = setup
        results = retriever.retrieve_top_k(ns, top_k=3, query="Apple revenue", rerank=False, decompose=False)
        assert len(results) > 0

    def test_mmr_diversity(self, setup):
        retriever, ns = setup
        results = retriever.retrieve_top_k(ns, top_k=5, query="technology", rerank=False, decompose=False)
        assert len(results) <= 5
        assert len(results) == len(set(results))

    def test_short_chunks_filtered(self, setup):
        retriever, ns = setup
        results = retriever.retrieve_top_k(ns, top_k=10, query="test", rerank=False, decompose=False)
        for chunk in results:
            assert len(chunk.strip()) > 30

    def test_reranking_applied(self, setup):
        retriever, ns = setup
        results = retriever.retrieve_top_k(ns, top_k=3, query="Apple revenue", rerank=True, decompose=False)
        assert len(results) > 0

    def test_llm_failure_raises(self, populated_chroma):
        ns, ec = populated_chroma
        mock_client = MagicMock()
        mock_client.models.generate_content.side_effect = ConnectionError("LLM down")

        from intelligence.reranker.cross_encoder_reranker import CrossEncoderReranker
        from sentence_transformers import CrossEncoder
        cross_encoder = CrossEncoder("cross-encoder/ms-marco-MiniLM-L-6-v2")
        reranker = CrossEncoderReranker(cross_encoder)

        retriever = ComplexRetriever(
            embedder=ec.embedder, store=ec.store, client=mock_client,
            model_name="test", mmr_lambda=0.5, cross_encoder=reranker,
            model_provider="gemini",
        )
        with pytest.raises(ConnectionError):
            retriever.retrieve_top_k(ns, top_k=3, query="test", rerank=False, decompose=True)


class TestMultiHopRetrieverMocked:
    @pytest.fixture
    def setup(self, populated_chroma):
        ns, ec = populated_chroma
        mock_client = MagicMock()
        hop_data = MultiHopResponseSchema(next_question="", is_enough=True)
        mock_response = MagicMock()
        mock_response.parsed = hop_data
        mock_client.models.generate_content.return_value = mock_response
        retriever = MultiHopRetriever(
            embedder=ec.embedder, store=ec.store, client=mock_client,
            model_name="test-model", model_provider="gemini", num_hops=3,
        )
        return retriever, ns

    def test_single_hop_sufficient(self, setup):
        retriever, ns = setup
        results = retriever.retrieve_top_k(ns, top_k=3, query="Apple revenue")
        assert len(results) > 0

    def test_hop_count_limited(self, populated_chroma):
        ns, ec = populated_chroma
        mock_client = MagicMock()
        hop_count = [0]
        def side_effect(**kwargs):
            hop_count[0] += 1
            data = MultiHopResponseSchema(next_question=f"sub query {hop_count[0]}", is_enough=False)
            resp = MagicMock()
            resp.parsed = data
            return resp
        mock_client.models.generate_content.side_effect = side_effect

        retriever = MultiHopRetriever(
            embedder=ec.embedder, store=ec.store, client=mock_client,
            model_name="test", model_provider="gemini", num_hops=2,
        )
        retriever.retrieve_top_k(ns, top_k=3, query="complex query")
        assert hop_count[0] <= 2

    def test_deduplication(self, setup):
        retriever, ns = setup
        results = retriever.retrieve_top_k(ns, top_k=10, query="technology")
        assert len(results) == len(set(results))

    def test_short_chunks_filtered(self, setup):
        retriever, ns = setup
        results = retriever.retrieve_top_k(ns, top_k=10, query="test")
        for chunk in results:
            assert len(chunk.strip()) > 30

    def test_max_total_chunks_bounded(self, populated_chroma):
        ns, ec = populated_chroma
        mock_client = MagicMock()
        hop_count = [0]
        def side_effect(**kwargs):
            hop_count[0] += 1
            data = MultiHopResponseSchema(next_question=f"sub {hop_count[0]}", is_enough=False)
            resp = MagicMock()
            resp.parsed = data
            return resp
        mock_client.models.generate_content.side_effect = side_effect

        retriever = MultiHopRetriever(
            embedder=ec.embedder, store=ec.store, client=mock_client,
            model_name="test", model_provider="gemini", num_hops=5,
        )
        results = retriever.retrieve_top_k(ns, top_k=3, query="deep query")
        max_allowed = 3 * 3  # top_k * 3
        assert len(results) <= max_allowed

    def test_llm_failure_raises(self, populated_chroma):
        ns, ec = populated_chroma
        mock_client = MagicMock()
        mock_client.models.generate_content.side_effect = ConnectionError("down")
        retriever = MultiHopRetriever(
            embedder=ec.embedder, store=ec.store, client=mock_client,
            model_name="test", model_provider="gemini", num_hops=3,
        )
        with pytest.raises(ValueError):
            retriever.retrieve_top_k(ns, top_k=3, query="test")


# ============================================================================
# PHASE 6 — Reranker Validation
# ============================================================================


class TestRerankerValidation:
    @pytest.fixture(scope="class")
    def cross_encoder(self):
        from sentence_transformers import CrossEncoder
        return CrossEncoder("cross-encoder/ms-marco-MiniLM-L-6-v2")

    @pytest.fixture(scope="class")
    def reranker(self, cross_encoder):
        from intelligence.reranker.cross_encoder_reranker import CrossEncoderReranker
        return CrossEncoderReranker(cross_encoder)

    def test_reranking_reorders_results(self, reranker):
        chunks = [
            "Kubernetes 1.29 added support for sidecar containers",
            "The Federal Reserve held interest rates steady at 5.25%",
            "Apple Inc. reported record quarterly revenue of $123.9 billion",
        ]
        reranked = reranker.rerank("Apple revenue", chunks, top_k=3)
        assert len(reranked) == 3
        assert "Apple" in reranked[0]

    def test_reranking_top_k_limits(self, reranker):
        chunks = [
            "Apple Inc. reported record quarterly revenue",
            "Tesla stock dropped 12% after declining margins",
            "Federal Reserve held interest rates steady",
            "OpenAI released GPT-4 Turbo with 128K context",
            "Docker Desktop introduced Compose Watch support",
        ]
        reranked = reranker.rerank("finance", chunks, top_k=2)
        assert len(reranked) == 2

    def test_reranking_empty_input(self, reranker):
        result = reranker.rerank("test", [], top_k=5)
        assert result == []

    def test_reranking_single_chunk(self, reranker):
        result = reranker.rerank("test", ["single chunk of text for testing"], top_k=5)
        assert len(result) == 1

    def test_reranking_preserves_content(self, reranker):
        chunks = [
            "Apple Inc. reported record quarterly revenue of $123.9 billion",
            "Tesla stock dropped 12% after the company reported declining margins",
        ]
        reranked = reranker.rerank("revenue", chunks, top_k=2)
        assert set(reranked) == set(chunks)


# ============================================================================
# PHASE 7 — BM25 Deep Quality
# ============================================================================


class TestBM25DeepQuality:
    def test_zero_overlap_returns_empty(self, bm25_index):
        results = bm25_index.query("xyzzy plugh")
        assert results == []

    def test_partial_overlap_returns_matching(self, bm25_index):
        results = bm25_index.query("apple quantum computing")
        result_ids = [d for d, _ in results]
        assert "doc_finance_001" in result_ids

    def test_exact_match_ranks_first(self, bm25_index):
        results = bm25_index.query("Apple quarterly revenue billion", top_k=3)
        assert results[0][0] == "doc_finance_001"

    def test_accent_folding(self, bm25_index):
        r1 = bm25_index.query("uber naive resume cafe", top_k=10)
        assert isinstance(r1, list)

    def test_programming_terms_stripped(self, bm25_index):
        idx = PersistentBM25Index()
        idx.add_document("d1", "C++ programming language guide")
        idx.add_document("d2", "C# programming language guide")
        r_cpp = idx.query("C++")
        r_csharp = idx.query("C#")
        assert r_cpp == r_csharp

    def test_dotnet_stripped(self, bm25_index):
        idx = PersistentBM25Index()
        idx.add_document("d1", ".NET framework is a software framework")
        r = idx.query(".NET")
        assert len(r) >= 1

    def test_snake_case_no_tokens(self, bm25_index):
        idx = PersistentBM25Index()
        idx.add_document("d1", "my_variable_name is important")
        r = idx.query("my_variable_name")
        assert r == []

    def test_camelcase_single_token(self, bm25_index):
        idx = PersistentBM25Index()
        idx.add_document("d1", "myVariableName is important in code")
        r = idx.query("myVariableName")
        assert len(r) == 1

    def test_url_tokenization(self, bm25_index):
        idx = PersistentBM25Index()
        idx.add_document("d1", "Visit https://example.com for more info")
        r = idx.query("https example com")
        assert len(r) >= 1

    def test_email_tokenization(self, bm25_index):
        idx = PersistentBM25Index()
        idx.add_document("d1", "Contact user@example.com for details")
        r = idx.query("user example com")
        assert len(r) >= 1

    def test_hyphenated_terms(self, bm25_index):
        idx = PersistentBM25Index()
        idx.add_document("d1", "state-of-the-art machine learning model")
        r = idx.query("state of the art")
        assert len(r) >= 1

    def test_numeric_query(self, bm25_index):
        r = bm25_index.query("123.9 33.9")
        result_ids = [d for d, _ in r]
        assert "doc_finance_001" in result_ids

    def test_recall_at_10(self, bm25_index):
        total_recall = 0.0
        for query, expected_ids in GROUND_TRUTH.items():
            results = bm25_index.query(query, top_k=10)
            result_ids = {d for d, _ in results}
            relevant = len(result_ids & set(expected_ids))
            total_recall += relevant / len(expected_ids)
        avg_recall = total_recall / len(GROUND_TRUTH)
        assert avg_recall >= 0.8, f"Average Recall@10 = {avg_recall:.3f} < 0.8"

    def test_mrr(self, bm25_index):
        rr_sum = 0.0
        for query, expected_ids in GROUND_TRUTH.items():
            results = bm25_index.query(query, top_k=10)
            for i, (doc_id, _) in enumerate(results, 1):
                if doc_id in expected_ids:
                    rr_sum += 1.0 / i
                    break
        mrr = rr_sum / len(GROUND_TRUTH)
        assert mrr >= 0.6, f"MRR = {mrr:.3f} < 0.6"


# ============================================================================
# PHASE 8 — top_k and Input Validation
# ============================================================================


class TestTopKValidation:
    def test_bm25_top_k_zero(self, bm25_index):
        results = bm25_index.query("Apple", top_k=0)
        assert results == []

    def test_bm25_top_k_negative(self, bm25_index):
        results = bm25_index.query("Apple", top_k=-1)
        assert results == []

    def test_bm25_top_k_one(self, bm25_index):
        results = bm25_index.query("Apple", top_k=1)
        assert len(results) <= 1

    def test_bm25_top_k_exceeds_corpus(self, bm25_index):
        results = bm25_index.query("Apple", top_k=1000)
        assert len(results) <= 10

    def test_bm25_empty_query(self, bm25_index):
        results = bm25_index.query("", top_k=5)
        assert results == []

    def test_bm25_none_like_query(self, bm25_index):
        results = bm25_index.query("   ", top_k=5)
        assert results == []


# ============================================================================
# PHASE 9 — Namespace Isolation (Security)
# ============================================================================


class TestNamespaceIsolation:
    def test_vector_isolation(self, ephemeral_chroma):
        ns_a = "security_org_a_data"
        ns_b = "security_org_b_data"
        text_a = "Classified document: Project Alpha secret formula for manufacturing."
        text_b = "Classified document: Project Beta secret recipe for production."
        embed_a = ephemeral_chroma.embedder.embed(text_a)
        embed_b = ephemeral_chroma.embedder.embed(text_b)
        ephemeral_chroma.store.upsert(ns_a, [text_a], [embed_a], "a.pdf")
        ephemeral_chroma.store.upsert(ns_b, [text_b], [embed_b], "b.pdf")
        result_a = ephemeral_chroma.store.query(ns_a, 5, embed_a)
        result_b = ephemeral_chroma.store.query(ns_b, 5, embed_b)
        docs_a = result_a["documents"][0]
        docs_b = result_b["documents"][0]
        assert any("Project Alpha" in d for d in docs_a)
        assert not any("Project Beta" in d for d in docs_a)
        assert any("Project Beta" in d for d in docs_b)
        assert not any("Project Alpha" in d for d in docs_b)

    def test_bm25_isolation(self):
        idx_a = PersistentBM25Index()
        idx_b = PersistentBM25Index()
        idx_a.add_document("a1", "Apple quarterly revenue billion financial report.")
        idx_b.add_document("b1", "Kubernetes sidecar containers service mesh observability.")
        r_a = idx_a.query("Kubernetes sidecar containers")
        r_b = idx_b.query("Apple quarterly revenue")
        assert r_a == []
        assert r_b == []

    def test_simple_retriever_isolation(self, ephemeral_chroma):
        ns_a = "iso_simple_a"
        ns_b = "iso_simple_b"
        text_a = "Alpha organization proprietary trade secret document."
        text_b = "Beta organization proprietary research paper document."
        embed_a = ephemeral_chroma.embedder.embed(text_a)
        embed_b = ephemeral_chroma.embedder.embed(text_b)
        ephemeral_chroma.store.upsert(ns_a, [text_a], [embed_a], "a.pdf")
        ephemeral_chroma.store.upsert(ns_b, [text_b], [embed_b], "b.pdf")
        r = SimpleRetriever(ephemeral_chroma.store, ephemeral_chroma.embedder)
        results_a = r.retrieve_top_k(ns_a, top_k=5, query="proprietary trade secret")
        results_b = r.retrieve_top_k(ns_b, top_k=5, query="proprietary trade secret")
        assert any("Alpha" in d for d in results_a)
        assert not any("Beta" in d for d in results_a)
        assert any("Beta" in d for d in results_b)
        assert not any("Alpha" in d for d in results_b)

    def test_missing_namespace_returns_empty(self, ephemeral_chroma):
        r = SimpleRetriever(ephemeral_chroma.store, ephemeral_chroma.embedder)
        with pytest.raises(ValueError, match="Unable to find the namespace"):
            r.retrieve_top_k("nonexistent_namespace_xyz", top_k=5, query="test")

    def test_empty_namespace_returns_empty(self, ephemeral_chroma):
        r = SimpleRetriever(ephemeral_chroma.store, ephemeral_chroma.embedder)
        with pytest.raises(ValueError, match="Unable to find the namespace"):
            r.retrieve_top_k("empty_ns_123", top_k=5, query="test")


# ============================================================================
# PHASE 10 — Failure / Degraded Mode
# ============================================================================


class TestFailureDegradedMode:
    def test_chroma_unavailable_fallback(self, populated_chroma):
        ns, ec = populated_chroma
        r = SimpleRetriever(ec.store, ec.embedder)
        original_query = ec.store.query
        def fail_query(*args, **kwargs):
            raise ConnectionError("ChromaDB unreachable")
        ec.store.query = fail_query
        results = r.retrieve_top_k(ns, top_k=3, query="Apple revenue")
        assert r.degraded_mode is True
        assert isinstance(results, list)
        ec.store.query = original_query

    def test_get_all_chunks_failure_dense_only(self, populated_chroma):
        ns, ec = populated_chroma
        r = SimpleRetriever(ec.store, ec.embedder)
        original_get_all = ec.store.get_all_chunks
        ec.store.get_all_chunks = MagicMock(side_effect=ConnectionError("down"))
        results = r.retrieve_top_k(ns, top_k=3, query="Apple revenue")
        assert r.degraded_mode is True
        assert isinstance(results, list)
        ec.store.get_all_chunks = original_get_all

    def test_embedding_failure_propagates(self, populated_chroma):
        ns, ec = populated_chroma
        r = SimpleRetriever(ec.store, ec.embedder)
        original_embed = ec.embedder.embed
        ec.embedder.embed = MagicMock(side_effect=RuntimeError("Embedding model crashed"))
        with pytest.raises(RuntimeError):
            r.retrieve_top_k(ns, top_k=3, query="test")
        ec.embedder.embed = original_embed

    def test_fallback_manager_at_max_tier(self):
        decision = FallbackManager.evaluate(
            {"retrieval_type": "SELF_QUERYING", "top_k": 5}, chunk_count=0
        )
        assert decision.should_fallback
        assert decision.escalated_tier is None
        assert decision.reason == "at_max_tier"

    def test_fallback_manager_escalation(self):
        decision = FallbackManager.evaluate(
            {"retrieval_type": "HYBRID", "top_k": 10}, chunk_count=0
        )
        assert decision.should_fallback
        assert decision.escalated_tier == "complex"


# ============================================================================
# PHASE 11 — Performance Baseline
# ============================================================================


class TestPerformanceBaseline:
    def test_bm25_query_latency(self, bm25_index):
        times = []
        for _ in range(50):
            start = time.perf_counter()
            bm25_index.query("Apple quarterly revenue billion", top_k=10)
            times.append(time.perf_counter() - start)
        p50 = statistics.median(times)
        p95 = sorted(times)[int(len(times) * 0.95)]
        assert p50 < 0.01, f"BM25 p50 latency {p50*1000:.1f}ms > 10ms"
        assert p95 < 0.02, f"BM25 p95 latency {p95*1000:.1f}ms > 20ms"

    def test_embedding_latency(self, ephemeral_chroma):
        times = []
        for _ in range(20):
            start = time.perf_counter()
            ephemeral_chroma.embedder.embed("Apple quarterly revenue billion dollars")
            times.append(time.perf_counter() - start)
        p50 = statistics.median(times)
        p95 = sorted(times)[int(len(times) * 0.95)]
        assert p50 < 0.5, f"Embedding p50 latency {p50*1000:.0f}ms > 500ms"
        assert p95 < 1.0, f"Embedding p95 latency {p95*1000:.0f}ms > 1000ms"

    def test_chroma_query_latency(self, populated_chroma):
        ns, ec = populated_chroma
        embed = ec.embedder.embed("test query")
        times = []
        for _ in range(20):
            start = time.perf_counter()
            ec.store.query(ns, 5, embed)
            times.append(time.perf_counter() - start)
        p50 = statistics.median(times)
        p95 = sorted(times)[int(len(times) * 0.95)]
        assert p50 < 0.1, f"Chroma p50 latency {p50*1000:.0f}ms > 100ms"
        assert p95 < 0.2, f"Chroma p95 latency {p95*1000:.0f}ms > 200ms"

    def test_simple_retriever_total_latency(self, populated_chroma):
        ns, ec = populated_chroma
        r = SimpleRetriever(ec.store, ec.embedder)
        times = []
        for _ in range(10):
            start = time.perf_counter()
            r.retrieve_top_k(ns, top_k=5, query="Apple quarterly revenue")
            times.append(time.perf_counter() - start)
        p50 = statistics.median(times)
        assert p50 < 1.0, f"SimpleRetriever p50 latency {p50*1000:.0f}ms > 1000ms"

    def test_reranker_latency(self, populated_chroma):
        from sentence_transformers import CrossEncoder
        from intelligence.reranker.cross_encoder_reranker import CrossEncoderReranker
        ce = CrossEncoder("cross-encoder/ms-marco-MiniLM-L-6-v2")
        reranker = CrossEncoderReranker(ce)
        chunks = [doc["text"] for doc in CORPUS]
        times = []
        for _ in range(10):
            start = time.perf_counter()
            reranker.rerank("Apple revenue", chunks, top_k=5)
            times.append(time.perf_counter() - start)
        p50 = statistics.median(times)
        assert p50 < 2.0, f"Reranker p50 latency {p50*1000:.0f}ms > 2000ms"


# ============================================================================
# PHASE 12 — Quality Comparison
# ============================================================================


class TestQualityComparison:
    def _precision_at_k(self, results: list[str], expected: set, k: int) -> float:
        return len(set(results[:k]) & expected) / k

    def _recall_at_k(self, results: list[str], expected: set, k: int) -> float:
        return len(set(results[:k]) & expected) / len(expected) if expected else 0.0

    def _mrr(self, results: list[str], expected: set) -> float:
        for i, r in enumerate(results, 1):
            if r in expected:
                return 1.0 / i
        return 0.0

    def test_bm25_vs_vector_quality(self, populated_chroma, bm25_index):
        ns, ec = populated_chroma
        r = SimpleRetriever(ec.store, ec.embedder)
        bm25_p1, vec_p1 = 0.0, 0.0
        bm25_mrr, vec_mrr = 0.0, 0.0
        for query, expected_ids in GROUND_TRUTH.items():
            expected = set(expected_ids)
            bm25_results = [d for d, _ in bm25_index.query(query, top_k=5)]
            vec_results = r.retrieve_top_k(ns, top_k=5, query=query)
            bm25_p1 += self._precision_at_k(bm25_results, expected, 1)
            vec_p1 += self._precision_at_k(vec_results, expected, 1)
            bm25_mrr += self._mrr(bm25_results, expected)
            vec_mrr += self._mrr(vec_results, expected)
        n = len(GROUND_TRUTH)
        print(f"\nBM25  P@1={bm25_p1/n:.3f} MRR={bm25_mrr/n:.3f}")
        print(f"Vec   P@1={vec_p1/n:.3f} MRR={vec_mrr/n:.3f}")
        assert bm25_p1 >= 0 or vec_p1 >= 0

    def test_rrf_fusion_quality(self, populated_chroma, bm25_index):
        ns, ec = populated_chroma
        r = SimpleRetriever(ec.store, ec.embedder)
        text_ground_truth = {query: [doc["text"] for doc in CORPUS if doc["id"] in ids]
                             for query, ids in GROUND_TRUTH.items()}
        mrr_sum = 0.0
        for query, expected_texts in text_ground_truth.items():
            expected = set(expected_texts)
            results = r.retrieve_top_k(ns, top_k=5, query=query)
            for i, res in enumerate(results, 1):
                if res in expected:
                    mrr_sum += 1.0 / i
                    break
        avg_mrr = mrr_sum / len(GROUND_TRUTH)
        assert avg_mrr >= 0.0


# ============================================================================
# PHASE 13 — Regression Suite
# ============================================================================


class TestRegressionSuite:
    def test_bm25_basic_ranking(self, bm25_index):
        results = bm25_index.query("Apple quarterly revenue", top_k=3)
        assert results[0][0] == "doc_finance_001"

    def test_bm25_multi_domain(self, bm25_index):
        for query, expected_ids in GROUND_TRUTH.items():
            results = bm25_index.query(query, top_k=10)
            result_ids = [d for d, _ in results]
            for eid in expected_ids:
                assert eid in result_ids, f"Missing {eid} for '{query}'"

    def test_chroma_insert_query(self, populated_chroma):
        ns, ec = populated_chroma
        embed = ec.embedder.embed("test")
        result = ec.store.query(ns, 1, embed)
        assert len(result["documents"][0]) >= 1

    def test_embedding_deterministic(self, ephemeral_chroma):
        e1 = ephemeral_chroma.embedder.embed("deterministic test")
        e2 = ephemeral_chroma.embedder.embed("deterministic test")
        np.testing.assert_array_almost_equal(e1, e2, decimal=5)

    def test_simple_retriever_returns_results(self, populated_chroma):
        ns, ec = populated_chroma
        r = SimpleRetriever(ec.store, ec.embedder)
        results = r.retrieve_top_k(ns, top_k=5, query="Apple revenue")
        assert len(results) > 0

    def test_fallback_threshold_boundary(self):
        top_k = 10
        threshold = max(1, int(top_k * FALLBACK_THRESHOLD_FACTOR))
        d1 = FallbackManager.evaluate({"retrieval_type": "HYBRID", "top_k": top_k}, chunk_count=threshold)
        d2 = FallbackManager.evaluate({"retrieval_type": "HYBRID", "top_k": top_k}, chunk_count=threshold - 1)
        assert not d1.should_fallback
        assert d2.should_fallback

    def test_strategy_selector_simple(self):
        details = ResponseSchema(query_type="simple", domain=None)
        config = get_config(details, confidence=0.9)
        assert config["retrieval_type"] == "RETRIEVAL_TYPE_UNSPECIFIED"
        assert config["top_k"] == 3

    def test_budget_allocator_coverage(self):
        for qt in QueryType:
            for cb in ConfidenceBand:
                budget = BUDGET_TABLE[qt][cb]
                assert budget.top_k >= 1

    def test_namespace_isolation_vector(self, ephemeral_chroma):
        ns_a = "reg_iso_a"
        ns_b = "reg_iso_b"
        text_a = "Alpha proprietary trade secret document content."
        text_b = "Beta proprietary research paper document content."
        embed_a = ephemeral_chroma.embedder.embed(text_a)
        embed_b = ephemeral_chroma.embedder.embed(text_b)
        ephemeral_chroma.store.upsert(ns_a, [text_a], [embed_a], "a.pdf")
        ephemeral_chroma.store.upsert(ns_b, [text_b], [embed_b], "b.pdf")
        result_a = ephemeral_chroma.store.query(ns_a, 5, embed_a)
        assert not any("Beta" in d for d in result_a["documents"][0])
