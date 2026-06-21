from __future__ import annotations

import json
import shutil
from dataclasses import dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from typing import Dict, List, Optional


@dataclass
class ModelArtifact:
    name: str
    path: str
    size_bytes: int = 0
    checksum: str = ""


@dataclass
class ModelVersion:
    version: str
    model_name: str
    created_at: str = ""
    description: str = ""
    artifacts: List[ModelArtifact] = field(default_factory=list)
    metadata: Dict[str, str] = field(default_factory=dict)

    def to_dict(self) -> Dict[str, object]:
        return {
            "version": self.version,
            "model_name": self.model_name,
            "created_at": self.created_at,
            "description": self.description,
            "artifacts": [
                {"name": a.name, "path": a.path, "size_bytes": a.size_bytes, "checksum": a.checksum}
                for a in self.artifacts
            ],
            "metadata": self.metadata,
        }

    @classmethod
    def from_dict(cls, data: Dict[str, object]) -> ModelVersion:
        artifacts_data = data.get("artifacts", [])
        artifacts = [
            ModelArtifact(
                name=a["name"],
                path=a["path"],
                size_bytes=a.get("size_bytes", 0),
                checksum=a.get("checksum", ""),
            )
            for a in artifacts_data
        ]
        return cls(
            version=str(data["version"]),
            model_name=str(data["model_name"]),
            created_at=str(data.get("created_at", "")),
            description=str(data.get("description", "")),
            artifacts=artifacts,
            metadata={k: str(v) for k, v in data.get("metadata", {}).items()},
        )


class ModelRegistry:
    def __init__(self, storage_dir: str | Path = "./models") -> None:
        self._storage_dir = Path(storage_dir)
        self._storage_dir.mkdir(parents=True, exist_ok=True)
        self._registry_file = self._storage_dir / "_registry.json"
        self._versions: Dict[str, List[ModelVersion]] = {}
        self._load()

    def _registry_path(self) -> Path:
        return self._registry_file

    def _load(self) -> None:
        if self._registry_file.exists():
            try:
                data = json.loads(self._registry_file.read_text(encoding="utf-8"))
                for model_name, versions in data.items():
                    self._versions[model_name] = [
                        ModelVersion.from_dict(v) if isinstance(v, dict) else v
                        for v in versions
                    ]
            except (json.JSONDecodeError, KeyError):
                self._versions = {}

    def _save(self) -> None:
        data: Dict[str, List[Dict[str, object]]] = {}
        for model_name, versions in self._versions.items():
            data[model_name] = [v.to_dict() for v in versions]
        self._registry_file.write_text(json.dumps(data, indent=2), encoding="utf-8")

    def register_version(
        self,
        model_name: str,
        version: str,
        description: str = "",
        metadata: Dict[str, str] | None = None,
    ) -> ModelVersion:
        model_dir = self._storage_dir / model_name / version
        model_dir.mkdir(parents=True, exist_ok=True)
        mv = ModelVersion(
            version=version,
            model_name=model_name,
            created_at=datetime.now(timezone.utc).isoformat(),
            description=description,
            metadata=metadata or {},
        )
        if model_name not in self._versions:
            self._versions[model_name] = []
        self._versions[model_name].append(mv)
        self._save()
        return mv

    def add_artifact(
        self,
        model_name: str,
        version: str,
        artifact_name: str,
        source_path: str | Path,
    ) -> Optional[ModelArtifact]:
        versions = self._versions.get(model_name, [])
        for mv in versions:
            if mv.version == version:
                dest_dir = self._storage_dir / model_name / version
                dest_dir.mkdir(parents=True, exist_ok=True)
                dest = dest_dir / Path(source_path).name
                shutil.copy2(Path(source_path), dest)
                artifact = ModelArtifact(
                    name=artifact_name,
                    path=str(dest),
                    size_bytes=dest.stat().st_size,
                )
                mv.artifacts.append(artifact)
                self._save()
                return artifact
        return None

    def get_versions(self, model_name: str) -> List[ModelVersion]:
        return self._versions.get(model_name, [])

    def get_latest_version(self, model_name: str) -> Optional[ModelVersion]:
        versions = self._versions.get(model_name, [])
        return versions[-1] if versions else None

    def list_models(self) -> List[str]:
        return sorted(self._versions.keys())

    def remove_version(self, model_name: str, version: str) -> bool:
        versions = self._versions.get(model_name, [])
        for i, mv in enumerate(versions):
            if mv.version == version:
                versions.pop(i)
                if not versions:
                    del self._versions[model_name]
                self._save()
                return True
        return False

    def get_storage_path(self, model_name: str, version: str) -> Path:
        return self._storage_dir / model_name / version
