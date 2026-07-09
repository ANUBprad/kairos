from __future__ import annotations

import logging
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any, Callable, Dict, List, Optional

from intelligence.observability.performance_monitor import LatencySnapshot

logger = logging.getLogger(__name__)


class AlertSeverity:
    INFO = "info"
    WARNING = "warning"
    CRITICAL = "critical"


@dataclass
class Alert:
    rule_name: str
    message: str
    severity: str = AlertSeverity.WARNING
    timestamp: str = ""
    metric_value: Optional[float] = None
    threshold: Optional[float] = None
    attributes: Dict[str, Any] = field(default_factory=dict)

    def __post_init__(self) -> None:
        if not self.timestamp:
            self.timestamp = datetime.now(timezone.utc).isoformat()

    def to_dict(self) -> Dict[str, Any]:
        return {
            "rule_name": self.rule_name,
            "message": self.message,
            "severity": self.severity,
            "timestamp": self.timestamp,
            "metric_value": self.metric_value,
            "threshold": self.threshold,
            "attributes": self.attributes,
        }


class AlertRule:
    def __init__(
        self,
        name: str,
        description: str,
        severity: str = AlertSeverity.WARNING,
        cooldown_seconds: float = 300.0,
    ):
        self.name = name
        self.description = description
        self.severity = severity
        self.cooldown_seconds = cooldown_seconds
        self._last_fired: float = 0.0

    def evaluate(self, **kwargs: Any) -> Optional[Alert]:
        raise NotImplementedError

    def _should_fire(self) -> bool:
        now = datetime.now(timezone.utc).timestamp()
        if now - self._last_fired < self.cooldown_seconds:
            return False
        self._last_fired = now
        return True


class LatencyAlertRule(AlertRule):
    def __init__(
        self,
        name: str = "high_latency",
        percentile: str = "p95",
        threshold_ms: float = 2000.0,
        severity: str = AlertSeverity.WARNING,
        cooldown_seconds: float = 60.0,
    ):
        super().__init__(
            name,
            f"Latency {percentile} exceeds {threshold_ms}ms",
            severity,
            cooldown_seconds,
        )
        self.percentile = percentile
        self.threshold_ms = threshold_ms

    def evaluate(
        self, latency_snapshot: "LatencySnapshot", **kwargs: Any
    ) -> Optional[Alert]:
        val = getattr(latency_snapshot, self.percentile, None)
        if val is not None and val > self.threshold_ms and self._should_fire():
            return Alert(
                rule_name=self.name,
                message=self.description,
                severity=self.severity,
                metric_value=val,
                threshold=self.threshold_ms,
                attributes={"percentile": self.percentile},
            )
        return None


class FailureRateAlertRule(AlertRule):
    def __init__(
        self,
        name: str = "high_failure_rate",
        threshold: float = 0.1,
        severity: str = AlertSeverity.CRITICAL,
        cooldown_seconds: float = 120.0,
    ):
        super().__init__(
            name, f"Failure rate exceeds {threshold:.0%}", severity, cooldown_seconds
        )
        self.threshold = threshold

    def evaluate(self, failure_rate: float, **kwargs: Any) -> Optional[Alert]:
        if failure_rate > self.threshold and self._should_fire():
            return Alert(
                rule_name=self.name,
                message=self.description,
                severity=self.severity,
                metric_value=failure_rate,
                threshold=self.threshold,
            )
        return None


class DegradedRecallAlertRule(AlertRule):
    def __init__(
        self,
        name: str = "degraded_recall",
        threshold: float = 0.5,
        severity: str = AlertSeverity.WARNING,
        cooldown_seconds: float = 300.0,
    ):
        super().__init__(
            name, f"Recall dropped below {threshold:.0%}", severity, cooldown_seconds
        )
        self.threshold = threshold

    def evaluate(self, recall: float, **kwargs: Any) -> Optional[Alert]:
        if recall < self.threshold and self._should_fire():
            return Alert(
                rule_name=self.name,
                message=self.description,
                severity=self.severity,
                metric_value=recall,
                threshold=self.threshold,
            )
        return None


class AlertManager:
    _instance: AlertManager | None = None

    @staticmethod
    def get_instance() -> AlertManager:
        if AlertManager._instance is None:
            AlertManager._instance = AlertManager()
        return AlertManager._instance

    def __init__(self) -> None:
        self._rules: List[AlertRule] = []
        self._handlers: List[Callable[[Alert], None]] = []
        self._alerts: List[Alert] = []

    def add_rule(self, rule: AlertRule) -> None:
        self._rules.append(rule)

    def add_handler(self, handler: Callable[[Alert], None]) -> None:
        self._handlers.append(handler)

    def check_all(self, **context: Any) -> List[Alert]:
        fired: List[Alert] = []
        for rule in self._rules:
            try:
                alert = rule.evaluate(**context)
                if alert is not None:
                    self._alerts.append(alert)
                    fired.append(alert)
                    for h in self._handlers:
                        try:
                            h(alert)
                        except Exception as exc:
                            logger.warning(
                                "Alert handler failed",
                                extra={"handler": h.__name__, "error": str(exc)},
                            )
            except Exception as exc:
                logger.warning("Alert evaluation failed", extra={"error": str(exc)})
        return fired

    @property
    def alerts(self) -> List[Alert]:
        return list(self._alerts)

    def clear(self) -> None:
        self._alerts.clear()


_default_manager = AlertManager()


def get_alert_manager() -> AlertManager:
    return _default_manager
