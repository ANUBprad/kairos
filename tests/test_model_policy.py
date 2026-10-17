"""P2: the model-identifier policy that gates every provider call.

Both the chat path (``validate_env`` -> ``serve``) and the judge path
(``_build_llm_client``) build a client from an env-supplied model name. A
malformed value must be a configuration error raised *before* any provider
client is created, and an accepted value must be forwarded unchanged — never
swapped for a different model.
"""

from __future__ import annotations

from typing import Any, Optional

import pytest

from intelligence.config.validation import validate_config
from intelligence.config.settings import Settings
from intelligence.evaluation.factory import _build_llm_client
from intelligence.llm.model_policy import (
    is_model_allowed,
    model_error,
    validate_model,
)
from intelligence.server.config import ServerConfig, validate_env

# Every family this repository ships or tests today. A regression here means an
# existing supported configuration would be refused at startup.
APPROVED: list[tuple[str, str]] = [
    ("gemini", "gemini-2.0-flash"),
    ("gemini", "gemini-1.5-pro"),
    ("gemini", "gemini-pro"),
    ("gemini", "models/gemini-1.5-flash"),
    ("openai", "gpt-4o"),
    ("openai", "gpt-4o-mini"),
    ("openai", "gpt-4"),
    ("openai", "gpt-3.5-turbo"),
    ("openai", "o1-mini"),
    ("openai", "o3-mini"),
    ("openai", "chatgpt-4o-latest"),
    ("ollama", "llama3"),
    ("ollama", "llama2"),
    ("ollama", "llama3.2:8b"),
    ("ollama", "qwen2.5:7b-instruct"),
    ("ollama", "meta-llama/Llama-3-8B"),
    ("groq", "mixtral-8x7b"),
    ("groq", "llama3-70b"),
    ("groq", "llama-3.1-8b-instant"),
]

REJECTED: list[tuple[str, Optional[Any]]] = [
    ("gemini", None),
    ("gemini", ""),
    ("gemini", "gemini"),
    ("gemini", "gpt-4o"),
    ("openai", "claude-3-opus"),
    ("openai", "gpt-4o "),
    ("openai", " gpt-4o"),
    ("openai", "gpt-4o\n"),
    ("openai", 42),
    ("ollama", "llama3; rm -rf /"),
    ("ollama", "llama 3"),
    ("groq", "llama3-70b\x00"),
    ("groq", "a" * 200),
    ("anthropic", "claude-3"),
]


@pytest.mark.parametrize("provider,model", APPROVED)
def test_approved_models_pass(provider: str, model: str) -> None:
    assert is_model_allowed(provider, model) is True
    assert model_error(provider, model, "KAIROS_MODEL") is None
    # Forwarded unchanged: no silent substitution for a different model.
    assert validate_model(provider, model, "KAIROS_MODEL") == model


@pytest.mark.parametrize("provider,model", REJECTED)
def test_rejected_models_fail(provider: str, model: Optional[Any]) -> None:
    assert is_model_allowed(provider, model) is False
    error = model_error(provider, model, "KAIROS_MODEL")
    assert error is not None
    assert "KAIROS_MODEL" in error
    with pytest.raises(ValueError, match="not an approved"):
        validate_model(provider, model, "KAIROS_MODEL")


def test_unknown_provider_is_named_in_error() -> None:
    error = model_error("anthropic", "claude-3", "KAIROS_LLM_PROVIDER")
    assert error is not None
    assert "anthropic" in error


def test_validate_env_flags_a_malformed_model() -> None:
    cfg = ServerConfig(
        llm_provider="openai",
        openai_api_key="sk-test",
        openai_model_name="not a model",
    )
    assert any("KAIROS_OPENAI_MODEL_NAME" in e for e in validate_env(cfg))


def test_validate_env_accepts_a_supported_model() -> None:
    cfg = ServerConfig(
        llm_provider="ollama",
        ollama_model_name="llama3.2",
        ollama_url="http://localhost:11434",
    )
    assert validate_env(cfg) == []


def test_validate_config_flags_a_malformed_model() -> None:
    settings = Settings(
        llm_provider="gemini",
        gemini_api_key="AIza-test",
        gemini_model_name="gpt-4o",
    )
    assert any("KAIROS_GEMINI_MODEL_NAME" in e for e in validate_config(settings))


def test_validate_config_accepts_a_supported_model() -> None:
    settings = Settings(
        llm_provider="gemini",
        gemini_api_key="AIza-test",
        gemini_model_name="gemini-2.0-flash",
    )
    assert validate_config(settings) == []


def test_build_llm_client_rejects_before_creating_a_provider(monkeypatch) -> None:
    import openai

    called: list[dict] = []

    def _spy(**kwargs):
        called.append(kwargs)
        raise AssertionError("provider client must not be constructed")

    monkeypatch.setattr(openai, "OpenAI", _spy)
    cfg = ServerConfig(
        llm_provider="openai",
        openai_api_key="sk-test",
        openai_model_name="gpt-4o; DROP TABLE",
    )

    with pytest.raises(ValueError, match="KAIROS_OPENAI_MODEL_NAME"):
        _build_llm_client(cfg)
    assert called == [], "no provider client may be created for a rejected model"


def test_build_llm_client_forwards_valid_model_unchanged(monkeypatch) -> None:
    import openai

    created: list[dict] = []

    class _FakeOpenAI:
        def __init__(self, **kwargs):
            created.append(kwargs)

    monkeypatch.setattr(openai, "OpenAI", _FakeOpenAI)
    cfg = ServerConfig(
        llm_provider="openai",
        openai_api_key="sk-test",
        openai_model_name="gpt-4o",
    )

    client, llm_client, model = _build_llm_client(cfg)
    assert isinstance(client, _FakeOpenAI)
    assert model == "gpt-4o"
    assert llm_client.model == "gpt-4o"
