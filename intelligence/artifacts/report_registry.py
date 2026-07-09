from __future__ import annotations

import json
from dataclasses import dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from typing import Dict, List, Optional


@dataclass
class ReportEntry:
    report_id: str
    title: str
    report_type: str
    created_at: str = ""
    content: str = ""
    file_path: str = ""
    metadata: Dict[str, object] = field(default_factory=dict)

    def to_dict(self) -> Dict[str, object]:
        return {
            "report_id": self.report_id,
            "title": self.title,
            "report_type": self.report_type,
            "created_at": self.created_at,
            "file_path": self.file_path,
            "metadata": dict(self.metadata),
        }


class ReportRegistry:
    def __init__(self, storage_dir: str | Path = "./reports") -> None:
        self._storage_dir = Path(storage_dir)
        self._storage_dir.mkdir(parents=True, exist_ok=True)
        self._registry_file = self._storage_dir / "_registry.json"
        self._reports: Dict[str, ReportEntry] = {}
        self._load()

    def _load(self) -> None:
        if self._registry_file.exists():
            try:
                data = json.loads(self._registry_file.read_text(encoding="utf-8"))
                for rid, entry in data.items():
                    self._reports[rid] = ReportEntry(
                        report_id=str(entry["report_id"]),
                        title=str(entry["title"]),
                        report_type=str(entry["report_type"]),
                        created_at=str(entry.get("created_at", "")),
                        file_path=str(entry.get("file_path", "")),
                        metadata=dict(entry.get("metadata", {})),
                    )
            except (json.JSONDecodeError, KeyError):
                self._reports = {}

    def _save(self) -> None:
        data = {rid: entry.to_dict() for rid, entry in self._reports.items()}
        self._registry_file.write_text(json.dumps(data, indent=2), encoding="utf-8")

    def register_report(
        self,
        report_id: str,
        title: str,
        report_type: str,
        content: str = "",
        metadata: Dict[str, object] | None = None,
    ) -> ReportEntry:
        entry = ReportEntry(
            report_id=report_id,
            title=title,
            report_type=report_type,
            created_at=datetime.now(timezone.utc).isoformat(),
            content=content,
            metadata=metadata or {},
        )
        self._reports[report_id] = entry
        self._save()
        return entry

    def save_report_file(
        self, report_id: str, content: str, filename: str = ""
    ) -> Optional[Path]:
        if report_id not in self._reports:
            return None
        name = filename or f"{report_id}.md"
        file_path = self._storage_dir / name
        file_path.write_text(content, encoding="utf-8")
        self._reports[report_id].file_path = str(file_path)
        self._reports[report_id].content = content
        self._save()
        return file_path

    def get_report(self, report_id: str) -> Optional[ReportEntry]:
        return self._reports.get(report_id)

    def list_reports(self, report_type: str | None = None) -> List[ReportEntry]:
        if report_type is None:
            return list(self._reports.values())
        return [r for r in self._reports.values() if r.report_type == report_type]

    def remove_report(self, report_id: str) -> bool:
        if report_id in self._reports:
            del self._reports[report_id]
            self._save()
            return True
        return False

    def to_dict(self) -> Dict[str, object]:
        return {rid: entry.to_dict() for rid, entry in self._reports.items()}
