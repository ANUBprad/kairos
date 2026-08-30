"""Mathematical validation of all implemented ranking and evaluation metrics.

Every expected value is independently derived from the mathematical formula,
NOT from the production implementation.

Reference calculations are provided for:
- Core ranking metrics (reciprocal_rank, MRR, AP, MAP, DCG, NDCG, hit_rate,
  precision_at_k, recall_at_k)
- Judging/scoring metrics (aggregate_scores, weight_scores, score_to_rating,
  rating_to_score)
- Calibration metrics (ECE, MCE, Brier score)
- Grounding metrics (word overlap)
"""

from __future__ import annotations

import math

import numpy as np
import pytest

# ── Ranking metrics ──────────────────────────────────────────────────────────
from intelligence.evaluation.ranking_metrics import (
    average_precision,
    discounted_cumulative_gain,
    hit_rate,
    mean_average_precision,
    mean_reciprocal_rank,
    normalized_dcg,
    precision_at_k,
    recall_at_k,
    reciprocal_rank,
)

# ── Judging / scoring ────────────────────────────────────────────────────────
from intelligence.judging.scoring import (
    aggregate_scores,
    default_weights,
    rating_to_score,
    score_to_rating,
    weight_scores,
)
from intelligence.judging.judge import JudgeResult

# ── Calibration ──────────────────────────────────────────────────────────────
from intelligence.calibration.calibration_metrics import (
    compute_brier_score,
    compute_ece,
    compute_mce,
)

# ── Grounding ────────────────────────────────────────────────────────────────
from intelligence.judging.grounding import GroundingJudge


# ═══════════════════════════════════════════════════════════════════════════════
# 1. RECIPROCAL RANK
# ═══════════════════════════════════════════════════════════════════════════════
class TestReciprocalRank:
    """RR = 1 / rank_of_first_relevant.  Returns 0 if none found."""

    def test_first_position(self) -> None:
        # relevant at position 1 → RR = 1/1 = 1.0
        assert reciprocal_rank({"a"}, ["a", "b", "c"]) == 1.0

    def test_second_position(self) -> None:
        # relevant at position 2 → RR = 1/2 = 0.5
        assert reciprocal_rank({"b"}, ["a", "b", "c"]) == 0.5

    def test_third_position(self) -> None:
        # relevant at position 3 → RR = 1/3
        assert reciprocal_rank({"c"}, ["a", "b", "c"]) == pytest.approx(1 / 3)

    def test_no_relevant(self) -> None:
        assert reciprocal_rank({"z"}, ["a", "b", "c"]) == 0.0

    def test_empty_retrieved(self) -> None:
        assert reciprocal_rank({"a"}, []) == 0.0

    def test_empty_relevant(self) -> None:
        assert reciprocal_rank(set(), ["a"]) == 0.0

    def test_both_empty(self) -> None:
        assert reciprocal_rank(set(), []) == 0.0

    def test_first_of_many(self) -> None:
        # 10 docs, first is relevant → RR = 1.0
        docs = ["a"] + [f"extra_{i}" for i in range(9)]
        assert reciprocal_rank({"a"}, docs) == 1.0

    def test_only_first_relevant(self) -> None:
        assert reciprocal_rank({"a"}, ["a", "x", "y"]) == 1.0

    def test_duplicate_relevant_in_retrieved(self) -> None:
        # First occurrence wins: position 1
        assert reciprocal_rank({"a"}, ["a", "a", "a"]) == 1.0


