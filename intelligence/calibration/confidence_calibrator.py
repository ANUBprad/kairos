from __future__ import annotations

from dataclasses import dataclass, field
from typing import Callable, Optional

import numpy as np

from .calibration_model import CalibrationStrategy, IsotonicCalibrator, PlattScalingCalibrator


@dataclass
class CalibrationResult:
    calibrated_confidence: float
    raw_confidence: float
    method: str
    confidence_delta: float
    metadata: dict = field(default_factory=dict)


class ConfidenceCalibrator:
    def __init__(
        self,
        strategy: Optional[CalibrationStrategy] = None,
        min_samples: int = 20,
        smoothing: float = 1e-6,
        on_calibrate: Optional[Callable[[CalibrationResult], None]] = None,
    ):
        self._strategy = strategy or PlattScalingCalibrator()
        self._min_samples = min_samples
        self._smoothing = smoothing
        self._on_calibrate = on_calibrate
        self._fitted = False
        self._n_training_samples: int = 0
        self._accuracy: Optional[float] = None
        self._ece: Optional[float] = None

    @property
    def fitted(self) -> bool:
        return self._fitted

    @property
    def strategy(self) -> CalibrationStrategy:
        return self._strategy

    @property
    def n_training_samples(self) -> int:
        return self._n_training_samples

    def fit(
        self,
        confidences: np.ndarray,
        successes: np.ndarray,
        tracker: Optional[object] = None,
    ) -> None:
        confidences = np.asarray(confidences, dtype=float).ravel()
        successes = np.asarray(successes, dtype=float).ravel()

        if len(confidences) < self._min_samples:
            raise ValueError(
                f"Need at least {self._min_samples} training samples, "
                f"got {len(confidences)}"
            )

        self._strategy.fit(confidences, successes)
        self._fitted = True
        self._n_training_samples = len(confidences)
        self._accuracy = float(successes.mean())

        from .calibration_metrics import compute_ece
        self._ece = compute_ece(
            self._strategy.predict(confidences), successes
        )

        if tracker is not None:
            tracker.log_metrics({
                "ece": self._ece,
                "training_samples": float(self._n_training_samples),
                "accuracy": self._accuracy,
            })
            tracker.log_parameter("calibrator_type", self._strategy.name)

    def predict(self, confidence: float) -> float:
        if not self._fitted:
            return confidence
        raw = np.atleast_1d(np.asarray(confidence, dtype=float))
        calibrated = float(self._strategy.predict(raw)[0])
        calibrated = np.clip(calibrated, 0.0, 1.0).item()
        return calibrated

    def calibrate(
        self,
        confidence: float,
        metadata: Optional[dict] = None,
    ) -> CalibrationResult:
        raw_conf = confidence
        calibrated = self.predict(raw_conf)

        result = CalibrationResult(
            calibrated_confidence=calibrated,
            raw_confidence=raw_conf,
            method=self._strategy.name,
            confidence_delta=calibrated - raw_conf,
            metadata=metadata or {},
        )

        if self._on_calibrate:
            self._on_calibrate(result)

        return result
