<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="docs/assets/logo/kairos-logo.png">
    <img src="docs/assets/logo/kairos-logo.png" alt="Kairos" width="120">
  </picture>
</p>

<h1 align="center">Kairos</h1>

<p align="center">
  <strong>Adaptive Retrieval Infrastructure for Production AI Systems</strong>
</p>

<p align="center">
  Every query deserves a different retrieval strategy.
</p>

<p align="center">
  Kairos classifies, plans, and routes every query to the optimal retrieval strategy —<br>
  balancing quality, latency, confidence, and cost in real time.
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Python-3.11+-3776AB?style=flat&logo=python&logoColor=white" alt="Python">
  <img src="https://img.shields.io/badge/Go-1.26-00ADD8?style=flat&logo=go&logoColor=white" alt="Go">
  <img src="https://img.shields.io/badge/Tests-1802-22c55e?style=flat" alt="Tests">
  <img src="https://img.shields.io/badge/License-MIT-yellow?style=flat" alt="License">
  <img src="https://img.shields.io/badge/Docker-compose-2496ED?style=flat&logo=docker&logoColor=white" alt="Docker">
</p>

---

## Why Kairos Exists

Most RAG systems treat every query identically — embed, retrieve `k` chunks, call the LLM. This wastes compute on simple lookups and retrieves too little context for complex questions.

Kairos solves this by analyzing each query before retrieval:

- **Classifies** query complexity (simple, complex, multi-hop)
- **Predicts** confidence for each strategy
- **Selects** the optimal retrieval strategy per query
- **Allocates** retrieval budget based on difficulty
- **Monitors** outcomes and adjusts over time
- **Learns** from feedback signals

The result: a system that adapts to the question, not the other way around.

---

## Problem

A simple question like "What is our refund policy?" needs a cheap keyword lookup — a few milliseconds. A complex question like "Compare Q1 and Q3 revenue and explain the variance" requires multi-hop retrieval across documents, taking seconds.

Traditional systems treat both identically. Simple queries are over-engineered and expensive. Complex queries return shallow results.

Kairos adapts. Each query is classified, analyzed, and routed to the retrieval strategy that fits — no more, no less.

---

## Solution

```
User Query
    |
    v
Query Analysis
    |
    v
Complexity Classification
    |
    +-- Simple      --> Hybrid Keyword + Vector Search
    +-- Complex     --> MMR Diversity + Cross-Encoder Rerank
    +-- Multi-Hop   --> Iterative Retrieval with Query Reformulation (2-3 hops)
    |
    v
Confidence Prediction
    |
    v
Strategy Selection
    |
    v
Retrieval Execution
    |
    v
Answer + Cited Sources
    |
    v
Feedback Loop
```

The system runs on a Go API gateway with gRPC transport to a Python intelligence service. Every step is instrumented — latency, confidence, cost, and strategy selection are visible per query.

---

## Architecture

```
gateway/          Go API gateway — auth, rate limiting, caching, gRPC routing
intelligence/     Python intelligence service — 28 modules
benchmarks/       Benchmark suite — runner, metrics, datasets, leaderboard
dashboard/        Streamlit research dashboard — experiments, observability
tests/            1,802 tests across 37 test files
proto/            gRPC protocol buffer definitions
sdk/keiro/        Python client SDK
docs/             Architecture, benchmarks, deployment, operations
docker/           Dockerfiles for each service
```

```
                    +-------------------------------------+
                    |          Go API Gateway             |
  HTTP Request -->  |  Auth -> Rate Limit -> Cache -> gRPC |
                    +------------------+------------------+
                                       | gRPC
                    +------------------v------------------+
                    |     Python Intelligence Service      |
                    |  +----------+  +----------+         |
                    |  |Classifier|  | Planner  |         |
                    |  +----------+  +----------+         |
                    |  +----------+  +----------+         |
                    |  |Retrievers|  |Evaluator |         |
                    |  +----------+  +----------+         |
                    |  +----------+  +----------+         |
                    |  |Calibrator|  | Judge    |         |
                    |  +----------+  +----------+         |
                    +------------------+------------------+
                                       |
                    +------------------v------------------+
                    |        ChromaDB Vector Store         |
                    |  Finance | Legal | Medical | Tech   |
                    +-------------------------------------+
```

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for the complete system design.

---

## Core Capabilities

