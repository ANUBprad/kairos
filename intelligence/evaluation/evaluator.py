from __future__ import annotations

from dataclasses import dataclass, field
from typing import Dict, List, Optional, Sequence, Set

from intelligence.evaluation.ranking_metrics import (
    average_precision,
)


@dataclass
class EvaluationResult:
    """Results from evaluating a single retrieval query.

    Attributes:
        query_id:           Optional query identifier.
        query_type:         Query type (simple, complex, multi_hop).
        recall:             Recall@k.
        precision:          Precision@k.
        reciprocal_rank:    Reciprocal rank (for MRR).
        average_precision:  Average precision (for MAP).
        ndcg:               Normalized DCG.
        hit:                Whether any relevant doc was retrieved (for Hit Rate).
        latency_ms:         Query latency.
        success:            Whether the query succeeded.
        metadata:           Additional metadata.
    """

    query_id: str = ""
    query_type: str = ""
    recall: float = 0.0
    precision: float = 0.0
    reciprocal_rank: float = 0.0
    average_precision: float = 0.0
    ndcg: float = 0.0
    hit: bool = False
    latency_ms: float = 0.0
    success: bool = True
    metadata: Dict[str, object] = field(default_factory=dict)


@dataclass
class AggregateEvaluation:
    """Aggregated evaluation results across multiple queries."""

    n_queries: int = 0
    mean_recall: float = 0.0
    mean_precision: float = 0.0
    mrr: float = 0.0
    map: float = 0.0
    mean_ndcg: float = 0.0
    hit_rate: float = 0.0
    mean_latency_ms: float = 0.0
    success_rate: float = 0.0
    per_query_results: List[EvaluationResult] = field(default_factory=list)

    def to_dict(self) -> Dict[str, object]:
        return {
            "n_queries": self.n_queries,
            "mean_recall": self.mean_recall,
            "mean_precision": self.mean_precision,
            "mrr": self.mrr,
            "map": self.map,
            "mean_ndcg": self.mean_ndcg,
            "hit_rate": self.hit_rate,
            "mean_latency_ms": self.mean_latency_ms,
            "success_rate": self.success_rate,
        }


class Evaluator:
    """Evaluates retrieval quality across multiple ranking metrics.

    Usage::

        evaluator = Evaluator()
        result = evaluator.evaluate(
            retrieved=[["doc1", "doc2"], ["doc3"]],
            relevant=[{"doc1"}, {"doc3", "doc4"}],
            relevances=[[1.0, 0.0], [1.0, 0.5]],
        )
    """

    def evaluate(
        self,
        retrieved: Sequence[Sequence[str]],
        relevant: Sequence[Set[str]],
        relevances: Optional[Sequence[Sequence[float]]] = None,
        query_ids: Optional[Sequence[str]] = None,
        query_types: Optional[Sequence[str]] = None,
        latencies_ms: Optional[Sequence[float]] = None,
        successes: Optional[Sequence[bool]] = None,
    ) -> AggregateEvaluation:
        from intelligence.evaluation.ranking_metrics import (
            reciprocal_rank,
        )
        from benchmarks.metrics import precision_at_k, recall_at_k

        n = len(retrieved)
        if n == 0:
            return AggregateEvaluation()

        per_query: List[EvaluationResult] = []
        total_recall = 0.0
        total_precision = 0.0
        total_rr = 0.0
        total_ap = 0.0
        total_ndcg = 0.0
        total_hits = 0
        total_latency = 0.0
        total_success = 0

        for i in range(n):
            ret = list(retrieved[i])
            rel = relevant[i]

            recall = recall_at_k(rel, ret)
            precision = precision_at_k(rel, ret)
            rr = reciprocal_rank(rel, ret)
            ap = average_precision(rel, ret)
            ndcg_val = _ndcg_for_eval(ret, rel, relevances[i] if relevances else None)
            hit = any(doc in rel for doc in ret)

            total_recall += recall
            total_precision += precision
            total_rr += rr
            total_ap += ap
            total_ndcg += ndcg_val
            if hit:
                total_hits += 1

            latency = latencies_ms[i] if latencies_ms and i < len(latencies_ms) else 0.0
            success = successes[i] if successes and i < len(successes) else True
            total_latency += latency
            if success:
                total_success += 1

            per_query.append(
                EvaluationResult(
                    query_id=query_ids[i] if query_ids and i < len(query_ids) else "",
                    query_type=query_types[i]
                    if query_types and i < len(query_types)
                    else "",
                    recall=recall,
                    precision=precision,
                    reciprocal_rank=rr,
                    average_precision=ap,
                    ndcg=ndcg_val,
                    hit=hit,
                    latency_ms=latency,
                    success=success,
                )
            )

        nf = float(n)
        return AggregateEvaluation(
            n_queries=n,
            mean_recall=total_recall / nf,
            mean_precision=total_precision / nf,
            mrr=total_rr / nf,
            map=total_ap / nf,
            mean_ndcg=total_ndcg / nf,
            hit_rate=total_hits / nf,
            mean_latency_ms=total_latency / nf,
            success_rate=total_success / nf,
            per_query_results=per_query,
        )


def _ndcg_for_eval(
    retrieved: List[str],
    relevant: Set[str],
    relevances: Optional[Sequence[float]],
) -> float:
    from intelligence.evaluation.ranking_metrics import normalized_dcg

    if relevances is not None:
        return normalized_dcg(list(relevances))
    binary = [1.0 if d in relevant else 0.0 for d in retrieved]
    return normalized_dcg(binary)
