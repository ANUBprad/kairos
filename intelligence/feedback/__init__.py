"""Feedback subsystem — collect, store, validate, and analyse user feedback on retrieval outcomes."""

from .adjuster import FeedbackAdjuster
from .analytics import (
    compute_acceptance_rate,
    compute_avg_rating,
    compute_budget_improvement_score,
    compute_config_win_rate,
    compute_feedback_accuracy,
    compute_learning_gain,
    compute_strategy_win_rate,
    generate_feedback_report,
)
from .collector import FeedbackCollector
from .models import FeedbackRecord
from .storage import FeedbackStorage
from .validator import FeedbackValidator

__all__ = [
    "FeedbackRecord",
    "FeedbackCollector",
    "FeedbackStorage",
    "FeedbackValidator",
    "FeedbackAdjuster",
    "compute_acceptance_rate",
    "compute_avg_rating",
    "compute_feedback_accuracy",
    "compute_config_win_rate",
    "compute_strategy_win_rate",
    "compute_budget_improvement_score",
    "compute_learning_gain",
    "generate_feedback_report",
]
