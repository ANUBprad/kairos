"""Loader for SQuAD dataset.

Expected JSON format (SQuAD v1.1/v2.0):
    {
        "version": "v2.0",
        "data": [{
            "title": "...",
            "paragraphs": [{
                "context": "...",
                "qas": [{
                    "id": "...",
                    "question": "...",
                    "answers": [{"text": "...", "answer_start": ...}],
                    "is_impossible": false
                }]
            }]
        }]
    }
"""

from __future__ import annotations

import json
import os
from pathlib import Path
from typing import Any, Dict, List, Optional

from benchmarks.dataset.loader import QueryEntry

from intelligence.benchmarks.loaders import _to_str_list, _to_text


def load_squad(
    path: os.PathLike[str],
    max_queries: Optional[int] = None,
) -> List[QueryEntry]:
    """Load SQuAD queries from a JSON file.

    Args:
        path:         Path to a SQuAD JSON file.
        max_queries:  Optional limit on the number of queries to load.

    Returns:
        List of :class:`QueryEntry` objects.
    """
    path_obj = Path(path)
    with path_obj.open("r", encoding="utf-8") as f:
        raw = json.load(f)

    if not isinstance(raw, dict):
        raise ValueError(f"Expected a dict at top level, got {type(raw).__name__}")

    entries: List[QueryEntry] = []
    data = raw.get("data", [])
    if not isinstance(data, list):
        raise ValueError("Expected 'data' to be a list")

    for article in data:
        if not isinstance(article, dict):
            continue
        paragraphs = article.get("paragraphs", [])
        if not isinstance(paragraphs, list):
            continue
        for para in paragraphs:
            if not isinstance(para, dict):
                continue
            qas = para.get("qas", [])
            if not isinstance(qas, list):
                continue
            for qa in qas:
                if not isinstance(qa, dict):
                    continue
                qid = _to_text(qa.get("id", ""))
                question = _to_text(qa.get("question", ""))
                if not qid or not question:
                    continue

                answers = qa.get("answers", [])
                is_impossible = qa.get("is_impossible", False)
                if isinstance(answers, list) and answers:
                    answer_text = _to_text(answers[0].get("text", "")) if isinstance(answers[0], dict) else ""
                else:
                    answer_text = ""

                entry = QueryEntry(
                    id=qid,
                    text=question,
                    query_type="simple",
                    confidence_category="medium",
                    expected_chunks=[answer_text] if answer_text else None,
                    domain=_to_text(article.get("title", "")),
                )
                entries.append(entry)
                if max_queries is not None and len(entries) >= max_queries:
                    return entries

    return entries
