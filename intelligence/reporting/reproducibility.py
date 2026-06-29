from __future__ import annotations

import json
import platform
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Dict, Iterable, List, Optional, Sequence

from intelligence.benchmarks.benchmark_result import BenchmarkResult
from intelligence.experiments.registry import ExperimentRegistry


def generate_experiment_manifest(
    registry: ExperimentRegistry,
    output_dir: str | Path = "reports",
    filename: str = "experiment_manifest.json",
) -> Optional[str]:
    """Generate a reproducibility manifest for all experiments.

    Includes run IDs, parameters, metrics, timestamp, and git commit hash.
    """
    runs = registry.list_runs()
    if not runs:
        return None

    out = Path(output_dir)
    out.mkdir(parents=True, exist_ok=True)

    entries: List[Dict[str, object]] = []
    for run in runs:
        entry: Dict[str, object] = {
            "run_id": run.run_id,
            "name": run.name,
            "phase": run.phase,
            "timestamp": str(run.timestamp),
            "status": str(run.status.value),
        }
        if run.parameters:
            entry["parameters"] = run.parameters.to_dict()
        if run.metrics:
            entry["metrics"] = {
                "recall": run.metrics.recall,
                "precision": run.metrics.precision,
                "latency_ms": run.metrics.latency_ms,
            }
        entries.append(entry)

    manifest: Dict[str, object] = {
        "type": "experiment_manifest",
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "experiment_count": len(entries),
        "git_commit": _get_git_commit(),
        "python_version": sys.version,
        "platform": platform.platform(),
        "experiments": entries,
    }

    filepath = out / filename
    filepath.write_text(json.dumps(manifest, indent=2, default=str), encoding="utf-8")
    return str(filepath)


def generate_benchmark_manifest(
    benchmark_results: Sequence[BenchmarkResult],
    output_dir: str | Path = "reports",
    filename: str = "benchmark_manifest.json",
) -> Optional[str]:
    """Generate a reproducibility manifest for benchmark evaluations."""
    if not benchmark_results:
        return None

    out = Path(output_dir)
    out.mkdir(parents=True, exist_ok=True)

    datasets: List[Dict[str, object]] = []
    for br in benchmark_results:
        d: Dict[str, object] = {
            "dataset_name": br.dataset_name,
            "query_count": br.query_count,
            "average_recall": br.average_recall,
            "average_precision": br.average_precision,
            "average_latency_ms": br.average_latency_ms,
            "success_rate": br.success_rate,
            "fallback_rate": br.fallback_rate,
            "metrics": br.metrics,
        }
        if br.validation is not None:
            d["validation_summary"] = br.validation.summary
        datasets.append(d)

    manifest: Dict[str, object] = {
        "type": "benchmark_manifest",
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "dataset_count": len(datasets),
        "git_commit": _get_git_commit(),
        "python_version": sys.version,
        "platform": platform.platform(),
        "datasets": datasets,
    }

    filepath = out / filename
    filepath.write_text(json.dumps(manifest, indent=2, default=str), encoding="utf-8")
    return str(filepath)


def generate_environment_snapshot(
    output_dir: str | Path = "reports",
    filename: str = "environment_snapshot.json",
    extra_info: Optional[Dict[str, object]] = None,
) -> Optional[str]:
    """Snapshot the runtime environment for reproducibility."""
    out = Path(output_dir)
    out.mkdir(parents=True, exist_ok=True)

    snapshot: Dict[str, object] = {
        "type": "environment_snapshot",
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "python": {
            "version": sys.version,
            "executable": sys.executable,
        },
        "platform": {
            "system": platform.system(),
            "release": platform.release(),
            "version": platform.version(),
            "machine": platform.machine(),
            "processor": platform.processor(),
        },
        "git_commit": _get_git_commit(),
        "packages": _get_installed_packages(),
    }
    if extra_info:
        snapshot["extra"] = extra_info

    filepath = out / filename
    filepath.write_text(json.dumps(snapshot, indent=2, default=str), encoding="utf-8")
    return str(filepath)


def _get_git_commit() -> Optional[str]:
    try:
        import subprocess
        result = subprocess.run(
            ["git", "rev-parse", "HEAD"],
            capture_output=True, text=True, timeout=5,
        )
        if result.returncode == 0:
            return result.stdout.strip()
    except Exception:
        return None


def _get_installed_packages() -> Dict[str, str]:
    try:
        import importlib.metadata as md
        return {dist.metadata["Name"]: dist.version for dist in md.distributions() if dist.metadata.get("Name")}
    except Exception:
        return {}
