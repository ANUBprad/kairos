from __future__ import annotations

from typing import Dict, List

from fastapi import APIRouter

from intelligence.config.settings import get_settings

router = APIRouter()


@router.get("/directories")
async def list_artifact_directories() -> Dict[str, str]:
    return {
        "message": "Artifact directory information is not available via API",
    }


@router.get("/models")
async def list_models() -> List[Dict[str, object]]:
    settings = get_settings()
    models_dir = settings.effective_model_registry_dir()
    if not models_dir.is_dir():
        return []
    results: List[Dict[str, object]] = []
    for entry in sorted(models_dir.iterdir()):
        if entry.is_dir():
            results.append(
                {"name": entry.name, "type": "directory"}
            )
        elif entry.suffix in (".bin", ".pt", ".pth", ".onnx", ".gguf"):
            results.append(
                {
                    "name": entry.name,
                    "size_bytes": entry.stat().st_size,
                    "type": "file",
                }
            )
    return results


@router.get("/experiments")
async def list_experiments() -> List[Dict[str, object]]:
    settings = get_settings()
    exp_dir = settings.effective_experiment_registry_dir()
    if not exp_dir.is_dir():
        return []
    results: List[Dict[str, object]] = []
    for entry in sorted(exp_dir.iterdir()):
        if entry.suffix == ".json":
            results.append(
                {
                    "name": entry.stem,
                    "size_bytes": entry.stat().st_size,
                }
            )
    return results


@router.get("/reports")
async def list_reports() -> List[Dict[str, object]]:
    settings = get_settings()
    reports_dir = settings.effective_report_output_dir()
    if not reports_dir.is_dir():
        return []
    results: List[Dict[str, object]] = []
    for entry in sorted(reports_dir.iterdir()):
        if entry.suffix in (".md", ".html", ".json", ".csv"):
            results.append(
                {
                    "name": entry.name,
                    "size_bytes": entry.stat().st_size,
                }
            )
    return results
