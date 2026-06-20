"""Tests for the calibration engine."""

from __future__ import annotations

import json
import math
import os
import tempfile
from typing import List

import numpy as np
import pytest

from intelligence.calibration.calibration_metrics import (
    compute_brier_score,
    compute_confidence_histogram,
    compute_ece,
    compute_mce,
    compute_reliability_diagram,
    generate_calibration_report,
)
from intelligence.calibration.calibration_model import (
    CalibrationStrategy,
    IsotonicCalibrator,
    PlattScalingCalibrator,
)
from intelligence.calibration.calibration_storage import (
    load_calibrator,
    save_calibrator,
)
from intelligence.calibration.confidence_calibrator import (
    CalibrationResult,
    ConfidenceCalibrator,
)

# ======================================================================
# Fixtures
# ======================================================================


@pytest.fixture
def perfect_data() -> tuple:
    rng = np.random.RandomState(42)
    conf = np.linspace(0.1, 0.99, 200)
    success = rng.binomial(1, conf)
    return conf, success


@pytest.fixture
def overconfident_data() -> tuple:
    conf = np.array([0.95, 0.90, 0.85, 0.80, 0.75, 0.70, 0.65, 0.60])
    success = np.array([1, 1, 1, 1, 0, 0, 0, 0])
    return conf, success


@pytest.fixture
def underconfident_data() -> tuple:
    conf = np.array([0.40, 0.45, 0.50, 0.55, 0.60, 0.65, 0.70, 0.75])
    success = np.array([1, 1, 1, 1, 1, 1, 1, 1])
    return conf, success


@pytest.fixture
def small_data() -> tuple:
    return np.array([0.9, 0.8, 0.7, 0.6]), np.array([1, 1, 0, 0])


@pytest.fixture
def empty_data() -> tuple:
    return np.array([]), np.array([])


# ======================================================================
# CalibrationStrategy interface compliance
# ======================================================================


class TestCalibrationStrategy:
    def test_platt_scaling_is_concrete(self):
        PlattScalingCalibrator()

    def test_isotonic_is_concrete(self):
        IsotonicCalibrator()

    def test_platt_scaling_implements_abstract_methods(self):
        c = PlattScalingCalibrator()
        assert hasattr(c, "fit")
        assert hasattr(c, "predict")
        assert hasattr(c, "get_params")
        assert hasattr(c, "from_params")

    def test_isotonic_implements_abstract_methods(self):
        c = IsotonicCalibrator()
        assert hasattr(c, "fit")
        assert hasattr(c, "predict")
        assert hasattr(c, "get_params")
        assert hasattr(c, "from_params")

    def test_both_have_name(self):
        assert PlattScalingCalibrator().name == "platt_scaling"
        assert IsotonicCalibrator().name == "isotonic"

    def test_cannot_instantiate_abstract_base(self):
        with pytest.raises(TypeError):
            CalibrationStrategy()


# ======================================================================
# PlattScalingCalibrator
# ======================================================================


