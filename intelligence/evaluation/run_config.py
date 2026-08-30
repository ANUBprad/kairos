from __future__ import annotations

from dataclasses import dataclass, field
from typing import Dict, Optional


@dataclass(frozen=True)
class RunConfig:
    """Immutable configuration for one evaluation run.

    Only contains information genuinely required to reproduce the run.
    """

    namespace: str
    dataset_name: str
    dataset_path: Optional[str] = None
    generate: bool = True
    judge: bool = True
    top_k: Optional[int] = None
    max_entries: Optional[int] = None
    extra: Dict[str, str] = field(default_factory=dict)

    def to_dict(self) -> Dict[str, object]:
        return {
            "namespace": self.namespace,
            "dataset_name": self.dataset_name,
            "dataset_path": self.dataset_path,
            "generate": self.generate,
            "judge": self.judge,
            "top_k": self.top_k,
            "max_entries": self.max_entries,
            "extra": dict(self.extra),
        }
