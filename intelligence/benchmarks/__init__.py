from __future__ import annotations

from intelligence.benchmarks.benchmark_result import BenchmarkResult, aggregate_results
from intelligence.benchmarks.benchmark_runner import BenchmarkRunner
from intelligence.benchmarks.dataset_registry import DatasetMetadata, DatasetRegistry
from intelligence.benchmarks.loaders.hotpotqa import load_hotpotqa
from intelligence.benchmarks.loaders.squad import load_squad
from intelligence.benchmarks.loaders.natural_questions import load_natural_questions
from intelligence.benchmarks.loaders.msmarco import load_msmarco
from intelligence.benchmarks.reporting import generate_benchmark_report

__all__ = [
    "BenchmarkResult",
    "BenchmarkRunner",
    "DatasetMetadata",
    "DatasetRegistry",
    "aggregate_results",
    "generate_benchmark_report",
    "load_hotpotqa",
    "load_squad",
    "load_natural_questions",
    "load_msmarco",
]
