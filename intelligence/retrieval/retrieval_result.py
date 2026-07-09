from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Dict, List


@dataclass
class RetrievedDocument:
    text: str
    score: float = 0.0
    source_id: str = ""
    metadata: Dict[str, Any] = field(default_factory=dict)


@dataclass
class RetrievalResult:
    query: str
    query_id: str = ""
    query_type: str = ""
    strategy: str = ""
    documents: List[RetrievedDocument] = field(default_factory=list)
    latency_ms: float = 0.0
    confidence: float = 0.0
    success: bool = True
    error: str = ""
    num_hops: int = 1
    planner_decision: Dict[str, Any] = field(default_factory=dict)
    metadata: Dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "query": self.query,
            "query_id": self.query_id,
            "query_type": self.query_type,
            "strategy": self.strategy,
            "documents": [
                {"text": d.text[:200], "score": d.score, "source_id": d.source_id}
                for d in self.documents
            ],
            "latency_ms": self.latency_ms,
            "confidence": self.confidence,
            "success": self.success,
            "error": self.error,
            "num_hops": self.num_hops,
            "planner_decision": dict(self.planner_decision),
        }

    @property
    def num_documents(self) -> int:
        return len(self.documents)

    @property
    def top_score(self) -> float:
        if not self.documents:
            return 0.0
        return max(d.score for d in self.documents)

    @property
    def mean_score(self) -> float:
        if not self.documents:
            return 0.0
        return sum(d.score for d in self.documents) / len(self.documents)
