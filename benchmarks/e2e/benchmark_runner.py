from __future__ import annotations

import json
import os
import time
from typing import Any, Dict, List, Optional, Sequence

from benchmarks.datasets.generator import (
    GoldDatasetEntry,
    generate_all_datasets,
    get_dataset,
    list_datasets,
)
from benchmarks.e2e.benchmark_config import BenchmarkConfig, ExecutionMode, RunMode
from benchmarks.e2e.benchmark_result import (
    E2EAggregatedResult,
    E2EBenchmarkResult,
    E2EDimensionScores,
    E2EQueryResult,
)
from intelligence.judging import (
    CompositeJudge,
    FaithfulnessJudge,
    GroundingJudge,
    HallucinationJudge,
    RelevanceJudge,
    scoring,
)
from intelligence.judging.judge import Judgment


class E2EBenchmarkRunner:
    def __init__(
        self,
        config: Optional[BenchmarkConfig] = None,
        retrievers: Optional[Dict[ExecutionMode, object]] = None,
    ) -> None:
        self.config = config or BenchmarkConfig()
        self.retrievers = retrievers or {}
        self._judge = self._build_judge()

    def _build_judge(self) -> CompositeJudge:
        judge = CompositeJudge()
        judge.add_judge(FaithfulnessJudge(), weight=self.config.judge_weights.get("faithfulness", 1.0))
        judge.add_judge(RelevanceJudge(), weight=self.config.judge_weights.get("relevance", 1.0))
        judge.add_judge(HallucinationJudge(), weight=self.config.judge_weights.get("hallucination", 1.5))
        judge.add_judge(GroundingJudge(), weight=self.config.judge_weights.get("grounding", 1.0))
        return judge

    def run(
        self,
        retriever: object,
        mode: ExecutionMode,
        domain: str,
    ) -> E2EAggregatedResult:
        entries = get_dataset(domain)
        if self.config.get_domain_limit(domain):
            entries = entries[:self.config.get_domain_limit(domain)]

        results: List[E2EQueryResult] = []
        for entry in entries:
            qr = self._run_query(entry, retriever, mode)
            results.append(qr)

        return self._aggregate(results, mode.value, domain)

    def run_all(
        self,
        domain: str,
    ) -> E2EBenchmarkResult:
        benchmark_result = E2EBenchmarkResult(domain=domain)
        for mode in self.config.execution_modes:
            retriever = self.retrievers.get(mode)
            if retriever is None:
                continue
            aggregated = self.run(retriever, mode, domain)
            benchmark_result.mode_results[mode.value] = aggregated
        return benchmark_result

    def run_all_domains(self) -> Dict[str, E2EBenchmarkResult]:
        domain_results: Dict[str, E2EBenchmarkResult] = {}
        for domain in self.config.domains:
            domain_results[domain] = self.run_all(domain)
        return domain_results

    def _run_query(
        self,
        entry: GoldDatasetEntry,
        retriever: object,
        mode: ExecutionMode,
    ) -> E2EQueryResult:
        start = time.monotonic()
        error = ""
        success = True
        documents: Sequence[str] = []

        try:
            if hasattr(retriever, "retrieve"):
                result = retriever.retrieve(
                    query=entry.question,
                    query_id=entry.query_id,
                    strategy=mode.value,
                )
                if hasattr(result, "documents"):
                    documents = [d.text for d in result.documents if hasattr(d, "text")]
                elif isinstance(result, list):
                    documents = result
            elif hasattr(retriever, "retrieve_top_k"):
                raw = retriever.retrieve_top_k(query=entry.question, top_k=self.config.top_k)
                if isinstance(raw, list):
                    documents = [r if isinstance(r, str) else str(r) for r in raw]
        except Exception as e:
            error = str(e)
            success = False

        elapsed = (time.monotonic() - start) * 1000.0

        composite_score = 0.0
        composite_judgment = "fail"
        dimension_scores: Optional[E2EDimensionScores] = None

        if self.config.include_judging and success and entry.answer:
            judge_results = self._judge.evaluate(
                query=entry.question,
                answer=entry.answer,
                context=documents,
            )
            composite_score = self._judge.composite_score(
                query=entry.question,
                answer=entry.answer,
                context=documents,
            )
            judgments_map = {r.dimension: r.judgment for r in judge_results}
            if all(j == Judgment.PASS for j in judgments_map.values()):
                composite_judgment = "pass"
            elif any(j == Judgment.FAIL for j in judgments_map.values()):
                composite_judgment = "fail"
            else:
                composite_judgment = "warn"

            dimension_scores = E2EDimensionScores(
                faithfulness=next((r.score for r in judge_results if r.dimension == "faithfulness"), 0.0),
                relevance=next((r.score for r in judge_results if r.dimension == "relevance"), 0.0),
                hallucination=next((r.score for r in judge_results if r.dimension == "hallucination"), 0.0),
                grounding=next((r.score for r in judge_results if r.dimension == "grounding"), 0.0),
            )

        return E2EQueryResult(
            query_id=entry.query_id,
            query=entry.question,
            domain=entry.domain,
            query_type=entry.difficulty,
            execution_mode=mode.value,
            latency_ms=elapsed,
            num_docs=len(documents),
            confidence=0.5,
            success=success,
            error=error,
            dimension_scores=dimension_scores,
            composite_score=composite_score,
            composite_judgment=composite_judgment,
        )

    def _aggregate(
        self,
        results: List[E2EQueryResult],
        mode: str,
        domain: str,
    ) -> E2EAggregatedResult:
        n = len(results)
        if n == 0:
            return E2EAggregatedResult(execution_mode=mode, domain=domain)

        successes = sum(1 for r in results if r.success)
        passes = sum(1 for r in results if r.composite_judgment == "pass")
        fails = sum(1 for r in results if r.composite_judgment == "fail")
        warns = sum(1 for r in results if r.composite_judgment == "warn")

        total_latency = sum(r.latency_ms for r in results)
        total_confidence = sum(r.confidence for r in results)
        total_docs = sum(r.num_docs for r in results)

        scored_results = [r for r in results if r.dimension_scores is not None]
        if scored_results:
            dim_avg = E2EDimensionScores(
                faithfulness=sum(r.dimension_scores.faithfulness for r in scored_results) / len(scored_results),
                relevance=sum(r.dimension_scores.relevance for r in scored_results) / len(scored_results),
                hallucination=sum(r.dimension_scores.hallucination for r in scored_results) / len(scored_results),
                grounding=sum(r.dimension_scores.grounding for r in scored_results) / len(scored_results),
            )
            avg_composite = sum(r.composite_score for r in scored_results) / len(scored_results)
        else:
            dim_avg = None
            avg_composite = 0.0

        return E2EAggregatedResult(
            execution_mode=mode,
            domain=domain,
            num_queries=n,
            success_rate=successes / n,
            avg_latency_ms=total_latency / n,
            avg_composite_score=avg_composite,
            avg_confidence=total_confidence / n,
            avg_docs=total_docs / n,
            dimension_averages=dim_avg,
            pass_rate=passes / n,
            fail_rate=fails / n,
            warn_rate=warns / n,
            per_query=results,
        )

    def save_results(
        self,
        results: Dict[str, E2EBenchmarkResult],
        output_dir: Optional[str] = None,
    ) -> str:
        out = output_dir or self.config.output_dir
        os.makedirs(out, exist_ok=True)
        for domain, domain_result in results.items():
            path = os.path.join(out, f"{domain}_benchmark.json")
            with open(path, "w") as f:
                json.dump(domain_result.to_dict(), f, indent=2)
        summary_path = os.path.join(out, "summary.json")
        summary = {
            domain: br.to_dict() for domain, br in results.items()
        }
        with open(summary_path, "w") as f:
            json.dump(summary, f, indent=2)
        return out
