"""Tests for feedback models and validator."""

from __future__ import annotations


from intelligence.feedback.models import FeedbackRecord
from intelligence.feedback.validator import FeedbackValidator


# ======================================================================
# FeedbackRecord
# ======================================================================


class TestFeedbackRecord:
    def test_default_timestamp(self) -> None:
        r = FeedbackRecord(
            query_id="q001",
            query="test",
            query_type="SIMPLE",
            retrieval_type="HYBRID",
            confidence=0.9,
            calibrated_confidence=0.85,
            top_k=3,
            rerank=False,
            decompose=False,
            answer_accepted=True,
        )
        assert r.timestamp > 0

    def test_default_rating_none(self) -> None:
        r = FeedbackRecord(
            query_id="q001",
            query="test",
            query_type="SIMPLE",
            retrieval_type="HYBRID",
            confidence=0.9,
            calibrated_confidence=0.85,
            top_k=3,
            rerank=False,
            decompose=False,
            answer_accepted=True,
        )
        assert r.answer_rating is None

    def test_default_success_true(self) -> None:
        r = FeedbackRecord(
            query_id="q001",
            query="test",
            query_type="SIMPLE",
            retrieval_type="HYBRID",
            confidence=0.9,
            calibrated_confidence=0.85,
            top_k=3,
            rerank=False,
            decompose=False,
            answer_accepted=True,
        )
        assert r.retrieval_success

    def test_all_fields_set(self) -> None:
        r = FeedbackRecord(
            query_id="q001",
            query="What is AI?",
            query_type="COMPLEX",
            retrieval_type="MULTI_VECTOR",
            confidence=0.75,
            calibrated_confidence=0.72,
            top_k=8,
            rerank=True,
            decompose=False,
            answer_accepted=True,
            answer_rating=4,
            fallback_triggered=False,
            retrieval_success=True,
            latency_ms=150.0,
        )
        assert r.query_id == "q001"
        assert r.answer_rating == 4

    def test_rating_range(self) -> None:
        r = FeedbackRecord(
            query_id="q001",
            query="test",
            query_type="SIMPLE",
            retrieval_type="HYBRID",
            confidence=0.9,
            calibrated_confidence=0.85,
            top_k=3,
            rerank=False,
            decompose=False,
            answer_accepted=True,
            answer_rating=5,
        )
        assert 1 <= r.answer_rating <= 5


# ======================================================================
# FeedbackValidator
# ======================================================================


class TestFeedbackValidator:
    def test_validate_rating_none(self) -> None:
        assert FeedbackValidator.validate_rating(None) is None

    def test_validate_rating_valid(self) -> None:
        for r in [1, 2, 3, 4, 5]:
            assert FeedbackValidator.validate_rating(r) is None

    def test_validate_rating_too_low(self) -> None:
        assert FeedbackValidator.validate_rating(0) is not None

    def test_validate_rating_too_high(self) -> None:
        assert FeedbackValidator.validate_rating(6) is not None

    def test_validate_rating_not_int(self) -> None:
        assert FeedbackValidator.validate_rating(3.5) is not None

    def test_validate_record_valid(self) -> None:
        d = {
            "query_id": "q001",
            "query": "What is AI?",
            "query_type": "SIMPLE",
            "retrieval_type": "HYBRID",
            "confidence": 0.85,
            "calibrated_confidence": 0.82,
            "top_k": 3,
            "answer_accepted": True,
            "answer_rating": 4,
        }
        assert FeedbackValidator.validate_record(d) is None

    def test_validate_record_no_rating(self) -> None:
        d = {
            "query_id": "q001",
            "query": "What is AI?",
            "query_type": "SIMPLE",
            "retrieval_type": "HYBRID",
            "confidence": 0.85,
            "calibrated_confidence": 0.82,
            "top_k": 3,
            "answer_accepted": True,
        }
        assert FeedbackValidator.validate_record(d) is None

    def test_validate_record_missing_query_id(self) -> None:
        d = {
            "query": "test",
            "query_type": "SIMPLE",
            "retrieval_type": "HYBRID",
            "confidence": 0.85,
            "calibrated_confidence": 0.82,
            "top_k": 3,
            "answer_accepted": True,
        }
        assert FeedbackValidator.validate_record(d) is not None

    def test_validate_record_invalid_query_type(self) -> None:
        d = {
            "query_id": "q001",
            "query": "test",
            "query_type": "INVALID",
            "retrieval_type": "HYBRID",
            "confidence": 0.85,
            "calibrated_confidence": 0.82,
            "top_k": 3,
            "answer_accepted": True,
        }
        assert FeedbackValidator.validate_record(d) is not None

    def test_validate_record_missing_query(self) -> None:
        d = {
            "query_id": "q001",
            "query_type": "SIMPLE",
            "retrieval_type": "HYBRID",
            "confidence": 0.85,
            "calibrated_confidence": 0.82,
            "top_k": 3,
            "answer_accepted": True,
        }
        assert FeedbackValidator.validate_record(d) is not None

    def test_validate_record_invalid_confidence(self) -> None:
        d = {
            "query_id": "q001",
            "query": "test",
            "query_type": "SIMPLE",
            "retrieval_type": "HYBRID",
            "confidence": 1.5,
            "calibrated_confidence": 0.82,
            "top_k": 3,
            "answer_accepted": True,
        }
        assert FeedbackValidator.validate_record(d) is not None

    def test_validate_record_invalid_calibrated_confidence(self) -> None:
        d = {
            "query_id": "q001",
            "query": "test",
            "query_type": "SIMPLE",
            "retrieval_type": "HYBRID",
            "confidence": 0.85,
            "calibrated_confidence": 1.5,
            "top_k": 3,
            "answer_accepted": True,
        }
        assert FeedbackValidator.validate_record(d) is not None

    def test_validate_record_invalid_top_k(self) -> None:
        d = {
            "query_id": "q001",
            "query": "test",
            "query_type": "SIMPLE",
            "retrieval_type": "HYBRID",
            "confidence": 0.85,
            "calibrated_confidence": 0.82,
            "top_k": 0,
            "answer_accepted": True,
        }
        assert FeedbackValidator.validate_record(d) is not None

    def test_validate_record_invalid_rating(self) -> None:
        d = {
            "query_id": "q001",
            "query": "test",
            "query_type": "SIMPLE",
            "retrieval_type": "HYBRID",
            "confidence": 0.85,
            "calibrated_confidence": 0.82,
            "top_k": 3,
            "answer_accepted": True,
            "answer_rating": 0,
        }
        assert FeedbackValidator.validate_record(d) is not None

    def test_validate_record_not_dict(self) -> None:
        assert FeedbackValidator.validate_record("not a dict") is not None

    def test_validate_batch(self) -> None:
        records = [
            {
                "query_id": "q001",
                "query": "test",
                "query_type": "SIMPLE",
                "retrieval_type": "HYBRID",
                "confidence": 0.85,
                "calibrated_confidence": 0.82,
                "top_k": 3,
                "answer_accepted": True,
            },
            {
                "query_id": "q002",
                "query": "test2",
                "query_type": "INVALID",
                "retrieval_type": "HYBRID",
                "confidence": 0.85,
                "calibrated_confidence": 0.82,
                "top_k": 3,
                "answer_accepted": True,
            },
        ]
        errors = FeedbackValidator.validate_batch(records)
        assert len(errors) == 1

    def test_validate_batch_empty(self) -> None:
        assert FeedbackValidator.validate_batch([]) == []
