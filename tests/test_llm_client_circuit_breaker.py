"""Tests for the circuit-breaker wrapper around an LLM client.

The wrapper has to work for two client shapes: Gemini
(``models.generate_content``) and the OpenAI-compatible clients used by the
``openai``, ``groq`` and ``ollama`` providers (``chat.completions.create``).
"""

from __future__ import annotations

from unittest.mock import MagicMock

from intelligence.server.grpc_server import _wrap_llm_client_with_cb


def _breaker() -> MagicMock:
    """A stand-in breaker that calls straight through, counting its calls."""

    breaker = MagicMock()
    breaker.call.side_effect = lambda fn, *args, **kwargs: fn(*args, **kwargs)
    return breaker


class _GeminiModels:
    def __init__(self) -> None:
        self.calls = 0

    def generate_content(self, **kwargs: object) -> str:
        self.calls += 1
        return "gemini-response"


class _GeminiClient:
    def __init__(self) -> None:
        self.models = _GeminiModels()


def test_gemini_client_is_wrapped_through_generate_content() -> None:
    client = _GeminiClient()
    breaker = _breaker()

    assert _wrap_llm_client_with_cb(client, breaker) is client

    assert client.models.generate_content(prompt="hi") == "gemini-response"
    assert client.models.calls == 1
    assert breaker.call.called, "the provider call must pass through the breaker"


def test_openai_compatible_client_is_wrapped_through_chat_completions() -> None:
    """openai/groq/ollama build an ``OpenAI`` client, which has ``models`` too.

    Selecting the Gemini branch on ``hasattr(client, "models")`` raised
    ``AttributeError`` on the OpenAI client's ``Models`` resource, so the
    server and the evaluate job died before making a single request.
    """
    from openai import OpenAI

    client = OpenAI(api_key="test-key", base_url="http://127.0.0.1:1")
    assert not hasattr(client.models, "generate_content")

    breaker = _breaker()
    assert _wrap_llm_client_with_cb(client, breaker) is client

    create = client.chat.completions.create
    assert getattr(create, "__self__", None) is None, (
        "chat.completions.create must be wrapped in the breaker passthrough"
    )
