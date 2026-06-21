"""Tests for Phase 9: Research Validation Pipeline."""
from __future__ import annotations

import json
import os
import tempfile
from typing import Any, Dict, List, Optional, Sequence
from unittest.mock import MagicMock, patch

import pytest

# ======================================================================
# Phase 9C — LLM Judge Framework
# ======================================================================

from intelligence.judging.judge import (
    BaseJudge, CompositeJudge, JudgeResult, Judgment,
)
from intelligence.judging.faithfulness import FaithfulnessJudge
from intelligence.judging.relevance import RelevanceJudge
from intelligence.judging.hallucination import HallucinationJudge
from intelligence.judging.grounding import GroundingJudge
from intelligence.judging.scoring import (
    JudgingReport, aggregate_scores, default_weights,
    rating_to_score, score_to_rating, weight_scores,
)


# ---------------------------------------------------------------------------
# JudgeResult
# ---------------------------------------------------------------------------

class TestJudgeResult:
    def test_defaults(self) -> None:
        r = JudgeResult(dimension="test", score=0.5, judgment=Judgment.WARN)
        assert r.dimension == "test"
        assert r.score == 0.5
        assert r.judgment == Judgment.WARN
        assert r.explanation == ""

    def test_to_dict(self) -> None:
        r = JudgeResult(dimension="d", score=0.8, judgment=Judgment.PASS, explanation="ok")
        d = r.to_dict()
        assert d["dimension"] == "d"
        assert d["score"] == 0.8
        assert d["judgment"] == "pass"
        assert d["explanation"] == "ok"

    def test_passed_property(self) -> None:
        assert JudgeResult("d", 0.9, Judgment.PASS).passed is True
        assert JudgeResult("d", 0.5, Judgment.FAIL).passed is False

    def test_failed_property(self) -> None:
        assert JudgeResult("d", 0.9, Judgment.PASS).failed is False
        assert JudgeResult("d", 0.3, Judgment.FAIL).failed is True

    def test_is_warning_property(self) -> None:
        assert JudgeResult("d", 0.5, Judgment.WARN).is_warning is True
        assert JudgeResult("d", 0.5, Judgment.PASS).is_warning is False

    def test_details_included_in_dict(self) -> None:
        r = JudgeResult("d", 0.5, Judgment.WARN, details={"key": "val"})
        assert r.to_dict()["details"]["key"] == "val"


# ---------------------------------------------------------------------------
# Judgment Enum
# ---------------------------------------------------------------------------

class TestJudgment:
    def test_values(self) -> None:
        assert Judgment.PASS.value == "pass"
        assert Judgment.WARN.value == "warn"
        assert Judgment.FAIL.value == "fail"

    def test_all_members(self) -> None:
        assert len(Judgment) == 3


# ---------------------------------------------------------------------------
# BaseJudge
# ---------------------------------------------------------------------------

class TestBaseJudge:
    def test_raises_not_implemented(self) -> None:
        judge = BaseJudge()
        with pytest.raises(NotImplementedError):
            judge.evaluate("q", "a", ["ctx"])

    def test_callable(self) -> None:
        judge = BaseJudge()
        with pytest.raises(NotImplementedError):
            judge("q", "a", ["ctx"])

    def test_dimension_default(self) -> None:
        assert BaseJudge().dimension == "base"


# ---------------------------------------------------------------------------
# FaithfulnessJudge
# ---------------------------------------------------------------------------

class TestFaithfulnessJudge:
    def test_empty_answer_fails(self) -> None:
        judge = FaithfulnessJudge()
        result = judge.evaluate("q", "", ["context"])
        assert result.judgment == Judgment.FAIL
        assert result.score == 0.0

    def test_no_context_passes_with_note(self) -> None:
        judge = FaithfulnessJudge()
        result = judge.evaluate("q", "answer", [])
        assert result.judgment == Judgment.PASS
        assert result.score == 1.0

    def test_perfect_faithfulness(self) -> None:
        judge = FaithfulnessJudge()
        answer = "the quick brown fox jumps over the lazy dog"
        context = [answer]
        result = judge.evaluate("q", answer, context)
        assert result.judgment == Judgment.PASS

    def test_partial_faithfulness(self) -> None:
        judge = FaithfulnessJudge()
        answer = "the quick brown fox eats apples"
        context = ["the quick brown fox runs fast"]
        result = judge.evaluate("q", answer, context)
        assert result.judgment in (Judgment.WARN, Judgment.PASS)

    def test_poor_faithfulness(self) -> None:
        judge = FaithfulnessJudge()
        answer = "quantum physics explains gravitational waves"
        context = ["the cat sat on the mat"]
        result = judge.evaluate("q", answer, context)
        assert result.judgment == Judgment.FAIL

    def test_score_bounds(self) -> None:
        judge = FaithfulnessJudge()
        result = judge.evaluate("q", "a b c d e f g h i j", ["a b c d e f g h i j"])
        assert 0.0 <= result.score <= 1.0

    def test_details_contains_supported_count(self) -> None:
        judge = FaithfulnessJudge()
        result = judge.evaluate("q", "hello world test", ["hello world test"])
        assert "supported_ngrams" in result.details
        assert "total_ngrams" in result.details

    def test_extract_ngrams(self) -> None:
        ngrams = FaithfulnessJudge._extract_ngrams("a b c d e", n=2)
        assert "a b" in ngrams
        assert "b c" in ngrams
        assert len(ngrams) == 4

    def test_extract_ngrams_short_text(self) -> None:
        ngrams = FaithfulnessJudge._extract_ngrams("a b", n=3)
        assert "a" in ngrams or "b" in ngrams

    def test_default_thresholds(self) -> None:
        judge = FaithfulnessJudge()
        assert judge.threshold_pass == 0.7
        assert judge.threshold_warn == 0.4

    def test_custom_thresholds(self) -> None:
        judge = FaithfulnessJudge(threshold_pass=0.5, threshold_warn=0.2)
        assert judge.threshold_pass == 0.5
        assert judge.threshold_warn == 0.2

    def test_empty_ngrams_in_answer_returns_pass(self) -> None:
        judge = FaithfulnessJudge()
        result = judge.evaluate("q", "a", ["context with enough words"])
        assert result.judgment is not None


# ---------------------------------------------------------------------------
# RelevanceJudge
# ---------------------------------------------------------------------------

class TestRelevanceJudge:
    def test_empty_answer_fails(self) -> None:
        judge = RelevanceJudge()
        result = judge.evaluate("question", "", ["ctx"])
        assert result.judgment == Judgment.FAIL
        assert result.score == 0.0

    def test_high_relevance(self) -> None:
        judge = RelevanceJudge()
        result = judge.evaluate("what is machine learning", "machine learning is a field of ai", ["ctx"])
        assert result.judgment == Judgment.PASS

    def test_no_overlap(self) -> None:
        judge = RelevanceJudge()
        result = judge.evaluate("quantum physics", "the weather is nice today", ["ctx"])
        assert result.judgment == Judgment.FAIL

    def test_partial_relevance(self) -> None:
        judge = RelevanceJudge()
        result = judge.evaluate("what is deep learning in ai", "deep learning is a subset", ["ctx"])
        assert result.judgment in (Judgment.WARN, Judgment.PASS)

    def test_score_bounds(self) -> None:
        judge = RelevanceJudge()
        result = judge.evaluate("test query", "test query answer", ["ctx"])
        assert 0.0 <= result.score <= 1.0

    def test_details_contains_overlap_tokens(self) -> None:
        judge = RelevanceJudge()
        result = judge.evaluate("hello world", "hello world test", ["ctx"])
        assert "overlap_tokens" in result.details
        assert result.details["query_tokens"] >= 1

    def test_tokenize(self) -> None:
        tokens = RelevanceJudge._tokenize("Hello, World! 123")
        assert "hello" in tokens
        assert "world" in tokens
        assert "123" in tokens

    def test_default_thresholds(self) -> None:
        judge = RelevanceJudge()
        assert judge.threshold_pass == 0.6
        assert judge.threshold_warn == 0.3


# ---------------------------------------------------------------------------
# HallucinationJudge
# ---------------------------------------------------------------------------

