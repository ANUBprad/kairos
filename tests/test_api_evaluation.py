"""Tests for the evaluation REST API and runner factory (Phase C).

Light-import layer checks only: the heavy engine is monkeypatched away so the
suite does not require TensorFlow, Chroma, or a live LLM provider.
"""

from __future__ import annotations

from fastapi.testclient import TestClient
from pytest import MonkeyPatch

from intelligence.api.app import create_app
from intelligence.evaluation.entry_result import EntryResult, RunResult
from intelligence.evaluation.factory import _build_judge, _build_llm_client
from intelligence.evaluation.run_config import RunConfig
from intelligence.server.config import ServerConfig

SAMPLE_RESULT = RunResult(
    results=(
        EntryResult(
            entry_id="SIMPLE-001",
            query="what is an AI system?",
            query_type="simple",
            retrieved_chunks=("c1", "c2"),
            retrieval_type="simple",
            generated_answer="An AI system is a machine-based system.",
            prompt_tokens=10,
            completion_tokens=5,
            model="llama3",
            cost_usd=0.0001,
            trace_id="deadbeef",
            recall=1.0,
            precision=0.5,
            judge_scores={"faithfulness": 0.9},
            composite_judge_score=0.9,
        ),
    )
)


def _client() -> TestClient:
    return TestClient(create_app())


def test_evaluate_validation_errors() -> None:
    client = _client()

    resp = client.post(
        "/api/v1/evaluation/evaluate", json={"retrieved": [], "relevant": []}
    )
    assert resp.status_code == 400

    resp = client.post(
        "/api/v1/evaluation/evaluate",
        json={"retrieved": [["a"]], "relevant": [["a"], ["b"]]},
    )
    assert resp.status_code == 400


def test_evaluate_array_math() -> None:
    client = _client()
    resp = client.post(
        "/api/v1/evaluation/evaluate",
        json={"retrieved": [["a", "b", "c"]], "relevant": [["b", "c"]]},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["mean_precision"] == 2 / 3


def test_run_endpoint_wires_to_runner(monkeypatch: MonkeyPatch) -> None:
    from intelligence.evaluation import factory

    captured: dict[str, object] = {}

    def fake_run_dataset(config: RunConfig, dataset_path=None, use_llm_judges=False):
        captured["config"] = config
        captured["use_llm_judges"] = use_llm_judges
        return SAMPLE_RESULT

    monkeypatch.setattr(factory, "run_dataset", fake_run_dataset)

    client = _client()
    resp = client.post(
        "/api/v1/evaluation/run",
        json={
            "namespace": "ns1",
            "dataset_name": "golden",
            "top_k": 3,
            "max_entries": 5,
            "use_llm_judges": True,
        },
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["total"] == 1
    assert data["succeeded"] == 1
    assert data["trace_id"] == "deadbeef"
    assert data["mean_recall"] == 1.0

    cfg = captured["config"]
    assert isinstance(cfg, RunConfig)
    assert cfg.namespace == "ns1"
    assert cfg.dataset_name == "golden"
    assert cfg.top_k == 3
    assert cfg.max_entries == 5
    assert captured["use_llm_judges"] is True


def test_build_judge_algorithmic_only() -> None:
    from intelligence.evaluation.factory import _build_judge

    judge = _build_judge(use_llm_judges=False, llm_client=None)
    assert {j.dimension for j in judge.judges} == {
        "faithfulness",
        "relevance",
        "hallucination",
        "grounding",
    }


def test_build_judge_requires_llm_client_for_llm_judges() -> None:
    try:
        _build_judge(use_llm_judges=True, llm_client=None)
    except ValueError:
        return
    raise AssertionError("expected ValueError for LLM judges without a client")


def test_build_llm_client_no_provider() -> None:
    cfg = ServerConfig()
    assert cfg.llm_provider is None and cfg.large_groq_model is None
    try:
        _build_llm_client(cfg)
    except ValueError:
        return
    raise AssertionError("expected ValueError for unconfigured LLM provider")
