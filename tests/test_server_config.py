"""Tests for server startup configuration and environment validation."""

from __future__ import annotations

import os
from unittest.mock import patch

import pytest

_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
_intelligence = os.path.join(_root, "intelligence")
_generated = os.path.join(_root, "generated", "python")
for p in [_root, _intelligence, _generated]:
    if p not in os.sys.path:
        os.sys.path.insert(0, p)

from intelligence.server.config import ServerConfig, validate_env  # noqa: E402


# ======================================================================
# ServerConfig.from_env
# ======================================================================


class TestServerConfigFromEnv:
    """Default values and env-var overrides."""

    def test_defaults_are_sensible(self) -> None:
        config = ServerConfig.from_env()
        assert config.intelligence_port == 50051
        assert config.chroma_store_host == "localhost"
        assert config.chroma_store_port == 8000
        assert config.mmr_retrieval_lambda == 0.5
        assert config.chunk_size == 1024
        assert config.overlap == 150
        assert config.embedding_model == "local"
        assert config.deployment is False

    def test_llm_provider_defaults_to_none(self) -> None:
        config = ServerConfig.from_env()
        assert config.llm_provider is None

    def test_provider_specific_vars_default_to_none(self) -> None:
        _keys = [
            "OPENAI_API_KEY",
            "KEIRO_OPENAI_MODEL_NAME",
            "GEMINI_API_KEY",
            "KEIRO_GEMINI_MODEL_NAME",
            "KEIRO_OLLAMA_MODEL_NAME",
            "KEIRO_OLLAMA_URL",
            "GROQ_API_KEY",
            "GROQ_BASE_URL",
            "KEIRO_LARGE_GROQ_MODEL",
            "KEIRO_SMALL_GROQ_MODEL",
        ]
        _removed = {k: os.environ.pop(k) for k in _keys if k in os.environ}
        try:
            config = ServerConfig.from_env()
        finally:
            os.environ.update(_removed)
        assert config.gemini_api_key is None
        assert config.gemini_model_name is None
        assert config.openai_api_key is None
        assert config.openai_model_name is None
        assert config.ollama_model_name is None
        assert config.ollama_url is None
        assert config.groq_api_key is None
        assert config.groq_base_url is None
        assert config.large_groq_model is None
        assert config.small_groq_model is None

    def test_reads_intelligence_port(self) -> None:
        with patch.dict(os.environ, {"INTELLIGENCE_PORT": "9090"}):
            config = ServerConfig.from_env()
            assert config.intelligence_port == 9090

    def test_reads_chroma_settings(self) -> None:
        with patch.dict(
            os.environ,
            {
                "CHROMA_STORE_HOST": "10.0.0.1",
                "CHROMA_STORE_PORT": "9001",
            },
        ):
            config = ServerConfig.from_env()
            assert config.chroma_store_host == "10.0.0.1"
            assert config.chroma_store_port == 9001

    def test_reads_mmr_lambda(self) -> None:
        with patch.dict(os.environ, {"KEIRO_MMR_RETRIEVAL_LAMBDA": "0.7"}):
            config = ServerConfig.from_env()
            assert config.mmr_retrieval_lambda == 0.7

    def test_reads_deployment_flag(self) -> None:
        with patch.dict(os.environ, {"KEIRO_DEPLOYMENT": "True"}):
            config = ServerConfig.from_env()
            assert config.deployment is True

    def test_deployment_false_by_default(self) -> None:
        config = ServerConfig.from_env()
        assert config.deployment is False

    def test_partial_groq_vars(self) -> None:
        with patch.dict(os.environ, {"GROQ_API_KEY": "sk-test"}):
            config = ServerConfig.from_env()
            assert config.groq_api_key == "sk-test"
            assert config.large_groq_model is None
            assert config.small_groq_model is None


# ======================================================================
# validate_env — deployment path (Groq)
# ======================================================================