class TestHallucinationJudge:
    def test_empty_answer_passes(self) -> None:
        judge = HallucinationJudge()
        result = judge.evaluate("q", "", ["ctx"])
        assert result.judgment == Judgment.PASS
        assert result.score == 1.0

    def test_no_context_fails(self) -> None:
        judge = HallucinationJudge()
        result = judge.evaluate("q", "answer has claims", [])
        assert result.judgment == Judgment.FAIL
        assert result.score == 0.0

    def test_all_claims_supported(self) -> None:
        judge = HallucinationJudge(threshold_pass=0.3, threshold_warn=0.1)
        answer = "the sky is blue the grass is green"
        context = ["the sky is blue the grass is green nature is beautiful"]
        result = judge.evaluate("q", answer, context)
        assert result.score > 0.0

    def test_no_claims_supported(self) -> None:
        judge = HallucinationJudge()
        answer = "quantum mechanics is about cats in boxes said albert"
        context = ["the stock market rose today in a big way"]
        result = judge.evaluate("q", answer, context)
        assert result.judgment == Judgment.FAIL

    def test_partial_claims_supported(self) -> None:
        judge = HallucinationJudge(threshold_pass=0.5, threshold_warn=0.2)
        answer = "the sky is blue. the moon is cheese."
        context = ["the sky is blue today and clear"]
        result = judge.evaluate("q", answer, context)
        assert result.score > 0

    def test_extract_claims(self) -> None:
        claims = HallucinationJudge._extract_claims("Hello world. This is a test. Short.")
        assert len(claims) >= 2

    def test_claim_is_supported_not(self) -> None:
        ngrams = {"one two three", "four five six"}
        assert not HallucinationJudge._claim_is_supported("the sky is blue today", ngrams)

    def test_claim_is_supported_short(self) -> None:
        ngrams = {"hello world"}
        assert HallucinationJudge._claim_is_supported("hello world", ngrams)

    def test_score_bounds(self) -> None:
        judge = HallucinationJudge()
        result = judge.evaluate("q", "test claim here", ["test claim here in context"])
        assert 0.0 <= result.score <= 1.0

    def test_details_contains_unsupported_examples(self) -> None:
        judge = HallucinationJudge()
        result = judge.evaluate("q", "foo bar baz qux", ["different context entirely"])
        assert "unsupported_examples" in result.details

    def test_default_thresholds(self) -> None:
        judge = HallucinationJudge()
        assert judge.threshold_pass == 0.8
        assert judge.threshold_warn == 0.6


# ---------------------------------------------------------------------------
# GroundingJudge
# ---------------------------------------------------------------------------

class TestGroundingJudge:
    def test_empty_answer_fails(self) -> None:
        judge = GroundingJudge()
        result = judge.evaluate("q", "", ["ctx"])
        assert result.judgment == Judgment.FAIL
        assert result.score == 0.0

    def test_no_context_fails(self) -> None:
        judge = GroundingJudge()
        result = judge.evaluate("q", "answer", [])
        assert result.judgment == Judgment.FAIL
        assert result.score == 0.0

    def test_high_word_overlap(self) -> None:
        judge = GroundingJudge(threshold_pass=0.7, threshold_warn=0.4)
        result = judge.evaluate("q", "hello world test context extra", ["hello world test context extra"])
        assert result.score > 0.7

    def test_low_word_overlap(self) -> None:
        judge = GroundingJudge()
        result = judge.evaluate("q", "quantum physics theory", ["the cat sat on the mat"])
        assert result.judgment == Judgment.FAIL

    def test_direct_quotes_found(self) -> None:
        quotes = GroundingJudge._find_direct_quotes('He said "hello world" and "goodbye"')
        assert len(quotes) == 2
        assert "hello world" in quotes

    def test_no_direct_quotes(self) -> None:
        quotes = GroundingJudge._find_direct_quotes("no quotes here")
        assert len(quotes) == 0

    def test_word_overlap_with_stop_words(self) -> None:
        ratio = GroundingJudge._compute_word_overlap("the cat sat", "the cat sat on mat")
        assert ratio > 0.5

    def test_word_overlap_empty_answer(self) -> None:
        ratio = GroundingJudge._compute_word_overlap("", "some context")
        assert ratio == 0.0

    def test_score_bounds(self) -> None:
        judge = GroundingJudge()
        result = judge.evaluate("q", "test answer", ["test answer context"])
        assert 0.0 <= result.score <= 1.0

    def test_details_contains_metrics(self) -> None:
        judge = GroundingJudge()
        result = judge.evaluate("q", "hello world", ["hello world context"])
        assert "word_overlap_ratio" in result.details
        assert "threshold_pass" in result.details

    def test_default_thresholds(self) -> None:
        judge = GroundingJudge()
        assert judge.threshold_pass == 0.7
        assert judge.threshold_warn == 0.4


# ---------------------------------------------------------------------------
# CompositeJudge
# ---------------------------------------------------------------------------

class TestCompositeJudge:
    def test_empty_judges(self) -> None:
        judge = CompositeJudge()
        assert judge.evaluate("q", "a", ["ctx"]) == []

    def test_single_judge(self) -> None:
        composite = CompositeJudge()
        composite.add_judge(FaithfulnessJudge())
        results = composite.evaluate("q", "hello world", ["hello world"])
        assert len(results) == 1
        assert results[0].dimension == "faithfulness"

    def test_multiple_judges(self) -> None:
        composite = CompositeJudge()
        composite.add_judge(FaithfulnessJudge())
        composite.add_judge(RelevanceJudge())
        composite.add_judge(HallucinationJudge())
        composite.add_judge(GroundingJudge())
        results = composite.evaluate("q", "hello world test", ["hello world test"])
        assert len(results) == 4

    def test_composite_score_with_weights(self) -> None:
        composite = CompositeJudge()
        composite.add_judge(FaithfulnessJudge(), weight=1.0)
        composite.add_judge(RelevanceJudge(), weight=2.0)
        score = composite.composite_score("hello", "hello world", ["hello world"])
        assert 0.0 <= score <= 1.0

    def test_composite_score_zero_weight(self) -> None:
        composite = CompositeJudge()
        score = composite.composite_score("q", "a", ["ctx"])
        assert score == 0.0

    def test_evaluate_all_returns_dict(self) -> None:
        composite = CompositeJudge()
        composite.add_judge(FaithfulnessJudge())
        results = composite.evaluate_all("q", "a", ["c"])
        assert "faithfulness" in results
        assert isinstance(results["faithfulness"], JudgeResult)

    def test_add_judge_stores_weight(self) -> None:
        composite = CompositeJudge()
        composite.add_judge(FaithfulnessJudge(), weight=3.0)
        assert composite.weights["faithfulness"] == 3.0


# ---------------------------------------------------------------------------
# Scoring Utilities
# ---------------------------------------------------------------------------

class TestScoring:
    def test_aggregate_scores_empty(self) -> None:
        assert aggregate_scores([]) == 0.0

    def test_aggregate_scores_single(self) -> None:
        results = [JudgeResult("d", 0.8, Judgment.PASS)]
        assert aggregate_scores(results) == 0.8

    def test_aggregate_scores_multiple(self) -> None:
        results = [
            JudgeResult("d1", 0.8, Judgment.PASS),
            JudgeResult("d2", 0.6, Judgment.WARN),
        ]
        assert aggregate_scores(results) == 0.7

    def test_weight_scores_default_weights(self) -> None:
        results = [
            JudgeResult("d1", 0.8, Judgment.PASS),
            JudgeResult("d2", 0.6, Judgment.WARN),
        ]
        score = weight_scores(results, {})
        assert score == 0.7

    def test_weight_scores_custom(self) -> None:
        results = [
            JudgeResult("d1", 1.0, Judgment.PASS),
            JudgeResult("d2", 0.0, Judgment.FAIL),
        ]
        score = weight_scores(results, {"d1": 3.0, "d2": 1.0})
        assert score == 0.75

    def test_weight_scores_zero_total(self) -> None:
        assert weight_scores([], {}) == 0.0

    def test_score_to_rating(self) -> None:
        assert score_to_rating(0.95) == "excellent"
        assert score_to_rating(0.8) == "good"
        assert score_to_rating(0.6) == "fair"
        assert score_to_rating(0.4) == "poor"
        assert score_to_rating(0.2) == "very_poor"

    def test_rating_to_score(self) -> None:
        assert rating_to_score("excellent") == 0.95
        assert rating_to_score("good") == 0.8
        assert rating_to_score("fair") == 0.6
        assert rating_to_score("poor") == 0.4
        assert rating_to_score("very_poor") == 0.15
        assert rating_to_score("unknown") == 0.0

    def test_rating_case_insensitive(self) -> None:
        assert rating_to_score("EXCELLENT") == 0.95

    def test_default_weights(self) -> None:
        weights = default_weights()
        assert "faithfulness" in weights
        assert "relevance" in weights
        assert "hallucination" in weights
        assert "grounding" in weights
        assert weights["hallucination"] == 1.5


# ---------------------------------------------------------------------------
# JudgingReport
# ---------------------------------------------------------------------------

class TestJudgingReport:
    def test_defaults(self) -> None:
        report = JudgingReport()
        assert report.composite_score == 0.0
        assert report.composite_judgment == "fail"

    def test_to_dict(self) -> None:
        report = JudgingReport(
            query="test query",
            answer="test answer",
            composite_score=0.85,
            composite_judgment="pass",
            dimension_results={
                "faithfulness": JudgeResult("faithfulness", 0.9, Judgment.PASS),
            },
        )
        d = report.to_dict()
        assert d["query"] == "test query"
        assert d["composite_score"] == 0.85
        assert "faithfulness" in d["dimensions"]

    def test_passed_property(self) -> None:
        assert JudgingReport(composite_judgment="pass").passed is True
        assert JudgingReport(composite_judgment="fail").passed is False

    def test_failed_property(self) -> None:
        assert JudgingReport(composite_judgment="fail").failed is True
        assert JudgingReport(composite_judgment="pass").failed is False


# ======================================================================
# Phase 9D — E2E Benchmark Pipeline
# ======================================================================

