"""Tests for intelligence.telemetry — collector, storage, analytics, integration."""

from __future__ import annotations

import json
import tempfile
import threading
from pathlib import Path

import pytest

from intelligence.telemetry import (
    TelemetryCollector,
    TelemetryStorage,
    RetrievalTelemetry,
    compute_strategy_distribution,
    compute_confidence_distribution,
    compute_fallback_rate,
    compute_average_latency,
    compute_success_rate,
)
from intelligence.telemetry.storage import _event_to_jsonl, _jsonl_to_event


# ======================================================================
# Fixtures
# ======================================================================


@pytest.fixture
def sample_event() -> RetrievalTelemetry:
    return RetrievalTelemetry(
        query="What is an AI system?",
        query_type="SIMPLE",
        confidence=0.95,
        retrieval_type="HYBRID",
        top_k=3,
        rerank=False,
        decompose=False,
        retrieved_chunks=2,
        retrieval_latency_ms=12.5,
        fallback_triggered=False,
        fallback_reason=None,
        success=True,
    )


@pytest.fixture
def temp_storage() -> TelemetryStorage:
    with tempfile.TemporaryDirectory() as tmp:
        yield TelemetryStorage(base_dir=tmp)


@pytest.fixture
def temp_collector(temp_storage) -> TelemetryCollector:
    return TelemetryCollector(storage=temp_storage)


# ======================================================================
# Models
# ======================================================================


class TestRetrievalTelemetry:
    def test_default_timestamp(self) -> None:
        e = RetrievalTelemetry(
            query="?",
            query_type="SIMPLE",
            confidence=0.5,
            retrieval_type="HYBRID",
            top_k=3,
        )
        assert e.timestamp > 0

    def test_frozen_by_convention(self) -> None:
        e = RetrievalTelemetry(
            query="?",
            query_type="SIMPLE",
            confidence=0.5,
            retrieval_type="HYBRID",
            top_k=3,
        )
        assert e.query == "?"

    def test_default_success_true(self) -> None:
        e = RetrievalTelemetry(
            query="?",
            query_type="SIMPLE",
            confidence=0.5,
            retrieval_type="HYBRID",
            top_k=3,
        )
        assert e.success

    def test_default_fallback_false(self) -> None:
        e = RetrievalTelemetry(
            query="?",
            query_type="SIMPLE",
            confidence=0.5,
            retrieval_type="HYBRID",
            top_k=3,
        )
        assert not e.fallback_triggered
        assert e.fallback_reason is None

    def test_default_query_id_none(self) -> None:
        e = RetrievalTelemetry(
            query="?",
            query_type="SIMPLE",
            confidence=0.5,
            retrieval_type="HYBRID",
            top_k=3,
        )
        assert e.query_id is None

    def test_default_event_type_retrieval(self) -> None:
        e = RetrievalTelemetry(
            query="?",
            query_type="SIMPLE",
            confidence=0.5,
            retrieval_type="HYBRID",
            top_k=3,
        )
        assert e.event_type == "retrieval"

    def test_custom_query_id(self) -> None:
        e = RetrievalTelemetry(
            query="?",
            query_type="SIMPLE",
            confidence=0.5,
            retrieval_type="HYBRID",
            top_k=3,
            query_id="req-001",
        )
        assert e.query_id == "req-001"

    def test_custom_event_type(self) -> None:
        e = RetrievalTelemetry(
            query="?",
            query_type="SIMPLE",
            confidence=0.5,
            retrieval_type="HYBRID",
            top_k=3,
            event_type="classification",
        )
        assert e.event_type == "classification"


# ======================================================================
# Storage
# ======================================================================


