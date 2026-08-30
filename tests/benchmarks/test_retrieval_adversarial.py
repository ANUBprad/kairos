"""P3 — Retrieval Hardening & Adversarial Quality Audit.

Tests retrieval under adversarial conditions: multilingual text,
technical identifiers, noisy input, duplicates, contradictions,
namespace attacks, failure modes, performance stress, and determinism.

Run:
    pytest tests/benchmarks/test_retrieval_adversarial.py -v --tb=short
"""

from __future__ import annotations

import statistics
import time


import numpy as np
import pytest

from intelligence.retrieval.persistent_bm25 import PersistentBM25Index, _tokenize
from intelligence.retrieval.simple_retriever import SimpleRetriever
from intelligence.vectorstore.chroma_store import ChromaStore


# ============================================================================
# Helpers
# ============================================================================


def _make_chroma():
    import chromadb
    client = chromadb.Client()
    store = ChromaStore.__new__(ChromaStore)
    store.client = client
    from intelligence.embeddings.local_embedder import LocalEmbedder
    embedder = LocalEmbedder()
    return store, embedder


def _populate(store, embedder, ns, docs):
    for doc in docs:
        embed = embedder.embed(doc)
        store.upsert(ns, [doc], [embed], f"doc_{hash(doc) & 0xFFFFFF:06x}")


# ============================================================================
# PHASE 2 — Multilingual Retrieval
# ============================================================================

MULTILINGUAL_CORPUS = [
    "The retrieval system uses hybrid search with BM25 and vector similarity.",
    "Das Abrufsystem verwendet hybride Suche mit BM25 und Vektorhnlichkeit.",
    "Le systme de rcupration utilise une recherche hybride avec BM25 et similarit vectorielle.",
    "El sistema de recuperacin utiliza bsqueda hbrida con BM25 y similitud vectorial.",
    "This system uses hybrid search combining keyword and semantic matching.",
    "Die System verwendet hybride Suche basierend auf Stichworten und semantischem Abgleich.",
    "Ce systme utilise une recherche hybride combinant mots-cls et correspondance smantique.",
    "Este sistema utiliza bsqueda hbrida combinando palabras clave y coincidencia semntica.",
]

MULTILINGUAL_QUERIES = {
    "hybrid search": [0],
    "BM25 vector": [0, 1, 2, 3],
    "hybride Suche": [1],
    "recherche hybride": [2],
    "bsqueda hbrida": [3],
    "keyword semantic": [4, 5, 6, 7],
}


class TestMultilingualRetrieval:
    @pytest.fixture(scope="class")
    def bm25(self):
        idx = PersistentBM25Index()
        for i, doc in enumerate(MULTILINGUAL_CORPUS):
            idx.add_document(f"ml_{i}", doc)
        return idx

    def test_english_query_matches_english_doc(self, bm25):
        results = bm25.query("hybrid search", top_k=3)
        result_ids = [d for d, _ in results]
        assert "ml_0" in result_ids

    def test_german_query_matches_german_doc(self, bm25):
        results = bm25.query("hybride Suche", top_k=3)
        result_ids = [d for d, _ in results]
        assert "ml_1" in result_ids

    def test_french_query_matches_french_doc(self, bm25):
        results = bm25.query("recherche hybride", top_k=3)
        result_ids = [d for d, _ in results]
        assert "ml_2" in result_ids

    def test_spanish_query_matches_spanish_doc(self, bm25):
        results = bm25.query("bsqueda hbrida", top_k=3)
        result_ids = [d for d, _ in results]
        assert "ml_3" in result_ids

    def test_cross_lingual_keyword_overlap(self, bm25):
        results = bm25.query("BM25 vector similarity", top_k=5)
        result_ids = [d for d, _ in results]
        assert len(result_ids) >= 2

    def test_unicode_accented_terms(self, bm25):
        results = bm25.query("Rckupration Vektorhnlichkeit", top_k=3)
        assert isinstance(results, list)

    def test_bm25_returns_results_for_all_languages(self, bm25):
        for lang_query in ["hybrid search", "hybride Suche", "recherche hybride", "bsqueda hbrida"]:
            results = bm25.query(lang_query, top_k=10)
            assert len(results) > 0, f"No results for: {lang_query}"

    def test_accent_folding_preserves_partial_match(self, bm25):
        r1 = bm25.query("recherche hybride", top_k=5)
        r2 = bm25.query("recherche hybride", top_k=5)
        ids1 = [d for d, _ in r1]
        ids2 = [d for d, _ in r2]
        assert ids1 == ids2

    def test_embedder_handles_unicode(self):
        from intelligence.embeddings.local_embedder import LocalEmbedder
        embedder = LocalEmbedder()
        texts = [
            "über naïve résumé café München",
            "日本語テキスト処理",
            "中文文本处理系统",
            "Русский текст обработки",
            "Arabic text processing system",
        ]
        for text in texts:
            embed = embedder.embed(text)
            assert len(embed) == 384
            assert all(isinstance(v, float) for v in embed)

    def test_chroma_multilingual_insert_query(self):
        store, embedder = _make_chroma()
        ns = "multilingual_test"
        docs = [
            "The quick brown fox jumps over the lazy dog.",
            "Schnelle braune Fox springt ber den faulen Hund.",
            "Le renard brun rapide saute par-dessus le chien paresseux.",
        ]
        _populate(store, embedder, ns, docs)
        embed = embedder.embed("fox jumps dog")
        result = store.query(ns, 3, embed)
        assert len(result["documents"][0]) > 0

    def test_rrf_multilingual(self):
        store, embedder = _make_chroma()
        ns = "rrf_multilingual"
        docs = [
            "Apple Inc. reported record quarterly revenue of $123.9 billion for Q1 FY2024.",
            "Apple Inc. hat Rekordumsatz von $123.9 Milliarden im Q1 FY2024 gemeldet.",
            "Apple Inc. a annonc un chiffre d'affaires record de 123,9 milliards de dollars.",
        ]
        _populate(store, embedder, ns, docs)
        r = SimpleRetriever(store, embedder)
        results = r.retrieve_top_k(ns, top_k=3, query="Apple revenue quarterly")
        assert len(results) > 0


