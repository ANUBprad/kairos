from __future__ import annotations

import hashlib
import json
from dataclasses import dataclass
from pathlib import Path
from typing import Dict, List, Optional


@dataclass
class RegistryEntry:
    """A single entry in the model registry.

    Attributes:
        version:           Semantic version string (e.g. ``"v1"``).
        timestamp:         ISO-format timestamp of training.
        training_samples:  Number of samples used for training.
        dataset_hash:      SHA-256 hash of the training dataset.
        evaluation_metrics: Dict of evaluation metric names → values.
        path:              Filesystem path to the saved model.
    """

    version: str
    timestamp: str
    training_samples: int
    dataset_hash: str
    evaluation_metrics: Dict[str, float]
    path: str


class ModelRegistry:
    """Tracks all trained model versions.

    Registry is stored as JSON at ``models/registry.json``.
    """

    def __init__(self, registry_path: str = "models/registry.json"):
        self._path = Path(registry_path)
        self._path.parent.mkdir(parents=True, exist_ok=True)
        self._entries: List[RegistryEntry] = []
        self._load()

    def _load(self) -> None:
        if self._path.exists():
            with self._path.open("r") as f:
                data = json.load(f)
            for e in data.get("entries", []):
                self._entries.append(RegistryEntry(**e))

    def save(self) -> None:
        data = {
            "entries": [
                {
                    "version": e.version,
                    "timestamp": e.timestamp,
                    "training_samples": e.training_samples,
                    "dataset_hash": e.dataset_hash,
                    "evaluation_metrics": e.evaluation_metrics,
                    "path": e.path,
                }
                for e in self._entries
            ]
        }
        with self._path.open("w") as f:
            json.dump(data, f, indent=2)

    def register(self, entry: RegistryEntry) -> None:
        self._entries.append(entry)
        self.save()

    @property
    def entries(self) -> List[RegistryEntry]:
        return list(self._entries)

    def latest_version(self) -> Optional[str]:
        if not self._entries:
            return None
        return self._entries[-1].version

    def get(self, version: str) -> Optional[RegistryEntry]:
        for e in self._entries:
            if e.version == version:
                return e
        return None

    def to_dict(self) -> dict:
        return {
            "entries": [
                {
                    "version": e.version,
                    "timestamp": e.timestamp,
                    "training_samples": e.training_samples,
                    "dataset_hash": e.dataset_hash,
                    "evaluation_metrics": e.evaluation_metrics,
                    "path": e.path,
                }
                for e in self._entries
            ]
        }


# ---------------------------------------------------------------------------
# Utility
# ---------------------------------------------------------------------------


def compute_dataset_hash(records: List[dict]) -> str:
    """Compute a stable SHA-256 hash of a list of dict records."""
    raw = json.dumps(records, sort_keys=True, ensure_ascii=False, default=str)
    return hashlib.sha256(raw.encode()).hexdigest()