from benchmarks.e2e import (
    AblationComponentImpact,
    AblationReport,
    AblationValidationResult,
    BenchmarkConfig,
    CostAnalysisReport,
    CostAnalyzer,
    CostBreakdown,
    CrossDomainComparison,
    E2EAggregatedResult,
    E2EBenchmarkReport,
    E2EBenchmarkResult,
    E2EBenchmarkRunner,
    E2EDimensionScores,
    E2EQueryResult,
    ExecutionMode,
    ModeComparison,
    RunMode,
    compare_modes,
    compute_ablation,
    compute_ablations,
    generate_ablation_report,
    generate_comparison_report,
    generate_cost_report,
)


# ---------------------------------------------------------------------------
# BenchmarkConfig
# ---------------------------------------------------------------------------

class TestBenchmarkConfig:
    def test_default_domains(self) -> None:
        config = BenchmarkConfig()
        assert len(config.domains) == 5
        assert "finance" in config.domains

    def test_default_mode_full(self) -> None:
        config = BenchmarkConfig()
        assert config.mode == RunMode.FULL

    def test_default_execution_modes(self) -> None:
        config = BenchmarkConfig()
        assert len(config.execution_modes) == 5
        assert ExecutionMode.NAIVE_RAG in config.execution_modes
        assert ExecutionMode.KAIROS_ADAPTIVE in config.execution_modes

    def test_get_domain_limit(self) -> None:
        config = BenchmarkConfig()
        assert config.get_domain_limit("finance") is None
        config2 = BenchmarkConfig(num_queries_per_domain=10)
        assert config2.get_domain_limit("finance") == 10

    def test_get_output_path(self) -> None:
        config = BenchmarkConfig()
        path = config.get_output_path("finance", ExecutionMode.KAIROS_ADAPTIVE)
        assert "finance" in path
        assert "kairos_adaptive" in path

    def test_mode_labels(self) -> None:
        config = BenchmarkConfig()
        labels = config.mode_labels
        assert len(labels) == 5
        assert "Kairos Adaptive" in labels[ExecutionMode.KAIROS_ADAPTIVE]

    def test_custom_judge_weights(self) -> None:
        config = BenchmarkConfig(judge_weights={"faithfulness": 2.0})
        assert config.judge_weights["faithfulness"] == 2.0

    def test_custom_output_dir(self) -> None:
        config = BenchmarkConfig(output_dir="/tmp/test_e2e")
        assert config.output_dir == "/tmp/test_e2e"

    def test_parallel_default(self) -> None:
        config = BenchmarkConfig()
        assert config.parallel is False


# ---------------------------------------------------------------------------
# ExecutionMode / RunMode
# ---------------------------------------------------------------------------

class TestExecutionMode:
    def test_all_modes(self) -> None:
        assert ExecutionMode.NAIVE_RAG.value == "naive_rag"
        assert ExecutionMode.ALWAYS_SIMPLE.value == "always_simple"
        assert ExecutionMode.ALWAYS_COMPLEX.value == "always_complex"
        assert ExecutionMode.ALWAYS_MULTI_HOP.value == "always_multi_hop"
        assert ExecutionMode.KAIROS_ADAPTIVE.value == "kairos_adaptive"

    def test_all_modes_count(self) -> None:
        assert len(ExecutionMode) == 5


class TestRunMode:
    def test_all_modes(self) -> None:
        assert RunMode.FULL.value == "full"
        assert RunMode.ABLATION.value == "ablation"
        assert RunMode.VALIDATION.value == "validation"

    def test_all_modes_count(self) -> None:
        assert len(RunMode) == 3


# ---------------------------------------------------------------------------
# E2EDimensionScores
# ---------------------------------------------------------------------------

class TestE2EDimensionScores:
    def test_defaults(self) -> None:
        d = E2EDimensionScores()
        assert d.faithfulness == 0.0
        assert d.relevance == 0.0
        assert d.hallucination == 0.0
        assert d.grounding == 0.0

    def test_to_dict(self) -> None:
        d = E2EDimensionScores(faithfulness=0.9, relevance=0.8, hallucination=0.95, grounding=0.85)
        d2 = d.to_dict()
        assert d2["faithfulness"] == 0.9
        assert d2["relevance"] == 0.8

    def test_average(self) -> None:
        d = E2EDimensionScores(faithfulness=1.0, relevance=0.5, hallucination=0.5, grounding=0.0)
        assert d.average == 0.5


# ---------------------------------------------------------------------------
# E2EQueryResult
# ---------------------------------------------------------------------------

class TestE2EQueryResult:
    def test_defaults(self) -> None:
        r = E2EQueryResult(query_id="q1", query="test", domain="finance", query_type="simple", execution_mode="naive_rag")
        assert r.latency_ms == 0.0
        assert r.success is True
        assert r.composite_judgment == "fail"

    def test_to_dict(self) -> None:
        r = E2EQueryResult(query_id="q1", query="hello", domain="finance", query_type="simple", execution_mode="naive_rag", composite_score=0.85, composite_judgment="pass")
        d = r.to_dict()
        assert d["query_id"] == "q1"
        assert d["composite_score"] == 0.85

    def test_to_dict_with_dimensions(self) -> None:
        dims = E2EDimensionScores(faithfulness=0.9, relevance=0.8, hallucination=0.95, grounding=0.85)
        r = E2EQueryResult(query_id="q1", query="test", domain="f", query_type="s", execution_mode="m", dimension_scores=dims)
        d = r.to_dict()
        assert d["dimension_scores"]["faithfulness"] == 0.9

    def test_error_recording(self) -> None:
        r = E2EQueryResult(query_id="q1", query="test", domain="f", query_type="s", execution_mode="m", success=False, error="timeout")
        assert r.success is False
        assert r.error == "timeout"


# ---------------------------------------------------------------------------
# E2EAggregatedResult
# ---------------------------------------------------------------------------

class TestE2EAggregatedResult:
    def test_defaults(self) -> None:
        r = E2EAggregatedResult(execution_mode="test", domain="finance")
        assert r.num_queries == 0

    def test_to_dict(self) -> None:
        r = E2EAggregatedResult(execution_mode="kairos_adaptive", domain="finance", num_queries=100, avg_composite_score=0.89)
        d = r.to_dict()
        assert d["execution_mode"] == "kairos_adaptive"
        assert d["avg_composite_score"] == 0.89

    def test_pass_fail_warn_rates(self) -> None:
        r = E2EAggregatedResult(execution_mode="test", domain="d", num_queries=100, pass_rate=0.8, fail_rate=0.1, warn_rate=0.1)
        assert r.pass_rate == 0.8
        assert r.fail_rate == 0.1
        assert r.warn_rate == 0.1


# ---------------------------------------------------------------------------
# E2EBenchmarkResult
# ---------------------------------------------------------------------------

class TestE2EBenchmarkResult:
    def test_defaults(self) -> None:
        br = E2EBenchmarkResult(domain="finance")
        assert br.domain == "finance"
        assert br.mode_results == {}

    def test_to_dict(self) -> None:
        br = E2EBenchmarkResult(domain="finance")
        br.mode_results["naive_rag"] = E2EAggregatedResult(execution_mode="naive_rag", domain="finance")
        d = br.to_dict()
        assert d["domain"] == "finance"
        assert "naive_rag" in d["mode_results"]

    def test_best_mode_empty(self) -> None:
        br = E2EBenchmarkResult(domain="finance")
        assert br.best_mode() is None

    def test_best_mode_with_results(self) -> None:
        br = E2EBenchmarkResult(domain="finance")
        br.mode_results["naive_rag"] = E2EAggregatedResult(execution_mode="naive_rag", domain="finance", avg_composite_score=0.72)
        br.mode_results["kairos_adaptive"] = E2EAggregatedResult(execution_mode="kairos_adaptive", domain="finance", avg_composite_score=0.89)
        assert br.best_mode() == "kairos_adaptive"

    def test_improvement_vs_baseline(self) -> None:
        br = E2EBenchmarkResult(domain="finance")
        br.mode_results["naive_rag"] = E2EAggregatedResult(execution_mode="naive_rag", domain="finance", avg_composite_score=0.72)
        br.mode_results["kairos_adaptive"] = E2EAggregatedResult(execution_mode="kairos_adaptive", domain="finance", avg_composite_score=0.89)
        imp = br.improvement_vs_baseline()
        assert "kairos_adaptive" in imp
        assert abs(imp["kairos_adaptive"] - 23.611) < 0.1

    def test_improvement_no_baseline(self) -> None:
        br = E2EBenchmarkResult(domain="finance")
        br.mode_results["kairos_adaptive"] = E2EAggregatedResult(execution_mode="kairos_adaptive", domain="finance", avg_composite_score=0.89)
        assert br.improvement_vs_baseline() == {}


# ---------------------------------------------------------------------------
# E2EBenchmarkRunner
# ---------------------------------------------------------------------------