# ═══════════════════════════════════════════════════════════════════════════════
# 2. MEAN RECIPROCAL RANK (MRR)
# ═══════════════════════════════════════════════════════════════════════════════
class TestMeanReciprocalRank:
    """MRR = mean of RR across queries."""

    def test_two_queries(self) -> None:
        # Q1: RR=1/1=1.0, Q2: RR=1/2=0.5 → MRR = (1.0+0.5)/2 = 0.75
        queries = [["a", "x"], ["y", "b"]]
        relevants = [{"a"}, {"b"}]
        assert mean_reciprocal_rank(queries, relevants) == 0.75

    def test_all_first(self) -> None:
        # All queries find relevant at position 1 → MRR = 1.0
        queries = [["a"], ["b"], ["c"]]
        relevants = [{"a"}, {"b"}, {"c"}]
        assert mean_reciprocal_rank(queries, relevants) == 1.0

    def test_none_found(self) -> None:
        queries = [["x"], ["y"]]
        relevants = [{"a"}, {"b"}]
        assert mean_reciprocal_rank(queries, relevants) == 0.0

    def test_empty_queries(self) -> None:
        assert mean_reciprocal_rank([], []) == 0.0

    def test_single_query(self) -> None:
        # RR = 1/3 → MRR = 1/3
        assert mean_reciprocal_rank([["x", "y", "z"]], [{"z"}]) == pytest.approx(1 / 3)

    def test_mrr_bounds(self) -> None:
        """MRR must be in [0, 1]."""
        queries = [["a", "b"], ["c", "d"], ["e", "f"]]
        relevants = [{"a"}, {"d"}, {"f"}]
        mrr = mean_reciprocal_rank(queries, relevants)
        assert 0.0 <= mrr <= 1.0


# ═══════════════════════════════════════════════════════════════════════════════
# 3. AVERAGE PRECISION (AP)
# ═══════════════════════════════════════════════════════════════════════════════
class TestAveragePrecision:
    """AP = (1/|rel|) * Σ precision@i where i is a relevant position."""

    def test_perfect(self) -> None:
        # All 3 relevant, all retrieved → P@1=1, P@2=2/2, P@3=3/3
        # AP = (1+1+1)/3 = 1.0
        assert average_precision({"a", "b", "c"}, ["a", "b", "c"]) == 1.0

    def test_none_relevant(self) -> None:
        assert average_precision(set(), ["a", "b"]) == 0.0

    def test_empty_retrieved(self) -> None:
        assert average_precision({"a"}, []) == 0.0

    def test_single_relevant_first(self) -> None:
        # 1 relevant at position 1 → AP = P@1/1 = 1.0/1 = 1.0
        assert average_precision({"a"}, ["a", "b", "c"]) == 1.0

    def test_single_relevant_third(self) -> None:
        # 1 relevant at position 3 → AP = P@3/1 = (1/3)/1 = 1/3
        assert average_precision({"c"}, ["a", "b", "c"]) == pytest.approx(1 / 3)

    def test_two_relevant_positions_1_and_3(self) -> None:
        # P@1 = 1/1 = 1.0, P@3 = 2/3
        # AP = (1.0 + 2/3) / 2 = (5/3) / 2 = 5/6
        assert average_precision({"a", "c"}, ["a", "b", "c"]) == pytest.approx(5 / 6)

    def test_two_relevant_positions_2_and_4(self) -> None:
        # P@2 = 1/2, P@4 = 2/4 = 1/2
        # AP = (1/2 + 1/2) / 2 = 0.5
        assert average_precision({"b", "d"}, ["a", "b", "c", "d"]) == pytest.approx(0.5)

    def test_ap_bounds(self) -> None:
        """AP must be in [0, 1]."""
        ap = average_precision({"a", "b"}, ["a", "x", "b", "y"])
        assert 0.0 <= ap <= 1.0


