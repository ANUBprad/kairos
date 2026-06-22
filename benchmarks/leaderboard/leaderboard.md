# Kairos Benchmark Leaderboard

*Ranked by composite score*

| Rank | Mode | Recall | Precision | MRR | MAP | NDCG | Hit Rate | Faithfulness | Latency (ms) | Cost/Query | Composite |
|------|------|--------|-----------|-----|-----|------|----------|--------------|-------------|------------|-----------|
| 1 | Kairos Adaptive | 0.940 | 0.870 | 0.930 | 0.850 | 0.900 | 0.980 | 0.910 | 163.0 | $0.0145 | 0.890 |
| 2 | Always Multi-Hop | 0.910 | 0.800 | 0.890 | 0.780 | 0.840 | 0.960 | 0.820 | 190.0 | $0.0220 | 0.800 |
| 3 | Always Complex | 0.900 | 0.780 | 0.880 | 0.760 | 0.820 | 0.950 | 0.800 | 170.0 | $0.0184 | 0.780 |
| 4 | Always Simple | 0.880 | 0.750 | 0.860 | 0.730 | 0.790 | 0.930 | 0.770 | 133.0 | $0.0100 | 0.750 |
| 5 | Naive RAG | 0.850 | 0.720 | 0.830 | 0.700 | 0.760 | 0.910 | 0.740 | 145.0 | $0.0123 | 0.720 |

## Best Performing Mode

**Kairos Adaptive** achieves the highest scores across all retrieval quality metrics:

| Metric | Score | vs Baseline |
|--------|-------|-------------|
| Composite | **0.890** | +23.6% |
| Recall | **0.940** | +10.6% |
| Precision | **0.870** | +20.8% |
| MRR | **0.930** | +12.0% |
| MAP | **0.850** | +21.4% |
| NDCG | **0.900** | +18.4% |
| Hit Rate | **0.980** | +7.7% |
| Faithfulness | **0.910** | +23.0% |
| Latency | **163.0ms** | +12.4% (acceptable) |
| Cost/Query | **$0.0145** | +17.9% (vs baseline) |

## Cost-Effectiveness

| Mode | Score per $0.01 | Cost Ratio vs Baseline |
|------|----------------|----------------------|
| Always Simple | 0.75 | 0.82x |
| Naive RAG | 0.59 | 1.00x |
| Kairos Adaptive | 0.61 | 1.18x |
| Always Complex | 0.42 | 1.50x |
| Always Multi-Hop | 0.36 | 1.79x |

Kairos Adaptive offers the **best cost-effectiveness ratio** among modes scoring above 0.80.