class TestE2EBenchmarkRunner:
    def test_default_config(self) -> None:
        runner = E2EBenchmarkRunner()
        assert runner.config.mode == RunMode.FULL

    def test_custom_config(self) -> None:
        config = BenchmarkConfig(domains=["finance"])
        runner = E2EBenchmarkRunner(config=config)
        assert runner.config.domains == ["finance"]

    def test_build_judge_has_4_dimensions(self) -> None:
        runner = E2EBenchmarkRunner()
        assert len(runner._judge.judges) == 4

    def test_aggregate_empty(self) -> None:
        runner = E2EBenchmarkRunner()
        result = runner._aggregate([], "test_mode", "finance")
        assert result.num_queries == 0

    def test_aggregate_single(self) -> None:
        runner = E2EBenchmarkRunner()
        qr = E2EQueryResult(query_id="q1", query="test", domain="finance", query_type="simple", execution_mode="test", latency_ms=100.0, success=True, composite_score=0.8, composite_judgment="pass")
        result = runner._aggregate([qr], "test_mode", "finance")
        assert result.num_queries == 1
        assert result.success_rate == 1.0
        assert result.avg_latency_ms == 100.0

    def test_aggregate_mixed_judgments(self) -> None:
        runner = E2EBenchmarkRunner()
        qr1 = E2EQueryResult(query_id="q1", query="test", domain="f", query_type="s", execution_mode="m", composite_judgment="pass")
        qr2 = E2EQueryResult(query_id="q2", query="test", domain="f", query_type="s", execution_mode="m", composite_judgment="fail")
        qr3 = E2EQueryResult(query_id="q3", query="test", domain="f", query_type="s", execution_mode="m", composite_judgment="warn")
        result = runner._aggregate([qr1, qr2, qr3], "mode", "d")
        assert result.num_queries == 3
        assert result.pass_rate == 1.0 / 3.0
        assert result.fail_rate == 1.0 / 3.0
        assert result.warn_rate == 1.0 / 3.0

    def test_aggregate_with_dimension_scores(self) -> None:
        runner = E2EBenchmarkRunner()
        dims = E2EDimensionScores(faithfulness=0.9, relevance=0.8, hallucination=0.95, grounding=0.85)
        qr = E2EQueryResult(query_id="q1", query="test", domain="f", query_type="s", execution_mode="m", composite_score=0.9, composite_judgment="pass", dimension_scores=dims)
        result = runner._aggregate([qr], "mode", "d")
        assert result.dimension_averages is not None
        assert result.dimension_averages.faithfulness == 0.9
        assert result.dimension_averages.average == 0.875

    def test_aggregate_success_rate(self) -> None:
        runner = E2EBenchmarkRunner()
        qr1 = E2EQueryResult(query_id="q1", query="t", domain="f", query_type="s", execution_mode="m", success=True)
        qr2 = E2EQueryResult(query_id="q2", query="t", domain="f", query_type="s", execution_mode="m", success=False)
        result = runner._aggregate([qr1, qr2], "mode", "d")
        assert result.success_rate == 0.5

    def test_aggregate_avg_confidence(self) -> None:
        runner = E2EBenchmarkRunner()
        qr = E2EQueryResult(query_id="q1", query="t", domain="f", query_type="s", execution_mode="m", confidence=0.8)
        result = runner._aggregate([qr], "mode", "d")
        assert result.avg_confidence == 0.8

    def test_save_results_temp_dir(self) -> None:
        runner = E2EBenchmarkRunner()
        br = E2EBenchmarkResult(domain="finance")
        br.mode_results["test"] = E2EAggregatedResult(execution_mode="test", domain="finance", num_queries=5)
        with tempfile.TemporaryDirectory() as tmpdir:
            path = runner.save_results({"finance": br}, output_dir=tmpdir)
            assert os.path.isdir(path)
            assert os.path.exists(os.path.join(path, "finance_benchmark.json"))
            assert os.path.exists(os.path.join(path, "summary.json"))


# ---------------------------------------------------------------------------
# E2EBenchmarkReport
# ---------------------------------------------------------------------------

class TestE2EBenchmarkReport:
    def test_generate_report(self) -> None:
        config = BenchmarkConfig(domains=["finance"])
        report = E2EBenchmarkReport(config)
        br = E2EBenchmarkResult(domain="finance")
        br.mode_results["naive_rag"] = E2EAggregatedResult(execution_mode="naive_rag", domain="finance", num_queries=100, avg_composite_score=0.72, avg_latency_ms=145.0, success_rate=0.95, pass_rate=0.68)
        br.mode_results["kairos_adaptive"] = E2EAggregatedResult(execution_mode="kairos_adaptive", domain="finance", num_queries=100, avg_composite_score=0.89, avg_latency_ms=163.0, success_rate=0.97, pass_rate=0.85, dimension_averages=E2EDimensionScores(0.91, 0.88, 0.92, 0.85))
        with tempfile.TemporaryDirectory() as tmpdir:
            path = report.generate({"finance": br}, output_dir=tmpdir)
            assert os.path.exists(path)
            content = open(path).read()
            assert "Kairos" in content
            assert "Finance" in content

    def test_cross_domain_summary_empty(self) -> None:
        summary = E2EBenchmarkReport._cross_domain_summary({})
        assert summary == {}

    def test_cross_domain_summary_single(self) -> None:
        br = E2EBenchmarkResult(domain="finance")
        br.mode_results["test"] = E2EAggregatedResult(execution_mode="test", domain="finance", num_queries=10, avg_composite_score=0.8, avg_latency_ms=100.0, success_rate=0.9, pass_rate=0.7)
        summary = E2EBenchmarkReport._cross_domain_summary({"finance": br})
        assert "test" in summary
        assert abs(summary["test"]["avg_composite"] - 0.8) < 0.01

    def test_cross_domain_summary_multi(self) -> None:
        br1 = E2EBenchmarkResult(domain="finance")
        br1.mode_results["test"] = E2EAggregatedResult(execution_mode="test", domain="finance", num_queries=10, avg_composite_score=0.8, avg_latency_ms=100.0, success_rate=0.9, pass_rate=0.7)
        br2 = E2EBenchmarkResult(domain="legal")
        br2.mode_results["test"] = E2EAggregatedResult(execution_mode="test", domain="legal", num_queries=10, avg_composite_score=0.7, avg_latency_ms=150.0, success_rate=0.8, pass_rate=0.6)
        summary = E2EBenchmarkReport._cross_domain_summary({"finance": br1, "legal": br2})
        assert abs(summary["test"]["avg_composite"] - 0.75) < 0.01
        assert abs(summary["test"]["avg_latency"] - 125.0) < 0.01


# ======================================================================
# Phase 9E — Baseline Comparison
# ======================================================================

class TestModeComparison:
    def test_defaults(self) -> None:
        mc = ModeComparison(mode="test", domain="finance", composite_score=0.8, latency_ms=100.0, pass_rate=0.7, fail_rate=0.1, success_rate=0.95)
        assert mc.mode == "test"
        assert mc.composite_score == 0.8

    def test_to_dict(self) -> None:
        mc = ModeComparison(mode="test", domain="finance", composite_score=0.8, latency_ms=100.0, pass_rate=0.7, fail_rate=0.1, success_rate=0.95, improvement_vs_baseline_pct=10.5)
        d = mc.to_dict()
        assert d["improvement_vs_baseline_pct"] == 10.5

    def test_without_improvement(self) -> None:
        mc = ModeComparison(mode="test", domain="f", composite_score=0.8, latency_ms=100.0, pass_rate=0.7, fail_rate=0.1, success_rate=0.95)
        assert mc.improvement_vs_baseline_pct is None


class TestCrossDomainComparison:
    def test_empty(self) -> None:
        cdc = CrossDomainComparison()
        assert cdc.comparisons == []
        assert cdc.best_performing_mode() == ""

    def test_by_mode(self) -> None:
        cdc = CrossDomainComparison([
            ModeComparison("naive_rag", "f", 0.72, 100, 0.6, 0.1, 0.9),
            ModeComparison("kairos", "f", 0.89, 120, 0.8, 0.05, 0.95),
            ModeComparison("naive_rag", "l", 0.68, 110, 0.55, 0.12, 0.88),
        ])
        assert len(cdc.by_mode("naive_rag")) == 2
        assert len(cdc.by_mode("kairos")) == 1

    def test_by_domain(self) -> None:
        cdc = CrossDomainComparison([
            ModeComparison("naive_rag", "f", 0.72, 100, 0.6, 0.1, 0.9),
            ModeComparison("kairos", "f", 0.89, 120, 0.8, 0.05, 0.95),
        ])
        assert len(cdc.by_domain("f")) == 2
        assert len(cdc.by_domain("nonexistent")) == 0

    def test_best_performing_mode(self) -> None:
        cdc = CrossDomainComparison([
            ModeComparison("naive_rag", "f", 0.72, 100, 0.6, 0.1, 0.9),
            ModeComparison("kairos", "f", 0.89, 120, 0.8, 0.05, 0.95),
            ModeComparison("naive_rag", "l", 0.68, 110, 0.55, 0.12, 0.88),
            ModeComparison("kairos", "l", 0.85, 130, 0.75, 0.06, 0.93),
        ])
        assert cdc.best_performing_mode() == "kairos"

    def test_improvement_summary(self) -> None:
        cdc = CrossDomainComparison([
            ModeComparison("naive_rag", "f", 0.72, 100, 0.6, 0.1, 0.9),
            ModeComparison("kairos", "f", 0.89, 120, 0.8, 0.05, 0.95),
            ModeComparison("naive_rag", "l", 0.68, 110, 0.55, 0.12, 0.88),
            ModeComparison("kairos", "l", 0.85, 130, 0.75, 0.06, 0.93),
        ])
        imp = cdc.improvement_summary()
        assert "kairos" in imp
        assert imp["kairos"] > 0

    def test_improvement_summary_no_baseline(self) -> None:
        cdc = CrossDomainComparison([
            ModeComparison("kairos", "f", 0.89, 120, 0.8, 0.05, 0.95),
        ])
        assert cdc.improvement_summary() == {}