# ═══════════════════════════════════════════════════════════════════════════════
# 4. MEAN AVERAGE PRECISION (MAP)
# ═══════════════════════════════════════════════════════════════════════════════
class TestMeanAveragePrecision:
    """MAP = mean of AP across queries."""

    def test_two_queries(self) -> None:
        # Q1: AP({"a"}, ["a","b"]) = 1.0
        # Q2: AP({"b"}, ["a","b"]) = P@2/1 = (1/2)/1 = 0.5
        # MAP = (1.0 + 0.5) / 2 = 0.75
        queries = [["a", "b"], ["a", "b"]]
        relevants = [{"a"}, {"b"}]
        assert mean_average_precision(queries, relevants) == 0.75

    def test_empty(self) -> None:
        assert mean_average_precision([], []) == 0.0

    def test_perfect(self) -> None:
        queries = [["a"], ["b"]]
        relevants = [{"a"}, {"b"}]
        assert mean_average_precision(queries, relevants) == 1.0

    def test_map_bounds(self) -> None:
        queries = [["a", "b"], ["c", "d"]]
        relevants = [{"a"}, {"d"}]
        map_score = mean_average_precision(queries, relevants)
        assert 0.0 <= map_score <= 1.0


# ═══════════════════════════════════════════════════════════════════════════════
# 5. DCG
# ═══════════════════════════════════════════════════════════════════════════════
class TestDCG:
    """DCG = rel_1 + Σ rel_i / log2(i) for i >= 2."""

    def test_single_element(self) -> None:
        assert discounted_cumulative_gain([1.0]) == 1.0

    def test_two_elements(self) -> None:
        # DCG = 1.0 + 0.5 / log2(2) = 1.0 + 0.5/1 = 1.5
        assert discounted_cumulative_gain([1.0, 0.5]) == 1.5

    def test_three_elements(self) -> None:
        # DCG = 1.0 + 0.5/1 + 0.3/log2(3) = 1.0 + 0.5 + 0.3/1.585 = 1.6894...
        expected = 1.0 + 0.5 / 1.0 + 0.3 / math.log2(3)
        assert discounted_cumulative_gain([1.0, 0.5, 0.3]) == pytest.approx(expected)

    def test_empty(self) -> None:
        assert discounted_cumulative_gain([]) == 0.0

    def test_all_zero(self) -> None:
        assert discounted_cumulative_gain([0.0, 0.0, 0.0]) == 0.0

    def test_k_truncation(self) -> None:
        # With k=2: [1.0, 0.5] → DCG = 1.0 + 0.5 = 1.5
        assert discounted_cumulative_gain([1.0, 0.5, 0.3], k=2) == 1.5

    def test_k_larger_than_list(self) -> None:
        # k > len → uses all
        assert discounted_cumulative_gain([1.0], k=10) == 1.0

    def test_k_zero(self) -> None:
        assert discounted_cumulative_gain([1.0, 0.5], k=0) == 0.0


# ═══════════════════════════════════════════════════════════════════════════════
# 6. NDCG
# ═══════════════════════════════════════════════════════════════════════════════
class TestNDCG:
    """NDCG = DCG / IDCG.  IDCG = DCG of ideal (sorted descending) ranking."""

    def test_perfect_ranking(self) -> None:
        # [1.0, 0.5, 0.3] already sorted desc → NDCG = 1.0
        assert normalized_dcg([1.0, 0.5, 0.3]) == 1.0

    def test_worst_ranking(self) -> None:
        # [0.3, 0.5, 1.0] → DCG = 0.3 + 0.5/1 + 1.0/log2(3)
        # IDCG = 1.0 + 0.5/1 + 0.3/log2(3)
        dcg = 0.3 + 0.5 / 1.0 + 1.0 / math.log2(3)
        idcg = 1.0 + 0.5 / 1.0 + 0.3 / math.log2(3)
        assert normalized_dcg([0.3, 0.5, 1.0]) == pytest.approx(dcg / idcg)

    def test_single_element(self) -> None:
        assert normalized_dcg([1.0]) == 1.0

    def test_all_zero(self) -> None:
        assert normalized_dcg([0.0, 0.0]) == 0.0

    def test_empty(self) -> None:
        assert normalized_dcg([]) == 0.0

    def test_ndcg_bounds(self) -> None:
        """NDCG must be in [0, 1]."""
        for perm in [[1.0, 0.5, 0.3], [0.3, 1.0, 0.5], [0.5, 0.3, 1.0]]:
            assert 0.0 <= normalized_dcg(perm) <= 1.0

    def test_k_truncation(self) -> None:
        # k=1: only first element → DCG=0.3, IDCG=1.0 → NDCG=0.3
        assert normalized_dcg([0.3, 1.0, 0.5], k=1) == pytest.approx(0.3)

    def test_binary_relevance(self) -> None:
        # [1, 0, 1] → DCG = 1 + 0/log2(2) + 1/log2(3) = 1 + 0 + 0.631
        # IDCG = [1, 1, 0] → DCG = 1 + 1/1 + 0 = 2.0
        dcg = 1.0 + 0.0 + 1.0 / math.log2(3)
        idcg = 2.0
        assert normalized_dcg([1, 0, 1]) == pytest.approx(dcg / idcg)