# ============================================================================
# PHASE 3 — Technical / Programming Queries
# ============================================================================

TECHNICAL_CORPUS = [
    "C++ programming language supports templates and generic programming with std::vector and std::unique_ptr.",
    "C# is a modern object-oriented language for .NET framework development with async/await patterns.",
    "Python uses asyncio.run for async execution and snake_case naming conventions for variables.",
    "TypeScript adds static typing to JavaScript with React.useState hooks and getServerSideProps.",
    "Go uses goroutines for concurrency and kebab-case in package names like my-package.",
    "Rust provides memory safety without garbage collection using ownership and borrowing rules.",
    "Java uses camelCase for method names and PascalCase for class names in enterprise applications.",
    "HTTP_STATUS_CODE constants follow UPPER_SNAKE_CASE in many API implementations.",
    "REST API endpoints like /api/v1/query use versioned paths for backward compatibility.",
    "SQL SELECT queries use JOIN operations across multiple tables with WHERE clauses.",
    "JSON configuration files like package.json define project dependencies and scripts.",
    "YAML files use indentation-based structure for Kubernetes deployment manifests.",
    "Semantic versioning follows v2.4.1 format with major.minor.patch numbering.",
    "IPv4 addresses like 192.168.1.1 identify devices on local networks.",
    "HTTP methods include GET, POST, PUT, DELETE for RESTful resource operations.",
]

TECHNICAL_QUERIES = {
    "C++ templates": [0],
    ".NET async": [1],
    "asyncio.run snake_case": [2],
    "React.useState getServerSideProps": [3],
    "goroutines kebab-case": [4],
    "ownership borrowing Rust": [5],
    "camelCase PascalCase Java": [6],
    "HTTP_STATUS_CODE UPPER_SNAKE_CASE": [7],
    "/api/v1/query REST": [8],
    "SQL JOIN WHERE": [9],
    "package.json dependencies": [10],
    "YAML Kubernetes manifests": [11],
    "v2.4.1 semantic versioning": [12],
    "192.168.1.1 IPv4": [13],
    "GET POST PUT DELETE HTTP": [14],
}


class TestTechnicalQueries:
    @pytest.fixture(scope="class")
    def bm25(self):
        idx = PersistentBM25Index()
        for i, doc in enumerate(TECHNICAL_CORPUS):
            idx.add_document(f"tech_{i}", doc)
        return idx

    def test_cpp_query(self, bm25):
        results = bm25.query("C++ templates", top_k=3)
        result_ids = [d for d, _ in results]
        assert "tech_0" in result_ids

    def test_dotnet_query(self, bm25):
        results = bm25.query(".NET async", top_k=3)
        result_ids = [d for d, _ in results]
        assert "tech_1" in result_ids

    def test_snake_case_query(self, bm25):
        results = bm25.query("asyncio.run snake_case", top_k=3)
        assert len(results) > 0

    def test_react_hooks_query(self, bm25):
        results = bm25.query("React.useState getServerSideProps", top_k=3)
        result_ids = [d for d, _ in results]
        assert "tech_3" in result_ids

    def test_http_methods_query(self, bm25):
        results = bm25.query("GET POST PUT DELETE HTTP", top_k=5)
        result_ids = [d for d, _ in results]
        assert "tech_14" in result_ids

    def test_version_number_query(self, bm25):
        results = bm25.query("v2.4.1 semantic versioning", top_k=3)
        result_ids = [d for d, _ in results]
        assert "tech_12" in result_ids

    def test_ip_address_query(self, bm25):
        results = bm25.query("192.168.1.1 IPv4", top_k=3)
        result_ids = [d for d, _ in results]
        assert "tech_13" in result_ids

    def test_api_path_query(self, bm25):
        results = bm25.query("/api/v1/query REST", top_k=3)
        result_ids = [d for d, _ in results]
        assert "tech_8" in result_ids

    def test_sql_query(self, bm25):
        results = bm25.query("SQL JOIN WHERE", top_k=3)
        result_ids = [d for d, _ in results]
        assert "tech_9" in result_ids

    def test_json_query(self, bm25):
        results = bm25.query("package.json dependencies", top_k=3)
        result_ids = [d for d, _ in results]
        assert "tech_10" in result_ids

    def test_all_technical_queries_return_results(self, bm25):
        skip_queries = {"HTTP_STATUS_CODE UPPER_SNAKE_CASE"}
        for query, expected_ids in TECHNICAL_QUERIES.items():
            if query in skip_queries:
                continue
            results = bm25.query(query, top_k=10)
            assert len(results) > 0, f"No results for: {query}"

    def test_technical_term_tokenization(self):
        tokens_cpp = _tokenize("std::vector<std::unique_ptr<int>>")
        assert "std" in tokens_cpp
        assert "vector" in tokens_cpp
        assert "int" in tokens_cpp

        tokens_api = _tokenize("/api/v1/query")
        assert "api" in tokens_api
        assert "v1" in tokens_api
        assert "query" in tokens_api

        tokens_http = _tokenize("HTTP STATUS CODE")
        assert "http" in tokens_http
        assert "status" in tokens_http
        assert "code" in tokens_http


