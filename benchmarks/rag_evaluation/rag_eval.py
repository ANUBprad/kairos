"""Kairos RAG Evaluation Suite.

Evaluates BM25, Dense Retrieval, and Hybrid Retrieval using:
- Recall@5, Recall@10
- Precision@5
- MRR (Mean Reciprocal Rank)
- nDCG (Normalized Discounted Cumulative Gain)

Generates comparison reports in markdown and JSON.
"""

from __future__ import annotations

import json
import math
import sys
import time
from dataclasses import asdict, dataclass, field
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parent.parent.parent
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))


@dataclass
class RetrievalResult:
    method: str
    recall_at_5: float
    recall_at_10: float
    precision_at_5: float
    mrr: float
    ndcg_at_5: float
    ndcg_at_10: float
    mean_latency_ms: float
    p95_latency_ms: float
    total_queries: int
    timestamp: str = ""

    def to_dict(self) -> dict:
        return asdict(self)


@dataclass
class RAGEvaluationReport:
    dataset_name: str
    results: list[RetrievalResult] = field(default_factory=list)
    comparison: dict[str, Any] = field(default_factory=dict)
    recommendations: list[str] = field(default_factory=list)
    timestamp: str = ""


def compute_recall_at_k(retrieved: list[str], relevant: set[str], k: int) -> float:
    """Compute Recall@K."""
    if not relevant:
        return 0.0
    retrieved_at_k = set(retrieved[:k])
    return len(retrieved_at_k & relevant) / len(relevant)


def compute_precision_at_k(retrieved: list[str], relevant: set[str], k: int) -> float:
    """Compute Precision@K."""
    if k == 0:
        return 0.0
    retrieved_at_k = retrieved[:k]
    relevant_retrieved = sum(1 for r in retrieved_at_k if r in relevant)
    return relevant_retrieved / k


def compute_mrr(retrieved: list[str], relevant: set[str]) -> float:
    """Compute Mean Reciprocal Rank."""
    for i, doc in enumerate(retrieved, 1):
        if doc in relevant:
            return 1.0 / i
    return 0.0


def compute_ndcg_at_k(retrieved: list[str], relevant: set[str], k: int) -> float:
    """Compute nDCG@K."""
    if not relevant:
        return 0.0

    retrieved_at_k = retrieved[:k]

    dcg = 0.0
    for i, doc in enumerate(retrieved_at_k):
        if doc in relevant:
            dcg += 1.0 / math.log2(i + 2)

    ideal_hits = min(len(relevant), k)
    idcg = sum(1.0 / math.log2(i + 2) for i in range(ideal_hits))

    return dcg / idcg if idcg > 0 else 0.0


@dataclass
class EvalQuery:
    query: str
    relevant_docs: set[str]
    namespace: str = "eval"


def build_eval_dataset() -> list[EvalQuery]:
    """Build a synthetic evaluation dataset for BM25/Dense/Hybrid comparison.

    In production, replace with a real evaluation dataset with labeled relevance.
    """
    return [
        EvalQuery(
            query="What is machine learning?",
            relevant_docs={
                "Machine learning is a subset of artificial intelligence",
                "Deep learning uses neural networks with multiple layers",
            },
        ),
        EvalQuery(
            query="How do neural networks work?",
            relevant_docs={
                "Neural networks consist of interconnected nodes or neurons",
                "Deep learning uses neural networks with multiple layers",
                "Backpropagation is used to train neural networks",
            },
        ),
        EvalQuery(
            query="What is natural language processing?",
            relevant_docs={
                "Natural language processing enables computers to understand text",
                "Transformers revolutionized NLP with attention mechanisms",
            },
        ),
        EvalQuery(
            query="Explain vector databases",
            relevant_docs={
                "Vector databases store high-dimensional embeddings for similarity search",
                "ChromaDB is a vector database for AI applications",
            },
        ),
        EvalQuery(
            query="What is retrieval augmented generation?",
            relevant_docs={
                "RAG combines retrieval with generation for better answers",
                "Retrieval augmented generation uses external knowledge sources",
            },
        ),
        EvalQuery(
            query="How does attention mechanism work?",
            relevant_docs={
                "Transformers revolutionized NLP with attention mechanisms",
                "Self-attention allows models to weigh importance of different words",
            },
        ),
        EvalQuery(
            query="What are transformers in AI?",
            relevant_docs={
                "Transformers revolutionized NLP with attention mechanisms",
                "Self-attention allows models to weigh importance of different words",
                "BERT and GPT are popular transformer architectures",
            },
        ),
        EvalQuery(
            query="Explain transfer learning",
            relevant_docs={
                "Transfer learning allows models to leverage pre-trained knowledge",
                "Fine-tuning adapts pre-trained models to specific tasks",
            },
        ),
        EvalQuery(
            query="What is reinforcement learning?",
            relevant_docs={
                "Reinforcement learning trains agents through rewards and penalties",
                "RLHF combines reinforcement learning with human feedback",
            },
        ),
        EvalQuery(
            query="How to evaluate RAG systems?",
            relevant_docs={
                "RAG evaluation uses metrics like recall, precision, and nDCG",
                "Retrieval quality directly impacts generation quality",
            },
        ),
    ]


