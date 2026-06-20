"""Integration tests for RetrievalPlanner in the production gRPC path.

Covers:
- ClassifyQueryType invokes planner.plan() instead of direct classify+get_config
- Response includes confidence_score from the planner
- Planner produces correct config for simple / complex / multi_hop queries
- Error handling: planner error returns empty response with INTERNAL status
- Backward compatibility: query_type and config fields still present in response
"""

from __future__ import annotations

import sys
from pathlib import Path
from typing import Any
from unittest.mock import MagicMock

import pytest

_root = Path(__file__).resolve().parent.parent
_generated = _root / "generated" / "python"
_intelligence = _root / "intelligence"

for p in [_root, _intelligence, _generated]:
    if str(p) not in sys.path:
        sys.path.insert(0, str(p))

import rag_pb2
import grpc

from intelligence.classifier.query_classifier import ResponseSchema
from intelligence.server.engine import RetrievalEngine
from intelligence.server.grpc_server import IntelligenceServiceServicer


# ======================================================================
# Fixtures
# ======================================================================


@pytest.fixture
def mock_classifier() -> MagicMock:
    classifier = MagicMock()
    classifier.classify_with_confidence.return_value = ResponseSchema(
        query_type="simple",
        domain=None,
        confidence_score=0.95,
    )
    return classifier


@pytest.fixture
def mock_retriever() -> MagicMock:
    return MagicMock()


@pytest.fixture
def servicer(
    mock_classifier: MagicMock,
    mock_retriever: MagicMock,
) -> IntelligenceServiceServicer:
    engine = RetrievalEngine(
        pipeline=MagicMock(),
        classifier=mock_classifier,
        simple_retriever=mock_retriever,
        complex_retriever=mock_retriever,
        multi_hop_retriever=mock_retriever,
        embedder=MagicMock(),
        llm_client=MagicMock(),
    )
    return IntelligenceServiceServicer(engine=engine)


@pytest.fixture
def mock_context() -> MagicMock:
    ctx = MagicMock()
    ctx.set_code = MagicMock()
    ctx.set_details = MagicMock()
    return ctx


# ======================================================================
# Planner integration
# ======================================================================