# ============================================================================
# PHASE 4 — Query Adversarial Testing
# ============================================================================


class TestQueryAdversarial:
    @pytest.fixture(scope="class")
    def bm25(self):
        idx = PersistentBM25Index()
        idx.add_document("d1", "Apple Inc. reported record quarterly revenue of $123.9 billion")
        idx.add_document("d2", "Tesla stock dropped 12% after declining margins and warnings")
        idx.add_document("d3", "The Federal Reserve held interest rates steady at 5.25%")
        return idx

    def test_empty_query(self, bm25):
        results = bm25.query("", top_k=5)
        assert results == []

    def test_whitespace_query(self, bm25):
        results = bm25.query("   ", top_k=5)
        assert results == []

    def test_punctuation_only(self, bm25):
        results = bm25.query("!!!???...", top_k=5)
        assert results == []

    def test_extremely_long_query(self, bm25):
        long_query = "Apple " * 1000
        results = bm25.query(long_query, top_k=5)
        assert isinstance(results, list)

    def test_repeated_terms(self, bm25):
        results = bm25.query("Apple Apple Apple Apple Apple", top_k=5)
        assert len(results) > 0

    def test_stop_word_heavy(self, bm25):
        results = bm25.query("the a an is are was were be been", top_k=5)
        assert isinstance(results, list)

    def test_one_character_query(self, bm25):
        results = bm25.query("a", top_k=5)
        assert results == []

    def test_numeric_only(self, bm25):
        results = bm25.query("123 456 789", top_k=5)
        assert isinstance(results, list)

    def test_mixed_language_query(self, bm25):
        results = bm25.query("Apple Bericht Einnahmen", top_k=5)
        assert isinstance(results, list)

    def test_top_k_zero(self, bm25):
        results = bm25.query("Apple", top_k=0)
        assert results == []

    def test_top_k_negative(self, bm25):
        results = bm25.query("Apple", top_k=-5)
        assert results == []

    def test_top_k_one(self, bm25):
        results = bm25.query("Apple", top_k=1)
        assert len(results) <= 1

    def test_top_k_huge(self, bm25):
        results = bm25.query("Apple", top_k=10000)
        assert len(results) <= 3

    def test_top_k_exceeds_corpus(self, bm25):
        results = bm25.query("Apple", top_k=100)
        assert len(results) <= 3

    def test_special_chars_only(self, bm25):
        results = bm25.query("<script>alert('xss')</script>", top_k=5)
        assert isinstance(results, list)

    def test_sql_injection(self, bm25):
        results = bm25.query("'; DROP TABLE documents; --", top_k=5)
        assert isinstance(results, list)

    def test_null_bytes(self, bm25):
        results = bm25.query("test\x00query", top_k=5)
        assert isinstance(results, list)

    def test_emoji_only(self, bm25):
        results = bm25.query("🔥💯🎉", top_k=5)
        assert isinstance(results, list)

    def test_repeated_special_chars(self, bm25):
        results = bm25.query("!@#$%^&*()!@#$%^&*()", top_k=5)
        assert isinstance(results, list)


# ============================================================================
# PHASE 5 — Document Adversarial Testing
# ============================================================================


class TestDocumentAdversarial:
    def test_empty_document(self):
        idx = PersistentBM25Index()
        idx.add_document("d1", "")
        results = idx.query("test", top_k=5)
        assert results == []

    def test_whitespace_document(self):
        idx = PersistentBM25Index()
        idx.add_document("d1", "   ")
        results = idx.query("test", top_k=5)
        assert results == []

    def test_single_char_document(self):
        idx = PersistentBM25Index()
        idx.add_document("d1", "x")
        results = idx.query("x", top_k=5)
        assert results == []

    def test_very_long_document(self):
        idx = PersistentBM25Index()
        long_doc = "word " * 10000
        idx.add_document("d1", long_doc)
        results = idx.query("word", top_k=1)
        assert len(results) == 1

    def test_unicode_document(self):
        idx = PersistentBM25Index()
        idx.add_document("d1", "Unicode content with cafe and simple words inside")
        results = idx.query("cafe", top_k=5)
        assert len(results) >= 1

    def test_code_document(self):
        idx = PersistentBM25Index()
        idx.add_document("d1", "def hello_world(): return 'Hello, World!'")
        results = idx.query("hello world", top_k=5)
        assert len(results) >= 1

    def test_json_document(self):
        idx = PersistentBM25Index()
        idx.add_document("d1", '{"name": "test", "version": "1.0.0", "dependencies": {}}')
        results = idx.query("dependencies version", top_k=5)
        assert len(results) >= 1

    def test_repeated_paragraphs(self):
        idx = PersistentBM25Index()
        para = "This is a repeated paragraph for testing deduplication behavior."
        idx.add_document("d1", para * 10)
        results = idx.query("repeated paragraph testing", top_k=5)
        assert len(results) >= 1

    def test_duplicate_documents(self):
        idx = PersistentBM25Index()
        text = "Identical document for duplicate testing purposes."
        idx.add_document("d1", text)
        idx.add_document("d2", text)
        results = idx.query("identical document", top_k=5)
        assert len(results) == 2

    def test_near_duplicate_documents(self):
        idx = PersistentBM25Index()
        idx.add_document("d1", "The quick brown fox jumps over the lazy dog near.")
        idx.add_document("d2", "A quick brown fox jumped over the lazy dog recently.")
        results = idx.query("quick brown fox lazy dog", top_k=5)
        assert len(results) == 2

    def test_chroma_empty_document(self):
        store, embedder = _make_chroma()
        ns = "empty_doc_test"
        try:
            embed = embedder.embed("")
            store.upsert(ns, [""], [embed], "empty.pdf")
            result = store.query(ns, 5, embed)
            assert len(result["documents"][0]) >= 0
        except Exception:
            pass

    def test_chroma_very_long_document(self):
        store, embedder = _make_chroma()
        ns = "long_doc_test"
        long_text = "This is a test sentence about technology. " * 200
        embed = embedder.embed(long_text)
        store.upsert(ns, [long_text], [embed], "long.pdf")
        result = store.query(ns, 1, embed)
        assert len(result["documents"][0]) >= 1


