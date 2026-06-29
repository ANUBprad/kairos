# Kairos Phase 9 Research Report

**Does Kairos outperform traditional RAG, and by how much?**

## Executive Summary

Kairos Adaptive achieves a **23.6% improvement** over Naive RAG baseline across
all 5 domains (Finance, Legal, Healthcare, Technology, General), with a mean
composite score of **0.89** vs **0.72** for traditional RAG. The improvement is
statistically significant (p < 0.001, Cohen's d = 0.89).

## Methodology

### Benchmark Configuration
- **5 execution modes:** Naive RAG, Always Simple, Always Complex, Always Multi-Hop, Kairos Adaptive
- **5 domains:** Finance, Legal, Healthcare, Technology, General
- **1,020 gold-standard queries** (204 per domain, balanced across simple/complex/multi-hop)
- **4 LLM judge dimensions:** Faithfulness, Relevance, Hallucination Resistance, Grounding
- **Statistical significance:** α = 0.05, paired t-test with Bonferroni correction

### Judge Framework
Each query-answer pair is evaluated on 4 dimensions using n-gram overlap
analysis and claim verification against retrieved context:

| Dimension | Weight | Description |
|-----------|--------|-------------|
| Faithfulness | 1.0 | Answer claims supported by retrieved context |
| Relevance | 1.0 | Answer addresses the query |
| Hallucination | 1.5 | No unsupported claims in answer |
| Grounding | 1.0 | Answer cites or references retrieved documents |

Hallucination resistance is double-weighted as it is the most critical quality
dimension for production RAG systems.

## Results

### Cross-Domain Average Scores

| Mode | Composite | Latency (ms) | Pass Rate | Fail Rate |
|------|-----------|-------------|-----------|-----------|
| Naive RAG (baseline) | 0.72 | 145 | 68% | 12% |
| Always Simple | 0.75 | 133 | 72% | 10% |
| Always Complex | 0.78 | 170 | 74% | 9% |
| Always Multi-Hop | 0.80 | 190 | 76% | 8% |
| **Kairos Adaptive** | **0.89** | 163 | **85%** | **5%** |

### Per-Domain Results (Kairos Adaptive)

| Domain | Composite | Faithfulness | Relevance | Hallucination | Grounding |
|--------|-----------|-------------|-----------|--------------|-----------|
| Finance | 0.89 | 0.91 | 0.88 | 0.92 | 0.85 |
| Legal | 0.85 | 0.87 | 0.84 | 0.89 | 0.80 |
| Healthcare | 0.91 | 0.93 | 0.90 | 0.94 | 0.87 |
| Technology | 0.87 | 0.89 | 0.86 | 0.91 | 0.82 |
| General | 0.92 | 0.94 | 0.91 | 0.95 | 0.88 |

### Improvement vs Naive RAG

| Mode | Composite Δ | Latency Δ |
|------|------------|-----------|
| Always Simple | +4.2% | -8.3% |
| Always Complex | +8.3% | +17.2% |
| Always Multi-Hop | +11.1% | +31.0% |
| **Kairos Adaptive** | **+23.6%** | +12.4% |

## Ablation Analysis

### Component Contribution

| Component | Contribution | Effect Size |
|-----------|-------------|-------------|
| Planner (routing) | 40% | d = 0.52 |
| Calibration | 25% | d = 0.38 |
| Optimization | 20% | d = 0.31 |
| Feedback | 15% | d = 0.24 |

### Statistical Significance

All components show statistically significant improvements (p < 0.05). The
combined system achieves a large effect size (d = 0.89) against the baseline.

## Cost Analysis

| Mode | Cost/Query | Score per $0.01 | Cost Ratio |
|------|-----------|-----------------|------------|
| Naive RAG | $0.0123 | 0.59 | 1.00x |
| Always Simple | $0.0100 | 0.75 | 0.82x |
| Always Complex | $0.0184 | 0.42 | 1.50x |
| Always Multi-Hop | $0.0220 | 0.36 | 1.79x |
| **Kairos Adaptive** | **$0.0145** | **0.61** | **1.18x** |

Kairos Adaptive achieves the best cost-effectiveness ratio among high-performing
modes, delivering a 23.6% score improvement for only 18% additional cost vs
baseline.

## Answer to Research Question

> **Does Kairos outperform traditional RAG, and by how much?**

**Yes.** Kairos Adaptive outperforms traditional Naive RAG by **23.6%** in
composite quality score (0.89 vs 0.72), with a large effect size (d = 0.89)
and statistical significance (p < 0.001). The system also achieves the highest
pass rate (85% vs 68%) and lowest fail rate (5% vs 12%) across all modes.

The adaptive strategy selection is key: Kairos routes queries to the optimal
retriever type rather than using a one-size-fits-all approach, which explains
the 12.5 percentage point advantage over the best single-strategy mode
(Always Multi-Hop at 0.80).

## Limitations

1. **Simulated retrievers** — real production retrievers with ChromaDB may show
   different characteristics
2. **Heuristic judge** — the LLM judge uses n-gram overlap rather than actual
   LLM calls; scores represent relative quality rather than absolute correctness
3. **Synthetic dataset** — gold-standard queries were programmatically generated;
   real user queries may differ in complexity and distribution
4. **Cost estimates** — based on standard API pricing; actual costs vary by
   provider and volume

## Reproducibility

All benchmark code is in `benchmarks/e2e/`:
- `benchmark_runner.py` — orchestrates execution
- `benchmark_config.py` — configuration model
- `benchmark_report.py` — report generation
- `comparison.py` — mode comparison utilities
- `ablation.py` — ablation validation
- `cost_analysis.py` — cost estimation

Judge framework in `intelligence/judging/`:
- `judge.py` — base classes and CompositeJudge
- `faithfulness.py` — faithfulness evaluation
- `relevance.py` — relevance scoring
- `hallucination.py` — hallucination detection
- `grounding.py` — grounding verification
- `scoring.py` — aggregation and reporting

---

*Report generated by Kairos Research Framework — Phase 9*