class TestPlannerIntegration:
    """RetrievalPlanner is used in the production ClassifyQueryType path."""

    def test_invokes_planner_plan(self, servicer, mock_context) -> None:
        request = rag_pb2.ClassifyQueryRequest(user_query="hello", namespace="test")
        with pytest.MonkeyPatch.context() as mp:
            spy = MagicMock(wraps=servicer._engine.planner.plan)
            mp.setattr(servicer._engine.planner, "plan", spy)
            servicer.ClassifyQueryType(request, mock_context)
            spy.assert_called_once_with("hello")

    def test_invokes_classify_with_confidence(
        self, servicer, mock_classifier, mock_context
    ) -> None:
        request = rag_pb2.ClassifyQueryRequest(user_query="test query", namespace="ns")
        servicer.ClassifyQueryType(request, mock_context)
        mock_classifier.classify_with_confidence.assert_called_once_with("test query")

    def test_response_includes_confidence_score(
        self, servicer, mock_classifier, mock_context
    ) -> None:
        mock_classifier.classify_with_confidence.return_value = ResponseSchema(
            query_type="complex", domain="law", confidence_score=0.72
        )
        request = rag_pb2.ClassifyQueryRequest(user_query="legal query", namespace="ns")
        response = servicer.ClassifyQueryType(request, mock_context)
        assert response.confidence_score == pytest.approx(0.72)

    def test_response_includes_query_type(
        self, servicer, mock_classifier, mock_context
    ) -> None:
        mock_classifier.classify_with_confidence.return_value = ResponseSchema(
            query_type="complex", domain="law", confidence_score=0.72
        )
        request = rag_pb2.ClassifyQueryRequest(user_query="legal query", namespace="ns")
        response = servicer.ClassifyQueryType(request, mock_context)
        assert response.query_type == rag_pb2.QueryType.COMPLEX

    def test_response_includes_config(
        self, servicer, mock_classifier, mock_context
    ) -> None:
        mock_classifier.classify_with_confidence.return_value = ResponseSchema(
            query_type="complex", domain="law", confidence_score=0.72
        )
        request = rag_pb2.ClassifyQueryRequest(user_query="legal query", namespace="ns")
        response = servicer.ClassifyQueryType(request, mock_context)
        assert response.config.retrieval_type == rag_pb2.RetrievalType.MULTI_VECTOR
        assert response.config.top_k == 10
        assert response.config.rerank is True
        assert response.config.decompose is False

    def test_simple_query_config(
        self, servicer, mock_classifier, mock_context
    ) -> None:
        mock_classifier.classify_with_confidence.return_value = ResponseSchema(
            query_type="simple", domain=None, confidence_score=0.92
        )
        request = rag_pb2.ClassifyQueryRequest(user_query="simple q", namespace="ns")
        response = servicer.ClassifyQueryType(request, mock_context)
        assert response.config.retrieval_type == rag_pb2.RetrievalType.RETRIEVAL_TYPE_UNSPECIFIED
        assert response.config.top_k == 3
        assert response.config.rerank is False
        assert response.config.decompose is False

    def test_simple_query_with_domain_uses_hybrid(
        self, servicer, mock_classifier, mock_context
    ) -> None:
        mock_classifier.classify_with_confidence.return_value = ResponseSchema(
            query_type="simple", domain="finance", confidence_score=0.85
        )
        request = rag_pb2.ClassifyQueryRequest(user_query="stocks", namespace="ns")
        response = servicer.ClassifyQueryType(request, mock_context)
        assert response.config.retrieval_type == rag_pb2.RetrievalType.HYBRID

    def test_multihop_query_config(
        self, servicer, mock_classifier, mock_context
    ) -> None:
        mock_classifier.classify_with_confidence.return_value = ResponseSchema(
            query_type="multi_hop", domain=None, confidence_score=0.78
        )
        request = rag_pb2.ClassifyQueryRequest(user_query="multi hop q", namespace="ns")
        response = servicer.ClassifyQueryType(request, mock_context)
        assert response.config.retrieval_type == rag_pb2.RetrievalType.SELF_QUERYING
        assert response.config.top_k == 5
        assert response.config.rerank is True
        assert response.config.decompose is True


# ======================================================================
# Confidence-aware budget overrides
# ======================================================================


class TestConfidenceBudgetOverrides:
    """Low confidence queries receive budget overrides via the planner."""

    def test_low_confidence_increases_top_k(
        self, servicer, mock_classifier, mock_context
    ) -> None:
        mock_classifier.classify_with_confidence.return_value = ResponseSchema(
            query_type="simple", domain=None, confidence_score=0.25
        )
        request = rag_pb2.ClassifyQueryRequest(user_query="vague", namespace="ns")
        response = servicer.ClassifyQueryType(request, mock_context)
        assert response.config.top_k > 3


# ======================================================================
# Error handling
# ======================================================================


class TestErrorHandling:
    """Planner errors result in INTERNAL status and empty response."""

    def test_planner_error_returns_empty_response(
        self, servicer, mock_context
    ) -> None:
        servicer._engine.planner.plan = MagicMock(side_effect=ValueError("planner failed"))
        request = rag_pb2.ClassifyQueryRequest(user_query="fail", namespace="ns")
        response = servicer.ClassifyQueryType(request, mock_context)
        mock_context.set_code.assert_called_once_with(grpc.StatusCode.INTERNAL)
        assert response.query_type == rag_pb2.QueryType.QUERY_TYPE_UNSPECIFIED


# ======================================================================
# Backward compatibility
# ======================================================================


