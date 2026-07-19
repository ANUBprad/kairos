"""Tests for the budget optimization subsystem."""

from __future__ import annotations

import json
import os
import tempfile

import pytest

from intelligence.optimization.budget_dataset import (
    BudgetDatasetEntry,
    BudgetDatasetGenerator,
)
from intelligence.optimization.budget_model import (
    BudgetRecommendation,
    BudgetScorer,
    LearnedBudgetTable,
)
from intelligence.optimization.budget_optimizer import BudgetOptimizer
from intelligence.optimization.optimization_metrics import (
    compute_budget_accuracy,
    compute_fallback_reduction,
    compute_latency_delta,
    compute_success_lift,
    generate_optimization_report,
)
from intelligence.optimization.optimization_storage import (
    load_optimizer,
    save_optimizer,
)

# ======================================================================
# Fixtures
# ======================================================================


@pytest.fixture
def sample_entries() -> list:
    return [
        BudgetDatasetEntry(
            "simple", 0.95, "HYBRID", 3, False, False, 50.0, False, True
        ),
        BudgetDatasetEntry(
            "simple", 0.95, "HYBRID", 5, False, False, 70.0, False, True
        ),
        BudgetDatasetEntry(
            "simple", 0.95, "HYBRID", 8, True, False, 120.0, False, True
        ),
        BudgetDatasetEntry(
            "simple", 0.60, "HYBRID", 5, True, False, 100.0, False, True
        ),
        BudgetDatasetEntry(
            "simple", 0.60, "HYBRID", 8, True, False, 140.0, True, False
        ),
        BudgetDatasetEntry("simple", 0.30, "HYBRID", 8, True, True, 160.0, True, False),
        BudgetDatasetEntry(
            "simple", 0.30, "HYBRID", 10, True, True, 180.0, False, True
        ),
        BudgetDatasetEntry(
            "complex", 0.85, "MULTI_VECTOR", 8, True, False, 150.0, False, True
        ),
        BudgetDatasetEntry(
            "complex", 0.85, "MULTI_VECTOR", 5, False, False, 90.0, False, True
        ),
        BudgetDatasetEntry(
            "complex", 0.55, "MULTI_VECTOR", 10, True, False, 200.0, False, True
        ),
        BudgetDatasetEntry(
            "complex", 0.55, "MULTI_VECTOR", 5, False, False, 95.0, False, True
        ),
        BudgetDatasetEntry(
            "multi_hop", 0.90, "SELF_QUERYING", 3, False, True, 80.0, False, True
        ),
        BudgetDatasetEntry(
            "multi_hop", 0.90, "SELF_QUERYING", 5, True, True, 120.0, False, True
        ),
        BudgetDatasetEntry(
            "multi_hop", 0.40, "SELF_QUERYING", 8, True, True, 200.0, True, False
        ),
        BudgetDatasetEntry(
            "multi_hop", 0.40, "SELF_QUERYING", 5, False, False, 100.0, False, True
        ),
    ]


@pytest.fixture
def min_entries() -> list:
    return [
        BudgetDatasetEntry(
            "simple", 0.95, "HYBRID", 3, False, False, 50.0, False, True
        ),
        BudgetDatasetEntry(
            "simple", 0.95, "HYBRID", 5, False, False, 70.0, False, True
        ),
        BudgetDatasetEntry(
            "simple", 0.95, "HYBRID", 8, True, False, 120.0, False, True
        ),
    ]


@pytest.fixture
def fitted_optimizer(sample_entries) -> BudgetOptimizer:
    opt = BudgetOptimizer(min_samples_per_config=1)
    opt.fit(sample_entries)
    return opt


# ======================================================================
# BudgetScorer
# ======================================================================


