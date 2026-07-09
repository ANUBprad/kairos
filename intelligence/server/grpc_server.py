import logging

from dotenv import load_dotenv
from google import genai
from sentence_transformers import CrossEncoder
from openai import OpenAI

from intelligence.cache.embedding_cache import EmbeddingCache
from intelligence.circuit_breaker.circuit_breaker import (
    CircuitBreaker,
    CircuitState,
)
from intelligence.embeddings.cached_embedder import CachedEmbedder
from intelligence.embeddings.local_embedder import LocalEmbedder
from intelligence.ingestion.chunker import Chunker
from intelligence.ingestion.pipeline import IngestionPipeline
from intelligence.llm.gemini_llm import GeminiLLM
from intelligence.llm.openai_llm import OpenaiLLM
from intelligence.metrics.prometheus_metrics import (
    MetricsInterceptor,
    start_metrics_server,
    circuit_breaker_state,
    health_status,
    cache_hits_total,
    cache_misses_total,
)
from intelligence.reranker.cross_encoder_reranker import CrossEncoderReranker
from intelligence.retrieval.complex_retriever import ComplexRetriever
from intelligence.retrieval.multihop_retriever import MultiHopRetriever
from intelligence.retrieval.simple_retriever import SimpleRetriever
from intelligence.vectorstore.chroma_store import ChromaStore
from intelligence.classifier.query_classifier import ClassifyQuery
from intelligence.server.config import ServerConfig, validate_env
from intelligence.server.engine import RetrievalEngine
from intelligence.telemetry import TelemetryCollector, TelemetryStorage
from intelligence.server.health import HealthServicer, add_health_servicer_to_server

import grpc
from generated.python import rag_pb2
from generated.python import rag_pb2_grpc
from concurrent import futures

logger = logging.getLogger(__name__)


class IntelligenceServiceServicer(rag_pb2_grpc.IntelligenceServiceServicer):
    """gRPC servicer that delegates all business logic to RetrievalEngine."""

    def __init__(self, engine: RetrievalEngine):
        self._engine = engine

    def ComputeEmbeddings(self, request, context):
        try:
            embeddings = self._engine.compute_embeddings(request.user_query)
            return rag_pb2.ComputeEmbeddingResponse(vector_embeddings=embeddings)
        except Exception as e:
            context.set_code(grpc.StatusCode.INTERNAL)
            context.set_details(str(e))
            return rag_pb2.ComputeEmbeddingResponse()

    def ClassifyQueryType(self, request, context):
        try:
            result = self._engine.classify_query(request.user_query)
            return rag_pb2.ClassifyQueryResponse(
                query_type=result["query_type"],
                config=rag_pb2.RetrievalConfig(
                    retrieval_type=result["retrieval_type"],
                    top_k=result["top_k"],
                    rerank=result["rerank"],
                    decompose=result["decompose"],
                ),
                confidence_score=result["confidence_score"],
            )
        except Exception as e:
            context.set_code(grpc.StatusCode.INTERNAL)
            context.set_details(str(e))
            return rag_pb2.ClassifyQueryResponse()

    def ExecuteRetrieval(self, request, context):
        try:
            result = self._engine.execute_retrieval(
                namespace=request.namespace,
                query=request.user_query,
                top_k=request.received_config.top_k,
                retrieval_type=request.received_config.retrieval_type,
                rerank=request.received_config.rerank,
                decompose=request.received_config.decompose,
            )
            retrieved_chunks = [
                rag_pb2.RetrievedChunk(
                    text=chunk,
                    metadata={},
                    similarity_score=0.0,
                    source_id="",
                )
                for chunk in result["chunks"]
            ]
            return rag_pb2.ExecuteRetrievalResponse(
                retrieved_chunk=retrieved_chunks,
                retrieval_status=True,
            )
        except ValueError as e:
            context.set_code(grpc.StatusCode.INTERNAL)
            context.set_details(str(e))
            return rag_pb2.ExecuteRetrievalResponse(retrieval_status=False)

    def GenerateResponse(self, request, context):
        result = self._engine.generate_response(
            query=request.user_query,
            chunks=[chunk.text for chunk in request.retrieved_chunk],
        )
        return rag_pb2.GeneratedResponse(
            response=result["response"],
            prompt_tokens=result["prompt_tokens"],
            completion_tokens=result["completion_tokens"],
            model=result["model"],
        )

    def IngestDocument(self, request, context):
        try:
            chunk_count = self._engine.ingest_document(
                content=request.doc_content,
                namespace=request.namespace,
                strategy=request.chunking_strategy,
                mime_type=request.mime_type,
                filename=request.filename,
            )
            return rag_pb2.IngestDocumentResponse(
                embedding_status=True,
                chunk_count=chunk_count,
            )
        except ValueError as e:
            context.set_code(grpc.StatusCode.INTERNAL)
            context.set_details(str(e))
            return rag_pb2.IngestDocumentResponse()