class TestBackwardCompatibility:
    """The response shape is unchanged for existing consumers."""

    def test_response_has_query_type_and_config(
        self, servicer, mock_context
    ) -> None:
        request = rag_pb2.ClassifyQueryRequest(user_query="hello", namespace="ns")
        response = servicer.ClassifyQueryType(request, mock_context)
        assert response.HasField("config")
        assert response.query_type >= 0
        assert response.config.top_k > 0

    def test_confidence_score_defaults_to_zero_for_old_servers(self) -> None:
        response = rag_pb2.ClassifyQueryResponse()
        assert response.confidence_score == 0.0


# ======================================================================
# ExecuteRetrieval — adaptive execution
# ======================================================================


def _make_engine(simple=None, complex=None, multi_hop=None,
                 classifier=None, embedder=None, llm_client=None,
                 pipeline=None) -> RetrievalEngine:
    return RetrievalEngine(
        pipeline=pipeline or MagicMock(),
        classifier=classifier or MagicMock(),
        simple_retriever=simple or MagicMock(),
        complex_retriever=complex or MagicMock(),
        multi_hop_retriever=multi_hop or MagicMock(),
        embedder=embedder or MagicMock(),
        llm_client=llm_client or MagicMock(),
    )


def _make_servicer(simple=None, complex=None, multi_hop=None,
                   classifier=None, embedder=None, llm_client=None,
                   pipeline=None) -> IntelligenceServiceServicer:
    engine = _make_engine(
        simple=simple, complex=complex, multi_hop=multi_hop,
        classifier=classifier, embedder=embedder,
        llm_client=llm_client, pipeline=pipeline,
    )
    return IntelligenceServiceServicer(engine=engine)


def _make_retrieval_config(
    retrieval_type: int, top_k: int = 3, rerank: bool = False, decompose: bool = False,
) -> rag_pb2.RetrievalConfig:
    return rag_pb2.RetrievalConfig(
        retrieval_type=retrieval_type, top_k=top_k,
        rerank=rerank, decompose=decompose,
    )


class TestExecuteRetrieval:
    """ExecuteRetrieval wires planner outputs into actual retrieval."""

    def test_honours_top_k_from_config(self) -> None:
        simple = MagicMock()
        simple.retrieve_top_k.return_value = ["a", "b", "c"]
        servicer = _make_servicer(simple=simple)
        request = rag_pb2.ExecuteRetrievalRequest(
            user_query="test",
            received_config=_make_retrieval_config(
                rag_pb2.RetrievalType.HYBRID, top_k=7,
            ),
            namespace="ns",
        )
        response = servicer.ExecuteRetrieval(request, MagicMock())
        assert response.retrieval_status is True
        simple.retrieve_top_k.assert_called_once()
        _ns, _top_k, _query = simple.retrieve_top_k.call_args[0]
        assert _top_k == 7

    def test_selects_simple_retriever(self) -> None:
        simple = MagicMock()
        simple.retrieve_top_k.return_value = ["x"]
        servicer = _make_servicer(simple=simple)
        request = rag_pb2.ExecuteRetrievalRequest(
            user_query="q",
            received_config=_make_retrieval_config(rag_pb2.RetrievalType.HYBRID),
            namespace="ns",
        )
        servicer.ExecuteRetrieval(request, MagicMock())
        simple.retrieve_top_k.assert_called_once()

    def test_selects_complex_retriever(self) -> None:
        complex = MagicMock()
        complex.retrieve_top_k.return_value = ["x"]
        servicer = _make_servicer(complex=complex)
        request = rag_pb2.ExecuteRetrievalRequest(
            user_query="q",
            received_config=_make_retrieval_config(rag_pb2.RetrievalType.MULTI_VECTOR),
            namespace="ns",
        )
        servicer.ExecuteRetrieval(request, MagicMock())
        complex.retrieve_top_k.assert_called_once()

    def test_selects_multihop_retriever(self) -> None:
        mh = MagicMock()
        mh.retrieve_top_k.return_value = ["x"]
        servicer = _make_servicer(multi_hop=mh)
        request = rag_pb2.ExecuteRetrievalRequest(
            user_query="q",
            received_config=_make_retrieval_config(rag_pb2.RetrievalType.SELF_QUERYING),
            namespace="ns",
        )
        servicer.ExecuteRetrieval(request, MagicMock())
        mh.retrieve_top_k.assert_called_once()

    def test_extracts_rerank_and_decompose(self) -> None:
        simple = MagicMock()
        simple.retrieve_top_k.return_value = ["x"]
        servicer = _make_servicer(simple=simple)
        cfg = _make_retrieval_config(
            rag_pb2.RetrievalType.HYBRID, rerank=True, decompose=True,
        )
        request = rag_pb2.ExecuteRetrievalRequest(
            user_query="q", received_config=cfg, namespace="ns",
        )
        response = servicer.ExecuteRetrieval(request, MagicMock())
        assert cfg.rerank is True
        assert cfg.decompose is True
        assert response.retrieval_status is True


