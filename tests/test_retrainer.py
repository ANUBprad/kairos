"""Tests for retraining pipeline — retrainer, model registry, scheduler."""

from __future__ import annotations

import json
import os
import tempfile
from pathlib import Path

import pytest

from intelligence.retraining.model_registry import ModelRegistry, RegistryEntry, compute_dataset_hash
from intelligence.retraining.retrainer import BudgetRetrainer
from intelligence.retraining.scheduler import RetrainingScheduler


# ======================================================================
# Fixtures
# ======================================================================


@pytest.fixture
def sample_training_records() -> list:
    return [
        {"query_type": "simple", "confidence": 0.95, "retrieval_type": "HYBRID",
         "top_k": 3, "rerank": False, "decompose": False, "latency_ms": 50.0,
         "fallback_triggered": False, "accepted": True},
        {"query_type": "simple", "confidence": 0.95, "retrieval_type": "HYBRID",
         "top_k": 5, "rerank": False, "decompose": False, "latency_ms": 70.0,
         "fallback_triggered": False, "accepted": True},
        {"query_type": "simple", "confidence": 0.60, "retrieval_type": "HYBRID",
         "top_k": 5, "rerank": True, "decompose": False, "latency_ms": 100.0,
         "fallback_triggered": False, "accepted": True},
        {"query_type": "complex", "confidence": 0.85, "retrieval_type": "MULTI_VECTOR",
         "top_k": 8, "rerank": True, "decompose": False, "latency_ms": 150.0,
         "fallback_triggered": False, "accepted": True},
        {"query_type": "complex", "confidence": 0.55, "retrieval_type": "MULTI_VECTOR",
         "top_k": 5, "rerank": False, "decompose": False, "latency_ms": 95.0,
         "fallback_triggered": False, "accepted": True},
        {"query_type": "multi_hop", "confidence": 0.90, "retrieval_type": "SELF_QUERYING",
         "top_k": 3, "rerank": False, "decompose": True, "latency_ms": 80.0,
         "fallback_triggered": False, "accepted": True},
    ]


@pytest.fixture
def temp_model_dir() -> str:
    with tempfile.TemporaryDirectory() as tmp:
        yield tmp


# ======================================================================
# ModelRegistry
# ======================================================================


