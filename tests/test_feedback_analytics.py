"""Tests for feedback analytics."""

from __future__ import annotations

import pytest

from intelligence.feedback.analytics import (
    compute_acceptance_rate,
    compute_avg_rating,
    compute_budget_improvement_score,
    compute_config_win_rate,
    compute_feedback_accuracy,
    compute_learning_gain,
    compute_strategy_win_rate,
    generate_feedback_report,
)
from intelligence.feedback.models import FeedbackRecord


@pytest.fixture
def records() -> list:
    return [
        FeedbackRecord(
            query_id="q001",
            query="q1",
            query_type="SIMPLE",
            retrieval_type="HYBRID",
            confidence=0.9,
            calibrated_confidence=0.88,
            top_k=3,
            rerank=False,
            decompose=False,
            answer_accepted=True,
            answer_rating=5,
        ),
        FeedbackRecord(
            query_id="q002",
            query="q2",
            query_type="SIMPLE",
            retrieval_type="HYBRID",
            confidence=0.8,
            calibrated_confidence=0.78,
            top_k=5,
            rerank=True,
            decompose=False,
            answer_accepted=True,
            answer_rating=4,
        ),
        FeedbackRecord(
            query_id="q003",
            query="q3",
            query_type="COMPLEX",
            retrieval_type="MULTI_VECTOR",
            confidence=0.7,
            calibrated_confidence=0.68,
            top_k=8,
            rerank=True,
            decompose=False,
            answer_accepted=False,
            answer_rating=2,
        ),
        FeedbackRecord(
            query_id="q004",
            query="q4",
            query_type="MULTI_HOP",
            retrieval_type="SELF_QUERYING",
            confidence=0.6,
            calibrated_confidence=0.55,
            top_k=5,
            rerank=True,
            decompose=True,
            answer_accepted=False,
            answer_rating=1,
        ),
    ]


class TestAcceptanceRate:
    def test_all_accepted(self) -> None:
        rs = [
            FeedbackRecord(
                query_id="q1",
                query="q1",
                query_type="SIMPLE",
                retrieval_type="HYBRID",
                confidence=0.9,
                calibrated_confidence=0.9,
                top_k=3,
                rerank=False,
                decompose=False,
                answer_accepted=True,
            ),
            FeedbackRecord(
                query_id="q2",
                query="q2",
                query_type="SIMPLE",
                retrieval_type="HYBRID",
                confidence=0.9,
                calibrated_confidence=0.9,
                top_k=3,
                rerank=False,
                decompose=False,
                answer_accepted=True,
            ),
        ]
        assert compute_acceptance_rate(rs) == 1.0

    def test_half_accepted(self, records) -> None:
        assert compute_acceptance_rate(records) == 0.5

    def test_empty(self) -> None:
        assert compute_acceptance_rate([]) == 0.0


class TestAvgRating:
    def test_average(self, records) -> None:
        assert compute_avg_rating(records) == 3.0

    def test_no_ratings(self) -> None:
        rs = [
            FeedbackRecord(
                query_id="q1",
                query="q1",
                query_type="SIMPLE",
                retrieval_type="HYBRID",
                confidence=0.9,
                calibrated_confidence=0.9,
                top_k=3,
                rerank=False,
                decompose=False,
                answer_accepted=True,
            ),
        ]
        assert compute_avg_rating(rs) == 0.0

    def test_empty(self) -> None:
        assert compute_avg_rating([]) == 0.0


class TestFeedbackAccuracy:
    def test_per_type(self, records) -> None:
        result = compute_feedback_accuracy(records)
        assert "SIMPLE_acceptance_rate" in result
        assert "SIMPLE_avg_rating" in result
        assert "SIMPLE_count" in result

    def test_empty(self) -> None:
        assert compute_feedback_accuracy([]) == {}


class TestConfigWinRate:
    def test_rates(self, records) -> None:
        rates = compute_config_win_rate(records)
        assert "3_False_False" in rates
        assert "5_True_False" in rates

    def test_empty(self) -> None:
        assert compute_config_win_rate([]) == {}


class TestStrategyWinRate:
    def test_rates(self, records) -> None:
        rates = compute_strategy_win_rate(records)
        assert "HYBRID" in rates
        assert "MULTI_VECTOR" in rates

    def test_empty(self) -> None:
        assert compute_strategy_win_rate([]) == {}


class TestBudgetImprovement:
    def test_score(self, records) -> None:
        score = compute_budget_improvement_score(records)
        assert isinstance(score, float)

    def test_empty(self) -> None:
        assert compute_budget_improvement_score([]) == 0.0


class TestLearningGain:
    def test_positive_gain(self) -> None:
        old = [
            FeedbackRecord(
                query_id="q1",
                query="q1",
                query_type="SIMPLE",
                retrieval_type="HYBRID",
                confidence=0.9,
                calibrated_confidence=0.9,
                top_k=3,
                rerank=False,
                decompose=False,
                answer_accepted=False,
            ),
        ]
        new = [
            FeedbackRecord(
                query_id="q1",
                query="q1",
                query_type="SIMPLE",
                retrieval_type="HYBRID",
                confidence=0.9,
                calibrated_confidence=0.9,
                top_k=3,
                rerank=False,
                decompose=False,
                answer_accepted=True,
            ),
        ]
        assert compute_learning_gain(old, new) == 1.0

    def test_negative_gain(self) -> None:
        old = [
            FeedbackRecord(
                query_id="q1",
                query="q1",
                query_type="SIMPLE",
                retrieval_type="HYBRID",
                confidence=0.9,
                calibrated_confidence=0.9,
                top_k=3,
                rerank=False,
                decompose=False,
                answer_accepted=True,
            ),
        ]
        new = [
            FeedbackRecord(
                query_id="q1",
                query="q1",
                query_type="SIMPLE",
                retrieval_type="HYBRID",
                confidence=0.9,
                calibrated_confidence=0.9,
                top_k=3,
                rerank=False,
                decompose=False,
                answer_accepted=False,
            ),
        ]
        assert compute_learning_gain(old, new) == -1.0

    def test_empty_old(self) -> None:
        assert (
            compute_learning_gain(
                [],
                [
                    FeedbackRecord(
                        query_id="q1",
                        query="q1",
                        query_type="SIMPLE",
                        retrieval_type="HYBRID",
                        confidence=0.9,
                        calibrated_confidence=0.9,
                        top_k=3,
                        rerank=False,
                        decompose=False,
                        answer_accepted=True,
                    )
                ],
            )
            == 1.0
        )


class TestFeedbackReport:
    def test_generate_report(self, records) -> None:
        report = generate_feedback_report(records)
        assert "Feedback Analytics Report" in report
        assert "Core Metrics" in report
        assert "Budget Performance" in report
        assert "Strategy Performance" in report

    def test_report_empty(self) -> None:
        report = generate_feedback_report([])
        assert "Feedback Analytics Report" in report

    def test_report_with_old(self, records) -> None:
        report = generate_feedback_report(records, old_records=records[:2])
        assert "Learning Gain" in report
