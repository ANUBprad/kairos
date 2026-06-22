# Kairos Walkthrough

## Dashboard Walkthrough

### Navigation
The sidebar provides access to 12 pages organized in two sections:

**Phase 7 — Core:**
- **Experiments** — Browse experiment runs with metrics and rankings
- **Benchmarks** — Explore dataset performance and trends
- **Ablations** — Analyze feature contributions and deltas
- **Statistics** — View p-values, confidence intervals, effect sizes
- **Observability** — Monitor latency, failures, alerts, throughput

**Phase 9 — Research V2:**
- **Leaderboard** — Cross-domain mode rankings with scores
- **Domain Analysis** — Per-domain performance breakdown
- **Planner Analysis** — Strategy distribution and confidence scores
- **Cost Analysis** — Mode costs, cost-effectiveness ratios
- **Ablation V2** — Component impact with statistical significance
- **Judge Dashboard** — LLM judge dimension scores across domains
- **Comparisons** — Full mode comparison matrix

## Benchmark Walkthrough

### Running Benchmarks
```bash
# Run end-to-end benchmark on all domains
python -m benchmarks.e2e.benchmark_runner

# Generate comparison report
python -m benchmarks.e2e.comparison

# Generate ablation report
python -m benchmarks.e2e.ablation

# Generate cost analysis
python -m benchmarks.e2e.cost_analysis
```

### Viewing Results
Benchmark reports are generated in `benchmarks/results/e2e/reports/`:
- `e2e_benchmark_report.md` — Full cross-domain report
- Leaderboard page in the dashboard

## Deployment Walkthrough

### Local Development
```bash
# Full stack
docker compose up -d

# Or individual services
docker compose up -d chromadb
docker compose up -d gateway
docker compose up -d api
docker compose up -d dashboard
```

### Production Considerations
- Set `ENVIRONMENT=production` in `.env`
- Configure HTTPS via reverse proxy
- Enable authentication on API endpoints
- Set up Prometheus + Grafana monitoring
- Configure backup strategy for ChromaDB

## Architecture Explanation

See `docs/diagrams/` for detailed Mermaid diagrams:

| Diagram | Description |
|---------|-------------|
| [Retrieval Flow](docs/diagrams/retrieval_flow.md) | End-to-end retrieval pipeline |
| [Planner Flow](docs/diagrams/planner_flow.md) | Adaptive planner components |
| [Feedback Loop](docs/diagrams/feedback_loop.md) | Quality feedback and improvement |
| [Evaluation Pipeline](docs/diagrams/evaluation_pipeline.md) | Benchmark and judge pipeline |
| [Deployment Architecture](docs/diagrams/deployment_architecture.md) | Full stack deployment |
