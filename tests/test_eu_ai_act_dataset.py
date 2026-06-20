"""Automated validation for the EU AI Act dataset (150 queries).

Fails if:
- duplicate IDs
- duplicate questions
- invalid article/annex references
- missing expected_articles
- missing confidence_band
"""

from __future__ import annotations

from difflib import SequenceMatcher
from pathlib import Path

import pytest

from benchmarks.dataset.audit import audit, is_valid_reference, load_queries

_DATASET_PATH = (
    Path(__file__).resolve().parent.parent
    / "benchmarks" / "dataset" / "eu_ai_act_queries.json"
)


@pytest.fixture(scope="session")
def queries() -> list[dict]:
    return load_queries(_DATASET_PATH)


@pytest.fixture(scope="session")
def audit_report() -> dict:
    return audit(_DATASET_PATH)


# ======================================================================
# ID checks
# ======================================================================


class TestIds:
    def test_all_ids_unique(self, queries: list[dict]) -> None:
        ids = [q["id"] for q in queries]
        duplicates = [i for i in ids if ids.count(i) > 1]
        assert not duplicates, f"Duplicate IDs: {set(duplicates)}"

    def test_all_ids_present(self, queries: list[dict]) -> None:
        for q in queries:
            assert q.get("id"), f"Entry missing id: {q}"

    def test_id_format(self, queries: list[dict]) -> None:
        for q in queries:
            qid = q["id"]
            diff = q.get("difficulty", "")
            prefix = diff.upper() if diff else ""
            assert qid.startswith(prefix), f"{qid}: id does not start with {prefix}"


# ======================================================================
# Question content checks
# ======================================================================


class TestQuestions:
    def test_no_exact_duplicate_questions(self, queries: list[dict]) -> None:
        texts = [q["query"] for q in queries]
        seen: dict[str, str] = {}
        for q in queries:
            text = q["query"]
            if text in seen:
                pytest.fail(f"Duplicate question: {q['id']} matches {seen[text]}")
            seen[text] = q["id"]

    def test_no_near_duplicate_questions(self, queries: list[dict]) -> None:
        texts = [q["query"] for q in queries]
        ids = [q["id"] for q in queries]
        pairs: list[tuple[str, str, float]] = []
        for i in range(len(texts)):
            for j in range(i + 1, len(texts)):
                if texts[i] and texts[j]:
                    ratio = SequenceMatcher(None, texts[i], texts[j]).ratio()
                    if ratio > 0.85:
                        pairs.append((ids[i], ids[j], ratio))
        assert not pairs, (
            f"Near-duplicate questions found: "
            + "; ".join(f"{a} ↔ {b} ({r:.2f})" for a, b, r in pairs)
        )

    def test_all_questions_non_empty(self, queries: list[dict]) -> None:
        for q in queries:
            assert q.get("query"), f"{q['id']}: empty query"


# ======================================================================
# Reference checks
# ======================================================================


class TestReferences:
    def test_all_expected_articles_present(self, queries: list[dict]) -> None:
        missing = [q["id"] for q in queries if not q.get("expected_articles")]
        assert not missing, f"Queries missing expected_articles: {missing}"

    def test_all_references_valid(self, queries: list[dict]) -> None:
        invalid: list[tuple[str, str]] = []
        for q in queries:
            for ref in (q.get("expected_articles") or []):
                if not is_valid_reference(ref):
                    invalid.append((q["id"], ref))
        assert not invalid, (
            "Invalid references: "
            + "; ".join(f"{qid}: {ref}" for qid, ref in invalid)
        )

    def test_all_expected_articles_non_empty(
        self, queries: list[dict]
    ) -> None:
        for q in queries:
            articles = q.get("expected_articles")
            assert articles, f"{q['id']}: expected_articles is empty/null"

    def test_expected_chunks_is_list_or_null(
        self, queries: list[dict]
    ) -> None:
        for q in queries:
            chunks = q.get("expected_chunks")
            assert chunks is None or isinstance(chunks, list), (
                f"{q['id']}: expected_chunks must be list or null"
            )


# ======================================================================
# Confidence checks
# ======================================================================


class TestConfidenceBand:
    def test_all_have_confidence_band(self, queries: list[dict]) -> None:
        missing = [q["id"] for q in queries if not q.get("confidence_band")]
        assert not missing, f"Queries missing confidence_band: {missing}"

    def test_confidence_band_valid_values(
        self, queries: list[dict]
    ) -> None:
        valid = {"high", "medium", "low"}
        for q in queries:
            band = q.get("confidence_band")
            assert band in valid, (
                f"{q['id']}: invalid confidence_band {band!r}"
            )


# ======================================================================
# Metadata field checks
# ======================================================================


class TestMetadata:
    def test_all_have_corpus_ref(self, queries: list[dict]) -> None:
        for q in queries:
            assert q.get("corpus_ref") == "EU_AI_Act.pdf", (
                f"{q['id']}: missing or wrong corpus_ref"
            )

    def test_all_have_difficulty(self, queries: list[dict]) -> None:
        missing = [q["id"] for q in queries if not q.get("difficulty")]
        assert not missing, f"Queries missing difficulty: {missing}"

    def test_difficulty_valid_values(self, queries: list[dict]) -> None:
        valid = {"simple", "complex", "multi_hop"}
        for q in queries:
            diff = q.get("difficulty")
            assert diff in valid, (
                f"{q['id']}: invalid difficulty {diff!r}"
            )


# ======================================================================
# Aggregate checks via audit report
# ======================================================================


class TestAuditReport:
    def test_no_duplicate_ids_in_report(
        self, audit_report: dict
    ) -> None:
        assert not audit_report["duplicate_ids"], (
            f"Duplicate IDs: {audit_report['duplicate_ids']}"
        )

    def test_no_duplicate_questions_in_report(
        self, audit_report: dict
    ) -> None:
        assert not audit_report["duplicate_questions"], (
            f"Duplicate questions: {audit_report['duplicate_questions']}"
        )

    def test_no_invalid_references_in_report(
        self, audit_report: dict
    ) -> None:
        assert not audit_report["invalid_references"], (
            f"Invalid references: {audit_report['invalid_references']}"
        )

    def test_no_missing_articles_in_report(
        self, audit_report: dict
    ) -> None:
        assert not audit_report["questions_missing_articles"], (
            f"Missing articles: {audit_report['questions_missing_articles']}"
        )

    def test_no_missing_confidence_in_report(
        self, audit_report: dict
    ) -> None:
        assert not audit_report["questions_missing_confidence"], (
            f"Missing confidence: {audit_report['questions_missing_confidence']}"
        )
