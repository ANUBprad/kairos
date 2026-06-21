from __future__ import annotations

from typing import Dict

from fastapi import APIRouter

from intelligence.config.settings import get_settings

router = APIRouter()


@router.get("")
async def get_config_summary() -> Dict[str, object]:
    settings = get_settings()
    return {
        "environment": settings.environment,
        "deployment": settings.deployment,
        "log_level": settings.log_level,
        "llm_provider": settings.llm_provider,
        "embedding_model": settings.embedding_model,
        "api_port": settings.api_port,
        "intelligence_port": settings.intelligence_port,
        "chroma_store_host": settings.chroma_store_host,
        "chroma_store_port": settings.chroma_store_port,
        "dashboard_port": settings.dashboard_port,
        "artifacts_dir": settings.artifacts_dir,
    }


@router.get("/llm")
async def get_llm_config() -> Dict[str, object]:
    settings = get_settings()
    return {
        "provider": settings.llm_provider,
        "deployment": settings.deployment,
        "gemini_model": settings.gemini_model_name,
        "openai_model": settings.openai_model_name,
        "ollama_model": settings.ollama_model_name,
        "ollama_url": settings.ollama_url,
        "large_groq_model": settings.large_groq_model,
        "small_groq_model": settings.small_groq_model,
        "timeout_seconds": settings.provider_timeout_seconds,
    }


@router.get("/retrieval")
async def get_retrieval_config() -> Dict[str, object]:
    settings = get_settings()
    return {
        "chunk_size": settings.chunk_size,
        "overlap": settings.overlap,
        "mmr_lambda": settings.mmr_retrieval_lambda,
        "cache_maxsize": settings.cache_maxsize,
        "cache_ttl_seconds": settings.cache_ttl_seconds,
        "circuit_breaker_failure_threshold": settings.circuit_breaker_failure_threshold,
        "circuit_breaker_recovery_timeout": settings.circuit_breaker_recovery_timeout,
    }