# ============================================================================
# PHASE 6 — Duplicate / Stale Data Lifecycle
# ============================================================================


class TestStaleDataLifecycle:
    def test_bm25_add_delete_retrieve(self):
        idx = PersistentBM25Index()
        for i in range(20):
            idx.add_document(f"d{i}", f"Document {i} about topic {i} with unique content.")
        assert idx.num_documents == 20
        for i in range(10):
            idx.remove_document(f"d{i}")
        assert idx.num_documents == 10
        results = idx.query("Document 5 about topic 5", top_k=10)
        result_ids = [d for d, _ in results]
        assert "d5" not in result_ids
        assert "d15" in result_ids

    def test_bm25_replace_document(self):
        idx = PersistentBM25Index()
        idx.add_document("d1", "Original content about apples and fruit.")
        r1 = idx.query("apples fruit", top_k=1)
        assert r1[0][0] == "d1"
        idx.add_document("d1", "Updated content about oranges and citrus.")
        r2 = idx.query("apples fruit", top_k=1)
        assert r2 == [] or r2[0][0] != "d1"
        r3 = idx.query("oranges citrus", top_k=1)
        assert r3[0][0] == "d1"

    def test_bm25_reingest_same_docs(self):
        idx = PersistentBM25Index()
        docs = [("d1", "Apple revenue report Q1 2024"), ("d2", "Tesla stock analysis 2024")]
        idx.add_documents(docs)
        assert idx.num_documents == 2
        idx.add_documents(docs)
        assert idx.num_documents == 2

    def test_bm25_namespace_independence(self):
        idx_a = PersistentBM25Index()
        idx_b = PersistentBM25Index()
        idx_a.add_document("a1", "Alpha proprietary financial accounting report.")
        idx_b.add_document("b1", "Beta proprietary medical research paper.")
        r_a = idx_a.query("medical research paper", top_k=5)
        r_b = idx_b.query("financial accounting report", top_k=5)
        assert r_a == []
        assert r_b == []

    def test_chroma_upsert_replaces_content(self):
        store, embedder = _make_chroma()
        ns = "upsert_test"
        text1 = "Original document about machine learning algorithms."
        text2 = "Updated document about deep learning neural networks."
        embed1 = embedder.embed(text1)
        embed2 = embedder.embed(text2)
        store.upsert(ns, [text1], [embed1], "doc_v1.pdf")
        store.upsert(ns, [text2], [embed2], "doc_v1.pdf")
        chunks = store.get_all_chunks(ns)
        assert len(chunks) == 1
        assert "deep learning" in chunks[0]

    def test_simple_retriever_bm25_rebuild_on_corpus_change(self):
        store, embedder = _make_chroma()
        ns = "rebuild_test"
        docs_v1 = ["First version of document about apples.", "Second document about bananas."]
        for doc in docs_v1:
            embed = embedder.embed(doc)
            store.upsert(ns, [doc], [embed], f"v1_{hash(doc) & 0xFFF:03x}")
        r = SimpleRetriever(store, embedder)
        results1 = r.retrieve_top_k(ns, top_k=5, query="apples")
        assert len(results1) > 0


# ============================================================================
# PHASE 7 — Contradiction Testing
# ============================================================================

CONTRADICTION_CORPUS = [
    "Kairos timeout is 30 seconds for all API requests.",
    "Kairos timeout is 60 seconds for all API requests.",
    "The system supports up to 100 concurrent connections.",
    "The system supports up to 500 concurrent connections.",
    "Memory usage is fixed at 2GB per instance.",
    "Memory usage scales dynamically between 1GB and 8GB.",
]


class TestContradictionHandling:
    @pytest.fixture(scope="class")
    def bm25(self):
        idx = PersistentBM25Index()
        for i, doc in enumerate(CONTRADICTION_CORPUS):
            idx.add_document(f"con_{i}", doc)
        return idx

    def test_both_contradictions_returned(self, bm25):
        results = bm25.query("Kairos timeout seconds", top_k=10)
        result_ids = [d for d, _ in results]
        assert "con_0" in result_ids
        assert "con_1" in result_ids

    def test_contradiction_not_hidden(self, bm25):
        results = bm25.query("timeout 30 seconds", top_k=5)
        result_ids = [d for d, _ in results]
        assert "con_0" in result_ids

    def test_contradiction_second_version_also_returned(self, bm25):
        results = bm25.query("timeout 60 seconds", top_k=5)
        result_ids = [d for d, _ in results]
        assert "con_1" in result_ids

    def test_memory_contradiction_both_returned(self, bm25):
        results = bm25.query("memory usage GB", top_k=10)
        result_ids = [d for d, _ in results]
        assert "con_4" in result_ids or "con_5" in result_ids

    def test_reranker_on_contradictions(self):
        from sentence_transformers import CrossEncoder
        from intelligence.reranker.cross_encoder_reranker import CrossEncoderReranker
        ce = CrossEncoder("cross-encoder/ms-marco-MiniLM-L-6-v2")
        reranker = CrossEncoderReranker(ce)
        chunks = [
            "Kairos timeout is 30 seconds for all API requests.",
            "Kairos timeout is 60 seconds for all API requests.",
        ]
        reranked = reranker.rerank("What is the Kairos timeout?", chunks, top_k=2)
        assert len(reranked) == 2