class TestPlattScaling:
    def test_fit_and_predict_produces_bounded_output(self, perfect_data):
        conf, success = perfect_data
        c = PlattScalingCalibrator()
        c.fit(conf, success)
        preds = c.predict(conf)
        assert np.all(preds >= 0.0)
        assert np.all(preds <= 1.0)

    def test_fit_and_predict_reduces_ece(self, overconfident_data):
        conf, success = overconfident_data
        c = PlattScalingCalibrator()
        raw_ece = compute_ece(conf, success)
        c.fit(conf, success)
        cal = c.predict(conf)
        cal_ece = compute_ece(cal, success)
        assert cal_ece < raw_ece

    def test_single_value_prediction(self, perfect_data):
        conf, success = perfect_data
        c = PlattScalingCalibrator()
        c.fit(conf, success)
        pred = c.predict(np.array([0.85]))
        assert 0.0 <= pred[0] <= 1.0

    def test_monotonic_trend(self):
        conf = np.array([0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9])
        success = np.array([0, 0, 1, 1, 1, 1, 1])
        c = PlattScalingCalibrator()
        c.fit(conf, success)
        preds = c.predict(conf)
        for i in range(len(preds) - 1):
            assert preds[i] <= preds[i + 1] + 1e-8

    def test_get_params(self, perfect_data):
        conf, success = perfect_data
        c = PlattScalingCalibrator()
        c.fit(conf, success)
        params = c.get_params()
        assert "coef" in params
        assert "intercept" in params
        assert len(params["coef"]) == 1
        assert len(params["intercept"]) == 1

    def test_from_params_roundtrip(self, perfect_data):
        conf, success = perfect_data
        c1 = PlattScalingCalibrator()
        c1.fit(conf, success)
        params = c1.get_params()
        c2 = PlattScalingCalibrator.from_params(params)
        pred1 = c1.predict(conf)
        pred2 = c2.predict(conf)
        np.testing.assert_array_almost_equal(pred1, pred2)

    def test_predict_before_fit_raises(self):
        c = PlattScalingCalibrator()
        with pytest.raises(Exception):
            c.predict(np.array([0.5]))

    def test_fit_with_single_class(self):
        conf = np.linspace(0.5, 0.7, 20)
        success = np.ones(20)
        c = IsotonicCalibrator()
        c.fit(conf, success)
        preds = c.predict(conf)
        assert np.all(preds >= 0.0)

    def test_fit_empty_raises(self):
        c = PlattScalingCalibrator()
        with pytest.raises(ValueError):
            c.fit(np.array([]), np.array([]))


# ======================================================================
# IsotonicCalibrator
# ======================================================================


class TestIsotonic:
    def test_fit_and_predict_produces_bounded_output(self, perfect_data):
        conf, success = perfect_data
        c = IsotonicCalibrator()
        c.fit(conf, success)
        preds = c.predict(conf)
        assert np.all(preds >= 0.0)
        assert np.all(preds <= 1.0)

    def test_fit_and_predict_reduces_ece(self, underconfident_data):
        conf, success = underconfident_data
        c = IsotonicCalibrator()
        raw_ece = compute_ece(conf, success)
        c.fit(conf, success)
        cal = c.predict(conf)
        cal_ece = compute_ece(cal, success)
        assert cal_ece <= raw_ece + 1e-8

    def test_strictly_monotonic(self):
        conf = np.linspace(0.1, 0.9, 50)
        rng = np.random.RandomState(1)
        success = rng.binomial(1, conf)
        c = IsotonicCalibrator()
        c.fit(conf, success)
        preds = c.predict(conf)
        diffs = np.diff(preds)
        assert np.all(diffs >= -1e-10)

    def test_get_params(self, perfect_data):
        conf, success = perfect_data
        c = IsotonicCalibrator()
        c.fit(conf, success)
        params = c.get_params()
        assert "X_thresholds_" in params
        assert "y_thresholds_" in params

    def test_from_params_roundtrip(self, perfect_data):
        conf, success = perfect_data
        c1 = IsotonicCalibrator()
        c1.fit(conf, success)
        params = c1.get_params()
        c2 = IsotonicCalibrator.from_params(params)
        pred1 = c1.predict(conf)
        pred2 = c2.predict(conf)
        np.testing.assert_array_almost_equal(pred1, pred2)

    def test_predict_before_fit_raises(self):
        c = IsotonicCalibrator()
        with pytest.raises(Exception):
            c.predict(np.array([0.5]))

    def test_fit_empty_raises(self):
        c = IsotonicCalibrator()
        with pytest.raises(ValueError):
            c.fit(np.array([]), np.array([]))

    def test_single_value_prediction(self, perfect_data):
        conf, success = perfect_data
        c = IsotonicCalibrator()
        c.fit(conf, success)
        pred = c.predict(np.array([0.85]))
        assert 0.0 <= pred[0] <= 1.0


# ======================================================================
# ConfidenceCalibrator
# ======================================================================


