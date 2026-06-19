"""Base experiment runner — shared execution and persistence logic.

:class:`BaseExperimentRunner` is an abstract base that:
* loads the benchmark dataset (with optional query-type filtering)
* creates a :class:`BenchmarkRunner` (subclasses implement
  :meth:`_create_runner`)
* executes all queries and returns a :class:`RunnerResult`
* persists results as JSON with :func:`save_result`

Subclasses
----------
:class:`~benchmarks.experiments.baseline.BaselineExperimentRunner`
    Traditional RAG without confidence-aware budgeting or fallback.
:class:`~benchmarks.experiments.treatment.TreatmentExperimentRunner`
    Kairos adaptive retrieval with planner, budget allocator, and fallback.
"""

from __future__ import annotations

import json
import os
import time
from dataclasses import dataclass, field, fields, is_dataclass
from typing import Dict, List, Optional, Sequence

from benchmarks.dataset.loader import QueryEntry, load_dataset
from benchmarks.metrics import (
    FailureRecord,
    LatencyRecord,
    compute_failure_rates,
)
from benchmarks.runner import BenchmarkRunner, RunnerResult

# ---------------------------------------------------------------------------
# Persistence helpers
# ---------------------------------------------------------------------------

_JSON_INDENT = 2


def _dataclass_to_dict(obj: object) -> object:
    """Recursively convert a (possibly nested) dataclass to a plain dict."""
    if is_dataclass(obj) and not isinstance(obj, type):
        result: dict[str, object] = {}
        for f in fields(obj):  # type: ignore[arg-type]
            val = getattr(obj, f.name)
            if isinstance(val, tuple):
                result[f.name] = [_dataclass_to_dict(v) for v in val]
            elif is_dataclass(val) and not isinstance(val, type):
                result[f.name] = _dataclass_to_dict(val)
            else:
                result[f.name] = val
        return result
    return obj


def _entry_to_dict(entry: QueryEntry) -> Dict[str, object]:
    """Serialize a QueryEntry to a JSON-safe dict."""
    return {
        "id": entry.id,
        "text": entry.text,
        "query_type": entry.query_type,
        "domain": entry.domain,
        "expected_chunks": entry.expected_chunks,
        "corpus_ref": entry.corpus_ref,
        "expected_articles": entry.expected_articles,
        "confidence_category": entry.confidence_category,
    }


def _result_to_dict(result: RunnerResult) -> Dict[str, object]:
    """Serialize a full RunnerResult to a JSON-safe dict."""
    aggregate_failures = result.aggregated_failures()
    aggregate_latency = result.aggregated_latency()
    avg_latency = result.average_latency()
    failure_rates = compute_failure_rates(aggregate_failures)

    queries: List[Dict[str, object]] = []
    for qr in result.results:
        queries.append(
            {
                "id": qr.entry.id,
                "query_type": qr.entry.query_type,
                "latency": _dataclass_to_dict(qr.latency),
                "failures": _dataclass_to_dict(qr.failures),
                "recall": qr.recall,
                "precision": qr.precision,
            }
        )

    return {
        "metadata": {
            "total_queries": result.total_queries,
            "timestamp": time.time(),
        },
        "aggregate": {
            "average_recall": result.average_recall(),
            "average_precision": result.average_precision(),
            "average_latency": _dataclass_to_dict(avg_latency),
            "aggregate_latency": _dataclass_to_dict(aggregate_latency),
            "aggregate_failures": _dataclass_to_dict(aggregate_failures),
            "failure_rates": failure_rates,
        },
        "per_type": {
            "recall": result.per_type_recall(),
            "precision": result.per_type_precision(),
            "latency": {
                k: _dataclass_to_dict(v)
                for k, v in result.per_type_latency().items()
            },
            "failures": {
                k: _dataclass_to_dict(v)
                for k, v in result.per_type_failures().items()
            },
        },
        "queries": queries,
    }


def save_result(result: RunnerResult, path: os.PathLike[str]) -> None:
    """Persist a :class:`RunnerResult` as structured JSON.

    Parameters
    ----------
    result:
        The aggregate benchmark result to save.
    path:
        Destination file path (created / overwritten).
    """
    with open(path, "w", encoding="utf-8") as f:
        json.dump(_result_to_dict(result), f, indent=_JSON_INDENT)


# ---------------------------------------------------------------------------
# Base experiment runner
# ---------------------------------------------------------------------------


class BaseExperimentRunner:
    """Shared experiment execution logic.

    Subclasses must implement :meth:`_create_runner` to return a
    configured :class:`BenchmarkRunner`.

    Parameters
    ----------
    classifier:
        Object with ``classify_with_confidence(query)`` returning a schema
        with ``query_type``, ``domain``, and ``confidence_score``.
    retriever:
        Object conforming to the :class:`Retriever` protocol.
    dataset_path:
        Path to ``queries.json``.  Defaults to the shipped dataset.
    validate:
        Whether to run validation on load.  Defaults to ``True``.
    """

    def __init__(
        self,
        classifier: object,
        retriever: object,
        dataset_path: Optional[os.PathLike[str]] = None,
        validate: bool = True,
    ) -> None:
        self._classifier = classifier
        self._retriever = retriever
        self._dataset_path = dataset_path
        self._validate = validate

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    def run(
        self,
        query_types: Optional[Sequence[str]] = None,
    ) -> RunnerResult:
        """Load the dataset, optionally filter by type, and run all queries.

        Parameters
        ----------
        query_types:
            Optional subset of query types to run (e.g. ``["simple"]``).
            When ``None``, all queries are executed.

        Returns
        -------
        RunnerResult
            Aggregate metrics across all executed queries.
        """
        entries = load_dataset(
            path=self._dataset_path,  # type: ignore[arg-type]
            validate=self._validate,
        )

        if query_types is not None:
            type_set = set(query_types)
            entries = [e for e in entries if e.query_type in type_set]

        runner = self._create_runner()
        return runner.run_all(entries)

    def run_and_save(
        self,
        path: os.PathLike[str],
        query_types: Optional[Sequence[str]] = None,
    ) -> RunnerResult:
        """Convenience: run queries and persist the result in one call.

        Parameters
        ----------
        path:
            Destination for the JSON result file.
        query_types:
            Optional type filter (see :meth:`run`).

        Returns
        -------
        RunnerResult
            The result before serialisation (so callers can inspect it).
        """
        result = self.run(query_types=query_types)
        save_result(result, path)
        return result

    # ------------------------------------------------------------------
    # Subclass hook
    # ------------------------------------------------------------------

    def _create_runner(self) -> BenchmarkRunner:
        """Return a configured :class:`BenchmarkRunner`.

        Subclasses override this to inject different planners or config.
        """
        raise NotImplementedError