class TestTelemetryStorage:
    def test_store_and_read_single(self, temp_storage) -> None:
        e = RetrievalTelemetry(
            query="q1",
            query_type="SIMPLE",
            confidence=0.9,
            retrieval_type="HYBRID",
            top_k=3,
        )
        temp_storage.store(e)
        dates = temp_storage.list_dates()
        assert len(dates) == 1
        events = list(temp_storage.read(dates[0]))
        assert len(events) == 1
        assert events[0].query == "q1"

    def test_store_batch(self, temp_storage) -> None:
        events = [
            RetrievalTelemetry(
                query=f"q{i}",
                query_type="SIMPLE",
                confidence=0.5,
                retrieval_type="HYBRID",
                top_k=3,
            )
            for i in range(5)
        ]
        temp_storage.store_batch(events)
        dates = temp_storage.list_dates()
        restored = list(temp_storage.read(dates[0]))
        assert len(restored) == 5

    def test_store_batch_empty(self, temp_storage) -> None:
        temp_storage.store_batch([])  # should not crash
        assert temp_storage.event_count == 0

    def test_jsonl_format(self, temp_storage) -> None:
        e = RetrievalTelemetry(
            query="test",
            query_type="SIMPLE",
            confidence=0.5,
            retrieval_type="HYBRID",
            top_k=3,
            retrieval_latency_ms=10.0,
        )
        temp_storage.store(e)
        path = list(Path(temp_storage._base).glob("*.jsonl"))[0]
        line = path.read_text(encoding="utf-8").strip()
        d = json.loads(line)
        assert d["query"] == "test"
        assert d["retrieval_latency_ms"] == 10.0

    def test_list_dates(self, temp_storage) -> None:
        from datetime import date

        before = temp_storage.list_dates()
        assert before == []  # empty dir
        e = RetrievalTelemetry(
            query="?",
            query_type="SIMPLE",
            confidence=0.5,
            retrieval_type="HYBRID",
            top_k=3,
        )
        temp_storage.store(e)
        after = temp_storage.list_dates()
        assert len(after) == 1
        assert after[0] == date.today().isoformat()

    def test_event_count(self, temp_storage) -> None:
        assert temp_storage.event_count == 0
        e = RetrievalTelemetry(
            query="?",
            query_type="SIMPLE",
            confidence=0.5,
            retrieval_type="HYBRID",
            top_k=3,
        )
        temp_storage.store(e)
        assert temp_storage.event_count == 1

    def test_close(self, temp_storage) -> None:
        temp_storage.close()  # should not raise

    def test_read_file_not_found(self, temp_storage) -> None:
        with pytest.raises(FileNotFoundError):
            list(temp_storage.read("2099-01-01"))


class TestSerializationRoundTrip:
    def test_round_trip(self, sample_event) -> None:
        line = _event_to_jsonl(sample_event)
        restored = _jsonl_to_event(line)
        assert restored.query == sample_event.query
        assert restored.query_type == sample_event.query_type
        assert restored.confidence == sample_event.confidence
        assert restored.retrieval_type == sample_event.retrieval_type
        assert restored.top_k == sample_event.top_k
        assert restored.rerank == sample_event.rerank
        assert restored.decompose == sample_event.decompose
        assert restored.retrieved_chunks == sample_event.retrieved_chunks
        assert restored.retrieval_latency_ms == sample_event.retrieval_latency_ms
        assert restored.fallback_triggered == sample_event.fallback_triggered
        assert restored.fallback_reason == sample_event.fallback_reason
        assert restored.success == sample_event.success
        assert restored.timestamp == sample_event.timestamp

    def test_round_trip_query_id(self) -> None:
        e = RetrievalTelemetry(
            query="q",
            query_type="SIMPLE",
            confidence=0.5,
            retrieval_type="HYBRID",
            top_k=3,
            query_id="req-001",
            event_type="classification",
        )
        line = _event_to_jsonl(e)
        restored = _jsonl_to_event(line)
        assert restored.query_id == "req-001"
        assert restored.event_type == "classification"

    def test_round_trip_with_fallback(self) -> None:
        e = RetrievalTelemetry(
            query="q",
            query_type="COMPLEX",
            confidence=0.4,
            retrieval_type="MULTI_VECTOR",
            top_k=10,
            rerank=True,
            decompose=True,
            retrieved_chunks=15,
            retrieval_latency_ms=200.0,
            fallback_triggered=True,
            fallback_reason="low chunk count",
            success=True,
        )
        line = _event_to_jsonl(e)
        restored = _jsonl_to_event(line)
        assert restored.fallback_triggered
        assert restored.fallback_reason == "low chunk count"
        assert restored.rerank
        assert restored.decompose

    def test_round_trip_failure(self) -> None:
        e = RetrievalTelemetry(
            query="q",
            query_type="UNKNOWN",
            confidence=0.0,
            retrieval_type="UNKNOWN",
            top_k=0,
            success=False,
            fallback_reason="timeout",
        )
        line = _event_to_jsonl(e)
        restored = _jsonl_to_event(line)
        assert not restored.success
        assert restored.fallback_reason == "timeout"


# ======================================================================
# Collector
# ======================================================================


