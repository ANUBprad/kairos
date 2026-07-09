from __future__ import annotations

from typing import List, Optional

from intelligence.evaluation.evaluator import AggregateEvaluation
from intelligence.evaluation.ground_truth import GroundTruth


def run_retrieval_benchmark(
    retriever_fn,
    ground_truth: GroundTruth,
    top_k: Optional[int] = None,
) -> AggregateEvaluation:
    """Run a retrieval benchmark against ground truth.

    Args:
        retriever_fn:  Callable that takes ``(query, query_type, top_k)`` and
                       returns ``(doc_ids, latencies_ms, successes)``.
        ground_truth:  Ground truth with query/relevant_doc pairs.
        top_k:         Number of documents to retrieve per query (default: auto).

    Returns:
        Aggregate evaluation result.

    Usage::

        def my_retriever(query, query_type, top_k):
            docs = retrieve(query, top_k=top_k or 5)
            return [d.id for d in docs], [d.latency_ms], True

        gt = GroundTruth()
        gt.add_entry(GroundTruthEntry(query="...", relevant_docs={"d1"}))

        result = run_retrieval_benchmark(my_retriever, gt)
    """
    from intelligence.evaluation.evaluator import Evaluator

    retrieved_batch: List[List[str]] = []
    relevant_batch: List[set] = []
    latencies: List[float] = []
    successes: List[bool] = []
    query_ids: List[str] = []
    query_types: List[str] = []

    for entry in ground_truth.entries:
        doc_ids, lat_ms, ok = retriever_fn(
            entry.query,
            entry.query_type,
            top_k,
        )
        retrieved_batch.append(list(doc_ids) if doc_ids else [])
        relevant_batch.append(entry.relevant_docs)
        latencies.append(lat_ms)
        successes.append(ok)
        query_ids.append(entry.query_id)
        query_types.append(entry.query_type)

    evaluator = Evaluator()
    return evaluator.evaluate(
        retrieved=retrieved_batch,
        relevant=relevant_batch,
        query_ids=query_ids,
        query_types=query_types,
        latencies_ms=latencies,
        successes=successes,
    )
