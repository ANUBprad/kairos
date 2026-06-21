from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from typing import Dict, List, Optional
from uuid import uuid4


class ExperimentStatus(Enum):
    RUNNING = "RUNNING"
    COMPLETED = "COMPLETED"
    FAILED = "FAILED"
    ABORTED = "ABORTED"


@dataclass(frozen=True)
class ExperimentMetrics:
    precision: Optional[float] = None
    recall: Optional[float] = None
    latency_ms: Optional[float] = None
    success_rate: Optional[float] = None
    fallback_rate: Optional[float] = None
    avg_recall: Optional[float] = None
    avg_precision: Optional[float] = None
    ece: Optional[float] = None
    mce: Optional[float] = None
    brier_score: Optional[float] = None
    score_lift: Optional[float] = None
    learned_avg_score: Optional[float] = None
    static_avg_score: Optional[float] = None
    training_samples: Optional[int] = None
    extra: Dict[str, float] = field(default_factory=dict)

    def to_dict(self) -> Dict[str, object]:
        result: Dict[str, object] = {}
        for key, val in {
            "precision": self.precision,
            "recall": self.recall,
            "latency_ms": self.latency_ms,
            "success_rate": self.success_rate,
            "fallback_rate": self.fallback_rate,
            "avg_recall": self.avg_recall,
            "avg_precision": self.avg_precision,
            "ece": self.ece,
            "mce": self.mce,
            "brier_score": self.brier_score,
            "score_lift": self.score_lift,
            "learned_avg_score": self.learned_avg_score,
            "static_avg_score": self.static_avg_score,
            "training_samples": self.training_samples,
        }.items():
            if val is not None:
                result[key] = val
        result.update(self.extra)
        return result

    @staticmethod
    def from_dict(d: Dict[str, object]) -> ExperimentMetrics:
        known = {
            "precision", "recall", "latency_ms", "success_rate",
            "fallback_rate", "avg_recall", "avg_precision", "ece",
            "mce", "brier_score", "score_lift", "learned_avg_score",
            "static_avg_score", "training_samples",
        }
        kwargs: Dict[str, object] = {}
        extra: Dict[str, float] = {}
        for k, v in d.items():
            if k in known:
                kwargs[k] = v
            else:
                extra[k] = float(v) if v is not None else 0.0
        return ExperimentMetrics(**kwargs, extra=extra)  # type: ignore[arg-type]


@dataclass(frozen=True)
class ExperimentParameters:
    planner_enabled: bool = False
    calibration_enabled: bool = False
    feedback_enabled: bool = False
    optimization_enabled: bool = False
    dataset_name: str = ""
    dataset_version: str = ""
    query_types: str = ""
    classifier_name: str = ""
    retriever_name: str = ""
    failure_threshold: int = 5
    recovery_timeout: float = 30.0
    calibrator_type: str = ""
    optimizer_min_samples: int = 2
    provider_timeout_seconds: float = 30.0
    extra: Dict[str, str] = field(default_factory=dict)

    def to_dict(self) -> Dict[str, object]:
        result: Dict[str, object] = {
            "planner_enabled": self.planner_enabled,
            "calibration_enabled": self.calibration_enabled,
            "feedback_enabled": self.feedback_enabled,
            "optimization_enabled": self.optimization_enabled,
            "dataset_name": self.dataset_name,
            "dataset_version": self.dataset_version,
            "query_types": self.query_types,
            "classifier_name": self.classifier_name,
            "retriever_name": self.retriever_name,
            "failure_threshold": self.failure_threshold,
            "recovery_timeout": self.recovery_timeout,
            "calibrator_type": self.calibrator_type,
            "optimizer_min_samples": self.optimizer_min_samples,
            "provider_timeout_seconds": self.provider_timeout_seconds,
        }
        result.update(self.extra)
        return result

    @staticmethod
    def from_dict(d: Dict[str, object]) -> ExperimentParameters:
        known = {
            "planner_enabled", "calibration_enabled", "feedback_enabled",
            "optimization_enabled", "dataset_name", "dataset_version",
            "query_types", "classifier_name", "retriever_name",
            "failure_threshold", "recovery_timeout", "calibrator_type",
            "optimizer_min_samples", "provider_timeout_seconds",
        }
        kwargs: Dict[str, object] = {}
        extra: Dict[str, str] = {}
        for k, v in d.items():
            if k in known:
                kwargs[k] = v
            else:
                extra[k] = str(v) if v is not None else ""
        return ExperimentParameters(**kwargs, extra=extra)  # type: ignore[arg-type]


@dataclass
class ExperimentRun:
    run_id: str = ""
    name: str = ""
    description: str = ""
    phase: str = ""
    timestamp: str = ""
    status: ExperimentStatus = ExperimentStatus.RUNNING
    tags: Dict[str, str] = field(default_factory=dict)
    metrics: ExperimentMetrics = field(default_factory=ExperimentMetrics)
    parameters: ExperimentParameters = field(default_factory=ExperimentParameters)
    artifact_paths: List[str] = field(default_factory=list)

    def __post_init__(self) -> None:
        if not self.run_id:
            self.run_id = uuid4().hex[:12]
        if not self.timestamp:
            self.timestamp = datetime.now().isoformat()

    def to_dict(self) -> Dict[str, object]:
        return {
            "run_id": self.run_id,
            "name": self.name,
            "description": self.description,
            "phase": self.phase,
            "timestamp": self.timestamp,
            "status": self.status.value,
            "tags": dict(self.tags),
            "metrics": self.metrics.to_dict(),
            "parameters": self.parameters.to_dict(),
            "artifact_paths": list(self.artifact_paths),
        }

    @staticmethod
    def from_dict(d: Dict[str, object]) -> ExperimentRun:
        run = ExperimentRun(
            run_id=str(d.get("run_id", "")),
            name=str(d.get("name", "")),
            description=str(d.get("description", "")),
            phase=str(d.get("phase", "")),
            timestamp=str(d.get("timestamp", "")),
            status=ExperimentStatus(str(d.get("status", "RUNNING"))),
            tags={k: str(v) for k, v in d.get("tags", {}).items()},
            metrics=ExperimentMetrics.from_dict(
                d.get("metrics", {})  # type: ignore[arg-type]
            ),
            parameters=ExperimentParameters.from_dict(
                d.get("parameters", {})  # type: ignore[arg-type]
            ),
            artifact_paths=[
                str(p) for p in d.get("artifact_paths", [])
            ],
        )
        return run
