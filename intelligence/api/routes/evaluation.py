from __future__ import annotations

from dataclasses import asdict
from typing import Dict, List

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


@router.post("/report")
async def generate_report(evaluation_data: Dict[str, object]) -> Dict[str, object]:
    return {"report": str(evaluation_data)}
