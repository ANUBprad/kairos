from __future__ import annotations

from typing import Dict, List, Optional, Sequence

from intelligence.evaluation.evaluator import AggregateEvaluation, EvaluationResult


def generate_evaluation_report(
    evaluation: AggregateEvaluation,
    title: str = "Retrieval Evaluation Report",
) -> str:
    """Generate a Markdown evaluation report from an AggregateEvaluation."""
    lines: List[str] = [
        f"# {title}",
        "",
        f"**Queries:** {evaluation.n_queries}",
        "",
        "## Aggregate Metrics",
        "",
        "| Metric | Value |",
        "| ------ | ----- |",
        f"| Mean Recall | {evaluation.mean_recall:.4f} |",
        f"| Mean Precision | {evaluation.mean_precision:.4f} |",
        f"| MRR | {evaluation.mrr:.4f} |",
        f"| MAP | {evaluation.map:.4f} |",
        f"| Mean NDCG | {evaluation.mean_ndcg:.4f} |",
        f"| Hit Rate | {evaluation.hit_rate:.4f} |",
        f"| Mean Latency (ms) | {evaluation.mean_latency_ms:.1f} |",
        f"| Success Rate | {evaluation.success_rate:.2%} |",
        "",
    ]

    if evaluation.per_query_results:
        lines.extend([
            "## Per-Query Results",
            "",
            "| ID | Type | Recall | Precision | RR | AP | NDCG | Hit | Latency (ms) | Success |",
            "| -- | ---- | ------ | --------- | -- | -- | ---- | --- | ------------ | ------- |",
        ])
        for r in evaluation.per_query_results:
            lines.append(
                f"| {r.query_id[:10]:<10} "
                f"| {r.query_type[:10]:<10} "
                f"| {r.recall:.3f} "
                f"| {r.precision:.3f} "
                f"| {r.reciprocal_rank:.3f} "
                f"| {r.average_precision:.3f} "
                f"| {r.ndcg:.3f} "
                f"| {'Y' if r.hit else 'N':<4} "
                f"| {r.latency_ms:>8.1f} "
                f"| {'Y' if r.success else 'N'} |"
            )
        lines.append("")

    return "\n".join(lines)


def evaluate_retrieval_strategies(
    results: Dict[str, AggregateEvaluation],
) -> str:
    """Compare multiple retrieval strategies in a Markdown table."""
    lines: List[str] = [
        "# Retrieval Strategy Comparison",
        "",
        "| Strategy | Queries | Recall | Precision | MRR | MAP | NDCG | Hit Rate | Latency (ms) |",
        "| -------- | ------- | ------ | --------- | --- | --- | ---- | -------- | ------------ |",
    ]
    for name, eval_ in results.items():
        lines.append(
            f"| {name:<20} "
            f"| {eval_.n_queries:>7} "
            f"| {eval_.mean_recall:.3f} "
            f"| {eval_.mean_precision:.3f} "
            f"| {eval_.mrr:.3f} "
            f"| {eval_.map:.3f} "
            f"| {eval_.mean_ndcg:.3f} "
            f"| {eval_.hit_rate:.3f} "
            f"| {eval_.mean_latency_ms:>8.1f} |"
        )
    lines.append("")
    return "\n".join(lines)
