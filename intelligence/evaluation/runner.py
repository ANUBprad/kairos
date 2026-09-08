from __future__ import annotations

import logging
import re
from typing import Dict, List, Optional

from benchmarks.dataset.loader import QueryEntry
from benchmarks.metrics import LatencyTracker, precision_at_k, recall_at_k
from intelligence.evaluation.entry_result import EntryResult, RunResult
from intelligence.evaluation.run_config import RunConfig
from intelligence.judging.judge import CompositeJudge
from intelligence.server.engine import RetrievalEngine

logger = logging.getLogger(__name__)

_RETRIEVAL_TYPE_NAMES = {
    0: "RETRIEVAL_TYPE_UNSPECIFIED",
    1: "HYBRID",
    2: "SELF_QUERYING",
    3: "MULTI_VECTOR",
}

_SECRET_PATTERNS = re.compile(
    r"(api[_-]?key|secret|token|password|credential)[=:]\s*\S+",
    re.IGNORECASE,
)


def _sanitize_error(msg: str) -> str:
    return _SECRET_PATTERNS.sub(r"\1=[REDACTED]", msg)


class EvaluationRunner:
    """Execute golden-dataset entries through the production pipeline.

    Uses the real RetrievalEngine for classification, retrieval, and
    generation.  Optionally runs judges on generated answers.
    """

    def __init__(
        self,
        engine: RetrievalEngine,
        config: RunConfig,
        judge: Optional[CompositeJudge] = None,
    ) -> None:
        self._engine = engine
        self._config = config
        self._judge = judge

    def run(self, entries: List[QueryEntry]) -> RunResult:
        limit = self._config.max_entries
        if limit is not None:
            entries = entries[:limit]

        results: List[EntryResult] = []
        for entry in entries:
            result = self._run_entry(entry)
            results.append(result)
        return RunResult(results=tuple(results))

    def _run_entry(self, entry: QueryEntry) -> EntryResult:
        tracker = LatencyTracker()
        ns = self._config.namespace

        try:
            with tracker.measure("classify"):
                classification = self._engine.classify_query(entry.text)

            top_k = self._config.top_k or classification["top_k"]
            retrieval_type = classification["retrieval_type"]

            with tracker.measure("retrieval"):
                retrieval_result = self._engine.execute_retrieval(
                    namespace=ns,
                    query=entry.text,
                    top_k=top_k,
                    retrieval_type=retrieval_type,
                    rerank=classification["rerank"],
                    decompose=classification["decompose"],
                )

            chunks = retrieval_result["chunks"]
            used_type = retrieval_result["used_type"]
            fallback = retrieval_result["fallback_triggered"]

            retrieval_type_name = _RETRIEVAL_TYPE_NAMES.get(
                used_type, f"UNKNOWN({used_type})"
            )

            generated_answer = None
            prompt_tokens = 0
            completion_tokens = 0
            model = ""

            if self._config.generate and chunks:
                with tracker.measure("generation"):
                    gen = self._engine.generate_response(entry.text, chunks)
                generated_answer = gen["response"]
                prompt_tokens = gen["prompt_tokens"]
                completion_tokens = gen["completion_tokens"]
                model = gen["model"]

            recall = None
            precision = None
            if entry.expected_chunks and chunks:
                relevant = set(entry.expected_chunks)
                recall = recall_at_k(relevant, chunks)
                precision = precision_at_k(relevant, chunks)
            elif entry.expected_chunks and not chunks:
                recall = 0.0
                precision = 0.0

            judge_scores: dict[str, float] = {}
            composite_judge_score = None
            if self._judge and generated_answer is not None:
                judge_results = self._judge.evaluate(
                    query=entry.text,
                    answer=generated_answer,
                    context=chunks,
                    reference=entry.expected_answer or "",
                )
                for jr in judge_results:
                    judge_scores[jr.dimension] = jr.score
                composite_judge_score = self._judge.composite_score(
                    query=entry.text,
                    answer=generated_answer,
                    context=chunks,
                    reference=entry.expected_answer or "",
                )

            latency = tracker.record()

            return EntryResult(
                entry_id=entry.id,
                query=entry.text,
                query_type=entry.query_type,
                status="ok",
                retrieved_chunks=tuple(chunks),
                retrieval_type=retrieval_type_name,
                fallback_triggered=fallback,
                generated_answer=generated_answer,
                prompt_tokens=prompt_tokens,
                completion_tokens=completion_tokens,
                model=model,
                recall=recall,
                precision=precision,
                judge_scores=judge_scores,
                composite_judge_score=composite_judge_score,
                latency_classify=latency.classify,
                latency_retrieval=latency.retrieval,
                latency_generation=latency.generation,
                latency_total=latency.total,
            )

        except Exception as exc:
            latency = tracker.record()
            error_type = type(exc).__name__
            error_msg = _sanitize_error(str(exc)[:500])
            logger.warning(
                "Entry %s failed: %s: %s", entry.id, error_type, error_msg,
            )
            return EntryResult(
                entry_id=entry.id,
                query=entry.text,
                query_type=entry.query_type,
                status="error",
                error_type=error_type,
                error_message=error_msg,
                latency_classify=latency.classify,
                latency_retrieval=latency.retrieval,
                latency_generation=latency.generation,
                latency_total=latency.total,
            )
