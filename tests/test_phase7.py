"""Tests for Phase 7: Observability, Evaluation, and Dashboard."""

from __future__ import annotations

import json
import math
import time
from pathlib import Path
from typing import Any, Dict, List, Optional, Sequence, Set

import pytest

# ======================================================================
# Observability Tests
# ======================================================================

from intelligence.observability.tracing import Tracer, Span, get_tracer
from intelligence.observability.event_logger import EventLogger, Event, get_logger, console_sink, file_sink
from intelligence.observability.performance_monitor import PerformanceMonitor, LatencySnapshot, PerformanceSnapshot
from intelligence.observability.alerting import (
    AlertManager, Alert, AlertRule, AlertSeverity,
    LatencyAlertRule, FailureRateAlertRule, DegradedRecallAlertRule,
)
from intelligence.observability.metrics_registry import MetricsRegistry
from intelligence.observability.dashboard_metrics import DashboardMetricsCollector


# ---------------------------------------------------------------------------
# Tracing
# ---------------------------------------------------------------------------

class TestTracer:
    def test_start_trace_creates_span(self) -> None:
        tracer = Tracer()
        span = tracer.start_trace("test.operation")
        assert span.name == "test.operation"
        assert span.trace_id
        assert span.span_id
        assert span.parent_span_id is None

    def test_start_span_inherits_trace_id(self) -> None:
        tracer = Tracer()
        tracer.start_trace("root")
        child = tracer.start_span("child")
        assert child.trace_id is not None

    def test_end_span_records_duration(self) -> None:
        tracer = Tracer()
        span = tracer.start_trace("op")
        time.sleep(0.05)
        tracer.end_span(span)
        assert span.end_time is not None
        assert span.duration_ms > 1.0

    def test_context_manager(self) -> None:
        tracer = Tracer()
        with tracer.trace("test") as span:
            assert span.name == "test"
        assert span.end_time is not None

    def test_on_span_finish_callback(self) -> None:
        tracer = Tracer()
        finished: List[Span] = []
        tracer.on_span_finish(finished.append)
        span = tracer.start_trace("test")
        tracer.end_span(span)
        assert len(finished) == 1
        assert finished[0].name == "test"

    def test_span_to_dict(self) -> None:
        span = Span(name="test", trace_id="abc", span_id="def", start_time=100.0)
        d = span.to_dict()
        assert d["name"] == "test"
        assert d["trace_id"] == "abc"
        assert d["span_id"] == "def"

    def test_context_sets_error_status(self) -> None:
        tracer = Tracer()
        with pytest.raises(ValueError):
            with tracer.trace("fails") as span:
                raise ValueError("oops")
        assert span.status == "error"

    def test_get_tracer_returns_singleton(self) -> None:
        assert get_tracer() is get_tracer()


class TestSpan:
    def test_default_duration(self) -> None:
        span = Span(name="test", trace_id="1", span_id="2", start_time=100.0)
        assert span.duration_ms >= 0

    def test_duration_with_end_time(self) -> None:
        span = Span(name="test", trace_id="1", span_id="2", start_time=100.0, end_time=101.0)
        assert span.duration_ms == 1000.0

    def test_attributes(self) -> None:
        span = Span(name="test", trace_id="1", span_id="2", start_time=0.0, attributes={"key": "value"})
        assert span.attributes["key"] == "value"


# ---------------------------------------------------------------------------
# Event Logger
# ---------------------------------------------------------------------------

class TestEvent:
    def test_default_timestamp(self) -> None:
        event = Event(event_type="test", source="test")
        assert event.timestamp

    def test_to_dict(self) -> None:
        event = Event(event_type="test", source="src", attributes={"k": "v"}, trace_id="t1")
        d = event.to_dict()
        assert d["event_type"] == "test"
        assert d["attributes"]["k"] == "v"
        assert d["trace_id"] == "t1"