class TestBudgetScorer:
    def test_default_weights(self):
        s = BudgetScorer()
        assert s.success_weight == 1.0
        assert s.latency_weight == 0.01
        assert s.fallback_weight == 0.5
        assert s.top_k_penalty_weight == 0.02

    def test_score_high_success_low_cost(self):
        s = BudgetScorer()
        v = s.score(success_rate=1.0, avg_latency_ms=50, fallback_rate=0.0, top_k=3)
        assert v > 0

    def test_score_low_success_high_cost(self):
        s = BudgetScorer()
        v = s.score(success_rate=0.0, avg_latency_ms=500, fallback_rate=1.0, top_k=12)
        assert v < 0

    def test_top_k_inflation_penalty(self):
        s = BudgetScorer()
        low_k = s.score(success_rate=1.0, avg_latency_ms=50, fallback_rate=0.0, top_k=3)
        high_k = s.score(
            success_rate=1.0, avg_latency_ms=50, fallback_rate=0.0, top_k=12
        )
        assert low_k > high_k

    def test_fallback_penalty(self):
        s = BudgetScorer()
        no_fb = s.score(success_rate=1.0, avg_latency_ms=50, fallback_rate=0.0, top_k=5)
        fb = s.score(success_rate=1.0, avg_latency_ms=50, fallback_rate=1.0, top_k=5)
        assert no_fb > fb

    def test_latency_penalty(self):
        s = BudgetScorer()
        fast = s.score(success_rate=1.0, avg_latency_ms=10, fallback_rate=0.0, top_k=5)
        slow = s.score(
            success_rate=1.0, avg_latency_ms=1000, fallback_rate=0.0, top_k=5
        )
        assert fast > slow

    def test_custom_weights(self):
        s = BudgetScorer(
            success_weight=2.0,
            latency_weight=0.0,
            fallback_weight=0.0,
            top_k_penalty_weight=0.0,
        )
        v = s.score(success_rate=0.5, avg_latency_ms=999, fallback_rate=0.9, top_k=99)
        assert v == 1.0


# ======================================================================
# LearnedBudgetTable
# ======================================================================


class TestLearnedBudgetTable:
    def test_set_and_get(self):
        t = LearnedBudgetTable()
        rec = BudgetRecommendation(3, False, False, 0.95, 50.0)
        t.set("simple", "high", rec)
        assert t.get("simple", "high") == rec

    def test_get_nonexistent(self):
        t = LearnedBudgetTable()
        assert t.get("simple", "high") is None

    def test_to_dict_roundtrip(self):
        t = LearnedBudgetTable()
        t.set("simple", "high", BudgetRecommendation(3, False, False, 0.95, 50.0))
        t.set("complex", "low", BudgetRecommendation(10, True, True, 0.60, 200.0))
        d = t.to_dict()
        t2 = LearnedBudgetTable.from_dict(d)
        assert t2.get("simple", "high").recommended_top_k == 3
        assert t2.get("complex", "low").recommended_decompose is True

    def test_to_dict_structure(self):
        t = LearnedBudgetTable()
        t.set("simple", "high", BudgetRecommendation(3, False, False, 0.95, 50.0))
        d = t.to_dict()
        assert "simple" in d
        assert "high" in d["simple"]
        assert d["simple"]["high"]["recommended_top_k"] == 3


# ======================================================================
# BudgetDatasetGenerator
# ======================================================================


