"""Benchmark evaluation — computes metrics and produces reports.

Functions:
    load_results(path)              — Load per-query results from JSONL.
    compute_metrics(records)        — Compute aggregate metrics.
    generate_report(records, path)  — Write benchmark_report.md.
"""

from __future__ import annotations

import json
import logging
import os
from collections import defaultdict
from pathlib import Path
from statistics import median
from typing import Dict, List, Optional

import numpy as np

logger = logging.getLogger("evaluator")
logging.basicConfig(level=logging.INFO, format="%(message)s")

RESULTS_DIR = Path(__file__).resolve().parent / "results"
REPORTS_DIR = Path(__file__).resolve().parent / "reports"
REPORTS_DIR.mkdir(parents=True, exist_ok=True)

REPORT_PATH = REPORTS_DIR / "benchmark_report.md"
CALIBRATION_PATH = RESULTS_DIR / "calibration_dataset.jsonl"


# ---------------------------------------------------------------------------
# Loading
# ---------------------------------------------------------------------------


def load_results(path: Optional[os.PathLike] = None) -> List[dict]:
    p = path or RESULTS_DIR / "benchmark_results.jsonl"
    records: List[dict] = []
    with open(p) as f:
        for line in f:
            line = line.strip()
            if line:
                records.append(json.loads(line))
    return records


# ---------------------------------------------------------------------------
# Metric computation
# ---------------------------------------------------------------------------


def _percentile(values: List[float], p: float) -> float:
    return float(np.percentile(values, p)) if values else 0.0


def compute_metrics(records: List[dict]) -> dict:
    n = len(records)
    if n == 0:
        return {"error": "no records"}

    confidences = [r["confidence"] for r in records]
    total_latencies = [r["total_latency_ms"] for r in records]
    retrieval_latencies = [r["retrieval_latency_ms"] for r in records]
    chunks_per_query = [r["retrieved_chunks_count"] for r in records]

    article_overlaps = [r.get("article_overlap", 0.0) for r in records if "article_overlap" in r]
    recalls = [r["recall"] for r in records if "recall" in r]

    fallback_count = sum(1 for r in records if r.get("planner_fallback", False))
    empty_count = sum(1 for r in records if r.get("empty_retrieval", False))
    timeout_count = sum(1 for r in records if r.get("timeout", False))

    type_counts: Dict[str, int] = defaultdict(int)
    type_fallback: Dict[str, int] = defaultdict(int)
    type_latency: Dict[str, List[float]] = defaultdict(list)
    type_recall: Dict[str, List[float]] = defaultdict(list)
    strategy_counts: Dict[str, int] = defaultdict(int)
    confidence_bands: Dict[str, int] = defaultdict(int)

    for r in records:
        qt = r.get("query_type", "unknown")
        type_counts[qt] += 1
        if r.get("planner_fallback", False):
            type_fallback[qt] += 1
        type_latency[qt].append(r.get("total_latency_ms", 0))
        if "recall" in r:
            type_recall[qt].append(r["recall"])

        rt = r.get("retrieval_type", "UNKNOWN")
        strategy_counts[rt] += 1

        c = r.get("confidence", 0.5)
        if c >= 0.8:
            confidence_bands["high"] += 1
        elif c >= 0.5:
            confidence_bands["medium"] += 1
        else:
            confidence_bands["low"] += 1

    fallback_rate = fallback_count / n if n else 0.0

    accuracy_count = 0
    for r in records:
        art_overlap = r.get("article_overlap")
        if art_overlap is not None and art_overlap >= 0.5:
            accuracy_count += 1
        elif "recall" in r and r["recall"] >= 0.5:
            accuracy_count += 1
        elif not r.get("planner_fallback", False) and not r.get("empty_retrieval", False):
            accuracy_count += 1
    accuracy = accuracy_count / n if n else 0.0

    per_type: Dict[str, dict] = {}
    for qt in sorted(type_counts):
        lt = type_latency.get(qt, [])
        fb = type_fallback.get(qt, 0)
        tc = type_counts[qt]
        rec = type_recall.get(qt, [])
        per_type[qt] = {
            "count": tc,
            "fallback_rate": fb / tc if tc else 0.0,
            "avg_latency_ms": sum(lt) / len(lt) if lt else 0.0,
            "avg_recall": sum(rec) / len(rec) if rec else None,
        }

    avg_article_overlap = sum(article_overlaps) / len(article_overlaps) if article_overlaps else None

    return {
        "total_queries": n,
        "accuracy": accuracy,
        "accuracy_count": accuracy_count,
        "fallback_rate": fallback_rate,
        "fallback_count": fallback_count,
        "empty_retrieval_count": empty_count,
        "timeout_count": timeout_count,
        "avg_confidence": sum(confidences) / len(confidences),
        "avg_article_overlap": avg_article_overlap,
        "latency_ms": {
            "mean": sum(total_latencies) / len(total_latencies),
            "median": median(total_latencies) if total_latencies else 0.0,
            "p50": _percentile(total_latencies, 50),
            "p95": _percentile(total_latencies, 95),
            "p99": _percentile(total_latencies, 99),
            "min": min(total_latencies),
            "max": max(total_latencies),
        },
        "retrieval_latency_ms": {
            "mean": sum(retrieval_latencies) / len(retrieval_latencies),
            "p95": _percentile(retrieval_latencies, 95),
        },
        "avg_chunks_per_query": sum(chunks_per_query) / len(chunks_per_query),
        "strategy_distribution": dict(strategy_counts),
        "confidence_distribution": dict(confidence_bands),
        "per_type": per_type,
    }


# ---------------------------------------------------------------------------
# Report generation
# ---------------------------------------------------------------------------


