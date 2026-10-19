"""Tests for how the LLM client is built and where the circuit breaker sits.

Three things are pinned here. First, the wrapper has to work for two client
shapes: Gemini (``models.generate_content``) and the OpenAI-compatible clients
used by the ``openai``, ``groq`` and ``ollama`` providers
(``chat.completions.create``). Second, every client must be constructible
without ambient credentials: the SDK refuses to build an ``OpenAI`` client when
it finds no key at all. Third, the Ollama client's base URL must point at the
``/v1`` routes Ollama actually serves.
"""

from __future__ import annotations

import ast
from pathlib import Path
from unittest.mock import MagicMock

import pytest

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


def test_ollama_provider_builds_its_client_without_openai_api_key(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """CI has no OPENAI_API_KEY, and the SDK refuses to build a client without one.

    The ollama branch used to pass only ``base_url``, so the evaluate job died
    while the engine was being constructed.
    """
    monkeypatch.delenv("OPENAI_API_KEY", raising=False)

    from intelligence.evaluation.factory import _build_llm_client
    from intelligence.server.config import ServerConfig

    cfg = ServerConfig(
        llm_provider="ollama",
        ollama_url="http://localhost:11434",
        ollama_model_name="llama3",
    )
    client, llm_client, model_name = _build_llm_client(cfg)

    assert model_name == "llama3"
    assert llm_client is not None
    assert client.api_key == "ollama"


def test_ollama_url_is_normalized_to_the_openai_v1_routes() -> None:
    """``KAIROS_OLLAMA_URL`` is the bare server root; the SDK needs ``/v1``.

    The SDK joins request paths onto the base verbatim, so a bare
    ``http://host:11434`` sends every chat call to ``/chat/completions`` —
    a route Ollama does not serve. Go's default mux answers
    ``404 page not found`` for it, and the LLM circuit breaker opens after
    five of those, which is how every entry of the evaluate job failed.
    """
    from intelligence.server.config import ServerConfig

    assert (
        ServerConfig(ollama_url="http://localhost:11434").ollama_url
        == "http://localhost:11434/v1"
    )
    assert (
        ServerConfig(ollama_url="http://ollama:11434/").ollama_url
        == "http://ollama:11434/v1"
    )
    assert (
        ServerConfig(ollama_url="http://ollama:11434/v1").ollama_url
        == "http://ollama:11434/v1"
    )
    assert ServerConfig(ollama_url=None).ollama_url is None


def test_ollama_client_resolves_chat_calls_to_the_served_route(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """The built client must post to /v1/chat/completions, not /chat/completions."""
    monkeypatch.delenv("OPENAI_API_KEY", raising=False)

    from intelligence.evaluation.factory import _build_llm_client
    from intelligence.server.config import ServerConfig

    cfg = ServerConfig(
        llm_provider="ollama",
        ollama_url="http://localhost:11434",
        ollama_model_name="llama3",
    )
    client, _, _ = _build_llm_client(cfg)

    assert str(client.base_url).rstrip("/") == "http://localhost:11434/v1"
    assert (
        client._prepare_url("/chat/completions")
        == "http://localhost:11434/v1/chat/completions"
    )


def test_every_openai_client_is_built_with_an_api_key() -> None:
    """Guard the whole defect class, not just the branch that broke CI."""
    root = Path(__file__).resolve().parent.parent / "intelligence"
    checked = 0

    for path in root.rglob("*.py"):
        tree = ast.parse(path.read_text(encoding="utf-8"))
        for node in ast.walk(tree):
            if not isinstance(node, ast.Call):
                continue
            func = node.func
            name = (
                func.id if isinstance(func, ast.Name) else getattr(func, "attr", None)
            )
            if name != "OpenAI":
                continue
            checked += 1
            assert "api_key" in {kw.arg for kw in node.keywords}, (
                f"{path}:{node.lineno}: OpenAI() is built without an api_key"
            )

    assert checked >= 3, "expected to find the OpenAI client constructions"
