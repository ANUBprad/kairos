"""Unit tests for benchmarks.dataset.loader."""

from __future__ import annotations

import json
import os
import tempfile
from pathlib import Path

import pytest

from benchmarks.dataset.loader import (
    QueryEntry,
    ValidationReport,
    _QUERY_TYPE_VALUES,
    _raw_to_entry,
    dataset_summary,
    get_by_type,
    iter_entries,
    load_dataset,
    validate_dataset,
)

# ======================================================================
# Fixtures
# ======================================================================


@pytest.fixture
def three_entries() -> list[dict]:
    return [
        {
            "id": "SIMPLE-001",
            "text": "What is the capital of France?",
            "query_type": "simple",
            "domain": "geography",
            "expected_chunks": None,
            "notes": "Single fact.",
        },
        {
            "id": "COMPLEX-001",
            "text": "Compare microservices and monoliths.",
            "query_type": "complex",
            "domain": "software",
            "expected_chunks": ["doc-a", "doc-b"],
            "notes": "Comparison.",
        },
        {
            "id": "MULTIHOP-001",
            "text": "Multi-hop query.",
            "query_type": "multi_hop",
            "domain": "history",
            "expected_chunks": None,
            "notes": None,
        },
    ]


@pytest.fixture
def ten_per_type() -> list[dict]:
    """Build 30 entries (10 per type) for full validation tests."""
    entries: list[dict] = []
    for idx, qt in enumerate(["simple"] * 10 + ["complex"] * 10 + ["multi_hop"] * 10):
        entries.append(
            {
                "id": f"{qt.upper()}-{idx % 10 + 1:03d}",
                "text": f"Query {idx + 1}",
                "query_type": qt,
                "domain": "test",
            }
        )
    return entries


# ======================================================================
# QueryEntry
# ======================================================================


class TestQueryEntry:
    def test_frozen(self) -> None:
        entry = QueryEntry(id="X", text="?", query_type="simple")
        with pytest.raises(AttributeError):
            entry.id = "Y"  # type: ignore[misc]

    def test_optional_fields_default_none(self) -> None:
        entry = QueryEntry(id="X", text="?", query_type="simple")
        assert entry.domain is None
        assert entry.expected_chunks is None
        assert entry.notes is None

    def test_all_fields_set(self) -> None:
        entry = QueryEntry(
            id="SIMPLE-001",
            text="What is the capital of France?",
            query_type="simple",
            domain="geography",
            expected_chunks=["chunk-a"],
            notes="Single fact.",
        )
        assert entry.id == "SIMPLE-001"
        assert entry.text == "What is the capital of France?"
        assert entry.query_type == "simple"
        assert entry.domain == "geography"
        assert entry.expected_chunks == ["chunk-a"]
        assert entry.notes == "Single fact."


# ======================================================================
# _raw_to_entry
# ======================================================================


class TestRawToEntry:
    def test_basic_conversion(self, three_entries: list[dict]) -> None:
        entry = _raw_to_entry(three_entries[0])
        assert isinstance(entry, QueryEntry)
        assert entry.id == "SIMPLE-001"
        assert entry.query_type == "simple"

    def test_with_expected_chunks(self, three_entries: list[dict]) -> None:
        entry = _raw_to_entry(three_entries[1])
        assert entry.expected_chunks == ["doc-a", "doc-b"]

    def test_with_none_fields(self, three_entries: list[dict]) -> None:
        entry = _raw_to_entry(three_entries[2])
        assert entry.expected_chunks is None
        assert entry.notes is None

    def test_rejects_non_dict(self) -> None:
        with pytest.raises(TypeError, match="JSON object"):
            _raw_to_entry("string")

    def test_rejects_missing_id(self) -> None:
        with pytest.raises(ValueError, match="Missing required.*'id'"):
            _raw_to_entry({"text": "?", "query_type": "simple"})

    def test_rejects_wrong_id_type(self) -> None:
        with pytest.raises(TypeError, match="must be str"):
            _raw_to_entry({"id": 1, "text": "?", "query_type": "simple"})

    def test_rejects_invalid_query_type(self) -> None:
        with pytest.raises(ValueError, match="not in"):
            _raw_to_entry(
                {"id": "X", "text": "?", "query_type": "invalid_type"}
            )

    def test_rejects_wrong_domain_type(self) -> None:
        with pytest.raises(TypeError, match="domain.*must be str or null"):
            _raw_to_entry(
                {
                    "id": "X",
                    "text": "?",
                    "query_type": "simple",
                    "domain": 42,
                }
            )

    def test_rejects_non_list_expected_chunks(self) -> None:
        with pytest.raises(TypeError, match="expected_chunks.*must be a list"):
            _raw_to_entry(
                {
                    "id": "X",
                    "text": "?",
                    "query_type": "simple",
                    "expected_chunks": "not_a_list",
                }
            )

    def test_rejects_non_string_chunks(self) -> None:
        with pytest.raises(TypeError, match="expected_chunks.*must be a list"):
            _raw_to_entry(
                {
                    "id": "X",
                    "text": "?",
                    "query_type": "simple",
                    "expected_chunks": [1, 2],
                }
            )


# ======================================================================
# load_dataset
# ======================================================================