class TestConfidenceCalibrator:
    def test_default_strategy_is_platt_scaling(self):
        cc = ConfidenceCalibrator()
        assert isinstance(cc.strategy, PlattScalingCalibrator)

    def test_fit_updates_state(self, perfect_data):
        conf, success = perfect_data
        cc = ConfidenceCalibrator()
        cc.fit(conf, success)
        assert cc.fitted
        assert cc.n_training_samples == len(conf)

    def test_fit_with_insufficient_samples_raises(self, small_data):
        conf, success = small_data
        cc = ConfidenceCalibrator(min_samples=10)
        with pytest.raises(ValueError, match="Need at least"):
            cc.fit(conf, success)

    def test_predict_returns_raw_when_not_fitted(self):
        cc = ConfidenceCalibrator()
        result = cc.predict(0.85)
        assert result == 0.85

    def test_predict_returns_calibrated_when_fitted(self, perfect_data):
        conf, success = perfect_data
        cc = ConfidenceCalibrator()
        cc.fit(conf, success)
        result = cc.predict(0.85)
        assert 0.0 <= result <= 1.0

    def test_calibrate_returns_result_object(self, perfect_data):
        conf, success = perfect_data
        cc = ConfidenceCalibrator()
        cc.fit(conf, success)
        result = cc.calibrate(0.85)
        assert isinstance(result, CalibrationResult)
        assert result.raw_confidence == 0.85
        assert 0.0 <= result.calibrated_confidence <= 1.0
        assert result.method == "platt_scaling"

    def test_calibrate_delta_computation(self, perfect_data):
        conf, success = perfect_data
        cc = ConfidenceCalibrator()
        cc.fit(conf, success)
        result = cc.calibrate(0.85)
        assert abs(result.confidence_delta - (result.calibrated_confidence - 0.85)) < 1e-10

    def test_calibrate_with_metadata(self, perfect_data):
        conf, success = perfect_data
        cc = ConfidenceCalibrator()
        cc.fit(conf, success)
        result = cc.calibrate(0.85, metadata={"query_type": "SIMPLE"})
        assert result.metadata["query_type"] == "SIMPLE"

    def test_on_calibrate_callback(self, perfect_data):
        conf, success = perfect_data
        captured = []

        def cb(result):
            captured.append(result)

        cc = ConfidenceCalibrator(on_calibrate=cb)
        cc.fit(conf, success)
        cc.calibrate(0.85)
        assert len(captured) == 1
        assert isinstance(captured[0], CalibrationResult)

    def test_isotonic_strategy(self, perfect_data):
        conf, success = perfect_data
        cc = ConfidenceCalibrator(strategy=IsotonicCalibrator())
        cc.fit(conf, success)
        assert cc.strategy.name == "isotonic"
        result = cc.calibrate(0.85)
        assert result.method == "isotonic"

    def test_fit_updates_accuracy(self, perfect_data):
        conf, success = perfect_data
        cc = ConfidenceCalibrator()
        cc.fit(conf, success)
        assert cc._accuracy is not None
        assert 0.0 <= cc._accuracy <= 1.0

    def test_fit_updates_ece(self, perfect_data):
        conf, success = perfect_data
        cc = ConfidenceCalibrator()
        cc.fit(conf, success)
        assert cc._ece is not None
        assert cc._ece >= 0.0

    def test_predict_clips_to_unit_interval(self):
        class _OutOfRangeCalibrator(CalibrationStrategy):
            name = "out_of_range"
            def fit(self, c, s): pass
            def predict(self, c):
                return np.array([-0.5 if x < 0.5 else 1.5 for x in c.ravel()])
            def get_params(self): return {}
            @classmethod
            def from_params(cls, p): return cls()

        cc = ConfidenceCalibrator()
        cc._fitted = True
        cc._strategy = _OutOfRangeCalibrator()
        low = cc.predict(0.3)
        high = cc.predict(0.7)
        assert low == 0.0
        assert high == 1.0

    def test_calibrate_clips_confidence(self):
        cc = ConfidenceCalibrator()
        cc._fitted = True
        cc._strategy = _MockCalibrator()
        result = cc.calibrate(0.5)
        assert 0.0 <= result.calibrated_confidence <= 1.0

    def test_fit_empty_raises(self):
        cc = ConfidenceCalibrator()
        with pytest.raises(ValueError):
            cc.fit(np.array([]), np.array([]))

    def test_accuracy_after_perfect_fit(self):
        conf = np.array([0.3, 0.3, 0.4, 0.4, 0.5, 0.5, 0.6, 0.6,
                         0.7, 0.7, 0.8, 0.8, 0.9, 0.9, 1.0, 1.0,
                         0.3, 0.4, 0.5, 0.6])
        success = np.array([0, 1, 0, 1, 0, 1, 1, 1,
                            1, 1, 1, 1, 1, 1, 1, 1,
                            0, 0, 1, 1])
        cc = ConfidenceCalibrator()
        cc.fit(conf, success)
        expected_acc = success.mean()
        assert cc._accuracy == pytest.approx(expected_acc)


