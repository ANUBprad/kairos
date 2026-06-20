"""Load, validate, and query the Kairos benchmark dataset.

Usage::

    from benchmarks.dataset.loader import load_dataset, dataset_summary

    entries = load_dataset()
    summary = dataset_summary(entries)
    print(f"Loaded {summary['total']} queries: {summary['type_counts']}")
"""

from __future__ import annotations

import json
import os
from dataclasses import dataclass, field
from pathlib import Path
from typing import Dict, Iterator, List, Literal, Optional

# ---------------------------------------------------------------------------
# Schema
# ---------------------------------------------------------------------------

QueryTypeStr = Literal["simple", "complex", "multi_hop"]

ConfidenceCategoryStr = Literal["high", "medium", "low"]

_QUERY_TYPE_VALUES: List[str] = ["simple", "complex", "multi_hop"]

_CONFIDENCE_CATEGORY_VALUES: List[str] = ["high", "medium", "low"]

# -- Field-name aliases for backward compatibility --------------------------

_FIELD_ALIASES: Dict[str, str] = {
    "query": "text",
    "difficulty": "query_type",
    "confidence_band": "confidence_category",
}


@dataclass(frozen=True)
class QueryEntry:
    """A single benchmark query with its expected type and metadata.

    Attributes:
        id:                Unique identifier e.g. ``"SIMPLE-001"``.
        text:              The query string (also accepted as ``"query"`` in
                           JSON).
        query_type:        One of ``"simple"``, ``"complex"``, ``"multi_hop"``
                           (also accepted as ``"difficulty"`` in JSON).
        domain:            Knowledge domain (e.g. ``"definitions"``).
        expected_chunks:   Optional list of chunk IDs that a correct system
                           should retrieve (``None`` when unlabelled).
        corpus_ref:        The source document reference (e.g.
                           ``"EU_AI_Act.pdf"``).
        expected_articles: Specific document sections the answer requires.
        confidence_category: Intended classifier confidence band:
                           ``"high"``, ``"medium"``, or ``"low"``
                           (also accepted as ``"confidence_band"`` in JSON).
        notes:             Human-readable explanation of the classification.
    """

    id: str
    text: str
    query_type: QueryTypeStr
    domain: Optional[str] = None
    expected_chunks: Optional[List[str]] = None
    corpus_ref: Optional[str] = None
    expected_articles: Optional[List[str]] = None
    confidence_category: Optional[ConfidenceCategoryStr] = None
    notes: Optional[str] = None

    @property
    def query(self) -> str:
        """Alias for ``text``."""
        return self.text

    @property
    def difficulty(self) -> str:
        """Alias for ``query_type``."""
        return self.query_type

    @property
    def confidence_band(self) -> Optional[str]:
        """Alias for ``confidence_category``."""
        return self.confidence_category


# ---------------------------------------------------------------------------
# Validation report
# ---------------------------------------------------------------------------


@dataclass
class ValidationReport:
    """Result of validating a benchmark dataset.

    Attributes:
        valid:        ``True`` when all checks pass.
        errors:       List of human-readable error messages.
        query_count:  Total number of queries.
        type_counts:  Count of queries per type.
    """

    valid: bool
    errors: List[str] = field(default_factory=list)
    query_count: int = 0
    type_counts: Dict[str, int] = field(default_factory=dict)


# ---------------------------------------------------------------------------
# Loader
# ---------------------------------------------------------------------------

_DEFAULT_PATH = Path(__file__).resolve().parent / "queries.json"


def load_dataset(
    path: Optional[os.PathLike[str]] = None,
    validate: bool = True,
    expected_counts: Optional[Dict[str, int]] = None,
) -> List[QueryEntry]:
    """Load benchmark queries from a JSON file.

    Args:
        path:            Path to ``queries.json``. Defaults to the file
                         shipped with this package.
        validate:        Run :func:`validate_dataset` after loading and
                         raise :class:`ValueError` on failure.
        expected_counts: Expected per-type query counts passed to
                         :func:`validate_dataset`.  ``None`` uses the
                         built-in default (10 each).

    Returns:
        A list of :class:`QueryEntry` objects.

    Raises:
        FileNotFoundError: The JSON file does not exist.
        json.JSONDecodeError: The file contains invalid JSON.
        ValueError: *validate=True* and validation failed.
    """
    path_obj = Path(path) if path else _DEFAULT_PATH

    with path_obj.open("r", encoding="utf-8") as f:
        raw = json.load(f)

    entries = [_raw_to_entry(item) for item in raw]

    if validate:
        report = validate_dataset(entries, expected_counts=expected_counts)
        if not report.valid:
            msg = "; ".join(report.errors)
            raise ValueError(
                f"Dataset validation failed ({len(report.errors)} errors): {msg}"
            )

    return entries


