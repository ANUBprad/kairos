from __future__ import annotations

import time
from dataclasses import dataclass, field
from typing import Optional


@dataclass
class RetrievalTelemetry:
    """Immutable record of a single retrieval operation.

    Attributes:
        timestamp:         Unix timestamp (seconds) when the event was created.
        query_id:          Optional caller-supplied identifier for correlating
                           multiple events that belong to the same end-user
                           request.
        event_type:        Discriminator — ``"classification"``,
                           ``"retrieval"``, or ``"failure"``.
        query:             The user's original query string.
        query_type:        Classified query type (``"SIMPLE"``/``"COMPLEX"``/
                           ``"MULTI_HOP"``).
        confidence:        Classifier confidence score in ``[0.0, 1.0]``.
        retrieval_type:    The retrieval strategy used (e.g. ``"HYBRID"``,
                           ``"MULTI_VECTOR"``, ``"SELF_QUERYING"``).
        top_k:             Requested number of chunks.
        rerank:            Whether cross-encoder reranking was applied.
        decompose:         Whether query decomposition was applied.
        retrieved_chunks:  Number of chunks actually returned.
        retrieval_latency_ms: Total retrieval time in milliseconds.
        fallback_triggered: Whether a fallback escalation occurred.
        fallback_reason:   Human-readable reason when fallback was triggered,
                           or ``None``.
        success:           ``True`` when retrieval completed without error.
    """

    query: str
    query_type: str
    confidence: float
    retrieval_type: str
    top_k: int
    query_id: Optional[str] = None
    event_type: str = "retrieval"
    rerank: bool = False
    decompose: bool = False
    retrieved_chunks: int = 0
    retrieval_latency_ms: float = 0.0
    fallback_triggered: bool = False
    fallback_reason: Optional[str] = None
    success: bool = True
    timestamp: float = field(default_factory=time.time)