class _MockCalibrator(CalibrationStrategy):
    name = "mock"

    def fit(self, confidences, successes):
        pass

    def predict(self, confidences):
        return np.clip(confidences * 0.5 + 0.3, 0.0, 1.0)

    def get_params(self):
        return {"type": "mock"}

    @classmethod
    def from_params(cls, params):
        return cls()


# ======================================================================
# Calibration Metrics
# ======================================================================


class TestECE:
    def test_perfect_calibration(self):
        conf = np.array([0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9])
        success = conf.copy()
        ece = compute_ece(conf, success)
        assert ece == pytest.approx(0.0, abs=1e-10)

    def test_overconfident_gives_positive_ece(self):
        conf = np.array([0.9, 0.8, 0.7, 0.6])
        success = np.array([1.0, 0.0, 0.0, 0.0])
        ece = compute_ece(conf, success)
        assert ece > 0.0

    def test_empty_returns_zero(self, empty_data):
        conf, success = empty_data
        assert compute_ece(conf, success) == 0.0

    def test_custom_n_bins(self):
        conf = np.array([0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0])
        success = conf.copy()
        ece_2 = compute_ece(conf, success, n_bins=2)
        ece_10 = compute_ece(conf, success, n_bins=10)
        assert ece_2 >= 0.0
        assert ece_10 >= 0.0


class TestMCE:
    def test_perfect_calibration(self):
        conf = np.array([0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9])
        success = conf.copy()
        mce = compute_mce(conf, success)
        assert mce == pytest.approx(0.0, abs=1e-10)

    def test_empty_returns_zero(self, empty_data):
        conf, success = empty_data
        assert compute_mce(conf, success) == 0.0

    def test_mce_less_than_or_equal_to_one(self):
        conf = np.array([0.9, 0.8, 0.7, 0.6])
        success = np.array([0.0, 0.0, 0.0, 0.0])
        mce = compute_mce(conf, success)
        assert 0.0 <= mce <= 1.0

    def test_mce_is_greater_than_or_equal_to_ece(self):
        conf = np.array([0.2, 0.4, 0.6, 0.8, 0.2, 0.4, 0.6, 0.8])
        success = np.array([1, 0, 1, 0, 0, 1, 0, 1])
        ece = compute_ece(conf, success)
        mce = compute_mce(conf, success)
        assert mce >= ece


class TestBrierScore:
    def test_perfect_score(self):
        conf = np.array([1.0, 1.0, 0.0, 0.0])
        success = np.array([1.0, 1.0, 0.0, 0.0])
        assert compute_brier_score(conf, success) == 0.0

    def test_worst_score(self):
        conf = np.array([1.0, 0.0])
        success = np.array([0.0, 1.0])
        assert compute_brier_score(conf, success) == 1.0

    def test_empty_returns_zero(self, empty_data):
        conf, success = empty_data
        assert compute_brier_score(conf, success) == 0.0

    def test_range(self):
        conf = np.array([0.5, 0.5, 0.5])
        success = np.array([1.0, 0.0, 1.0])
        bs = compute_brier_score(conf, success)
        assert 0.0 <= bs <= 1.0