def _raw_to_entry(item: object) -> QueryEntry:
    """Convert a parsed JSON object to a QueryEntry, with basic type checks.

    Accepts both legacy field names (``text``, ``query_type``,
    ``confidence_category``) and new aliases (``query``, ``difficulty``,
    ``confidence_band``) for backward compatibility.
    """
    if not isinstance(item, dict):
        raise TypeError(
            f"Expected a JSON object, got {type(item).__name__}: {item!r}"
        )

    # -- Normalise aliased fields --
    normalised = dict(item)
    for alias, canonical in _FIELD_ALIASES.items():
        if alias in normalised and canonical not in normalised:
            normalised[canonical] = normalised.pop(alias)

    qid = _get_field(normalised, "id", str)
    text = _get_field(normalised, "text", str)
    query_type = _get_field(normalised, "query_type", str)

    if query_type not in _QUERY_TYPE_VALUES:
        raise ValueError(
            f"Entry {qid!r}: query_type {query_type!r} not in "
            f"{_QUERY_TYPE_VALUES}"
        )

    # -- Existing optional fields --
    domain = _optional_str(normalised, qid, "domain")
    expected_chunks = _optional_str_list(normalised, qid, "expected_chunks")
    notes = _optional_str(normalised, qid, "notes")

    # -- Optional fields --
    corpus_ref = _optional_str(normalised, qid, "corpus_ref")

    expected_articles = _optional_str_list(normalised, qid, "expected_articles")

    confidence_category = _optional_str(normalised, qid, "confidence_category")
    if confidence_category is not None and confidence_category not in _CONFIDENCE_CATEGORY_VALUES:
        raise ValueError(
            f"Entry {qid!r}: confidence_category {confidence_category!r} "
            f"not in {_CONFIDENCE_CATEGORY_VALUES}"
        )

    return QueryEntry(
        id=qid,
        text=text,
        query_type=query_type,  # type: ignore[arg-type]
        domain=domain,
        expected_chunks=expected_chunks,
        corpus_ref=corpus_ref,
        expected_articles=expected_articles,
        confidence_category=confidence_category,  # type: ignore[arg-type]
        notes=notes,
    )


def _get_field(item: dict, name: str, expected: type) -> object:
    """Extract *name* from *item* and check its type."""
    if name not in item:
        raise ValueError(f"Missing required field: {name!r}")
    value = item[name]
    if not isinstance(value, expected):
        raise TypeError(
            f"Field {name!r} must be {expected.__name__}, "
            f"got {type(value).__name__}: {value!r}"
        )
    return value


def _optional_str(item: dict, entry_id: str, name: str) -> Optional[str]:
    """Return the value of *name* if present, checking it is a string."""
    value = item.get(name)
    if value is not None and not isinstance(value, str):
        raise TypeError(
            f"Entry {entry_id!r}: {name!r} must be str or null, "
            f"got {type(value).__name__}"
        )
    return value


def _optional_str_list(
    item: dict, entry_id: str, name: str
) -> Optional[List[str]]:
    """Return the value of *name* if present, checking it is a list of strings."""
    value = item.get(name)
    if value is not None:
        if not isinstance(value, list) or not all(
            isinstance(c, str) for c in value
        ):
            raise TypeError(
                f"Entry {entry_id!r}: {name!r} must be a list of "
                f"strings or null"
            )
    return value


# ---------------------------------------------------------------------------
# Validation
# ---------------------------------------------------------------------------


_DEFAULT_EXPECTED_COUNTS: Dict[str, int] = {
    "simple": 10,
    "complex": 10,
    "multi_hop": 10,
}


