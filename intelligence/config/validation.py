from __future__ import annotations

from typing import List, Optional

from intelligence.config.environments import EnvironmentProfile, get_environment_profile
from intelligence.config.settings import Settings


class ConfigValidationError(Exception):
    def __init__(self, errors: List[str]) -> None:
        self.errors = errors
        super().__init__("\n".join(f"  - {e}" for e in errors))


def validate_config(settings: Settings) -> List[str]:
    errors: List[str] = []

    profile = get_environment_profile(settings.environment)

    if profile.is_production:
        if not settings.api_secret:
            errors.append("api_secret is required in production")
        if settings.embedding_model == "local":
            errors.append("local embedding model is not recommended in production; set KEIRO_EMBEDDING_MODEL to 'openai' or 'gemini'")
        if settings.llm_provider is None:
            errors.append("llm_provider is required in production")
        if settings.circuit_breaker_failure_threshold < 1:
            errors.append("circuit_breaker_failure_threshold must be >= 1 in production")

    if settings.deployment:
        if not settings.groq_api_key:
            errors.append("GROQ_API_KEY is required when deployment=True")
        if not settings.groq_base_url:
            errors.append("GROQ_BASE_URL is required when deployment=True")
        if not settings.large_groq_model:
            errors.append("KEIRO_LARGE_GROQ_MODEL is required when deployment=True")
        if not settings.small_groq_model:
            errors.append("KEIRO_SMALL_GROQ_MODEL is required when deployment=True")
        return errors

    if settings.llm_provider == "gemini":
        if not settings.gemini_api_key:
            errors.append("GEMINI_API_KEY is required when KEIRO_LLM_PROVIDER=gemini")
        if not settings.gemini_model_name:
            errors.append("KEIRO_GEMINI_MODEL_NAME is required when KEIRO_LLM_PROVIDER=gemini")
        return errors

    if settings.llm_provider == "openai":
        if not settings.openai_api_key:
            errors.append("OPENAI_API_KEY is required when KEIRO_LLM_PROVIDER=openai")
        if not settings.openai_model_name:
            errors.append("KEIRO_OPENAI_MODEL_NAME is required when KEIRO_LLM_PROVIDER=openai")
        return errors

    if settings.llm_provider == "ollama":
        if not settings.ollama_model_name:
            errors.append("KEIRO_OLLAMA_MODEL_NAME is required when KEIRO_LLM_PROVIDER=ollama")
        if not settings.ollama_url:
            errors.append("KEIRO_OLLAMA_URL is required when KEIRO_LLM_PROVIDER=ollama")
        return errors

    if settings.large_groq_model and settings.small_groq_model:
        if not settings.groq_api_key:
            errors.append("GROQ_API_KEY is required for Groq configuration")
        if not settings.groq_base_url:
            errors.append("GROQ_BASE_URL is required for Groq configuration")
        return errors

    if not errors and settings.llm_provider is None:
        errors.append(
            "No LLM provider configured. "
            "Set KEIRO_LLM_PROVIDER to 'gemini', 'openai', or 'ollama'; "
            "or set KEIRO_DEPLOYMENT=True with Groq model variables; "
            "or set KEIRO_LARGE_GROQ_MODEL and KEIRO_SMALL_GROQ_MODEL."
        )

    return errors


def validate_config_or_raise(settings: Optional[Settings] = None) -> None:
    if settings is None:
        from intelligence.config.settings import get_settings
        settings = get_settings()
    errors = validate_config(settings)
    if errors:
        raise ConfigValidationError(errors)