load_dotenv()


def _create_embedder(cfg: ServerConfig):
    if cfg.embedding_model in ("local", None):
        inner = LocalEmbedder()
        if cfg.metrics_enabled:
            cache = EmbeddingCache(
                maxsize=cfg.cache_maxsize,
                ttl_seconds=cfg.cache_ttl_seconds,
                on_hit=lambda: cache_hits_total.labels(cache="embedding").inc(),
                on_miss=lambda: cache_misses_total.labels(cache="embedding").inc(),
            )
        else:
            cache = EmbeddingCache(
                maxsize=cfg.cache_maxsize,
                ttl_seconds=cfg.cache_ttl_seconds,
            )
        cached = CachedEmbedder(inner=inner, cache=cache)
        return cached
    return None


def _make_cb_on_change(name: str):
    def _on_change(state: CircuitState) -> None:
        circuit_breaker_state.labels(breaker_name=name).set(
            1
            if state == CircuitState.CLOSED
            else 2
            if state == CircuitState.HALF_OPEN
            else 3
        )

    return _on_change


def _wrap_llm_client_with_cb(client, breaker):
    if hasattr(client, "models"):
        models = client.models
        orig = models.generate_content
        models.generate_content = lambda *a, **kw: breaker.call(orig, *a, **kw)
    elif hasattr(client, "chat"):
        completions = client.chat.completions
        orig = completions.create
        completions.create = lambda *a, **kw: breaker.call(orig, *a, **kw)
    return client


def _wrap_chroma_with_cb(store, breaker):
    for method_name in ("query", "upsert", "get_all_chunks"):
        orig = getattr(store, method_name)

        def _make_wrapper(fn):
            return lambda *a, **kw: breaker.call(fn, *a, **kw)

        setattr(store, method_name, _make_wrapper(orig))
    return store


def _build_engine(
    store,
    embedder,
    client,
    llm_client,
    cfg,
    classifier_model_name,
    retriever_model_name,
    llm_circuit_breaker=None,
    chroma_circuit_breaker=None,
    telemetry_collector=None,
) -> RetrievalEngine:
    simple_retriever = SimpleRetriever(store=store, embedder=embedder)
    classifier = ClassifyQuery(
        client=client,
        model_name=classifier_model_name,
        model_provider=cfg.llm_provider,
    )
    cross_encoder_model = CrossEncoder("cross-encoder/ms-marco-MiniLM-L6-v2")
    cross_encoder = CrossEncoderReranker(cross_encoding_model=cross_encoder_model)
    complex_retriever = ComplexRetriever(
        store=store,
        embedder=embedder,
        client=client,
        cross_encoder=cross_encoder,
        model_name=retriever_model_name,
        mmr_lambda=cfg.mmr_retrieval_lambda,
        model_provider=cfg.llm_provider,
    )
    multi_hop_retriever = MultiHopRetriever(
        embedder=embedder,
        store=store,
        client=client,
        model_name=retriever_model_name,
        num_hops=3,
        model_provider=cfg.llm_provider,
    )
    return RetrievalEngine(
        pipeline=IngestionPipeline(
            embedder, Chunker(embedder, cfg.chunk_size, cfg.overlap), store
        ),
        classifier=classifier,
        simple_retriever=simple_retriever,
        complex_retriever=complex_retriever,
        multi_hop_retriever=multi_hop_retriever,
        embedder=embedder,
        llm_client=llm_client,
        llm_circuit_breaker=llm_circuit_breaker,
        chroma_circuit_breaker=chroma_circuit_breaker,
        telemetry_collector=telemetry_collector,
    )


def _register_server(
    server, engine, cfg, health: HealthServicer | None = None, telemetry_collector=None
):
    servicer = IntelligenceServiceServicer(engine=engine)
    rag_pb2_grpc.add_IntelligenceServiceServicer_to_server(servicer, server)
    if health is not None:
        add_health_servicer_to_server(health, server)
        health_status.labels(service="").set(1)
    server.add_insecure_port(f"0.0.0.0:{cfg.intelligence_port}")
    logger.info(f"Starting the server at port 0.0.0.0:{cfg.intelligence_port}")
    server.start()
    try:
        server.wait_for_termination()
    finally:
        if telemetry_collector is not None:
            telemetry_collector.close()