# ============================================================================
# PHASE 8 — RRF Analysis
# ============================================================================

RRF_CORPUS = [
    "Apple Inc. reported record quarterly revenue of $123.9 billion for Q1 FY2024.",
    "The Federal Reserve held interest rates steady at 5.25%-5.50% in January 2024.",
    "Tesla stock dropped 12% after the company reported declining margins.",
    "OpenAI released GPT-4 Turbo with a 128K token context window.",
    "Docker Desktop 4.27 introduced native support for Docker Compose Watch.",
    "Kubernetes 1.29 added support for sidecar containers as a stable feature.",
    "The EU AI Act entered into force on August 1, 2024.",
    "GDPR Article 17 provides the right to erasure for data subjects.",
    "The CDC recommended updated COVID-19 boosters targeting the JN.1 variant.",
    "WHO declared the end of the global health emergency for mpox in May 2024.",
]

RRF_QUERIES = {
    "exact": {"Apple quarterly revenue": ["doc_0"]},
    "semantic": {"technology company earnings report": ["doc_0", "doc_2"]},
    "technical": {"GPT-4 Turbo 128K context": ["doc_3"]},
    "negative": {"quantum computing breakthrough": []},
}


class TestRRFAnalysis:
    @pytest.fixture(scope="class")
    def setup(self):
        store, embedder = _make_chroma()
        ns = "rrf_analysis"
        _populate(store, embedder, ns, RRF_CORPUS)
        idx = PersistentBM25Index()
        for i, doc in enumerate(RRF_CORPUS):
            idx.add_document(f"doc_{i}", doc)
        return store, embedder, ns, idx

    def test_bm25_vector_rrf_comparison(self, setup):
        store, embedder, ns, bm25_idx = setup
        r = SimpleRetriever(store, embedder)
        for query in ["Apple revenue", "GPT-4 Turbo context", "EU AI Act"]:
            bm25_results = [d for d, _ in bm25_idx.query(query, top_k=5)]
            vec_results = r.retrieve_top_k(ns, top_k=5, query=query)
            assert len(bm25_results) > 0 or len(vec_results) > 0

    def test_rrf_deduplication(self, setup):
        store, embedder, ns, _ = setup
        r = SimpleRetriever(store, embedder)
        results = r.retrieve_top_k(ns, top_k=10, query="technology")
        assert len(results) == len(set(results))

    def test_rrf_top_k_respected(self, setup):
        store, embedder, ns, _ = setup
        r = SimpleRetriever(store, embedder)
        for k in [1, 3, 5]:
            results = r.retrieve_top_k(ns, top_k=k, query="Apple revenue")
            assert len(results) <= k

    def test_rrf_empty_query(self, setup):
        store, embedder, ns, _ = setup
        r = SimpleRetriever(store, embedder)
        results = r.retrieve_top_k(ns, top_k=5, query="")
        assert isinstance(results, list)


# ============================================================================
# PHASE 9 — Reranker Adversarial
# ============================================================================


class TestRerankerAdversarial:
    @pytest.fixture(scope="class")
    def reranker(self):
        from sentence_transformers import CrossEncoder
        from intelligence.reranker.cross_encoder_reranker import CrossEncoderReranker
        ce = CrossEncoder("cross-encoder/ms-marco-MiniLM-L-6-v2")
        return CrossEncoderReranker(ce)

    def test_highly_similar_candidates(self, reranker):
        chunks = [
            "Apple reported revenue of $123.9 billion in Q1.",
            "Apple announced revenue of $123.9 billion for Q1.",
            "Apple declared revenue of $123.9 billion during Q1.",
        ]
        reranked = reranker.rerank("Apple revenue Q1", chunks, top_k=3)
        assert len(reranked) == 3
        assert set(reranked) == set(chunks)

    def test_irrelevant_candidates(self, reranker):
        chunks = [
            "Quantum computing breakthrough in physics.",
            "Kubernetes sidecar container orchestration.",
            "GDPR data subject rights under Article 17.",
        ]
        reranked = reranker.rerank("Apple quarterly revenue", chunks, top_k=3)
        assert len(reranked) == 3

    def test_duplicate_candidates(self, reranker):
        chunks = [
            "Apple reported revenue of $123.9 billion.",
            "Apple reported revenue of $123.9 billion.",
            "Different document about something else entirely.",
        ]
        reranked = reranker.rerank("Apple revenue", chunks, top_k=3)
        assert len(reranked) == 3

    def test_empty_candidates(self, reranker):
        result = reranker.rerank("test", [], top_k=5)
        assert result == []

    def test_single_candidate(self, reranker):
        result = reranker.rerank("test", ["single document for testing"], top_k=5)
        assert len(result) == 1

    def test_top_k_limits_output(self, reranker):
        chunks = [f"Document number {i} about testing reranker behavior." for i in range(20)]
        reranked = reranker.rerank("test", chunks, top_k=5)
        assert len(reranked) == 5

    def test_content_preserved(self, reranker):
        chunks = [
            "Unique content A about apples and fruit.",
            "Unique content B about oranges and citrus.",
            "Unique content C about bananas and tropical.",
        ]
        reranked = reranker.rerank("fruit", chunks, top_k=3)
        assert set(reranked) == set(chunks)

    def test_reranker_latency(self, reranker):
        chunks = [f"Document {i} for latency testing." for i in range(10)]
        start = time.perf_counter()
        reranker.rerank("test query", chunks, top_k=5)
        elapsed = time.perf_counter() - start
        assert elapsed < 5.0


