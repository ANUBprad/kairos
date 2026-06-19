"""Treatment experiment — Kairos confidence-aware adaptive retrieval.

The :class:`TreatmentExperimentRunner` represents the full Kairos adaptive
retrieval pipeline.  It uses the real :class:`RetrievalPlanner` which:

* Applies confidence-aware budget overrides via :class:`BudgetAllocator`.
* Works with the default :class:`BenchmarkRunner` whose ``run_query``
  internally evaluates fallback via :class:`FallbackManager`.

This is the **treatment** side of the baseline *vs* treatment comparison.
"""

from __future__ import annotations

from benchmarks.experiments.base import BaseExperimentRunner
from benchmarks.runner import BenchmarkRunner


class TreatmentExperimentRunner(BaseExperimentRunner):
    """Experiment runner that uses the full Kairos adaptive pipeline.

    Parameters
    ----------
    classifier:
        Object with ``classify_with_confidence(query)``.
    retriever:
        Object conforming to the :class:`Retriever` protocol.
    dataset_path:
        Optional path to ``queries.json``.
    validate:
        Whether to validate the dataset on load (default ``True``).
    """

    def _create_runner(self) -> BenchmarkRunner:
        return BenchmarkRunner(
            classifier=self._classifier,
            retriever=self._retriever,  # type: ignore[arg-type]
        )
