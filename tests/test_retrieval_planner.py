"""Unit tests for RetrievalPlanner — pure decision layer.

Covers:
- plan() returns PlannerDecision with config + confidence
- Budget integration: high conf → static, low conf → overrides
- Correct config per query type (simple, complex, multi_hop)
- plan_with_evaluation() enriches with FallbackDecision
- Error propagation from classifier
- PlannerDecision immutability and field correctness
"""

from __future__ import annotations

from unittest.mock import MagicMock

import pytest

from intelligence.planner import RetrievalPlanner, PlannerDecision


# ======================================================================
# Fixtures
# ======================================================================


@pytest.fixture
def mock_classifier() -> MagicMock:
    """Classifier that returns simple / 0.95 confidence by default."""
    m = MagicMock()
    schema = MagicMock()
    schema.query_type = "simple"
    schema.domain = None
    schema.confidence_score = 0.95
    m.classify_with_confidence.return_value = schema
    return m


@pytest.fixture
def planner(mock_classifier: MagicMock) -> RetrievalPlanner:
    return RetrievalPlanner(classifier=mock_classifier)


# ======================================================================
# plan() — shape and budget integration
# ======================================================================


class TestPlan:
    """plan() — classification + budget + strategy (no I/O)."""

    def test_returns_planner_decision(self, planner: RetrievalPlanner) -> None:
        decision = planner.plan("test query")
        assert isinstance(decision, PlannerDecision)

    def test_decision_has_config(self, planner: RetrievalPlanner) -> None:
        decision = planner.plan("test query")
        assert isinstance(decision.config, dict)
        assert "retrieval_type" in decision.config
        assert "top_k" in decision.config
        assert "rerank" in decision.config
        assert "decompose" in decision.config

    def test_decision_has_confidence(self, planner: RetrievalPlanner) -> None:
        decision = planner.plan("test query")
        assert isinstance(decision.confidence, float)
        assert 0.0 <= decision.confidence <= 1.0

    def test_decision_has_query_type(self, planner: RetrievalPlanner) -> None:
        decision = planner.plan("test query")
        assert decision.query_type == "simple"

    def test_decision_fallback_is_none(self, planner: RetrievalPlanner) -> None:
        """plan() does not populate fallback_decision."""
        decision = planner.plan("test query")
        assert decision.fallback_decision is None

    def test_high_confidence_returns_static_config(
        self, planner: RetrievalPlanner
    ) -> None:
        """Confidence=0.95 >= 0.8 → static simple config (top_k=3)."""
        decision = planner.plan("simple query")
        assert decision.config["top_k"] == 3
        assert decision.config["rerank"] is False
        assert decision.config["decompose"] is False

    def test_low_confidence_returns_budget_overrides(
        self, mock_classifier: MagicMock
    ) -> None:
        """Confidence=0.30 < 0.8 → budget override (top_k=8 for simple)."""
        mock_classifier.classify_with_confidence.return_value.confidence_score = (
            0.30
        )
        planner = RetrievalPlanner(classifier=mock_classifier)
        decision = planner.plan("uncertain query")

        assert decision.confidence == 0.30
        assert decision.config["top_k"] == 8
        assert decision.config["rerank"] is True

    def test_calls_classifier(
        self, mock_classifier: MagicMock, planner: RetrievalPlanner
    ) -> None:
        planner.plan("some query")
        mock_classifier.classify_with_confidence.assert_called_once_with(
            "some query"
        )


# ======================================================================
# plan() — per-type config correctness
# ======================================================================


class TestPlanPerType:
    """plan() produces correct config for each query type."""

    def test_complex_high_confidence(
        self, mock_classifier: MagicMock
    ) -> None:
        mock_classifier.classify_with_confidence.return_value.query_type = (
            "complex"
        )
        mock_classifier.classify_with_confidence.return_value.confidence_score = (
            0.85
        )
        planner = RetrievalPlanner(classifier=mock_classifier)
        decision = planner.plan("complex query")

        assert decision.config["retrieval_type"] == "MULTI_VECTOR"
        assert decision.config["top_k"] == 8

    def test_complex_low_confidence(
        self, mock_classifier: MagicMock
    ) -> None:
        mock_classifier.classify_with_confidence.return_value.query_type = (
            "complex"
        )
        mock_classifier.classify_with_confidence.return_value.confidence_score = (
            0.30
        )
        planner = RetrievalPlanner(classifier=mock_classifier)
        decision = planner.plan("complex uncertain")

        assert decision.config["top_k"] == 12
        assert decision.config["decompose"] is True

    def test_multihop_high_confidence(
        self, mock_classifier: MagicMock
    ) -> None:
        mock_classifier.classify_with_confidence.return_value.query_type = (
            "multi_hop"
        )
        mock_classifier.classify_with_confidence.return_value.confidence_score = (
            0.95
        )
        planner = RetrievalPlanner(classifier=mock_classifier)
        decision = planner.plan("multi_hop query")

        assert decision.config["retrieval_type"] == "SELF_QUERYING"
        assert decision.config["top_k"] == 3
        assert decision.config["decompose"] is True

    def test_multihop_low_confidence(
        self, mock_classifier: MagicMock
    ) -> None:
        mock_classifier.classify_with_confidence.return_value.query_type = (
            "multi_hop"
        )
        mock_classifier.classify_with_confidence.return_value.confidence_score = (
            0.20
        )
        planner = RetrievalPlanner(classifier=mock_classifier)
        decision = planner.plan("multi_hop uncertain")

        assert decision.config["top_k"] == 8
        assert decision.config["decompose"] is True


