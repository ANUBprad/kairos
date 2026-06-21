from __future__ import annotations

from dataclasses import dataclass, field
from typing import Dict, List, Optional, Sequence, Set


@dataclass
class GroundTruthEntry:
    """A single ground truth entry for retrieval evaluation.

    Attributes:
        query:          The input query text.
        query_id:       Optional unique query identifier.
        query_type:     Query type (simple, complex, multi_hop).
        relevant_docs:  Set of relevant document IDs or texts.
        relevance_scores: Optional graded relevance scores.
    """
    query: str
    query_id: str = ""
    query_type: str = ""
    relevant_docs: Set[str] = field(default_factory=set)
    relevance_scores: Optional[List[float]] = None


class GroundTruth:
    """Collection of ground truth data for retrieval evaluation.

    Usage::

        gt = GroundTruth()
        gt.add_entry(GroundTruthEntry(
            query="Who invented the lightbulb?",
            query_id="q001",
            query_type="simple",
            relevant_docs={"doc_edison", "doc_bulb_history"},
        ))
    """

    def __init__(self) -> None:
        self._entries: List[GroundTruthEntry] = []
        self._index: Dict[str, int] = {}

    def add_entry(self, entry: GroundTruthEntry) -> None:
        idx = len(self._entries)
        self._entries.append(entry)
        if entry.query_id:
            self._index[entry.query_id] = idx

    def add_entries(self, entries: Sequence[GroundTruthEntry]) -> None:
        for e in entries:
            self.add_entry(e)

    def get_by_query_id(self, query_id: str) -> Optional[GroundTruthEntry]:
        idx = self._index.get(query_id)
        if idx is not None:
            return self._entries[idx]
        return None

    def get_by_query(self, query: str) -> Optional[GroundTruthEntry]:
        for e in self._entries:
            if e.query == query:
                return e
        return None

    @property
    def entries(self) -> List[GroundTruthEntry]:
        return list(self._entries)

    @property
    def count(self) -> int:
        return len(self._entries)

    def to_dict(self) -> Dict[str, object]:
        return {
            "count": self.count,
            "entries": [
                {
                    "query": e.query,
                    "query_id": e.query_id,
                    "query_type": e.query_type,
                    "relevant_docs": list(e.relevant_docs),
                }
                for e in self._entries
            ],
        }

    @classmethod
    def from_dict(cls, data: Dict[str, object]) -> "GroundTruth":
        gt = cls()
        for ed in data.get("entries", []):
            gt.add_entry(GroundTruthEntry(
                query=ed["query"],
                query_id=ed.get("query_id", ""),
                query_type=ed.get("query_type", ""),
                relevant_docs=set(ed.get("relevant_docs", [])),
            ))
        return gt
