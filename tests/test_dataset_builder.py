"""Tests for training dataset and dataset builder."""

from __future__ import annotations

import json
import os
import tempfile

import pytest

from intelligence.feedback.models import FeedbackRecord
from intelligence.training.dataset_builder import DatasetBuilder
from intelligence.training.training_dataset import TrainingDataset


@pytest.fixture
def sample_telemetry_events() -> list:
    from intelligence.telemetry.models import RetrievalTelemetry

    return [
        RetrievalTelemetry(
            query="q1",
            query_type="SIMPLE",
            confidence=0.9,
            retrieval_type="HYBRID",
            top_k=3,
            rerank=False,
            decompose=False,
            retrieval_latency_ms=50.0,
            fallback_triggered=False,
            success=True,
        ),
        RetrievalTelemetry(
            query="q2",
            query_type="COMPLEX",
            confidence=0.7,
            retrieval_type="MULTI_VECTOR",
            top_k=8,
            rerank=True,
            decompose=False,
            retrieval_latency_ms=120.0,
            fallback_triggered=True,
            success=True,
        ),
    ]


@pytest.fixture
def sample_feedback_records() -> list:
    return [
        FeedbackRecord(
            query_id="q001",
            query="q1",
            query_type="SIMPLE",
            retrieval_type="HYBRID",
            confidence=0.9,
            calibrated_confidence=0.88,
            top_k=3,
            rerank=False,
            decompose=False,
            answer_accepted=True,
            answer_rating=5,
            latency_ms=50.0,
        ),
        FeedbackRecord(
            query_id="q002",
            query="q2",
            query_type="COMPLEX",
            retrieval_type="MULTI_VECTOR",
            confidence=0.7,
            calibrated_confidence=0.68,
            top_k=8,
            rerank=True,
            decompose=False,
            answer_accepted=False,
            answer_rating=2,
            latency_ms=120.0,
        ),
    ]


class TestTrainingDataset:
    def test_empty(self) -> None:
        ds = TrainingDataset()
        assert ds.size == 0

    def test_add(self) -> None:
        ds = TrainingDataset()
        ds.add({"query_type": "SIMPLE", "confidence": 0.9, "accepted": True})
        assert ds.size == 1

    def test_add_from_telemetry(self, sample_telemetry_events) -> None:
        ds = TrainingDataset()
        ds.add_from_telemetry(sample_telemetry_events)
        assert ds.size == 2
        assert ds.records[0]["query_type"] == "SIMPLE"
        assert ds.records[1]["top_k"] == 8

    def test_add_from_benchmark(self) -> None:
        with tempfile.NamedTemporaryFile(mode="w", suffix=".jsonl", delete=False) as f:
            f.write(
                json.dumps(
                    {
                        "query_type": "SIMPLE",
                        "confidence": 0.9,
                        "top_k": 3,
                        "rerank": False,
                        "decompose": False,
                        "latency_ms": 50.0,
                        "fallback_triggered": False,
                        "accepted": True,
                    }
                )
                + "\n"
            )
            f.write(
                json.dumps(
                    {
                        "query_type": "COMPLEX",
                        "confidence": 0.7,
                        "top_k": 8,
                        "rerank": True,
                        "decompose": False,
                        "latency_ms": 120.0,
                        "fallback_triggered": True,
                        "accepted": False,
                    }
                )
                + "\n"
            )
            tmppath = f.name
        try:
            ds = TrainingDataset()
            ds.add_from_benchmark(tmppath)
            assert ds.size == 2
        finally:
            os.unlink(tmppath)

    def test_add_from_benchmark_not_found(self) -> None:
        ds = TrainingDataset()
        with pytest.raises(FileNotFoundError):
            ds.add_from_benchmark("nonexistent.jsonl")

    def test_add_from_feedback_records(self, sample_feedback_records) -> None:
        ds = TrainingDataset()
        ds.add_from_feedback_records(sample_feedback_records)
        assert ds.size == 2
        assert ds.records[0]["accepted"] is True

    def test_to_dicts(self) -> None:
        ds = TrainingDataset([{"a": 1}, {"b": 2}])
        assert ds.to_dicts() == [{"a": 1}, {"b": 2}]

    def test_to_jsonl(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            path = os.path.join(tmp, "dataset.jsonl")
            ds = TrainingDataset([{"query_type": "SIMPLE", "accepted": True}])
            ds.to_jsonl(path)
            assert os.path.exists(path)
            with open(path) as f:
                line = json.loads(f.readline())
            assert line["query_type"] == "SIMPLE"


class TestDatasetBuilder:
    def test_build_empty(self) -> None:
        builder = DatasetBuilder()
        ds = builder.build()
        assert ds.size == 0

    def test_add_telemetry(self, sample_telemetry_events) -> None:
        builder = DatasetBuilder()
        builder.add_telemetry(sample_telemetry_events)
        assert builder.dataset.size == 2

    def test_add_feedback_records(self, sample_feedback_records) -> None:
        builder = DatasetBuilder()
        builder.add_feedback_records(sample_feedback_records)
        assert builder.dataset.size == 2

    def test_add_dicts(self) -> None:
        builder = DatasetBuilder()
        builder.add_dicts([{"query_type": "SIMPLE", "accepted": True}])
        assert builder.dataset.size == 1

    def test_combined(self, sample_telemetry_events, sample_feedback_records) -> None:
        builder = DatasetBuilder()
        builder.add_telemetry(sample_telemetry_events)
        builder.add_feedback_records(sample_feedback_records)
        assert builder.dataset.size == 4

    def test_build_returns_dataset(self) -> None:
        builder = DatasetBuilder()
        ds = builder.build()
        assert isinstance(ds, TrainingDataset)
