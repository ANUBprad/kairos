"""Tests for scripts/release.py release-note generation.

The release notes must be built only from real metadata (version + the
actual commits) and must never contain fabricated claims about features or
artifacts that the script does not produce.
"""

from __future__ import annotations

import importlib.util
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
RELEASE_SCRIPT = ROOT / "scripts" / "release.py"


def _load_release_module():
    spec = importlib.util.spec_from_file_location("kairos_release", RELEASE_SCRIPT)
    module = importlib.util.module_from_spec(spec)
    sys.modules[spec.name] = module
    assert spec.loader is not None
    spec.loader.exec_module(module)
    return module


def test_release_notes_include_version_and_commits() -> None:
    module = _load_release_module()
    commits = ["abc123 fix(x): ship thing", "def456 test(y): guard a thing"]
    notes = module.build_release_notes("1.2.3", commits)
    assert "# Kairos Release 1.2.3" in notes
    assert "- abc123 fix(x): ship thing" in notes
    assert "- def456 test(y): guard a thing" in notes


def test_release_notes_handle_empty_commits() -> None:
    module = _load_release_module()
    notes = module.build_release_notes("0.1.0", [])
    assert "No commits recorded for this release." in notes


def test_release_notes_do_not_claim_unproduced_artifacts() -> None:
    module = _load_release_module()
    notes = module.build_release_notes("0.1.0", ["abc123 chore: cut release"])
    assert "Python SDK" not in notes
    assert "Docker images tagged" not in notes
    assert ".tar.gz" not in notes
