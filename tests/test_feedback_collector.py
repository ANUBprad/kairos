"""Tests for FeedbackCollector."""

from __future__ import annotations

import os
import tempfile

import pytest

from intelligence.feedback.collector import FeedbackCollector
from intelligence.feedback.storage import FeedbackStorage


@pytest.fixture
def temp_storage() -> FeedbackStorage:
    with tempfile.TemporaryDirectory() as tmp:
        yield FeedbackStorage(path=os.path.join(tmp, "feedback.jsonl"))


@pytest.fixture
def collector(temp_storage) -> FeedbackCollector:
    return FeedbackCollector(storage=temp_storage)


class TestFeedbackCollector:
    def test_record_feedback(self, collector) -> None:
        collector.record_feedback(
            query_id="q001",
            query="What is AI?",
            query_type="SIMPLE",
            retrieval_type="HYBRID",
            confidence=0.95,
            calibrated_confidence=0.92,
            top_k=3,
            rerank=False,
            decompose=False,
            answer_accepted=True,
            answer_rating=5,
        )
        assert collector.pending_count == 1

    def test_record_feedback_minimal(self, collector) -> None:
        collector.record_feedback(
            query_id="q001",
            query="test",
            query_type="SIMPLE",
            retrieval_type="HYBRID",
            confidence=0.9,
            calibrated_confidence=0.9,
            top_k=3,
            rerank=False,
            decompose=False,
            answer_accepted=True,
        )
        assert collector.pending_count == 1

    def test_record_feedback_invalid_rating(self, collector) -> None:
        with pytest.raises(ValueError):
            collector.record_feedback(
                query_id="q001",
                query="test",
                query_type="SIMPLE",
                retrieval_type="HYBRID",
                confidence=0.9,
                calibrated_confidence=0.9,
                top_k=3,
                rerank=False,
                decompose=False,
                answer_accepted=True,
                answer_rating=0,
            )

    def test_record_feedback_missing_query_id(self, collector) -> None:
        with pytest.raises(ValueError):
            collector.record_feedback(
                query_id="",
                query="test",
                query_type="SIMPLE",
                retrieval_type="HYBRID",
                confidence=0.9,
                calibrated_confidence=0.9,
                top_k=3,
                rerank=False,
                decompose=False,
                answer_accepted=True,
            )

    def test_flush(self, collector, temp_storage) -> None:
        collector.record_feedback(
            query_id="q001",
            query="test",
            query_type="SIMPLE",
            retrieval_type="HYBRID",
            confidence=0.9,
            calibrated_confidence=0.9,
            top_k=3,
            rerank=False,
            decompose=False,
            answer_accepted=True,
        )
        collector.flush()
        assert collector.pending_count == 0
        assert temp_storage.count() == 1

    def test_close_flushes(self, collector, temp_storage) -> None:
        collector.record_feedback(
            query_id="q001",
            query="test",
            query_type="SIMPLE",
            retrieval_type="HYBRID",
            confidence=0.9,
            calibrated_confidence=0.9,
            top_k=3,
            rerank=False,
            decompose=False,
            answer_accepted=True,
        )
        collector.close()
        assert temp_storage.count() == 1

    def test_export_dataset_empty(self, collector) -> None:
        exported = collector.export_dataset()
        assert exported == []

    def test_export_dataset_with_pending(self, collector) -> None:
        collector.record_feedback(
            query_id="q001",
            query="test",
            query_type="SIMPLE",
            retrieval_type="HYBRID",
            confidence=0.9,
            calibrated_confidence=0.9,
            top_k=3,
            rerank=False,
            decompose=False,
            answer_accepted=True,
        )
        exported = collector.export_dataset()
        assert len(exported) == 1
        assert exported[0]["accepted"] is True
        assert exported[0]["rating"] is None

    def test_export_dataset_with_stored(self, collector, temp_storage) -> None:
        collector.record_feedback(
            query_id="q001",
            query="test",
            query_type="SIMPLE",
            retrieval_type="HYBRID",
            confidence=0.9,
            calibrated_confidence=0.9,
            top_k=3,
            rerank=False,
            decompose=False,
            answer_accepted=True,
        )
        collector.flush()
        collector.record_feedback(
            query_id="q002",
            query="test2",
            query_type="COMPLEX",
            retrieval_type="MULTI_VECTOR",
            confidence=0.7,
            calibrated_confidence=0.68,
            top_k=8,
            rerank=True,
            decompose=False,
            answer_accepted=False,
        )
        exported = collector.export_dataset()
        assert len(exported) == 2

    def test_aggregate_metrics_empty(self, collector) -> None:
        metrics = collector.aggregate_metrics()
        assert metrics == {}

    def test_aggregate_metrics(self, collector) -> None:
        collector.record_feedback(
            query_id="q001",
            query="test",
            query_type="SIMPLE",
            retrieval_type="HYBRID",
            confidence=0.9,
            calibrated_confidence=0.9,
            top_k=3,
            rerank=False,
            decompose=False,
            answer_accepted=True,
            answer_rating=5,
        )
        collector.record_feedback(
            query_id="q002",
            query="test2",
            query_type="COMPLEX",
            retrieval_type="MULTI_VECTOR",
            confidence=0.7,
            calibrated_confidence=0.68,
            top_k=8,
            rerank=True,
            decompose=False,
            answer_accepted=False,
            answer_rating=2,
        )
        metrics = collector.aggregate_metrics()
        assert metrics["total_records"] == 2
        assert metrics["acceptance_rate"] == 0.5

    def test_thread_safety(self, collector) -> None:
        import threading

        errors = []

        def record():
            try:
                collector.record_feedback(
                    query_id="q001",
                    query="test",
                    query_type="SIMPLE",
                    retrieval_type="HYBRID",
                    confidence=0.9,
                    calibrated_confidence=0.9,
                    top_k=3,
                    rerank=False,
                    decompose=False,
                    answer_accepted=True,
                )
            except Exception as e:
                errors.append(e)

        threads = [threading.Thread(target=record) for _ in range(10)]
        for t in threads:
            t.start()
        for t in threads:
            t.join()
        assert collector.pending_count == 10
        assert len(errors) == 0

    def test_on_feedback_callback(self) -> None:
        callback_called = []

        def cb(record):
            callback_called.append(record)

        c = FeedbackCollector(on_feedback=cb)
        c.record_feedback(
            query_id="q001",
            query="test",
            query_type="SIMPLE",
            retrieval_type="HYBRID",
            confidence=0.9,
            calibrated_confidence=0.9,
            top_k=3,
            rerank=False,
            decompose=False,
            answer_accepted=True,
        )
        assert len(callback_called) == 1

    def test_no_storage_no_error(self) -> None:
        c = FeedbackCollector()
        c.record_feedback(
            query_id="q001",
            query="test",
            query_type="SIMPLE",
            retrieval_type="HYBRID",
            confidence=0.9,
            calibrated_confidence=0.9,
            top_k=3,
            rerank=False,
            decompose=False,
            answer_accepted=True,
        )
        c.flush()
        assert c.pending_count == 0