def serve():
    cfg = ServerConfig.from_env()

    missing = validate_env(cfg)
    if missing:
        raise ValueError(
            "Server startup failed -- missing or invalid configuration:\n"
            + "\n".join(f"  - {m}" for m in missing)
        )

    store = ChromaStore(host=cfg.chroma_store_host, port=cfg.chroma_store_port)
    embedder = _create_embedder(cfg)

    # --- Circuit breakers -------------------------------------------------
    llm_breaker = CircuitBreaker(
        failure_threshold=cfg.circuit_breaker_failure_threshold,
        recovery_timeout=cfg.circuit_breaker_recovery_timeout,
        name="llm",
        on_state_change=_make_cb_on_change("llm"),
    )
    chroma_breaker = CircuitBreaker(
        failure_threshold=cfg.circuit_breaker_failure_threshold,
        recovery_timeout=cfg.circuit_breaker_recovery_timeout,
        name="chroma",
        on_state_change=_make_cb_on_change("chroma"),
    )

    # --- Telemetry collector ---------------------------------------------
    telemetry_collector = TelemetryCollector(storage=TelemetryStorage())

    # --- Metrics interceptor & server ------------------------------------
    interceptor = MetricsInterceptor() if cfg.metrics_enabled else None
    interceptors = [interceptor] if interceptor else []
    server = grpc.server(
        futures.ThreadPoolExecutor(max_workers=10),
        interceptors=interceptors,
    )

    health = HealthServicer() if cfg.health_check_enabled else None
    if health is not None:
        health.set_global_serving()

    if cfg.deployment:
        if cfg.large_groq_model and cfg.small_groq_model:
            client = OpenAI(
                api_key=cfg.groq_api_key,
                base_url=cfg.groq_base_url,
                timeout=cfg.provider_timeout_seconds,
            )
            client = _wrap_llm_client_with_cb(client, llm_breaker)
            llm_client = OpenaiLLM(client=client, model_name=cfg.large_groq_model)
            store = _wrap_chroma_with_cb(store, chroma_breaker)
            engine = _build_engine(
                store,
                embedder,
                client,
                llm_client,
                cfg,
                classifier_model_name=cfg.large_groq_model,
                retriever_model_name=cfg.small_groq_model,
                llm_circuit_breaker=llm_breaker,
                chroma_circuit_breaker=chroma_breaker,
                telemetry_collector=telemetry_collector,
            )
            _register_server(
                server,
                engine,
                cfg,
                health=health,
                telemetry_collector=telemetry_collector,
            )
        else:
            raise ValueError(
                f"Unsupported LLM provider: {cfg.llm_provider}. "
                "Must be 'gemini' or 'openai'"
            )
    else:
        if cfg.llm_provider == "gemini":
            client = genai.Client(api_key=cfg.gemini_api_key)
            llm_client = GeminiLLM(client=client, model_name=cfg.gemini_model_name)
            model_name = cfg.gemini_model_name

        elif cfg.llm_provider == "openai":
            client = OpenAI(
                api_key=cfg.openai_api_key, timeout=cfg.provider_timeout_seconds
            )
            llm_client = OpenaiLLM(client=client, model_name=cfg.openai_model_name)
            model_name = cfg.openai_model_name

        elif cfg.llm_provider == "ollama":
            client = OpenAI(
                base_url=cfg.ollama_url, timeout=cfg.provider_timeout_seconds
            )
            llm_client = OpenaiLLM(client=client, model_name=cfg.ollama_model_name)
            model_name = cfg.ollama_model_name

        elif cfg.large_groq_model and cfg.small_groq_model:
            client = OpenAI(
                api_key=cfg.groq_api_key,
                base_url=cfg.groq_base_url,
                timeout=cfg.provider_timeout_seconds,
            )
            llm_client = OpenaiLLM(client=client, model_name=cfg.large_groq_model)
            model_name = cfg.large_groq_model

        else:
            raise ValueError(
                f"Unsupported LLM provider: {cfg.llm_provider}. "
                "Must be 'gemini', 'openai', or 'ollama'"
            )

        client = _wrap_llm_client_with_cb(client, llm_breaker)
        store = _wrap_chroma_with_cb(store, chroma_breaker)
        engine = _build_engine(
            store,
            embedder,
            client,
            llm_client,
            cfg,
            classifier_model_name=model_name,
            retriever_model_name=model_name,
            llm_circuit_breaker=llm_breaker,
            chroma_circuit_breaker=chroma_breaker,
            telemetry_collector=telemetry_collector,
        )

        if cfg.metrics_enabled:
            start_metrics_server(cfg.metrics_port)

        _register_server(
            server, engine, cfg, health=health, telemetry_collector=telemetry_collector
        )


if __name__ == "__main__":
    serve()