class TestEventLogger:
    def test_log_creates_event(self) -> None:
        logger = EventLogger()
        event = logger.log("test_event", "test_source")
        assert event.event_type == "test_event"
        assert event.source == "test_source"

    def test_pending_count(self) -> None:
        logger = EventLogger()
        logger.log("a", "src")
        logger.log("b", "src")
        assert logger.pending_count == 2

    def test_flush_clears_pending(self) -> None:
        logger = EventLogger()
        logger.log("a", "src")
        events = logger.flush()
        assert len(events) == 1
        assert logger.pending_count == 0

    def test_add_sink(self) -> None:
        logger = EventLogger()
        received: List[Event] = []
        logger.add_sink(received.append)
        logger.log("test", "src")
        assert len(received) == 1

    def test_sink_error_does_not_propagate(self) -> None:
        logger = EventLogger()
        def bad_sink(event: Event) -> None:
            raise RuntimeError("sink error")
        logger.add_sink(bad_sink)
        logger.log("test", "src")  # should not raise

    def test_log_with_attributes(self) -> None:
        logger = EventLogger()
        event = logger.log("test", "src", attributes={"latency_ms": 150.0})
        assert event.attributes["latency_ms"] == 150.0


class TestConsoleSink:
    def test_console_sink_does_not_raise(self, capsys) -> None:
        event = Event(event_type="test", source="src")
        console_sink(event)
        captured = capsys.readouterr()
        assert "test" in captured.out


class TestFileSink:
    def test_file_sink_writes_event(self, tmp_path: Path) -> None:
        path = str(tmp_path / "events.jsonl")
        sink = file_sink(path)
        event = Event(event_type="test", source="src")
        sink(event)
        with open(path, "r") as f:
            line = f.readline().strip()
        data = json.loads(line)
        assert data["event_type"] == "test"


# ---------------------------------------------------------------------------
# Performance Monitor
# ---------------------------------------------------------------------------

class TestPerformanceMonitor:
    def test_record_request(self) -> None:
        pm = PerformanceMonitor()
        pm.record_request(100.0, True)
        snap = pm.snapshot()
        assert snap.total_requests == 1
        assert snap.success_rate == 1.0

    def test_success_and_failure(self) -> None:
        pm = PerformanceMonitor()
        pm.record_request(50.0, True)
        pm.record_request(100.0, False)
        snap = pm.snapshot()
        assert snap.total_requests == 2
        assert snap.success_rate == 0.5
        assert snap.failure_rate == 0.5

    def test_latency_distribution(self) -> None:
        pm = PerformanceMonitor()
        for i in range(1, 101):
            pm.record_request(float(i), True)
        snap = pm.snapshot()
        assert snap.latency.p50 == pytest.approx(50.5, abs=1.0)
        assert snap.latency.p95 == pytest.approx(95.05, abs=1.0)
        assert snap.latency.p99 == pytest.approx(99.01, abs=1.0)
        assert snap.latency.mean == pytest.approx(50.5, abs=1.0)
        assert snap.latency.min == 1.0
        assert snap.latency.max == 100.0

    def test_empty_monitor(self) -> None:
        pm = PerformanceMonitor()
        snap = pm.snapshot()
        assert snap.total_requests == 0
        assert snap.success_rate == 0.0
        assert snap.latency.p50 == 0.0

    def test_record_success(self) -> None:
        pm = PerformanceMonitor()
        pm.record_success()
        snap = pm.snapshot()
        assert snap.total_requests == 1
        assert snap.success_rate == 1.0

    def test_record_failure(self) -> None:
        pm = PerformanceMonitor()
        pm.record_failure()
        snap = pm.snapshot()
        assert snap.total_requests == 1
        assert snap.failure_rate == 1.0

    def test_record_latency(self) -> None:
        pm = PerformanceMonitor()
        pm.record_latency(42.0)
        snap = pm.snapshot()
        assert snap.latency.mean == 42.0

    def test_window_size(self) -> None:
        pm = PerformanceMonitor(window_size=10)
        for i in range(20):
            pm.record_request(float(i), True)
        snap = pm.snapshot()
        # Should only keep last 10
        assert snap.latency.count <= 10


class TestLatencySnapshot:
    def test_defaults(self) -> None:
        ls = LatencySnapshot()
        assert ls.p50 == 0.0
        assert ls.p95 == 0.0
        assert ls.p99 == 0.0
        assert ls.mean == 0.0


