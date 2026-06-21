from __future__ import annotations

from dataclasses import dataclass
from typing import Dict, List, Optional


@dataclass(frozen=True)
class AblationConfig:
    """Fine-grained toggle for each adaptive retrieval component.

    Every flag defaults to ``False`` so that the baseline (all off) is the
    simplest configuration.  Toggle flags to ``True`` to enable a component.

    Attributes:
        planner_enabled:      Use the full ``RetrievalPlanner`` (with budget
                              allocator and strategy selector) instead of the
                              static baseline planner.
        calibration_enabled:  Apply confidence calibration before budget
                              allocation.  Implies *planner_enabled*.
        optimization_enabled: Use the learned budget optimizer table.  Implies
                              *planner_enabled*.
        feedback_enabled:     Apply feedback-driven config adjustment.  Implies
                              *planner_enabled*.
        label:                Human-readable label for reports (e.g.
                              ``"Baseline"``, ``"Full Treatment"``).
    """

    planner_enabled: bool = False
    calibration_enabled: bool = False
    optimization_enabled: bool = False
    feedback_enabled: bool = False
    label: str = ""

    def __post_init__(self) -> None:
        object.__setattr__(self, "label", self.label or self._auto_label())

    def _auto_label(self) -> str:
        parts: List[str] = []
        if self.planner_enabled:
            parts.append("P")
        if self.calibration_enabled:
            parts.append("C")
        if self.optimization_enabled:
            parts.append("O")
        if self.feedback_enabled:
            parts.append("F")
        return "+".join(parts) if parts else "None"

    @property
    def enabled_components(self) -> List[str]:
        components: List[str] = []
        if self.planner_enabled:
            components.append("planner")
        if self.calibration_enabled:
            components.append("calibration")
        if self.optimization_enabled:
            components.append("optimization")
        if self.feedback_enabled:
            components.append("feedback")
        return components

    def to_dict(self) -> Dict[str, bool]:
        return {
            "planner_enabled": self.planner_enabled,
            "calibration_enabled": self.calibration_enabled,
            "optimization_enabled": self.optimization_enabled,
            "feedback_enabled": self.feedback_enabled,
        }


# ---------------------------------------------------------------------------
# Pre-built configurations
# ---------------------------------------------------------------------------

BASELINE = AblationConfig(
    planner_enabled=False,
    calibration_enabled=False,
    optimization_enabled=False,
    feedback_enabled=False,
    label="Baseline",
)

FULL_TREATMENT = AblationConfig(
    planner_enabled=True,
    calibration_enabled=True,
    optimization_enabled=True,
    feedback_enabled=True,
    label="Full Treatment",
)

PLANNER_ONLY = AblationConfig(
    planner_enabled=True,
    label="Planner Only",
)

PLANNER_CALIBRATION = AblationConfig(
    planner_enabled=True,
    calibration_enabled=True,
    label="Planner + Calibration",
)

PLANNER_OPTIMIZATION = AblationConfig(
    planner_enabled=True,
    optimization_enabled=True,
    label="Planner + Optimization",
)