class TestReliabilityDiagram:
    def test_returns_dict_with_bins(self, perfect_data):
        conf, success = perfect_data
        rd = compute_reliability_diagram(conf, success)
        assert "bins" in rd
        assert "n_total" in rd
        assert rd["n_total"] == len(conf)
        assert len(rd["bins"]) == 10

    def test_empty_returns_bins_with_no_samples(self, empty_data):
        conf, success = empty_data
        rd = compute_reliability_diagram(conf, success)
        assert len(rd["bins"]) == 10
        assert all(b["count"] == 0 for b in rd["bins"])

    def test_perfect_calibration_bins(self):
        conf = np.array([0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9])
        success = conf.copy()
        rd = compute_reliability_diagram(conf, success)
        for b in rd["bins"]:
            if b["count"] > 0:
                assert abs(b["gap"]) < 0.2

    def test_bin_keys_present(self):
        conf = np.array([0.3, 0.7])
        success = np.array([1, 0])
        rd = compute_reliability_diagram(conf, success)
        b = rd["bins"][3]
        assert "bin_center" in b
        assert "bin_lower" in b
        assert "bin_upper" in b
        assert "count" in b
        assert "accuracy" in b
        assert "avg_confidence" in b
        assert "gap" in b


class TestConfidenceHistogram:
    def test_returns_dict_with_bins(self, perfect_data):
        conf, success = perfect_data
        hist = compute_confidence_histogram(conf, success)
        assert "bins" in hist
        assert hist["n_total"] == len(conf)

    def test_empty_returns_all_zeros(self, empty_data):
        conf, success = empty_data
        hist = compute_confidence_histogram(conf, success)
        assert all(b["count"] == 0 for b in hist["bins"])

    def test_success_rate_between_zero_and_one(self):
        conf = np.array([0.5, 0.5, 0.5])
        success = np.array([1, 0, 1])
        hist = compute_confidence_histogram(conf, success)
        bin5 = hist["bins"][5]
        assert 0.0 <= bin5["success_rate"] <= 1.0


class TestCalibrationReport:
    def test_generate_report(self, overconfident_data):
        conf, success = overconfident_data
        cal_conf = conf * 0.9 + 0.05
        report = generate_calibration_report(conf, success, cal_conf)
        assert "CALIBRATION REPORT" in report
        assert "ECE" in report
        assert "MCE" in report
        assert "Brier Score" in report
        assert "Reliability Diagram" in report
        assert "Before" in report
        assert "After" in report

    def test_report_contains_metric_values(self, overconfident_data):
        conf, success = overconfident_data
        report = generate_calibration_report(conf, success, conf)
        lines = report.split("\n")
        metric_lines = [l for l in lines if "ECE" in l or "MCE" in l or "Brier" in l]
        assert len(metric_lines) >= 3

    def test_report_empty_data(self, empty_data):
        conf, success = empty_data
        report = generate_calibration_report(conf, success, conf)
        assert "Total samples: 0" in report


# ======================================================================
# Calibration Storage
# ======================================================================