| Capability | Description |
|-----------|-------------|
| **Adaptive Retrieval Planning** | Routes every query to the optimal retrieval strategy based on complexity classification |
| **Confidence Calibration** | Platt-scaled and isotonic regression confidence scores for every query |
| **Budget Optimization** | Allocates retrieval budget (top-k, rerank, hops) proportional to query difficulty |
| **Multi-Strategy Routing** | Three retrieval tiers — hybrid, deep semantic, and iterative multi-hop |
| **Feedback Learning** | Thumbs up/down signals improve strategy selection over time |
| **Observability** | Per-query latency, confidence, cost, and strategy breakdown exposed via Prometheus |
| **Benchmarking** | Standardized benchmark suite across 5 domains with 5 execution modes |
| **Evaluation Framework** | Recall, precision, MRR, MAP, NDCG, faithfulness, and cost analysis |

---

## Benchmark Results

End-to-end benchmark across 5 domains (finance, legal, healthcare, technology, general) with 204 queries each — 1,020 total queries, 5 execution modes.

| Rank | Mode | Composite | Recall | Precision | MRR | MAP | NDCG | Hit Rate | Faithfulness | Latency (ms) | Cost/Query |
|------|------|-----------|--------|-----------|-----|-----|------|----------|--------------|-------------|------------|
| 1 | **Kairos Adaptive** | **0.890** | 0.940 | 0.870 | 0.930 | 0.850 | 0.900 | 0.980 | 0.910 | 163.0 | $0.0145 |
| 2 | Always Multi-Hop | 0.800 | 0.910 | 0.800 | 0.890 | 0.780 | 0.840 | 0.960 | 0.820 | 190.0 | $0.0220 |
| 3 | Always Complex | 0.780 | 0.900 | 0.780 | 0.880 | 0.760 | 0.820 | 0.950 | 0.800 | 170.0 | $0.0184 |
| 4 | Always Simple | 0.750 | 0.880 | 0.750 | 0.860 | 0.730 | 0.790 | 0.930 | 0.770 | 133.0 | $0.0100 |
| 5 | Naive RAG | 0.720 | 0.850 | 0.720 | 0.830 | 0.700 | 0.760 | 0.910 | 0.740 | 145.0 | $0.0123 |

Kairos Adaptive achieves the highest scores across all retrieval quality metrics while maintaining competitive latency and cost.

Source: [benchmarks/leaderboard/leaderboard.md](benchmarks/leaderboard/leaderboard.md)

---

## Quick Start

```bash
# Clone the repository
git clone https://github.com/ANUBprad/Kairos.git
cd Kairos

# Create virtual environment
python -m venv venv
source venv/bin/activate    # Linux / macOS
# .\venv\Scripts\activate   # Windows

# Install Python dependencies
pip install -r requirements.txt

# Run the test suite (1,802 tests)
pytest tests/ -v

# Start the full stack
docker compose up -d

# Launch the research dashboard
streamlit run dashboard/app.py
```

---

## Repository Structure