# ═══════════════════════════════════════════════════════════════════════════════
# 7. HIT RATE
# ═══════════════════════════════════════════════════════════════════════════════
class TestHitRate:
    """HR@k = fraction of queries with ≥1 relevant doc in top-k."""

    def test_all_hit(self) -> None:
        queries = [["a"], ["b"]]
        relevants = [{"a"}, {"b"}]
        assert hit_rate(queries, relevants) == 1.0

    def test_none_hit(self) -> None:
        queries = [["x"], ["y"]]
        relevants = [{"a"}, {"b"}]
        assert hit_rate(queries, relevants) == 0.0

    def test_half_hit(self) -> None:
        queries = [["a", "x"], ["y", "z"]]
        relevants = [{"a"}, {"b"}]
        assert hit_rate(queries, relevants) == 0.5

    def test_k_truncation(self) -> None:
        # k=1: ["x", "a"] → only "x" checked → no hit
        # k=2: ["x", "a"] → "a" found → hit
        queries = [["x", "a"], ["y", "z"]]
        relevants = [{"a"}, {"b"}]
        assert hit_rate(queries, relevants, k=1) == 0.0
        assert hit_rate(queries, relevants, k=2) == 0.5

    def test_empty(self) -> None:
        assert hit_rate([], []) == 0.0

    def test_hit_rate_bounds(self) -> None:
        queries = [["a"], ["x"], ["b"]]
        relevants = [{"a"}, {"y"}, {"b"}]
        hr = hit_rate(queries, relevants)
        assert 0.0 <= hr <= 1.0


# ═══════════════════════════════════════════════════════════════════════════════
# 8. PRECISION@K (intelligence.evaluation version)
# ═══════════════════════════════════════════════════════════════════════════════
class TestPrecisionAtKEvaluation:
    """Tests for the intelligence.evaluation.ranking_metrics version."""

    def test_perfect(self) -> None:
        assert precision_at_k({"a", "b"}, ["a", "b"]) == 1.0

    def test_partial(self) -> None:
        # ["a", "x", "y"] → 1/3 relevant
        assert precision_at_k({"a"}, ["a", "x", "y"]) == pytest.approx(1 / 3)

    def test_none_relevant(self) -> None:
        assert precision_at_k({"z"}, ["a", "b"]) == 0.0

    def test_empty_retrieved(self) -> None:
        assert precision_at_k({"a"}, []) == 0.0

    def test_empty_relevant(self) -> None:
        assert precision_at_k(set(), ["a"]) == 0.0

    def test_k_smaller(self) -> None:
        # k=1: ["a", "b"] → ["a"] → 1/1 = 1.0
        assert precision_at_k({"a", "b"}, ["a", "b", "c"], k=1) == 1.0

    def test_k_zero(self) -> None:
        assert precision_at_k({"a"}, ["a"], k=0) == 0.0