class TestValidateEnvDeployment:
    """KEIRO_DEPLOYMENT=True requires complete Groq configuration."""

    def test_valid_deployment(self) -> None:
        cfg = ServerConfig(
            deployment=True,
            groq_api_key="sk-test",
            groq_base_url="https://api.groq.com/openai/v1",
            large_groq_model="mixtral-8x7b",
            small_groq_model="llama2-7b",
        )
        assert validate_env(cfg) == []

    def test_missing_groq_api_key(self) -> None:
        cfg = ServerConfig(
            deployment=True,
            groq_base_url="https://api.groq.com/openai/v1",
            large_groq_model="mixtral-8x7b",
            small_groq_model="llama2-7b",
        )
        errors = validate_env(cfg)
        assert any("GROQ_API_KEY" in e for e in errors)

    def test_missing_groq_base_url(self) -> None:
        cfg = ServerConfig(
            deployment=True,
            groq_api_key="sk-test",
            large_groq_model="mixtral-8x7b",
            small_groq_model="llama2-7b",
        )
        errors = validate_env(cfg)
        assert any("GROQ_BASE_URL" in e for e in errors)

    def test_missing_large_groq_model(self) -> None:
        cfg = ServerConfig(
            deployment=True,
            groq_api_key="sk-test",
            groq_base_url="https://api.groq.com/openai/v1",
            small_groq_model="llama2-7b",
        )
        errors = validate_env(cfg)
        assert any("KEIRO_LARGE_GROQ_MODEL" in e for e in errors)

    def test_missing_small_groq_model(self) -> None:
        cfg = ServerConfig(
            deployment=True,
            groq_api_key="sk-test",
            groq_base_url="https://api.groq.com/openai/v1",
            large_groq_model="mixtral-8x7b",
        )
        errors = validate_env(cfg)
        assert any("KEIRO_SMALL_GROQ_MODEL" in e for e in errors)

    def test_all_errors_returned_at_once(self) -> None:
        cfg = ServerConfig(deployment=True)
        errors = validate_env(cfg)
        assert len(errors) == 4


# ======================================================================
# validate_env — Gemini path
# ======================================================================


class TestValidateEnvGemini:
    """KEIRO_LLM_PROVIDER=gemini requires API key and model name."""

    def test_valid_gemini(self) -> None:
        cfg = ServerConfig(
            llm_provider="gemini",
            gemini_api_key="AIza-test",
            gemini_model_name="gemini-2.0-flash",
        )
        assert validate_env(cfg) == []

    def test_missing_gemini_api_key(self) -> None:
        cfg = ServerConfig(
            llm_provider="gemini",
            gemini_model_name="gemini-2.0-flash",
        )
        errors = validate_env(cfg)
        assert any("GEMINI_API_KEY" in e for e in errors)

    def test_missing_gemini_model_name(self) -> None:
        cfg = ServerConfig(
            llm_provider="gemini",
            gemini_api_key="AIza-test",
        )
        errors = validate_env(cfg)
        assert any("KEIRO_GEMINI_MODEL_NAME" in e for e in errors)


# ======================================================================
# validate_env — OpenAI path
# ======================================================================


class TestValidateEnvOpenAI:
    """KEIRO_LLM_PROVIDER=openai requires API key and model name."""

    def test_valid_openai(self) -> None:
        cfg = ServerConfig(
            llm_provider="openai",
            openai_api_key="sk-test",
            openai_model_name="gpt-4o",
        )
        assert validate_env(cfg) == []

    def test_missing_openai_api_key(self) -> None:
        cfg = ServerConfig(
            llm_provider="openai",
            openai_model_name="gpt-4o",
        )
        errors = validate_env(cfg)
        assert any("OPENAI_API_KEY" in e for e in errors)

    def test_missing_openai_model_name(self) -> None:
        cfg = ServerConfig(
            llm_provider="openai",
            openai_api_key="sk-test",
        )
        errors = validate_env(cfg)
        assert any("KEIRO_OPENAI_MODEL_NAME" in e for e in errors)


