"""Unit tests for benchmarks.metrics.latency."""

from __future__ import annotations

import time

import pytest

from benchmarks.metrics import LatencyRecord, LatencyTracker


class TestLatencyTracker:
    """LatencyTracker measurement."""

    def test_single_phase(self) -> None:
        tracker = LatencyTracker()
        with tracker.measure("classify"):
            time.sleep(0.005)
        r = tracker.record()
        assert r.classify >= 0.005
        assert r.total >= 0.005

    def test_multiple_phases(self) -> None:
        tracker = LatencyTracker()
        with tracker.measure("classify"):
            time.sleep(0.003)
        with tracker.measure("retrieval"):
            time.sleep(0.007)
        r = tracker.record()
        assert r.classify >= 0.003
        assert r.retrieval >= 0.007
        assert r.total >= r.classify + r.retrieval

    def test_missing_phase_defaults_to_zero(self) -> None:
        tracker = LatencyTracker()
        with tracker.measure("classify"):
            time.sleep(0.001)
        r = tracker.record()
        assert r.planning == 0.0
        assert r.generation == 0.0

    def test_start_sets_total_reference(self) -> None:
        tracker = LatencyTracker()
        tracker.start()
        time.sleep(0.005)
        with tracker.measure("classify"):
            time.sleep(0.003)
        r = tracker.record()
        assert r.total >= 0.008

    def test_reset_clears_measurements(self) -> None:
        tracker = LatencyTracker()
        with tracker.measure("classify"):
            time.sleep(0.001)
        tracker.reset()
        r = tracker.record()
        assert r.classify == 0.0
        assert r.total == 0.0

    def test_phase_names(self) -> None:
        tracker = LatencyTracker()
        assert tracker.phase_names == ()
        with tracker.measure("classify"):
            pass
        assert tracker.phase_names == ("classify",)
        with tracker.measure("retrieval"):
            pass
        assert tracker.phase_names == ("classify", "retrieval")

    def test_exception_still_records_time(self) -> None:
        """Time is recorded even when the context raises."""
        tracker = LatencyTracker()
        with pytest.raises(ValueError):
            with tracker.measure("retrieval"):
                time.sleep(0.002)
                raise ValueError("boom")
        r = tracker.record()
        assert r.retrieval >= 0.002

    def test_empty_tracker(self) -> None:
        tracker = LatencyTracker()
        r = tracker.record()
        assert r.classify == 0.0
        assert r.planning == 0.0
        assert r.retrieval == 0.0
        assert r.generation == 0.0
        assert r.total == 0.0

    def test_overwrite_phase(self) -> None:
        """Measuring the same phase name twice keeps the latest value."""
        tracker = LatencyTracker()
        with tracker.measure("classify"):
            time.sleep(0.001)
        with tracker.measure("classify"):
            time.sleep(0.002)
        r = tracker.record()
        assert r.classify >= 0.002


class TestLatencyRecord:
    """LatencyRecord dataclass."""

    def test_frozen(self) -> None:
        record = LatencyRecord()
        with pytest.raises(AttributeError):
            record.classify = 0.5  # type: ignore[misc]

    def test_defaults(self) -> None:
        record = LatencyRecord()
        assert record.classify == 0.0
        assert record.planning == 0.0
        assert record.retrieval == 0.0
        assert record.generation == 0.0
        assert record.total == 0.0

    def test_partial_record(self) -> None:
        record = LatencyRecord(classify=0.1, retrieval=0.2, total=0.4)
        assert record.classify == 0.1
        assert record.planning == 0.0
        assert record.retrieval == 0.2
        assert record.generation == 0.0
        assert record.total == 0.4
