from __future__ import annotations

import time
from typing import Any, Dict, List, Optional

from intelligence.planner.retrieval_planner import RetrievalPlanner
from intelligence.retrieval.retrieval_result import RetrievedDocument, RetrievalResult


class RealRetriever:
    def __init__(
        self,
        simple_retriever: object,
        complex_retriever: object,
        multi_hop_retriever: object,
        planner: Optional[RetrievalPlanner] = None,
    ) -> None:
        self._simple = simple_retriever
        self._complex = complex_retriever
        self._multi_hop = multi_hop_retriever
        self._planner = planner

    def _get_retriever(self, strategy: str) -> object:
        mapping = {
            "simple": self._simple,
            "complex": self._complex,
            "multi_hop": self._multi_hop,
            "multihop": self._multi_hop,
        }
        return mapping.get(strategy, self._simple)

    def retrieve(
        self,
        query: str,
        namespace: str = "default",
        strategy: str = "",
        top_k: int = 5,
        query_id: str = "",
        query_type: str = "",
        confidence: float = 0.5,
    ) -> RetrievalResult:
        start = time.monotonic()
        retriever = self._get_retriever(strategy)
        documents: list = []
        num_hops = 1
        error = ""
        planner_decision: Dict[str, Any] = {}

        try:
            if hasattr(retriever, "retrieve_top_k"):
                raw = retriever.retrieve_top_k(
                    namespace=namespace, top_k=top_k, query=query
                )
                if isinstance(raw, list):
                    documents = self._normalize_documents(raw)
                elif isinstance(raw, dict) and "chunks" in raw:
                    documents = self._normalize_documents(raw["chunks"])
            elif hasattr(retriever, "retrieve"):
                raw = retriever.retrieve(namespace=namespace, top_k=top_k, query=query)
                if isinstance(raw, list):
                    documents = self._normalize_documents(raw)
                elif hasattr(raw, "documents"):
                    documents = self._normalize_documents(raw.documents)
        except Exception as e:
            error = str(e)

        elapsed = (time.monotonic() - start) * 1000.0
        return RetrievalResult(
            query=query,
            query_id=query_id,
            query_type=query_type,
            strategy=strategy,
            documents=documents,
            latency_ms=elapsed,
            confidence=confidence,
            success=not bool(error),
            error=error,
            num_hops=num_hops,
            planner_decision=planner_decision,
        )

    def plan_and_retrieve(
        self,
        query: str,
        namespace: str = "default",
        query_id: str = "",
        query_type: str = "",
        **classifier_kwargs: Any,
    ) -> RetrievalResult:
        if self._planner is None:
            return self.retrieve(
                query, namespace=namespace, query_id=query_id, query_type=query_type
            )

        decision = self._planner.plan(
            query=query, query_type=query_type, **classifier_kwargs
        )
        planner_decision = {}
        if hasattr(decision, "to_dict"):
            planner_decision = decision.to_dict()
        elif isinstance(decision, dict):
            planner_decision = decision

        strategy = (
            planner_decision.get("strategy", "simple") if planner_decision else "simple"
        )
        top_k = planner_decision.get("top_k", 5) if planner_decision else 5
        confidence = (
            planner_decision.get("confidence", 0.5) if planner_decision else 0.5
        )

        result = self.retrieve(
            query=query,
            namespace=namespace,
            strategy=strategy,
            top_k=top_k,
            query_id=query_id,
            query_type=query_type,
            confidence=confidence,
        )
        result.planner_decision = planner_decision
        return result

    @staticmethod
    def _normalize_documents(raw: list) -> List[RetrievedDocument]:
        docs: List[RetrievedDocument] = []
        for item in raw:
            if isinstance(item, RetrievedDocument):
                docs.append(item)
            elif isinstance(item, str):
                docs.append(RetrievedDocument(text=item, score=0.0))
            elif isinstance(item, tuple) and len(item) >= 2:
                docs.append(RetrievedDocument(text=str(item[0]), score=float(item[1])))
            elif isinstance(item, dict):
                docs.append(
                    RetrievedDocument(
                        text=str(item.get("text", item.get("content", str(item)))),
                        score=float(item.get("score", item.get("similarity", 0.0))),
                        source_id=str(item.get("source_id", item.get("id", ""))),
                    )
                )
        return docs
