from __future__ import annotations

from abc import ABC, abstractmethod
from typing import Optional

import numpy as np
from sklearn.isotonic import IsotonicRegression
from sklearn.linear_model import LogisticRegression


class CalibrationStrategy(ABC):
    name: str = "base"

    @abstractmethod
    def fit(self, confidences: np.ndarray, successes: np.ndarray) -> None: ...

    @abstractmethod
    def predict(self, confidences: np.ndarray) -> np.ndarray: ...

    @abstractmethod
    def get_params(self) -> dict: ...

    @classmethod
    @abstractmethod
    def from_params(cls, params: dict) -> CalibrationStrategy: ...


class PlattScalingCalibrator(CalibrationStrategy):
    name: str = "platt_scaling"

    def __init__(self, model: Optional[LogisticRegression] = None):
        self._model = model or LogisticRegression(
            C=1e10,
            solver="lbfgs",
            max_iter=1000,
            random_state=42,
        )

    def fit(self, confidences: np.ndarray, successes: np.ndarray) -> None:
        X = np.atleast_2d(confidences).reshape(-1, 1)
        self._model.fit(X, successes.ravel())

    def predict(self, confidences: np.ndarray) -> np.ndarray:
        X = np.atleast_2d(confidences).reshape(-1, 1)
        return self._model.predict_proba(X)[:, 1]

    def get_params(self) -> dict:
        return {
            "coef": self._model.coef_.tolist(),
            "intercept": self._model.intercept_.tolist(),
        }

    @classmethod
    def from_params(cls, params: dict) -> PlattScalingCalibrator:
        coef = np.array(params["coef"])
        intercept = np.array(params["intercept"])
        m = LogisticRegression(C=1e10, solver="lbfgs", max_iter=1000, random_state=42)
        m.coef_ = coef
        m.intercept_ = intercept
        m.classes_ = np.array([0, 1])
        return cls(model=m)


class IsotonicCalibrator(CalibrationStrategy):
    name: str = "isotonic"

    def __init__(self, model: Optional[IsotonicRegression] = None):
        self._model = model or IsotonicRegression(
            increasing=True,
            out_of_bounds="clip",
        )

    def fit(self, confidences: np.ndarray, successes: np.ndarray) -> None:
        self._model.fit(confidences.ravel(), successes.ravel())

    def predict(self, confidences: np.ndarray) -> np.ndarray:
        return self._model.predict(confidences.ravel())

    def get_params(self) -> dict:
        return {
            "X_thresholds_": self._model.X_thresholds_.tolist(),
            "y_thresholds_": self._model.y_thresholds_.tolist(),
        }

    @classmethod
    def from_params(cls, params: dict) -> IsotonicCalibrator:
        X = np.array(params["X_thresholds_"])
        y = np.array(params["y_thresholds_"])
        m = IsotonicRegression(increasing=True, out_of_bounds="clip")
        m.fit(X, y)
        return cls(model=m)
