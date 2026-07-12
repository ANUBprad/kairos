"""Server startup configuration — centralised env-var reading and validation.

Provides :class:`ServerConfig` (typed dataclass populated from environment
variables with sensible development defaults) and :func:`validate_env` that
checks all required variables based on the chosen LLM provider, failing fast
with a single clear message before any infrastructure is created.
"""

from __future__ import annotations

import os
from dataclasses import dataclass
from typing import Optional


@dataclass
class ServerConfig:
    """All server configuration sourced from environment variables.

    Scalar fields carry a sensible local-development default where one
    exists.  Provider-specific credential fields default to ``None`` and
    must be set by the user for the chosen LLM path.
    """

    intelligence_port: int = 50051
    chroma_store_host: str = "localhost"
    chroma_store_port: int = 8000
    embedding_model: str = "local"
    chunk_size: int = 1024
    overlap: int = 150
    llm_provider: Optional[str] = None
    deployment: bool = False
    mmr_retrieval_lambda: float = 0.5

    gemini_api_key: Optional[str] = None
    gemini_model_name: Optional[str] = None

    openai_api_key: Optional[str] = None
    openai_model_name: Optional[str] = None

    ollama_model_name: Optional[str] = None
    ollama_url: Optional[str] = None

    groq_api_key: Optional[str] = None
    groq_base_url: Optional[str] = None
    large_groq_model: Optional[str] = None
    small_groq_model: Optional[str] = None

    cache_maxsize: int = 4096
    cache_ttl_seconds: int = 300

    health_check_enabled: bool = True

    provider_timeout_seconds: float = 30.0
    circuit_breaker_failure_threshold: int = 5
    circuit_breaker_recovery_timeout: float = 30.0

    metrics_enabled: bool = True
    metrics_port: int = 8001

    @classmethod
    def from_env(cls) -> ServerConfig:
        return cls(
            intelligence_port=int(os.getenv("INTELLIGENCE_PORT", "50051")),
            chroma_store_host=os.getenv("CHROMA_STORE_HOST", "localhost"),
            chroma_store_port=int(os.getenv("CHROMA_STORE_PORT", "8000")),
            embedding_model=os.getenv("KAIROS_EMBEDDING_MODEL", "local"),
            chunk_size=int(os.getenv("KAIROS_CHUNK_SIZE", "1024")),
            overlap=int(os.getenv("KAIROS_OVERLAP", "150")),
            llm_provider=os.getenv("KAIROS_LLM_PROVIDER"),
            deployment=os.getenv("KAIROS_DEPLOYMENT") == "True",
            mmr_retrieval_lambda=float(os.getenv("KAIROS_MMR_RETRIEVAL_LAMBDA", "0.5")),
            gemini_api_key=os.getenv("GEMINI_API_KEY"),
            gemini_model_name=os.getenv("KAIROS_GEMINI_MODEL_NAME"),
            openai_api_key=os.getenv("OPENAI_API_KEY"),
            openai_model_name=os.getenv("KAIROS_OPENAI_MODEL_NAME"),
            ollama_model_name=os.getenv("KAIROS_OLLAMA_MODEL_NAME"),
            ollama_url=os.getenv("KAIROS_OLLAMA_URL"),
            groq_api_key=os.getenv("GROQ_API_KEY"),
            groq_base_url=os.getenv("GROQ_BASE_URL"),
            large_groq_model=os.getenv("KAIROS_LARGE_GROQ_MODEL"),
            small_groq_model=os.getenv("KAIROS_SMALL_GROQ_MODEL"),
            cache_maxsize=int(os.getenv("KAIROS_CACHE_MAXSIZE", "4096")),
            cache_ttl_seconds=int(os.getenv("KAIROS_CACHE_TTL_SECONDS", "300")),
            health_check_enabled=os.getenv("KAIROS_HEALTH_CHECK_ENABLED", "True")
            == "True",
            provider_timeout_seconds=float(
                os.getenv("KAIROS_PROVIDER_TIMEOUT_SECONDS", "30.0")
            ),
            circuit_breaker_failure_threshold=int(
                os.getenv("KAIROS_CIRCUIT_BREAKER_FAILURE_THRESHOLD", "5")
            ),
            circuit_breaker_recovery_timeout=float(
                os.getenv("KAIROS_CIRCUIT_BREAKER_RECOVERY_TIMEOUT", "30.0")
            ),
            metrics_enabled=os.getenv("KAIROS_METRICS_ENABLED", "True") == "True",
            metrics_port=int(os.getenv("KAIROS_METRICS_PORT", "8001")),
        )