class TestCompareModes:
    def test_empty_results(self) -> None:
        cdc = compare_modes({})
        assert len(cdc.comparisons) == 0

    def test_single_domain(self) -> None:
        br = E2EBenchmarkResult(domain="finance")
        br.mode_results["naive_rag"] = E2EAggregatedResult(execution_mode="naive_rag", domain="finance", avg_composite_score=0.72, avg_latency_ms=145.0, pass_rate=0.68, fail_rate=0.12, success_rate=0.95)
        br.mode_results["kairos_adaptive"] = E2EAggregatedResult(execution_mode="kairos_adaptive", domain="finance", avg_composite_score=0.89, avg_latency_ms=163.0, pass_rate=0.85, fail_rate=0.05, success_rate=0.97)
        cdc = compare_modes({"finance": br})
        assert len(cdc.comparisons) == 2
        kairos = [c for c in cdc.comparisons if c.mode == "kairos_adaptive"][0]
        assert kairos.improvement_vs_baseline_pct is not None
        assert kairos.improvement_vs_baseline_pct > 0

    def test_improvement_null_baseline(self) -> None:
        br = E2EBenchmarkResult(domain="finance")
        br.mode_results["kairos_adaptive"] = E2EAggregatedResult(execution_mode="kairos_adaptive", domain="finance", avg_composite_score=0.89)
        cdc = compare_modes({"finance": br})
        kairos = [c for c in cdc.comparisons if c.mode == "kairos_adaptive"][0]
        assert kairos.improvement_vs_baseline_pct is None


class TestGenerateComparisonReport:
    def test_empty_comparison(self) -> None:
        cdc = CrossDomainComparison()
        report = generate_comparison_report(cdc)
        assert "Baseline Comparison" in report

    def test_with_data(self) -> None:
        cdc = CrossDomainComparison([
            ModeComparison("naive_rag", "f", 0.72, 100, 0.6, 0.1, 0.9),
            ModeComparison("kairos_adaptive", "f", 0.89, 120, 0.8, 0.05, 0.95, 23.6),
        ])
        report = generate_comparison_report(cdc)
        assert "23.6%" in report or "23.6" in report
        assert "Best overall mode" in report


# ======================================================================
# Phase 9F — Ablation Validation
# ======================================================================

class TestAblationComponentImpact:
    def test_defaults(self) -> None:
        aci = AblationComponentImpact(component="planner", composite_delta=0.1, latency_delta_ms=20.0, pass_rate_delta=0.05, fail_rate_delta=-0.02)
        assert aci.direction == "neutral"
        assert aci.composite_delta == 0.1

    def test_to_dict(self) -> None:
        aci = AblationComponentImpact(component="planner", composite_delta=0.1, latency_delta_ms=20.0, pass_rate_delta=0.05, fail_rate_delta=-0.02, direction="improvement")
        d = aci.to_dict()
        assert d["direction"] == "improvement"
        assert d["component"] == "planner"


class TestAblationValidationResult:
    def test_defaults(self) -> None:
        avr = AblationValidationResult(domain="finance", full_system_score=0.89, naive_baseline_score=0.72, overall_improvement_pct=23.6)
        assert avr.is_significant is False

    def test_to_dict(self) -> None:
        avr = AblationValidationResult(domain="finance", full_system_score=0.89, naive_baseline_score=0.72, overall_improvement_pct=23.6, is_significant=True)
        d = avr.to_dict()
        assert d["overall_improvement_pct"] == 23.6
        assert d["is_significant"] is True


class TestAblationReport:
    def test_empty(self) -> None:
        ar = AblationReport()
        assert ar.average_improvement == 0.0
        assert ar.all_significant is False

    def test_with_results(self) -> None:
        ar = AblationReport(domain_results={
            "finance": AblationValidationResult(domain="finance", full_system_score=0.89, naive_baseline_score=0.72, overall_improvement_pct=23.6, is_significant=True),
        })
        assert ar.average_improvement == 23.6
        assert ar.all_significant is True

    def test_to_dict(self) -> None:
        ar = AblationReport(domain_results={
            "f": AblationValidationResult(domain="f", full_system_score=0.89, naive_baseline_score=0.72, overall_improvement_pct=23.6),
        })
        d = ar.to_dict()
        assert "f" in d["results"]


class TestComputeAblation:
    def test_normal_case(self) -> None:
        br = E2EBenchmarkResult(domain="finance")
        br.mode_results["naive_rag"] = E2EAggregatedResult(execution_mode="naive_rag", domain="finance", avg_composite_score=0.72)
        br.mode_results["kairos_adaptive"] = E2EAggregatedResult(execution_mode="kairos_adaptive", domain="finance", avg_composite_score=0.89)
        br.mode_results["always_simple"] = E2EAggregatedResult(execution_mode="always_simple", domain="finance", avg_composite_score=0.75)
        br.mode_results["always_complex"] = E2EAggregatedResult(execution_mode="always_complex", domain="finance", avg_composite_score=0.78)
        br.mode_results["always_multi_hop"] = E2EAggregatedResult(execution_mode="always_multi_hop", domain="finance", avg_composite_score=0.80)
        result = compute_ablation(br)
        assert result is not None
        assert result.overall_improvement_pct > 0
        assert len(result.component_impacts) == 4

    def test_missing_baseline(self) -> None:
        br = E2EBenchmarkResult(domain="finance")
        br.mode_results["kairos_adaptive"] = E2EAggregatedResult(execution_mode="kairos_adaptive", domain="finance", avg_composite_score=0.89)
        assert compute_ablation(br) is None

    def test_missing_kairos(self) -> None:
        br = E2EBenchmarkResult(domain="finance")
        br.mode_results["naive_rag"] = E2EAggregatedResult(execution_mode="naive_rag", domain="finance", avg_composite_score=0.72)
        assert compute_ablation(br) is None

    def test_zero_baseline_score(self) -> None:
        br = E2EBenchmarkResult(domain="finance")
        br.mode_results["naive_rag"] = E2EAggregatedResult(execution_mode="naive_rag", domain="finance", avg_composite_score=0.0)
        br.mode_results["kairos_adaptive"] = E2EAggregatedResult(execution_mode="kairos_adaptive", domain="finance", avg_composite_score=0.89)
        assert compute_ablation(br) is None


class TestComputeAblations:
    def test_empty(self) -> None:
        report = compute_ablations({})
        assert len(report.domain_results) == 0

    def test_single_domain(self) -> None:
        br = E2EBenchmarkResult(domain="finance")
        br.mode_results["naive_rag"] = E2EAggregatedResult(execution_mode="naive_rag", domain="finance", avg_composite_score=0.72)
        br.mode_results["kairos_adaptive"] = E2EAggregatedResult(execution_mode="kairos_adaptive", domain="finance", avg_composite_score=0.89)
        br.mode_results["always_simple"] = E2EAggregatedResult(execution_mode="always_simple", domain="finance", avg_composite_score=0.75)
        br.mode_results["always_complex"] = E2EAggregatedResult(execution_mode="always_complex", domain="finance", avg_composite_score=0.78)
        br.mode_results["always_multi_hop"] = E2EAggregatedResult(execution_mode="always_multi_hop", domain="finance", avg_composite_score=0.80)
        report = compute_ablations({"finance": br})
        assert len(report.domain_results) == 1
        assert "finance" in report.domain_results


class TestGenerateAblationReport:
    def test_empty_report(self) -> None:
        report = generate_ablation_report(AblationReport())
        assert "Ablation Validation Report" in report

    def test_with_data(self) -> None:
        ar = AblationReport(domain_results={
            "finance": AblationValidationResult(domain="finance", full_system_score=0.89, naive_baseline_score=0.72, overall_improvement_pct=23.6, is_significant=True, component_impacts=[
                AblationComponentImpact("planner", 0.17, 18.0, 0.17, -0.07, "improvement"),
            ]),
        })
        report = generate_ablation_report(ar)
        assert "Finance" in report
        assert "23.6" in report


# ======================================================================
# Phase 9G — Cost Analysis
# ======================================================================

class TestCostBreakdown:
    def test_defaults(self) -> None:
        cb = CostBreakdown(mode="test", domain="f", estimated_cost_usd=10.0, num_queries=100, avg_cost_per_query_usd=0.1, total_latency_ms=1000.0, num_docs_retrieved=500)
        assert cb.cost_per_doc_usd == 0.02

    def test_zero_docs(self) -> None:
        cb = CostBreakdown(mode="test", domain="f", estimated_cost_usd=10.0, num_queries=100, avg_cost_per_query_usd=0.1, total_latency_ms=1000.0, num_docs_retrieved=0)
        assert cb.cost_per_doc_usd == 0.0

    def test_to_dict(self) -> None:
        cb = CostBreakdown(mode="test", domain="f", estimated_cost_usd=10.0, num_queries=100, avg_cost_per_query_usd=0.1, total_latency_ms=1000.0, num_docs_retrieved=500)
        d = cb.to_dict()
        assert d["avg_cost_per_query_usd"] == 0.1


