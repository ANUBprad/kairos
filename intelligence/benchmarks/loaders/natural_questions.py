"""Loader for Google Natural Questions dataset (simplified JSON format).

Expected JSON format (simplified NQ):
    {
        "id": "12345",
        "question_text": "Where is the Amazon River?",
        "document_text": "The Amazon River is in South America...",
        "annotations": [{
            "short_answers": [{"text": "South America", "start_byte": 10}],
            "long_answer": {"text": "...", "start_byte": 5}
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


def load_natural_questions(
    path: os.PathLike[str],
    max_queries: Optional[int] = None,
) -> List[QueryEntry]:
    """Load Natural Questions from a JSON file.

    Each line in the file should be a JSON object (JSONL format) or the
    file can be a JSON array.

    Args:
        path:         Path to a Natural Questions JSON or JSONL file.
        max_queries:  Optional limit on the number of queries to load.

    Returns:
        List of :class:`QueryEntry` objects.
    """
    path_obj = Path(path)
    raw_items: List[dict] = []
    with path_obj.open("r", encoding="utf-8") as f:
        content = f.read().strip()
        if not content:
            return []
        if content[0] == "[":
            raw = json.loads(content)
            if isinstance(raw, list):
                raw_items = [item for item in raw if isinstance(item, dict)]
            else:
                return []
        else:
            for line in content.splitlines():
                line = line.strip()
                if line:
                    item = json.loads(line)
                    if isinstance(item, dict):
                        raw_items.append(item)

    entries: List[QueryEntry] = []
    for item in raw_items:
        qid = _to_text(item.get("id", ""))
        question = _to_text(item.get("question_text", ""))
        if not qid or not question:
            continue

        answers: List[str] = []
        annotations = item.get("annotations", [])
        if isinstance(annotations, list):
            for ann in annotations:
                if not isinstance(ann, dict):
                    continue
                short_answers = ann.get("short_answers", [])
                if isinstance(short_answers, list):
                    for sa in short_answers:
                        if isinstance(sa, dict):
                            txt = _to_text(sa.get("text", ""))
                            if txt:
                                answers.append(txt)

        entry = QueryEntry(
            id=qid,
            text=question,
            query_type="complex",
            confidence_category="medium",
            expected_chunks=answers if answers else None,
        )
        entries.append(entry)
        if max_queries is not None and len(entries) >= max_queries:
            break

    return entries
