"""Build distribution packages and Docker images.

Usage:
    python scripts/build.py              # build all
    python scripts/build.py --python     # build Python SDK only
    python scripts/build.py --docker     # build Docker images only
"""

from __future__ import annotations

import argparse
import subprocess
import sys
from pathlib import Path


def build_python_sdk(root: Path) -> bool:
    sdk_dir = root / "sdk"
    if not sdk_dir.exists():
        print("[SKIP] sdk/ directory not found")
        return True

    print("Building Python SDK...")
    result = subprocess.run(
        [sys.executable, "-m", "build", "--wheel", "--sdist"],
        cwd=str(sdk_dir),
        capture_output=True,
        text=True,
    )
    if result.returncode != 0:
        print(f"SDK build failed:\n{result.stderr}")
        return False

    dist_dir = sdk_dir / "dist"
    if dist_dir.exists():
        print(f"SDK packages created in {dist_dir}:")
        for f in sorted(dist_dir.iterdir()):
            print(f"  {f.name} ({f.stat().st_size / 1024:.1f} KB)")
    return True


def build_docker_images(root: Path) -> bool:
    compose_file = root / "docker-compose.yml"
    if not compose_file.exists():
        print("[SKIP] docker-compose.yml not found")
        return True

    print("Building Docker images...")
    result = subprocess.run(
        ["docker", "compose", "build"],
        cwd=str(root),
        capture_output=True,
        text=True,
    )
    if result.returncode != 0:
        print(f"Docker build failed:\n{result.stderr}")
        return False

    print("Docker images built successfully")
    return True


def main() -> int:
    parser = argparse.ArgumentParser(description="Build Kairos distribution artifacts")
    parser.add_argument("--python", action="store_true", help="Build Python SDK only")
    parser.add_argument("--docker", action="store_true", help="Build Docker images only")
    args = parser.parse_args()

    root = Path(__file__).resolve().parent.parent
    build_all = not args.python and not args.docker

    success = True
    if build_all or args.python:
        success &= build_python_sdk(root)

    if build_all or args.docker:
        success &= build_docker_images(root)

    return 0 if success else 1


if __name__ == "__main__":
    sys.exit(main())