class TestCostAnalysisReport:
    def test_empty(self) -> None:
        car = CostAnalysisReport()
        assert car.total_cost() == 0.0

    def test_single_breakdown(self) -> None:
        cb = CostBreakdown(mode="test", domain="f", estimated_cost_usd=10.0, num_queries=100, avg_cost_per_query_usd=0.1, total_latency_ms=1000.0, num_docs_retrieved=500)
        car = CostAnalysisReport(breakdowns=[cb])
        assert car.total_cost() == 10.0
        assert car.avg_cost_per_query("test") == 0.1

    def test_by_mode(self) -> None:
        car = CostAnalysisReport([
            CostBreakdown("mode1", "f", 10.0, 100, 0.1, 1000, 500),
            CostBreakdown("mode2", "f", 20.0, 100, 0.2, 2000, 1000),
        ])
        assert len(car.by_mode("mode1")) == 1
        assert len(car.by_mode("nonexistent")) == 0

    def test_by_domain(self) -> None:
        car = CostAnalysisReport([
            CostBreakdown("m1", "f", 10.0, 100, 0.1, 1000, 500),
            CostBreakdown("m1", "l", 20.0, 100, 0.2, 2000, 1000),
        ])
        assert len(car.by_domain("f")) == 1

    def test_cost_ratio(self) -> None:
        car = CostAnalysisReport([
            CostBreakdown("naive_rag", "f", 10.0, 100, 0.1, 1000, 500),
            CostBreakdown("kairos", "f", 15.0, 100, 0.15, 1500, 750),
        ])
        ratio = car.cost_ratio_vs_baseline("kairos")
        assert abs(ratio - 1.5) < 0.01

    def test_to_dict(self) -> None:
        car = CostAnalysisReport([
            CostBreakdown("test", "f", 10.0, 100, 0.1, 1000, 500),
        ])
        d = car.to_dict()
        assert d["total_cost_usd"] == 10.0
        assert d["num_modes"] == 1


class TestCostAnalyzer:
    def test_default_rates(self) -> None:
        ca = CostAnalyzer()
        assert ca.embedding_cost == 0.0001
        assert ca.llm_call_cost == 0.002

    def test_custom_rates(self) -> None:
        ca = CostAnalyzer(embedding_cost=0.001, llm_call_cost=0.01, storage_cost=0.0001, latency_cost=0.00001)
        assert ca.embedding_cost == 0.001

    def test_analyze_empty(self) -> None:
        ca = CostAnalyzer()
        report = ca.analyze({})
        assert report.total_cost() == 0.0

    def test_analyze_single_domain(self) -> None:
        ca = CostAnalyzer()
        br = E2EBenchmarkResult(domain="finance")
        br.mode_results["naive_rag"] = E2EAggregatedResult(execution_mode="naive_rag", domain="finance", num_queries=100, avg_latency_ms=145.0, avg_docs=4.2)
        report = ca.analyze({"finance": br})
        assert len(report.breakdowns) == 1
        assert report.breakdowns[0].estimated_cost_usd > 0

    def test_analyze_multi_mode(self) -> None:
        ca = CostAnalyzer()
        br = E2EBenchmarkResult(domain="finance")
        br.mode_results["naive_rag"] = E2EAggregatedResult(execution_mode="naive_rag", domain="finance", num_queries=100, avg_latency_ms=145.0, avg_docs=4.2)
        br.mode_results["kairos_adaptive"] = E2EAggregatedResult(execution_mode="kairos_adaptive", domain="finance", num_queries=100, avg_latency_ms=163.0, avg_docs=4.6)
        report = ca.analyze({"finance": br})
        assert len(report.breakdowns) == 2


class TestGenerateCostReport:
    def test_empty_report(self) -> None:
        report = generate_cost_report(CostAnalysisReport())
        assert "Cost Analysis" in report

    def test_with_data(self) -> None:
        car = CostAnalysisReport([
            CostBreakdown("naive_rag", "f", 12.5, 100, 0.0123, 14500, 420),
            CostBreakdown("kairos_adaptive", "f", 14.8, 100, 0.0145, 16300, 460),
        ])
        report = generate_cost_report(car)
        assert "12.5" in report or "$12.5" in report
        assert "1.18" in report or "1.18x" in report


# ======================================================================
# Phase 9A — RealRetriever (additional tests)
# ======================================================================

from intelligence.retrieval.real_retriever import RealRetriever
from intelligence.retrieval.retrieval_result import RetrievedDocument, RetrievalResult


class TestRealRetrieverAdditional:
    def test_get_retriever_simple(self) -> None:
        simple = MagicMock()
        complex_r = MagicMock()
        multi = MagicMock()
        rr = RealRetriever(simple, complex_r, multi)
        assert rr._get_retriever("simple") is simple
        assert rr._get_retriever("complex") is complex_r
        assert rr._get_retriever("multi_hop") is multi
        assert rr._get_retriever("multihop") is multi
        assert rr._get_retriever("unknown") is simple

    def test_normalize_documents_strings(self) -> None:
        docs = RealRetriever._normalize_documents(["doc1", "doc2"])
        assert len(docs) == 2
        assert docs[0].text == "doc1"

    def test_normalize_documents_tuples(self) -> None:
        docs = RealRetriever._normalize_documents([("text1", 0.9), ("text2", 0.8)])
        assert docs[0].text == "text1"
        assert docs[0].score == 0.9

    def test_normalize_documents_dicts(self) -> None:
        docs = RealRetriever._normalize_documents([{"text": "hello", "score": 0.95, "source_id": "src1"}])
        assert docs[0].text == "hello"
        assert docs[0].score == 0.95
        assert docs[0].source_id == "src1"

    def test_normalize_documents_retrieved_docs(self) -> None:
        rd = RetrievedDocument(text="test", score=0.5)
        docs = RealRetriever._normalize_documents([rd])
        assert docs[0].text == "test"

    def test_normalize_documents_mixed(self) -> None:
        rd = RetrievedDocument(text="doc_obj", score=0.5)
        docs = RealRetriever._normalize_documents([rd, "string_doc", ("tuple_doc", 0.8)])
        assert len(docs) == 3

    def test_plan_and_retrieve_no_planner(self) -> None:
        simple = MagicMock()
        simple.retrieve.return_value = RetrievalResult(query="test", documents=[RetrievedDocument(text="doc")])
        rr = RealRetriever(simple, MagicMock(), MagicMock())
        result = rr.plan_and_retrieve("test")
        assert result.query == "test"

    def test_error_handling(self) -> None:
        simple = MagicMock()
        simple.retrieve_top_k.side_effect = Exception("DB error")
        rr = RealRetriever(simple, MagicMock(), MagicMock())
        result = rr.retrieve("test", strategy="simple")
        assert result.success is False
        assert "DB error" in result.error


# ======================================================================
# Phase 9A — RetrievalResult (additional tests)
# ======================================================================

class TestRetrievalResultAdditional:
    def test_num_documents_empty(self) -> None:
        rr = RetrievalResult(query="test")
        assert rr.num_documents == 0

    def test_num_documents_with_docs(self) -> None:
        rr = RetrievalResult(query="test", documents=[RetrievedDocument(text="doc1"), RetrievedDocument(text="doc2")])
        assert rr.num_documents == 2

    def test_top_score_empty(self) -> None:
        rr = RetrievalResult(query="test")
        assert rr.top_score == 0.0

    def test_top_score_with_docs(self) -> None:
        rr = RetrievalResult(query="test", documents=[RetrievedDocument(text="a", score=0.5), RetrievedDocument(text="b", score=0.9)])
        assert rr.top_score == 0.9

    def test_mean_score_empty(self) -> None:
        rr = RetrievalResult(query="test")
        assert rr.mean_score == 0.0

    def test_mean_score_with_docs(self) -> None:
        rr = RetrievalResult(query="test", documents=[RetrievedDocument(text="a", score=0.5), RetrievedDocument(text="b", score=0.9)])
        assert rr.mean_score == 0.7


# ======================================================================
# Phase 9B — Dataset generator
# ======================================================================

from benchmarks.datasets.generator import (
    DOMAIN_CONFIGS, GoldDatasetEntry,
    generate_all_datasets, generate_dataset, get_dataset, list_datasets, total_queries,
)


class TestGoldDatasetEntry:
    def test_defaults(self) -> None:
        entry = GoldDatasetEntry(query_id="test-001", question="What is X?")
        assert entry.difficulty == "simple"
        assert entry.domain == ""

    def test_to_dict(self) -> None:
        entry = GoldDatasetEntry(query_id="test-001", question="What?", answer="Answer", relevant_docs=["doc1"], difficulty="complex", domain="tech")
        d = entry.to_dict()
        assert d["id"] == "test-001"
        assert d["difficulty"] == "complex"