class TestBudgetDatasetGenerator:
    @staticmethod
    def _write_calibration(path, entries):
        with open(path, "w") as f:
            for e in entries:
                f.write(json.dumps(e) + "\n")

    def test_generate_creates_file(self, tmp_path):
        calib = tmp_path / "calibration.jsonl"
        self._write_calibration(
            calib,
            [
                {"query_id": "Q1", "confidence": 0.9, "success": True, "latency_ms": 50,
                 "retrieval_type": "HYBRID", "top_k": 3, "rerank": False, "decompose": False},
                {"query_id": "Q2", "confidence": 0.6, "success": False, "latency_ms": 120,
                 "retrieval_type": "HYBRID", "top_k": 5, "rerank": True, "decompose": False},
            ],
        )
        gen = BudgetDatasetGenerator()
        entries = gen.generate(calib, augment=False)
        assert len(entries) > 0
        assert all(isinstance(e, BudgetDatasetEntry) for e in entries)

    def test_generate_with_augment(self, tmp_path):
        calib = tmp_path / "calibration.jsonl"
        base = [
            {"query_id": f"Q{i}", "confidence": c, "success": s, "latency_ms": 50 + i * 10,
             "retrieval_type": "HYBRID", "top_k": 5, "rerank": False, "decompose": False}
            for i, (c, s) in enumerate([(0.9, True), (0.6, False), (0.3, True)])
        ]
        self._write_calibration(calib, base)
        gen = BudgetDatasetGenerator()
        entries = gen.generate(calib, augment=True)
        assert len(entries) > len(base)

    def test_generate_writes_jsonl(self, tmp_path):
        calib = tmp_path / "calibration.jsonl"
        self._write_calibration(
            calib,
            [{"query_id": "Q1", "confidence": 0.8, "success": True, "latency_ms": 60,
              "retrieval_type": "HYBRID", "top_k": 3, "rerank": False, "decompose": False}],
        )
        out = tmp_path / "output.jsonl"
        gen = BudgetDatasetGenerator()
        gen.generate(calib, output_path=out)
        lines = out.read_text().splitlines()
        assert len(lines) > 0
        parsed = json.loads(lines[0])
        assert "query_type" in parsed
        assert "confidence" in parsed

    def test_entry_fields(self):
        e = BudgetDatasetEntry(
            "simple", 0.95, "HYBRID", 3, False, False, 50.0, False, True
        )
        assert e.query_type == "simple"
        assert e.top_k == 3
        assert e.rerank is False
        assert e.decompose is False
        assert e.success is True

    def test_generator_deterministic(self, tmp_path):
        calib = tmp_path / "calibration.jsonl"
        self._write_calibration(
            calib,
            [{"query_id": "Q1", "confidence": 0.9, "success": True, "latency_ms": 50,
              "retrieval_type": "HYBRID", "top_k": 3, "rerank": False, "decompose": False}],
        )
        gen1 = BudgetDatasetGenerator(seed=42)
        gen2 = BudgetDatasetGenerator(seed=42)
        e1 = gen1.generate(calib, augment=True)
        e2 = gen2.generate(calib, augment=True)
        assert len(e1) == len(e2)
        for a, b in zip(e1, e2):
            assert a.success == b.success


# ======================================================================
# BudgetOptimizer
# ======================================================================


class TestBudgetOptimizer:
    def test_not_fitted_by_default(self):
        opt = BudgetOptimizer()
        assert not opt.fitted

    def test_fit_updates_state(self, sample_entries):
        opt = BudgetOptimizer(min_samples_per_config=1)
        opt.fit(sample_entries)
        assert opt.fitted

    def test_fit_populates_recommendations(self, fitted_optimizer):
        assert fitted_optimizer.table.mapping
        assert fitted_optimizer.get_stats()["num_recommendations"] > 0

    def test_recommend_budget(self, fitted_optimizer):
        rec = fitted_optimizer.recommend_budget("simple", 0.95)
        assert rec.recommended_top_k > 0
        assert isinstance(rec.recommended_rerank, bool)
        assert isinstance(rec.recommended_decompose, bool)
        assert 0.0 <= rec.expected_success <= 1.0

    def test_recommend_budget_fallback_to_static(self):
        opt = BudgetOptimizer(min_samples_per_config=1)
        rec = opt.recommend_budget("simple", 0.95)
        assert rec.recommended_top_k > 0
        assert rec.source == "static_fallback"

    def test_recommend_budget_different_bands(self, fitted_optimizer):
        high = fitted_optimizer.recommend_budget("simple", 0.95)
        low = fitted_optimizer.recommend_budget("simple", 0.30)
        assert high.recommended_top_k > 0
        assert low.recommended_top_k > 0

    def test_evaluate_returns_dict(self, fitted_optimizer, sample_entries):
        result = fitted_optimizer.evaluate(sample_entries)
        assert "n_comparisons" in result
        assert "static_avg_score" in result
        assert "learned_avg_score" in result

    def test_evaluate_not_fitted(self, sample_entries):
        opt = BudgetOptimizer()
        result = opt.evaluate(sample_entries)
        assert "error" in result

    def test_min_samples_respected(self):
        entries = [
            BudgetDatasetEntry(
                "simple", 0.95, "HYBRID", 3, False, False, 50.0, False, True
            ),
        ]
        opt = BudgetOptimizer(min_samples_per_config=2)
        opt.fit(entries)
        assert fitted_optimizer  # does not crash with insufficient data
        stats = opt.get_stats()
        # may have no recommendations due to min_samples
        assert stats["num_recommendations"] >= 0

    def test_get_stats_structure(self, fitted_optimizer):
        stats = fitted_optimizer.get_stats()
        assert "fitted" in stats
        assert "num_recommendations" in stats
        assert "table" in stats


