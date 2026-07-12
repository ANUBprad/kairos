from __future__ import annotations

from pathlib import Path
from typing import Optional

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_prefix="KAIROS_",
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    # --- Deployment ---------------------------------------------------
    environment: str = Field(
        default="development",
        description="Deployment environment: development, staging, production",
    )
    deployment: bool = Field(
        default=False, description="Enable production deployment mode"
    )
    log_level: str = Field(default="INFO", description="Logging level")
    config_dir: str = Field(default="", description="Path to configuration directory")

    # --- Server -------------------------------------------------------
    intelligence_port: int = Field(default=50051, description="gRPC server port")
    metrics_port: int = Field(default=8001, description="Prometheus metrics port")
    health_check_enabled: bool = Field(
        default=True, description="Enable gRPC health check"
    )

    # --- API (FastAPI management) ------------------------------------
    api_host: str = Field(default="0.0.0.0", description="REST API bind host")
    api_port: int = Field(default=8000, description="REST API bind port")
    api_workers: int = Field(default=1, description="Number of API worker processes")
    api_cors_origins: list[str] = Field(
        default=["*"], description="Allowed CORS origins"
    )
    api_rate_limit: int = Field(
        default=100, description="Default API rate limit per minute"
    )
    api_rate_limit_burst: int = Field(
        default=200, description="Default API rate limit burst"
    )
    api_secret: Optional[str] = Field(
        default=None, description="API shared secret for authentication"
    )

    # --- ChromaDB ----------------------------------------------------
    chroma_store_host: str = Field(default="localhost", description="ChromaDB host")
    chroma_store_port: int = Field(default=8000, description="ChromaDB port")

    # --- Embedding ----------------------------------------------------
    embedding_model: str = Field(
        default="local", description="Embedding provider: local, openai, gemini"
    )

    # --- LLM ----------------------------------------------------------
    llm_provider: Optional[str] = Field(
        default=None, description="LLM provider: gemini, openai, ollama"
    )
    gemini_api_key: Optional[str] = Field(default=None, description="Gemini API key")
    gemini_model_name: Optional[str] = Field(
        default=None, description="Gemini model name"
    )
    openai_api_key: Optional[str] = Field(default=None, description="OpenAI API key")
    openai_model_name: Optional[str] = Field(
        default=None, description="OpenAI model name"
    )
    ollama_model_name: Optional[str] = Field(
        default=None, description="Ollama model name"
    )
    ollama_url: Optional[str] = Field(default=None, description="Ollama base URL")
    groq_api_key: Optional[str] = Field(default=None, description="Groq API key")
    groq_base_url: Optional[str] = Field(default=None, description="Groq base URL")
    large_groq_model: Optional[str] = Field(
        default=None, description="Groq large model name"
    )
    small_groq_model: Optional[str] = Field(
        default=None, description="Groq small model name"
    )
    provider_timeout_seconds: float = Field(
        default=30.0, description="LLM provider timeout"
    )

    # --- Retrieval ----------------------------------------------------
    chunk_size: int = Field(default=1024, description="Document chunk size")
    overlap: int = Field(default=150, description="Chunk overlap")
    mmr_retrieval_lambda: float = Field(
        default=0.5, description="MMR diversity lambda (0=max div, 1=max rel)"
    )

    # --- Cache --------------------------------------------------------
    cache_maxsize: int = Field(default=4096, description="Embedding cache max entries")
    cache_ttl_seconds: int = Field(default=300, description="Embedding cache TTL")

    # --- Circuit Breaker ------------------------------------------------
    circuit_breaker_failure_threshold: int = Field(
        default=5, description="Failures before circuit opens"
    )
    circuit_breaker_recovery_timeout: float = Field(
        default=30.0, description="Seconds before half-open retry"
    )

    # --- Dashboard ----------------------------------------------------
    dashboard_port: int = Field(default=8501, description="Streamlit dashboard port")

    # --- Artifacts ----------------------------------------------------
    artifacts_dir: str = Field(
        default="./artifacts", description="Artifact storage directory"
    )
    model_registry_dir: str = Field(
        default="./models", description="Model registry directory"
    )
    experiment_registry_dir: str = Field(
        default="./experiments", description="Experiment registry directory"
    )
    report_output_dir: str = Field(
        default="./reports", description="Report output directory"
    )

    # --- Docker -------------------------------------------------------
    docker_registry: str = Field(
        default="", description="Docker registry URL for images"
    )
    image_tag: str = Field(default="latest", description="Docker image tag")

    # --- CI/CD --------------------------------------------------------
    pytest_args: str = Field(default="", description="Extra pytest arguments")
    coverage_threshold: float = Field(
        default=70.0, description="Minimum coverage percentage"
    )

    @field_validator("environment")
    @classmethod
    def validate_environment(cls, v: str) -> str:
        allowed = {"development", "staging", "production"}
        if v.lower() not in allowed:
            raise ValueError(f"environment must be one of {allowed}, got '{v}'")
        return v.lower()

    @field_validator("log_level")
    @classmethod
    def validate_log_level(cls, v: str) -> str:
        allowed = {"DEBUG", "INFO", "WARNING", "ERROR", "CRITICAL"}
        if v.upper() not in allowed:
            raise ValueError(f"log_level must be one of {allowed}, got '{v}'")
        return v.upper()

    def effective_artifacts_dir(self) -> Path:
        return Path(self.artifacts_dir)

    def effective_model_registry_dir(self) -> Path:
        return Path(self.model_registry_dir)

    def effective_experiment_registry_dir(self) -> Path:
        return Path(self.experiment_registry_dir)

    def effective_report_output_dir(self) -> Path:
        return Path(self.report_output_dir)


_settings_instance: Settings | None = None


def get_settings() -> Settings:
    global _settings_instance
    if _settings_instance is None:
        _settings_instance = Settings()
    return _settings_instance


def reset_settings() -> None:
    global _settings_instance
    _settings_instance = None
