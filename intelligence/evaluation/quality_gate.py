"""Quality gates over evaluation run aggregates.

Modeled after Prisma ``QualityGate.conditions`` and the portal's
``apps/portal/src/lib/quality-gates.ts``: a gate is a list of conditions on
metric keys (matching :func:`intelligence.evaluation.regression.snapshot`
flattened aggregates) with ``gt``/``gte``/``lt``/``lte``/``eq``/``neq``
operators. Gates apply to eval/publish/release time only, never production
traffic. Pure stdlib; no new dependencies.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Dict, List

from intelligence.evaluation.regression import snapshot as aggregate_metrics

_OPERATORS = ("gt", "gte", "lt", "lte", "eq", "neq")


@dataclass(frozen=True)
class QualityGateCondition:
    metric: str
    operator: str
    value: float

    def __post_init__(self) -> None:
        if self.operator not in _OPERATORS:
            raise ValueError(
                f"Unsupported operator {self.operator!r}; "
                f"expected one of {', '.join(_OPERATORS)}"
            )


@dataclass(frozen=True)
class ConditionResult:
    metric: str
    operator: str
    threshold: float
    actual: float
    passed: bool


@dataclass(frozen=True)
class GateCheckResult:
    passed: bool
    results: List[ConditionResult]
    score: float

    def to_dict(self) -> Dict[str, object]:
        return {
            "passed": self.passed,
            "score": self.score,
            "results": [
                {
                    "metric": r.metric,
                    "operator": r.operator,
                    "threshold": r.threshold,
                    "actual": r.actual,
                    "passed": r.passed,
                }
                for r in self.results
            ],
        }


def _apply(operator: str, actual: float, threshold: float) -> bool:
    if operator == "gt":
        return actual > threshold
    if operator == "gte":
        return actual >= threshold
    if operator == "lt":
        return actual < threshold
    if operator == "lte":
        return actual <= threshold
    if operator == "eq":
        return actual == threshold
    if operator == "neq":
        return actual != threshold
    return False


def check_gate(
    conditions: List[QualityGateCondition],
    metrics: Dict[str, float],
) -> GateCheckResult:
    """Evaluate all conditions against a flat aggregate metric map.

    A condition whose metric is missing from the run fails (mirrors the
    portal's ``NaN``/``passed: false`` behavior). The gate passes only when
    every condition passes and at least one condition is present.
    """
    results: List[ConditionResult] = []
    for condition in conditions:
        actual = metrics.get(condition.metric)
        if actual is None:
            results.append(
                ConditionResult(
                    metric=condition.metric,
                    operator=condition.operator,
                    threshold=condition.value,
                    actual=0.0,
                    passed=False,
                )
            )
            continue
        results.append(
            ConditionResult(
                metric=condition.metric,
                operator=condition.operator,
                threshold=condition.value,
                actual=actual,
                passed=_apply(condition.operator, actual, condition.value),
            )
        )

    passed = bool(results) and all(r.passed for r in results)
    score = sum(1 for r in results if r.passed) / len(results) if results else 0.0
    return GateCheckResult(passed=passed, results=results, score=score)


def check_gate_on_run(
    conditions: List[QualityGateCondition],
    result,
) -> GateCheckResult:
    """Evaluate gate conditions against a :class:`RunResult`.

    Accepts any object with ``to_dict()`` returning run aggregates (e.g.
    :class:`intelligence.evaluation.entry_result.RunResult`).
    """
    return check_gate(conditions, aggregate_metrics(result))
