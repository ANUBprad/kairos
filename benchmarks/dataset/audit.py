"""Audit eu_ai_act_queries.json for correctness and completeness.

Verifies every expected_article maps to a real EU AI Act reference,
detects duplicates / near-duplicates, and produces a report.

Usage:
    python -m benchmarks.dataset.audit
"""

from __future__ import annotations

import json
import re
import sys
from collections import Counter
from difflib import SequenceMatcher
from pathlib import Path

_BASE_DIR = Path(__file__).resolve().parent
_DATASET_PATH = _BASE_DIR / "eu_ai_act_queries.json"

# ---------------------------------------------------------------------------
# Legitimate references (EU AI Act Regulation 2024/1689)
# ---------------------------------------------------------------------------

_VALID_ARTICLES: set[int] = set(range(1, 114))  # Articles 1-113

_VALID_ANNEXES: set[int] = set(range(1, 14))  # Annexes I-XIII

_ARTICLE_PATTERN = re.compile(
    r"^Article (\d+)"   # "Article 99" or "Article 3(1)"
)

_SUB_REF_PATTERN = re.compile(
    r"^Article (\d+)\((\d+)\)([a-z])?$"  # "Article 3(1)" or "Article 50(4)" or "Article 5(h)"
)

_ANNEX_PATTERN = re.compile(
    r"^Annex (I{1,3}|IV|V|VI{1,3}|IX|X|XI{1,2}|XIII)$"
)

# Pattern for paragraph-letter suffixes like 5(h), 5(a)
_PARAGRAPH_LETTER = re.compile(r"^[a-z]$")

_ANNEX_NUM_MAP = {
    "I": 1, "II": 2, "III": 3, "IV": 4, "V": 5, "VI": 6,
    "VII": 7, "VIII": 8, "IX": 9, "X": 10, "XI": 11, "XII": 12, "XIII": 13,
}


def _normalise_ref(ref: str) -> str:
    """Strip whitespace and normalise spacing inside parentheses."""
    return " ".join(ref.split())


def parse_ref(ref: str) -> dict:
    """Parse a reference string into its components.

    Returns dict with keys: raw, type, number, sub, letter, valid.
    """
    raw = _normalise_ref(ref)
    result = {"raw": raw, "valid": False, "type": None, "number": None, "sub": None, "letter": None}

    m = _ARTICLE_PATTERN.match(raw)
    if m:
        num = int(m.group(1))
        if 1 <= num <= 113:
            result["type"] = "article"
            result["number"] = num
            # Check for sub-paragraph/letter
            rest = raw[m.end():]
            sm = re.search(r"\((\d+)\)", rest)
            if sm:
                result["sub"] = int(sm.group(1))
                # Check for letter after sub like (4)(a) or just (h)
                after = rest[sm.end():]
                lm = re.search(r"\(([a-z])\)", after)
                if lm:
                    result["letter"] = lm.group(1)
            else:
                # Check for top-level letter like Article 5(h)
                lm = re.search(r"\(([a-z])\)", rest)
                if lm:
                    result["letter"] = lm.group(1)
            result["valid"] = True
    else:
        m = _ANNEX_PATTERN.match(raw)
        if m:
            roman = m.group(1)
            num = _ANNEX_NUM_MAP.get(roman)
            if num and 1 <= num <= 13:
                result["type"] = "annex"
                result["number"] = num
                result["valid"] = True

    return result


def is_valid_reference(ref: str) -> bool:
    """Return True if *ref* is a recognised EU AI Act reference."""
    parsed = parse_ref(ref)
    return parsed["valid"]


# ---------------------------------------------------------------------------
# Audit
# ---------------------------------------------------------------------------


def load_queries(path: Path) -> list[dict]:
    with path.open("r", encoding="utf-8") as f:
        data = json.load(f)
    return data