def validate_env(cfg: ServerConfig) -> list[str]:
    """Check environment configuration and return a list of error messages.

    The checks follow the same priority that ``serve()`` uses to decide
    which LLM provider path to take:

    1. ``KAIROS_DEPLOYMENT=True`` → Groq (requires API key, base URL, and
       both model names).
    2. ``KAIROS_LLM_PROVIDER=gemini`` → Gemini (requires API key + model).
    3. ``KAIROS_LLM_PROVIDER=openai`` → OpenAI (requires API key + model).
    4. ``KAIROS_LLM_PROVIDER=ollama`` → Ollama (requires URL + model).
    5. Groq vars detected (``KAIROS_LARGE_GROQ_MODEL`` **and**
       ``KAIROS_SMALL_GROQ_MODEL`` set) → non-deployment Groq path.
    6. Otherwise → a general guidance error.

    Returns an empty list when the configuration is valid.
    """
    errors: list[str] = []

    if cfg.deployment:
        if not cfg.groq_api_key:
            errors.append("GROQ_API_KEY is required when KAIROS_DEPLOYMENT=True")
        if not cfg.groq_base_url:
            errors.append("GROQ_BASE_URL is required when KAIROS_DEPLOYMENT=True")
        if not cfg.large_groq_model:
            errors.append(
                "KAIROS_LARGE_GROQ_MODEL is required when KAIROS_DEPLOYMENT=True"
            )
        if not cfg.small_groq_model:
            errors.append(
                "KAIROS_SMALL_GROQ_MODEL is required when KAIROS_DEPLOYMENT=True"
            )
        return errors

    if cfg.llm_provider == "gemini":
        if not cfg.gemini_api_key:
            errors.append("GEMINI_API_KEY is required when KAIROS_LLM_PROVIDER=gemini")
        if not cfg.gemini_model_name:
            errors.append(
                "KAIROS_GEMINI_MODEL_NAME is required when KAIROS_LLM_PROVIDER=gemini"
            )
        return errors

    if cfg.llm_provider == "openai":
        if not cfg.openai_api_key:
            errors.append("OPENAI_API_KEY is required when KAIROS_LLM_PROVIDER=openai")
        if not cfg.openai_model_name:
            errors.append(
                "KAIROS_OPENAI_MODEL_NAME is required when KAIROS_LLM_PROVIDER=openai"
            )
        return errors

    if cfg.llm_provider == "ollama":
        if not cfg.ollama_model_name:
            errors.append(
                "KAIROS_OLLAMA_MODEL_NAME is required when KAIROS_LLM_PROVIDER=ollama"
            )
        if not cfg.ollama_url:
            errors.append(
                "KAIROS_OLLAMA_URL is required when KAIROS_LLM_PROVIDER=ollama"
            )
        return errors

    if cfg.large_groq_model and cfg.small_groq_model:
        if not cfg.groq_api_key:
            errors.append(
                "GROQ_API_KEY is required for non-deployment Groq configuration"
            )
        if not cfg.groq_base_url:
            errors.append(
                "GROQ_BASE_URL is required for non-deployment Groq configuration"
            )
        return errors

    errors.append(
        "No LLM provider configured. "
        "Set KAIROS_LLM_PROVIDER to 'gemini', 'openai', or 'ollama'; "
        "or set KAIROS_DEPLOYMENT=True with Groq model variables; "
        "or set KAIROS_LARGE_GROQ_MODEL and KAIROS_SMALL_GROQ_MODEL."
    )
    return errors