# ═══════════════════════════════════════════════════════════════════════════════
# 9. RECALL@K (intelligence.evaluation version)
# ═══════════════════════════════════════════════════════════════════════════════
class TestRecallAtKEvaluation:
    """Tests for the intelligence.evaluation.ranking_metrics version."""

    def test_perfect(self) -> None:
        assert recall_at_k({"a", "b"}, ["a", "b", "c"]) == 1.0

    def test_partial(self) -> None:
        # 1 of 3 relevant found
        assert recall_at_k({"a", "b", "c"}, ["a", "x", "y"]) == pytest.approx(1 / 3)

    def test_none_relevant(self) -> None:
        assert recall_at_k(set(), ["a"]) == 0.0

    def test_empty_retrieved(self) -> None:
        assert recall_at_k({"a"}, []) == 0.0

    def test_k_truncation(self) -> None:
        # k=1: ["a", "b", "c"] → ["a"] → 1/3
        assert recall_at_k({"a", "b", "c"}, ["a", "b", "c"], k=1) == pytest.approx(
            1 / 3
        )

    def test_recall_increases_with_k(self) -> None:
        """Monotonicity: recall should not decrease as k increases."""
        relevant = {"a", "b", "c"}
        retrieved = ["a", "x", "b", "y", "c"]
        r1 = recall_at_k(relevant, retrieved, k=1)
        r3 = recall_at_k(relevant, retrieved, k=3)
        r5 = recall_at_k(relevant, retrieved, k=5)
        assert r1 <= r3 <= r5


# ═══════════════════════════════════════════════════════════════════════════════
# 10. AGGREGATE SCORING
# ═══════════════════════════════════════════════════════════════════════════════
class TestAggregateScores:
    def test_simple_average(self) -> None:
        results = [
            JudgeResult(dimension="a", score=0.8, judgment="pass"),
            JudgeResult(dimension="b", score=0.6, judgment="pass"),
        ]
        # (0.8 + 0.6) / 2 = 0.7
        assert aggregate_scores(results) == pytest.approx(0.7)

    def test_empty(self) -> None:
        assert aggregate_scores([]) == 0.0

    def test_single(self) -> None:
        results = [JudgeResult(dimension="a", score=0.9, judgment="pass")]
        assert aggregate_scores(results) == 0.9

    def test_all_zero(self) -> None:
        results = [
            JudgeResult(dimension="a", score=0.0, judgment="fail"),
            JudgeResult(dimension="b", score=0.0, judgment="fail"),
        ]
        assert aggregate_scores(results) == 0.0


# ═══════════════════════════════════════════════════════════════════════════════
# 11. WEIGHTED SCORING
# ═══════════════════════════════════════════════════════════════════════════════
class TestWeightScores:
    def test_equal_weights(self) -> None:
        results = [
            JudgeResult(dimension="a", score=0.8, judgment="pass"),
            JudgeResult(dimension="b", score=0.6, judgment="pass"),
        ]
        weights = {"a": 1.0, "b": 1.0}
        # (0.8*1 + 0.6*1) / (1+1) = 1.4/2 = 0.7
        assert weight_scores(results, weights) == pytest.approx(0.7)

    def test_unequal_weights(self) -> None:
        results = [
            JudgeResult(dimension="a", score=1.0, judgment="pass"),
            JudgeResult(dimension="b", score=0.0, judgment="fail"),
        ]
        weights = {"a": 3.0, "b": 1.0}
        # (1.0*3 + 0.0*1) / (3+1) = 3/4 = 0.75
        assert weight_scores(results, weights) == pytest.approx(0.75)

    def test_missing_weight_defaults_to_1(self) -> None:
        results = [
            JudgeResult(dimension="a", score=1.0, judgment="pass"),
            JudgeResult(dimension="unknown", score=0.0, judgment="fail"),
        ]
        weights = {"a": 3.0}
        # (1.0*3 + 0.0*1) / (3+1) = 0.75
        assert weight_scores(results, weights) == pytest.approx(0.75)

    def test_zero_total_weight(self) -> None:
        results = [JudgeResult(dimension="a", score=0.5, judgment="pass")]
        weights = {"a": 0.0}
        assert weight_scores(results, weights) == 0.0

    def test_empty_results(self) -> None:
        assert weight_scores([], {}) == 0.0