def audit(path: Path) -> dict:
    """Run full audit and return a structured report dict."""
    queries = load_queries(path)
    report = {
        "total_queries": len(queries),
        "ids": [],
        "texts": [],
        "difficulty_counts": Counter(),
        "confidence_band_counts": Counter(),
        "all_references": [],
        "invalid_references": [],
        "duplicate_ids": [],
        "near_duplicates": [],
        "duplicate_questions": [],
        "questions_missing_articles": [],
        "questions_missing_confidence": [],
        "referenced_articles": set(),
        "referenced_annexes": set(),
        "unique_references": set(),
    }

    seen_ids: set[str] = set()
    seen_texts: dict[str, str] = {}  # text -> id
    text_list: list[str] = []

    for q in queries:
        qid = q["id"]
        text = q.get("query", "") or ""
        diff = q.get("difficulty", "")
        band = q.get("confidence_band", "")
        articles = q.get("expected_articles", []) or []
        chunks = q.get("expected_chunks", []) or []

        report["ids"].append(qid)
        report["texts"].append(text)
        report["difficulty_counts"][diff] += 1
        report["confidence_band_counts"][band] += 1

        # Duplicate IDs
        if qid in seen_ids:
            report["duplicate_ids"].append(qid)
        seen_ids.add(qid)

        # Duplicate questions (exact match)
        if text in seen_texts:
            report["duplicate_questions"].append((qid, seen_texts[text]))
        seen_texts[text] = qid
        text_list.append(text)

        # Missing expected_articles
        if not articles:
            report["questions_missing_articles"].append(qid)

        # Missing confidence_band
        if not band:
            report["questions_missing_confidence"].append(qid)

        # Validate each reference
        for ref in articles:
            report["all_references"].append(ref)
            report["unique_references"].add(ref)
            parsed = parse_ref(ref)
            if parsed["valid"]:
                if parsed["type"] == "article":
                    report["referenced_articles"].add(parsed["number"])
                elif parsed["type"] == "annex":
                    report["referenced_annexes"].add(parsed["number"])
            else:
                report["invalid_references"].append((qid, ref))

    # Near-duplicate detection (pairwise text similarity > 0.85)
    seen_pairs: set[tuple[str, str]] = set()
    for i in range(len(text_list)):
        for j in range(i + 1, len(text_list)):
            if text_list[i] and text_list[j]:
                ratio = SequenceMatcher(None, text_list[i], text_list[j]).ratio()
                if ratio > 0.85:
                    pair = tuple(sorted([report["ids"][i], report["ids"][j]]))
                    if pair not in seen_pairs:
                        seen_pairs.add(pair)
                        report["near_duplicates"].append({
                            "id_a": pair[0],
                            "id_b": pair[1],
                            "similarity": round(ratio, 4),
                            "text_a": text_list[i][:120],
                            "text_b": text_list[j][:120],
                        })

    return report