# ======================================================================
# validate_env — Ollama path
# ======================================================================


class TestValidateEnvOllama:
    """KEIRO_LLM_PROVIDER=ollama requires model name and URL."""

    def test_valid_ollama(self) -> None:
        cfg = ServerConfig(
            llm_provider="ollama",
            ollama_model_name="llama3.2",
            ollama_url="http://localhost:11434",
        )
        assert validate_env(cfg) == []

    def test_missing_ollama_model_name(self) -> None:
        cfg = ServerConfig(
            llm_provider="ollama",
            ollama_url="http://localhost:11434",
        )
        errors = validate_env(cfg)
        assert any("KEIRO_OLLAMA_MODEL_NAME" in e for e in errors)

    def test_missing_ollama_url(self) -> None:
        cfg = ServerConfig(
            llm_provider="ollama",
            ollama_model_name="llama3.2",
        )
        errors = validate_env(cfg)
        assert any("KEIRO_OLLAMA_URL" in e for e in errors)


# ======================================================================
# validate_env — Non-deployment Groq path
# ======================================================================


class TestValidateEnvGroqLocal:
    """Non-deployment Groq detected via large + small model vars."""

    def test_valid_groq_local(self) -> None:
        cfg = ServerConfig(
            large_groq_model="mixtral-8x7b",
            small_groq_model="llama2-7b",
            groq_api_key="sk-test",
            groq_base_url="https://api.groq.com/openai/v1",
        )
        assert validate_env(cfg) == []

    def test_missing_groq_api_key_local(self) -> None:
        cfg = ServerConfig(
            large_groq_model="mixtral-8x7b",
            small_groq_model="llama2-7b",
        )
        errors = validate_env(cfg)
        assert any("GROQ_API_KEY" in e for e in errors)

    def test_missing_groq_base_url_local(self) -> None:
        cfg = ServerConfig(
            large_groq_model="mixtral-8x7b",
            small_groq_model="llama2-7b",
            groq_api_key="sk-test",
        )
        errors = validate_env(cfg)
        assert any("GROQ_BASE_URL" in e for e in errors)

    def test_only_large_model_set_does_not_match_groq(self) -> None:
        cfg = ServerConfig(
            llm_provider="gemini",
            gemini_api_key="AIza-test",
            gemini_model_name="gemini-2.0-flash",
            large_groq_model="mixtral-8x7b",
        )
        assert validate_env(cfg) == []


# ======================================================================
# validate_env — No provider configured
# ======================================================================


class TestValidateEnvNoProvider:
    """When no provider is configured, a guidance error is returned."""

    def test_no_provider_returns_guidance(self) -> None:
        cfg = ServerConfig()
        errors = validate_env(cfg)
        assert len(errors) == 1
        assert "No LLM provider configured" in errors[0]

    def test_empty_config_returns_guidance(self) -> None:
        cfg = ServerConfig(llm_provider=None)
        errors = validate_env(cfg)
        assert len(errors) == 1


# ======================================================================
# serve() validation integration
# ======================================================================


class TestServeValidation:
    """serve() raises ValueError when validation fails."""

    def test_raises_on_missing_provider(self) -> None:
        _provider_keys = [
            "KEIRO_LLM_PROVIDER",
            "KEIRO_DEPLOYMENT",
            "KEIRO_LARGE_GROQ_MODEL",
            "KEIRO_SMALL_GROQ_MODEL",
        ]
        with patch.dict(os.environ, {k: "" for k in _provider_keys}):
            from intelligence.server.grpc_server import serve

            with pytest.raises(ValueError, match="No LLM provider configured"):
                serve()

    def test_raises_on_missing_deployment_vars(self) -> None:
        with patch.dict(os.environ, {"KEIRO_DEPLOYMENT": "True"}, clear=False):
            from intelligence.server.grpc_server import serve

            with pytest.raises(ValueError, match="missing or invalid configuration"):
                serve()