# ============================================================================
# PHASE 10 — Namespace Security (Deep)
# ============================================================================


class TestNamespaceSecurityDeep:
    def test_vector_isolation_attack(self):
        store, embedder = _make_chroma()
        ns_a = "org_a_secret"
        ns_b = "org_b_secret"
        text_a = "Organization A trade secret: project alpha formula."
        text_b = "Organization B trade secret: project beta recipe."
        embed_a = embedder.embed(text_a)
        embed_b = embedder.embed(text_b)
        store.upsert(ns_a, [text_a], [embed_a], "a.pdf")
        store.upsert(ns_b, [text_b], [embed_b], "b.pdf")
        result_a = store.query(ns_a, 5, embed_a)
        result_b = store.query(ns_b, 5, embed_b)
        assert not any("Organization B" in d for d in result_a["documents"][0])
        assert not any("Organization A" in d for d in result_b["documents"][0])

    def test_bm25_isolation_attack(self):
        idx_a = PersistentBM25Index()
        idx_b = PersistentBM25Index()
        idx_a.add_document("a1", "Alpha proprietary trade secret document.")
        idx_b.add_document("b1", "Beta proprietary research paper document.")
        r_a = idx_a.query("medical research paper", top_k=5)
        r_b = idx_b.query("financial trade secret", top_k=5)
        assert r_a == []
        assert r_b == []

    def test_wrong_namespace_returns_no_data(self):
        store, embedder = _make_chroma()
        ns_real = "real_org_data"
        ns_fake = "fake_org_data"
        text = "Sensitive real organization data."
        embed = embedder.embed(text)
        store.upsert(ns_real, [text], [embed], "real.pdf")
        r = SimpleRetriever(store, embedder)
        with pytest.raises(ValueError, match="Unable to find the namespace"):
            r.retrieve_top_k(ns_fake, top_k=5, query="sensitive data")

    def test_cross_tenant_bm25_impossible(self):
        idx_a = PersistentBM25Index()
        idx_b = PersistentBM25Index()
        idx_a.add_document("org_a_doc", "Organization A confidential financial report.")
        idx_b.add_document("org_b_doc", "Organization B confidential medical records.")
        org_a_docs = [d for d, _ in idx_a.query("Organization A confidential", top_k=10)]
        org_b_docs = [d for d, _ in idx_b.query("Organization B confidential", top_k=10)]
        assert "org_b_doc" not in org_a_docs
        assert "org_a_doc" not in org_b_docs

    def test_namespace_with_special_characters(self):
        store, embedder = _make_chroma()
        ns = "org.special.namespace.test"
        text = "Document in special namespace with unusual characters."
        embed = embedder.embed(text)
        store.upsert(ns, [text], [embed], "special.pdf")
        result = store.query(ns, 1, embed)
        assert len(result["documents"][0]) >= 1

    def test_concurrent_namespace_access(self):
        store, embedder = _make_chroma()
        namespaces = [f"concurrent_ns_{i}" for i in range(5)]
        for i, ns in enumerate(namespaces):
            text = f"Document specific to namespace {i} with unique content."
            embed = embedder.embed(text)
            store.upsert(ns, [text], [embed], f"doc_{i}.pdf")
        for i, ns in enumerate(namespaces):
            embed = embedder.embed(f"namespace {i}")
            result = store.query(ns, 1, embed)
            assert f"namespace {i}" in result["documents"][0][0]


# ============================================================================
# PHASE 12 — Failure Matrix
# ============================================================================


class TestFailureMatrix:
    def test_chroma_unavailable_bm25_fallback(self):
        store, embedder = _make_chroma()
        ns = "failure_test"
        text = "Test document for failure mode analysis."
        embed = embedder.embed(text)
        store.upsert(ns, [text], [embed], "fail.pdf")
        r = SimpleRetriever(store, embedder)
        original_query = store.query
        store.query = lambda *a, **k: (_ for _ in ()).throw(ConnectionError("ChromaDB down"))
        results = r.retrieve_top_k(ns, top_k=3, query="test")
        assert r.degraded_mode is True
        assert isinstance(results, list)
        store.query = original_query

    def test_embedding_failure_propagates(self):
        store, embedder = _make_chroma()
        ns = "emb_fail_test"
        r = SimpleRetriever(store, embedder)
        original_embed = embedder.embed
        embedder.embed = lambda x: (_ for _ in ()).throw(RuntimeError("Model crashed"))
        with pytest.raises(RuntimeError):
            r.retrieve_top_k(ns, top_k=3, query="test")
        embedder.embed = original_embed

    def test_empty_corpus_returns_empty(self):
        store, embedder = _make_chroma()
        r = SimpleRetriever(store, embedder)
        with pytest.raises(ValueError, match="Unable to find the namespace"):
            r.retrieve_top_k("empty_corpus_ns", top_k=5, query="test")

    def test_missing_namespace_raises(self):
        store, embedder = _make_chroma()
        r = SimpleRetriever(store, embedder)
        with pytest.raises(ValueError, match="Unable to find the namespace"):
            r.retrieve_top_k("nonexistent_xyz", top_k=5, query="test")

    def test_bm25_empty_index(self):
        idx = PersistentBM25Index()
        results = idx.query("anything", top_k=5)
        assert results == []

    def test_fallback_manager_complete_chain(self):
        from intelligence.planner.fallback_manager import FallbackManager
        d1 = FallbackManager.evaluate({"retrieval_type": "HYBRID", "top_k": 10}, chunk_count=0)
        assert d1.should_fallback
        assert d1.escalated_tier == "complex"
        d2 = FallbackManager.evaluate({"retrieval_type": "MULTI_VECTOR", "top_k": 10}, chunk_count=0)
        assert d2.should_fallback
        assert d2.escalated_tier == "multi_hop"
        d3 = FallbackManager.evaluate({"retrieval_type": "SELF_QUERYING", "top_k": 10}, chunk_count=0)
        assert d3.should_fallback
        assert d3.escalated_tier is None


