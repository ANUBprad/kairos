from __future__ import annotations

import time
from typing import Any, Dict, List, Optional

from intelligence.retrieval.real_retriever import RealRetriever
from intelligence.retrieval.retrieval_result import RetrievalResult


class RetrievalExecutor:
    def __init__(
        self,
        retriever: RealRetriever,
        namespace: str = "default",
        enable_planning: bool = True,
    ) -> None:
        self._retriever = retriever
        self._namespace = namespace
        self._enable_planning = enable_planning

    def execute(
        self,
        query: str,
        query_id: str = "",
        query_type: str = "",
        strategy: str = "",
        top_k: int = 5,
        **kwargs: Any,
    ) -> RetrievalResult:
        if self._enable_planning and not strategy:
            result = self._retriever.plan_and_retrieve(
                query=query,
                namespace=self._namespace,
                query_id=query_id,
                query_type=query_type,
                **kwargs,
            )
        else:
            result = self._retriever.retrieve(
                query=query,
                namespace=self._namespace,
                strategy=strategy,
                top_k=top_k,
                query_id=query_id,
                query_type=query_type,
            )
        return result

    def execute_batch(
        self,
        queries: List[Dict[str, Any]],
    ) -> List[RetrievalResult]:
        results: List[RetrievalResult] = []
        for q in queries:
            result = self.execute(
                query=q.get("query", ""),
                query_id=q.get("query_id", ""),
                query_type=q.get("query_type", ""),
                strategy=q.get("strategy", ""),
                top_k=q.get("top_k", 5),
            )
            results.append(result)
        return results

    @property
    def namespace(self) -> str:
        return self._namespace

    @namespace.setter
    def namespace(self, value: str) -> None:
        self._namespace = value

    @property
    def enable_planning(self) -> bool:
        return self._enable_planning

    @enable_planning.setter
    def enable_planning(self, value: bool) -> None:
        self._enable_planning = value