# ======================================================================
# Fallback execution
# ======================================================================


class TestExecuteRetrievalFallback:
    """Fallback escalates to the next tier when chunks are insufficient."""

    def test_sufficient_chunks_no_fallback(self) -> None:
        simple = MagicMock()
        simple.retrieve_top_k.return_value = ["a", "b", "c"]
        complex = MagicMock()
        servicer = _make_servicer(simple=simple, complex=complex)
        request = rag_pb2.ExecuteRetrievalRequest(
            user_query="q",
            received_config=_make_retrieval_config(
                rag_pb2.RetrievalType.HYBRID, top_k=4,
            ),
            namespace="ns",
        )
        response = servicer.ExecuteRetrieval(request, MagicMock())
        assert response.retrieval_status is True
        assert len(response.retrieved_chunk) == 3
        complex.retrieve_top_k.assert_not_called()

    def test_insufficient_chunks_triggers_fallback(self) -> None:
        simple = MagicMock()
        simple.retrieve_top_k.return_value = []
        complex = MagicMock()
        complex.retrieve_top_k.return_value = ["d", "e", "f"]
        servicer = _make_servicer(simple=simple, complex=complex)
        request = rag_pb2.ExecuteRetrievalRequest(
            user_query="q",
            received_config=_make_retrieval_config(
                rag_pb2.RetrievalType.HYBRID, top_k=4,
            ),
            namespace="ns",
        )
        response = servicer.ExecuteRetrieval(request, MagicMock())
        assert response.retrieval_status is True
        assert len(response.retrieved_chunk) == 3
        complex.retrieve_top_k.assert_called_once()

    def test_fallback_deduplicates_chunks(self) -> None:
        simple = MagicMock()
        simple.retrieve_top_k.return_value = ["a"]
        complex = MagicMock()
        complex.retrieve_top_k.return_value = ["b", "c", "d"]
        servicer = _make_servicer(simple=simple, complex=complex)
        request = rag_pb2.ExecuteRetrievalRequest(
            user_query="q",
            received_config=_make_retrieval_config(
                rag_pb2.RetrievalType.HYBRID, top_k=4,
            ),
            namespace="ns",
        )
        response = servicer.ExecuteRetrieval(request, MagicMock())
        texts = [c.text for c in response.retrieved_chunk]
        assert texts == ["a", "b", "c", "d"]

    def test_at_max_tier_no_escalation(self) -> None:
        mh = MagicMock()
        mh.retrieve_top_k.return_value = []
        servicer = _make_servicer(multi_hop=mh)
        request = rag_pb2.ExecuteRetrievalRequest(
            user_query="q",
            received_config=_make_retrieval_config(
                rag_pb2.RetrievalType.SELF_QUERYING, top_k=4,
            ),
            namespace="ns",
        )
        response = servicer.ExecuteRetrieval(request, MagicMock())
        assert response.retrieval_status is True
        assert len(response.retrieved_chunk) == 0

    def test_unknown_retrieval_type_returns_error(self) -> None:
        servicer = _make_servicer()
        cfg = _make_retrieval_config(99)
        request = rag_pb2.ExecuteRetrievalRequest(
            user_query="q", received_config=cfg, namespace="ns",
        )
        ctx = MagicMock()
        response = servicer.ExecuteRetrieval(request, ctx)
        assert response.retrieval_status is False


