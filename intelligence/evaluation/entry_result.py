from __future__ import annotations

import contextvars
import uuid
from dataclasses import dataclass, field
from typing import Dict, List, Optional

_trace_id_var: contextvars.ContextVar[str] = contextvars.ContextVar(
    "kairos_eval_trace_id", default=""
)


def get_trace_id() -> str:
    return _trace_id_var.get()


def set_trace_id(trace_id: str) -> None:
    _trace_id_var.set(trace_id)


def new_trace_id() -> str:
    """Generate and set a fresh trace id, returning it."""
    trace_id = uuid.uuid4().hex
    set_trace_id(trace_id)
    return trace_id


@dataclass(frozen=True)
class EntryResult:
    """Complete result for one golden-dataset entry."""

    entry_id: str
    query: str
    query_type: str
    status: str = "ok"
    error_type: Optional[str] = None
    error_message: Optional[str] = None

    retrieved_chunks: tuple[str, ...] = ()
    retrieval_type: str = ""
    fallback_triggered: bool = False

    generated_answer: Optional[str] = None
    prompt_tokens: int = 0
    completion_tokens: int = 0
    model: str = ""
    cost_usd: float = 0.0
    trace_id: str = ""

    recall: Optional[float] = None
    precision: Optional[float] = None

    judge_scores: Dict[str, float] = field(default_factory=dict)
    composite_judge_score: Optional[float] = None

    latency_classify: float = 0.0
    latency_retrieval: float = 0.0
    latency_generation: float = 0.0
    latency_total: float = 0.0

    def to_dict(self) -> Dict[str, object]:
        d: Dict[str, object] = {
            "entry_id": self.entry_id,
            "query": self.query,
            "query_type": self.query_type,
            "status": self.status,
            "retrieved_chunks": list(self.retrieved_chunks),
            "retrieval_type": self.retrieval_type,
            "fallback_triggered": self.fallback_triggered,
            "recall": self.recall,
            "precision": self.precision,
            "judge_scores": dict(self.judge_scores),
            "latency_classify": self.latency_classify,
            "latency_retrieval": self.latency_retrieval,
            "latency_generation": self.latency_generation,
            "latency_total": self.latency_total,
        }
        if self.generated_answer is not None:
            d["generated_answer"] = self.generated_answer
            d["prompt_tokens"] = self.prompt_tokens
            d["completion_tokens"] = self.completion_tokens
            d["model"] = self.model
            d["cost_usd"] = self.cost_usd
        if self.trace_id:
            d["trace_id"] = self.trace_id
        if self.composite_judge_score is not None:
            d["composite_judge_score"] = self.composite_judge_score
        if self.error_type is not None:
            d["error_type"] = self.error_type
            d["error_message"] = self.error_message
        return d


@dataclass(frozen=True)
class RunResult:
    """Aggregate results across a full evaluation run."""

    results: tuple[EntryResult, ...]

    @property
    def total(self) -> int:
        return len(self.results)

    @property
    def succeeded(self) -> int:
        return sum(1 for r in self.results if r.status == "ok")

    @property
    def failed(self) -> int:
        return sum(1 for r in self.results if r.status == "error")

    @property
    def success_rate(self) -> float:
        return self.succeeded / self.total if self.total else 0.0

    def mean_recall(self) -> Optional[float]:
        vals = [r.recall for r in self.results if r.recall is not None]
        return sum(vals) / len(vals) if vals else None

    def mean_precision(self) -> Optional[float]:
        vals = [r.precision for r in self.results if r.precision is not None]
        return sum(vals) / len(vals) if vals else None

    def mean_latency(self) -> Dict[str, float]:
        n = self.total
        if n == 0:
            return {"classify": 0.0, "retrieval": 0.0, "generation": 0.0, "total": 0.0}
        return {
            "classify": sum(r.latency_classify for r in self.results) / n,
            "retrieval": sum(r.latency_retrieval for r in self.results) / n,
            "generation": sum(r.latency_generation for r in self.results) / n,
            "total": sum(r.latency_total for r in self.results) / n,
        }

    def mean_judge_scores(self) -> Dict[str, float]:
        dims: Dict[str, List[float]] = {}
        for r in self.results:
            for dim, score in r.judge_scores.items():
                dims.setdefault(dim, []).append(score)
        return {d: sum(s) / len(s) for d, s in dims.items()}

    def total_tokens(self) -> Dict[str, int]:
        prompt = sum(r.prompt_tokens for r in self.results)
        completion = sum(r.completion_tokens for r in self.results)
        return {"prompt_tokens": prompt, "completion_tokens": completion}

    def total_cost(self) -> float:
        return sum(r.cost_usd for r in self.results)

    def per_type_results(self) -> Dict[str, List[EntryResult]]:
        groups: Dict[str, List[EntryResult]] = {}
        for r in self.results:
            groups.setdefault(r.query_type, []).append(r)
        return groups

    def to_dict(self) -> Dict[str, object]:
        agg: Dict[str, object] = {
            "total": self.total,
            "succeeded": self.succeeded,
            "failed": self.failed,
            "success_rate": self.success_rate,
            "mean_latency": self.mean_latency(),
            "total_tokens": self.total_tokens(),
            "total_cost_usd": self.total_cost(),
        }
        mr = self.mean_recall()
        mp = self.mean_precision()
        if mr is not None:
            agg["mean_recall"] = mr
        if mp is not None:
            agg["mean_precision"] = mp
        mjs = self.mean_judge_scores()
        if mjs:
            agg["mean_judge_scores"] = mjs
        return agg
