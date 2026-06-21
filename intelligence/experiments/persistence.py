from __future__ import annotations

import json
import os
from pathlib import Path
from typing import Dict, List, Optional

from intelligence.experiments.models import ExperimentRun


class ExperimentStore:
    """JSON file-backed persistence for experiment runs.

    Stores a registry index at ``experiments/registry.json`` and individual
    run files at ``experiments/run_{run_id}.json``.
    """

    def __init__(self, base_dir: str = "experiments"):
        self._base_dir = Path(base_dir)
        self._base_dir.mkdir(parents=True, exist_ok=True)

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    def save_run(self, run: ExperimentRun) -> str:
        """Persist a single run to ``run_{run_id}.json``.

        Returns the run_id.
        """
        path = self._run_path(run.run_id)
        with open(str(path), "w", encoding="utf-8") as f:
            json.dump(run.to_dict(), f, indent=2, default=str)
        return run.run_id

    def load_run(self, run_id: str) -> Optional[ExperimentRun]:
        """Load a single run by *run_id*."""
        path = self._run_path(run_id)
        if not path.exists():
            return None
        with open(str(path), "r", encoding="utf-8") as f:
            data = json.load(f)
        return ExperimentRun.from_dict(data)

    def delete_run(self, run_id: str) -> bool:
        """Delete a run file. Returns True if it existed."""
        path = self._run_path(run_id)
        if path.exists():
            path.unlink()
            return True
        return False

    def list_run_ids(self) -> List[str]:
        """List all run IDs available in the store."""
        ids: List[str] = []
        for f in self._base_dir.iterdir():
            if f.is_file() and f.name.startswith("run_") and f.suffix == ".json":
                rid = f.name[len("run_"):-len(".json")]
                ids.append(rid)
        return sorted(ids)

    def save_registry_metadata(
        self, metadata: Dict[str, object]
    ) -> None:
        """Persist top-level registry metadata."""
        path = self._base_dir / "registry.json"
        with open(str(path), "w", encoding="utf-8") as f:
            json.dump(metadata, f, indent=2, default=str)

    def load_registry_metadata(self) -> Dict[str, object]:
        """Load top-level registry metadata."""
        path = self._base_dir / "registry.json"
        if not path.exists():
            return {}
        with open(str(path), "r", encoding="utf-8") as f:
            return json.load(f)

    def clear(self) -> None:
        """Remove all run files and registry metadata."""
        for f in self._base_dir.iterdir():
            if f.is_file() and f.suffix == ".json":
                f.unlink()

    # ------------------------------------------------------------------
    # Internal
    # ------------------------------------------------------------------

    def _run_path(self, run_id: str) -> Path:
        return self._base_dir / f"run_{run_id}.json"