class TestModelRegistry:
    def test_empty(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            reg = ModelRegistry(os.path.join(tmp, "registry.json"))
            assert reg.entries == []
            assert reg.latest_version() is None

    def test_register(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            reg = ModelRegistry(os.path.join(tmp, "registry.json"))
            reg.register(RegistryEntry(
                version="v1", timestamp="2026-01-01", training_samples=100,
                dataset_hash="abc123", evaluation_metrics={"score": 0.8},
                path="/tmp/model.json",
            ))
            assert len(reg.entries) == 1
            assert reg.latest_version() == "v1"

    def test_register_multiple(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            reg = ModelRegistry(os.path.join(tmp, "registry.json"))
            reg.register(RegistryEntry(
                version="v1", timestamp="2026-01-01", training_samples=100,
                dataset_hash="abc123", evaluation_metrics={}, path="/tmp/v1.json",
            ))
            reg.register(RegistryEntry(
                version="v2", timestamp="2026-06-01", training_samples=200,
                dataset_hash="def456", evaluation_metrics={}, path="/tmp/v2.json",
            ))
            assert reg.latest_version() == "v2"

    def test_get(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            reg = ModelRegistry(os.path.join(tmp, "registry.json"))
            reg.register(RegistryEntry(
                version="v1", timestamp="2026-01-01", training_samples=100,
                dataset_hash="abc123", evaluation_metrics={}, path="/tmp/v1.json",
            ))
            entry = reg.get("v1")
            assert entry is not None
            assert entry.version == "v1"

    def test_get_nonexistent(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            reg = ModelRegistry(os.path.join(tmp, "registry.json"))
            assert reg.get("v99") is None

    def test_persists_to_disk(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            path = os.path.join(tmp, "registry.json")
            reg = ModelRegistry(path)
            reg.register(RegistryEntry(
                version="v1", timestamp="2026-01-01", training_samples=100,
                dataset_hash="abc123", evaluation_metrics={}, path="/tmp/v1.json",
            ))
            reg2 = ModelRegistry(path)
            assert len(reg2.entries) == 1
            assert reg2.latest_version() == "v1"

    def test_to_dict(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            reg = ModelRegistry(os.path.join(tmp, "registry.json"))
            reg.register(RegistryEntry(
                version="v1", timestamp="2026-01-01", training_samples=100,
                dataset_hash="abc123", evaluation_metrics={}, path="/tmp/v1.json",
            ))
            d = reg.to_dict()
            assert "entries" in d
            assert len(d["entries"]) == 1


# ======================================================================
# compute_dataset_hash
# ======================================================================


class TestComputeDatasetHash:
    def test_deterministic(self) -> None:
        records = [{"a": 1}, {"b": 2}]
        h1 = compute_dataset_hash(records)
        h2 = compute_dataset_hash(records)
        assert h1 == h2

    def test_different_inputs_different_hashes(self) -> None:
        h1 = compute_dataset_hash([{"a": 1}])
        h2 = compute_dataset_hash([{"a": 2}])
        assert h1 != h2

    def test_empty(self) -> None:
        h = compute_dataset_hash([])
        assert isinstance(h, str)
        assert len(h) == 64


# ======================================================================
# BudgetRetrainer
# ======================================================================


class TestBudgetRetrainer:
    def test_train(self, sample_training_records, temp_model_dir) -> None:
        retrainer = BudgetRetrainer(model_dir=temp_model_dir)
        result = retrainer.train(sample_training_records, version="v1", min_samples_per_config=1)
        assert result["version"] == "v1"
        assert result["training_samples"] == 6
        assert "evaluation" in result
        assert os.path.exists(result["path"])

    def test_train_auto_version(self, sample_training_records, temp_model_dir) -> None:
        retrainer = BudgetRetrainer(model_dir=temp_model_dir)
        result = retrainer.train(sample_training_records, min_samples_per_config=1)
        assert result["version"].startswith("v")

    def test_evaluate(self, sample_training_records, temp_model_dir) -> None:
        retrainer = BudgetRetrainer(model_dir=temp_model_dir)
        train_result = retrainer.train(sample_training_records, version="v1", min_samples_per_config=1)
        eval_results = retrainer.evaluate(sample_training_records, train_result["path"])
        assert isinstance(eval_results, dict)
        assert "static_avg_score" in eval_results

    def test_compare_models(self, sample_training_records, temp_model_dir) -> None:
        retrainer = BudgetRetrainer(model_dir=temp_model_dir)
        retrainer.train(sample_training_records, version="v1", min_samples_per_config=1)
        # Add more varied data for v2
        extra = sample_training_records + [
            {"query_type": "multi_hop", "confidence": 0.40, "retrieval_type": "SELF_QUERYING",
             "top_k": 8, "rerank": True, "decompose": True, "latency_ms": 200.0,
             "fallback_triggered": True, "accepted": False},
        ]
        retrainer.train(extra, version="v2", min_samples_per_config=1)
        comparison = retrainer.compare_models("v1", "v2")
        assert comparison["version_a"] == "v1"
        assert comparison["version_b"] == "v2"

    def test_compare_models_not_found(self, temp_model_dir) -> None:
        retrainer = BudgetRetrainer(model_dir=temp_model_dir)
        with pytest.raises(ValueError):
            retrainer.compare_models("v1", "v99")

    def test_generate_training_report(self, sample_training_records, temp_model_dir) -> None:
        retrainer = BudgetRetrainer(model_dir=temp_model_dir)
        result = retrainer.train(sample_training_records, version="v1", min_samples_per_config=1)
        report = retrainer.generate_training_report(result, sample_training_records)
        assert "Retraining Report" in report
        assert result["version"] in report

    def test_registers_in_registry(self, sample_training_records, temp_model_dir) -> None:
        retrainer = BudgetRetrainer(model_dir=temp_model_dir)
        retrainer.train(sample_training_records, version="v1", min_samples_per_config=1)
        assert retrainer._registry.latest_version() == "v1"

    def test_records_to_entries(self) -> None:
        records = [{"query_type": "simple", "confidence": 0.9, "retrieval_type": "HYBRID",
                    "top_k": 3, "rerank": False, "decompose": False, "latency_ms": 50.0,
                    "fallback_triggered": False, "accepted": True}]
        entries = BudgetRetrainer._records_to_entries(records)
        assert len(entries) == 1
        assert entries[0].top_k == 3
        assert entries[0].success is True


# ======================================================================
# RetrainingScheduler
# ======================================================================


class TestRetrainingScheduler:
    def test_start_stop(self) -> None:
        scheduler = RetrainingScheduler(retrain_fn=lambda r: {}, min_records=1)
        scheduler.start()
        assert scheduler.is_running
        scheduler.stop()
        assert not scheduler.is_running

    def test_start_twice(self) -> None:
        scheduler = RetrainingScheduler(retrain_fn=lambda r: {}, min_records=1)
        scheduler.start()
        scheduler.start()  # should not raise
        scheduler.stop()

    def test_trigger_skipped(self) -> None:
        scheduler = RetrainingScheduler(retrain_fn=lambda r: {}, min_records=10)
        result = scheduler.trigger([{"a": 1}])
        assert result["skipped"] is True

    def test_trigger_runs(self) -> None:
        called = []
        def retrain_fn(records):
            called.append(records)
            return {"version": "v1", "status": "ok"}
        scheduler = RetrainingScheduler(retrain_fn=retrain_fn, min_records=1)
        result = scheduler.trigger([{"a": 1}])
        assert result["version"] == "v1"
        assert len(called) == 1

    def test_last_run_initial_none(self) -> None:
        scheduler = RetrainingScheduler(retrain_fn=lambda r: {}, min_records=1)
        assert scheduler.last_run is None

    def test_last_run_after_trigger(self) -> None:
        scheduler = RetrainingScheduler(retrain_fn=lambda r: {}, min_records=1)
        scheduler.trigger([{"a": 1}])
        assert scheduler.last_run is not None
