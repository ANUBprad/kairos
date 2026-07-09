"""Loader for MS MARCO Passage Ranking dataset.

Expected JSON format:
    {
        "query_id": "12345",
        "query": "how many islands are in the bahamas",
        "passages": [
            {"is_selected": 0, "passage_text": "The Bahamas has 700 islands..."},
            {"is_selected": 1, "passage_text": "There are 700 islands in the Bahamas."}
        ],
        "answer": "700"
    }
"""

from __future__ import annotations

import json
import os
from pathlib import Path
from typing import List, Optional

from benchmarks.dataset.loader import QueryEntry

from intelligence.benchmarks.loaders import _to_text


def load_msmarco(
    path: os.PathLike[str],
    max_queries: Optional[int] = None,
) -> List[QueryEntry]:
    """Load MS MARCO queries from a JSON file.

    Args:
        path:         Path to a MS MARCO JSON file (list of dicts).
        max_queries:  Optional limit on the number of queries to load.

    Returns:
        List of :class:`QueryEntry` objects.
    """
    path_obj = Path(path)
    with path_obj.open("r", encoding="utf-8") as f:
        raw = json.load(f)

    if not isinstance(raw, list):
        raise ValueError(f"Expected a list of items, got {type(raw).__name__}")

    entries: List[QueryEntry] = []
    for item in raw:
        if not isinstance(item, dict):
            continue

        qid = _to_text(item.get("query_id", ""))
        query = _to_text(item.get("query", ""))
        if not qid or not query:
            continue

        passages = item.get("passages", [])
        selected: List[str] = []
        if isinstance(passages, list):
            for p in passages:
                if isinstance(p, dict) and p.get("is_selected") == 1:
                    txt = _to_text(p.get("passage_text", ""))
                    if txt:
                        selected.append(txt)

        answer = _to_text(item.get("answer", ""))
        expected = selected if selected else ([answer] if answer else None)

        entry = QueryEntry(
            id=qid,
            text=query,
            query_type="simple",
            confidence_category="medium",
            expected_chunks=expected,
        )
        entries.append(entry)
        if max_queries is not None and len(entries) >= max_queries:
            break

    return entries