class TestCalibrationStorage:
    def test_save_and_load_platt(self, perfect_data):
        conf, success = perfect_data
        cc = ConfidenceCalibrator(strategy=PlattScalingCalibrator())
        cc.fit(conf, success)
        with tempfile.NamedTemporaryFile(mode="w", suffix=".json", delete=False) as f:
            path = f.name
        try:
            save_calibrator(cc, path)
            assert os.path.exists(path)
            loaded = load_calibrator(path)
            assert loaded.fitted
            assert loaded.strategy.name == "platt_scaling"
            assert loaded.n_training_samples == len(conf)
            r1 = cc.calibrate(0.85)
            r2 = loaded.calibrate(0.85)
            assert r1.calibrated_confidence == pytest.approx(r2.calibrated_confidence, abs=1e-6)
        finally:
            if os.path.exists(path):
                os.unlink(path)

    def test_save_and_load_isotonic(self, perfect_data):
        conf, success = perfect_data
        cc = ConfidenceCalibrator(strategy=IsotonicCalibrator())
        cc.fit(conf, success)
        with tempfile.NamedTemporaryFile(mode="w", suffix=".json", delete=False) as f:
            path = f.name
        try:
            save_calibrator(cc, path)
            loaded = load_calibrator(path)
            assert loaded.strategy.name == "isotonic"
            assert loaded.fitted
            r1 = cc.calibrate(0.85)
            r2 = loaded.calibrate(0.85)
            assert r1.calibrated_confidence == pytest.approx(r2.calibrated_confidence, abs=1e-6)
        finally:
            if os.path.exists(path):
                os.unlink(path)

    def test_save_not_fitted_raises(self):
        cc = ConfidenceCalibrator()
        with tempfile.NamedTemporaryFile(mode="w", suffix=".json", delete=False) as f:
            path = f.name
        try:
            with pytest.raises(ValueError, match="unfitted"):
                save_calibrator(cc, path)
        finally:
            if os.path.exists(path):
                os.unlink(path)

    def test_load_nonexistent_raises(self):
        with pytest.raises(FileNotFoundError):
            load_calibrator("/nonexistent/file.json")

    def test_saved_file_is_valid_json(self, perfect_data):
        conf, success = perfect_data
        cc = ConfidenceCalibrator()
        cc.fit(conf, success)
        with tempfile.NamedTemporaryFile(mode="w", suffix=".json", delete=False) as f:
            path = f.name
        try:
            save_calibrator(cc, path)
            with open(path) as f:
                data = json.load(f)
            assert "strategy_name" in data
            assert "params" in data
            assert "n_training_samples" in data
            assert "accuracy" in data
            assert "ece" in data
        finally:
            if os.path.exists(path):
                os.unlink(path)

    def test_load_unknown_strategy_raises(self):
        data = {"strategy_name": "unknown", "params": {}}
        with tempfile.NamedTemporaryFile(mode="w", suffix=".json", delete=False) as f:
            json.dump(data, f)
            path = f.name
        try:
            with pytest.raises(ValueError, match="Unknown"):
                load_calibrator(path)
        finally:
            if os.path.exists(path):
                os.unlink(path)


# ======================================================================
# Integration: Planner + Calibrator
# ======================================================================


class _FakeClassifier:
    def classify_with_confidence(self, query: str):
        class _FakeResponse:
            query_type = "simple"
            domain = None
            confidence_score = 0.95
        return _FakeResponse()


class _FakeCalibrator(ConfidenceCalibrator):
    def __init__(self) -> None:
        super().__init__()
        self._fitted = True

    def calibrate(self, confidence, metadata=None):
        return CalibrationResult(
            calibrated_confidence=confidence * 0.8,
            raw_confidence=confidence,
            method="test",
            confidence_delta=confidence * 0.8 - confidence,
            metadata=metadata or {},
        )