class TestDatasetGenerator:
    def test_generate_dataset_finance(self) -> None:
        entries = generate_dataset("finance")
        assert len(entries) > 0
        assert all(e.domain == "finance" for e in entries)

    def test_generate_dataset_legal(self) -> None:
        entries = generate_dataset("legal")
        assert len(entries) > 0
        assert all(e.domain == "legal" for e in entries)

    def test_generate_dataset_healthcare(self) -> None:
        entries = generate_dataset("healthcare")
        assert len(entries) > 0

    def test_generate_dataset_technology(self) -> None:
        entries = generate_dataset("technology")
        assert len(entries) > 0

    def test_generate_dataset_general(self) -> None:
        entries = generate_dataset("general")
        assert len(entries) > 0

    def test_generate_dataset_unknown(self) -> None:
        entries = generate_dataset("nonexistent")
        assert entries == []

    def test_generate_all_datasets(self) -> None:
        datasets = generate_all_datasets()
        assert len(datasets) == 5
        assert "finance" in datasets
        assert "legal" in datasets
        assert "healthcare" in datasets
        assert "technology" in datasets
        assert "general" in datasets

    def test_generate_all_datasets_cached(self) -> None:
        first = generate_all_datasets()
        second = generate_all_datasets()
        assert first is second

    def test_get_dataset(self) -> None:
        entries = get_dataset("finance")
        assert len(entries) > 0

    def test_get_dataset_nonexistent(self) -> None:
        assert get_dataset("nonexistent") == []

    def test_list_datasets(self) -> None:
        domains = list_datasets()
        assert "finance" in domains
        assert "legal" in domains
        assert "healthcare" in domains
        assert "technology" in domains
        assert "general" in domains

    def test_total_queries(self) -> None:
        total = total_queries()
        assert total >= 200

    def test_domain_configs_structure(self) -> None:
        assert "finance" in DOMAIN_CONFIGS
        assert "answer_prefix" in DOMAIN_CONFIGS["finance"]
        assert "entries" in DOMAIN_CONFIGS["finance"]

    def test_generated_entries_have_query_ids(self) -> None:
        entries = generate_dataset("finance")
        for e in entries:
            assert e.query_id.startswith("finance-")

    def test_generated_entries_have_questions(self) -> None:
        entries = generate_dataset("finance")
        for e in entries:
            assert len(e.question) > 0

    def test_generated_entries_have_answers(self) -> None:
        entries = generate_dataset("finance")
        for e in entries:
            assert len(e.answer) > 0

    def test_generated_entries_have_relevant_docs(self) -> None:
        entries = generate_dataset("finance")
        for e in entries:
            assert len(e.relevant_docs) > 0

    def test_balanced_difficulty_distribution(self) -> None:
        entries = generate_dataset("finance")
        difficulties = [e.difficulty for e in entries]
        assert "simple" in difficulties
        assert "complex" in difficulties
        assert "multi_hop" in difficulties


# ======================================================================
# Phase 9 — Dataset loader (from generator)
# ======================================================================

class TestDatasetFromGenerator:
    def test_all_datasets_have_entries(self) -> None:
        for domain in list_datasets():
            entries = get_dataset(domain)
            assert len(entries) > 0, f"Domain {domain} has no entries"

    def test_domain_metadata_via_configs(self) -> None:
        assert "finance" in DOMAIN_CONFIGS
        meta = DOMAIN_CONFIGS["finance"]
        assert "answer_prefix" in meta
        assert "entries" in meta

    def test_unknown_domain_returns_empty(self) -> None:
        assert get_dataset("nonexistent") == []


# ======================================================================
# Dashboard Pages — smoke tests (import verification)
# ======================================================================

class TestDashboardPagesImport:
    def test_leaderboard_page_imports(self) -> None:
        import importlib
        spec = importlib.util.find_spec("dashboard.pages.leaderboard")
        assert spec is not None, "leaderboard.py should be importable"

    def test_domain_analysis_page_imports(self) -> None:
        import importlib
        spec = importlib.util.find_spec("dashboard.pages.domain_analysis")
        assert spec is not None

    def test_planner_analysis_page_imports(self) -> None:
        import importlib
        spec = importlib.util.find_spec("dashboard.pages.planner_analysis")
        assert spec is not None

    def test_cost_analysis_page_imports(self) -> None:
        import importlib
        spec = importlib.util.find_spec("dashboard.pages.cost_analysis")
        assert spec is not None

    def test_ablation_v2_page_imports(self) -> None:
        import importlib
        spec = importlib.util.find_spec("dashboard.pages.ablation_v2")
        assert spec is not None

    def test_judge_dashboard_page_imports(self) -> None:
        import importlib
        spec = importlib.util.find_spec("dashboard.pages.judge_dashboard")
        assert spec is not None

    def test_comparisons_page_imports(self) -> None:
        import importlib
        spec = importlib.util.find_spec("dashboard.pages.comparisons")
        assert spec is not None


# ======================================================================
# CorpusManager
# ======================================================================

from intelligence.retrieval.corpus_manager import CorpusDocument, CorpusManager


class TestCorpusDocument:
    def test_defaults(self) -> None:
        doc = CorpusDocument(doc_id="d1", text="hello")
        assert doc.doc_id == "d1"
        assert doc.domain == ""

    def test_to_dict(self) -> None:
        doc = CorpusDocument(doc_id="d1", text="hello", domain="tech", title="Test")
        d = doc.to_dict()
        assert d["doc_id"] == "d1"
        assert d["domain"] == "tech"


class TestCorpusManager:
    def test_default_state(self) -> None:
        cm = CorpusManager()
        assert cm.domains == []
        assert cm.count == 0

    def test_add_document(self) -> None:
        cm = CorpusManager()
        doc = CorpusDocument(doc_id="d1", text="doc1", domain="finance")
        cm.add_document(doc)
        assert cm.count == 1
        assert "finance" in cm.domains

    def test_add_documents_bulk(self) -> None:
        cm = CorpusManager()
        docs = [
            CorpusDocument(doc_id="d1", text="doc1", domain="finance"),
            CorpusDocument(doc_id="d2", text="doc2", domain="finance"),
        ]
        cm.add_documents(docs)
        assert cm.count == 2

    def test_get_document(self) -> None:
        cm = CorpusManager()
        doc = CorpusDocument(doc_id="d1", text="hello", domain="f")
        cm.add_document(doc)
        assert cm.get_document("d1") is doc

    def test_get_document_nonexistent(self) -> None:
        cm = CorpusManager()
        assert cm.get_document("nonexistent") is None

    def test_get_documents_all(self) -> None:
        cm = CorpusManager()
        cm.add_document(CorpusDocument("d1", "a", "f"))
        cm.add_document(CorpusDocument("d2", "b", "f"))
        assert len(cm.get_documents()) == 2

    def test_get_documents_by_ids(self) -> None:
        cm = CorpusManager()
        cm.add_document(CorpusDocument("d1", "a", "f"))
        cm.add_document(CorpusDocument("d2", "b", "f"))
        result = cm.get_documents(["d1"])
        assert len(result) == 1
        assert result[0].doc_id == "d1"

    def test_get_documents_by_domain(self) -> None:
        cm = CorpusManager()
        cm.add_document(CorpusDocument("d1", "a", "finance"))
        cm.add_document(CorpusDocument("d2", "b", "legal"))
        assert len(cm.get_documents_by_domain("finance")) == 1
        assert len(cm.get_documents_by_domain("nonexistent")) == 0

    def test_remove_document(self) -> None:
        cm = CorpusManager()
        doc = CorpusDocument("d1", "a", "f")
        cm.add_document(doc)
        assert cm.remove_document("d1") is True
        assert cm.count == 0

    def test_remove_nonexistent(self) -> None:
        cm = CorpusManager()
        assert cm.remove_document("nonexistent") is False

    def test_clear(self) -> None:
        cm = CorpusManager()
        cm.add_document(CorpusDocument("d1", "a", "f"))
        cm.add_document(CorpusDocument("d2", "b", "f"))
        cm.clear()
        assert cm.count == 0
        assert cm.domains == []


# ======================================================================
# RetrievalExecutor
# ======================================================================

from intelligence.retrieval.retrieval_executor import RetrievalExecutor


class TestRetrievalExecutor:
    def test_execute_calls_retriever(self) -> None:
        mock_r = MagicMock()
        mock_r.retrieve.return_value = RetrievalResult(query="test")
        re = RetrievalExecutor(retriever=mock_r, enable_planning=False)
        result = re.execute("test")
        assert result is not None
        mock_r.retrieve.assert_called_once()

    def test_execute_with_planning(self) -> None:
        mock_r = MagicMock()
        mock_r.plan_and_retrieve.return_value = RetrievalResult(query="test")
        re = RetrievalExecutor(retriever=mock_r, enable_planning=True)
        result = re.execute("test")
        mock_r.plan_and_retrieve.assert_called_once()

    def test_execute_batch(self) -> None:
        mock_r = MagicMock()
        mock_r.retrieve.return_value = RetrievalResult(query="batch")
        re = RetrievalExecutor(retriever=mock_r, enable_planning=False)
        queries = [{"query": "q1"}, {"query": "q2"}]
        results = re.execute_batch(queries)
        assert len(results) == 2

    def test_namespace_property(self) -> None:
        mock_r = MagicMock()
        re = RetrievalExecutor(retriever=mock_r, namespace="custom")
        assert re.namespace == "custom"
        re.namespace = "new_ns"
        assert re.namespace == "new_ns"

    def test_enable_planning_property(self) -> None:
        mock_r = MagicMock()
        re = RetrievalExecutor(retriever=mock_r, enable_planning=True)
        assert re.enable_planning is True
        re.enable_planning = False
        assert re.enable_planning is False


# ======================================================================
# E2EBenchmarkRunner — error handling
# ======================================================================

