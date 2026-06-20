from __future__ import annotations

import time
from dataclasses import dataclass, field
from typing import Optional


@dataclass
class FeedbackRecord:
    """Immutable record of user feedback on a single retrieval outcome.

    Attributes:
        query_id:              Unique identifier for the query.
        query:                 The user's original query string.
        timestamp:             Unix timestamp (seconds) when the record was created.
        query_type:            Classified query type (``"SIMPLE"``/``"COMPLEX"``/``"MULTI_HOP"``).
        retrieval_type:        The retrieval strategy used (e.g. ``"HYBRID"``, ``"MULTI_VECTOR"``).
        confidence:            Raw classifier confidence in ``[0.0, 1.0]``.
        calibrated_confidence: Post-calibration confidence (same as *confidence* when unused).
        top_k:                 Number of chunks requested.
        rerank:                Whether cross-encoder reranking was applied.
        decompose:             Whether query decomposition was applied.
        answer_accepted:       Whether the user accepted the answer (binary).
        answer_rating:         User rating in ``[1, 5]`` (optional, ``None`` when unrated).
        fallback_triggered:    Whether a fallback escalation occurred.
        retrieval_success:     ``True`` when retrieval completed without error.
        latency_ms:            Total retrieval latency in milliseconds.
    """

    query_id: str
    query: str
    query_type: str
    retrieval_type: str
    confidence: float
    calibrated_confidence: float
    top_k: int
    rerank: bool
    decompose: bool
    answer_accepted: bool
    answer_rating: Optional[int] = None
    fallback_triggered: bool = False
    retrieval_success: bool = True
    latency_ms: float = 0.0
    timestamp: float = field(default_factory=time.time)
