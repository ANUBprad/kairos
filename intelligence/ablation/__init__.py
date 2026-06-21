"""Ablation framework — fine-grained component toggling for reproducible experiments."""

from .comparison import (
    AblationComparison,
    compare_multiple,
    compare_runs,
    generate_ablation_matrix,
    generate_ablation_report,
)
from .config import (
    BASELINE,
    FULL_TREATMENT,
    PLANNER_CALIBRATION,
    PLANNER_ONLY,
    PLANNER_OPTIMIZATION,
    AblationConfig,
)
from .runner import AblationRunner

__all__ = [
    "AblationConfig",
    "AblationRunner",
    "AblationComparison",
    "compare_runs",
    "compare_multiple",
    "generate_ablation_report",
    "generate_ablation_matrix",
    "BASELINE",
    "FULL_TREATMENT",
    "PLANNER_ONLY",
    "PLANNER_CALIBRATION",
    "PLANNER_OPTIMIZATION",
]
