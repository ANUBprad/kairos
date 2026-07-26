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
    }


@router.get("/llm")
async def get_llm_config() -> Dict[str, object]:
    settings = get_settings()
    return {
        "provider": settings.llm_provider,
        "deployment": settings.deployment,
        "timeout_seconds": settings.provider_timeout_seconds,
    }


@router.get("/retrieval")
async def get_retrieval_config() -> Dict[str, object]:
    settings = get_settings()
    return {
        "chunk_size": settings.chunk_size,
        "overlap": settings.overlap,
        "mmr_lambda": settings.mmr_retrieval_lambda,
    }
