"""Retrieval quality baseline benchmark.

Tests the retrieval system components with a small, deterministic corpus
and known ground truth. Covers BM25, fusion, fallback logic, strategy
selection, and edge cases. No external services (ChromaDB, LLM) required
for most tests — those that need mocks use them explicitly.

Run:
    pytest tests/benchmarks/test_retrieval_baseline.py -v --tb=short
"""

from __future__ import annotations

from unittest.mock import MagicMock

import pytest

from intelligence.retrieval.persistent_bm25 import (
    PersistentBM25Index,
    _tokenize,
)
from intelligence.planner.planner_config import (
    BUDGET_TABLE,
    CONFIDENCE_MEDIUM,
    FALLBACK_THRESHOLD_FACTOR,
    STRATEGY_ESCALATION_MAP,
    ConfidenceBand,
    QueryType,
    RetrievalBudget,
)
from intelligence.planner.budget_allocator import allocate_budget
from intelligence.planner.fallback_manager import FallbackManager
from intelligence.classifier.strategy_selector import get_config
from intelligence.classifier.query_classifier import ResponseSchema


# ============================================================================
# Benchmark corpus — small, deterministic, known content
# ============================================================================

CORPUS: list[dict[str, str]] = [
    {
        "id": "doc_finance_001",
        "text": (
            "Apple Inc. reported record quarterly revenue of $123.9 billion "
            "for Q1 FY2024, driven by strong iPhone sales and growing services "
            "segment. Net income reached $33.9 billion."
        ),
        "domain": "finance",
    },
    {
        "id": "doc_finance_002",
        "text": (
            "The Federal Reserve held interest rates steady at 5.25%-5.50% "
            "following its January 2024 meeting, citing continued progress "
            "on inflation but noting it remains above the 2% target."
        ),
        "domain": "finance",
    },
    {
        "id": "doc_finance_003",
        "text": (
            "Tesla's stock dropped 12% after the company reported declining "
            "margins and warned of slower delivery growth in 2024. Revenue "
            "was $25.1 billion, below analyst expectations of $25.6 billion."
        ),
        "domain": "finance",
    },
    {
        "id": "doc_tech_001",
        "text": (
            "OpenAI released GPT-4 Turbo with a 128K token context window "
            "and vision capabilities. The model features improved instruction "
            "following and reduced pricing at $0.01 per 1K input tokens."
        ),
        "domain": "technology",
    },
    {
        "id": "doc_tech_002",
        "text": (
            "Docker Desktop 4.27 introduced native support for Docker Compose "
            "Watch, improving hot-reload workflows. The update also includes "
            "performance improvements for large-volume mounts on macOS."
        ),
        "domain": "technology",
    },
    {
        "id": "doc_tech_003",
        "text": (
            "Kubernetes 1.29 added support for sidecar containers as a "
            "stable feature, enabling better lifecycle management for "
            "service meshes and observability agents in pods."
        ),
        "domain": "technology",
    },
    {
        "id": "doc_legal_001",
        "text": (
            "The EU AI Act entered into force on August 1, 2024, establishing "
            "a risk-based regulatory framework for artificial intelligence "
            "systems. High-risk AI applications must comply by August 2026."
        ),
        "domain": "legal",
    },
    {
        "id": "doc_legal_002",
        "text": (
            "GDPR Article 17 provides data subjects with the right to "
            "erasure, commonly known as the right to be forgotten. Controllers "
            "must comply within one month of receiving a valid request."
        ),
        "domain": "legal",
    },
    {
        "id": "doc_health_001",
        "text": (
            "The CDC recommended updated COVID-19 boosters targeting the "
            "JN.1 variant for all individuals aged 6 months and older. "
            "Clinical trials showed a 2.5-fold increase in neutralizing antibodies."
        ),
        "domain": "healthcare",
    },
    {
        "id": "doc_health_002",
        "text": (
            "WHO declared the end of the global health emergency for mpox "
            "on May 11, 2024, noting sustained decline in cases worldwide. "
            "Vaccination campaigns contributed to reduced transmission."
        ),
        "domain": "healthcare",
    },
]