class TestPerformanceSnapshot:
    def test_defaults(self) -> None:
        ps = PerformanceSnapshot()
        assert ps.total_requests == 0
        assert ps.success_rate == 0.0


# ---------------------------------------------------------------------------
# Alerting
# ---------------------------------------------------------------------------

class TestAlertManager:
    def test_add_rule(self) -> None:
        am = AlertManager()
        rule = LatencyAlertRule()
        am.add_rule(rule)
        assert len(am._rules) == 1

    def test_check_all_returns_fired(self) -> None:
        am = AlertManager()
        rule = LatencyAlertRule(threshold_ms=0.0)  # Will fire
        am.add_rule(rule)
        snap = LatencySnapshot(p95=100.0)
        fired = am.check_all(latency_snapshot=snap)
        assert len(fired) >= 1

    def test_handler_called(self) -> None:
        am = AlertManager()
        handled: List[Alert] = []
        am.add_handler(handled.append)
        rule = LatencyAlertRule(threshold_ms=0.0)
        am.add_rule(rule)
        am.check_all(latency_snapshot=LatencySnapshot(p95=100.0))
        assert len(handled) >= 1

    def test_clear(self) -> None:
        am = AlertManager()
        rule = LatencyAlertRule(threshold_ms=0.0)
        am.add_rule(rule)
        am.check_all(latency_snapshot=LatencySnapshot(p95=100.0))
        assert len(am.alerts) >= 1
        am.clear()
        assert len(am.alerts) == 0

    def test_cooldown(self) -> None:
        am = AlertManager()
        rule = LatencyAlertRule(threshold_ms=0.0, cooldown_seconds=3600)
        am.add_rule(rule)
        fired1 = am.check_all(latency_snapshot=LatencySnapshot(p95=100.0))
        fired2 = am.check_all(latency_snapshot=LatencySnapshot(p95=100.0))
        assert len(fired1) >= 1
        # Cooldown should suppress second firing
        assert len(fired2) == 0

    def test_handler_error_does_not_propagate(self) -> None:
        am = AlertManager()
        def bad_handler(alert: Alert) -> None:
            raise RuntimeError("handler error")
        am.add_handler(bad_handler)
        rule = LatencyAlertRule(threshold_ms=0.0)
        am.add_rule(rule)
        am.check_all(latency_snapshot=LatencySnapshot(p95=100.0))


class TestAlert:
    def test_default_timestamp(self) -> None:
        alert = Alert(rule_name="test", message="test", severity="warning")
        assert alert.timestamp

    def test_to_dict(self) -> None:
        alert = Alert(rule_name="test", message="test", metric_value=0.5, threshold=0.3)
        d = alert.to_dict()
        assert d["rule_name"] == "test"
        assert d["metric_value"] == 0.5
        assert d["threshold"] == 0.3


class TestAlertRules:
    def test_latency_alert_triggers(self) -> None:
        rule = LatencyAlertRule(threshold_ms=100.0, cooldown_seconds=0)
        alert = rule.evaluate(latency_snapshot=LatencySnapshot(p95=200.0))
        assert alert is not None
        assert alert.severity == AlertSeverity.WARNING

    def test_latency_alert_no_trigger(self) -> None:
        rule = LatencyAlertRule(threshold_ms=500.0, cooldown_seconds=0)
        alert = rule.evaluate(latency_snapshot=LatencySnapshot(p95=100.0))
        assert alert is None

    def test_failure_rate_alert_triggers(self) -> None:
        rule = FailureRateAlertRule(threshold=0.05, cooldown_seconds=0)
        alert = rule.evaluate(failure_rate=0.5)
        assert alert is not None
        assert alert.severity == AlertSeverity.CRITICAL

    def test_failure_rate_alert_no_trigger(self) -> None:
        rule = FailureRateAlertRule(threshold=0.1, cooldown_seconds=0)
        alert = rule.evaluate(failure_rate=0.05)
        assert alert is None

    def test_degraded_recall_alert_triggers(self) -> None:
        rule = DegradedRecallAlertRule(threshold=0.8, cooldown_seconds=0)
        alert = rule.evaluate(recall=0.5)
        assert alert is not None

    def test_degraded_recall_alert_no_trigger(self) -> None:
        rule = DegradedRecallAlertRule(threshold=0.5, cooldown_seconds=0)
        alert = rule.evaluate(recall=0.8)
        assert alert is None

    def test_latency_alert_with_p99(self) -> None:
        rule = LatencyAlertRule(percentile="p99", threshold_ms=100.0, cooldown_seconds=0)
        alert = rule.evaluate(latency_snapshot=LatencySnapshot(p99=200.0))
        assert alert is not None

    def test_rule_name_is_set(self) -> None:
        rule = LatencyAlertRule(name="custom_latency")
        assert rule.name == "custom_latency"

    def test_failure_rule_name(self) -> None:
        rule = FailureRateAlertRule()
        assert rule.name == "high_failure_rate"

    def test_recall_rule_name(self) -> None:
        rule = DegradedRecallAlertRule()
        assert rule.name == "degraded_recall"