class TestPlannerCalibrationIntegration:
    def test_planner_accepts_calibrator(self):
        from intelligence.planner.retrieval_planner import RetrievalPlanner
        cc = _FakeCalibrator()
        planner = RetrievalPlanner(classifier=_FakeClassifier(), calibrator=cc)
        decision = planner.plan("test", use_calibrated_confidence=True)
        assert decision.calibrated_confidence is not None

    def test_planner_calibrated_confidence_different_from_raw(self):
        from intelligence.planner.retrieval_planner import RetrievalPlanner
        cc = _FakeCalibrator()
        planner = RetrievalPlanner(classifier=_FakeClassifier(), calibrator=cc)
        decision = planner.plan("test", use_calibrated_confidence=True)
        assert decision.calibrated_confidence != decision.confidence

    def test_planner_calibration_method_in_decision(self):
        from intelligence.planner.retrieval_planner import RetrievalPlanner
        cc = _FakeCalibrator()
        planner = RetrievalPlanner(classifier=_FakeClassifier(), calibrator=cc)
        decision = planner.plan("test", use_calibrated_confidence=True)
        assert decision.calibration_method == "test"

    def test_planner_disabled_calibration_uses_raw(self):
        from intelligence.planner.retrieval_planner import RetrievalPlanner
        cc = _FakeCalibrator()
        planner = RetrievalPlanner(classifier=_FakeClassifier(), calibrator=cc)
        decision = planner.plan("test", use_calibrated_confidence=False)
        assert decision.calibrated_confidence == decision.confidence

    def test_planner_no_calibrator_uses_raw(self):
        from intelligence.planner.retrieval_planner import RetrievalPlanner
        planner = RetrievalPlanner(classifier=_FakeClassifier())
        decision = planner.plan("test", use_calibrated_confidence=True)
        assert decision.calibrated_confidence == decision.confidence

    def test_planner_not_fitted_calibrator_uses_raw(self):
        from intelligence.planner.retrieval_planner import RetrievalPlanner
        cc = ConfidenceCalibrator()
        planner = RetrievalPlanner(classifier=_FakeClassifier(), calibrator=cc)
        decision = planner.plan("test", use_calibrated_confidence=True)
        assert decision.calibrated_confidence == decision.confidence

    def test_planner_with_evaluation_calibrated(self):
        from intelligence.planner.retrieval_planner import RetrievalPlanner
        cc = _FakeCalibrator()
        planner = RetrievalPlanner(classifier=_FakeClassifier(), calibrator=cc)
        decision = planner.plan_with_evaluation("test", chunk_count=5, use_calibrated_confidence=True)
        assert decision.fallback_decision is not None
        assert decision.calibrated_confidence is not None

    def test_planner_with_evaluation_calibrated_differs_from_raw(self):
        from intelligence.planner.retrieval_planner import RetrievalPlanner
        cc = _FakeCalibrator()
        planner = RetrievalPlanner(classifier=_FakeClassifier(), calibrator=cc)
        decision = planner.plan_with_evaluation("test", chunk_count=5, use_calibrated_confidence=True)
        assert decision.calibrated_confidence != decision.confidence

    def test_planner_with_evaluation_no_calibrator(self):
        from intelligence.planner.retrieval_planner import RetrievalPlanner
        planner = RetrievalPlanner(classifier=_FakeClassifier())
        decision = planner.plan_with_evaluation("test", chunk_count=5, use_calibrated_confidence=True)
        assert decision.calibrated_confidence == decision.confidence

    def test_planner_budget_uses_calibrated_confidence(self):
        from intelligence.planner.retrieval_planner import RetrievalPlanner
        cc = _FakeCalibrator()
        planner = RetrievalPlanner(classifier=_FakeClassifier(), calibrator=cc)
        raw_decision = planner.plan("test", use_calibrated_confidence=False)
        cal_decision = planner.plan("test", use_calibrated_confidence=True)
        raw_conf = raw_decision.confidence
        cal_conf = cal_decision.calibrated_confidence

        from intelligence.planner.budget_allocator import resolve_confidence_band
        raw_band = resolve_confidence_band(raw_conf)
        cal_band = resolve_confidence_band(cal_conf)
        assert raw_band is not None
        assert cal_band is not None


# ======================================================================
# Edge Cases
# ======================================================================


