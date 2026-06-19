"""Retrieval strategy selection with confidence-aware budget overrides.

The module preserves the original static strategy selection as the default
behaviour. When a confidence score below ``CONFIDENCE_HIGH`` is provided,
the static config is overridden with budget values from the planner module.
"""

from __future__ import annotations

from ..planner import CONFIDENCE_HIGH, QueryType, RetrievalBudget, allocate_budget
from .query_classifier import ResponseSchema


def get_config(
    query_details: ResponseSchema,
    confidence: float = 1.0,
    budget: RetrievalBudget | None = None,
) -> dict:
    """Select a retrieval configuration, optionally informed by confidence.

    When *confidence* is ``>= CONFIDENCE_HIGH`` (0.8), the original static
    strategy is returned unchanged.  Below that threshold the budget is
    looked up from the planner's budget table and overrides ``top_k``,
    ``rerank``, and ``decompose`` in the static config.

    Args:
        query_details: Classification result (type + domain).
        confidence:    Classifier confidence in ``[0.0, 1.0]``.
                       Defaults to ``1.0`` so that legacy callers that do not
                       pass confidence receive the static behaviour.
        budget:        Optional pre-computed budget.  When ``None``, the
                       budget is computed internally via
                       :func:`allocate_budget`.

    Returns:
        A dictionary with keys ``retrieval_type``, ``top_k``, ``rerank``,
        and ``decompose``.

    Examples:
        >>> from .query_classifier import ResponseSchema
        >>> details = ResponseSchema(query_type="simple", domain=None)

        # High confidence  →  static config unchanged
        >>> cfg = get_config(details, confidence=0.92)
        >>> cfg["top_k"], cfg["rerank"], cfg["decompose"]
        (3, False, False)

        # Low confidence  →  budget overrides apply
        >>> cfg = get_config(details, confidence=0.30)
        >>> cfg["top_k"], cfg["rerank"], cfg["decompose"]
        (8, True, False)
    """
    # --- 1.  Static config (original logic, unchanged) ---

    query_type = query_details.query_type

    if query_type == "simple":
        retrieval_type = "RETRIEVAL_TYPE_UNSPECIFIED"
        if query_details.domain is not None:
            retrieval_type = "HYBRID"
        config: dict = {
            "retrieval_type": retrieval_type,
            "top_k": 3,
            "rerank": False,
            "decompose": False,
        }

    elif query_type == "complex":
        config = {
            "retrieval_type": "MULTI_VECTOR",
            "top_k": 8,
            "rerank": True,
            "decompose": False,
        }

    elif query_type == "multi_hop":
        config = {
            "retrieval_type": "SELF_QUERYING",
            "top_k": 3,
            "rerank": False,
            "decompose": True,
        }

    else:
        config = {
            "retrieval_type": "RETRIEVAL_TYPE_UNSPECIFIED",
            "top_k": 3,
            "rerank": False,
            "decompose": False,
        }

    # --- 2.  Confidence-aware overrides (only when conf < HIGH) ---

    if confidence >= CONFIDENCE_HIGH:
        return config

    if budget is None:
        budget = allocate_budget(QueryType(query_type), confidence)

    config["top_k"] = budget.top_k
    config["rerank"] = budget.rerank
    config["decompose"] = budget.decompose

    return config
