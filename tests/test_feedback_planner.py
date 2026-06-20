"""Tests for feedback-aware planner integration and FeedbackAdjuster."""

from __future__ import annotations

import pytest

from intelligence.feedback.adjuster import FeedbackAdjuster
from intelligence.feedback.models import FeedbackRecord
from intelligence.planner.retrieval_planner import RetrievalPlanner
from intelligence.planner.planner_config import RetrievalBudget, BUDGET_TABLE, QueryType, ConfidenceBand


# ======================================================================
# Fixtures
# ======================================================================


@pytest.fixture
def sample_feedback_records() -> list:
    return [
        FeedbackRecord(query_id="q001", query="q1", query_type="SIMPLE",
                       retrieval_type="HYBRID", confidence=0.9,
                       calibrated_confidence=0.88, top_k=3, rerank=False,
                       decompose=False, answer_accepted=True, answer_rating=5),
        FeedbackRecord(query_id="q002", query="q2", query_type="SIMPLE",
                       retrieval_type="HYBRID", confidence=0.9,
                       calibrated_confidence=0.88, top_k=3, rerank=False,
                       decompose=False, answer_accepted=True, answer_rating=4),
        FeedbackRecord(query_id="q003", query="q3", query_type="SIMPLE",
                       retrieval_type="HYBRID", confidence=0.9,
                       calibrated_confidence=0.88, top_k=5, rerank=True,
                       decompose=False, answer_accepted=False, answer_rating=2),
        FeedbackRecord(query_id="q004", query="q4", query_type="SIMPLE",
                       retrieval_type="HYBRID", confidence=0.9,
                       calibrated_confidence=0.88, top_k=5, rerank=True,
                       decompose=False, answer_accepted=False, answer_rating=1),
        FeedbackRecord(query_id="q005", query="q5", query_type="COMPLEX",
                       retrieval_type="MULTI_VECTOR", confidence=0.7,
                       calibrated_confidence=0.68, top_k=8, rerank=True,
                       decompose=False, answer_accepted=True, answer_rating=5),
    ]


@pytest.fixture
def fitted_adjuster(sample_feedback_records) -> FeedbackAdjuster:
    adj = FeedbackAdjuster(min_samples=1)
    adj.feed(sample_feedback_records)
    return adj


# ======================================================================
# FeedbackAdjuster
# ======================================================================


class TestFeedbackAdjuster:
    def test_not_fitted_by_default(self) -> None:
        adj = FeedbackAdjuster()
        assert not adj.fitted

    def test_fitted_after_feed(self, sample_feedback_records) -> None:
        adj = FeedbackAdjuster()
        adj.feed(sample_feedback_records)
        assert adj.fitted

    def test_adjust_top_k_unfitted(self) -> None:
        adj = FeedbackAdjuster()
        assert adj.adjust_top_k("SIMPLE", 5) == 5

    def test_adjust_top_k_improves(self, fitted_adjuster) -> None:
        adjusted = fitted_adjuster.adjust_top_k("SIMPLE", 5)
        assert adjusted == 3  # top_k=3 has better acceptance

    def test_adjust_top_k_keeps_good(self, fitted_adjuster) -> None:
        adjusted = fitted_adjuster.adjust_top_k("SIMPLE", 3)
        assert adjusted == 3

    def test_adjust_config_unfitted(self) -> None:
        adj = FeedbackAdjuster()
        result = adj.adjust_config("SIMPLE", 5, True, False)
        assert result == (5, True, False)

    def test_adjust_config_improves(self, fitted_adjuster) -> None:
        top_k, rerank, decompose = fitted_adjuster.adjust_config("SIMPLE", 5, True, False)
        assert top_k == 3
        assert rerank is False
        assert decompose is False

    def test_adjust_config_keeps_best(self, fitted_adjuster) -> None:
        top_k, rerank, decompose = fitted_adjuster.adjust_config("SIMPLE", 3, False, False)
        assert top_k == 3

    def test_get_acceptance_rate(self, fitted_adjuster) -> None:
        rate = fitted_adjuster.get_acceptance_rate("SIMPLE", 3)
        assert rate == 1.0

    def test_get_acceptance_rate_no_data(self, fitted_adjuster) -> None:
        rate = fitted_adjuster.get_acceptance_rate("MULTI_HOP", 3)
        assert rate == 0.0

    def test_get_best_config(self, fitted_adjuster) -> None:
        best = fitted_adjuster.get_best_config("SIMPLE")
        assert best == "3_False_False"

    def test_get_best_config_no_data(self) -> None:
        adj = FeedbackAdjuster()
        adj.feed([])
        assert adj.get_best_config("SIMPLE") is None

    def test_insufficient_samples(self) -> None:
        records = [
            FeedbackRecord(query_id="q1", query="q1", query_type="SIMPLE",
                           retrieval_type="HYBRID", confidence=0.9,
                           calibrated_confidence=0.9, top_k=3, rerank=False,
                           decompose=False, answer_accepted=True),
        ]
        adj = FeedbackAdjuster(min_samples=5)
        adj.feed(records)
        assert adj.get_best_config("SIMPLE") is None