# ═══════════════════════════════════════════════════════════════════════════════
# 12. SCORE TO RATING
# ═══════════════════════════════════════════════════════════════════════════════
class TestScoreToRating:
    def test_excellent(self) -> None:
        assert score_to_rating(0.95) == "excellent"
        assert score_to_rating(0.9) == "excellent"

    def test_good(self) -> None:
        assert score_to_rating(0.8) == "good"
        assert score_to_rating(0.7) == "good"

    def test_fair(self) -> None:
        assert score_to_rating(0.6) == "fair"
        assert score_to_rating(0.5) == "fair"

    def test_poor(self) -> None:
        assert score_to_rating(0.4) == "poor"
        assert score_to_rating(0.3) == "poor"

    def test_very_poor(self) -> None:
        assert score_to_rating(0.2) == "very_poor"
        assert score_to_rating(0.0) == "very_poor"

    def test_boundary_exact_thresholds(self) -> None:
        """Boundary: 0.9 → excellent, 0.899 → good, etc."""
        assert score_to_rating(0.9) == "excellent"
        assert score_to_rating(0.899) == "good"
        assert score_to_rating(0.7) == "good"
        assert score_to_rating(0.699) == "fair"
        assert score_to_rating(0.5) == "fair"
        assert score_to_rating(0.499) == "poor"
        assert score_to_rating(0.3) == "poor"
        assert score_to_rating(0.299) == "very_poor"


# ═══════════════════════════════════════════════════════════════════════════════
# 13. RATING TO SCORE
# ═══════════════════════════════════════════════════════════════════════════════
class TestRatingToScore:
    def test_all_ratings(self) -> None:
        assert rating_to_score("excellent") == 0.95
        assert rating_to_score("good") == 0.8
        assert rating_to_score("fair") == 0.6
        assert rating_to_score("poor") == 0.4
        assert rating_to_score("very_poor") == 0.15

    def test_unknown_rating(self) -> None:
        assert rating_to_score("unknown") == 0.0

    def test_case_insensitive(self) -> None:
        assert rating_to_score("Excellent") == 0.95
        assert rating_to_score("GOOD") == 0.8

    def test_roundtrip_exists(self) -> None:
        """For each rating, rating_to_score(score_to_rating(score)) should
        map back to the canonical score for that rating tier."""
        for rating in ["excellent", "good", "fair", "poor", "very_poor"]:
            score = rating_to_score(rating)
            result_rating = score_to_rating(score)
            assert result_rating == rating


# ═══════════════════════════════════════════════════════════════════════════════
# 14. DEFAULT WEIGHTS
# ═══════════════════════════════════════════════════════════════════════════════
class TestDefaultWeights:
    def test_weights_exist(self) -> None:
        w = default_weights()
        assert "faithfulness" in w
        assert "relevance" in w
        assert "hallucination" in w
        assert "grounding" in w

    def test_all_positive(self) -> None:
        w = default_weights()
        for v in w.values():
            assert v > 0

    def test_hallucination_heavier(self) -> None:
        w = default_weights()
        assert w["hallucination"] > w["faithfulness"]
        assert w["hallucination"] > w["relevance"]


