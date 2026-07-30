"""Server startup configuration — centralised env-var reading and validation.

Provides :class:`ServerConfig` (typed dataclass populated from environment
variables with sensible development defaults) and :func:`validate_env` that
checks all required variables based on the chosen LLM provider, failing fast
with a single clear message before any infrastructure is created.

This module delegates to the Settings singleton from config.settings for
environment variable reading, ensuring a single source of truth.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Optional

from intelligence.config.settings import get_settings


def _parse_bool(value: str) -> bool:
    """Parse a boolean from environment variable. Accepts 'true', '1', 'yes' (case-insensitive)."""
    return value.strip().lower() in ("true", "1", "yes")


@dataclass
class ServerConfig:
    """All server configuration sourced from environment variables.

    Scalar fields carry a sensible local-development default where one
    exists.  Provider-specific credential fields default to ``None`` and
    must be set by the user for the chosen LLM path.

    This class delegates to the Settings singleton for actual environment
    variable reading, ensuring consistent configuration across the system.
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
        """Create ServerConfig by delegating to the Settings singleton.

        This ensures all environment variables are read through a single
        source of truth (the Settings class from config.settings).
        """
        settings = get_settings()
        return cls(
            intelligence_port=settings.intelligence_port,
            chroma_store_host=settings.chroma_store_host,
            chroma_store_port=settings.chroma_store_port,
            embedding_model=settings.embedding_model,
            chunk_size=settings.chunk_size,
            overlap=settings.overlap,
            llm_provider=settings.llm_provider,
            deployment=settings.deployment,
            mmr_retrieval_lambda=settings.mmr_retrieval_lambda,
            gemini_api_key=settings.gemini_api_key,
            gemini_model_name=settings.gemini_model_name,
            openai_api_key=settings.openai_api_key,
            openai_model_name=settings.openai_model_name,
            ollama_model_name=settings.ollama_model_name,
            ollama_url=settings.ollama_url,
            groq_api_key=settings.groq_api_key,
            groq_base_url=settings.groq_base_url,
            large_groq_model=settings.large_groq_model,
            small_groq_model=settings.small_groq_model,
            cache_maxsize=settings.cache_maxsize,
            cache_ttl_seconds=settings.cache_ttl_seconds,
            health_check_enabled=settings.health_check_enabled,
            provider_timeout_seconds=settings.provider_timeout_seconds,
            circuit_breaker_failure_threshold=settings.circuit_breaker_failure_threshold,
            circuit_breaker_recovery_timeout=settings.circuit_breaker_recovery_timeout,
            metrics_enabled=settings.metrics_enabled,
            metrics_port=settings.metrics_port,
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
            errors.append("KAIROS_OLLAMA_URL is required when KAIROS_LLM_PROVIDER=ollama")
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
