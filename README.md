<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/anomalyco/kairos/main/assets/logo-dark.svg">
    <img alt="Kairos" src="https://raw.githubusercontent.com/anomalyco/kairos/main/assets/logo-light.svg" width="600">
  </picture>
</p>

<p align="center">
  <em>Adaptive Retrieval-Augmented Generation for Production RAG Systems</em>
</p>

<p align="center">
  <a href="#"><img src="https://img.shields.io/badge/Python-3.11+-3776AB?style=flat&logo=python&logoColor=white" alt="Python"></a>
  <a href="#"><img src="https://img.shields.io/badge/Go-1.26+-00ADD8?style=flat&logo=go&logoColor=white" alt="Go"></a>
  <a href="#"><img src="https://img.shields.io/badge/Tests-1671%20passed-22c55e?style=flat" alt="Tests"></a>
  <a href="#"><img src="https://img.shields.io/badge/License-MIT-22c55e?style=flat" alt="License"></a>
  <a href="#"><img src="https://img.shields.io/badge/Docker-compose-2496ED?style=flat&logo=docker&logoColor=white" alt="Docker"></a>
  <a href="#"><img src="https://img.shields.io/badge/ChromaDB-vector%20store-FF6B35?style=flat" alt="ChromaDB"></a>
  <a href="#"><img src="https://img.shields.io/badge/Dashboard-Streamlit-FF4B4B?style=flat" alt="Dashboard"></a>
  <a href="#"><img src="https://img.shields.io/badge/DOI-10.5281%2Fzenodo.20639902-4285F4?style=flat" alt="DOI"></a>
</p>

---

## Kairos

**Kairos** (καιρός — the right, critical moment) is a self-hostable adaptive RAG infrastructure that routes queries through three retrieval tiers based on complexity, validated across 1,671 tests, 5 benchmark modes, and 5 domains.

A single `docker compose up` starts the full stack — Go API gateway, Python intelligence services, ChromaDB vector store, and Streamlit dashboard.

---

## Why Kairos Exists

Most RAG implementations treat every query identically: embed, retrieve `k` chunks, call the LLM. This wastes tokens on simple lookups and retrieves too little context for complex synthesis or chained reasoning.

Kairos classifies each query *before* retrieval and routes it through the optimal strategy:

| Query Type | Strategy | Top-K | Rerank | Hops |
|-----------|----------|-------|--------|------|
| **Simple** | Direct retrieval, skip reranker | 2–3 | No | 1 |
| **Complex** | MMR diversity + cross-encoder rerank | 5–8 | Yes | 1 |
| **Multi-Hop** | Iterative retrieval with query reformulation | 5–7 | Yes | 2–3 |

**Result:** Computation scales proportionally to query difficulty — validated by a **23.6% improvement** over traditional RAG across 1,020 gold-standard queries.

---

## Core Features

- **Adaptive Query Routing** — Planner classifies queries into simple / complex / multi-hop and selects the optimal strategy
- **Three Retrieval Tiers** — Direct, diversity-reranked, and iterative multi-hop retrieval
- **Confidence Calibration** — Platt-scaled classifier confidence scores
- **LLM Judge Framework** — 4-dimensional answer quality evaluation (Faithfulness, Relevance, Hallucination, Grounding)
- **Research Dashboard** — 12 Streamlit pages for experiments, benchmarks, ablations, observability, and cost analysis
- **Full Observability** — Distributed tracing, event logging, performance monitoring, alerting, Prometheus metrics
- **Production API** — FastAPI management API with auth, rate limiting, versioning, health checks
- **Dockerized** — Full stack in one `docker compose up`
- **1,671 Tests** — Comprehensive test suite with zero regressions

---

## Architecture Overview

```
                    ┌─────────────────────────────────────────────┐
                    │               Go API Gateway                │
  HTTP Request  ──► │  Auth → Namespace → Rate Limit → Cache     │
                    └─────────────────────┬───────────────────────┘
                                          │ gRPC
                    ┌─────────────────────▼───────────────────────┐
                    │          Python Intelligence Service        │
                    │  ┌──────────┐  ┌──────────┐  ┌──────────┐  │
                    │  │Classifier│  │ Planner  │  │Retriever │  │
                    │  └──────────┘  └──────────┘  └──────────┘  │
                    │  ┌──────────┐  ┌──────────┐  ┌──────────┐  │
                    │  │  Judge   │  │Evaluator │  │  Cache   │  │
                    │  └──────────┘  └──────────┘  └──────────┘  │
                    └─────────────────────┬───────────────────────┘
                                          │
                    ┌─────────────────────▼───────────────────────┐
                    │           ChromaDB Vector Store             │
                    │  Finance │ Legal │ Healthcare │ Tech │ Gen  │
                    └─────────────────────────────────────────────┘
```

See [docs/diagrams/](docs/diagrams/) for detailed flow diagrams.

---

## Quick Start

```bash
# Clone the repository
git clone https://github.com/anomalyco/kairos.git
cd kairos

# (Recommended) Create virtual environment
python -m venv venv
source venv/bin/activate  # Linux/Mac
# .\venv\Scripts\activate  # Windows

# Install Python dependencies
pip install -r requirements.txt

# Start the full stack
docker compose up -d

# Run the test suite
pytest tests/ -v

# Start the research dashboard
streamlit run dashboard/app.py
```

---

## Docker Setup

```yaml
services:
  gateway:    # Go API gateway (port 8080)
  api:        # FastAPI management API (port 8000)
  dashboard:  # Streamlit research dashboard (port 8501)
  worker:     # Background task worker
  chromadb:   # Vector store
```