def evaluate_retrieval_method(
    method_name: str,
    retriever_fn,
    eval_queries: list[EvalQuery],
) -> RetrievalResult:
    """Evaluate a retrieval method across all eval queries."""
    recall_5_scores = []
    recall_10_scores = []
    precision_5_scores = []
    mrr_scores = []
    ndcg_5_scores = []
    ndcg_10_scores = []
    latencies = []

    for eq in eval_queries:
        start = time.monotonic()
        try:
            retrieved = retriever_fn(eq.namespace, 10, eq.query)
        except Exception:
            retrieved = []
        elapsed = (time.monotonic() - start) * 1000
        latencies.append(elapsed)

        recall_5_scores.append(compute_recall_at_k(retrieved, eq.relevant_docs, 5))
        recall_10_scores.append(compute_recall_at_k(retrieved, eq.relevant_docs, 10))
        precision_5_scores.append(
            compute_precision_at_k(retrieved, eq.relevant_docs, 5)
        )
        mrr_scores.append(compute_mrr(retrieved, eq.relevant_docs))
        ndcg_5_scores.append(compute_ndcg_at_k(retrieved, eq.relevant_docs, 5))
        ndcg_10_scores.append(compute_ndcg_at_k(retrieved, eq.relevant_docs, 10))

    n = len(eval_queries) or 1

    sorted_lat = sorted(latencies)

    return RetrievalResult(
        method=method_name,
        recall_at_5=sum(recall_5_scores) / n,
        recall_at_10=sum(recall_10_scores) / n,
        precision_at_5=sum(precision_5_scores) / n,
        mrr=sum(mrr_scores) / n,
        ndcg_at_5=sum(ndcg_5_scores) / n,
        ndcg_at_10=sum(ndcg_10_scores) / n,
        mean_latency_ms=sum(latencies) / max(len(latencies), 1),
        p95_latency_ms=sorted_lat[int(len(sorted_lat) * 0.95)] if sorted_lat else 0,
        total_queries=len(eval_queries),
        timestamp=time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
    )


def compare_methods(results: list[RetrievalResult]) -> dict[str, Any]:
    """Generate comparison analysis across retrieval methods."""
    if not results:
        return {}

    best_recall_5 = max(results, key=lambda r: r.recall_at_5)
    best_recall_10 = max(results, key=lambda r: r.recall_at_10)
    best_mrr = max(results, key=lambda r: r.mrr)
    best_ndcg = max(results, key=lambda r: r.ndcg_at_5)
    fastest = min(results, key=lambda r: r.mean_latency_ms)

    return {
        "best_recall_5": best_recall_5.method,
        "best_recall_10": best_recall_10.method,
        "best_mrr": best_mrr.method,
        "best_ndcg_5": best_ndcg.method,
        "fastest_method": fastest.method,
        "recommendation": _generate_recommendation(results),
    }


def _generate_recommendation(results: list[RetrievalResult]) -> str:
    """Generate a recommendation based on evaluation results."""
    if not results:
        return "No results to analyze"

    hybrid = next((r for r in results if "hybrid" in r.method.lower()), None)
    bm25 = next((r for r in results if "bm25" in r.method.lower()), None)
    dense = next((r for r in results if "dense" in r.method.lower()), None)

    if hybrid and hybrid.recall_at_5 > 0.6:
        return "Hybrid retrieval recommended for balanced performance"
    elif bm25 and bm25.recall_at_5 > 0.7:
        return "BM25 recommended for keyword-heavy queries"
    elif dense and dense.recall_at_5 > 0.6:
        return "Dense retrieval recommended for semantic queries"
    else:
        return "Further tuning needed for all retrieval methods"


def generate_rag_report(report: RAGEvaluationReport) -> str:
    """Generate a markdown RAG evaluation report."""
    lines = [
        "# Kairos RAG Evaluation Report",
        "",
        f"- **Dataset**: {report.dataset_name}",
        f"- **Timestamp**: {report.timestamp}",
        "",
        "## Results Comparison",
        "",
        "| Method | Recall@5 | Recall@10 | Precision@5 | MRR | nDCG@5 | nDCG@10 | Latency (ms) |",
        "|:------:|:--------:|:---------:|:-----------:|:---:|:------:|:-------:|:------------:|",
    ]

    for r in report.results:
        lines.append(
            f"| {r.method} | {r.recall_at_5:.4f} | {r.recall_at_10:.4f} | "
            f"{r.precision_at_5:.4f} | {r.mrr:.4f} | {r.ndcg_at_5:.4f} | "
            f"{r.ndcg_at_10:.4f} | {r.mean_latency_ms:.1f} |"
        )

    if report.comparison:
        lines.extend([
            "",
            "## Analysis",
            "",
            f"- **Best Recall@5**: {report.comparison.get('best_recall_5', 'N/A')}",
            f"- **Best MRR**: {report.comparison.get('best_mrr', 'N/A')}",
            f"- **Best nDCG@5**: {report.comparison.get('best_ndcg_5', 'N/A')}",
            f"- **Fastest**: {report.comparison.get('fastest_method', 'N/A')}",
            f"- **Recommendation**: {report.comparison.get('recommendation', 'N/A')}",
        ])

    if report.recommendations:
        lines.extend(["", "## Recommendations", ""])
        for rec in report.recommendations:
            lines.append(f"- {rec}")

    return "\n".join(lines)


if __name__ == "__main__":
    print("RAG Evaluation Suite loaded.")
    print("Use with actual retriever instances for evaluation.")
