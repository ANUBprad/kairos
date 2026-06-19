"""S13 — Run the first Kairos benchmark experiment.

Executes baseline (static strategy) and treatment (confidence-aware adaptive
retrieval) on 15 queries (5 simple, 5 complex, 5 multi-hop), saves structured
JSON results to ``benchmarks/results/``, and prints metric deltas.

Usage::

    python -m benchmarks.experiments.run_experiment

Validation assertions (fail loudly if unmet):
    - Baseline and treatment produce different planner decisions.
    - Confidence-aware budget routing is exercised (treatment top_k differs
      from static top_k for low-confidence queries).
    - Fallback path is exercised for at least one query.
"""

from __future__ import annotations

import json
import os
import sys
from pathlib import Path
from typing import Dict, List

from benchmarks.dataset import QueryEntry, load_dataset, get_by_type
from benchmarks.experiments import (
    BaselineExperimentRunner,
    ComparisonResult,
    TreatmentExperimentRunner,
    compare,
    save_result,
)
from benchmarks.experiments.comparison import save_comparison
from benchmarks.metrics import compute_failure_rates
from benchmarks.runner import MockRetriever

# ---------------------------------------------------------------------------
# Paths
# ---------------------------------------------------------------------------

RESULTS_DIR = Path(__file__).resolve().parent.parent.parent / "benchmarks" / "results"
BASELINE_PATH = RESULTS_DIR / "baseline_results.json"
TREATMENT_PATH = RESULTS_DIR / "treatment_results.json"
COMPARISON_PATH = RESULTS_DIR / "comparison_results.json"

# ---------------------------------------------------------------------------
# Experiment configuration
# ---------------------------------------------------------------------------

N_SIMPLE = 5
N_COMPLEX = 5
N_MULTI_HOP = 5

# Classifier confidence per query type (maps to HIGH / MEDIUM / LOW bands).
_CONFIDENCE_MAP: Dict[str, float] = {
    "simple": 0.95,    # HIGH   → static budget, no overrides
    "complex": 0.60,   # MEDIUM → budget overrides apply (+top_k, rerank on)
    "multi_hop": 0.30, # LOW    → aggressive overrides (+top_k, rerank, decompose)
}


def _classify(query: str, query_type: str) -> object:
    """Return a mock classifier result for *query_type*."""
    from unittest.mock import MagicMock

    schema = MagicMock(
        query_type=query_type,
        domain=None,
        confidence_score=_CONFIDENCE_MAP.get(query_type, 0.5),
    )
    return schema


def _build_classifier(entries: List[QueryEntry]) -> object:
    """Build a callable classifier that dispatches based on QueryEntry id."""
    from unittest.mock import MagicMock

    lookup: Dict[str, str] = {e.id: e.query_type for e in entries}

    def classify_with_confidence(query: str) -> object:
        # The query text is the raw QueryEntry.text; we need the id.
        # Match by looking up the entry text in our entries.
        for entry in entries:
            if entry.text == query:
                return _classify(query, entry.query_type)
        return _classify(query, "simple")

    clf = MagicMock()
    clf.classify_with_confidence = classify_with_confidence
    return clf


def _build_retriever(entries: List[QueryEntry]) -> MockRetriever:
    """Build a MockRetriever that returns chunks for each query.

    Returns the entry's ``expected_chunks`` for most queries.
    A few queries return partial or empty results to exercise the
    fallback path and produce varied recall/precision.
    """
    chunk_map: Dict[str, List[str]] = {}
    empty_ids: set[str] = set()

    for entry in entries:
        if entry.expected_chunks:
            # Return all but the last chunk for multi-hop queries with
            # >= 3 chunks (imperfect retrieval → varied recall/precision).
            if len(entry.expected_chunks) >= 3:
                chunk_map[entry.id] = list(entry.expected_chunks[:-1])
            else:
                chunk_map[entry.id] = list(entry.expected_chunks)
        else:
            chunk_map[entry.id] = [f"{entry.id}_chunk_1"]

    # Force two multi-hop queries to return empty (exercises fallback).
    multi_hop_ids = [e.id for e in entries if e.query_type == "multi_hop"]
    if len(multi_hop_ids) >= 2:
        empty_ids.add(multi_hop_ids[0])
        empty_ids.add(multi_hop_ids[1])

    return MockRetriever(chunk_map=chunk_map, empty_ids=empty_ids)


# ---------------------------------------------------------------------------
# Validation helpers
# ---------------------------------------------------------------------------


def _validate_comparison(
    comp: ComparisonResult,
    b_entries: int,
    t_entries: int,
) -> None:
    """Validate experiment invariants — raise on failure."""
    print("\n" + "=" * 60)
    print("VALIDATION")
    print("=" * 60)

    # 1. Same number of queries processed
    assert b_entries == t_entries, (
        f"Query count mismatch: baseline={b_entries} treatment={t_entries}"
    )
    print("  [PASS] Both runners processed the same number of queries.")

    # 2. Metric deltas were computed
    print(f"  [INFO] recall_delta    = {comp.recall_delta}")
    print(f"  [INFO] precision_delta = {comp.precision_delta}")
    assert comp.latency_delta_s is not None, "Latency delta was not computed"
    print(f"  [INFO] latency_delta_s = {comp.latency_delta_s:.6f}")

    # 3. Failure-rate delta was computed
    assert len(comp.failure_delta) > 0, "No failure-rate deltas computed"
    has_fb = any(
        "planner_fallback" in k for k in comp.failure_delta
    ) or any(
        "planner_fallback" in k
        for per_type in comp.per_type_failure_delta.values()
        for k in per_type
    )
    if has_fb:
        print("  [PASS] Fallback path was exercised (planner_fallback deltas present).")
    else:
        print("  [WARN] Fallback path was NOT exercised (no planner_fallback).")

    print("  [PASS] All validation checks complete.\n")


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------


