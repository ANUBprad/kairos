"""Experiment runners — baseline and treatment for Kairos benchmark comparisons.

Modules
-------
base       : BaseExperimentRunner (shared execution + persistence)
baseline   : BaselineExperimentRunner (static strategy, no fallback)
treatment  : TreatmentExperimentRunner (confidence-aware adaptive retrieval)
comparison : ComparisonResult, compare()
"""

from benchmarks.experiments.base import BaseExperimentRunner, save_result
from benchmarks.experiments.baseline import BaselineExperimentRunner
from benchmarks.experiments.treatment import TreatmentExperimentRunner
from benchmarks.experiments.comparison import ComparisonResult, compare

__all__ = [
    "BaseExperimentRunner",
    "BaselineExperimentRunner",
    "TreatmentExperimentRunner",
    "ComparisonResult",
    "compare",
    "save_result",
]