# ═══════════════════════════════════════════════════════════════════════════════
# 15. CALIBRATION: ECE
# ═══════════════════════════════════════════════════════════════════════════════
class TestECE:
    """Expected Calibration Error: weighted avg of |accuracy - confidence| per bin."""

    def test_perfect_calibration(self) -> None:
        # All predictions at 0.5 confidence, all succeed → bin accuracy == confidence
        # A truly perfect calibration: conf matches acc in each bin
        conf2 = np.array([1.0, 1.0, 0.0, 0.0])
        succ2 = np.array([1.0, 1.0, 0.0, 0.0])
        ece2 = compute_ece(conf2, succ2, n_bins=2)
        # Bin [0, 0.5): conf=0.0, acc=0.0 → gap=0
        # Bin [0.5, 1.0]: conf=1.0, acc=1.0 → gap=0
        assert ece2 == pytest.approx(0.0, abs=0.01)

    def test_worst_case(self) -> None:
        # All confident but all wrong
        conf = np.array([0.9, 0.9, 0.9])
        succ = np.array([0.0, 0.0, 0.0])
        ece = compute_ece(conf, succ, n_bins=1)
        # |0.0 - 0.9| = 0.9
        assert ece == pytest.approx(0.9, abs=0.01)

    def test_empty(self) -> None:
        assert compute_ece(np.array([]), np.array([])) == 0.0

    def test_single_sample(self) -> None:
        conf = np.array([0.8])
        succ = np.array([1.0])
        ece = compute_ece(conf, succ, n_bins=10)
        # Single bin: |1.0 - 0.8| = 0.2, weight = 1/1 = 1.0
        assert ece == pytest.approx(0.2, abs=0.01)

    def test_bounds(self) -> None:
        """ECE must be in [0, 1]."""
        conf = np.array([0.1, 0.3, 0.5, 0.7, 0.9])
        succ = np.array([0.0, 1.0, 0.0, 1.0, 1.0])
        ece = compute_ece(conf, succ, n_bins=5)
        assert 0.0 <= ece <= 1.0


# ═══════════════════════════════════════════════════════════════════════════════
# 16. CALIBRATION: MCE
# ═══════════════════════════════════════════════════════════════════════════════
class TestMCE:
    """Maximum Calibration Error: max |accuracy - confidence| across bins."""

    def test_perfect(self) -> None:
        conf = np.array([0.5, 0.5, 0.5])
        succ = np.array([1.0, 1.0, 1.0])
        mce = compute_mce(conf, succ, n_bins=1)
        assert mce == pytest.approx(0.5, abs=0.01)

    def test_empty(self) -> None:
        assert compute_mce(np.array([]), np.array([])) == 0.0

    def test_mce_ge_ece(self) -> None:
        """MCE ≥ ECE always (max ≥ average)."""
        conf = np.array([0.2, 0.4, 0.6, 0.8])
        succ = np.array([0.0, 1.0, 0.0, 1.0])
        ece = compute_ece(conf, succ, n_bins=4)
        mce = compute_mce(conf, succ, n_bins=4)
        assert mce >= ece - 1e-10


# ═══════════════════════════════════════════════════════════════════════════════
# 17. CALIBRATION: BRIER SCORE
# ═══════════════════════════════════════════════════════════════════════════════
class TestBrierScore:
    """Brier = mean((conf - outcome)^2).  Range [0, 1]."""

    def test_perfect(self) -> None:
        conf = np.array([1.0, 0.0, 1.0])
        succ = np.array([1.0, 0.0, 1.0])
        assert compute_brier_score(conf, succ) == pytest.approx(0.0)

    def test_worst(self) -> None:
        # All wrong: conf=1 but outcome=0
        conf = np.array([1.0, 1.0])
        succ = np.array([0.0, 0.0])
        # (1-0)^2 = 1.0 for each → mean = 1.0
        assert compute_brier_score(conf, succ) == pytest.approx(1.0)

    def test_half_wrong(self) -> None:
        conf = np.array([1.0, 0.0])
        succ = np.array([0.0, 0.0])
        # (1-0)^2 + (0-0)^2 = 1 + 0 = 1 → mean = 0.5
        assert compute_brier_score(conf, succ) == pytest.approx(0.5)

    def test_empty(self) -> None:
        assert compute_brier_score(np.array([]), np.array([])) == 0.0

    def test_bounds(self) -> None:
        conf = np.array([0.3, 0.7, 0.5])
        succ = np.array([1.0, 0.0, 1.0])
        brier = compute_brier_score(conf, succ)
        assert 0.0 <= brier <= 1.0


