from __future__ import annotations

import json
import os
from collections import defaultdict
from dataclasses import dataclass, field
from typing import Dict, List, Optional, Tuple

from .budget_model import BudgetRecommendation, BudgetScorer, LearnedBudgetTable
from .budget_dataset import BudgetDatasetEntry


@dataclass
class _ConfigStats:
    count: int = 0
    successes: int = 0
    fallbacks: int = 0
    total_latency: float = 0.0

    @property
    def success_rate(self) -> float:
        return self.successes / self.count if self.count else 0.0

    @property
    def fallback_rate(self) -> float:
        return self.fallbacks / self.count if self.count else 0.0

    @property
    def avg_latency(self) -> float:
        return self.total_latency / self.count if self.count else 0.0

    def record(self, success: bool, fallback: bool, latency_ms: float) -> None:
        self.count += 1
        if success:
            self.successes += 1
        if fallback:
            self.fallbacks += 1
        self.total_latency += latency_ms


_CONFIDENCE_BANDS = [(0.0, 0.5, "low"), (0.5, 0.8, "medium"), (0.8, 1.0, "high")]
_TOP_K_CANDIDATES = [3, 5, 8, 10, 12]
_RERANK_CANDIDATES = [False, True]
_DECOMPOSE_CANDIDATES = [False, True]