class TestTelemetryCollector:
    def test_record_retrieval(self, temp_collector) -> None:
        temp_collector.record_retrieval(
            query="test",
            query_type="SIMPLE",
            confidence=0.9,
            retrieval_type="HYBRID",
            top_k=3,
            retrieved_chunks=2,
            retrieval_latency_ms=10.0,
        )
        assert temp_collector.pending_count == 1
        temp_collector.flush()
        assert temp_collector.pending_count == 0

    def test_record_failure(self, temp_collector) -> None:
        temp_collector.record_failure(query="fail", fallback_reason="timeout")
        assert temp_collector.pending_count == 1

    def test_record_fallback(self, temp_collector) -> None:
        temp_collector.record_fallback(
            query="fb",
            query_type="COMPLEX",
            confidence=0.6,
            retrieval_type="MULTI_VECTOR",
            top_k=5,
            reason="low chunk count",
        )
        assert temp_collector.pending_count == 1

    def test_flush_writes_to_storage(self, temp_storage) -> None:
        col = TelemetryCollector(storage=temp_storage)
        col.record_retrieval(
            query="q1",
            query_type="SIMPLE",
            confidence=0.5,
            retrieval_type="HYBRID",
            top_k=3,
        )
        col.record_retrieval(
            query="q2",
            query_type="COMPLEX",
            confidence=0.5,
            retrieval_type="MULTI_VECTOR",
            top_k=5,
        )
        col.flush()
        assert temp_storage.event_count == 2

    def test_flush_no_storage(self) -> None:
        col = TelemetryCollector()  # no storage
        col.record_retrieval(
            query="q",
            query_type="SIMPLE",
            confidence=0.5,
            retrieval_type="HYBRID",
            top_k=3,
        )
        col.flush()  # should not crash

    def test_thread_safety(self, temp_storage) -> None:
        col = TelemetryCollector(storage=temp_storage)
        n = 100

        def worker():
            for i in range(n):
                col.record_retrieval(
                    query=f"q{i}",
                    query_type="SIMPLE",
                    confidence=0.5,
                    retrieval_type="HYBRID",
                    top_k=3,
                )

        threads = [threading.Thread(target=worker) for _ in range(4)]
        for t in threads:
            t.start()
        for t in threads:
            t.join()
        col.flush()
        assert temp_storage.event_count == 4 * n

    def test_on_event_callback(self) -> None:
        received: list[RetrievalTelemetry] = []

        def cb(event):
            received.append(event)

        col = TelemetryCollector(on_event=cb)
        col.record_retrieval(
            query="q",
            query_type="SIMPLE",
            confidence=0.5,
            retrieval_type="HYBRID",
            top_k=3,
        )
        assert len(received) == 1
        assert received[0].query == "q"

    def test_on_event_callback_does_not_block(self) -> None:
        def failing_cb(event):
            raise RuntimeError("callback error")

        col = TelemetryCollector(on_event=failing_cb)
        col.record_retrieval(
            query="q",
            query_type="SIMPLE",
            confidence=0.5,
            retrieval_type="HYBRID",
            top_k=3,
        )
        assert col.pending_count == 1  # event still buffered

    def test_close_flushes(self, temp_storage) -> None:
        col = TelemetryCollector(storage=temp_storage)
        col.record_retrieval(
            query="q",
            query_type="SIMPLE",
            confidence=0.5,
            retrieval_type="HYBRID",
            top_k=3,
        )
        col.close()
        assert temp_storage.event_count == 1


# ======================================================================
# Analytics
# ======================================================================


class TestComputeStrategyDistribution:
    def test_basic(self) -> None:
        events = [
            _make_event(retrieval_type="HYBRID"),
            _make_event(retrieval_type="HYBRID"),
            _make_event(retrieval_type="MULTI_VECTOR"),
        ]
        dist = compute_strategy_distribution(events)
        assert dist == {"HYBRID": 2, "MULTI_VECTOR": 1}

    def test_empty(self) -> None:
        assert compute_strategy_distribution([]) == {}

    def test_sorted_descending(self) -> None:
        events = [
            _make_event(retrieval_type="A"),
            _make_event(retrieval_type="B"),
            _make_event(retrieval_type="A"),
        ]
        dist = compute_strategy_distribution(events)
        keys = list(dist.keys())
        assert keys == ["A", "B"]  # A appears first (count 2 > 1)

    def test_filter_by_event_type(self) -> None:
        events = [
            _make_event(retrieval_type="HYBRID", event_type="classification"),
            _make_event(retrieval_type="MULTI_VECTOR", event_type="retrieval"),
            _make_event(retrieval_type="SELF_QUERYING", event_type="retrieval"),
        ]
        full = compute_strategy_distribution(events)
        assert full == {"HYBRID": 1, "MULTI_VECTOR": 1, "SELF_QUERYING": 1}
        retrievals = compute_strategy_distribution(events, event_type="retrieval")
        assert retrievals == {"MULTI_VECTOR": 1, "SELF_QUERYING": 1}
        classifications = compute_strategy_distribution(
            events, event_type="classification"
        )
        assert classifications == {"HYBRID": 1}


