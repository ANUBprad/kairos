from __future__ import annotations

import json
import os
from collections import defaultdict
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

from .model_registry import ModelRegistry, RegistryEntry, compute_dataset_hash


class BudgetRetrainer:
    """Retrains the budget optimizer from feedback-driven training data.

    The retrainer:
    1. Converts training records into ``BudgetDatasetEntry`` objects
    2. Fits a new ``BudgetOptimizer``
    3. Evaluates against the static budget table
    4. Saves the model with version metadata
    5. Registers it in the model registry

    Usage::

        retrainer = BudgetRetrainer()
        result = retrainer.train(training_records, version="v2")
        print(result["evaluation"])
    """

    def __init__(
        self,
        model_dir: str = "models",
        registry: Optional[ModelRegistry] = None,
    ):
        self._model_dir = Path(model_dir)
        self._model_dir.mkdir(parents=True, exist_ok=True)
        self._registry = registry or ModelRegistry()

    def train(
        self,
        records: List[Dict[str, Any]],
        version: Optional[str] = None,
        min_samples_per_config: int = 2,
        tracker: Optional[object] = None,
    ) -> Dict[str, Any]:
        """Train a new budget optimizer from training records.

        Args:
            records:              List of training record dicts.
            version:              Version string (auto-incremented if ``None``).
            min_samples_per_config: Minimum samples per config to consider.
            tracker:              Optional experiment tracker to log results.

        Returns:
            Dict with ``version``, ``path``, ``evaluation``, ``timestamp``,
            ``training_samples``, ``dataset_hash``.
        """
        from intelligence.optimization.budget_dataset import BudgetDatasetEntry
        from intelligence.optimization.budget_optimizer import BudgetOptimizer
        from intelligence.optimization.optimization_storage import save_optimizer

        # Convert records to BudgetDatasetEntry
        entries = self._records_to_entries(records)

        # Fit optimizer
        opt = BudgetOptimizer(min_samples_per_config=min_samples_per_config)
        opt.fit(entries, tracker=tracker)

        # Evaluate
        eval_results = opt.evaluate(entries)

        # Version
        if version is None:
            latest = self._registry.latest_version()
            next_num = 1
            if latest and latest.startswith("v"):
                try:
                    next_num = int(latest[1:]) + 1
                except ValueError:
                    pass
            version = f"v{next_num}"

        # Save model
        model_path = str(self._model_dir / f"budget_optimizer_{version}.json")
        save_optimizer(opt, model_path)

        # Compute dataset hash
        dh = compute_dataset_hash(records)

        # Register
        entry = RegistryEntry(
            version=version,
            timestamp=datetime.now().isoformat(),
            training_samples=len(records),
            dataset_hash=dh,
            evaluation_metrics={
                "static_avg_score": eval_results.get("static_avg_score", 0.0),
                "learned_avg_score": eval_results.get("learned_avg_score", 0.0),
                "score_lift": eval_results.get("score_lift", 0.0),
                "static_success_rate": eval_results.get("static_success_rate", 0.0),
                "learned_success_rate": eval_results.get("learned_success_rate", 0.0),
                "static_avg_latency": eval_results.get("static_avg_latency", 0.0),
                "learned_avg_latency": eval_results.get("learned_avg_latency", 0.0),
                "static_fallback_rate": eval_results.get("static_fallback_rate", 0.0),
                "learned_fallback_rate": eval_results.get("learned_fallback_rate", 0.0),
            },
            path=model_path,
        )
        self._registry.register(entry)

        if tracker is not None:
            tracker.log_metrics({
                "score_lift": eval_results.get("score_lift", 0.0),
                "learned_avg_score": eval_results.get("learned_avg_score", 0.0),
                "static_avg_score": eval_results.get("static_avg_score", 0.0),
                "training_samples": float(len(records)),
            })
            tracker.log_artifact(model_path)

        return {
            "version": version,
            "path": model_path,
            "evaluation": eval_results,
            "timestamp": entry.timestamp,
            "training_samples": len(records),
            "dataset_hash": dh,
        }

    def evaluate(
        self,
        records: List[Dict[str, Any]],
        optimizer_path: str,
    ) -> Dict[str, float]:
        """Evaluate a saved optimizer against training records."""
        from intelligence.optimization.budget_dataset import BudgetDatasetEntry
        from intelligence.optimization.budget_optimizer import BudgetOptimizer
        from intelligence.optimization.optimization_storage import load_optimizer

        opt = load_optimizer(optimizer_path)
        entries = self._records_to_entries(records)
        return opt.evaluate(entries)

    def compare_models(
        self,
        version_a: str,
        version_b: str,
    ) -> Dict[str, Any]:
        """Compare two registered model versions."""
        entry_a = self._registry.get(version_a)
        entry_b = self._registry.get(version_b)
        if not entry_a or not entry_b:
            raise ValueError(f"Model version not found: {version_a} or {version_b}")

        metrics_a = entry_a.evaluation_metrics
        metrics_b = entry_b.evaluation_metrics

        comparison: Dict[str, Any] = {
            "version_a": version_a,
            "version_b": version_b,
            "timestamp_a": entry_a.timestamp,
            "timestamp_b": entry_b.timestamp,
            "samples_a": entry_a.training_samples,
            "samples_b": entry_b.training_samples,
        }

        for key in metrics_a:
            if key in metrics_b:
                comparison[f"{key}_a"] = metrics_a[key]
                comparison[f"{key}_b"] = metrics_b[key]
                comparison[f"{key}_delta"] = metrics_b[key] - metrics_a[key]

        return comparison

    def generate_training_report(
        self,
        result: Dict[str, Any],
        records: List[Dict[str, Any]],
    ) -> str:
        """Generate a retraining report markdown string."""
        lines = [
            "# Retraining Report",
            "",
            f"**Version:** {result['version']}",
            f"**Timestamp:** {result['timestamp']}",
            f"**Training Samples:** {result['training_samples']}",
            f"**Dataset Hash:** {result['dataset_hash']}",
            f"**Model Path:** {result['path']}",
            "",
            "## Evaluation Results",
            "",
            "| Metric | Static | Learned | Delta |",
            "| ------ | ------ | ------- | ----- |",
        ]

        eval_results = result["evaluation"]
        for key in ["avg_score", "success_rate", "avg_latency", "fallback_rate"]:
            static_key = f"static_{key}"
            learned_key = f"learned_{key}"
            lift_key = f"score_lift" if key == "avg_score" else None
            s = eval_results.get(static_key, 0.0)
            l = eval_results.get(learned_key, 0.0)
            if key == "avg_latency":
                delta = l - s
                lines.append(f"| {key.replace('_', ' ').title():<20} | {s:.1f} | {l:.1f} | {delta:+.1f} |")
            else:
                delta = l - s
                lines.append(f"| {key.replace('_', ' ').title():<20} | {s:.2%} | {l:.2%} | {delta:+.2%} |")

        lines.extend([
            "",
            "## Per-Config Summary",
            "",
            "| Config | Count | Accepted | Rate |",
            "| ------ | ----- | -------- | ---- |",
        ])

        configs: Dict[str, List[bool]] = defaultdict(list)
        for r in records:
            key = f"{r.get('top_k', '?')}_{r.get('rerank', '?')}_{r.get('decompose', '?')}"
            configs[key].append(r.get("accepted", False))

        for cfg, accepts in sorted(configs.items()):
            rate = sum(accepts) / len(accepts) if accepts else 0.0
            lines.append(f"| {cfg:<25} | {len(accepts):<5} | {sum(accepts):<8} | {rate:.2%} |")

        lines.extend([
            "",
            "---",
            "*Report generated by retraining pipeline*",
            "",
        ])
        return "\n".join(lines)

    # ------------------------------------------------------------------
    # Internal
    # ------------------------------------------------------------------

    @staticmethod
    def _records_to_entries(records: List[Dict[str, Any]]) -> List:
        from intelligence.optimization.budget_dataset import BudgetDatasetEntry

        entries: List[Any] = []
        for r in records:
            entries.append(BudgetDatasetEntry(
                query_type=r.get("query_type", "UNKNOWN"),
                confidence=r.get("confidence", 0.5),
                retrieval_type=r.get("retrieval_type", "UNKNOWN"),
                top_k=r.get("top_k", 3),
                rerank=r.get("rerank", False),
                decompose=r.get("decompose", False),
                latency_ms=r.get("latency_ms", 0.0),
                fallback_triggered=r.get("fallback_triggered", False),
                success=r.get("accepted", True) and not r.get("fallback_triggered", False),
            ))
        return entries