```
Kairos/
+-- gateway/              Go API gateway
|   +-- api/              HTTP handlers and route definitions
|   +-- middleware/        Auth, rate limiting, CORS
|   +-- cache/            Response caching layer
|   +-- metrics/          Prometheus instrumentation
|   +-- intelligence/     gRPC client to Python service
|   +-- config/           Environment-based configuration
|   +-- interceptors/     gRPC interceptors
|   +-- queue/            Async task queue
|   +-- templates/        HTML templates
|   +-- tenants/          Multi-tenant support
+-- intelligence/         Python intelligence service
|   +-- planner/          Adaptive retrieval planning and strategy selection
|   +-- retrieval/        Hybrid, deep semantic, and multi-hop retrievers
|   +-- classifier/       Query complexity classification
|   +-- calibration/      Platt-scaled and isotonic confidence calibration
|   +-- evaluation/       Ranking metrics and evaluator framework
|   +-- judging/          LLM-based judgment (faithfulness, relevance, hallucination, grounding)
|   +-- feedback/         Feedback collection and analytics
|   +-- observability/    Tracing, events, monitoring, alerting
|   +-- optimization/     Budget optimization and strategy tuning
|   +-- reranker/         Cross-encoder and MMR reranking
|   +-- embeddings/       Embedding model management and caching
|   +-- vectorstore/      Vector store abstraction layer
|   +-- ingestion/        Document ingestion pipeline
|   +-- training/         Model training utilities
|   +-- server/           gRPC server implementation
|   +-- api/              FastAPI management API
|   +-- config/           Pydantic settings and environment configuration
|   +-- ablation/         Ablation study framework
|   +-- experiments/      Experiment management
|   +-- metrics/          Custom metric collection
|   +-- telemetry/        Distributed tracing
|   +-- reporting/        Report generation
|   +-- statistics/       Statistical analysis utilities
|   +-- circuit_breaker/  Failure isolation
|   +-- retraining/       Online retraining pipelines
+-- benchmarks/           Benchmark suite
|   +-- runner/           Query execution pipeline and scoring
|   +-- datasets/         Gold-standard query datasets (5 domains, 1,020 queries)
|   +-- e2e/              End-to-end benchmark pipeline
|   +-- leaderboard/      Mode comparison leaderboard
|   +-- reports/          Generated benchmark and calibration reports
|   +-- results/          Raw benchmark result files
+-- dashboard/            Streamlit research dashboard
+-- tests/                1,802 tests across 37 test files
+-- docs/                 Architecture, benchmarks, deployment, operations
+-- docker/               Dockerfiles for each service
+-- proto/                gRPC protocol buffer definitions
+-- sdk/keiro/            Python client SDK
+-- docker-compose.yml    Full stack orchestration (8 container services)
+-- requirements.txt      Python dependencies
+-- go.mod                Go module definition
```

---

## Product Vision

Kairos is production-grade adaptive retrieval infrastructure designed to:

- **Ship as infrastructure** — Drop-in gateway, intelligent routing, observability included
- **Scale with confidence** — 1,802 passing tests, comprehensive benchmarks, statistically validated results
- **Integrate anywhere** — gRPC API, Python SDK, REST endpoints, Docker deployment
- **Improve over time** — Feedback loops, retraining pipelines, calibratable confidence
- **Run in production** — Prometheus metrics, Grafana dashboards, health checks, circuit breakers, structured logging

Kairos is for teams building AI-powered products that need to retrieve the right information at the right cost — every time.

---

## Roadmap

| Phase | Focus | Status |
|-------|-------|--------|
| 1-3 | Core retrieval pipeline | Done |
| 4-6 | Planner, calibration, optimization | Done |
| 7 | Observability and evaluation | Done |
| 8 | API and production deployment | Done |
| 9 | Research validation | Done |
| 10 | Open source and launch readiness | Done |
| - | Website implementation | In Progress |
| - | SaaS dashboard | Upcoming |
| - | User authentication and teams | Upcoming |
| - | API platform and billing | Upcoming |
| - | Beta launch | Upcoming |

---

## Documentation

| Document | Description |
|----------|-------------|
| [ARCHITECTURE.md](docs/ARCHITECTURE.md) | System architecture and component design |
| [BENCHMARKS.md](docs/BENCHMARKS.md) | Benchmark methodology and metrics |
| [DEPLOYMENT.md](docs/DEPLOYMENT.md) | Deployment guide and configuration |
| [OBSERVABILITY.md](docs/OBSERVABILITY.md) | Monitoring, tracing, and alerting |
| [OPERATIONS.md](docs/OPERATIONS.md) | Production operations guide |
| [PRODUCT_DEFINITION.md](docs/PRODUCT_DEFINITION.md) | Product strategy and positioning |
| [SAAS_ARCHITECTURE.md](docs/SAAS_ARCHITECTURE.md) | SaaS platform architecture |
| [ROADMAP.md](docs/ROADMAP.md) | Full product roadmap |
| [CONTRIBUTING.md](CONTRIBUTING.md) | Contributor guide |
| [CHANGELOG.md](CHANGELOG.md) | Version history |

---

## Contributing

We welcome contributions. See [CONTRIBUTING.md](CONTRIBUTING.md) for our contributor workflow, coding standards, and pull request process.

---

## License

Distributed under the MIT License. See [LICENSE.md](LICENSE.md) for more information.

---

<p align="center">
  <a href="https://github.com/ANUBprad/Kairos">GitHub</a> -
  <a href="docs/ARCHITECTURE.md">Architecture</a> -
  <a href="docs/BENCHMARKS.md">Benchmarks</a> -
  <a href="CONTRIBUTING.md">Contributing</a>
</p>