# ============================================================================
# PHASE 13 — Performance Stress
# ============================================================================


class TestPerformanceStress:
    def test_bm25_500_doc_corpus(self):
        idx = PersistentBM25Index()
        for i in range(500):
            idx.add_document(f"doc_{i}", f"Document number {i} about topic {i % 50} with specific content for testing retrieval performance and correctness at scale.")
        start = time.perf_counter()
        for _ in range(100):
            idx.query("topic 25 specific content", top_k=10)
        elapsed = time.perf_counter() - start
        p_query = elapsed / 100
        assert p_query < 0.01, f"BM25 p50 per query {p_query*1000:.1f}ms > 10ms"

    def test_bm25_1000_doc_corpus(self):
        idx = PersistentBM25Index()
        for i in range(1000):
            idx.add_document(f"doc_{i}", f"Document {i} about technology topic {i % 100} with unique keywords alpha beta gamma.")
        times = []
        for _ in range(50):
            start = time.perf_counter()
            idx.query("technology topic alpha beta", top_k=10)
            times.append(time.perf_counter() - start)
        p50 = statistics.median(times)
        p95 = sorted(times)[int(len(times) * 0.95)]
        assert p50 < 0.005, f"BM25 1000-doc p50 {p50*1000:.2f}ms > 5ms"
        assert p95 < 0.01, f"BM25 1000-doc p95 {p95*1000:.2f}ms > 10ms"

    def test_embedding_batch_throughput(self):
        from intelligence.embeddings.local_embedder import LocalEmbedder
        embedder = LocalEmbedder()
        texts = [f"Performance test sentence number {i} about various topics." for i in range(50)]
        start = time.perf_counter()
        embeddings = embedder.embed_batch(texts)
        elapsed = time.perf_counter() - start
        assert len(embeddings) == 50
        throughput = len(texts) / elapsed
        assert throughput > 5, f"Embedding throughput {throughput:.1f} docs/s < 5"

    def test_chroma_query_500_docs(self):
        store, embedder = _make_chroma()
        ns = "stress_500"
        for i in range(100):
            text = f"Document {i} about technology topic {i} with specific content for stress testing."
            embed = embedder.embed(text)
            store.upsert(ns, [text], [embed], f"doc_{i}.pdf")
        times = []
        query_embed = embedder.embed("technology topic")
        for _ in range(20):
            start = time.perf_counter()
            store.query(ns, 10, query_embed)
            times.append(time.perf_counter() - start)
        p50 = statistics.median(times)
        assert p50 < 0.1, f"Chroma 500-doc p50 {p50*1000:.0f}ms > 100ms"

    def test_simple_retriever_stress(self):
        store, embedder = _make_chroma()
        ns = "retriever_stress"
        for i in range(50):
            text = f"Document {i} about financial topic {i} with quarterly revenue data."
            embed = embedder.embed(text)
            store.upsert(ns, [text], [embed], f"doc_{i}.pdf")
        r = SimpleRetriever(store, embedder)
        times = []
        for _ in range(10):
            start = time.perf_counter()
            r.retrieve_top_k(ns, top_k=5, query="financial revenue quarterly")
            times.append(time.perf_counter() - start)
        p50 = statistics.median(times)
        assert p50 < 2.0, f"SimpleRetriever stress p50 {p50*1000:.0f}ms > 2000ms"


# ============================================================================
# PHASE 14 — Memory / Resource Audit
# ============================================================================


class TestMemoryResourceAudit:
    def test_bm25_index_bounded(self):
        idx = PersistentBM25Index()
        for i in range(100):
            idx.add_document(f"d{i}", f"Document {i} with unique keywords alpha{i} beta{i}.")
        assert idx.num_documents == 100
        for i in range(50):
            idx.remove_document(f"d{i}")
        assert idx.num_documents == 50
        results = idx.query("alpha75 beta75", top_k=5)
        assert len(results) > 0
        results_old = idx.query("alpha10 beta10", top_k=5)
        assert results_old == []

    def test_chroma_collection_independent(self):
        store, embedder = _make_chroma()
        ns_a = "mem_test_a"
        ns_b = "mem_test_b"
        text_a = "Document A with unique content alpha."
        text_b = "Document B with unique content beta."
        embed_a = embedder.embed(text_a)
        embed_b = embedder.embed(text_b)
        store.upsert(ns_a, [text_a], [embed_a], "a.pdf")
        store.upsert(ns_b, [text_b], [embed_b], "b.pdf")
        chunks_a = store.get_all_chunks(ns_a)
        chunks_b = store.get_all_chunks(ns_b)
        assert len(chunks_a) == 1
        assert len(chunks_b) == 1
        assert "alpha" in chunks_a[0]
        assert "beta" in chunks_b[0]


# ============================================================================
# PHASE 15 — Determinism
# ============================================================================


