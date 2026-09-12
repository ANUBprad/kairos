"""Regenerate the Python protobuf/gRPC stubs from proto/rag.proto.

Run:
    python scripts/gen_proto.py

Requires the pinned codegen toolchain:
    pip install grpcio-tools==1.81.1
"""

from __future__ import annotations

import shutil
import subprocess
import sys
import tempfile
from importlib import metadata
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
PROTO = ROOT / "proto" / "rag.proto"
OUT = ROOT / "generated" / "python"
MODULE_PATH = "generated/python"
GRPC_TOOLS_PIN = "1.81.1"


def main() -> int:
    if not PROTO.exists():
        print(f"proto file not found: {PROTO}")
        return 1

    try:
        installed = metadata.version("grpcio-tools")
    except metadata.PackageNotFoundError:
        print("grpcio-tools is not installed. Run: pip install grpcio-tools==1.81.1")
        return 1
    if installed != GRPC_TOOLS_PIN:
        print(
            f"grpcio-tools must be {GRPC_TOOLS_PIN} for deterministic output "
            f"(found {installed})"
        )
        return 1

    # Stage the proto under generated/python so the generated grpc stub imports
    # its sibling as `from generated.python import rag_pb2`, matching the runtime.
    with tempfile.TemporaryDirectory() as tmp:
        staged = Path(tmp) / MODULE_PATH / PROTO.name
        staged.parent.mkdir(parents=True)
        shutil.copyfile(PROTO, staged)

        result = subprocess.run(
            [
                sys.executable,
                "-m",
                "grpc_tools.protoc",
                "-I",
                tmp,
                f"--python_out={ROOT}",
                f"--grpc_python_out={ROOT}",
                str(staged),
            ],
            cwd=str(ROOT),
            capture_output=True,
            text=True,
        )

    if result.returncode != 0:
        print(result.stdout)
        print(result.stderr, file=sys.stderr)
        return result.returncode

    for f in sorted(OUT.glob("rag_pb2*.py")):
        print(f"generated {f.relative_to(ROOT)}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