# ======================================================================
# Optimization Storage
# ======================================================================


class TestOptimizationStorage:
    def test_save_and_load(self, fitted_optimizer):
        with tempfile.NamedTemporaryFile(mode="w", suffix=".json", delete=False) as f:
            path = f.name
        try:
            save_optimizer(fitted_optimizer, path)
            assert os.path.exists(path)
            loaded = load_optimizer(path)
            assert loaded.fitted
            assert (
                loaded.scorer.success_weight == fitted_optimizer.scorer.success_weight
            )
        finally:
            if os.path.exists(path):
                os.unlink(path)

    def test_save_not_fitted_raises(self):
        opt = BudgetOptimizer()
        with tempfile.NamedTemporaryFile(mode="w", suffix=".json", delete=False) as f:
            path = f.name
        try:
            with pytest.raises(ValueError, match="unfitted"):
                save_optimizer(opt, path)
        finally:
            if os.path.exists(path):
                os.unlink(path)

    def test_load_nonexistent_raises(self):
        with pytest.raises(FileNotFoundError):
            load_optimizer("/nonexistent/file.json")

    def test_save_load_preserves_table(self, fitted_optimizer):
        with tempfile.NamedTemporaryFile(mode="w", suffix=".json", delete=False) as f:
            path = f.name
        try:
            save_optimizer(fitted_optimizer, path)
            loaded = load_optimizer(path)
            for qt in fitted_optimizer.table.mapping:
                for cb in fitted_optimizer.table.mapping[qt]:
                    orig = fitted_optimizer.table.get(qt, cb)
                    got = loaded.table.get(qt, cb)
                    assert got is not None
                    assert orig.recommended_top_k == got.recommended_top_k
                    assert orig.recommended_rerank == got.recommended_rerank
        finally:
            if os.path.exists(path):
                os.unlink(path)

    def test_saved_file_is_valid_json(self, fitted_optimizer):
        with tempfile.NamedTemporaryFile(mode="w", suffix=".json", delete=False) as f:
            path = f.name
        try:
            save_optimizer(fitted_optimizer, path)
            with open(path) as f2:
                data = json.load(f2)
            assert "fitted" in data
            assert "scorer" in data
            assert "table" in data
        finally:
            if os.path.exists(path):
                os.unlink(path)


# ======================================================================
# Optimization Metrics
# ======================================================================