# ======================================================================
# Rerank/Decompose activation
# ======================================================================


class TestExecuteRetrievalActivation:
    """Planner's rerank and decompose flags are wired into execution."""

    def test_passes_rerank_true_to_complex(self) -> None:
        complex = MagicMock()
        complex.retrieve_top_k.return_value = ["x"]
        servicer = _make_servicer(complex=complex)
        cfg = _make_retrieval_config(
            rag_pb2.RetrievalType.MULTI_VECTOR, rerank=True, decompose=False,
        )
        request = rag_pb2.ExecuteRetrievalRequest(
            user_query="q", received_config=cfg, namespace="ns",
        )
        servicer.ExecuteRetrieval(request, MagicMock())
        _, kwargs = complex.retrieve_top_k.call_args
        assert kwargs["rerank"] is True
        assert kwargs["decompose"] is False

    def test_passes_rerank_false_to_complex(self) -> None:
        complex = MagicMock()
        complex.retrieve_top_k.return_value = ["x"]
        servicer = _make_servicer(complex=complex)
        cfg = _make_retrieval_config(
            rag_pb2.RetrievalType.MULTI_VECTOR, rerank=False, decompose=False,
        )
        request = rag_pb2.ExecuteRetrievalRequest(
            user_query="q", received_config=cfg, namespace="ns",
        )
        servicer.ExecuteRetrieval(request, MagicMock())
        _, kwargs = complex.retrieve_top_k.call_args
        assert kwargs["rerank"] is False

    def test_passes_decompose_true_to_complex(self) -> None:
        complex = MagicMock()
        complex.retrieve_top_k.return_value = ["x"]
        servicer = _make_servicer(complex=complex)
        cfg = _make_retrieval_config(
            rag_pb2.RetrievalType.MULTI_VECTOR, rerank=True, decompose=True,
        )
        request = rag_pb2.ExecuteRetrievalRequest(
            user_query="q", received_config=cfg, namespace="ns",
        )
        servicer.ExecuteRetrieval(request, MagicMock())
        _, kwargs = complex.retrieve_top_k.call_args
        assert kwargs["decompose"] is True

    def test_passes_decompose_false_to_complex(self) -> None:
        complex = MagicMock()
        complex.retrieve_top_k.return_value = ["x"]
        servicer = _make_servicer(complex=complex)
        cfg = _make_retrieval_config(
            rag_pb2.RetrievalType.MULTI_VECTOR, rerank=True, decompose=False,
        )
        request = rag_pb2.ExecuteRetrievalRequest(
            user_query="q", received_config=cfg, namespace="ns",
        )
        servicer.ExecuteRetrieval(request, MagicMock())
        _, kwargs = complex.retrieve_top_k.call_args
        assert kwargs["decompose"] is False

    def test_does_not_pass_rerank_to_simple_retriever(self) -> None:
        simple = MagicMock()
        simple.retrieve_top_k.return_value = ["x"]
        servicer = _make_servicer(simple=simple)
        cfg = _make_retrieval_config(
            rag_pb2.RetrievalType.HYBRID, rerank=False, decompose=False,
        )
        request = rag_pb2.ExecuteRetrievalRequest(
            user_query="q", received_config=cfg, namespace="ns",
        )
        servicer.ExecuteRetrieval(request, MagicMock())
        _, kwargs = simple.retrieve_top_k.call_args
        assert "rerank" not in kwargs
        assert "decompose" not in kwargs

    def test_does_not_pass_rerank_to_multihop_retriever(self) -> None:
        mh = MagicMock()
        mh.retrieve_top_k.return_value = ["x"]
        servicer = _make_servicer(multi_hop=mh)
        cfg = _make_retrieval_config(
            rag_pb2.RetrievalType.SELF_QUERYING, rerank=True, decompose=True,
        )
        request = rag_pb2.ExecuteRetrievalRequest(
            user_query="q", received_config=cfg, namespace="ns",
        )
        servicer.ExecuteRetrieval(request, MagicMock())
        _, kwargs = mh.retrieve_top_k.call_args
        assert "rerank" not in kwargs
        assert "decompose" not in kwargs


