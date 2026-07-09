from __future__ import annotations

import json
from pathlib import Path
from typing import Any, Dict, List, Optional

from intelligence.telemetry.models import RetrievalTelemetry


class TrainingDataset:
    """A training dataset built from telemetry logs, benchmark results, and
    feedback records.

    Each training record has the format required by the budget optimizer::

        {
            "query_type": "...",
            "confidence": 0.82,
            "calibrated_confidence": 0.78,
            "retrieval_type": "...",
            "top_k": 5,
            "rerank": false,
            "decompose": false,
            "latency_ms": 110,
            "fallback_triggered": false,
            "accepted": true,
            "rating": 5
        }
    """

    def __init__(self, records: Optional[List[Dict[str, Any]]] = None):
        self._records: List[Dict[str, Any]] = records or []

    @property
    def records(self) -> List[Dict[str, Any]]:
        return list(self._records)

    @property
    def size(self) -> int:
        return len(self._records)

    def add(self, record: Dict[str, Any]) -> None:
        self._records.append(record)

    def add_from_telemetry(
        self,
        events: List[RetrievalTelemetry],
        default_accepted: bool = True,
        default_rating: Optional[int] = None,
    ) -> None:
        """Convert telemetry events into training records.

        Telemetry does not contain user feedback, so *default_accepted* and
        *default_rating* fill the feedback fields.
        """
        for e in events:
            self._records.append(
                {
                    "query_type": e.query_type,
                    "confidence": e.confidence,
                    "calibrated_confidence": e.confidence,
                    "retrieval_type": e.retrieval_type,
                    "top_k": e.top_k,
                    "rerank": e.rerank,
                    "decompose": e.decompose,
                    "latency_ms": e.retrieval_latency_ms,
                    "fallback_triggered": e.fallback_triggered,
                    "accepted": default_accepted and e.success,
                    "rating": default_rating,
                }
            )

    def add_from_benchmark(
        self,
        results_path: str,
        default_accepted: bool = True,
    ) -> None:
        """Add training records from a benchmark results JSONL file."""
        path = Path(results_path)
        if not path.exists():
            raise FileNotFoundError(f"Benchmark results not found: {path}")
        with path.open("r") as f:
            for line in f:
                line = line.strip()
                if not line:
                    continue
                d = json.loads(line)
                self._records.append(
                    {
                        "query_type": d.get("query_type", "UNKNOWN"),
                        "confidence": d.get("confidence", 0.5),
                        "calibrated_confidence": d.get(
                            "calibrated_confidence", d.get("confidence", 0.5)
                        ),
                        "retrieval_type": d.get("retrieval_type", "UNKNOWN"),
                        "top_k": d.get("top_k", 3),
                        "rerank": d.get("rerank", False),
                        "decompose": d.get("decompose", False),
                        "latency_ms": d.get("latency_ms", 0.0),
                        "fallback_triggered": d.get("fallback_triggered", False),
                        "accepted": d.get("accepted", default_accepted),
                        "rating": d.get("rating"),
                    }
                )

    def add_from_feedback_records(
        self,
        records: List[Any],
    ) -> None:
        """Add training records from FeedbackRecord objects.

        Args:
            records: List of objects with ``query_id``, ``query``, ``query_type``,
                     ``confidence``, ``calibrated_confidence``, ``retrieval_type``,
                     ``top_k``, ``rerank``, ``decompose``, ``latency_ms``,
                     ``fallback_triggered``, ``answer_accepted``, ``answer_rating``.
        """
        for r in records:
            self._records.append(
                {
                    "query_id": r.query_id,
                    "query": getattr(r, "query", ""),
                    "query_type": r.query_type,
                    "confidence": r.confidence,
                    "calibrated_confidence": r.calibrated_confidence,
                    "retrieval_type": r.retrieval_type,
                    "top_k": r.top_k,
                    "rerank": r.rerank,
                    "decompose": r.decompose,
                    "latency_ms": r.latency_ms,
                    "fallback_triggered": r.fallback_triggered,
                    "accepted": r.answer_accepted,
                    "rating": r.answer_rating,
                }
            )

    def to_dicts(self) -> List[Dict[str, Any]]:
        return list(self._records)

    def to_jsonl(self, path: str) -> None:
        """Write all records as JSONL to the given path."""
        p = Path(path)
        p.parent.mkdir(parents=True, exist_ok=True)
        with p.open("w", encoding="utf-8") as f:
            for r in self._records:
                f.write(json.dumps(r, ensure_ascii=False, default=str))
                f.write("\n")