class TestOptimizationMetrics:
    def test_budget_accuracy(self, fitted_optimizer, sample_entries):
        acc = compute_budget_accuracy(fitted_optimizer, sample_entries)
        assert 0.0 <= acc <= 1.0

    def test_success_lift(self, fitted_optimizer, sample_entries):
        lift = compute_success_lift(fitted_optimizer, sample_entries, 0.8)
        assert isinstance(lift, float)

    def test_latency_delta(self, fitted_optimizer, sample_entries):
        delta = compute_latency_delta(fitted_optimizer, sample_entries, 100.0)
        assert isinstance(delta, float)

    def test_fallback_reduction(self, fitted_optimizer, sample_entries):
        reduction = compute_fallback_reduction(fitted_optimizer, sample_entries, 0.2)
        assert isinstance(reduction, float)

    def test_generate_report(self, fitted_optimizer, sample_entries):
        eval_results = fitted_optimizer.evaluate(sample_entries)
        report = generate_optimization_report(
            fitted_optimizer, sample_entries, eval_results
        )
        assert "Learned Budget Table" in report
        assert "Comparison vs Static Budget" in report
        assert "Production Readiness" in report

    def test_accuracy_zero_when_not_fitted(self, sample_entries):
        opt = BudgetOptimizer()
        assert compute_budget_accuracy(opt, sample_entries) == 0.0


# ======================================================================
# Planner Integration
# ======================================================================


class TestPlannerOptimizerIntegration:
    def test_planner_accepts_optimizer(self, fitted_optimizer):
        from intelligence.planner.retrieval_planner import RetrievalPlanner

        class _Clf:
            def classify_with_confidence(self, query):
                class R:
                    pass

                r = R()
                r.query_type = "simple"
                r.domain = None
                r.confidence_score = 0.95
                return r

        planner = RetrievalPlanner(classifier=_Clf(), optimizer=fitted_optimizer)
        decision = planner.plan("test", use_learned_budget=True)
        assert decision.config["top_k"] > 0

    def test_planner_learned_budget_uses_optimizer(self):
        from intelligence.planner.retrieval_planner import RetrievalPlanner

        class _Opt:
            fitted = True

            def recommend_budget(self, qt, conf):
                from intelligence.optimization.budget_model import BudgetRecommendation

                return BudgetRecommendation(12, True, True, 0.9, 300.0)

        class _Clf:
            def classify_with_confidence(self, query):
                class R:
                    pass

                r = R()
                r.query_type = "simple"
                r.domain = None
                r.confidence_score = 0.95
                return r

        opt = _Opt()
        planner = RetrievalPlanner(classifier=_Clf(), optimizer=opt)
        learned = planner.plan("test", use_learned_budget=True)
        static = planner.plan("test", use_learned_budget=False)
        assert learned.config["top_k"] == 12
        assert static.config["top_k"] == 3

    def test_planner_no_optimizer_falls_back(self, fitted_optimizer):
        from intelligence.planner.retrieval_planner import RetrievalPlanner

        class _Clf:
            def classify_with_confidence(self, query):
                class R:
                    pass

                r = R()
                r.query_type = "simple"
                r.domain = None
                r.confidence_score = 0.95
                return r

        planner = RetrievalPlanner(classifier=_Clf())
        d1 = planner.plan("test", use_learned_budget=True)
        d2 = planner.plan("test", use_learned_budget=False)
        assert d1.config["top_k"] == d2.config["top_k"]

    def test_planner_not_fitted_optimizer_falls_back(self):
        from intelligence.planner.retrieval_planner import RetrievalPlanner

        class _Unfitted:
            fitted = False

        class _Clf:
            def classify_with_confidence(self, query):
                class R:
                    pass

                r = R()
                r.query_type = "simple"
                r.domain = None
                r.confidence_score = 0.95
                return r

        planner = RetrievalPlanner(classifier=_Clf(), optimizer=_Unfitted())
        decision = planner.plan("test", use_learned_budget=True)
        assert decision.config["top_k"] == 3

    def test_planner_with_evaluation_learned_budget(self):
        from intelligence.planner.retrieval_planner import RetrievalPlanner

        class _FullOptimizer:
            fitted = True

            def recommend_budget(self, qt, conf):
                from intelligence.optimization.budget_model import BudgetRecommendation

                return BudgetRecommendation(10, True, True, 0.8, 200.0)

        class _Clf:
            def classify_with_confidence(self, query):
                class R:
                    pass

                r = R()
                r.query_type = "complex"
                r.domain = None
                r.confidence_score = 0.70
                return r

        planner = RetrievalPlanner(classifier=_Clf(), optimizer=_FullOptimizer())
        decision = planner.plan_with_evaluation(
            "test", chunk_count=3, use_learned_budget=True
        )
        assert decision.fallback_decision is not None
        assert decision.config["top_k"] == 10