# ======================================================================
# plan_with_evaluation()
# ======================================================================


class TestPlanWithEvaluation:
    """plan_with_evaluation() chains plan() + FallbackManager.evaluate()."""

    def test_enriches_with_fallback_decision(
        self, planner: RetrievalPlanner
    ) -> None:
        """Sufficient chunks (3, top_k=3, threshold=1) → no fallback."""
        decision = planner.plan_with_evaluation(
            query="test", chunk_count=3
        )
        assert decision.fallback_decision is not None
        assert decision.fallback_decision.should_fallback is False

    def test_insufficient_chunks_triggers_fallback(
        self, planner: RetrievalPlanner
    ) -> None:
        """1 chunk with top_k=3 → threshold=1, exactly at threshold = no fallback.

        Wait: 3 * 0.5 = 1.5 → int = 1 → max(1, 1) = 1
        1 >= 1 → sufficient. Let's use top_k=6 so threshold=3.
        """
        # Override classifier to produce low confidence → top_k=8 for simple
        # Actually, the planner uses the classifier's response, not a local override.
        # With default 0.95 confidence, simple top_k=3, threshold=1.
        # With 1 chunk: 1 >= 1, sufficient.
        # To trigger fallback, we need chunk_count < threshold.
        # With top_k=3, threshold=1, chunk_count=0 triggers fallback.
        decision = planner.plan_with_evaluation(
            query="test", chunk_count=0
        )
        assert decision.fallback_decision is not None
        assert decision.fallback_decision.should_fallback is True

    def test_fallback_decision_escalated_tier(
        self, planner: RetrievalPlanner
    ) -> None:
        """Simple with 0 chunks → should escalate to complex."""
        decision = planner.plan_with_evaluation(
            query="test", chunk_count=0
        )
        assert decision.fallback_decision.escalated_tier == "complex"

    def test_preserves_config_and_confidence(
        self, planner: RetrievalPlanner
    ) -> None:
        decision = planner.plan_with_evaluation(
            query="test", chunk_count=3
        )
        # Should be same as plan() output
        plan_decision = planner.plan("test")
        assert decision.config == plan_decision.config
        assert decision.confidence == plan_decision.confidence
        assert decision.query_type == plan_decision.query_type

    def test_low_confidence_with_fallback(
        self, mock_classifier: MagicMock
    ) -> None:
        """Low confidence → high top_k → fallback evaluation uses that top_k."""
        mock_classifier.classify_with_confidence.return_value.confidence_score = (
            0.30
        )
        planner = RetrievalPlanner(classifier=mock_classifier)
        # Low confidence for simple → top_k=8, threshold=4
        # With 1 chunk: 1 < 4 → fallback triggered
        decision = planner.plan_with_evaluation(
            query="uncertain", chunk_count=1
        )
        assert decision.config["top_k"] == 8
        assert decision.fallback_decision.should_fallback is True


# ======================================================================
# Error handling
# ======================================================================


class TestErrorHandling:
    """Planner error paths."""

    def test_classifier_error_propagates(
        self, mock_classifier: MagicMock
    ) -> None:
        mock_classifier.classify_with_confidence.side_effect = RuntimeError(
            "LLM unavailable"
        )
        planner = RetrievalPlanner(classifier=mock_classifier)

        with pytest.raises(RuntimeError, match="LLM unavailable"):
            planner.plan("query")

    def test_unknown_query_type_error(
        self, mock_classifier: MagicMock
    ) -> None:
        """An unrecognised query_type string propagates from QueryType()."""
        mock_classifier.classify_with_confidence.return_value.query_type = (
            "gibberish"
        )
        mock_classifier.classify_with_confidence.return_value.confidence_score = (
            0.95
        )
        planner = RetrievalPlanner(classifier=mock_classifier)

        with pytest.raises(ValueError):
            planner.plan("query")


# ======================================================================
# PlannerDecision invariants
# ======================================================================


class TestPlannerDecision:
    """PlannerDecision dataclass behaviour."""

    def test_frozen(self) -> None:
        decision = PlannerDecision(
            config={"key": "val"},
            confidence=0.8,
            query_type="simple",
        )
        with pytest.raises(AttributeError):
            decision.config = {}  # type: ignore[misc]

    def test_fallback_defaults_to_none(self) -> None:
        decision = PlannerDecision(
            config={}, confidence=0.5, query_type="simple"
        )
        assert decision.fallback_decision is None

    def test_confidence_range(self) -> None:
        decision = PlannerDecision(
            config={}, confidence=0.0, query_type="simple"
        )
        assert 0.0 <= decision.confidence <= 1.0

    def test_config_is_dict(self) -> None:
        decision = PlannerDecision(
            config={"top_k": 3}, confidence=0.5, query_type="simple"
        )
        assert isinstance(decision.config, dict)
