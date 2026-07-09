"""Validate Keiro configuration and environment.

Usage:
    python scripts/validate.py

Checks:
    1. Python version >= 3.11
    2. Required packages installed
    3. Configuration is valid (via intelligence.config.validation)
    4. Directory structure is correct
"""

from __future__ import annotations

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))


def check_python_version() -> list[str]:
    errors: list[str] = []
    if sys.version_info < (3, 11):
        errors.append(f"Python 3.11+ required, found {sys.version_info.major}.{sys.version_info.minor}")
    else:
        print(f"  [OK] Python {sys.version_info.major}.{sys.version_info.minor}.{sys.version_info.micro}")
    return errors


def check_imports() -> list[str]:
    errors: list[str] = []
    required = [
        "pydantic",
        "pydantic_settings",
        "fastapi",
        "uvicorn",
        "grpc",
        "chromadb",
        "numpy",
    ]
    for mod in required:
        try:
            __import__(mod)
            print(f"  [OK] {mod}")
        except ImportError:
            errors.append(f"Missing required package: {mod}")
    return errors


def check_config() -> list[str]:
    errors: list[str] = []
    try:
        from intelligence.config.validation import validate_config
        from intelligence.config.settings import Settings
        settings = Settings()
        config_errors = validate_config(settings)
        if config_errors:
            for e in config_errors:
                print(f"  [WARN] {e}")
        else:
            print(f"  [OK] Configuration valid (env: {settings.environment})")
    except Exception as e:
        errors.append(f"Configuration check failed: {e}")
    return errors


def check_directories() -> list[str]:
    errors: list[str] = []
    root = Path(__file__).resolve().parent.parent
    required: list[Path] = [
        root / "intelligence",
        root / "intelligence" / "config",
        root / "intelligence" / "api",
        root / "intelligence" / "artifacts",
        root / "gateway",
        root / "docker",
        root / "tests",
        root / "dashboard",
    ]
    for d in required:
        if d.is_dir():
            print(f"  [OK] {d.name}/")
        else:
            errors.append(f"Required directory missing: {d}")
    return errors


def main() -> int:
    print("Keiro Validation Report")
    print("=" * 50)

    all_errors: list[str] = []

    print("\n[Python Version]")
    all_errors.extend(check_python_version())

    print("\n[Required Packages]")
    all_errors.extend(check_imports())

    print("\n[Configuration]")
    all_errors.extend(check_config())

    print("\n[Directory Structure]")
    all_errors.extend(check_directories())

    print()
    if all_errors:
        print(f"Validation FAILED — {len(all_errors)} error(s):")
        for e in all_errors:
            print(f"  - {e}")
        return 1
    else:
        print("Validation PASSED — all checks OK")
        return 0


if __name__ == "__main__":
    sys.exit(main())
