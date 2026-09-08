from __future__ import annotations

from dataclasses import asdict
from typing import Dict, List, Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from intelligence.evaluation.evaluator import Evaluator
from intelligence.evaluation.ground_truth import GroundTruth, GroundTruthEntry

router = APIRouter()


class EvaluationRequest(BaseModel):
    retrieved: List[List[str]]
    relevant: List[List[str]]


class GroundTruthAddRequest(BaseModel):
    query: str
    relevant_docs: List[str]
    query_type: str = "simple"
    query_id: str = ""


class RunRequest(BaseModel):
    namespace: str
    dataset_name: str
    dataset_path: Optional[str] = None
    top_k: Optional[int] = None
    max_entries: Optional[int] = None
    generate: bool = True
    judge: bool = True
    use_llm_judges: bool = False


@router.post("/evaluate")
async def run_evaluation(body: EvaluationRequest) -> Dict[str, object]:
    if len(body.retrieved) != len(body.relevant):
        raise HTTPException(
            status_code=400, detail="retrieved and relevant must have the same length"
        )
    if not body.retrieved:
        raise HTTPException(status_code=400, detail="at least one query required")

    evaluator = Evaluator()
    relevant_sets = [set(r) for r in body.relevant]
    result = evaluator.evaluate(body.retrieved, relevant_sets)
    return result.to_dict()


@router.post("/run")
def run_evaluation_entry(body: RunRequest) -> Dict[str, object]:
    from intelligence.evaluation.factory import run_dataset
    from intelligence.evaluation.run_config import RunConfig

    config = RunConfig(
        namespace=body.namespace,
        dataset_name=body.dataset_name,
        dataset_path=body.dataset_path,
        generate=body.generate,
        judge=body.judge,
        top_k=body.top_k,
        max_entries=body.max_entries,
    )
    result = run_dataset(
        config,
        dataset_path=body.dataset_path,
        use_llm_judges=body.use_llm_judges,
    )
    payload = result.to_dict()
    payload["trace_id"] = result.results[0].trace_id if result.results else ""
    return payload


@router.get("/ground-truth")
async def list_ground_truth() -> Dict[str, object]:
    gt = GroundTruth()
    return {"count": gt.count, "entries": [asdict(e) for e in gt.entries]}


@router.post("/ground-truth")
async def add_ground_truth(body: GroundTruthAddRequest) -> Dict[str, object]:
    gt = GroundTruth()
    entry = GroundTruthEntry(
        query=body.query,
        query_id=body.query_id,
        query_type=body.query_type,
        relevant_docs=set(body.relevant_docs),
    )
    gt.add_entry(entry)
    return {
        "status": "added",
        "query": body.query,
        "query_type": body.query_type,
        "num_relevant": len(body.relevant_docs),
    }