def validate_dataset(
    entries: List[QueryEntry],
    expected_counts: Optional[Dict[str, int]] = None,
) -> ValidationReport:
    """Run all validation checks against the dataset.

    Checks performed:

    * At least one query present.
    * No duplicate IDs.
    * All ``query_type`` values are recognised.
    * Per-type query counts match *expected_counts* (defaults to
      10 per type).

    Args:
        entries:         The list of :class:`QueryEntry` objects to validate.
        expected_counts: Expected number of queries per type, keyed by
                         ``"simple"``, ``"complex"``, ``"multi_hop"``.
                         When ``None`` the built-in default (10 each) is
                         used.

    Returns:
        A :class:`ValidationReport` summarising the results.
    """
    if expected_counts is None:
        expected_counts = _DEFAULT_EXPECTED_COUNTS

    errors: List[str] = []
    type_counts: Dict[str, int] = {}

    if not entries:
        errors.append("Dataset is empty")

    seen_ids: set[str] = set()
    for entry in entries:
        # Duplicate IDs
        if entry.id in seen_ids:
            errors.append(f"Duplicate ID: {entry.id!r}")
        seen_ids.add(entry.id)

        # Track type counts
        if entry.query_type in _QUERY_TYPE_VALUES:
            type_counts[entry.query_type] = (
                type_counts.get(entry.query_type, 0) + 1
            )
        else:
            errors.append(
                f"Entry {entry.id!r}: unrecognised query_type "
                f"{entry.query_type!r}"
            )

    # Check per-type counts
    for qt, expected in expected_counts.items():
        actual = type_counts.get(qt, 0)
        if actual != expected:
            errors.append(
                f"Expected {expected} {qt!r} queries, got {actual}"
            )

    return ValidationReport(
        valid=len(errors) == 0,
        errors=errors,
        query_count=len(entries),
        type_counts=type_counts,
    )


# ---------------------------------------------------------------------------
# Convenience utilities
# ---------------------------------------------------------------------------


def get_by_type(
    entries: List[QueryEntry],
    query_type: str,
) -> List[QueryEntry]:
    """Filter entries matching a specific query type.

    Args:
        entries:    The full dataset.
        query_type: One of ``"simple"``, ``"complex"``, ``"multi_hop"``.

    Returns:
        Matching entries in insertion order.
    """
    return [e for e in entries if e.query_type == query_type]


def dataset_summary(entries: List[QueryEntry]) -> Dict[str, object]:
    """Return a comprehensive summary of the dataset.

    Args:
        entries: The full dataset.

    Returns:
        A dictionary with keys ``total``, ``type_counts``,
        ``confidence_distribution``, ``article_coverage``, and ``domains``.
    """
    type_counts: Dict[str, int] = {}
    conf_counts: Dict[str, int] = {}
    article_refs: Dict[str, int] = {}
    domains: set[str] = set()

    for e in entries:
        type_counts[e.query_type] = type_counts.get(e.query_type, 0) + 1
        if e.domain:
            domains.add(e.domain)
        if e.confidence_category:
            conf_counts[e.confidence_category] = (
                conf_counts.get(e.confidence_category, 0) + 1
            )
        if e.expected_articles:
            for art in e.expected_articles:
                article_refs[art] = article_refs.get(art, 0) + 1

    return {
        "total": len(entries),
        "type_counts": dict(sorted(type_counts.items())),
        "confidence_distribution": dict(sorted(conf_counts.items())),
        "article_coverage": {
            "unique_articles": len(article_refs),
            "total_references": sum(article_refs.values()),
            "most_referenced": sorted(
                article_refs.items(), key=lambda x: -x[1]
            )[:10],
        },
        "domains": sorted(domains),
    }


def iter_entries(entries: List[QueryEntry]) -> Iterator[QueryEntry]:
    """Yield entries one at a time (API consistency)."""
    yield from entries


# ---------------------------------------------------------------------------
# Statistics report
# ---------------------------------------------------------------------------


def generate_statistics(entries: List[QueryEntry]) -> str:
    """Produce a human-readable dataset statistics report.

    Args:
        entries: The full dataset.

    Returns:
        A formatted string with query count, difficulty distribution,
        article coverage, and confidence-band distribution.
    """
    summary = dataset_summary(entries)
    lines: list[str] = [
        "=" * 60,
        "  Dataset Statistics Report",
        "=" * 60,
        "",
        f"  Total queries:      {summary['total']}",
        "",
        "  Difficulty distribution:",
    ]
    for qt, cnt in summary["type_counts"].items():  # type: ignore[union-attr]
        lines.append(f"    {qt:12s}  {cnt}")
    lines.append("")
    lines.append("  Confidence-band distribution:")
    for band, cnt in summary["confidence_distribution"].items():  # type: ignore[union-attr]
        lines.append(f"    {band:12s}  {cnt}")
    lines.append("")
    ac = summary["article_coverage"]  # type: ignore[assignment]
    lines.append(f"  Article coverage:")
    lines.append(f"    Unique articles:       {ac['unique_articles']}")
    lines.append(f"    Total references:      {ac['total_references']}")
    lines.append("    Most referenced:")
    for art, count in ac["most_referenced"]:
        lines.append(f"      {art:40s}  {count}")
    lines.append("")
    if summary["domains"]:
        lines.append(f"  Domains: {', '.join(summary['domains'])}")
    return "\n".join(lines)