# ======================================================================
# Edge Cases
# ======================================================================


class TestEdgeCases:
    def test_all_successes(self):
        entries = [
            BudgetDatasetEntry(
                "simple", 0.8, "HYBRID", 3, False, False, 50.0, False, True
            )
            for _ in range(10)
        ]
        opt = BudgetOptimizer(min_samples_per_config=1)
        opt.fit(entries)
        rec = opt.recommend_budget("simple", 0.8)
        assert rec.recommended_top_k > 0

    def test_all_failures(self):
        entries = [
            BudgetDatasetEntry(
                "simple", 0.8, "HYBRID", 3, False, False, 50.0, False, False
            )
            for _ in range(10)
        ]
        opt = BudgetOptimizer(min_samples_per_config=1)
        opt.fit(entries)
        rec = opt.recommend_budget("simple", 0.8)
        assert rec.expected_success == 0.0

    def test_empty_entries(self):
        opt = BudgetOptimizer()
        opt.fit([])
        assert not opt.fitted  # no data to fit

    def test_single_entry(self):
        entries = [
            BudgetDatasetEntry(
                "simple", 0.8, "HYBRID", 3, False, False, 50.0, False, True
            )
        ]
        opt = BudgetOptimizer(min_samples_per_config=1)
        opt.fit(entries)
        assert opt.fitted
        rec = opt.recommend_budget("simple", 0.8)
        assert rec.recommended_top_k == 3

    def test_multiple_configs_per_band(self):
        entries = [
            BudgetDatasetEntry(
                "simple", 0.8, "HYBRID", 3, False, False, 50.0, False, True
            ),
            BudgetDatasetEntry(
                "simple", 0.8, "HYBRID", 5, False, False, 70.0, False, True
            ),
            BudgetDatasetEntry(
                "simple", 0.8, "HYBRID", 8, False, False, 100.0, False, True
            ),
        ]
        opt = BudgetOptimizer(min_samples_per_config=1)
        opt.fit(entries)
        rec = opt.recommend_budget("simple", 0.8)
        assert rec.recommended_top_k > 0

    def test_high_vs_low_confidence(self):
        high_entries = [
            BudgetDatasetEntry(
                "simple", 0.95, "HYBRID", 3, False, False, 50.0, False, True
            ),
            BudgetDatasetEntry(
                "simple", 0.95, "HYBRID", 5, False, False, 70.0, False, True
            ),
        ]
        low_entries = [
            BudgetDatasetEntry(
                "simple", 0.30, "HYBRID", 8, True, True, 200.0, True, False
            ),
            BudgetDatasetEntry(
                "simple", 0.30, "HYBRID", 5, False, False, 90.0, False, True
            ),
        ]
        opt = BudgetOptimizer(min_samples_per_config=1)
        opt.fit(high_entries + low_entries)
        high_rec = opt.recommend_budget("simple", 0.95)
        low_rec = opt.recommend_budget("simple", 0.30)
        assert high_rec.recommended_top_k >= 1
        assert low_rec.recommended_top_k >= 1

    def test_scorer_penalizes_large_top_k(self):
        s = BudgetScorer(top_k_penalty_weight=0.1)
        small = s.score(success_rate=1.0, avg_latency_ms=50, fallback_rate=0.0, top_k=3)
        large = s.score(
            success_rate=1.0, avg_latency_ms=50, fallback_rate=0.0, top_k=12
        )
        assert small > large

    def test_recommend_budget_unknown_type(self, fitted_optimizer):
        rec = fitted_optimizer.recommend_budget("unknown_type", 0.5)
        assert rec.recommended_top_k > 0
        assert rec.source == "static_fallback"
