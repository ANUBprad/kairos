from __future__ import annotations

from typing import List, Optional

from benchmarks.dataset.loader import QueryEntry as QueryEntry


def _to_text(obj: object) -> str:
    if not isinstance(obj, str):
        return str(obj) if obj is not None else ""
    return obj


def _to_str_list(obj: object) -> Optional[List[str]]:
    if obj is None:
        return None
    if isinstance(obj, list):
        return [str(x) for x in obj if x is not None]
    return [str(obj)]


def _pick_query_type(item: dict) -> str:
    tp = item.get("type", "")
    if not isinstance(tp, str):
        tp = str(tp)
    tl = tp.lower()
    if tl in ("comparison", "bridge"):
        return "complex"
    return "simple"
