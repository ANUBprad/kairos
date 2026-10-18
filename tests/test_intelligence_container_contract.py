"""Guards the invariants that let the intelligence image start at all.

The image runs ``python -u intelligence/main.py`` as a non-root user from
``/app``. That means the directory holding the ``intelligence`` package has to be
importable, and the working directory has to be writable where the engine puts
its telemetry. Both were broken, and because the ChromaDB healthcheck in
``docker-compose.yml`` failed first, the CI ``docker-e2e`` job never got far
enough to show it: the container crash-looped with ``ModuleNotFoundError: No
module named 'intelligence'`` and then ``PermissionError: 'telemetry'``.
"""

from __future__ import annotations

import inspect
import re
from pathlib import Path

from intelligence.telemetry.storage import TelemetryStorage

ROOT = Path(__file__).resolve().parent.parent
DOCKERFILE = ROOT / "docker" / "intelligence.Dockerfile"
WORKDIR = "/app"


def test_pythonpath_holds_the_directory_that_contains_the_package() -> None:
    match = re.search(
        r"^ENV PYTHONPATH=(\S+)", DOCKERFILE.read_text(encoding="utf-8"), re.MULTILINE
    )
    assert match, "docker/intelligence.Dockerfile must set PYTHONPATH"

    entries = match.group(1).split(":")
    importable = [
        entry
        for entry in entries
        if entry.startswith(WORKDIR)
        and (
            ROOT / entry[len(WORKDIR) :].lstrip("/") / "intelligence" / "__init__.py"
        ).is_file()
    ]
    assert importable, (
        f"{entries} has no entry that exposes the `intelligence` package, so "
        "`ENTRYPOINT python intelligence/main.py` cannot import it"
    )


def test_working_directory_is_writable_for_the_telemetry_store() -> None:
    base_dir = (
        inspect.signature(TelemetryStorage.__init__).parameters["base_dir"].default
    )
    target = re.escape(f"{WORKDIR}/{base_dir}")

    assert re.search(
        rf"^RUN install -d -o (?P<user>\S+) -g (?P=user) {target}$",
        DOCKERFILE.read_text(encoding="utf-8"),
        re.MULTILINE,
    ), (
        f"the image must create {WORKDIR}/{base_dir} owned by the non-root user that "
        "runs the engine: TelemetryStorage() writes there relative to the working "
        "directory, and /app itself is root-owned"
    )
