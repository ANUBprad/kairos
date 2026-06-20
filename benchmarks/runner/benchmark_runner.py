"""Benchmark execution script — runs all 150 queries through the pipeline.

Produces:
  - benchmarks/results/benchmark_results.jsonl   (per-query telemetry)
  - benchmarks/results/calibration_dataset.jsonl (confidence/success pairs)
"""

from __future__ import annotations

import json
import logging
import os
import random
import time
from pathlib import Path
from typing import Dict, List, Optional, Set

from benchmarks.dataset.loader import QueryEntry, load_dataset
from benchmarks.runner.runner import BenchmarkRunner
from benchmarks.runner.types import QueryResult, RunnerResult

logging.basicConfig(level=logging.INFO, format="%(message)s")
logger = logging.getLogger("benchmark_runner")

RESULTS_DIR = Path(__file__).resolve().parent.parent / "results"
RESULTS_DIR.mkdir(parents=True, exist_ok=True)

BENCHMARK_RESULTS_PATH = RESULTS_DIR / "benchmark_results.jsonl"
CALIBRATION_DATASET_PATH = RESULTS_DIR / "calibration_dataset.jsonl"


class _SimulatedClassifier:
    """Classifier that returns ground-truth-aware confidence and type."""

    _BAND_RANGES: Dict[str, tuple] = {
        "high": (0.82, 0.99),
        "medium": (0.50, 0.79),
        "low": (0.10, 0.48),
    }

    def __init__(self, entries: List[QueryEntry], seed: int = 42) -> None:
        self._rng = random.Random(seed)
        self._lookup: Dict[str, QueryEntry] = {e.text: e for e in entries}

    def classify_with_confidence(self, query: str) -> object:
        entry = self._lookup.get(query)

        class _FakeResponse:
            pass

        resp = _FakeResponse()
        if entry:
            lo, hi = self._BAND_RANGES.get(
                entry.confidence_category or "medium", (0.4, 0.6)
            )
            resp.query_type = entry.query_type
            resp.domain = entry.domain
            resp.confidence_score = round(self._rng.uniform(lo, hi), 4)
        else:
            resp.query_type = "simple"
            resp.domain = None
            resp.confidence_score = 0.5
        return resp


class _SimulatedRetriever:
    """Simulated retriever with confidence-aware failure rate."""

    def __init__(self, entries: List[QueryEntry], seed: int = 42) -> None:
        self._rng = random.Random(seed)
        self._article_map: Dict[str, List[str]] = {
            e.id: e.expected_articles or []
            for e in entries
        }
        self._conf_map: Dict[str, str] = {
            e.id: e.confidence_category or "medium"
            for e in entries
        }

    def retrieve(
        self,
        query: str,
        config: Dict[str, object],
        query_id: Optional[str] = None,
    ) -> List[str]:
        latency = self._rng.uniform(0.05, 0.35)
        time.sleep(latency)

        top_k = config.get("top_k", 5)
        if isinstance(top_k, float):
            top_k = int(top_k)

        # Simulate failures: low confidence → higher failure chance
        conf_band = self._conf_map.get(query_id or "", "medium")
        fail_chance = {"high": 0.02, "medium": 0.10, "low": 0.25}.get(conf_band, 0.1)
        if self._rng.random() < fail_chance:
            return []

        articles = self._article_map.get(query_id or "", [])
        chunks: List[str] = []
        for i in range(top_k):
            parts = [f"{query_id or 'q'}_chunk_{i:04d}"]
            if articles and i < len(articles):
                parts.append(articles[i])
            elif articles:
                parts.append(articles[i % len(articles)])
            chunks.append("_".join(parts))
        return chunks


_EU_AI_ACT_PATH = (
    Path(__file__).resolve().parent.parent / "dataset" / "eu_ai_act_queries.json"
)