# ---------------------------------------------------------------------------
# Metrics Registry
# ---------------------------------------------------------------------------

class TestMetricsRegistry:
    def test_record(self) -> None:
        reg = MetricsRegistry()
        reg.record("test_metric", 42.0)
        assert reg.point_count == 1

    def test_increment(self) -> None:
        reg = MetricsRegistry()
        reg.increment("counter")
        points = reg.query(name="counter")
        assert len(points) == 1
        assert points[0].value == 1.0

    def test_query_by_name(self) -> None:
        reg = MetricsRegistry()
        reg.record("a", 1.0)
        reg.record("b", 2.0)
        assert len(reg.query(name="a")) == 1

    def test_query_by_labels(self) -> None:
        reg = MetricsRegistry()
        reg.record("m", 1.0, labels={"env": "test"})
        reg.record("m", 2.0, labels={"env": "prod"})
        assert len(reg.query(labels={"env": "test"})) == 1

    def test_clear(self) -> None:
        reg = MetricsRegistry()
        reg.record("m", 1.0)
        reg.clear()
        assert reg.point_count == 0

    def test_query_limit(self) -> None:
        reg = MetricsRegistry()
        for i in range(100):
            reg.record("m", float(i))
        assert len(reg.query(limit=10)) == 10


# ---------------------------------------------------------------------------
# Dashboard Metrics Collector
# ---------------------------------------------------------------------------

class TestDashboardMetricsCollector:
    def test_collect_system_overview(self) -> None:
        monitor = PerformanceMonitor()
        logger = EventLogger()
        registry = MetricsRegistry()
        alert_manager = AlertManager()

        monitor.record_request(100.0, True)
        logger.log("test", "src")
        registry.record("m", 1.0)

        collector = DashboardMetricsCollector(
            monitor=monitor, logger=logger,
            registry=registry, alert_manager=alert_manager,
        )
        overview = collector.collect_system_overview()
        assert overview["performance"]["total_requests"] == 1
        assert overview["latency"]["mean_ms"] == 100.0

    def test_collect_latency_distribution(self) -> None:
        monitor = PerformanceMonitor()
        monitor.record_request(50.0, True)
        collector = DashboardMetricsCollector(monitor=monitor)
        dist = collector.collect_latency_distribution()
        assert dist["mean"] == 50.0

    def test_collect_event_summary(self) -> None:
        logger = EventLogger()
        logger.log("type_a", "src")
        logger.log("type_b", "src")
        collector = DashboardMetricsCollector(logger=logger)
        summary = collector.collect_event_summary()
        assert summary["total"] == 2


# ======================================================================
# Evaluation Tests
# ======================================================================

from intelligence.evaluation.ranking_metrics import (
    reciprocal_rank,
    mean_reciprocal_rank,
    average_precision,
    mean_average_precision,
    discounted_cumulative_gain,
    normalized_dcg,
    hit_rate,
)
from intelligence.evaluation.evaluator import Evaluator, EvaluationResult, AggregateEvaluation
from intelligence.evaluation.ground_truth import GroundTruth, GroundTruthEntry
from intelligence.evaluation.retrieval_benchmark import run_retrieval_benchmark
from intelligence.evaluation.reporting import generate_evaluation_report, evaluate_retrieval_strategies


