from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional


@dataclass
class CorpusDocument:
    doc_id: str
    text: str
    domain: str = ""
    title: str = ""
    metadata: Dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "doc_id": self.doc_id,
            "text": self.text[:200],
            "domain": self.domain,
            "title": self.title,
        }


class CorpusManager:
    def __init__(self) -> None:
        self._documents: Dict[str, CorpusDocument] = {}
        self._domains: Dict[str, List[str]] = {}

    def add_document(self, doc: CorpusDocument) -> None:
        self._documents[doc.doc_id] = doc
        if doc.domain:
            if doc.domain not in self._domains:
                self._domains[doc.domain] = []
            self._domains[doc.domain].append(doc.doc_id)

    def add_documents(self, docs: List[CorpusDocument]) -> None:
        for doc in docs:
            self.add_document(doc)

    def get_document(self, doc_id: str) -> Optional[CorpusDocument]:
        return self._documents.get(doc_id)

    def get_documents(self, doc_ids: Optional[List[str]] = None) -> List[CorpusDocument]:
        if doc_ids is None:
            return list(self._documents.values())
        return [self._documents[did] for did in doc_ids if did in self._documents]

    def get_documents_by_domain(self, domain: str) -> List[CorpusDocument]:
        doc_ids = self._domains.get(domain, [])
        return [self._documents[did] for did in doc_ids if did in self._documents]

    @property
    def domains(self) -> List[str]:
        return sorted(self._domains.keys())

    @property
    def count(self) -> int:
        return len(self._documents)

    def remove_document(self, doc_id: str) -> bool:
        doc = self._documents.pop(doc_id, None)
        if doc and doc.domain:
            if doc.domain in self._domains and doc_id in self._domains[doc.domain]:
                self._domains[doc.domain].remove(doc_id)
            return True
        return False

    def clear(self) -> None:
        self._documents.clear()
        self._domains.clear()