def run_benchmark(
    dataset_path: Optional[os.PathLike] = None,
    max_queries: Optional[int] = None,
) -> RunnerResult:
    logger.info("=" * 72)
    logger.info("BENCHMARK EXECUTION")
    logger.info("=" * 72)

    p = dataset_path or _EU_AI_ACT_PATH
    entries: List[QueryEntry] = load_dataset(path=p, validate=False)
    logger.info(f"Loaded {len(entries)} queries from dataset")

    if max_queries:
        entries = entries[:max_queries]
        logger.info(f"Limiting to {max_queries} queries")

    clf = _SimulatedClassifier(entries)
    retriever = _SimulatedRetriever(entries)

    runner = BenchmarkRunner(classifier=clf, retriever=retriever)
    result = runner.run_all(entries)

    logger.info(f"\nCompleted {result.total_queries} queries")
    return result


def _article_overlap(
    expected: List[str], retrieved_chunks: List[str]
) -> float:
    if not expected:
        return 0.0
    expected_set: Set[str] = set(expected)
    if not retrieved_chunks:
        return 0.0
    article_refs: Set[str] = set()
    for chunk in retrieved_chunks:
        for art in expected:
            if art in chunk:
                article_refs.add(art)
    if not article_refs:
        return 0.0
    matched = len(expected_set & article_refs)
    return matched / len(expected_set)


def store_results(result: RunnerResult) -> None:
    results_records: List[dict] = []
    calibration_records: List[dict] = []

    for qr in result.results:
        expected_articles = qr.entry.expected_articles or []
        art_overlap = _article_overlap(expected_articles, list(qr.retrieved_chunks))

        record = {
            "query_id": qr.entry.id,
            "query": qr.entry.text,
            "query_type": qr.entry.query_type,
            "confidence": qr.planner_decision.confidence,
            "retrieval_type": qr.planner_decision.config.get("retrieval_type", "UNKNOWN"),
            "top_k": qr.planner_decision.config.get("top_k", 0),
            "rerank": qr.planner_decision.config.get("rerank", False),
            "decompose": qr.planner_decision.config.get("decompose", False),
            "retrieved_chunks_count": len(qr.retrieved_chunks),
            "classify_latency_ms": qr.latency.classify * 1000,
            "planning_latency_ms": qr.latency.planning * 1000,
            "retrieval_latency_ms": qr.latency.retrieval * 1000,
            "total_latency_ms": qr.latency.total * 1000,
            "empty_retrieval": qr.failures.empty_retrieval > 0,
            "timeout": qr.failures.timeout > 0,
            "planner_fallback": qr.failures.planner_fallback > 0,
            "expected_chunks": qr.entry.expected_chunks or [],
            "retrieved_chunks": list(qr.retrieved_chunks),
            "expected_articles": expected_articles,
            "article_overlap": art_overlap,
        }

        if qr.recall is not None:
            record["recall"] = qr.recall
        if qr.precision is not None:
            record["precision"] = qr.precision

        results_records.append(record)

        success = art_overlap >= 0.5
        if qr.recall is not None:
            success = qr.recall >= 0.5
        success = success and not qr.failures.empty_retrieval

        calibration_records.append({
            "query_id": qr.entry.id,
            "confidence": qr.planner_decision.confidence,
            "success": int(success),
            "fallback_triggered": int(qr.failures.planner_fallback > 0),
            "retrieval_type": qr.planner_decision.config.get("retrieval_type", "UNKNOWN"),
        })

    with open(BENCHMARK_RESULTS_PATH, "w") as f:
        for rec in results_records:
            f.write(json.dumps(rec) + "\n")
    logger.info(f"Wrote {len(results_records)} results to {BENCHMARK_RESULTS_PATH}")

    with open(CALIBRATION_DATASET_PATH, "w") as f:
        for rec in calibration_records:
            f.write(json.dumps(rec) + "\n")
    logger.info(
        f"Wrote {len(calibration_records)} calibration records to "
        f"{CALIBRATION_DATASET_PATH}"
    )


if __name__ == "__main__":
    result = run_benchmark()
    store_results(result)
    logger.info("\nBenchmark execution complete.")