# ---------------------------------------------------------------------------
# Ranking Metrics
# ---------------------------------------------------------------------------

class TestReciprocalRank:
    def test_first_is_relevant(self) -> None:
        assert reciprocal_rank({"a"}, ["a", "b", "c"]) == 1.0

    def test_second_is_relevant(self) -> None:
        assert reciprocal_rank({"b"}, ["a", "b", "c"]) == 0.5

    def test_none_relevant(self) -> None:
        assert reciprocal_rank({"d"}, ["a", "b", "c"]) == 0.0

    def test_empty_relevant(self) -> None:
        assert reciprocal_rank(set(), ["a", "b"]) == 0.0

    def test_empty_retrieved(self) -> None:
        assert reciprocal_rank({"a"}, []) == 0.0


class TestMeanReciprocalRank:
    def test_all_queries_have_relevant(self) -> None:
        queries = [["a", "b"], ["x", "y"]]
        relevants = [{"a"}, {"x"}]
        mrr = mean_reciprocal_rank(queries, relevants)
        assert mrr == 1.0

    def test_some_not_relevant(self) -> None:
        queries = [["a", "b"], ["c", "d"]]
        relevants = [{"a"}, {"x"}]
        mrr = mean_reciprocal_rank(queries, relevants)
        assert mrr == 0.5

    def test_empty_inputs(self) -> None:
        assert mean_reciprocal_rank([], []) == 0.0


class TestAveragePrecision:
    def test_all_relevant(self) -> None:
        ap = average_precision({"a", "b"}, ["a", "b", "c"])
        assert ap == pytest.approx(1.0, abs=0.01)

    def test_partial(self) -> None:
        ap = average_precision({"a", "c"}, ["a", "b", "c"])
        # AP = (1/1 + 2/3) / 2 = (1 + 0.667) / 2 = 0.833
        assert ap == pytest.approx(0.833, abs=0.01)

    def test_none_relevant(self) -> None:
        ap = average_precision({"x"}, ["a", "b"])
        assert ap == 0.0

    def test_empty_relevant(self) -> None:
        assert average_precision(set(), ["a", "b"]) == 0.0


class TestMeanAveragePrecision:
    def test_basic(self) -> None:
        queries = [["a", "b"], ["x", "y"]]
        relevants = [{"a"}, {"x"}]
        map_score = mean_average_precision(queries, relevants)
        assert map_score == pytest.approx(1.0, abs=0.01)

    def test_empty(self) -> None:
        assert mean_average_precision([], []) == 0.0


class TestDCG:
    def test_identical_relevances(self) -> None:
        dcg = discounted_cumulative_gain([1.0, 1.0, 1.0])
        assert dcg > 0

    def test_zero_relevances(self) -> None:
        dcg = discounted_cumulative_gain([0.0, 0.0])
        assert dcg == 0.0

    def test_empty(self) -> None:
        assert discounted_cumulative_gain([]) == 0.0

    def test_at_k(self) -> None:
        dcg = discounted_cumulative_gain([1.0, 1.0, 1.0], k=2)
        assert dcg == pytest.approx(1.0 + 1.0, abs=0.01)

    def test_first_position_highest_weight(self) -> None:
        full = discounted_cumulative_gain([1.0, 0.0, 0.0])
        assert full == 1.0


class TestNDCG:
    def test_perfect_ranking(self) -> None:
        ndcg = normalized_dcg([3.0, 2.0, 1.0])
        assert ndcg == pytest.approx(1.0, abs=0.01)

    def test_imperfect_ranking(self) -> None:
        ndcg = normalized_dcg([1.0, 2.0, 3.0])
        assert ndcg < 1.0

    def test_all_zero(self) -> None:
        assert normalized_dcg([0.0, 0.0]) == 0.0

    def test_empty(self) -> None:
        assert normalized_dcg([]) == 0.0


