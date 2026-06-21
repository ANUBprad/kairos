# Benchmarks

## Test Suite

The Keiro test suite contains **1241+ tests** covering:

- Query classification
- Retrieval (simple, complex, multi-hop)
- Embedding cache
- Circuit breaker
- Telemetry
- Feedback learning
- Calibration
- Budget optimization
- Ablation framework
- Benchmark framework
- Statistical validation
- Research reporting
- Observability (tracing, event logging, performance, alerting)
- Evaluation (MRR, MAP, NDCG, Hit Rate)
- Dashboard pages (smoke tests)
- Configuration system
- API platform (middleware, auth, rate limiting, versioning, health)
- Artifact management (model/experiment/report registries)
- Version tracking

## Running Benchmarks

```bash
# Full test suite
pytest tests/ -v

# With coverage
pytest tests/ --cov=intelligence --cov-report=term-missing

# Generate benchmark report
python scripts/benchmark.py
```

## Evaluation Metrics

| Metric | Description |
|--------|-------------|
| MRR | Mean Reciprocal Rank |
| MAP | Mean Average Precision |
| NDCG | Normalized Discounted Cumulative Gain |
| Hit Rate | Proportion of queries with at least one relevant result |
| Recall@k | Recall at top-k retrieved documents |
| Precision@k | Precision at top-k retrieved documents |