class TestEdgeCases:
    def test_all_identical_confidences(self):
        conf = np.full(100, 0.7)
        rng = np.random.RandomState(42)
        success = rng.binomial(1, 0.7, size=100)
        cc = ConfidenceCalibrator()
        cc.fit(conf, success)
        result = cc.calibrate(0.7)
        assert 0.0 <= result.calibrated_confidence <= 1.0

    def test_extreme_confidences(self):
        rng = np.random.RandomState(42)
        conf = np.concatenate([
            rng.uniform(0.0, 0.05, 10),
            rng.uniform(0.95, 1.0, 10),
        ])
        success = np.array([0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
                            1, 1, 1, 1, 1, 1, 1, 1, 1, 1])
        cc = ConfidenceCalibrator()
        cc.fit(conf, success)
        for v in [0.0, 0.01, 0.5, 0.99, 1.0]:
            result = cc.calibrate(v)
            assert 0.0 <= result.calibrated_confidence <= 1.0

    def test_very_large_dataset(self):
        rng = np.random.RandomState(123)
        conf = rng.uniform(0.0, 1.0, 10000)
        success = rng.binomial(1, conf)
        cc = ConfidenceCalibrator()
        cc.fit(conf, success)
        preds = cc.predict(conf[:10])
        assert np.all(preds >= 0.0)
        assert np.all(preds <= 1.0)

    def test_all_successes(self):
        conf = np.linspace(0.3, 0.6, 20)
        success = np.ones(20)
        cc = ConfidenceCalibrator(strategy=IsotonicCalibrator())
        cc.fit(conf, success)
        result = cc.calibrate(0.5)
        assert 0.0 <= result.calibrated_confidence <= 1.0

    def test_all_failures(self):
        conf = np.linspace(0.3, 0.6, 20)
        success = np.zeros(20)
        cc = ConfidenceCalibrator(strategy=IsotonicCalibrator())
        cc.fit(conf, success)
        result = cc.calibrate(0.5)
        assert 0.0 <= result.calibrated_confidence <= 1.0

    def test_zero_confidence(self):
        conf = np.array([0.0, 0.1, 0.2, 0.3])
        success = np.array([0, 0, 0, 1])
        cc = ConfidenceCalibrator(min_samples=1)
        cc.fit(conf, success)
        result = cc.calibrate(0.0)
        assert 0.0 <= result.calibrated_confidence <= 1.0

    def test_calibrate_unchanged_when_unfitted(self):
        cc = ConfidenceCalibrator()
        result = cc.calibrate(0.85)
        assert result.calibrated_confidence == 0.85
        assert result.raw_confidence == 0.85
        assert result.method == "platt_scaling"
        assert result.confidence_delta == 0.0

    def test_min_samples_boundary(self):
        conf = np.arange(20, dtype=float) / 20.0
        success = (conf > 0.5).astype(float)
        cc = ConfidenceCalibrator(min_samples=20)
        cc.fit(conf, success)
        assert cc.fitted

    def test_min_samples_one_below_boundary(self):
        conf = np.arange(19, dtype=float) / 19.0
        success = (conf > 0.5).astype(float)
        cc = ConfidenceCalibrator(min_samples=20)
        with pytest.raises(ValueError, match="Need at least"):
            cc.fit(conf, success)

    def test_ece_with_empty_bins(self):
        conf = np.array([0.01, 0.02, 0.98, 0.99])
        success = np.array([0, 0, 1, 1])
        ece = compute_ece(conf, success, n_bins=10)
        assert ece >= 0.0
        assert ece <= 1.0

    def test_mce_with_single_bin_nonempty(self):
        conf = np.array([0.05] * 100)
        success = np.array([1] * 50 + [0] * 50)
        mce = compute_mce(conf, success, n_bins=10)
        assert mce >= 0.0

    def test_brier_score_single_element(self):
        assert compute_brier_score(np.array([0.7]), np.array([1.0])) == pytest.approx(0.09)

    def test_generate_report_single_element(self):
        conf = np.array([0.8])
        success = np.array([1])
        report = generate_calibration_report(conf, success, conf)
        assert "Total samples: 1" in report


# ======================================================================
# CalibrationResult
# ======================================================================


class TestCalibrationResult:
    def test_default_metadata_is_empty(self):
        r = CalibrationResult(calibrated_confidence=0.8, raw_confidence=0.9, method="p", confidence_delta=-0.1)
        assert r.metadata == {}

    def test_repr(self):
        r = CalibrationResult(calibrated_confidence=0.8, raw_confidence=0.9, method="p", confidence_delta=-0.1)
        assert "calibrated_confidence" in repr(r)

    def test_fields(self):
        r = CalibrationResult(
            calibrated_confidence=0.8,
            raw_confidence=0.9,
            method="platt_scaling",
            confidence_delta=-0.1,
            metadata={"query_type": "SIMPLE"},
        )
        assert r.calibrated_confidence == 0.8
        assert r.raw_confidence == 0.9
        assert r.method == "platt_scaling"
        assert r.confidence_delta == -0.1
        assert r.metadata["query_type"] == "SIMPLE"
