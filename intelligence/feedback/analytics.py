from __future__ import annotations

from collections import defaultdict
from typing import Dict, List, Optional

from intelligence.feedback.models import FeedbackRecord


# ---------------------------------------------------------------------------
# Core Metrics
# ---------------------------------------------------------------------------


def compute_acceptance_rate(records: List[FeedbackRecord]) -> float:
    """Fraction of records where the answer was accepted."""
    if not records:
        return 0.0
    return sum(1 for r in records if r.answer_accepted) / len(records)


def compute_avg_rating(records: List[FeedbackRecord]) -> float:
    """Average rating across records that have a rating."""
    rated = [r for r in records if r.answer_rating is not None]
    if not rated:
        return 0.0
    return sum(r.answer_rating for r in rated) / len(rated)


def compute_feedback_accuracy(
    records: List[FeedbackRecord],
) -> Dict[str, float]:
    """Per-query-type acceptance and rating metrics."""
    grouped: Dict[str, List[FeedbackRecord]] = defaultdict(list)
    for r in records:
        grouped[r.query_type].append(r)

    result: Dict[str, float] = {}
    for qt, group in sorted(grouped.items()):
        result[f"{qt}_acceptance_rate"] = compute_acceptance_rate(group)
        result[f"{qt}_avg_rating"] = compute_avg_rating(group)
        result[f"{qt}_count"] = len(group)
    return result


# ---------------------------------------------------------------------------
# Configuration & Strategy Win Rates
# ---------------------------------------------------------------------------


def _config_key(r: FeedbackRecord) -> str:
    return f"{r.top_k}_{r.rerank}_{r.decompose}"


def compute_config_win_rate(
    records: List[FeedbackRecord],
) -> Dict[str, float]:
    """For each distinct config (``top_k_rerank_decompose``), the fraction
    of accepted answers."""
    groups: Dict[str, List[FeedbackRecord]] = defaultdict(list)
    for r in records:
        groups[_config_key(r)].append(r)
    return {
        cfg: compute_acceptance_rate(group) for cfg, group in sorted(groups.items())
    }


def compute_strategy_win_rate(
    records: List[FeedbackRecord],
) -> Dict[str, float]:
    """For each retrieval strategy, the fraction of accepted answers."""
    groups: Dict[str, List[FeedbackRecord]] = defaultdict(list)
    for r in records:
        groups[r.retrieval_type].append(r)
    return {
        strat: compute_acceptance_rate(group) for strat, group in sorted(groups.items())
    }


# ---------------------------------------------------------------------------
# Budget Improvement & Learning Gain
# ---------------------------------------------------------------------------


def compute_budget_improvement_score(
    records: List[FeedbackRecord],
) -> float:
    """Measure of budget improvement — higher is better.

    Rewards configs where higher top_k correlates with higher acceptance,
    penalises unnecessary top_k inflation.
    """
    if not records:
        return 0.0
    top_k_groups: Dict[int, List[bool]] = defaultdict(list)
    for r in records:
        top_k_groups[r.top_k].append(r.answer_accepted)

    score = 0.0
    for top_k, acceptances in top_k_groups.items():
        rate = sum(acceptances) / len(acceptances)
        penalty = max(0, top_k - 5) * 0.02
        score += rate - penalty
    return score / len(top_k_groups) if top_k_groups else 0.0


def compute_learning_gain(
    old_records: List[FeedbackRecord],
    new_records: List[FeedbackRecord],
) -> float:
    """Improvement in acceptance rate between two time periods."""
    old_rate = compute_acceptance_rate(old_records)
    new_rate = compute_acceptance_rate(new_records)
    return new_rate - old_rate


# ---------------------------------------------------------------------------
# Report Generation
# ---------------------------------------------------------------------------


def generate_feedback_report(
    records: List[FeedbackRecord],
    old_records: Optional[List[FeedbackRecord]] = None,
) -> str:
    """Generate a markdown feedback analytics report."""
    from datetime import datetime

    lines = [
        "# Feedback Analytics Report",
        "",
        f"**Generated:** {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}",
        f"**Total Records:** {len(records)}",
        "",
    ]

    # --- 1. Core Metrics ---
    accept_rate = compute_acceptance_rate(records)
    avg_rating = compute_avg_rating(records)
    success_rate = (
        sum(1 for r in records if r.retrieval_success) / len(records)
        if records
        else 0.0
    )
    fallback_rate = (
        sum(1 for r in records if r.fallback_triggered) / len(records)
        if records
        else 0.0
    )

    lines.extend(
        [
            "## 1. Core Metrics",
            "",
            "| Metric | Value |",
            "| ------ | ----- |",
            f"| Acceptance Rate | {accept_rate:.2%} |",
            f"| Average Rating | {avg_rating:.2f} / 5.0 |",
            f"| Success Rate | {success_rate:.2%} |",
            f"| Fallback Rate | {fallback_rate:.2%} |",
            "",
        ]
    )

    # --- 2. Per-Query-Type ---
    lines.append("## 2. Per-Query-Type Metrics")
    lines.append("")
    lines.append("| Query Type | Count | Acceptance Rate | Avg Rating |")
    lines.append("| ---------- | ----- | --------------- | ---------- |")
    for qt in ["SIMPLE", "COMPLEX", "MULTI_HOP"]:
        subset = [r for r in records if r.query_type == qt]
        if subset:
            ar = compute_acceptance_rate(subset)
            rt = compute_avg_rating(subset)
            lines.append(f"| {qt:<10} | {len(subset):<5} | {ar:.2%} | {rt:.2f} |")
    lines.append("")

    # --- 3. Budget Performance ---
    lines.append("## 3. Budget Performance")
    lines.append("")
    lines.append("| Config (top_k/rerank/decompose) | Count | Acceptance Rate |")
    lines.append("| ------------------------------- | ----- | --------------- |")
    for cfg, rate in sorted(compute_config_win_rate(records).items()):
        count = sum(1 for r in records if _config_key(r) == cfg)
        lines.append(f"| {cfg:<31} | {count:<5} | {rate:.2%} |")
    lines.append("")

    # --- 4. Strategy Performance ---
    lines.append("## 4. Strategy Performance")
    lines.append("")
    lines.append("| Strategy | Count | Acceptance Rate |")
    lines.append("| -------- | ----- | --------------- |")
    for strat, rate in sorted(compute_strategy_win_rate(records).items()):
        count = sum(1 for r in records if r.retrieval_type == strat)
        lines.append(f"| {strat:<24} | {count:<5} | {rate:.2%} |")
    lines.append("")

    # --- 5. Budget Improvement Score ---
    bis = compute_budget_improvement_score(records)
    lines.extend(
        [
            "## 5. Budget Improvement Score",
            "",
            f"**Score:** {bis:.4f}",
            "",
            "Higher values indicate better budget-performance alignment.",
            "",
        ]
    )

    # --- 6. Learning Gain ---
    if old_records:
        gain = compute_learning_gain(old_records, records)
        old_accept = compute_acceptance_rate(old_records)
        lines.extend(
            [
                "## 6. Learning Gain",
                "",
                "| Period | Acceptance Rate |",
                "| ------ | --------------- |",
                f"| Old | {old_accept:.2%} |",
                f"| Current | {accept_rate:.2%} |",
                f"| Gain | {gain:+.2%} |",
                "",
            ]
        )

    lines.append("---")
    lines.append("*Report generated by feedback analytics module*")
    lines.append("")

    return "\n".join(lines)
