from __future__ import annotations

"""In-process evaluation runner construction.

Builds the production :class:`RetrievalEngine` and an :class:`EvaluationRunner`
from environment configuration, so the REST API and the CLI can run golden
datasets end to end without going through gRPC. Heavy constructors are imported
lazily so that importing this module stays cheap.
"""

from typing import Optional

from intelligence.evaluation.entry_result import RunResult
from intelligence.evaluation.run_config import RunConfig
from intelligence.judging.judge import CompositeJudge


def _build_judge(use_llm_judges: bool, llm_client) -> Optional[CompositeJudge]:
    composite = CompositeJudge()
    from intelligence.judging.faithfulness import FaithfulnessJudge
    from intelligence.judging.grounding import GroundingJudge
    from intelligence.judging.hallucination import HallucinationJudge
    from intelligence.judging.relevance import RelevanceJudge

    composite.add_judge(FaithfulnessJudge())
    composite.add_judge(RelevanceJudge())
    composite.add_judge(HallucinationJudge())
    composite.add_judge(GroundingJudge())

    if use_llm_judges:
        if llm_client is None:
            raise ValueError("LLM judges requested but no LLM client is configured")
        from intelligence.judging.llm import (
            AnswerRelevancyLLMJudge,
            CorrectnessLLMJudge,
            FaithfulnessLLMJudge,
        )

        composite.add_judge(FaithfulnessLLMJudge(llm_client))
        composite.add_judge(AnswerRelevancyLLMJudge(llm_client))
        composite.add_judge(CorrectnessLLMJudge(llm_client))

    return composite


def _build_engine(cfg):
    from intelligence.server.grpc_server import (
        _build_engine as _grpc_build_engine,
        _create_embedder,
        _wrap_chroma_with_cb,
        _wrap_llm_client_with_cb,
    )
    from intelligence.circuit_breaker.circuit_breaker import CircuitBreaker
    from intelligence.vectorstore.chroma_store import ChromaStore

    store = ChromaStore(host=cfg.chroma_store_host, port=cfg.chroma_store_port)
    embedder = _create_embedder(cfg)

    llm_breaker = CircuitBreaker(
        failure_threshold=cfg.circuit_breaker_failure_threshold,
        recovery_timeout=cfg.circuit_breaker_recovery_timeout,
        name="llm",
    )
    chroma_breaker = CircuitBreaker(
        failure_threshold=cfg.circuit_breaker_failure_threshold,
        recovery_timeout=cfg.circuit_breaker_recovery_timeout,
        name="chroma",
    )

    client, llm_client, model_name = _build_llm_client(cfg)

    client = _wrap_llm_client_with_cb(client, llm_breaker)
    store = _wrap_chroma_with_cb(store, chroma_breaker)

    return _grpc_build_engine(
        store,
        embedder,
        client,
        llm_client,
        cfg,
        classifier_model_name=model_name,
        retriever_model_name=model_name,
        llm_circuit_breaker=llm_breaker,
        chroma_circuit_breaker=chroma_breaker,
        telemetry_collector=None,
    )


def _build_llm_client(cfg):
    """Mirror the ``serve()`` provider selection branch (same precedence)."""
    if cfg.llm_provider == "gemini":
        from google import genai
        from google.genai import types as genai_types

        from intelligence.llm.gemini_llm import GeminiLLM

        client = genai.Client(
            api_key=cfg.gemini_api_key,
            http_options=genai_types.HttpOptions(
                timeout=int(cfg.provider_timeout_seconds * 1000)
            ),
        )
        return (
            client,
            GeminiLLM(client=client, model_name=cfg.gemini_model_name),
            cfg.gemini_model_name,
        )

    if cfg.llm_provider == "openai":
        from openai import OpenAI

        from intelligence.llm.openai_llm import OpenaiLLM

        client = OpenAI(
            api_key=cfg.openai_api_key, timeout=cfg.provider_timeout_seconds
        )
        return (
            client,
            OpenaiLLM(client=client, model_name=cfg.openai_model_name),
            cfg.openai_model_name,
        )

    if cfg.llm_provider == "ollama":
        from openai import OpenAI

        from intelligence.llm.openai_llm import OpenaiLLM

        client = OpenAI(
            base_url=cfg.ollama_url, timeout=cfg.provider_timeout_seconds
        )
        return (
            client,
            OpenaiLLM(client=client, model_name=cfg.ollama_model_name),
            cfg.ollama_model_name,
        )

    if cfg.large_groq_model and cfg.small_groq_model:
        from openai import OpenAI

        from intelligence.llm.openai_llm import OpenaiLLM

        client = OpenAI(
            api_key=cfg.groq_api_key,
            base_url=cfg.groq_base_url,
            timeout=cfg.provider_timeout_seconds,
        )
        return (
            client,
            OpenaiLLM(client=client, model_name=cfg.large_groq_model),
            cfg.large_groq_model,
        )

    raise ValueError(
        f"No usable LLM provider configured (llm_provider={cfg.llm_provider!r})"
    )


def build_evaluation_runner(
    config: RunConfig,
    *,
    use_llm_judges: bool = False,
):
    """Build a runner wired to the production engine for the given config."""
    from intelligence.evaluation.runner import EvaluationRunner
    from intelligence.server.config import ServerConfig

    cfg = ServerConfig.from_env()
    engine = _build_engine(cfg)

    llm_client = engine.llm_client if use_llm_judges else None
    judge = _build_judge(use_llm_judges, llm_client)
    return EvaluationRunner(engine=engine, config=config, judge=judge)


def run_dataset(
    config: RunConfig,
    *,
    dataset_path: Optional[str] = None,
    use_llm_judges: bool = False,
) -> RunResult:
    """Load a dataset and run it through the production pipeline."""
    from benchmarks.dataset.loader import load_dataset

    runner = build_evaluation_runner(config, use_llm_judges=use_llm_judges)
    entries = load_dataset(path=dataset_path)
    return runner.run(entries)