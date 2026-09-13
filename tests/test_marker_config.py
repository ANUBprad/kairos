"""Guard the performance-test profile configuration.

``pytest tests/`` must stay a deterministic correctness suite, so the
wall-clock latency/stress tests are marked ``performance`` and excluded by
default via ``addopts``, while ``pytest -m performance`` still selects them.
These pins fail if the registration, the default exclusion, or the
classification of the wall-clock tests regress.
"""

from __future__ import annotations

import types


def _mark_names(obj) -> set[str]:
    if isinstance(obj, types.FunctionType):
        return {m.name for m in getattr(obj, "pytestmark", ())}
    marks = getattr(obj, "pytestmark", None)
    if marks is None:
        return set()
    if not isinstance(marks, (list, tuple)):
        marks = (marks,)
    return {getattr(m, "name", str(m)) for m in marks}


def test_performance_marker_registered(pytestconfig) -> None:
    registered = {line.partition(":")[0] for line in pytestconfig.getini("markers")}
    assert "performance" in registered


def test_default_suite_excludes_performance(pytestconfig) -> None:
    addopts = " ".join(pytestconfig.getini("addopts"))
    assert "not performance" in addopts


def test_wall_clock_tests_carry_performance_marker() -> None:
    from tests.benchmarks.test_retrieval_adversarial import (
        TestPerformanceStress,
        TestRerankerAdversarial,
    )
    from tests.benchmarks.test_retrieval_integration import TestPerformanceBaseline

    for cls in (TestPerformanceStress, TestPerformanceBaseline):
        assert "performance" in _mark_names(cls), cls.__name__
    latency = TestRerankerAdversarial.test_reranker_latency
    assert "performance" in _mark_names(latency), "test_reranker_latency"
