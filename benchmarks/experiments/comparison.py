"""Comparison module — compute metric deltas between baseline and treatment.

Usage::

    >>> from benchmarks.experiments import compare
    >>> comparison = compare(baseline_result, treatment_result)
    >>> comparison.recall_delta  # treatment - baseline
    """

from __future__ import annotations

import json
import os
from dataclasses import dataclass, field, fields
from typing import Dict, List, Optional

from benchmarks.metrics import FailureRecord, compute_failure_rates, merge_records
from benchmarks.runner import RunnerResult


@dataclass(frozen=True)
class ComparisonResult:
    """Structured delta between baseline and treatment experiment results.

    Attributes:
        total_queries:    Number of queries executed in each run (must match).
        recall_delta:     Treatment recall minus baseline recall.
        precision_delta:  Treatment precision minus baseline precision.
        latency_delta_s:  Treatment average total latency minus baseline (seconds).
        failure_delta:    Per-category failure-rate deltas (treatment - baseline).
        per_type_recall_delta:   Recall delta broken down by query type.
        per_type_precision_delta: Precision delta broken down by query type.
        per_type_latency_delta_s:  Latency delta broken down by query type.
        per_type_failure_delta:  Failure-rate delta broken down by query type.

    All deltas are **treatment minus baseline**, so a positive ``recall_delta``
    means the treatment improved recall.
    """

    total_queries: int = 0
    recall_delta: Optional[float] = None
    precision_delta: Optional[float] = None
    latency_delta_s: float = 0.0
    failure_delta: Dict[str, float] = field(default_factory=dict)
    per_type_recall_delta: Dict[str, Optional[float]] = field(default_factory=dict)
    per_type_precision_delta: Dict[str, Optional[float]] = field(default_factory=dict)
    per_type_latency_delta_s: Dict[str, float] = field(default_factory=dict)
    per_type_failure_delta: Dict[str, Dict[str, float]] = field(default_factory=dict)


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------


def compare(
    baseline: RunnerResult,
    treatment: RunnerResult,
) -> ComparisonResult:
    """Compute metric deltas between baseline and treatment runs.

    All deltas are **treatment minus baseline** — a positive *recall_delta*
    means the treatment outperformed the baseline.

    Parameters
    ----------
    baseline:
        Aggregate result from :class:`BaselineExperimentRunner`.
    treatment:
        Aggregate result from :class:`TreatmentExperimentRunner`.

    Returns
    -------
    ComparisonResult
        Frozen dataclass holding all computed deltas.

    Raises
    ------
    ValueError
        If the two runs have different query counts.
    """
    if baseline.total_queries != treatment.total_queries:
        raise ValueError(
            f"Baseline ({baseline.total_queries}) and treatment "
            f"({treatment.total_queries}) must have the same number of queries"
        )

    total = baseline.total_queries

    # --- Aggregate deltas ---

    recall_delta = _opt_sub(
        treatment.average_recall(), baseline.average_recall()
    )
    precision_delta = _opt_sub(
        treatment.average_precision(), baseline.average_precision()
    )
    latency_delta_s = (
        treatment.average_latency().total - baseline.average_latency().total
    )

    baseline_rates = compute_failure_rates(baseline.aggregated_failures())
    treatment_rates = compute_failure_rates(treatment.aggregated_failures())
    failure_delta: Dict[str, float] = {}
    for key in baseline_rates:
        failure_delta[key] = treatment_rates[key] - baseline_rates[key]

    # --- Per-type deltas ---

    baseline_recall = baseline.per_type_recall()
    treatment_recall = treatment.per_type_recall()
    all_types = set(baseline_recall) | set(treatment_recall)
    per_type_recall_delta: Dict[str, Optional[float]] = {}
    for qt in sorted(all_types):
        per_type_recall_delta[qt] = _opt_sub(
            treatment_recall.get(qt), baseline_recall.get(qt)
        )

    baseline_precision = baseline.per_type_precision()
    treatment_precision = treatment.per_type_precision()
    per_type_precision_delta: Dict[str, Optional[float]] = {}
    for qt in sorted(all_types):
        per_type_precision_delta[qt] = _opt_sub(
            treatment_precision.get(qt), baseline_precision.get(qt)
        )

    baseline_pt_latency = baseline.per_type_latency()
    treatment_pt_latency = treatment.per_type_latency()
    per_type_latency_delta_s: Dict[str, float] = {}
    for qt in sorted(all_types):
        bl = baseline_pt_latency.get(qt)
        tl = treatment_pt_latency.get(qt)
        bl_avg = bl.total / baseline.total_queries if bl else 0.0
        tl_avg = tl.total / treatment.total_queries if tl else 0.0
        per_type_latency_delta_s[qt] = tl_avg - bl_avg

    baseline_pt_failures = baseline.per_type_failures()
    treatment_pt_failures = treatment.per_type_failures()
    per_type_failure_delta: Dict[str, Dict[str, float]] = {}
    for qt in sorted(all_types):
        bf = baseline_pt_failures.get(qt, FailureRecord())
        tf = treatment_pt_failures.get(qt, FailureRecord())
        br = compute_failure_rates(bf)
        tr = compute_failure_rates(tf)
        per_type_failure_delta[qt] = {
            k: tr[k] - br[k] for k in br
        }

    return ComparisonResult(
        total_queries=total,
        recall_delta=recall_delta,
        precision_delta=precision_delta,
        latency_delta_s=latency_delta_s,
        failure_delta=failure_delta,
        per_type_recall_delta=per_type_recall_delta,
        per_type_precision_delta=per_type_precision_delta,
        per_type_latency_delta_s=per_type_latency_delta_s,
        per_type_failure_delta=per_type_failure_delta,
    )


def comparison_to_dict(comparison: ComparisonResult) -> Dict[str, object]:
    """Serialize a :class:`ComparisonResult` to a JSON-safe dict.

    Parameters
    ----------
    comparison:
        The comparison result to serialise.

    Returns
    -------
    dict
        A plain dict suitable for ``json.dump``.
    """
    return {
        "total_queries": comparison.total_queries,
        "recall_delta": comparison.recall_delta,
        "precision_delta": comparison.precision_delta,
        "latency_delta_s": comparison.latency_delta_s,
        "failure_delta": dict(comparison.failure_delta),
        "per_type_recall_delta": dict(comparison.per_type_recall_delta),
        "per_type_precision_delta": dict(comparison.per_type_precision_delta),
        "per_type_latency_delta_s": dict(comparison.per_type_latency_delta_s),
        "per_type_failure_delta": {
            k: dict(v) for k, v in comparison.per_type_failure_delta.items()
        },
    }


def save_comparison(
    comparison: ComparisonResult,
    path: os.PathLike[str],
) -> None:
    """Persist a :class:`ComparisonResult` as JSON.

    Parameters
    ----------
    comparison:
        The comparison to save.
    path:
        Destination file path.
    """
    with open(path, "w", encoding="utf-8") as f:
        json.dump(comparison_to_dict(comparison), f, indent=2)


# ---------------------------------------------------------------------------
# Internal
# ---------------------------------------------------------------------------


def _opt_sub(
    a: Optional[float], b: Optional[float]
) -> Optional[float]:
    """Subtract two optional floats, returning ``None`` when either is ``None``."""
    if a is None or b is None:
        return None
    return a - b