class TestHitRate:
    def test_all_hits(self) -> None:
        queries = [["a", "b"], ["c", "d"]]
        relevants = [{"a"}, {"c"}]
        assert hit_rate(queries, relevants) == 1.0

    def test_some_hits(self) -> None:
        queries = [["a", "b"], ["x", "y"]]
        relevants = [{"a"}, {"z"}]
        assert hit_rate(queries, relevants) == 0.5

    def test_no_hits(self) -> None:
        queries = [["a"], ["b"]]
        relevants = [{"x"}, {"y"}]
        assert hit_rate(queries, relevants) == 0.0

    def test_empty(self) -> None:
        assert hit_rate([], []) == 0.0

    def test_at_k(self) -> None:
        queries = [["a", "b", "c"], ["d", "e", "f"]]
        relevants = [{"c"}, {"g"}]
        assert hit_rate(queries, relevants, k=2) == 0.0
        assert hit_rate(queries, relevants, k=3) == 0.5


# ---------------------------------------------------------------------------
# Evaluator
# ---------------------------------------------------------------------------

class TestEvaluator:
    def test_basic_evaluation(self) -> None:
        evaluator = Evaluator()
        result = evaluator.evaluate(
            retrieved=[["a", "b"], ["c", "d"]],
            relevant=[{"a"}, {"c"}],
        )
        assert result.n_queries == 2
        assert result.mrr == 1.0
        assert result.hit_rate == 1.0

    def test_empty_input(self) -> None:
        evaluator = Evaluator()
        result = evaluator.evaluate(retrieved=[], relevant=[])
        assert result.n_queries == 0

    def test_with_latency_and_success(self) -> None:
        evaluator = Evaluator()
        result = evaluator.evaluate(
            retrieved=[["a"]],
            relevant=[{"a"}],
            latencies_ms=[150.0],
            successes=[True],
        )
        assert result.mean_latency_ms == 150.0
        assert result.success_rate == 1.0

    def test_partial_results(self) -> None:
        evaluator = Evaluator()
        result = evaluator.evaluate(
            retrieved=[["a", "b"], ["c", "d", "e"]],
            relevant=[{"x"}, {"c", "e"}],
        )
        assert result.n_queries == 2
        assert result.mean_precision >= 0

    def test_per_query_results_created(self) -> None:
        evaluator = Evaluator()
        result = evaluator.evaluate(
            retrieved=[["a"], ["b"]],
            relevant=[{"a"}, {"x"}],
            query_ids=["q1", "q2"],
            query_types=["simple", "complex"],
        )
        assert len(result.per_query_results) == 2
        assert result.per_query_results[0].query_id == "q1"
        assert result.per_query_results[0].hit is True
        assert result.per_query_results[1].hit is False


# ---------------------------------------------------------------------------
# Ground Truth
# ---------------------------------------------------------------------------

class TestGroundTruth:
    def test_add_entry(self) -> None:
        gt = GroundTruth()
        gt.add_entry(GroundTruthEntry(query="test", query_id="q1", relevant_docs={"d1", "d2"}))
        assert gt.count == 1

    def test_get_by_query_id(self) -> None:
        gt = GroundTruth()
        gt.add_entry(GroundTruthEntry(query="q", query_id="q1", relevant_docs={"d1"}))
        entry = gt.get_by_query_id("q1")
        assert entry is not None
        assert entry.query == "q"

    def test_get_by_query_id_not_found(self) -> None:
        gt = GroundTruth()
        assert gt.get_by_query_id("nonexistent") is None

    def test_get_by_query(self) -> None:
        gt = GroundTruth()
        gt.add_entry(GroundTruthEntry(query="my query", query_id="q1", relevant_docs={"d1"}))
        entry = gt.get_by_query("my query")
        assert entry is not None

    def test_get_by_query_not_found(self) -> None:
        gt = GroundTruth()
        assert gt.get_by_query("unknown") is None

    def test_add_entries(self) -> None:
        gt = GroundTruth()
        gt.add_entries([
            GroundTruthEntry(query="q1", relevant_docs={"d1"}),
            GroundTruthEntry(query="q2", relevant_docs={"d2"}),
        ])
        assert gt.count == 2

    def test_entries_property(self) -> None:
        gt = GroundTruth()
        gt.add_entry(GroundTruthEntry(query="q", relevant_docs={"d"}))
        entries = gt.entries
        assert len(entries) == 1

    def test_to_dict_and_from_dict(self) -> None:
        gt = GroundTruth()
        gt.add_entry(GroundTruthEntry(query="q", query_id="q1", query_type="simple", relevant_docs={"d1", "d2"}))
        d = gt.to_dict()
        gt2 = GroundTruth.from_dict(d)
        assert gt2.count == 1
        assert gt2.entries[0].query == "q"

    def test_empty(self) -> None:
        gt = GroundTruth()
        assert gt.count == 0