GROUND_TRUTH: dict[str, list[str]] = {
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

QUERIES_WITH_NO_MATCH: list[str] = [
    "quantum computing breakthroughs in 2024",
    "recipe for chocolate cake",
    "basketball scores last night",
]

QUERIES_SEMANTICALLY_CLOSE: list[str] = [
    "AAPL earnings report",
    "interest rate policy of the US central bank",
    "TSLA share price drop",
]


# ============================================================================
# 1. Tokenizer
# ============================================================================


class TestTokenizer:
    def test_lowercase_normalization(self):
        assert _tokenize("Hello World") == ["hello", "world"]

    def test_numeric_tokens_preserved(self):
        tokens = _tokenize("GPT-4 has 128K context")
        assert "gpt" in tokens
        assert "128k" in tokens

    def test_short_tokens_not_filtered_by_tokenizer(self):
        tokens = _tokenize("a to of in on")
        assert tokens == ["a", "to", "of", "in", "on"]

    def test_unicode_text_stripped_by_ascii_tokenizer(self):
        tokens = _tokenize("über naïve résumé café")
        assert tokens == []

    def test_empty_string(self):
        assert _tokenize("") == []

    def test_punctuation_removed(self):
        tokens = _tokenize("hello, world! how's it?")
        assert "hello" in tokens
        assert "world" in tokens


# ============================================================================
# 2. BM25 Index — Core Behavior
# ============================================================================


class TestBM25Basic:
    def test_empty_index_returns_empty(self):
        idx = PersistentBM25Index()
        results = idx.query("anything")
        assert results == []

    def test_single_document_ranking(self):
        idx = PersistentBM25Index()
        idx.add_document("d1", "machine learning algorithms")
        results = idx.query("machine learning", top_k=1)
        assert len(results) == 1
        assert results[0][0] == "d1"

    def test_exact_keyword_match_ranks_highest(self):
        idx = PersistentBM25Index()
        idx.add_document("d1", "apple quarterly revenue billion")
        idx.add_document("d2", "apple stock price market")
        idx.add_document("d3", "quarterly earnings report revenue")
        results = idx.query("apple quarterly revenue", top_k=3)
        assert results[0][0] == "d1"

    def test_top_k_limits_results(self):
        idx = PersistentBM25Index()
        for i in range(20):
            idx.add_document(f"d{i}", f"document number {i} about testing")
        results = idx.query("document testing", top_k=5)
        assert len(results) == 5

    def test_scores_are_positive(self):
        idx = PersistentBM25Index()
        idx.add_document("d1", "test document")
        results = idx.query("test")
        assert all(score > 0 for _, score in results)

    def test_scores_are_sorted_descending(self):
        idx = PersistentBM25Index()
        idx.add_document("d1", "python programming language")
        idx.add_document("d2", "python data science")
        idx.add_document("d3", "java programming")
        results = idx.query("python programming", top_k=3)
        scores = [s for _, s in results]
        assert scores == sorted(scores, reverse=True)

    def test_incremental_add(self):
        idx = PersistentBM25Index()
        idx.add_document("d1", "first document about cats")
        r1 = idx.query("cats", top_k=5)
        assert len(r1) == 1

        idx.add_document("d2", "second document about dogs")
        r2 = idx.query("cats dogs", top_k=5)
        ids = [d for d, _ in r2]
        assert "d1" in ids
        assert "d2" in ids

    def test_remove_document(self):
        idx = PersistentBM25Index()
        idx.add_document("d1", "remove me document")
        idx.add_document("d2", "keep me document")
        idx.remove_document("d1")
        results = idx.query("remove me", top_k=5)
        ids = [d for d, _ in results]
        assert "d1" not in ids

    def test_get_document_text(self):
        idx = PersistentBM25Index()
        idx.add_document("d1", "specific text here")
        assert idx.get_document_text("d1") == "specific text here"
        assert idx.get_document_text("nonexistent") is None

    def test_get_documents_by_ids(self):
        idx = PersistentBM25Index()
        idx.add_document("d1", "first")
        idx.add_document("d2", "second")
        idx.add_document("d3", "third")
        texts = idx.get_documents_by_ids(["d3", "d1"])
        assert texts == ["third", "first"]

    def test_num_documents(self):
        idx = PersistentBM25Index()
        assert idx.num_documents == 0
        idx.add_document("d1", "doc one")
        idx.add_document("d2", "doc two")
        assert idx.num_documents == 2
        idx.remove_document("d1")
        assert idx.num_documents == 1

    def test_avg_doc_length(self):
        idx = PersistentBM25Index()
        idx.add_document("d1", "short")
        avg = idx.avg_doc_length
        assert avg > 0

    def test_batch_add(self):
        idx = PersistentBM25Index()
        idx.add_documents([("d1", "alpha"), ("d2", "beta"), ("d3", "gamma")])
        assert idx.num_documents == 3
        results = idx.query("alpha beta gamma", top_k=3)
        assert len(results) == 3


# ============================================================================
# 3. BM25 — Corpus Benchmark
# ============================================================================


class TestBM25CorpusBenchmark:
    """Benchmark BM25 against the known corpus with ground truth queries."""

    @pytest.fixture(scope="class")
    def bm25_index(self) -> PersistentBM25Index:
        idx = PersistentBM25Index()
        for doc in CORPUS:
            idx.add_document(doc["id"], doc["text"])
        return idx

    def test_relevant_doc_in_top_k(self, bm25_index: PersistentBM25Index):
        for query, expected_ids in GROUND_TRUTH.items():
            results = bm25_index.query(query, top_k=10)
            result_ids = [d for d, _ in results]
            for expected_id in expected_ids:
                assert expected_id in result_ids, (
                    f"Expected {expected_id} in results for '{query}', "
                    f"got top-5: {result_ids[:5]}"
                )

    def test_relevant_doc_ranks_first(self, bm25_index: PersistentBM25Index):
        first_rank_correct = 0
        total = len(GROUND_TRUTH)
        for query, expected_ids in GROUND_TRUTH.items():
            results = bm25_index.query(query, top_k=5)
            if results and results[0][0] in expected_ids:
                first_rank_correct += 1
        rate = first_rank_correct / total
        assert rate >= 0.5, f"First-rank accuracy {rate:.0%} < 50%"

    def test_no_match_bm25_all_tokens_absent(self, bm25_index: PersistentBM25Index):
        results = bm25_index.query("xyzzy plugh", top_k=10)
        assert len(results) == 0

    def test_precision_at_3(self, bm25_index: PersistentBM25Index):
        total_precision = 0.0
        for query, expected_ids in GROUND_TRUTH.items():
            results = bm25_index.query(query, top_k=3)
            result_ids = {d for d, _ in results}
            relevant_retrieved = len(result_ids & set(expected_ids))
            total_precision += relevant_retrieved / 3
        avg_precision = total_precision / len(GROUND_TRUTH)
        assert avg_precision >= 0.2, f"Average P@3 = {avg_precision:.3f} < 0.2"

    def test_recall_at_10(self, bm25_index: PersistentBM25Index):
        total_recall = 0.0
        for query, expected_ids in GROUND_TRUTH.items():
            results = bm25_index.query(query, top_k=10)
            result_ids = {d for d, _ in results}
            relevant_retrieved = len(result_ids & set(expected_ids))
            total_recall += relevant_retrieved / len(expected_ids)
        avg_recall = total_recall / len(GROUND_TRUTH)
        assert avg_recall >= 0.7, f"Average Recall@10 = {avg_recall:.3f} < 0.7"

    def test_mrr(self, bm25_index: PersistentBM25Index):
        reciprocal_sum = 0.0
        for query, expected_ids in GROUND_TRUTH.items():
            results = bm25_index.query(query, top_k=10)
            result_ids = [d for d, _ in results]
            rr = 0.0
            for i, rid in enumerate(result_ids, 1):
                if rid in expected_ids:
                    rr = 1.0 / i
                    break
            reciprocal_sum += rr
        mrr = reciprocal_sum / len(GROUND_TRUTH)
        assert mrr >= 0.5, f"MRR = {mrr:.3f} < 0.5"

    def test_semantic_close_queries_fallback(self, bm25_index: PersistentBM25Index):
        for query in QUERIES_SEMANTICALLY_CLOSE:
            results = bm25_index.query(query, top_k=5)
            assert len(results) <= 5
            for _, score in results:
                assert score >= 0


# ============================================================================
# 4. FallbackManager — Pure Logic
# ============================================================================


class TestFallbackManager:
    def test_sufficient_chunks_no_fallback(self):
        decision = FallbackManager.evaluate(
            {"retrieval_type": "HYBRID", "top_k": 4}, chunk_count=5
        )
        assert not decision.should_fallback
        assert decision.reason == "sufficient"

    def test_insufficient_chunks_escalates(self):
        decision = FallbackManager.evaluate(
            {"retrieval_type": "HYBRID", "top_k": 10}, chunk_count=1
        )
        assert decision.should_fallback
        assert decision.escalated_tier == "complex"
        assert decision.reason == "insufficient_chunks"

    def test_max_tier_cannot_escalate(self):
        decision = FallbackManager.evaluate(
            {"retrieval_type": "SELF_QUERYING", "top_k": 5}, chunk_count=0
        )
        assert decision.should_fallback
        assert decision.escalated_tier is None
        assert decision.reason == "at_max_tier"

    def test_threshold_boundary(self):
        top_k = 10
        threshold = max(1, int(top_k * FALLBACK_THRESHOLD_FACTOR))
        decision_at = FallbackManager.evaluate(
            {"retrieval_type": "HYBRID", "top_k": top_k}, chunk_count=threshold
        )
        assert not decision_at.should_fallback

        decision_below = FallbackManager.evaluate(
            {"retrieval_type": "HYBRID", "top_k": top_k}, chunk_count=threshold - 1
        )
        assert decision_below.should_fallback

    def test_simple_to_complex_escalation(self):
        decision = FallbackManager.evaluate(
            {"retrieval_type": "HYBRID", "top_k": 6}, chunk_count=0
        )
        assert decision.escalated_tier == "complex"

    def test_complex_to_multi_hop_escalation(self):
        decision = FallbackManager.evaluate(
            {"retrieval_type": "MULTI_VECTOR", "top_k": 6}, chunk_count=0
        )
        assert decision.escalated_tier == "multi_hop"

    def test_zero_chunks_triggers_fallback(self):
        decision = FallbackManager.evaluate(
            {"retrieval_type": "HYBRID", "top_k": 4}, chunk_count=0
        )
        assert decision.should_fallback

    def test_confidence_reserved_for_future(self):
        decision1 = FallbackManager.evaluate(
            {"retrieval_type": "HYBRID", "top_k": 4}, chunk_count=1, confidence=0.1
        )
        decision2 = FallbackManager.evaluate(
            {"retrieval_type": "HYBRID", "top_k": 4}, chunk_count=1, confidence=0.9
        )
        assert decision1.should_fallback == decision2.should_fallback

    def test_unspecified_retrieval_type_maps_to_simple(self):
        decision = FallbackManager.evaluate(
            {"retrieval_type": "RETRIEVAL_TYPE_UNSPECIFIED", "top_k": 8},
            chunk_count=0,
        )
        assert decision.escalated_tier == "complex"

    def test_default_top_k_is_1(self):
        decision = FallbackManager.evaluate({}, chunk_count=0)
        assert decision.should_fallback


# ============================================================================
# 5. Budget Allocator
# ============================================================================


class TestBudgetAllocator:
    def test_simple_high_confidence(self):
        budget = allocate_budget(QueryType.SIMPLE, 0.9)
        assert budget.top_k == 3
        assert not budget.rerank
        assert not budget.decompose

    def test_simple_low_confidence(self):
        budget = allocate_budget(QueryType.SIMPLE, 0.3)
        assert budget.top_k == 8
        assert budget.rerank
        assert not budget.decompose

    def test_complex_high_confidence(self):
        budget = allocate_budget(QueryType.COMPLEX, 0.9)
        assert budget.top_k == 8
        assert budget.rerank
        assert not budget.decompose

    def test_complex_low_confidence(self):
        budget = allocate_budget(QueryType.COMPLEX, 0.1)
        assert budget.top_k == 12
        assert budget.rerank
        assert budget.decompose

    def test_multi_hop_high_confidence(self):
        budget = allocate_budget(QueryType.MULTI_HOP, 0.9)
        assert budget.top_k == 3
        assert not budget.rerank
        assert budget.decompose

    def test_medium_confidence_band(self):
        budget = allocate_budget(QueryType.SIMPLE, CONFIDENCE_MEDIUM)
        assert budget.top_k == 5
        assert budget.rerank

    def test_budget_table_completeness(self):
        for qt in QueryType:
            for cb in ConfidenceBand:
                budget = BUDGET_TABLE[qt][cb]
                assert budget.top_k >= 1
                assert isinstance(budget.rerank, bool)
                assert isinstance(budget.decompose, bool)


# ============================================================================
# 6. StrategySelector — get_config
# ============================================================================


class TestStrategySelector:
    def test_simple_query_high_confidence(self):
        details = ResponseSchema(query_type="simple", domain=None)
        config = get_config(details, confidence=0.9)
        assert config["retrieval_type"] == "RETRIEVAL_TYPE_UNSPECIFIED"
        assert config["top_k"] == 3
        assert not config["rerank"]

    def test_simple_query_with_domain(self):
        details = ResponseSchema(query_type="simple", domain="finance")
        config = get_config(details, confidence=0.9)
        assert config["retrieval_type"] == "HYBRID"
        assert config["top_k"] == 3

    def test_complex_query(self):
        details = ResponseSchema(query_type="complex", domain=None)
        config = get_config(details, confidence=0.9)
        assert config["retrieval_type"] == "MULTI_VECTOR"
        assert config["top_k"] == 8
        assert config["rerank"]
        assert not config["decompose"]

    def test_multi_hop_query(self):
        details = ResponseSchema(query_type="multi_hop", domain=None)
        config = get_config(details, confidence=0.9)
        assert config["retrieval_type"] == "SELF_QUERYING"
        assert config["decompose"]

    def test_low_confidence_overrides(self):
        details = ResponseSchema(query_type="simple", domain=None)
        config = get_config(details, confidence=0.3)
        assert config["top_k"] == 8
        assert config["rerank"]

    def test_explicit_budget_overrides(self):
        details = ResponseSchema(query_type="simple", domain=None)
        budget = RetrievalBudget(top_k=15, rerank=False, decompose=True)
        config = get_config(details, confidence=0.3, budget=budget)
        assert config["top_k"] == 15
        assert not config["rerank"]
        assert config["decompose"]

    def test_unknown_query_type_rejected_by_schema(self):
        with pytest.raises(Exception):
            ResponseSchema(query_type="unknown_type", domain=None)


# ============================================================================
# 7. SimpleRetriever Fusion Logic (Mocked ChromaStore)
# ============================================================================


class TestSimpleRetrieverFusion:
    def _make_retriever(self, dense_results: list[str], all_chunks: list[str]):
        """Create a SimpleRetriever with mocked store and embedder."""
        from intelligence.retrieval.simple_retriever import SimpleRetriever

        mock_embedder = MagicMock()
        mock_embedder.embed.return_value = [0.1, 0.2, 0.3]

        mock_store = MagicMock()
        mock_store.query.return_value = {"documents": [dense_results]}
        mock_store.get_all_chunks.return_value = all_chunks

        mock_client = MagicMock()
        mock_collection = MagicMock()
        mock_collection.count.return_value = len(all_chunks)
        mock_store.client = mock_client
        mock_client.get_collection.return_value = mock_collection

        retriever = SimpleRetriever(mock_store, mock_embedder)
        return retriever

    def test_rrf_fusion_combines_results(self):
        all_chunks = [
            "Apple Inc. reported record quarterly revenue of $123.9 billion",
            "Tesla stock dropped 12% after the company reported declining margins",
            "The Federal Reserve held interest rates steady at 5.25%-5.50%",
            "OpenAI released GPT-4 Turbo with a 128K token context window",
            "Docker Desktop 4.27 introduced native support for Docker Compose Watch",
        ]
        dense_results = all_chunks[:3]
        retriever = self._make_retriever(dense_results, all_chunks)
        results = retriever.retrieve_top_k(
            "test_namespace", top_k=3, query="Apple revenue"
        )
        assert len(results) <= 3
        assert len(results) > 0

    def test_fusion_deduplicates_chunks(self):
        all_chunks = [
            "Apple Inc. reported record quarterly revenue of $123.9 billion",
            "Tesla stock dropped 12% after the company reported declining margins",
            "The Federal Reserve held interest rates steady at 5.25%-5.50%",
        ]
        dense_results = all_chunks[:2]
        retriever = self._make_retriever(dense_results, all_chunks)
        results = retriever.retrieve_top_k("ns", top_k=3, query="revenue")
        assert len(results) == len(set(results))

    def test_short_chunks_filtered_out(self):
        all_chunks = [
            "Apple Inc. reported record quarterly revenue of $123.9 billion",
            "short",
            "Tesla stock dropped 12% after the company reported declining margins",
            "x",
            "The Federal Reserve held interest rates steady at 5.25%-5.50%",
        ]
        dense_results = all_chunks
        retriever = self._make_retriever(dense_results, all_chunks)
        results = retriever.retrieve_top_k("ns", top_k=5, query="revenue")
        for r in results:
            assert len(r.strip()) > 30

    def test_empty_dense_results_returns_empty(self):
        retriever = self._make_retriever([], [])
        results = retriever.retrieve_top_k("ns", top_k=3, query="anything")
        assert results == []

    def test_bm25_fallback_triggered_on_connection_error(self):
        from intelligence.retrieval.simple_retriever import SimpleRetriever

        mock_embedder = MagicMock()
        mock_embedder.embed.return_value = [0.1]

        mock_store = MagicMock()
        mock_store.query.side_effect = ConnectionError("ChromaDB unreachable")
        mock_store.get_all_chunks.return_value = [
            "Apple Inc. reported record quarterly revenue of $123.9 billion",
            "Tesla stock dropped 12% after the company reported declining margins",
            "The Federal Reserve held interest rates steady at 5.25%-5.50%",
        ]

        mock_client = MagicMock()
        mock_collection = MagicMock()
        mock_collection.count.return_value = 3
        mock_store.client = mock_client
        mock_client.get_collection.return_value = mock_collection

        retriever = SimpleRetriever(mock_store, mock_embedder)
        results = retriever.retrieve_top_k("ns", top_k=3, query="Apple revenue")
        assert retriever.degraded_mode
        assert len(results) <= 3

    def test_get_all_chunks_failure_returns_dense_only(self):
        from intelligence.retrieval.simple_retriever import SimpleRetriever

        mock_embedder = MagicMock()
        mock_embedder.embed.return_value = [0.1]

        mock_store = MagicMock()
        dense_chunks = [
            "Apple Inc. reported record quarterly revenue of $123.9 billion",
            "Tesla stock dropped 12% after the company reported declining margins",
        ]
        mock_store.query.return_value = {"documents": [dense_chunks]}
        mock_store.get_all_chunks.side_effect = OSError("Collection not found")

        mock_client = MagicMock()
        mock_collection = MagicMock()
        mock_collection.count.return_value = 2
        mock_store.client = mock_client
        mock_client.get_collection.return_value = mock_collection

        retriever = SimpleRetriever(mock_store, mock_embedder)
        results = retriever.retrieve_top_k("ns", top_k=3, query="anything")
        assert retriever.degraded_mode
        assert len(results) == 2


# ============================================================================
# 8. Edge Cases
# ============================================================================


class TestBM25EdgeCases:
    def test_empty_query(self):
        idx = PersistentBM25Index()
        idx.add_document("d1", "test document")
        results = idx.query("")
        assert results == []

    def test_whitespace_only_query(self):
        idx = PersistentBM25Index()
        idx.add_document("d1", "test document")
        results = idx.query("   ")
        assert results == []

    def test_very_long_query(self):
        idx = PersistentBM25Index()
        idx.add_document("d1", "test document")
        long_query = "word " * 500
        results = idx.query(long_query, top_k=1)
        assert len(results) <= 1

    def test_special_characters_stripped(self):
        idx = PersistentBM25Index()
        idx.add_document("d1", "C++ programming language")
        idx.add_document("d2", "C# programming language")
        results = idx.query("C++", top_k=5)
        assert len(results) == 0

    def test_duplicate_documents(self):
        idx = PersistentBM25Index()
        idx.add_document("d1", "identical text here")
        idx.add_document("d2", "identical text here")
        results = idx.query("identical text", top_k=10)
        assert len(results) == 2

    def test_single_character_tokens(self):
        idx = PersistentBM25Index()
        idx.add_document("d1", "a b c d e f g h i j k l m")
        results = idx.query("a b c", top_k=5)
        assert results == []

    def test_numeric_only_query(self):
        idx = PersistentBM25Index()
        idx.add_document("d1", "Apple revenue 123 billion 2024")
        results = idx.query("123 2024", top_k=5)
        assert len(results) == 1

    def test_mixed_language(self):
        idx = PersistentBM25Index()
        idx.add_document("d1", "English text about Über cool café")
        results = idx.query("English Über", top_k=5)
        assert len(results) == 1

    def test_document_removal_preserves_index(self):
        idx = PersistentBM25Index()
        idx.add_document("d1", "first document about cats")
        idx.add_document("d2", "second document about dogs")
        idx.add_document("d3", "third document about birds")
        idx.remove_document("d2")
        assert idx.num_documents == 2
        results = idx.query("cats birds", top_k=5)
        ids = {d for d, _ in results}
        assert "d2" not in ids
        assert "d1" in ids or "d3" in ids


# ============================================================================
# 9. Component Integration (Fallback + Strategy)
# ============================================================================


class TestComponentIntegration:
    def test_strategy_then_fallback_flow(self):
        details = ResponseSchema(query_type="simple", domain="finance")
        config = get_config(details, confidence=0.9)
        decision = FallbackManager.evaluate(config, chunk_count=0)
        assert decision.should_fallback
        assert decision.escalated_tier == "complex"

    def test_high_confidence_no_escalation_needed(self):
        details = ResponseSchema(query_type="complex", domain=None)
        config = get_config(details, confidence=0.95)
        decision = FallbackManager.evaluate(config, chunk_count=10)
        assert not decision.should_fallback

    def test_low_confidence_escalation_possible(self):
        details = ResponseSchema(query_type="simple", domain=None)
        config = get_config(details, confidence=0.2)
        assert config["top_k"] == 8
        assert config["rerank"]
        decision = FallbackManager.evaluate(config, chunk_count=1)
        assert decision.should_fallback
        assert decision.escalated_tier == "complex"

    def test_full_simple_to_complex_chain(self):
        details = ResponseSchema(query_type="simple", domain=None)
        config = get_config(details, confidence=0.9)
        assert config["retrieval_type"] == "RETRIEVAL_TYPE_UNSPECIFIED"
        assert config["top_k"] == 3

        decision = FallbackManager.evaluate(config, chunk_count=0)
        assert decision.should_fallback
        assert decision.escalated_tier == "complex"

        details2 = ResponseSchema(query_type="complex", domain=None)
        config2 = get_config(details2, confidence=0.9)
        assert config2["retrieval_type"] == "MULTI_VECTOR"
        assert config2["top_k"] == 8
        assert config2["rerank"]

    def test_budget_overrides_fallback_threshold(self):
        details = ResponseSchema(query_type="simple", domain=None)
        budget = RetrievalBudget(top_k=20, rerank=True, decompose=False)
        config = get_config(details, confidence=0.1, budget=budget)
        assert config["top_k"] == 20
        decision = FallbackManager.evaluate(config, chunk_count=5)
        threshold = max(1, int(20 * FALLBACK_THRESHOLD_FACTOR))
        assert 5 < threshold
        assert decision.should_fallback


# ============================================================================
# 10. RetrievalBudget Invariants
# ============================================================================


class TestBudgetInvariants:
    def test_top_k_minimum(self):
        with pytest.raises(ValueError):
            RetrievalBudget(top_k=0, rerank=False, decompose=False)

    def test_all_budgets_have_valid_top_k(self):
        for qt in QueryType:
            for cb in ConfidenceBand:
                budget = BUDGET_TABLE[qt][cb]
                assert budget.top_k >= 1

    def test_budget_table_covers_all_types(self):
        for qt in QueryType:
            assert qt in BUDGET_TABLE
            for cb in ConfidenceBand:
                assert cb in BUDGET_TABLE[qt]

    def test_escalation_map_completeness(self):
        for qt in QueryType:
            assert qt in STRATEGY_ESCALATION_MAP
            escalated = STRATEGY_ESCALATION_MAP[qt]
            assert isinstance(escalated, QueryType)

    def test_multi_hop_escalates_to_self(self):
        assert STRATEGY_ESCALATION_MAP[QueryType.MULTI_HOP] == QueryType.MULTI_HOP

    def test_simple_escalates_to_complex(self):
        assert STRATEGY_ESCALATION_MAP[QueryType.SIMPLE] == QueryType.COMPLEX

    def test_complex_escalates_to_multi_hop(self):
        assert STRATEGY_ESCALATION_MAP[QueryType.COMPLEX] == QueryType.MULTI_HOP


# ============================================================================
# 11. Benchmark Summary Report
# ============================================================================


class TestBenchmarkSummary:
    def test_corpus_size(self):
        assert len(CORPUS) == 10

    def test_ground_truth_coverage(self):
        all_ids = {doc["id"] for doc in CORPUS}
        for query, expected_ids in GROUND_TRUTH.items():
            for eid in expected_ids:
                assert eid in all_ids, f"Ground truth references unknown doc {eid}"

    def test_no_query_matches_all_docs(self):
        for query, expected_ids in GROUND_TRUTH.items():
            assert len(expected_ids) <= 2, (
                f"Query '{query}' matches {len(expected_ids)} docs — "
                f"ground truth should be 1-2 docs per query"
            )

    def test_all_domains_represented(self):
        domains = {doc["domain"] for doc in CORPUS}
        assert "finance" in domains
        assert "technology" in domains
        assert "legal" in domains
        assert "healthcare" in domains