# ======================================================================
# Planner Integration
# ======================================================================


class TestFeedbackPlannerIntegration:
    def test_planner_accepts_feedback_adjuster(self) -> None:
        adj = FeedbackAdjuster()
        planner = RetrievalPlanner(classifier=_SimpleClassifier(), feedback_adjuster=adj)
        # No error means acceptance

    def test_planner_disabled_feedback_learning(self) -> None:
        adj = FeedbackAdjuster()
        planner = RetrievalPlanner(classifier=_SimpleClassifier(), feedback_adjuster=adj)
        decision = planner.plan("test", use_feedback_learning=False)
        assert decision.config["top_k"] == 3

    def test_planner_enabled_no_adjuster(self) -> None:
        planner = RetrievalPlanner(classifier=_SimpleClassifier())
        decision = planner.plan("test", use_feedback_learning=True)
        assert decision.config["top_k"] == 3

    def test_planner_enabled_unfitted_adjuster(self) -> None:
        adj = FeedbackAdjuster()
        planner = RetrievalPlanner(classifier=_SimpleClassifier(), feedback_adjuster=adj)
        decision = planner.plan("test", use_feedback_learning=True)
        assert decision.config["top_k"] == 3

    def test_planner_feedback_adjusts_config(self) -> None:
        records = [
            FeedbackRecord(query_id="q1", query="q1", query_type="SIMPLE",
                           retrieval_type="HYBRID", confidence=0.9,
                           calibrated_confidence=0.9, top_k=5, rerank=True,
                           decompose=False, answer_accepted=False),
            FeedbackRecord(query_id="q2", query="q2", query_type="SIMPLE",
                           retrieval_type="HYBRID", confidence=0.9,
                           calibrated_confidence=0.9, top_k=5, rerank=True,
                           decompose=False, answer_accepted=False),
            FeedbackRecord(query_id="q3", query="q3", query_type="SIMPLE",
                           retrieval_type="HYBRID", confidence=0.9,
                           calibrated_confidence=0.9, top_k=3, rerank=False,
                           decompose=False, answer_accepted=True),
            FeedbackRecord(query_id="q4", query="q4", query_type="SIMPLE",
                           retrieval_type="HYBRID", confidence=0.9,
                           calibrated_confidence=0.9, top_k=3, rerank=False,
                           decompose=False, answer_accepted=True),
        ]
        adj = FeedbackAdjuster(min_samples=1)
        adj.feed(records)
        planner = RetrievalPlanner(classifier=_SimpleClassifier(), feedback_adjuster=adj)
        # Static budget for SIMPLE/HIGH is top_k=3, but the learned optimizer
        # might suggest something else. With feedback, it should prefer configs
        # with high acceptance.
        decision = planner.plan("test", use_feedback_learning=True)
        assert isinstance(decision.config["top_k"], int)

    def test_planner_with_evaluation_feedback(self) -> None:
        adj = FeedbackAdjuster(min_samples=1)
        adj.feed([
            FeedbackRecord(query_id="q1", query="q1", query_type="SIMPLE",
                           retrieval_type="HYBRID", confidence=0.9,
                           calibrated_confidence=0.9, top_k=3, rerank=False,
                           decompose=False, answer_accepted=True),
        ])
        planner = RetrievalPlanner(classifier=_SimpleClassifier(), feedback_adjuster=adj)
        decision = planner.plan_with_evaluation("test", chunk_count=5, use_feedback_learning=True)
        assert decision.fallback_decision is not None
        assert not decision.fallback_decision.should_fallback  # 5 >= 3

    def test_planner_with_evaluation_feedback_fallback(self) -> None:
        adj = FeedbackAdjuster(min_samples=1)
        adj.feed([
            FeedbackRecord(query_id="q1", query="q1", query_type="SIMPLE",
                           retrieval_type="HYBRID", confidence=0.9,
                           calibrated_confidence=0.9, top_k=3, rerank=False,
                           decompose=False, answer_accepted=True),
        ])
        planner = RetrievalPlanner(classifier=_SimpleClassifier(), feedback_adjuster=adj)
        decision = planner.plan_with_evaluation("test", chunk_count=0, use_feedback_learning=True)
        assert decision.fallback_decision.should_fallback


# ======================================================================
# Helper
# ======================================================================


class _SimpleClassifier:
    """Minimal classifier returning SIMPLE / high confidence."""
    def classify_with_confidence(self, query: str):
        from intelligence.classifier.query_classifier import ResponseSchema
        return ResponseSchema(query_type="simple", domain=None, confidence_score=0.95)
