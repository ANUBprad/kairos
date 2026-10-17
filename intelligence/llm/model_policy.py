"""Centralised LLM model-identifier policy.

Both the chat path (:mod:`intelligence.server.grpc_server`) and the judge path
(:mod:`intelligence.evaluation.factory`) build their provider client from an
environment-supplied model name. Those names are free text, so validate them
before any provider client is created: a malformed value is a configuration
error, never something to forward to a provider or silently swap for another
model.

The hosted providers are checked against approved model *families* (prefixes),
not an exact snapshot, because the vendors add models faster than this repository
ships; the goal is to reject malformed or injected values and unknown providers,
not to pin the catalogue. Ollama and Groq serve arbitrary open-weight tags, so a
conservative tag grammar stands in for a closed list there.

Every model identifier this repository ships or tests today (``gemini-*``,
``gpt-*``, ``o1``/``o3``, ``llama3``, ``llama3.2:8b``, ``mixtral-8x7b``,
``llama3-70b``, ``llama-3.1-8b-instant``, ...) passes this policy, so existing
supported configurations are unaffected.
"""

from __future__ import annotations

import re
from typing import Iterable, Optional

# Conservative tag grammar for local / open-weight models: llama3,
# llama3.2:8b, qwen2.5:7b-instruct, mixtral-8x7b, meta-llama/Llama-3-8B,
# llama-3.1-8b-instant. Bounded length, no whitespace, controls, or metacharacters.
_TAG = re.compile(r"^[A-Za-z0-9][A-Za-z0-9._:/@\-]{0,127}$")

MODEL_FAMILIES: dict[str, tuple[re.Pattern[str], ...]] = {
    "gemini": (re.compile(r"^(?:models/)?gemini-[A-Za-z0-9.\-]{1,64}$"),),
    "openai": (re.compile(r"^(?:gpt-|o[1-9]|chatgpt-)[A-Za-z0-9.\-]{0,64}$"),),
    "ollama": (_TAG,),
    "groq": (_TAG,),
}

_SUPPORTED = ", ".join(sorted(MODEL_FAMILIES))


def is_model_allowed(provider: str, model: Optional[str]) -> bool:
    """True when *model* is an approved identifier for *provider*.

    Non-string, empty, and whitespace-padded values are rejected, as are unknown
    providers, so a value is never treated as safe merely because it came from a
    configuration file or database column.
    """
    if not isinstance(model, str) or not model:
        return False
    patterns = MODEL_FAMILIES.get(provider)
    if patterns is None:
        return False
    return any(pattern.fullmatch(model) for pattern in patterns)


def model_error(provider: str, model: Optional[str], env_var: str) -> Optional[str]:
    """Return a configuration-error string when *model* is not approved."""
    if is_model_allowed(provider, model):
        return None
    return (
        f"{env_var}={model!r} is not an approved {provider} model identifier "
        f"(supported providers: {_SUPPORTED})"
    )


def model_errors(pairs: Iterable[tuple[str, Optional[str], str]]) -> list[str]:
    """Model-identifier errors for (provider, model, env_var) triples.

    A missing model is reported by the caller's "required" check, so only
    present-but-malformed values produce an error here.
    """
    errors: list[str] = []
    for provider, model, env_var in pairs:
        if model:
            error = model_error(provider, model, env_var)
            if error:
                errors.append(error)
    return errors


def validate_model(provider: str, model: Optional[str], env_var: str) -> str:
    """Return *model* unchanged when approved, otherwise raise ``ValueError``.

    Called at the point of provider construction so the judge path — which does
    not run the ``serve()`` environment check — is covered too.
    """
    error = model_error(provider, model, env_var)
    if error is not None:
        raise ValueError(error)
    assert isinstance(model, str)
    return model