def main() -> None:
    # ---- Load dataset ----
    print("Loading dataset ...")
    all_entries = load_dataset(validate=True)

    simple = get_by_type(all_entries, "simple")[:N_SIMPLE]
    complex_ = get_by_type(all_entries, "complex")[:N_COMPLEX]
    multi_hop = get_by_type(all_entries, "multi_hop")[:N_MULTI_HOP]
    entries = simple + complex_ + multi_hop
    print(f"  Selected {len(entries)} queries: "
          f"{len(simple)} simple, {len(complex_)} complex, {len(multi_hop)} multi-hop.")

    # ---- Shared dependencies ----
    classifier = _build_classifier(entries)
    retriever = _build_retriever(entries)

    # ---- Baseline ----
    print("\nRunning baseline (static strategy) ...")
    baseline_runner = BaselineExperimentRunner(
        classifier=classifier,
        retriever=retriever,
        validate=False,
    )
    baseline_result = baseline_runner.run(query_types=["simple", "complex", "multi_hop"])
    print(f"  Baseline: {baseline_result.total_queries} queries executed.")
    # Override with our filtered entries
    baseline_result_adj = baseline_result  # Runner already filtered

    # ---- Treatment ----
    print("\nRunning treatment (confidence-aware adaptive retrieval) ...")
    treatment_runner = TreatmentExperimentRunner(
        classifier=classifier,
        retriever=retriever,
        validate=False,
    )
    treatment_result = treatment_runner.run(query_types=["simple", "complex", "multi_hop"])
    print(f"  Treatment: {treatment_result.total_queries} queries executed.")

    # ---- Validate query counts match ----
    n = baseline_result.total_queries
    assert treatment_result.total_queries == n, (
        f"Query count mismatch: baseline={n} treatment={treatment_result.total_queries}"
    )

    # ---- Validate planner decisions differ ----
    b_configs = [qr.planner_decision.config for qr in baseline_result.results]
    t_configs = [qr.planner_decision.config for qr in treatment_result.results]
    configs_differ = any(b != t for b, t in zip(b_configs, t_configs))
    assert configs_differ, (
        "Baseline and treatment produced identical planner configs for all queries. "
        "Confidence-aware routing is NOT being exercised."
    )
    print("\n  [PASS] Baseline and treatment produce different planner decisions.")

    # Validate confidence-aware routing: at least one treatment query has
    # top_k > static default for its type.
    static_top_k = {"simple": 3, "complex": 8, "multi_hop": 3}
    budget_routed = False
    for qr in treatment_result.results:
        qt = qr.entry.query_type
        if qr.planner_decision.config.get("top_k", 0) > static_top_k.get(qt, 0):
            budget_routed = True
            break
    assert budget_routed, (
        "No treatment query received a budget override. "
        "Confidence-aware routing is NOT being exercised."
    )
    print("  [PASS] Confidence-aware budget routing is exercised.")

    # Validate fallback was exercised: at least one treatment query has
    # planner_fallback > 0.
    fallback_triggered = any(
        qr.failures.planner_fallback > 0 for qr in treatment_result.results
    )
    assert fallback_triggered, (
        "No treatment query triggered planner fallback. "
        "Fallback path is NOT being exercised."
    )
    print("  [PASS] Fallback path is exercised (planner_fallback > 0 detected).")

    # ---- Compare ----
    print("\nComparing baseline vs treatment ...")
    comparison = compare(baseline_result, treatment_result)

    # ---- Print deltas ----
    print("\n" + "=" * 60)
    print("METRIC DELTAS  (treatment - baseline)")
    print("=" * 60)
    print(f"  recall_delta          = {comparison.recall_delta}")
    print(f"  precision_delta       = {comparison.precision_delta}")
    print(f"  latency_delta (s)     = {comparison.latency_delta_s:.6f}")
    print(f"  failure_delta:")
    for key, val in comparison.failure_delta.items():
        print(f"    {key:35s} = {val:+.4f}")

    if comparison.per_type_recall_delta:
        print(f"\n  Per-type recall delta:")
        for qt, val in comparison.per_type_recall_delta.items():
            print(f"    {qt:15s} = {val}")
    if comparison.per_type_latency_delta_s:
        print(f"\n  Per-type latency delta (s):")
        for qt, val in comparison.per_type_latency_delta_s.items():
            print(f"    {qt:15s} = {val:+.6f}")

    # ---- Save results ----
    RESULTS_DIR.mkdir(parents=True, exist_ok=True)
    save_result(baseline_result, BASELINE_PATH)
    save_result(treatment_result, TREATMENT_PATH)
    save_comparison(comparison, COMPARISON_PATH)
    print(f"\nResults saved to:")
    print(f"  {BASELINE_PATH}")
    print(f"  {TREATMENT_PATH}")
    print(f"  {COMPARISON_PATH}")

    # ---- Validate experiment invariants ----
    _validate_comparison(
        comparison,
        b_entries=baseline_result.total_queries,
        t_entries=treatment_result.total_queries,
    )

    print("Experiment complete.")


if __name__ == "__main__":
    main()
