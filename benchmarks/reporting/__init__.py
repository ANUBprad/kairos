"""Reporting — generate charts and markdown summaries from experiment results.

Modules
-------
charts          : Bar-chart comparisons (recall, precision, latency, failure rates)
report_generator: Markdown report (experiment_summary.md)
"""

from benchmarks.reporting.charts import (
    generate_all_charts,
)
from benchmarks.reporting.report_generator import (
    generate_report,
)

__all__ = [
    "generate_all_charts",
    "generate_report",
]