class TestLoadDataset:
    def test_default_path_loads_all_30(self) -> None:
        entries = load_dataset()
        assert len(entries) == 30

    def test_default_path_has_correct_types(self) -> None:
        entries = load_dataset()
        type_counts = {qt: 0 for qt in _QUERY_TYPE_VALUES}
        for e in entries:
            type_counts[e.query_type] += 1
        assert type_counts == {"simple": 10, "complex": 10, "multi_hop": 10}

    def test_from_json_file(self, three_entries: list[dict]) -> None:
        with tempfile.NamedTemporaryFile(
            mode="w", suffix=".json", delete=False
        ) as f:
            json.dump(three_entries, f)
            tmp_path = f.name

        try:
            # 3 entries cannot satisfy the 10-per-type count check
            entries = load_dataset(tmp_path, validate=False)
            assert len(entries) == 3
            assert entries[0].id == "SIMPLE-001"
        finally:
            os.unlink(tmp_path)

    def test_file_not_found(self) -> None:
        with pytest.raises(FileNotFoundError):
            load_dataset(Path("nonexistent.json"))

    def test_invalid_json(self) -> None:
        with tempfile.NamedTemporaryFile(
            mode="w", suffix=".json", delete=False
        ) as f:
            f.write("not json")
            tmp_path = f.name

        try:
            with pytest.raises(json.JSONDecodeError):
                load_dataset(tmp_path)
        finally:
            os.unlink(tmp_path)

    def test_raises_on_invalid_query_type(self) -> None:
        """_raw_to_entry raises for unrecognised query_type."""
        bad_entries = [
            {
                "id": "BAD-001",
                "text": "test",
                "query_type": "not_a_valid_type",
            }
        ]
        with tempfile.NamedTemporaryFile(
            mode="w", suffix=".json", delete=False
        ) as f:
            json.dump(bad_entries, f)
            tmp_path = f.name

        try:
            with pytest.raises(ValueError, match="not in"):
                load_dataset(tmp_path)
        finally:
            os.unlink(tmp_path)

    def test_skip_validation(self) -> None:
        """validate=False skips count checks but not field-level _raw_to_entry checks."""
        # 5 simple entries — fails the "exactly 10 per type" check
        entries_data = [
            {"id": f"SIMPLE-{i:03d}", "text": f"q{i}", "query_type": "simple"}
            for i in range(5)
        ]
        with tempfile.NamedTemporaryFile(
            mode="w", suffix=".json", delete=False
        ) as f:
            json.dump(entries_data, f)
            tmp_path = f.name

        try:
            entries = load_dataset(tmp_path, validate=False)
            assert len(entries) == 5
            assert entries[0].query_type == "simple"
        finally:
            os.unlink(tmp_path)


# ======================================================================
# validate_dataset
# ======================================================================


class TestValidateDataset:
    def test_valid_30(self, ten_per_type: list[dict]) -> None:
        entries = [_raw_to_entry(e) for e in ten_per_type]
        report = validate_dataset(entries)
        assert report.valid
        assert report.query_count == 30
        assert report.type_counts == {
            "simple": 10,
            "complex": 10,
            "multi_hop": 10,
        }

    def test_empty_list(self) -> None:
        report = validate_dataset([])
        assert not report.valid
        assert "empty" in report.errors[0].lower()

    def test_duplicate_id(self) -> None:
        entries = [
            QueryEntry(id="X", text="a", query_type="simple"),
            QueryEntry(id="X", text="b", query_type="complex"),
        ]
        report = validate_dataset(entries)
        assert not report.valid
        assert any("duplicate" in e.lower() for e in report.errors)

    def test_wrong_type_count(self) -> None:
        entries = [_raw_to_entry(e) for e in _ten_per_type("simple", 5)]
        report = validate_dataset(entries)
        assert not report.valid
        assert any("simple" in e and "5" in e for e in report.errors)

    def test_unrecognised_query_type(self) -> None:
        entries = [
            QueryEntry(id="X", text="?", query_type="bogus"),
        ]
        report = validate_dataset(entries)
        assert not report.valid


def _ten_per_type(qt: str, count: int) -> list[dict]:
    return [
        {
            "id": f"{qt.upper()}-{i:03d}",
            "text": f"Query {i}",
            "query_type": qt,
        }
        for i in range(count)
    ]


# ======================================================================
# Convenience utilities
# ======================================================================


class TestGetByType:
    def test_filters_correctly(self, three_entries: list[dict]) -> None:
        entries = [_raw_to_entry(e) for e in three_entries]
        simple = get_by_type(entries, "simple")
        assert len(simple) == 1
        assert simple[0].id == "SIMPLE-001"

    def test_no_match_returns_empty_list(self) -> None:
        entries = [
            QueryEntry(id="X", text="?", query_type="simple"),
        ]
        assert get_by_type(entries, "complex") == []


class TestDatasetSummary:
    def test_summary_shape(self, three_entries: list[dict]) -> None:
        entries = [_raw_to_entry(e) for e in three_entries]
        summary = dataset_summary(entries)
        assert summary["total"] == 3
        assert isinstance(summary["type_counts"], dict)
        assert isinstance(summary["domains"], list)

    def test_summary_of_30(self) -> None:
        entries = load_dataset()
        summary = dataset_summary(entries)
        assert summary["total"] == 30
        assert summary["type_counts"] == {
            "complex": 10,
            "multi_hop": 10,
            "simple": 10,
        }


class TestIterEntries:
    def test_yields_all(self, three_entries: list[dict]) -> None:
        entries = [_raw_to_entry(e) for e in three_entries]
        yielded = list(iter_entries(entries))
        assert len(yielded) == 3
        assert yielded[0].id == "SIMPLE-001"


# ======================================================================
# ValidationReport
# ======================================================================


class TestValidationReport:
    def test_defaults(self) -> None:
        report = ValidationReport(valid=True)
        assert report.valid
        assert report.errors == []
        assert report.query_count == 0
        assert report.type_counts == {}

    def test_default_valid_false(self) -> None:
        report = ValidationReport(valid=False, errors=["bad"])
        assert not report.valid
        assert report.errors == ["bad"]
