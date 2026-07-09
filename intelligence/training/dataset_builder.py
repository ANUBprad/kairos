from __future__ import annotations

from typing import Any, Dict, List

from intelligence.feedback.collector import FeedbackCollector
from intelligence.training.training_dataset import TrainingDataset


class DatasetBuilder:
    """Builds training datasets from multiple sources.

    Sources:
    - feedback collector (``FeedbackCollector.export_dataset()``)
    - telemetry logs (via ``TrainingDataset.add_from_telemetry()``)
    - benchmark results (via ``TrainingDataset.add_from_benchmark()``)
    - user feedback records (via ``TrainingDataset.add_from_feedback_records()``)

    Usage::

        builder = DatasetBuilder()
        builder.add_feedback(collector)
        builder.add_telemetry(events)
        builder.add_benchmark("benchmarks/results/benchmark_results.jsonl")
        ds = builder.build()
        ds.to_jsonl("training/feedback_dataset.jsonl")
    """

    def __init__(self) -> None:
        self._dataset = TrainingDataset()

    @property
    def dataset(self) -> TrainingDataset:
        return self._dataset

    def add_feedback(self, collector: FeedbackCollector) -> None:
        """Add all feedback from a FeedbackCollector."""
        for d in collector.export_dataset():
            self._dataset.add(d)

    def add_feedback_records(self, records: List[Any]) -> None:
        """Add FeedbackRecord or compatible objects."""
        self._dataset.add_from_feedback_records(records)

    def add_telemetry(
        self,
        events: List[Any],
        default_accepted: bool = True,
    ) -> None:
        """Add telemetry events as training records."""
        self._dataset.add_from_telemetry(events, default_accepted=default_accepted)

    def add_benchmark(self, results_path: str) -> None:
        """Add benchmark results from JSONL."""
        self._dataset.add_from_benchmark(results_path)

    def add_dicts(self, records: List[Dict[str, Any]]) -> None:
        """Add raw dict records."""
        for r in records:
            self._dataset.add(r)

    def build(self) -> TrainingDataset:
        """Return the assembled dataset."""
        return self._dataset