class TestComputeConfidenceDistribution:
    def test_default_bins(self) -> None:
        events = [
            _make_event(confidence=0.3),  # low
            _make_event(confidence=0.6),  # medium
            _make_event(confidence=0.9),  # high
        ]
        dist = compute_confidence_distribution(events)
        assert dist == {"0.0-0.5": 1, "0.5-0.8": 1, "0.8-1.0": 1}

    def test_empty(self) -> None:
        assert compute_confidence_distribution([]) == {
            "0.0-0.5": 0,
            "0.5-0.8": 0,
            "0.8-1.0": 0,
        }

    def test_custom_bins(self) -> None:
        events = [_make_event(confidence=0.2), _make_event(confidence=0.7)]
        dist = compute_confidence_distribution(events, bins=[0.0, 0.5, 1.0])
        assert dist == {"0.0-0.5": 1, "0.5-1.0": 1}

    def test_filter_by_event_type(self) -> None:
        events = [
            _make_event(confidence=0.3, event_type="classification"),
            _make_event(confidence=0.6, event_type="retrieval"),
            _make_event(confidence=0.9, event_type="retrieval"),
        ]
        self_dist = compute_confidence_distribution(events, event_type="retrieval")
        assert self_dist == {"0.0-0.5": 0, "0.5-0.8": 1, "0.8-1.0": 1}


class TestComputeFallbackRate:
    def test_no_fallback(self) -> None:
        events = [_make_event(), _make_event()]
        assert compute_fallback_rate(events) == 0.0

    def test_some_fallback(self) -> None:
        events = [
            _make_event(fallback_triggered=True),
            _make_event(fallback_triggered=False),
            _make_event(fallback_triggered=False),
        ]
        assert compute_fallback_rate(events) == pytest.approx(1 / 3)

    def test_all_fallback(self) -> None:
        events = [_make_event(fallback_triggered=True)]
        assert compute_fallback_rate(events) == 1.0

    def test_empty(self) -> None:
        assert compute_fallback_rate([]) == 0.0


class TestComputeAverageLatency:
    def test_basic(self) -> None:
        events = [
            _make_event(retrieval_latency_ms=10.0),
            _make_event(retrieval_latency_ms=20.0),
        ]
        assert compute_average_latency(events) == 15.0

    def test_empty(self) -> None:
        assert compute_average_latency([]) == 0.0

    def test_zero_values(self) -> None:
        events = [_make_event(retrieval_latency_ms=0.0)]
        assert compute_average_latency(events) == 0.0


class TestComputeSuccessRate:
    def test_all_success(self) -> None:
        events = [_make_event(success=True), _make_event(success=True)]
        assert compute_success_rate(events) == 1.0

    def test_some_fail(self) -> None:
        events = [_make_event(success=True), _make_event(success=False)]
        assert compute_success_rate(events) == 0.5

    def test_empty(self) -> None:
        assert compute_success_rate([]) == 1.0

    def test_all_fail(self) -> None:
        events = [_make_event(success=False)]
        assert compute_success_rate(events) == 0.0


# ======================================================================
# Integration
# ======================================================================


class TestCollectorStorageIntegration:
    def test_record_then_read(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            storage = TelemetryStorage(base_dir=tmp)
            col = TelemetryCollector(storage=storage)
            col.record_retrieval(
                query="integration test",
                query_type="MULTI_HOP",
                confidence=0.3,
                retrieval_type="SELF_QUERYING",
                top_k=5,
                rerank=False,
                decompose=True,
                retrieved_chunks=3,
                retrieval_latency_ms=250.0,
                fallback_triggered=True,
                fallback_reason="low confidence",
                success=True,
            )
            col.flush()
            dates = storage.list_dates()
            events = list(storage.read(dates[0]))
            assert len(events) == 1
            e = events[0]
            assert e.query == "integration test"
            assert e.query_type == "MULTI_HOP"
            assert e.confidence == 0.3
            assert e.retrieval_type == "SELF_QUERYING"
            assert e.top_k == 5
            assert not e.rerank
            assert e.decompose
            assert e.retrieved_chunks == 3
            assert e.retrieval_latency_ms == 250.0
            assert e.fallback_triggered
            assert e.fallback_reason == "low confidence"
            assert e.success


# ======================================================================
# Helpers
# ======================================================================


def _make_event(
    retrieval_type: str = "HYBRID",
    confidence: float = 0.9,
    fallback_triggered: bool = False,
    retrieval_latency_ms: float = 0.0,
    success: bool = True,
    event_type: str = "retrieval",
) -> RetrievalTelemetry:
    return RetrievalTelemetry(
        query="test",
        query_type="SIMPLE",
        confidence=confidence,
        retrieval_type=retrieval_type,
        top_k=3,
        retrieved_chunks=2,
        retrieval_latency_ms=retrieval_latency_ms,
        fallback_triggered=fallback_triggered,
        success=success,
        event_type=event_type,
    )