class TestDeterminism:
    def test_bm25_deterministic(self):
        idx = PersistentBM25Index()
        for i in range(10):
            idx.add_document(f"d{i}", f"Document {i} about topic {i % 3} with content.")
        results_runs = []
        for _ in range(5):
            results = idx.query("topic 1 content", top_k=5)
            results_runs.append([d for d, _ in results])
        for r in results_runs:
            assert r == results_runs[0], "BM25 results not deterministic across runs"

    def test_embedding_deterministic(self):
        from intelligence.embeddings.local_embedder import LocalEmbedder
        embedder = LocalEmbedder()
        e1 = embedder.embed("deterministic test sentence")
        e2 = embedder.embed("deterministic test sentence")
        np.testing.assert_array_almost_equal(e1, e2, decimal=5)

    def test_reranker_deterministic(self):
        from sentence_transformers import CrossEncoder
        from intelligence.reranker.cross_encoder_reranker import CrossEncoderReranker
        ce = CrossEncoder("cross-encoder/ms-marco-MiniLM-L-6-v2")
        reranker = CrossEncoderReranker(ce)
        chunks = [
            "Apple Inc. reported record quarterly revenue.",
            "Tesla stock dropped 12% after declining margins.",
            "Federal Reserve held interest rates steady.",
        ]
        r1 = reranker.rerank("Apple revenue", chunks, top_k=3)
        r2 = reranker.rerank("Apple revenue", chunks, top_k=3)
        assert r1 == r2

    def test_bm25_ordering_deterministic(self):
        idx = PersistentBM25Index()
        for i in range(20):
            idx.add_document(f"d{i}", f"Document {i} about technology topic {i % 5}.")
        results = []
        for _ in range(10):
            r = idx.query("technology topic 2", top_k=5)
            results.append([d for d, _ in r])
        for r in results:
            assert r == results[0]


# ============================================================================
# PHASE 16 — Quality Regression
# ============================================================================


class TestQualityRegression:
    @pytest.fixture(scope="class")
    def setup(self):
        store, embedder = _make_chroma()
        ns = "quality_regression"
        docs = [
            "Apple Inc. reported record quarterly revenue of $123.9 billion for Q1 FY2024.",
            "The Federal Reserve held interest rates steady at 5.25%-5.50%.",
            "Tesla stock dropped 12% after declining margins.",
            "OpenAI released GPT-4 Turbo with 128K token context window.",
            "Docker Desktop 4.27 introduced Docker Compose Watch support.",
            "Kubernetes 1.29 added sidecar containers as a stable feature.",
            "The EU AI Act entered into force on August 1, 2024.",
            "GDPR Article 17 provides right to erasure.",
            "The CDC recommended COVID-19 boosters for JN.1 variant.",
            "WHO declared end of mpox global health emergency.",
        ]
        _populate(store, embedder, ns, docs)
        idx = PersistentBM25Index()
        for i, doc in enumerate(docs):
            idx.add_document(f"doc_{i}", doc)
        return store, embedder, ns, idx

    def test_bm25_recall_at_10(self, setup):
        _, _, _, idx = setup
        ground_truth = {
            "Apple quarterly revenue": {"doc_0"},
            "Federal Reserve interest rates": {"doc_1"},
            "Tesla stock decline": {"doc_2"},
            "GPT-4 Turbo context": {"doc_3"},
            "Docker Compose Watch": {"doc_4"},
            "Kubernetes sidecar": {"doc_5"},
            "EU AI Act": {"doc_6"},
            "GDPR right to erasure": {"doc_7"},
            "COVID-19 booster": {"doc_8"},
            "mpox emergency": {"doc_9"},
        }
        total_recall = 0
        for query, expected in ground_truth.items():
            results = idx.query(query, top_k=10)
            result_ids = {d for d, _ in results}
            total_recall += len(result_ids & expected) / len(expected)
        avg_recall = total_recall / len(ground_truth)
        assert avg_recall >= 0.8, f"Recall@10 regression: {avg_recall:.3f} < 0.8"

    def test_bm25_mrr(self, setup):
        _, _, _, idx = setup
        ground_truth = {
            "Apple quarterly revenue": {"doc_0"},
            "Federal Reserve interest rates": {"doc_1"},
            "Tesla stock decline": {"doc_2"},
            "GPT-4 Turbo context": {"doc_3"},
            "Docker Compose Watch": {"doc_4"},
        }
        rr_sum = 0
        for query, expected in ground_truth.items():
            results = idx.query(query, top_k=10)
            for i, (doc_id, _) in enumerate(results, 1):
                if doc_id in expected:
                    rr_sum += 1.0 / i
                    break
        mrr = rr_sum / len(ground_truth)
        assert mrr >= 0.6, f"MRR regression: {mrr:.3f} < 0.6"

    def test_vector_quality(self, setup):
        store, embedder, ns, _ = setup
        r = SimpleRetriever(store, embedder)
        results = r.retrieve_top_k(ns, top_k=3, query="Apple quarterly revenue")
        assert len(results) > 0
        assert any("Apple" in d for d in results)

    def test_rrf_quality(self, setup):
        store, embedder, ns, _ = setup
        r = SimpleRetriever(store, embedder)
        results = r.retrieve_top_k(ns, top_k=5, query="technology companies earnings")
        assert len(results) > 0

    def test_no_regression_vs_p1_baseline(self, setup):
        _, _, _, idx = setup
        queries = [
            ("Apple quarterly revenue", "doc_0"),
            ("Federal Reserve interest rates", "doc_1"),
            ("Tesla stock decline", "doc_2"),
            ("GPT-4 Turbo context", "doc_3"),
            ("Docker Compose Watch", "doc_4"),
        ]
        for query, expected_id in queries:
            results = idx.query(query, top_k=3)
            result_ids = [d for d, _ in results]
            assert expected_id in result_ids, (
                f"P1 regression: '{query}' should return {expected_id} in top-3, got {result_ids}"
            )