# ---------------------------------------------------------------------------
# Retrieval Benchmark
# ---------------------------------------------------------------------------

class TestRunRetrievalBenchmark:
    def test_basic_benchmark(self) -> None:
        gt = GroundTruth()
        gt.add_entry(GroundTruthEntry(query="q1", query_id="id1", relevant_docs={"d1", "d2"}))

        def fake_retriever(query: str, query_type: str, top_k: Optional[int] = None):
            return ["d1", "d2"], 100.0, True

        result = run_retrieval_benchmark(fake_retriever, gt)
        assert result.n_queries == 1
        assert result.mean_recall == 1.0

    def test_empty_ground_truth(self) -> None:
        gt = GroundTruth()
        def fake_retriever(query, query_type, top_k):
            return ["d1"], 0.0, True
        result = run_retrieval_benchmark(fake_retriever, gt)
        assert result.n_queries == 0

    def test_partial_results(self) -> None:
        gt = GroundTruth()
        gt.add_entry(GroundTruthEntry(query="q1", query_id="id1", relevant_docs={"d1"}))
        gt.add_entry(GroundTruthEntry(query="q2", query_id="id2", relevant_docs={"x", "y"}))

        def fake_retriever(query: str, query_type: str, top_k: Optional[int] = None):
            if "q1" in query:
                return ["d1"], 50.0, True
            return ["a", "b"], 100.0, True

        result = run_retrieval_benchmark(fake_retriever, gt)
        assert result.n_queries == 2
        assert result.mean_recall == 0.5  # q1=1.0, q2=0.0


# ---------------------------------------------------------------------------
# Evaluation Reporting
# ---------------------------------------------------------------------------

class TestGenerateEvaluationReport:
    def test_generates_markdown(self) -> None:
        eval_result = AggregateEvaluation(
            n_queries=5,
            mean_recall=0.85,
            mean_precision=0.72,
            mrr=0.90,
            map=0.80,
            mean_ndcg=0.88,
            hit_rate=0.95,
            mean_latency_ms=150.0,
            success_rate=0.98,
        )
        report = generate_evaluation_report(eval_result)
        assert "MRR" in report
        assert "MAP" in report
        assert "NDCG" in report
        assert "Hit Rate" in report

    def test_with_per_query(self) -> None:
        eval_result = AggregateEvaluation(
            n_queries=1,
            mean_recall=1.0,
            per_query_results=[
                EvaluationResult(query_id="q1", recall=1.0, precision=1.0, reciprocal_rank=1.0,
                                 average_precision=1.0, ndcg=1.0, hit=True, latency_ms=50.0, success=True),
            ],
        )
        report = generate_evaluation_report(eval_result)
        assert "| q1" in report

    def test_custom_title(self) -> None:
        eval_result = AggregateEvaluation(n_queries=0)
        report = generate_evaluation_report(eval_result, title="Custom")
        assert "Custom" in report


class TestEvaluateRetrievalStrategies:
    def test_compare_strategies(self) -> None:
        a = AggregateEvaluation(n_queries=10, mean_recall=0.85, mean_precision=0.72, mrr=0.90, map=0.80, mean_ndcg=0.88, hit_rate=0.95, mean_latency_ms=150.0, success_rate=0.98)
        b = AggregateEvaluation(n_queries=10, mean_recall=0.78, mean_precision=0.65, mrr=0.82, map=0.72, mean_ndcg=0.80, hit_rate=0.90, mean_latency_ms=200.0, success_rate=0.95)
        report = evaluate_retrieval_strategies({"Strategy A": a, "Strategy B": b})
        assert "Strategy A" in report
        assert "Strategy B" in report


