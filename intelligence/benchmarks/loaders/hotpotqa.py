"""Loader for HotpotQA dataset (distractor setting).

Expected JSON format (list of dicts):
    {
        "_id": "5a8b5f2a554f30001b9f3b5e",
        "question": "Which magazine was started first, Arthur's Magazine or First for Women?",
        "answer": "Arthur's Magazine",
        "type": "comparison",
        "level": "medium",
        "supporting_facts": [["Arthur's Magazine", 0], ...],
        "context": [["title", ["sent0", "sent1", ...]], ...]
    }
"""

from __future__ import annotations

import json
import os
from pathlib import Path
from typing import Any, Dict, List, Optional

from benchmarks.dataset.loader import QueryEntry

from intelligence.benchmarks.loaders import _pick_query_type, _to_str_list, _to_text


def load_hotpotqa(
    path: os.PathLike[str],
    max_queries: Optional[int] = None,
) -> List[QueryEntry]:
    """Load HotpotQA queries from a JSON file.

    Args:
        path:         Path to a HotpotQA JSON file.
        max_queries:  Optional limit on the number of queries to load.

    Returns:
        List of :class:`QueryEntry` objects.

    Raises:
        FileNotFoundError: If *path* does not exist.
        json.JSONDecodeError: If the file is not valid JSON.
    """
    path_obj = Path(path) if isinstance(path, (str, os.PathLike)) else Path(path)
    with path_obj.open("r", encoding="utf-8") as f:
        raw = json.load(f)

    if not isinstance(raw, list):
        raise ValueError(f"Expected a list of items, got {type(raw).__name__}")

    entries: List[QueryEntry] = []
    for item in raw:
        if not isinstance(item, dict):
            continue
        qid = _to_text(item.get("_id", ""))
        question = _to_text(item.get("question", ""))
        if not qid or not question:
            continue

        entry = QueryEntry(
            id=qid,
            text=question,
            query_type=_pick_query_type(item),
            confidence_category=_confidence_band(item.get("level", "")),
            expected_chunks=_to_str_list(item.get("answer")),
            domain=_to_text(item.get("type", "")),
        )
        entries.append(entry)
        if max_queries is not None and len(entries) >= max_queries:
            break

    return entries


def _confidence_band(level: str) -> str:
    mapping: Dict[str, str] = {
        "easy": "high",
        "medium": "medium",
        "hard": "low",
    }
    return mapping.get(level.lower(), "medium")