# ═══════════════════════════════════════════════════════════════════════════════
# 18. GROUNDING: WORD OVERLAP
# ═══════════════════════════════════════════════════════════════════════════════
class TestGroundingWordOverlap:
    def test_perfect_overlap(self) -> None:
        overlap = GroundingJudge._compute_word_overlap(
            "the cat sat on mat", "the cat sat on mat"
        )
        # Content words: cat, sat, mat → all in context → 3/3 = 1.0
        assert overlap == pytest.approx(1.0)

    def test_no_overlap(self) -> None:
        overlap = GroundingJudge._compute_word_overlap("xyz quantum", "abc def ghi")
        assert overlap == pytest.approx(0.0)

    def test_partial_overlap(self) -> None:
        overlap = GroundingJudge._compute_word_overlap("the cat sat", "the dog ran")
        # Content words: cat, sat → only "the" is stop word
        # "cat" not in context, "sat" not in context → 0/2 = 0.0
        # Wait, let me re-check. context = "the dog ran" → words: the, dog, ran
        # Content answer words: cat, sat (removing stop words: the)
        # Content context words: dog, ran (removing stop words: the)
        # Overlap: none → 0.0
        assert overlap == pytest.approx(0.0)

    def test_empty_answer(self) -> None:
        overlap = GroundingJudge._compute_word_overlap("", "some context")
        assert overlap == 0.0

    def test_all_stop_words(self) -> None:
        # If answer is only stop words → content_words empty → returns 1.0
        overlap = GroundingJudge._compute_word_overlap("the a an is are", "hello world")
        assert overlap == 1.0

    def test_bounds(self) -> None:
        overlap = GroundingJudge._compute_word_overlap(
            "quantum computing breakthrough", "quantum physics research"
        )
        assert 0.0 <= overlap <= 1.0


# ═══════════════════════════════════════════════════════════════════════════════
# 19. PROPERTY INVARIANTS
# ═══════════════════════════════════════════════════════════════════════════════
class TestPropertyInvariants:
    """Cross-metric mathematical invariants."""

    def test_precision_recall_bounds(self) -> None:
        for rel_count in [1, 2, 5]:
            for ret_count in [1, 3, 10]:
                relevant = {f"doc_{i}" for i in range(rel_count)}
                retrieved = [f"doc_{i}" for i in range(ret_count)]
                p = precision_at_k(relevant, retrieved)
                r = recall_at_k(relevant, retrieved)
                assert 0.0 <= p <= 1.0, f"P={p}"
                assert 0.0 <= r <= 1.0, f"R={r}"

    def test_ndcg_perfect_is_one(self) -> None:
        """Perfect ranking always yields NDCG=1.0."""
        for rels in [[1.0], [1.0, 0.5], [3.0, 2.0, 1.0]]:
            ideal = sorted(rels, reverse=True)
            assert normalized_dcg(ideal) == 1.0

    def test_mrr_bounds(self) -> None:
        queries = [["a"], ["x"], ["b"]]
        relevants = [{"a"}, {"y"}, {"b"}]
        mrr = mean_reciprocal_rank(queries, relevants)
        assert 0.0 <= mrr <= 1.0

    def test_map_bounds(self) -> None:
        queries = [["a", "b"], ["c"]]
        relevants = [{"a"}, {"c"}]
        m = mean_average_precision(queries, relevants)
        assert 0.0 <= m <= 1.0

    def test_brier_score_non_negative(self) -> None:
        conf = np.random.rand(100)
        succ = np.random.randint(0, 2, 100).astype(float)
        brier = compute_brier_score(conf, succ)
        assert brier >= 0.0

    def test_ece_non_negative(self) -> None:
        conf = np.random.rand(100)
        succ = np.random.randint(0, 2, 100).astype(float)
        ece = compute_ece(conf, succ, n_bins=10)
        assert ece >= 0.0

    def test_mce_non_negative(self) -> None:
        conf = np.random.rand(100)
        succ = np.random.randint(0, 2, 100).astype(float)
        mce = compute_mce(conf, succ, n_bins=10)
        assert mce >= 0.0