class BudgetOptimizer:
    def __init__(
        self,
        scorer: Optional[BudgetScorer] = None,
        min_samples_per_config: int = 2,
    ):
        self._scorer = scorer or BudgetScorer()
        self._min_samples = min_samples_per_config
        self._table = LearnedBudgetTable()
        self._stats: Dict[str, Dict[str, _ConfigStats]] = defaultdict(
            lambda: defaultdict(_ConfigStats)
        )
        self._fitted = False

    @property
    def fitted(self) -> bool:
        return self._fitted

    @property
    def table(self) -> LearnedBudgetTable:
        return self._table

    @property
    def scorer(self) -> BudgetScorer:
        return self._scorer

    def _key(self, query_type: str, confidence: float) -> Tuple[str, str]:
        for lo, hi, band in _CONFIDENCE_BANDS:
            if lo <= confidence < hi:
                return query_type, band
        return query_type, "low"

    def _config_key(self, top_k: int, rerank: bool, decompose: bool) -> str:
        return f"{top_k}_{rerank}_{decompose}"

    def fit(
        self,
        entries: List[BudgetDatasetEntry],
        tracker: Optional[object] = None,
    ) -> None:
        for entry in entries:
            group_key, band = self._key(entry.query_type, entry.confidence)
            cfg_key = self._config_key(entry.top_k, entry.rerank, entry.decompose)
            stat_key = f"{group_key}|{band}|{cfg_key}"
            self._stats[stat_key][stat_key].record(
                entry.success, entry.fallback_triggered, entry.latency_ms,
            )

        # Reorganize: group_key|band -> {config_key: stats}
        grouped: Dict[str, Dict[str, _ConfigStats]] = defaultdict(dict)
        for full_key, stats_dict in self._stats.items():
            parts = full_key.split("|")
            if len(parts) == 3:
                qt_band = f"{parts[0]}|{parts[1]}"
                cfg_key = parts[2]
                for sk, st in stats_dict.items():
                    grouped[qt_band][cfg_key] = st

        self._table = LearnedBudgetTable()
        for qt_band, configs in grouped.items():
            qt, band = qt_band.split("|")
            scores: List[Tuple[float, _ConfigStats, int, bool, bool]] = []

            for cfg_key, stats in configs.items():
                if stats.count < self._min_samples:
                    continue
                parts = cfg_key.split("_")
                top_k = int(parts[0])
                rerank = parts[1] == "True"
                decompose = parts[2] == "True"

                s = self._scorer.score(
                    stats.success_rate, stats.avg_latency,
                    stats.fallback_rate, top_k,
                )
                scores.append((s, stats, top_k, rerank, decompose))

            if scores:
                best = max(scores, key=lambda x: x[0])
                score, stats, top_k, rerank, decompose = best
                self._table.set(qt, band, BudgetRecommendation(
                    recommended_top_k=top_k,
                    recommended_rerank=rerank,
                    recommended_decompose=decompose,
                    expected_success=stats.success_rate,
                    expected_latency=stats.avg_latency,
                ))
                self._fitted = len(entries) > 0

        if tracker is not None:
            learned_score_sum = 0.0
            learned_score_count = 0
            for g in grouped.values():
                for ck, s in g.items():
                    if s.count >= self._min_samples:
                        parts = ck.split("_")
                        top_k_val = int(parts[0]) if len(parts) >= 1 else 3
                        learned_score_sum += self._scorer.score(
                            s.success_rate, s.avg_latency,
                            s.fallback_rate, top_k_val,
                        )
                        learned_score_count += 1
            avg_score = learned_score_sum / max(learned_score_count, 1)
            tracker.log_metrics({
                "training_samples": float(len(entries)),
                "learned_avg_score": avg_score,
            })
            tracker.log_parameter("optimizer_min_samples",
                                  str(self._min_samples))

    def recommend_budget(
        self,
        query_type: str,
        confidence: float,
    ) -> BudgetRecommendation:
        _, band = self._key(query_type, confidence)
        rec = self._table.get(query_type, band)
        if rec is not None:
            return rec

        from intelligence.planner.planner_config import CONFIDENCE_HIGH, CONFIDENCE_MEDIUM, BUDGET_TABLE, QueryType, ConfidenceBand

        if confidence >= CONFIDENCE_HIGH:
            cb = ConfidenceBand.HIGH
        elif confidence >= CONFIDENCE_MEDIUM:
            cb = ConfidenceBand.MEDIUM
        else:
            cb = ConfidenceBand.LOW

        try:
            budget = BUDGET_TABLE[QueryType(query_type)][cb]
        except (KeyError, ValueError):
            budget = BUDGET_TABLE[QueryType.SIMPLE][cb]
        return BudgetRecommendation(
            recommended_top_k=budget.top_k,
            recommended_rerank=budget.rerank,
            recommended_decompose=budget.decompose,
            expected_success=0.0,
            expected_latency=0.0,
            source="static_fallback",
        )

    def evaluate(
        self,
        entries: List[BudgetDatasetEntry],
    ) -> Dict[str, float]:
        if not self._fitted:
            return {"error": "optimizer not fitted"}

        from intelligence.planner.planner_config import BUDGET_TABLE, CONFIDENCE_HIGH, CONFIDENCE_MEDIUM, QueryType, ConfidenceBand

        static_scores: List[float] = []
        learned_scores: List[float] = []
        static_successes = 0
        learned_successes = 0
        static_latencies: List[float] = []
        learned_latencies: List[float] = []
        static_fallbacks = 0
        learned_fallbacks = 0

        processed: set[str] = set()
        for entry in entries:
            dedup_key = f"{entry.query_type}|{entry.top_k}|{entry.rerank}|{entry.decompose}|{entry.confidence}"
            if dedup_key in processed:
                continue
            processed.add(dedup_key)

            rec = self.recommend_budget(entry.query_type, entry.confidence)
            score = self._scorer.score(
                entry.success, entry.latency_ms,
                entry.fallback_triggered, entry.top_k,
            )
            learned_scores.append(score)
            if entry.success:
                learned_successes += 1
            learned_latencies.append(entry.latency_ms)
            if entry.fallback_triggered:
                learned_fallbacks += 1

            if entry.confidence >= CONFIDENCE_HIGH:
                cb = ConfidenceBand.HIGH
            elif entry.confidence >= CONFIDENCE_MEDIUM:
                cb = ConfidenceBand.MEDIUM
            else:
                cb = ConfidenceBand.LOW
            static_budget = BUDGET_TABLE[QueryType(entry.query_type)][cb]
            static_score = self._scorer.score(
                entry.success, entry.latency_ms,
                entry.fallback_triggered, static_budget.top_k,
            )
            static_scores.append(static_score)
            if entry.success:
                static_successes += 1
            static_latencies.append(entry.latency_ms)
            if entry.fallback_triggered:
                static_fallbacks += 1

        n = len(processed)
        return {
            "n_comparisons": n,
            "static_avg_score": sum(static_scores) / n if n else 0.0,
            "learned_avg_score": sum(learned_scores) / n if n else 0.0,
            "score_lift": (sum(learned_scores) - sum(static_scores)) / n if n else 0.0,
            "static_success_rate": static_successes / n if n else 0.0,
            "learned_success_rate": learned_successes / n if n else 0.0,
            "static_avg_latency": sum(static_latencies) / n if n else 0.0,
            "learned_avg_latency": sum(learned_latencies) / n if n else 0.0,
            "static_fallback_rate": static_fallbacks / n if n else 0.0,
            "learned_fallback_rate": learned_fallbacks / n if n else 0.0,
        }

    def get_stats(self) -> dict:
        return {
            "fitted": self._fitted,
            "num_recommendations": sum(
                len(bands) for bands in self._table.mapping.values()
            ),
            "table": self._table.to_dict(),
        }
