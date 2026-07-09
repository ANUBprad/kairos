from __future__ import annotations

from collections import Counter

from typing import Dict, List, Optional

from intelligence.telemetry.models import RetrievalTelemetry


def _filter_by_event_type(
    events: List[RetrievalTelemetry],
    event_type: Optional[str] = None,
) -> List[RetrievalTelemetry]:
    """Filter events, optionally by ``event_type``.

    When *event_type* is ``None`` all events are returned unchanged.
    """
    if event_type is None:
        return events
    return [e for e in events if e.event_type == event_type]


def compute_strategy_distribution(
    events: List[RetrievalTelemetry],
    event_type: Optional[str] = None,
) -> Dict[str, int]:
    """Count how many events used each retrieval strategy.

    Args:
        events:     List of telemetry events.
        event_type: Optional filter — only events of this type are counted.

    Returns:
        Dict mapping ``retrieval_type`` → count, sorted descending.
    """
    filtered = _filter_by_event_type(events, event_type)
    counter: Counter[str] = Counter()
    for e in filtered:
        counter[e.retrieval_type] += 1
    return dict(counter.most_common())


def compute_confidence_distribution(
    events: List[RetrievalTelemetry],
    bins: Optional[List[float]] = None,
    event_type: Optional[str] = None,
) -> Dict[str, int]:
    """Group events into confidence bands.

    Args:
        events:     List of telemetry events.
        bins:       Boundaries for confidence bands.  Defaults to
                    ``[0.0, 0.5, 0.8, 1.0]`` → low / medium / high.
        event_type: Optional filter — only events of this type are counted.

    Returns:
        Dict mapping band label → count.
    """
    filtered = _filter_by_event_type(events, event_type)
    if bins is None:
        bins = [0.0, 0.5, 0.8, 1.0]

    labels = [f"{bins[i]:.1f}-{bins[i + 1]:.1f}" for i in range(len(bins) - 1)]
    counts = [0] * (len(bins) - 1)

    for e in filtered:
        for i in range(len(bins) - 1):
            if bins[i] <= e.confidence < bins[i + 1]:
                counts[i] += 1
                break

    return dict(zip(labels, counts))


def compute_fallback_rate(
    events: List[RetrievalTelemetry],
    event_type: Optional[str] = None,
) -> float:
    """Fraction of events where fallback was triggered.

    Args:
        events:     List of telemetry events.
        event_type: Optional filter — only events of this type are counted.

    Returns:
        Float in ``[0.0, 1.0]``.  Returns ``0.0`` when there are no events.
    """
    filtered = _filter_by_event_type(events, event_type)
    if not filtered:
        return 0.0
    return sum(1 for e in filtered if e.fallback_triggered) / len(filtered)


def compute_average_latency(
    events: List[RetrievalTelemetry],
    event_type: Optional[str] = None,
) -> float:
    """Average retrieval latency in milliseconds across all events.

    Args:
        events:     List of telemetry events.
        event_type: Optional filter — only events of this type are included.

    Returns:
        Mean latency in ms.  Returns ``0.0`` when there are no events.
    """
    filtered = _filter_by_event_type(events, event_type)
    if not filtered:
        return 0.0
    return sum(e.retrieval_latency_ms for e in filtered) / len(filtered)


def compute_success_rate(
    events: List[RetrievalTelemetry],
    event_type: Optional[str] = None,
) -> float:
    """Fraction of events that completed successfully.

    Args:
        events:     List of telemetry events.
        event_type: Optional filter — only events of this type are counted.

    Returns:
        Float in ``[0.0, 1.0]``.  Returns ``1.0`` when there are no events.
    """
    filtered = _filter_by_event_type(events, event_type)
    if not filtered:
        return 1.0
    return sum(1 for e in filtered if e.success) / len(filtered)
