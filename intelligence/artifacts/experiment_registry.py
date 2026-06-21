from __future__ import annotations

import json
from dataclasses import dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional


@dataclass
class ExperimentEntry:
    experiment_id: str
    name: str
    created_at: str = ""
    description: str = ""
    config: Dict[str, Any] = field(default_factory=dict)
    results: Dict[str, Any] = field(default_factory=dict)
    metrics: Dict[str, float] = field(default_factory=dict)
    tags: List[str] = field(default_factory=list)
    status: str = "completed"

    def to_dict(self) -> Dict[str, Any]:
        return {
            "experiment_id": self.experiment_id,
            "name": self.name,
            "created_at": self.created_at,
            "description": self.description,
            "config": self.config,
            "results": self.results,
            "metrics": self.metrics,
            "tags": self.tags,
            "status": self.status,
        }

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> ExperimentEntry:
        return cls(
            experiment_id=str(data.get("experiment_id", "")),
            name=str(data.get("name", "")),
            created_at=str(data.get("created_at", "")),
            description=str(data.get("description", "")),
            config=dict(data.get("config", {})),
            results=dict(data.get("results", {})),
            metrics={k: float(v) for k, v in data.get("metrics", {}).items()},
            tags=list(data.get("tags", [])),
            status=str(data.get("status", "completed")),
        )


class ExperimentRegistry:
    def __init__(self, storage_dir: str | Path = "./experiments") -> None:
        self._storage_dir = Path(storage_dir)
        self._storage_dir.mkdir(parents=True, exist_ok=True)
        self._registry_file = self._storage_dir / "_registry.json"
        self._experiments: Dict[str, ExperimentEntry] = {}
        self._load()

    def _load(self) -> None:
        if self._registry_file.exists():
            try:
                data = json.loads(self._registry_file.read_text(encoding="utf-8"))
                for exp_id, entry in data.items():
                    self._experiments[exp_id] = ExperimentEntry.from_dict(entry)
            except (json.JSONDecodeError, KeyError):
                self._experiments = {}

    def _save(self) -> None:
        data: Dict[str, Dict[str, Any]] = {
            exp_id: entry.to_dict() for exp_id, entry in self._experiments.items()
        }
        self._registry_file.write_text(json.dumps(data, indent=2), encoding="utf-8")

    def register_experiment(
        self,
        experiment_id: str,
        name: str,
        description: str = "",
        config: Dict[str, Any] | None = None,
    ) -> ExperimentEntry:
        entry = ExperimentEntry(
            experiment_id=experiment_id,
            name=name,
            created_at=datetime.now(timezone.utc).isoformat(),
            description=description,
            config=config or {},
        )
        self._experiments[experiment_id] = entry
        self._save()
        return entry

    def update_results(
        self,
        experiment_id: str,
        results: Dict[str, Any],
        metrics: Dict[str, float] | None = None,
    ) -> Optional[ExperimentEntry]:
        entry = self._experiments.get(experiment_id)
        if entry is None:
            return None
        entry.results = results
        if metrics:
            entry.metrics = metrics
        self._save()
        return entry

    def get_experiment(self, experiment_id: str) -> Optional[ExperimentEntry]:
        return self._experiments.get(experiment_id)

    def list_experiments(self, tag: str | None = None) -> List[ExperimentEntry]:
        if tag is None:
            return list(self._experiments.values())
        return [e for e in self._experiments.values() if tag in e.tags]

    def add_tag(self, experiment_id: str, tag: str) -> bool:
        entry = self._experiments.get(experiment_id)
        if entry is None:
            return False
        if tag not in entry.tags:
            entry.tags.append(tag)
            self._save()
        return True

    def remove_experiment(self, experiment_id: str) -> bool:
        if experiment_id in self._experiments:
            del self._experiments[experiment_id]
            self._save()
            return True
        return False

    def to_dict(self) -> Dict[str, Any]:
        return {eid: entry.to_dict() for eid, entry in self._experiments.items()}