# ======================================================================
# Dashboard Smoke Tests
# ======================================================================

class TestDashboardImports:
    def test_app_imports(self) -> None:
        # Just verify the dashboard modules can be imported
        import dashboard.pages.experiments
        import dashboard.pages.benchmarks
        import dashboard.pages.ablations
        import dashboard.pages.statistics
        import dashboard.pages.observability
        # No assertion needed — if import succeeds, it's fine

    def test_app_main_exists(self) -> None:
        from dashboard.app import main
        assert callable(main)


# ======================================================================
# Integration Tests
# ======================================================================

class TestTracingWithEventLogger:
    def test_trace_and_log_integration(self) -> None:
        tracer = Tracer()
        logger = EventLogger()

        received: List[Event] = []
        logger.add_sink(received.append)

        tracer.on_span_finish(lambda span: logger.log(
            event_type="span.finished",
            source="tracer",
            attributes={"span_name": span.name, "duration_ms": span.duration_ms},
            trace_id=span.trace_id,
            span_id=span.span_id,
        ))

        with tracer.trace("test.op") as span:
            pass

        assert len(received) >= 1
        assert received[0].event_type == "span.finished"
        assert received[0].attributes["span_name"] == "test.op"


class TestMonitorWithAlerting:
    def test_monitor_feeds_alerts(self) -> None:
        monitor = PerformanceMonitor()
        alert_manager = AlertManager()
        alert_manager.add_rule(LatencyAlertRule(threshold_ms=100.0, cooldown_seconds=0))
        alert_manager.add_rule(FailureRateAlertRule(threshold=0.1, cooldown_seconds=0))

        # Record some high-latency requests with failures
        for i in range(5):
            monitor.record_request(500.0, False)

        snap = monitor.snapshot()
        fired = alert_manager.check_all(
            latency_snapshot=snap.latency,
            failure_rate=snap.failure_rate,
        )
        assert len(fired) >= 2  # Both latency and failure should fire


class TestEvaluatorWithAllMetrics:
    def test_all_metrics_computed(self) -> None:
        evaluator = Evaluator()
        result = evaluator.evaluate(
            retrieved=[["a", "b", "c"], ["d", "e", "f"]],
            relevant=[{"a", "b"}, {"e"}],
            query_ids=["q1", "q2"],
            query_types=["simple", "complex"],
            latencies_ms=[100.0, 200.0],
            successes=[True, False],
        )
        assert result.n_queries == 2
        assert result.mean_recall >= 0
        assert result.mean_precision >= 0
        assert result.mrr >= 0
        assert result.map >= 0
        assert result.mean_ndcg >= 0
        # q1: retrieved=["a","b","c"], relevant={"a","b"} -> HIT
        # q2: retrieved=["d","e","f"], relevant={"e"} -> HIT
        assert result.hit_rate == 1.0

        # Check per-query
        assert len(result.per_query_results) == 2
        assert result.per_query_results[0].success is True
        assert result.per_query_results[1].success is False


class TestAggregateEvaluationToDict:
    def test_to_dict(self) -> None:
        agg = AggregateEvaluation(
            n_queries=5,
            mean_recall=0.85,
            mean_precision=0.72,
            mrr=0.90,
            map=0.80,
            mean_ndcg=0.88,
            hit_rate=0.95,
            mean_latency_ms=150.0,
            success_rate=0.98,
        )
        d = agg.to_dict()
        assert d["n_queries"] == 5
        assert d["mrr"] == 0.90


class TestEvaluationResultFields:
    def test_defaults(self) -> None:
        er = EvaluationResult()
        assert er.recall == 0.0
        assert er.precision == 0.0
        assert er.reciprocal_rank == 0.0
        assert er.average_precision == 0.0
        assert er.ndcg == 0.0
        assert er.hit is False
        assert er.success is True
