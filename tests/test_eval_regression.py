"""Tests for the regression/drift baseline snapshot (Phase D)."""

from __future__ import annotations

import json

from intelligence.evaluation.entry_result import EntryResult, RunResult
from intelligence.evaluation.regression import (
    DEFAULT_TOLERANCES,
    check_regression,
    load_baseline,
    save_baseline,
    snapshot,
)


def _run(recall: float = 1.0, latency_total: float = 1.0) -> RunResult:
    return RunResult(
        results=(
            EntryResult(
                entry_id="SIMPLE-001",
                query="q",
                query_type="simple",
                retrieved_chunks=("c1",),
                recall=recall,
                precision=0.5,
                latency_total=latency_total,
            ),
        )
    )


def test_snapshot_flattens_aggregates() -> None:
    data = snapshot(_run(recall=0.8))
    assert data["mean_recall"] == 0.8
    assert data["mean_latency.total"] == 1.0
    assert data["total_cost_usd"] == 0.0


def test_save_and_load_roundtrip(tmp_path) -> None:
    path = str(tmp_path / "baseline.json")
    save_baseline(_run(recall=0.8), path)
    raw = json.loads(open(path, encoding="utf-8").read())
    assert raw["version"] == 1
    assert raw["metrics"]["mean_recall"] == 0.8
    loaded = load_baseline(path)
    assert loaded["mean_recall"] == 0.8


def test_check_regression_passes_within_tolerance(tmp_path) -> None:
    path = str(tmp_path / "baseline.json")
    save_baseline(_run(recall=0.8), path)
    check = check_regression(_run(recall=0.79, latency_total=1.1), path)
    assert check.passed is True


def test_check_regression_flags_recall_drop(tmp_path) -> None:
    path = str(tmp_path / "baseline.json")
    save_baseline(_run(recall=0.8), path)
    check = check_regression(_run(recall=0.4), path)
    assert check.passed is False
    regression = check.deltas["mean_recall"]
    assert regression.baseline == 0.8
    assert regression.current == 0.4
    assert regression.delta == -0.4
    assert round(regression.tolerance, 4) == round(DEFAULT_TOLERANCES["mean_recall"], 4)


def test_check_regression_flags_latency_spike(tmp_path) -> None:
    path = str(tmp_path / "baseline.json")
    save_baseline(_run(latency_total=1.0), path)
    check = check_regression(_run(recall=1.0, latency_total=10.0), path)
    assert check.passed is False
    assert not check.deltas["mean_latency.total"].passed


def test_custom_tolerances_override_defaults(tmp_path) -> None:
    path = str(tmp_path / "baseline.json")
    save_baseline(_run(recall=0.8), path)
    check = check_regression(_run(recall=0.77), path, tolerances={"mean_recall": 0.02})
    assert check.passed is False

    check_loose = check_regression(_run(recall=0.77), path, tolerances={"mean_recall": 0.05})
    assert check_loose.passed is True


def test_missing_baseline_metric_is_regression(tmp_path) -> None:
    path = str(tmp_path / "baseline.json")
    save_baseline(_run(recall=0.8), path)
    baseline = json.loads(open(path, encoding="utf-8").read())
    baseline["metrics"]["mean_ndcg"] = 0.9
    with open(path, "w", encoding="utf-8") as f:
        json.dump(baseline, f)
    check = check_regression(_run(recall=0.8), path)
    assert check.passed is False
    assert "mean_ndcg" in check.deltas


def test_to_dict_reports_regressions(tmp_path) -> None:
    path = str(tmp_path / "baseline.json")
    save_baseline(_run(recall=0.8), path)
    report = check_regression(_run(recall=0.4), path).to_dict()
    assert report["passed"] is False
    assert "mean_recall" in report["regressions"]


def test_extra_current_metrics_are_ignored(tmp_path) -> None:
    path = str(tmp_path / "baseline.json")
    save_baseline(_run(recall=0.8), path)
    extra = _run(recall=0.8)
    check = check_regression(extra, path)
    assert check.passed is True