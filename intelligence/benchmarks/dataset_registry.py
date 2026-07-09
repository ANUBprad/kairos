from __future__ import annotations

from dataclasses import dataclass
from typing import Dict, List, Optional

from benchmarks.dataset.loader import QueryEntry


@dataclass(frozen=True)
class DatasetMetadata:
    """Metadata about a registered benchmark dataset.

    Attributes:
        name:         Unique identifier for the dataset.
        source:       Origin (e.g. ``"hotpotqa"``, ``"squad"``).
        task_type:    Type of task (e.g. ``"qa"``, ``"retrieval"``).
        query_count:  Number of queries in the dataset.
        description:  Human-readable description.
        version:      Optional version string.
    """

    name: str
    source: str
    task_type: str
    query_count: int = 0
    description: str = ""
    version: str = ""


class DatasetRegistry:
    """Registry of available benchmark datasets.

    Example::

        registry = DatasetRegistry()
        registry.register_dataset(
            DatasetMetadata(name="hotpotqa-dev", source="hotpotqa", task_type="qa"),
            entries=hotpotqa_entries,
        )
        meta = registry.get_dataset("hotpotqa-dev")
        entries = registry.get_entries("hotpotqa-dev")
        names = registry.list_datasets()
    """

    def __init__(self) -> None:
        self._datasets: Dict[str, DatasetMetadata] = {}
        self._entries: Dict[str, List["QueryEntry"]] = {}

    def register_dataset(
        self,
        metadata: DatasetMetadata,
        entries: List["QueryEntry"],
    ) -> None:
        """Register a dataset with its entries.

        Args:
            metadata: Dataset metadata.
            entries:  List of :class:`QueryEntry` objects.

        Raises:
            ValueError: If the name is already registered.
        """
        if metadata.name in self._datasets:
            raise ValueError(f"Dataset {metadata.name!r} is already registered")
        self._datasets[metadata.name] = metadata
        self._entries[metadata.name] = list(entries)

    def unregister_dataset(self, name: str) -> None:
        """Remove a dataset from the registry.

        Args:
            name: Name of the dataset to remove.

        Raises:
            KeyError: If the name is not found.
        """
        if name not in self._datasets:
            raise KeyError(f"Dataset {name!r} not found in registry")
        del self._datasets[name]
        del self._entries[name]

    def list_datasets(self) -> List[DatasetMetadata]:
        """Return metadata for all registered datasets."""
        return list(self._datasets.values())

    def get_dataset(self, name: str) -> Optional[DatasetMetadata]:
        """Get metadata for a dataset by name.

        Returns:
            Metadata or ``None`` if not found.
        """
        return self._datasets.get(name)

    def get_entries(self, name: str) -> Optional[List["QueryEntry"]]:
        """Get entries for a dataset by name.

        Returns:
            List of entries or ``None`` if not found.
        """
        return self._entries.get(name)

    def dataset_names(self) -> List[str]:
        """Return sorted list of registered dataset names."""
        return sorted(self._datasets.keys())

    def __len__(self) -> int:
        return len(self._datasets)

    def __contains__(self, name: str) -> bool:
        return name in self._datasets
