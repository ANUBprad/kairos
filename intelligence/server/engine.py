from __future__ import annotations

import logging
from typing import Union

from intelligence.classifier.query_classifier import ClassifyQuery
from intelligence.embeddings.base_embedder import BaseEmbedder
from intelligence.ingestion.pipeline import IngestionPipeline
from intelligence.llm.gemini_llm import GeminiLLM
from intelligence.llm.openai_llm import OpenaiLLM
from intelligence.planner import FallbackManager
from intelligence.planner.retrieval_planner import RetrievalPlanner
from intelligence.retrieval.complex_retriever import ComplexRetriever
from intelligence.retrieval.multihop_retriever import MultiHopRetriever
from intelligence.circuit_breaker.circuit_breaker import CircuitBreaker
from intelligence.metrics.prometheus_metrics import (
    planner_decisions_total,
    retrieval_duration_seconds,
    fallback_total,
)
from intelligence.retrieval.simple_retriever import SimpleRetriever
from intelligence.telemetry.collector import TelemetryCollector

logger = logging.getLogger(__name__)


class RetrievalEngine:
    """Orchestrates retrieval, classification, and planning logic.

    Separated from gRPC concerns so it can be tested independently of the
    transport layer.  The servicer delegates all RPC bodies here.
    """

    def __init__(
        self,
        pipeline: IngestionPipeline,
        classifier: ClassifyQuery,
        simple_retriever: SimpleRetriever,
        complex_retriever: ComplexRetriever,
        multi_hop_retriever: MultiHopRetriever,
        embedder: BaseEmbedder,
        llm_client: Union[GeminiLLM, OpenaiLLM],
        llm_circuit_breaker: CircuitBreaker | None = None,
        chroma_circuit_breaker: CircuitBreaker | None = None,
        telemetry_collector: TelemetryCollector | None = None,
    ):
        self.pipeline = pipeline
        self.classifier = classifier
        self.simple = simple_retriever
        self.complex = complex_retriever
        self.multi_hop = multi_hop_retriever
        self.llm_client = llm_client
        self.embedder = embedder
        self.planner = RetrievalPlanner(classifier=classifier)
        self.llm_circuit_breaker = llm_circuit_breaker
        self.chroma_circuit_breaker = chroma_circuit_breaker
        self._telemetry = telemetry_collector
        self._last_decision: dict | None = None

    def compute_embeddings(self, query: str) -> list[float]:
        return self.embedder.embed(query)

    def classify_query(self, query: str) -> dict:
        decision = self.planner.plan(query)
        self._last_decision = {
            "query": query,
            "query_type": decision.query_type.upper(),
            "confidence": decision.confidence,
            "retrieval_type": decision.config["retrieval_type"],
            "top_k": decision.config["top_k"],
            "rerank": decision.config["rerank"],
            "decompose": decision.config["decompose"],
        }
        import rag_pb2 as _pb2

        _rt = decision.config["retrieval_type"]
        _cb = (
            "high"
            if decision.confidence >= 0.8
            else "medium"
            if decision.confidence >= 0.5
            else "low"
        )
        planner_decisions_total.labels(
            query_type=decision.query_type.upper(),
            confidence_band=_cb,
        ).inc()
        retrieval_type = _pb2.RetrievalType.Value(_rt)
        query_type = _pb2.QueryType.Value(decision.query_type.upper())

        if self._telemetry:
            self._telemetry.record_retrieval(
                query=query,
                query_type=decision.query_type.upper(),
                confidence=decision.confidence,
                retrieval_type=_rt,
                top_k=decision.config["top_k"],
                rerank=decision.config["rerank"],
                decompose=decision.config["decompose"],
                event_type="classification",
            )

        return {
            "query_type": query_type,
            "retrieval_type": retrieval_type,
            "top_k": decision.config["top_k"],
            "rerank": decision.config["rerank"],
            "decompose": decision.config["decompose"],
            "confidence_score": decision.confidence,
        }

    def retrieve(
        self,
        namespace: str,
        query: str,
        top_k: int,
        retrieval_type: int,
        rerank: bool = False,
        decompose: bool = False,
    ) -> tuple[list[str], int]:
        import rag_pb2 as _pb

        if retrieval_type in (
            _pb.RetrievalType.HYBRID,
            _pb.RetrievalType.RETRIEVAL_TYPE_UNSPECIFIED,
        ):
            return self.simple.retrieve_top_k(namespace, top_k, query), retrieval_type
        elif retrieval_type == _pb.RetrievalType.MULTI_VECTOR:
            return self.complex.retrieve_top_k(
                namespace,
                top_k,
                query,
                rerank=rerank,
                decompose=decompose,
            ), retrieval_type
        elif retrieval_type == _pb.RetrievalType.SELF_QUERYING:
            return self.multi_hop.retrieve_top_k(
                namespace, top_k, query
            ), retrieval_type
        else:
            raise ValueError(f"Unknown retrieval type: {retrieval_type}")

    def execute_retrieval(
        self,
        namespace: str,
        query: str,
        top_k: int,
        retrieval_type: int,
        rerank: bool = False,
        decompose: bool = False,
    ) -> dict:
        import time as _time
        import rag_pb2 as _pb

        _start = _time.monotonic()
        chunks, used_type = self.retrieve(
            namespace,
            query,
            top_k,
            retrieval_type,
            rerank=rerank,
            decompose=decompose,
        )

        fb = FallbackManager.evaluate(
            config={
                "retrieval_type": _pb.RetrievalType.Name(used_type),
                "top_k": top_k,
            },
            chunk_count=len(chunks),
        )

        fallback_triggered = False
        escalated_tier_str = ""

        if fb.should_fallback and fb.escalated_tier:
            fallback_triggered = True
            escalated_tier_str = fb.escalated_tier
            escalated_type = self._tier_to_pb_type(fb.escalated_tier)
            extra_chunks, _ = self.retrieve(
                namespace,
                query,
                top_k,
                escalated_type,
                rerank=True,
                decompose=True,
            )
            fallback_total.labels(
                escalated_tier=escalated_tier_str,
            ).inc()
            seen = set()
            combined = []
            for c in chunks + extra_chunks:
                if c not in seen:
                    seen.add(c)
                    combined.append(c)
            chunks = combined

        _elapsed = _time.monotonic() - _start
        retrieval_duration_seconds.labels(
            retrieval_type=_pb.RetrievalType.Name(used_type),
        ).observe(_elapsed)

        if self._telemetry:
            _ctx = self._last_decision or {}
            self._telemetry.record_retrieval(
                query=query,
                query_type=_ctx.get("query_type", "UNKNOWN"),
                confidence=_ctx.get("confidence", 0.0),
                retrieval_type=_pb.RetrievalType.Name(used_type),
                top_k=top_k,
                rerank=rerank,
                decompose=decompose,
                event_type="retrieval",
                retrieved_chunks=len(chunks),
                retrieval_latency_ms=_elapsed * 1000.0,
                fallback_triggered=fallback_triggered,
                fallback_reason=escalated_tier_str if fallback_triggered else None,
                success=True,
            )

        logger.info(
            "Retrieval executed",
            extra={
                "retrieval_type": _pb.RetrievalType.Name(used_type),
                "top_k": top_k,
                "rerank": rerank,
                "decompose": decompose,
                "chunk_count": len(chunks),
                "fallback_triggered": fallback_triggered,
                "escalated_tier": escalated_tier_str,
            },
        )

        return {
            "chunks": chunks,
            "used_type": used_type,
            "fallback_triggered": fallback_triggered,
            "escalated_tier_str": escalated_tier_str,
        }

    def generate_response(self, query: str, chunks: list[str]) -> dict:
        response = self.llm_client.get_response(query, chunks)
        return {
            "response": response["response"],
            "prompt_tokens": response["prompt_tokens"],
            "completion_tokens": response["completion_tokens"],
            "model": response["model"],
        }

    def ingest_document(
        self,
        content: bytes,
        namespace: str,
        strategy: int,
        mime_type: str,
        filename: str,
    ) -> int:
        return self.pipeline.compute(content, namespace, strategy, mime_type, filename)

    @staticmethod
    def _tier_to_pb_type(tier: str) -> int:
        import rag_pb2 as _pb

        mapping = {
            "simple": _pb.RetrievalType.HYBRID,
            "complex": _pb.RetrievalType.MULTI_VECTOR,
            "multi_hop": _pb.RetrievalType.SELF_QUERYING,
        }
        return mapping[tier]
