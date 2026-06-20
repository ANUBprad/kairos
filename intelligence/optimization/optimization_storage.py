from __future__ import annotations

import json
import os
from typing import Dict

from .budget_model import BudgetRecommendation, BudgetScorer, LearnedBudgetTable
from .budget_optimizer import BudgetOptimizer


def save_optimizer(optimizer: BudgetOptimizer, path: str) -> None:
    if not optimizer.fitted:
        raise ValueError("Cannot save unfitted optimizer")

    data = {
        "fitted": optimizer.fitted,
        "scorer": {
            "success_weight": optimizer.scorer.success_weight,
            "latency_weight": optimizer.scorer.latency_weight,
            "fallback_weight": optimizer.scorer.fallback_weight,
            "top_k_penalty_weight": optimizer.scorer.top_k_penalty_weight,
            "top_k_reference": optimizer.scorer.top_k_reference,
        },
        "min_samples_per_config": optimizer._min_samples,
        "table": optimizer.table.to_dict(),
    }

    with open(path, "w") as f:
        json.dump(data, f, indent=2)


def load_optimizer(path: str) -> BudgetOptimizer:
    if not os.path.exists(path):
        raise FileNotFoundError(f"Optimizer file not found: {path}")

    with open(path) as f:
        data = json.load(f)

    scorer = BudgetScorer(
        success_weight=data["scorer"]["success_weight"],
        latency_weight=data["scorer"]["latency_weight"],
        fallback_weight=data["scorer"]["fallback_weight"],
        top_k_penalty_weight=data["scorer"]["top_k_penalty_weight"],
        top_k_reference=data["scorer"].get("top_k_reference", 5),
    )

    optimizer = BudgetOptimizer(
        scorer=scorer,
        min_samples_per_config=data.get("min_samples_per_config", 2),
    )

    table_data = data.get("table", {})
    for qt, bands in table_data.items():
        for cb, rec_data in bands.items():
            rec = BudgetRecommendation(
                recommended_top_k=rec_data["recommended_top_k"],
                recommended_rerank=rec_data["recommended_rerank"],
                recommended_decompose=rec_data["recommended_decompose"],
                expected_success=rec_data["expected_success"],
                expected_latency=rec_data["expected_latency"],
            )
            optimizer.table.set(qt, cb, rec)

    optimizer._fitted = True
    return optimizer