# ======================================================================
# ComplexRetriever — rerank/decompose conditional branching
# ======================================================================


class TestComplexRetrieverFlags:
    """ComplexRetriever uses rerank and decompose to control execution."""

    @pytest.fixture
    def complex_retriever(self) -> "ComplexRetriever":
        from intelligence.retrieval.complex_retriever import ComplexRetriever
        retriever = ComplexRetriever(
            embedder=MagicMock(),
            store=MagicMock(),
            client=MagicMock(),
            model_name="test-model",
            mmr_lambda=0.5,
            cross_encoder=MagicMock(),
            model_provider="openai",
        )
        retriever._mmr_calc = MagicMock(return_value=["r1", "r2"])
        retriever._compute_hypothesis_embedding = MagicMock(return_value=[0.1] * 384)
        retriever._compute_sub_query_embedding = MagicMock(return_value=[0.2] * 384)
        retriever.embedder.embed.return_value = [0.0] * 384
        retriever.store.query.return_value = {
            "documents": [["d1", "d2", "d3"]],
            "embeddings": [[[0.3] * 384, [0.4] * 384, [0.5] * 384]],
        }
        retriever.cross_encoder.rerank.return_value = ["reranked1", "reranked2"]
        return retriever

    def test_rerank_false_skips_cross_encoder(self, complex_retriever) -> None:
        result = complex_retriever.retrieve_top_k("ns", 2, "test query", rerank=False, decompose=False)
        complex_retriever.cross_encoder.rerank.assert_not_called()
        assert result == ["r1", "r2"]

    def test_rerank_true_calls_cross_encoder(self, complex_retriever) -> None:
        result = complex_retriever.retrieve_top_k("ns", 2, "test query", rerank=True, decompose=False)
        complex_retriever.cross_encoder.rerank.assert_called_once()
        assert result == ["reranked1", "reranked2"]

    def test_decompose_false_skips_hypothesis_expansion(self, complex_retriever) -> None:
        complex_retriever.retrieve_top_k("ns", 2, "test query", rerank=False, decompose=False)
        complex_retriever._compute_hypothesis_embedding.assert_not_called()
        complex_retriever._compute_sub_query_embedding.assert_not_called()

    def test_decompose_true_calls_hypothesis_expansion(self, complex_retriever) -> None:
        complex_retriever.retrieve_top_k("ns", 2, "test query", rerank=False, decompose=True)
        complex_retriever._compute_hypothesis_embedding.assert_called_once()
        complex_retriever._compute_sub_query_embedding.assert_called_once()

    def test_decompose_false_uses_fewer_queries(self, complex_retriever) -> None:
        complex_retriever.retrieve_top_k("ns", 2, "test query", rerank=False, decompose=False)
        expected_store_calls = 1
        assert complex_retriever.store.query.call_count == expected_store_calls

    def test_decompose_true_uses_three_queries(self, complex_retriever) -> None:
        complex_retriever.retrieve_top_k("ns", 2, "test query", rerank=False, decompose=True)
        assert complex_retriever.store.query.call_count == 3
