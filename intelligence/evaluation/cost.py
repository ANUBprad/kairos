from __future__ import annotations

"""Per-token cost estimation for evaluation entries.

Pricing is driven by model name + measured token counts; unknown models
fall back to a default rate so cost is always recorded. Ollama models
are priced at zero (self-hosted, free per-token).
"""

# USD per 1M tokens: input, output. Source: public list prices 2026.
_PRICES_PER_MTOK = {
    "gpt-4o": (2.50, 10.00),
    "gpt-4o-mini": (0.15, 0.60),
    "gpt-4": (30.00, 60.00),
    "gpt-3.5-turbo": (0.50, 1.50),
    "gemini-2.0-flash": (0.10, 0.40),
    "gemini-1.5-flash": (0.075, 0.30),
    "gemini-1.5-pro": (1.25, 5.00),
    "llama-3.1-8b-instant": (0.05, 0.08),
    "llama3-8b": (0.05, 0.08),
    "llama3-70b": (0.59, 0.79),
    "llama3.3-70b": (0.59, 0.79),
}

_DEFAULT_PER_MTOK = (2.50, 10.00)


def _per_mtok(model: str) -> tuple[float, float]:
    if _is_self_hosted(model):
        return (0.0, 0.0)
    exact = _PRICES_PER_MTOK.get(model)
    if exact is not None:
        return exact
    return _DEFAULT_PER_MTOK


def _is_self_hosted(model: str) -> bool:
    lowered = model.lower()
    if "ollama" in lowered:
        return True
    if ":" in lowered:
        return True  # ollama tags: llama3:8b, llama3:latest, ...
    if lowered == "llama3":
        return True  # bare tag used by the docker-e2e / CI ollama provider
    return False


def estimate_cost(model: str, prompt_tokens: int, completion_tokens: int) -> float:
    """Estimated USD cost of one LLM interaction."""
    input_price, output_price = _per_mtok(model)
    return (prompt_tokens / 1_000_000) * input_price + (
        completion_tokens / 1_000_000
    ) * output_price