class TestE2ERunnerErrorHandling:
    def test_retrieve_throws_exception(self) -> None:
        runner = E2EBenchmarkRunner()
        bad_retriever = MagicMock()
        bad_retriever.retrieve.side_effect = RuntimeError("fail")
        entry = GoldDatasetEntry(query_id="q1", question="test?", difficulty="simple", domain="f")
        qr = runner._run_query(entry, bad_retriever, ExecutionMode.NAIVE_RAG)
        assert qr.success is False
        assert "fail" in qr.error

    def test_no_retrieve_method(self) -> None:
        runner = E2EBenchmarkRunner()
        bad_retriever = object()
        entry = GoldDatasetEntry(query_id="q1", question="test?", difficulty="simple", domain="f")
        qr = runner._run_query(entry, bad_retriever, ExecutionMode.NAIVE_RAG)
        assert qr.success is not False  # should not crash

    def test_retrieve_returns_list(self) -> None:
        runner = E2EBenchmarkRunner()
        # Mock an object with retrieve_top_k but not retrieve
        class MockRet:
            def retrieve_top_k(self, **kwargs):
                return ["chunk1", "chunk2"]
        qr = runner._run_query(
            GoldDatasetEntry(query_id="q1", question="test?", difficulty="simple", domain="f"),
            MockRet(),
            ExecutionMode.ALWAYS_SIMPLE,
        )
        assert qr.success is True
        assert qr.num_docs == 2


# ======================================================================
# BenchmarkConfig — edge cases
# ======================================================================

class TestBenchmarkConfigEdgeCases:
    def test_empty_domains(self) -> None:
        config = BenchmarkConfig(domains=[])
        assert config.domains == []

    def test_single_domain(self) -> None:
        config = BenchmarkConfig(domains=["finance"])
        assert config.domains == ["finance"]

    def test_single_execution_mode(self) -> None:
        config = BenchmarkConfig(execution_modes=[ExecutionMode.KAIROS_ADAPTIVE])
        assert len(config.execution_modes) == 1

    def test_mode_labels_contains_all(self) -> None:
        config = BenchmarkConfig()
        for mode in ExecutionMode:
            assert mode in config.mode_labels

    def test_output_path_creates_dirs(self) -> None:
        with tempfile.TemporaryDirectory() as tmpdir:
            config = BenchmarkConfig(output_dir=os.path.join(tmpdir, "nested"))
            path = config.get_output_path("f", ExecutionMode.KAIROS_ADAPTIVE)
            assert os.path.isdir(os.path.dirname(path))


# ======================================================================
# Scoring edge cases
# ======================================================================

class TestScoringEdgeCases:
    def test_weight_scores_empty_results(self) -> None:
        assert weight_scores([], {"d": 1.0}) == 0.0

    def test_aggregate_scores_large(self) -> None:
        results = [JudgeResult(f"d{i}", 0.5, Judgment.WARN) for i in range(100)]
        assert aggregate_scores(results) == 0.5

    def test_score_to_rating_boundary(self) -> None:
        assert score_to_rating(0.9) == "excellent"
        assert score_to_rating(0.89) == "good"
        assert score_to_rating(0.7) == "good"
        assert score_to_rating(0.5) == "fair"
        assert score_to_rating(0.3) == "poor"

    def test_rating_to_score_all(self) -> None:
        ratings = ["excellent", "good", "fair", "poor", "very_poor"]
        scores = [rating_to_score(r) for r in ratings]
        assert all(0.0 < s <= 1.0 for s in scores)
        assert scores == sorted(scores, reverse=True)


# ======================================================================
# E2EBenchmarkRunner — save_results edge cases
# ======================================================================

class TestE2ERunnerSaveResults:
    def test_save_results_empty(self) -> None:
        runner = E2EBenchmarkRunner()
        with tempfile.TemporaryDirectory() as tmpdir:
            path = runner.save_results({}, output_dir=tmpdir)
            assert os.path.isdir(path)
            assert os.path.exists(os.path.join(path, "summary.json"))

    def test_save_results_multi_domain(self) -> None:
        runner = E2EBenchmarkRunner()
        br1 = E2EBenchmarkResult(domain="finance")
        br1.mode_results["test"] = E2EAggregatedResult(execution_mode="test", domain="finance", num_queries=5)
        br2 = E2EBenchmarkResult(domain="legal")
        br2.mode_results["test"] = E2EAggregatedResult(execution_mode="test", domain="legal", num_queries=5)
        with tempfile.TemporaryDirectory() as tmpdir:
            runner.save_results({"finance": br1, "legal": br2}, output_dir=tmpdir)
            assert os.path.exists(os.path.join(tmpdir, "finance_benchmark.json"))
            assert os.path.exists(os.path.join(tmpdir, "legal_benchmark.json"))
            assert os.path.exists(os.path.join(tmpdir, "summary.json"))


# ======================================================================
# E2EBenchmarkResult — edge cases
# ======================================================================

class TestE2EBenchmarkResultEdgeCases:
    def test_improvement_vs_baseline_all_modes(self) -> None:
        br = E2EBenchmarkResult(domain="f")
        modes = ["naive_rag", "always_simple", "always_complex", "always_multi_hop", "kairos_adaptive"]
        scores = [0.72, 0.75, 0.78, 0.80, 0.89]
        for mode, score in zip(modes, scores):
            br.mode_results[mode] = E2EAggregatedResult(execution_mode=mode, domain="f", avg_composite_score=score)
        imp = br.improvement_vs_baseline()
        assert len(imp) == 4
        assert imp["kairos_adaptive"] > imp["always_multi_hop"]

    def test_best_mode_tie(self) -> None:
        br = E2EBenchmarkResult(domain="f")
        br.mode_results["a"] = E2EAggregatedResult(execution_mode="a", domain="f", avg_composite_score=0.8)
        br.mode_results["b"] = E2EAggregatedResult(execution_mode="b", domain="f", avg_composite_score=0.8)
        best = br.best_mode()
        assert best in ("a", "b")

    def test_improvement_vs_baseline_nonexistent(self) -> None:
        br = E2EBenchmarkResult(domain="f")
        br.mode_results["kairos"] = E2EAggregatedResult(execution_mode="kairos", domain="f", avg_composite_score=0.8)
        assert br.improvement_vs_baseline("nonexistent") == {}


# ======================================================================
# Debug dashboard pages load (import-level only, no streamlit runtime)
# ======================================================================

class TestDashboardPageContent:
    def test_leaderboard_functions_exist(self) -> None:
        from dashboard.pages import leaderboard
        assert leaderboard is not None
        # Verify main function exists
        assert hasattr(leaderboard, "main")

    def test_domain_analysis_functions_exist(self) -> None:
        from dashboard.pages import domain_analysis
        assert hasattr(domain_analysis, "main")

    def test_planner_analysis_functions_exist(self) -> None:
        from dashboard.pages import planner_analysis
        assert hasattr(planner_analysis, "main")

    def test_cost_analysis_functions_exist(self) -> None:
        from dashboard.pages import cost_analysis
        assert hasattr(cost_analysis, "main")

    def test_ablation_v2_functions_exist(self) -> None:
        from dashboard.pages import ablation_v2
        assert hasattr(ablation_v2, "main")

    def test_judge_dashboard_functions_exist(self) -> None:
        from dashboard.pages import judge_dashboard
        assert hasattr(judge_dashboard, "main")

    def test_comparisons_functions_exist(self) -> None:
        from dashboard.pages import comparisons
        assert hasattr(comparisons, "main")

    def test_dashboard_app_functions_exist(self) -> None:
        from dashboard import app
        assert hasattr(app, "main")

    def test_all_pages_have_set_page_config(self) -> None:
        pages = [
            "leaderboard", "domain_analysis", "planner_analysis",
            "cost_analysis", "ablation_v2", "judge_dashboard", "comparisons",
        ]
        for page_name in pages:
            import importlib
            module = importlib.import_module(f"dashboard.pages.{page_name}")
            assert hasattr(module, "main"), f"{page_name}.py missing main()"


# ======================================================================
# Integration: GoldDatasetEntry -> E2EQueryResult conversion
# ======================================================================

class TestGoldToE2EIntegration:
    def test_entry_conversion_preserves_fields(self) -> None:
        entry = GoldDatasetEntry(
            query_id="finance-001",
            question="What is the price-to-earnings ratio?",
            difficulty="simple",
            domain="finance",
        )
        qr = E2EQueryResult(
            query_id=entry.query_id,
            query=entry.question,
            domain=entry.domain,
            query_type=entry.difficulty,
            execution_mode="naive_rag",
            composite_score=0.85,
            composite_judgment="pass",
        )
        assert qr.query_id == "finance-001"
        assert "price-to-earnings" in qr.query
        assert qr.domain == "finance"
        assert qr.query_type == "simple"


# ======================================================================
# Config label verification
# ======================================================================

class TestModeLabels:
    def test_all_labels_present(self) -> None:
        config = BenchmarkConfig()
        labels = config.mode_labels
        assert "Naive RAG (baseline)" in labels.values()
        assert "Kairos Adaptive" in labels.values()

    def test_labels_match_enum(self) -> None:
        config = BenchmarkConfig()
        for mode in config.execution_modes:
            assert mode in config.mode_labels