```bash
docker compose up -d
docker compose logs -f
```

---

## Dashboard Preview

![Dashboard](demo/screenshots/dashboard.png)

| Page | Description |
|------|-------------|
| **Experiments** | Browse experiment runs, metrics, rankings |
| **Benchmarks** | Dataset performance and trends |
| **Ablations** | Feature contributions and deltas |
| **Statistics** | P-values, confidence intervals, effect sizes |
| **Observability** | Latency, failures, alerts, throughput |
| **Leaderboard** | Cross-domain mode rankings |
| **Domain Analysis** | Per-domain performance breakdown |
| **Planner Analysis** | Strategy distribution and confidence |
| **Cost Analysis** | Estimated costs and cost-effectiveness |
| **Ablation V2** | Component impact analysis |
| **Judge Dashboard** | LLM judge dimension scores |
| **Comparisons** | Full mode comparison matrix |

---

## Benchmark Results

### Cross-Domain Average (5 domains × 204 queries each = 1,020 total)

| Mode | Composite | Latency (ms) | Pass Rate | Fail Rate |
|------|-----------|-------------|-----------|-----------|
| Naive RAG | 0.72 | 145 | 68% | 12% |
| Always Simple | 0.75 | 133 | 72% | 10% |
| Always Complex | 0.78 | 170 | 74% | 9% |
| Always Multi-Hop | 0.80 | 190 | 76% | 8% |
| **Kairos Adaptive** | **0.89** | 163 | **85%** | **5%** |

**Kairos Adaptive outperforms Naive RAG by 23.6%** (p < 0.001, Cohen's d = 0.89).

---

## Research Validation Results

| Dimension | Score | Weight |
|-----------|-------|--------|
| Faithfulness | 0.91 | 1.0× |
| Relevance | 0.88 | 1.0× |
| Hallucination Resistance | 0.93 | 1.5× |
| Grounding | 0.85 | 1.0× |

> **Does Kairos outperform traditional RAG?** Yes — by **23.6%** in composite quality score with a large effect size (d = 0.89).

Full report: [docs/phase9_report.md](docs/phase9_report.md)

---

## Project Structure

```
kairos/
├── gateway/          # Go API gateway with auth, rate limiting, caching
├── intelligence/     # Python service (classifier, planner, retrievers)
│   ├── planner/      # Adaptive query routing
│   ├── retrieval/    # Simple, complex, multi-hop retrievers
│   ├── judging/      # LLM Judge Framework (Phase 9C)
│   ├── evaluation/   # Ranking metrics, evaluator
│   ├── observability/# Tracing, events, monitoring, alerting
│   ├── config/       # Pydantic settings, environments, secrets
│   ├── api/          # FastAPI management API
│   ├── artifacts/    # Model/experiment/report registries
│   └── ablation/     # Component ablation framework
├── benchmarks/       # Benchmark suite and datasets
│   ├── datasets/     # Gold dataset generator (1,020 queries)
│   ├── e2e/          # End-to-end benchmark pipeline
│   └── leaderboard/  # Public benchmark leaderboard
├── dashboard/        # Streamlit research dashboard (12 pages)
├── docs/             # Documentation and diagrams
├── docker/           # Dockerfiles
├── examples/         # Runnable example applications
├── tests/            # 1,671 tests
├── .github/          # Issue/PR templates, CI/CD
├── docker-compose.yml
└── requirements.txt
```

---

## Documentation Index

| Document | Description |
|----------|-------------|
| [ARCHITECTURE.md](docs/ARCHITECTURE.md) | System architecture and component design |
| [BENCHMARKS.md](docs/BENCHMARKS.md) | Benchmark methodology and metrics |
| [DEPLOYMENT.md](docs/DEPLOYMENT.md) | Deployment guide and configuration |
| [OBSERVABILITY.md](docs/OBSERVABILITY.md) | Monitoring, tracing, and alerting |
| [OPERATIONS.md](docs/OPERATIONS.md) | Production operations guide |
| [phase9_report.md](docs/phase9_report.md) | Research validation results |
| [CONTRIBUTING.md](CONTRIBUTING.md) | Contributor guide |
| [SECURITY.md](SECURITY.md) | Security policy |
| [CHANGELOG.md](CHANGELOG.md) | Version history |

---

## Roadmap

| Phase | Focus | Status |
|-------|-------|--------|
| 1–3 | Core retrieval pipeline | ✅ Complete |
| 4–6 | Planner, calibration, optimization | ✅ Complete |
| 7 | Observability & evaluation | ✅ Complete |
| 8 | API & production deployment | ✅ Complete |
| 9 | Research validation (Phase 9 report) | ✅ Complete |
| 10 | **Open source & launch readiness** | ✅ Complete |

See [docs/ROADMAP.md](docs/ROADMAP.md) for detailed roadmap.

---

## Contributing

We welcome contributions! See [CONTRIBUTING.md](CONTRIBUTING.md) for our contributor workflow, coding standards, and PR checklist.

Quick start:
1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

---

## License

Distributed under the MIT License. See `LICENSE` for more information.

---

<p align="center">
  <a href="https://github.com/anomalyco/kairos">GitHub</a> •
  <a href="docs/ARCHITECTURE.md">Architecture</a> •
  <a href="docs/BENCHMARKS.md">Benchmarks</a> •
  <a href="CONTRIBUTING.md">Contributing</a>
</p>
