from __future__ import annotations

import json
import os
from dataclasses import dataclass
from typing import Optional

from .calibration_model import CalibrationStrategy, IsotonicCalibrator, PlattScalingCalibrator
from .confidence_calibrator import ConfidenceCalibrator


@dataclass
class CalibrationModelData:
    strategy_name: str
    params: dict
    n_training_samples: int
    accuracy: Optional[float]
    ece: Optional[float]


def _serialize_calibrator(calibrator: ConfidenceCalibrator) -> dict:
    return {
        "strategy_name": calibrator.strategy.name,
        "params": calibrator.strategy.get_params(),
        "n_training_samples": calibrator.n_training_samples,
        "accuracy": calibrator._accuracy,
        "ece": calibrator._ece,
    }


def _deserialize_strategy(data: dict) -> CalibrationStrategy:
    name = data["strategy_name"]
    params = data["params"]
    if name == "platt_scaling":
        return PlattScalingCalibrator.from_params(params)
    if name == "isotonic":
        return IsotonicCalibrator.from_params(params)
    raise ValueError(f"Unknown calibration strategy: {name}")


def save_calibrator(
    calibrator: ConfidenceCalibrator,
    path: str,
) -> None:
    if not calibrator.fitted:
        raise ValueError("Cannot save unfitted calibrator")
    data = _serialize_calibrator(calibrator)
    with open(path, "w") as f:
        json.dump(data, f, indent=2)


def load_calibrator(path: str) -> ConfidenceCalibrator:
    if not os.path.exists(path):
        raise FileNotFoundError(f"Calibrator file not found: {path}")
    with open(path) as f:
        data = json.load(f)

    strategy = _deserialize_strategy(data)
    calibrator = ConfidenceCalibrator(strategy=strategy)
    calibrator._fitted = True
    calibrator._n_training_samples = data["n_training_samples"]
    calibrator._accuracy = data.get("accuracy")
    calibrator._ece = data.get("ece")
    return calibrator