def _format_table(header: List[str], rows: List[List[str]]) -> str:
    col_widths = [
        max(len(str(h)), max((len(str(r[i])) for r in rows), default=0))
        for i, h in enumerate(header)
    ]
    sep = "|" + "|".join(" " + "-" * w + " " for w in col_widths) + "|"
    hdr = "|" + "|".join(f" {h:<{w}} " for h, w in zip(header, col_widths)) + "|"
    body = "\n".join(
        "|" + "|".join(f" {str(c):<{w}} " for c, w in zip(row, col_widths))
        for row in rows
    )
    return f"{hdr}\n{sep}\n{body}"


def generate_report(
    records: List[dict],
    path: Optional[os.PathLike] = None,
) -> str:
    p = path or REPORT_PATH
    metrics = compute_metrics(records)

    now = __import__("datetime").datetime.now().strftime("%Y-%m-%d %H:%M:%S")

    lines = [
        "# Benchmark Report",
        "",
        f"**Generated:** {now}",
        "",
        "## Summary",
        "",
        _format_table(
            ["Metric", "Value"],
            [
                ["Total Queries", str(metrics["total_queries"])],
                ["Accuracy", f"{metrics['accuracy']:.2%}"],
                ["Fallback Rate", f"{metrics['fallback_rate']:.2%}"],
                ["Avg Confidence", f"{metrics['avg_confidence']:.4f}"],
                ["Avg Chunks/Query", f"{metrics['avg_chunks_per_query']:.1f}"],
                [
                    "Avg Article Overlap",
                    f"{metrics['avg_article_overlap']:.4f}"
                    if metrics["avg_article_overlap"] is not None
                    else "N/A",
                ],
            ],
        ),
        "",
        "## Latency",
        "",
        _format_table(
            ["Statistic", "Total (ms)", "Retrieval (ms)"],
            [
                [
                    "Mean",
                    f"{metrics['latency_ms']['mean']:.1f}",
                    f"{metrics['retrieval_latency_ms']['mean']:.1f}",
                ],
                ["Median", f"{metrics['latency_ms']['median']:.1f}", "—"],
                ["P95", f"{metrics['latency_ms']['p95']:.1f}", f"{metrics['retrieval_latency_ms']['p95']:.1f}"],
                ["P99", f"{metrics['latency_ms']['p99']:.1f}", "—"],
                ["Min", f"{metrics['latency_ms']['min']:.1f}", "—"],
                ["Max", f"{metrics['latency_ms']['max']:.1f}", "—"],
            ],
        ),
        "",
        "## Failures",
        "",
        _format_table(
            ["Type", "Count", "Rate"],
            [
                ["Fallback", str(metrics["fallback_count"]), f"{metrics['fallback_rate']:.2%}"],
                [
                    "Empty Retrieval",
                    str(metrics["empty_retrieval_count"]),
                    f"{metrics['empty_retrieval_count'] / max(metrics['total_queries'], 1):.2%}",
                ],
                [
                    "Timeout",
                    str(metrics["timeout_count"]),
                    f"{metrics['timeout_count'] / max(metrics['total_queries'], 1):.2%}",
                ],
            ],
        ),
        "",
        "## Strategy Distribution",
        "",
        _format_table(
            ["Strategy", "Count", "Percentage"],
            [
                [s, str(c), f"{c / max(metrics['total_queries'], 1):.1%}"]
                for s, c in sorted(
                    metrics["strategy_distribution"].items(),
                    key=lambda x: -x[1],
                )
            ],
        ),
        "",
        "## Confidence Distribution",
        "",
        _format_table(
            ["Band", "Count", "Percentage"],
            [
                [
                    b,
                    str(metrics["confidence_distribution"].get(b, 0)),
                    f"{metrics['confidence_distribution'].get(b, 0) / max(metrics['total_queries'], 1):.1%}",
                ]
                for b in ["high", "medium", "low"]
            ],
        ),
        "",
        "## Per-Type Breakdown",
        "",
    ]

    for qt, pm in sorted(metrics.get("per_type", {}).items()):
        lines.extend([
            f"### {qt.upper()}",
            "",
            _format_table(
                ["Metric", "Value"],
                [
                    ["Count", str(pm["count"])],
                    ["Fallback Rate", f"{pm['fallback_rate']:.2%}"],
                    ["Avg Latency (ms)", f"{pm['avg_latency_ms']:.1f}"],
                    [
                        "Avg Recall",
                        f"{pm['avg_recall']:.4f}" if pm["avg_recall"] is not None else "N/A",
                    ],
                ],
            ),
            "",
        ])

    lines.extend([
        "---",
        "",
        f"*Report generated from {len(records)} benchmark queries.*",
        "",
    ])

    report = "\n".join(lines)

    with open(p, "w") as f:
        f.write(report)
    logger.info(f"Report written to {p}")

    return report


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------


def main() -> None:
    import argparse

    parser = argparse.ArgumentParser(description="Benchmark evaluator")
    parser.add_argument("--results", default=None, help="Path to benchmark_results.jsonl")
    parser.add_argument("--report", default=None, help="Output path for benchmark_report.md")
    args = parser.parse_args()

    records = load_results(args.results)
    logger.info(f"Loaded {len(records)} benchmark records")

    metrics = compute_metrics(records)
    logger.info(f"Accuracy: {metrics['accuracy']:.2%}")
    logger.info(f"Fallback rate: {metrics['fallback_rate']:.2%}")
    logger.info(f"Avg latency: {metrics['latency_ms']['mean']:.1f}ms")

    report_path = args.report or REPORT_PATH
    generate_report(records, report_path)
    logger.info(f"Report: {report_path}")
    logger.info(f"Calibration dataset: {CALIBRATION_PATH}")


if __name__ == "__main__":
    main()
