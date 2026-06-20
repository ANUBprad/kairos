from __future__ import annotations

import json
import os
import random
from dataclasses import dataclass
from pathlib import Path
from typing import Dict, List, Optional


@dataclass
class BudgetDatasetEntry:
    query_type: str
    confidence: float
    retrieval_type: str
    top_k: int
    rerank: bool
    decompose: bool
    latency_ms: float
    fallback_triggered: bool
    success: bool


class BudgetDatasetGenerator:
    _TOP_K_OPTIONS: List[int] = [3, 5, 8, 10, 12]

    def __init__(self, seed: int = 42):
        self._rng = random.Random(seed)

    def from_calibration_jsonl(
        self,
        path: os.PathLike,
    ) -> List[BudgetDatasetEntry]:
        records: List[dict] = []
        with open(path) as f:
            for line in f:
                line = line.strip()
                if line:
                    records.append(json.loads(line))

        entries: List[BudgetDatasetEntry] = []
        for rec in records:
            confidence = rec.get("confidence", 0.5)
            success = bool(rec.get("success", False))
            fallback = bool(rec.get("fallback_triggered", False))
            latency = rec.get("latency_ms") or rec.get("total_latency_ms") or 200.0
            retrieval_type = rec.get("retrieval_type", "RETRIEVAL_TYPE_UNSPECIFIED")

            qid = rec.get("query_id", "")
            if qid.upper().startswith("COMPLEX") or "MULTI_VECTOR" in retrieval_type:
                qt = "complex"
            elif qid.upper().startswith("MULTI_HOP") or "SELF_QUERYING" in retrieval_type:
                qt = "multi_hop"
            else:
                qt = "simple"

            top_k = rec.get("top_k", 5)
            if isinstance(top_k, bool):
                top_k = 5
            rerank = bool(rec.get("rerank", False))
            decompose = bool(rec.get("decompose", False))

            entries.append(BudgetDatasetEntry(
                query_type=qt,
                confidence=confidence,
                retrieval_type=retrieval_type,
                top_k=int(top_k) if not isinstance(top_k, bool) else 5,
                rerank=rerank,
                decompose=decompose,
                latency_ms=float(latency),
                fallback_triggered=fallback,
                success=success,
            ))

        return entries

    def _simulate_outcome(
        self,
        base_success: bool,
        base_latency: float,
        confidence: float,
        top_k: int,
        rerank: bool,
        decompose: bool,
    ) -> tuple[bool, float]:
        s = 1.0 if base_success else 0.0
        s += (top_k - 5) * 0.02
        s -= 0.05 if rerank else 0.0
        s -= 0.03 if decompose else 0.0
        s = min(max(s, 0.0), 1.0)

        lat = base_latency
        lat += (top_k - 5) * 15.0
        lat += 50.0 if rerank else 0.0
        lat += 30.0 if decompose else 0.0

        success = self._rng.random() < s
        return success, lat

    def augment_with_configs(
        self,
        base_entries: List[BudgetDatasetEntry],
    ) -> List[BudgetDatasetEntry]:
        augmented: List[BudgetDatasetEntry] = list(base_entries)
        for entry in base_entries:
            for top_k in self._TOP_K_OPTIONS:
                for rerank in [False, True]:
                    for decompose in [False, True]:
                        if top_k == entry.top_k and rerank == entry.rerank and decompose == entry.decompose:
                            continue
                        success, latency = self._simulate_outcome(
                            entry.success, entry.latency_ms,
                            entry.confidence, top_k, rerank, decompose,
                        )
                        augmented.append(BudgetDatasetEntry(
                            query_type=entry.query_type,
                            confidence=entry.confidence,
                            retrieval_type=entry.retrieval_type,
                            top_k=top_k,
                            rerank=rerank,
                            decompose=decompose,
                            latency_ms=latency,
                            fallback_triggered=not success,
                            success=success,
                        ))
        return augmented

    def generate(
        self,
        calibration_path: os.PathLike,
        output_path: Optional[os.PathLike] = None,
        augment: bool = True,
    ) -> List[BudgetDatasetEntry]:
        base = self.from_calibration_jsonl(calibration_path)
        if augment:
            entries = self.augment_with_configs(base)
        else:
            entries = base

        if output_path:
            with open(output_path, "w") as f:
                for e in entries:
                    f.write(json.dumps({
                        "query_type": e.query_type,
                        "confidence": e.confidence,
                        "retrieval_type": e.retrieval_type,
                        "top_k": e.top_k,
                        "rerank": e.rerank,
                        "decompose": e.decompose,
                        "latency_ms": e.latency_ms,
                        "fallback_triggered": e.fallback_triggered,
                        "success": e.success,
                    }) + "\n")

        return entries