def format_report(report: dict) -> str:
    lines = [
        "# EU AI Act Dataset Audit Report",
        "",
        f"**File:** `benchmarks/dataset/eu_ai_act_queries.json`",
        f"**Generated:** {__import__('datetime').datetime.now().strftime('%Y-%m-%d %H:%M:%S')}",
        "",
        "---",
        "",
        "## 1. Overview",
        "",
        f"| Metric | Value |",
        "|--------|-------|",
        f"| Total queries | {report['total_queries']} |",
        f"| Unique IDs | {len(set(report['ids']))} |",
        f"| Duplicate IDs | {len(report['duplicate_ids'])} |",
        f"| Exact duplicate questions | {len(report['duplicate_questions'])} |",
        f"| Near-duplicate pairs | {len(report['near_duplicates'])} |",
        f"| Invalid references | {len(report['invalid_references'])} |",
        f"| Queries missing expected_articles | {len(report['questions_missing_articles'])} |",
        f"| Queries missing confidence_band | {len(report['questions_missing_confidence'])} |",
        "",
        "---",
        "",
        "## 2. Difficulty Distribution",
        "",
        "| Difficulty | Count |",
        "|------------|-------|",
    ]
    for diff in ["simple", "complex", "multi_hop"]:
        cnt = report["difficulty_counts"].get(diff, 0)
        lines.append(f"| {diff} | {cnt} |")

    lines += [
        "",
        "---",
        "",
        "## 3. Confidence-Band Distribution",
        "",
        "| Band | Count |",
        "|------|-------|",
    ]
    for band in ["high", "medium", "low"]:
        cnt = report["confidence_band_counts"].get(band, 0)
        lines.append(f"| {band} | {cnt} |")

    total_refs = len(report["all_references"])
    unique_articles = sorted(report["referenced_articles"])
    unique_annexes = sorted(report["referenced_annexes"])

    lines += [
        "",
        "---",
        "",
        "## 4. Article Coverage",
        "",
        f"| Metric | Value |",
        "|--------|-------|",
        f"| Unique articles referenced | {len(unique_articles)} / 113 |",
        f"| Unique annexes referenced | {len(unique_annexes)} / 13 |",
        f"| Total reference occurrences | {total_refs} |",
        f"| Unique reference strings | {len(report['unique_references'])} |",
        "",
        "### Articles referenced",
        "",
    ]
    # Group articles
    for a in unique_articles:
        count = sum(1 for r in report["all_references"] if parse_ref(r).get("number") == a and parse_ref(r).get("type") == "article")
        lines.append(f"- Article {a} ({count} references)")
    lines.append("")
    if unique_annexes:
        lines.append("### Annexes referenced")
        lines.append("")
        for a in unique_annexes:
            roman = ["", "I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X", "XI", "XII", "XIII"][a]
            count = sum(1 for r in report["all_references"] if parse_ref(r).get("number") == a and parse_ref(r).get("type") == "annex")
            lines.append(f"- Annex {roman} ({count} references)")
        lines.append("")

    # Invalid references
    if report["invalid_references"]:
        lines += [
            "---",
            "",
            "## 5. Invalid References",
            "",
        ]
        for qid, ref in report["invalid_references"]:
            lines.append(f"- **{ref}** in `{qid}`")
        lines.append("")
    else:
        lines += [
            "---",
            "",
            "## 5. Invalid References",
            "",
            "None — all references are valid.",
            "",
        ]

    # Duplicate IDs
    if report["duplicate_ids"]:
        lines += [
            "---",
            "",
            "## 6. Duplicate IDs",
            "",
        ]
        for qid in report["duplicate_ids"]:
            lines.append(f"- `{qid}`")
        lines.append("")

    # Near-duplicates
    if report["near_duplicates"]:
        lines += [
            "---",
            "",
            "## 7. Near-Duplicate Questions",
            "",
        ]
        for nd in report["near_duplicates"]:
            lines += [
                f"- **{nd['id_a']}** ↔ **{nd['id_b']}** "
                f"(similarity {nd['similarity']})",
                f"  - A: \"{nd['text_a']}...\"",
                f"  - B: \"{nd['text_b']}...\"",
                "",
            ]
    else:
        lines += [
            "---",
            "",
            "## 7. Near-Duplicate Questions",
            "",
            "None found.",
            "",
        ]

    return "\n".join(lines)


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------


def main() -> None:
    path = _DATASET_PATH
    if not path.exists():
        print(f"ERROR: dataset not found at {path}", file=sys.stderr)
        sys.exit(1)

    report = audit(path)
    md = format_report(report)

    reports_dir = _BASE_DIR.parent / "reports"
    reports_dir.mkdir(parents=True, exist_ok=True)
    output_path = reports_dir / "dataset_audit.md"
    output_path.write_text(md, encoding="utf-8")

    print(f"Audit written to {output_path}")
    print(f"  Total queries:      {report['total_queries']}")
    print(f"  Duplicate IDs:      {len(report['duplicate_ids'])}")
    print(f"  Duplicate questions: {len(report['duplicate_questions'])}")
    print(f"  Near-duplicates:    {len(report['near_duplicates'])}")
    print(f"  Invalid references: {len(report['invalid_references'])}")
    print(f"  Missing articles:   {len(report['questions_missing_articles'])}")
    print(f"  Missing confidence: {len(report['questions_missing_confidence'])}")
    print(f"  Articles covered:   {len(report['referenced_articles'])} / 113")
    print(f"  Annexes covered:    {len(report['referenced_annexes'])} / 13")

    if report["invalid_references"] or report["duplicate_ids"] or report["questions_missing_articles"]:
        print("\nISSUES FOUND — review report for details.")
        sys.exit(1 if report["invalid_references"] else 0)


if __name__ == "__main__":
    main()
