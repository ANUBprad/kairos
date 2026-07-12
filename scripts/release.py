"""One-command release workflow.

Usage:
    python scripts/release.py             # dry-run
    python scripts/release.py --execute   # full release

Steps:
    1. Validate configuration
    2. Run tests
    3. Build artifacts
    4. Generate reports
    5. Create release artifacts
"""

from __future__ import annotations

import argparse
import subprocess
import sys
from pathlib import Path


def step(msg: str) -> None:
    print(f"\n{'=' * 60}")
    print(f"  {msg}")
    print(f"{'=' * 60}")


def run(cmd: list[str], cwd: str | None = None) -> bool:
    result = subprocess.run(cmd, cwd=cwd, capture_output=True, text=True)
    if result.returncode != 0:
        print(f"FAILED: {' '.join(cmd)}")
        print(result.stderr)
        return False
    print(result.stdout[:500])
    return True


def main() -> int:
    parser = argparse.ArgumentParser(description="Kairos release workflow")
    parser.add_argument("--execute", action="store_true", help="Execute the full release (default: dry-run)")
    args = parser.parse_args()

    dry_run = not args.execute
    root = Path(__file__).resolve().parent.parent

    if dry_run:
        print("=== DRY RUN MODE ===")
        print("Pass --execute to perform the full release.")
        print()

    # Step 1: Validate configuration
    step("1/5  Validating configuration")
    if dry_run:
        print("[DRY-RUN] Would run: python scripts/validate.py")
    elif not run([sys.executable, "scripts/validate.py"], cwd=str(root)):
        return 1

    # Step 2: Run tests
    step("2/5  Running test suite")
    if dry_run:
        print("[DRY-RUN] Would run: pytest tests/ -v -x")
    elif not run([sys.executable, "-m", "pytest", "tests/", "-v", "-x"], cwd=str(root)):
        return 1

    # Step 3: Build artifacts
    step("3/5  Building artifacts")
    if dry_run:
        print("[DRY-RUN] Would run: python scripts/build.py")
    elif not run([sys.executable, "scripts/build.py"], cwd=str(root)):
        return 1

    # Step 4: Generate reports
    step("4/5  Generating reports")
    if dry_run:
        print("[DRY-RUN] Would run: python scripts/benchmark.py --report-only")
    elif not run([sys.executable, "scripts/benchmark.py", "--report-only"], cwd=str(root)):
        print("[WARN] Report generation had issues, continuing...")

    # Step 5: Create release artifacts
    step("5/5  Creating release artifacts")
    if dry_run:
        print("[DRY-RUN] Would create release tarball and version tag")
    else:
        import json
        from datetime import datetime, timezone
        from intelligence.artifacts.report_registry import ReportRegistry
        from intelligence.artifacts.version_tracking import VersionTracker

        tracker = VersionTracker()
        release_version = tracker.current_str

        release_notes = f"""# Kairos Release {release_version}

**Date:** {datetime.now(timezone.utc).isoformat()}

## Changes

This release includes configuration system, API platform, Dockerization,
CI/CD pipelines, artifact management, and deployment documentation.

## Artifacts

- Python SDK: `dist/kairos-client-{release_version}.tar.gz`
- Docker images tagged `{release_version}`
```

        report_path = Path("releases") / f"RELEASE_{release_version}.md"
        report_path.parent.mkdir(parents=True, exist_ok=True)
        report_path.write_text(release_notes)

        registry = ReportRegistry()
        registry.register_report(
            report_id=f"release-{release_version}",
            title=f"Release {release_version}",
            report_type="release",
            content=release_notes,
        )
        registry.save_report_file(f"release-{release_version}", release_notes)

        print(f"Release artifacts created at {report_path}")
        print(f"Release version: {release_version}")

    print()
    print("Release workflow complete!")
    return 0


if __name__ == "__main__":
    sys.exit(main())
