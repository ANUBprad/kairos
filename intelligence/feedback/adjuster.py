from __future__ import annotations

from collections import defaultdict
from typing import Dict, List, Optional, Tuple

from intelligence.feedback.models import FeedbackRecord


class FeedbackAdjuster:
    """Adjusts budget decisions based on historical feedback patterns.

    If historical feedback indicates a configuration performs poorly for
    a given query type, the adjuster recommends a better configuration
    from the same historical data.

    Usage::

        adjuster = FeedbackAdjuster()
        adjuster.feed(historical_records)
        adjusted_top_k = adjuster.adjust_top_k("SIMPLE", 3)
    """

    def __init__(self, min_samples: int = 3):
        self._min_samples = min_samples
        self._records: List[FeedbackRecord] = []
        self._config_rates: Dict[str, Dict[str, float]] = {}
        self._best_configs: Dict[str, str] = {}
        self._fitted = False

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    @property
    def fitted(self) -> bool:
        return self._fitted

    @property
    def min_samples(self) -> int:
        return self._min_samples

    def feed(self, records: List[FeedbackRecord]) -> None:
        """Feed historical feedback records into the adjuster."""
        self._records = list(records)
        self._build()
        self._fitted = True

    def adjust_top_k(
        self,
        query_type: str,
        proposed_top_k: int,
    ) -> int:
        """Adjust *proposed_top_k* based on historical feedback.

        Returns the proposed value unchanged when there is insufficient
        data or the proposed config already performs well.
        """
        if not self._fitted:
            return proposed_top_k

        best = self._best_configs.get(query_type)
        if best is None:
            return proposed_top_k

        parts = best.split("_")
        best_top_k = int(parts[0])

        current_acceptance = self._get_acceptance(query_type, proposed_top_k)
        best_acceptance = self._get_acceptance(query_type, best_top_k)

        if best_acceptance > current_acceptance and best_acceptance > 0.5:
            return best_top_k
        return proposed_top_k

    def adjust_config(
        self,
        query_type: str,
        top_k: int,
        rerank: bool,
        decompose: bool,
    ) -> Tuple[int, bool, bool]:
        """Adjust a full config based on historical feedback.

        Returns the proposed config unchanged when there is insufficient
        data or the proposed config already performs well.
        """
        if not self._fitted:
            return top_k, rerank, decompose

        proposed_key = f"{top_k}_{rerank}_{decompose}"
        best_key = self._best_configs.get(query_type)
        if best_key is None or best_key == proposed_key:
            return top_k, rerank, decompose

        current_rate = self._config_rates.get(query_type, {}).get(proposed_key, 0.0)
        best_rate = self._config_rates.get(query_type, {}).get(best_key, 0.0)

        if best_rate > current_rate and best_rate > 0.5:
            parts = best_key.split("_")
            return int(parts[0]), parts[1] == "True", parts[2] == "True"
        return top_k, rerank, decompose

    def get_acceptance_rate(self, query_type: str, top_k: int) -> float:
        """Return the historical acceptance rate for a query type + top_k."""
        return self._get_acceptance(query_type, top_k)

    def get_best_config(self, query_type: str) -> Optional[str]:
        """Return the best-performing config key for a query type."""
        return self._best_configs.get(query_type)

    # ------------------------------------------------------------------
    # Internal
    # ------------------------------------------------------------------

    def _build(self) -> None:
        """Build per-query-type, per-config acceptance rates."""
        by_type: Dict[str, List[FeedbackRecord]] = defaultdict(list)
        for r in self._records:
            by_type[r.query_type].append(r)

        self._config_rates = {}
        self._best_configs = {}

        for qt, group in by_type.items():
            by_cfg: Dict[str, List[bool]] = defaultdict(list)
            for r in group:
                key = f"{r.top_k}_{r.rerank}_{r.decompose}"
                by_cfg[key].append(r.answer_accepted)

            rates: Dict[str, float] = {}
            for cfg, accepts in by_cfg.items():
                if len(accepts) >= self._min_samples:
                    rates[cfg] = sum(accepts) / len(accepts)

            if rates:
                best_cfg = max(rates, key=rates.get)
                self._best_configs[qt] = best_cfg
            self._config_rates[qt] = rates

    def _get_acceptance(self, query_type: str, top_k: int) -> float:
        if query_type not in self._config_rates:
            return 0.0
        matching = [
            rate for cfg, rate in self._config_rates[query_type].items()
            if cfg.startswith(f"{top_k}_")
        ]
        return sum(matching) / len(matching) if matching else 0.0
