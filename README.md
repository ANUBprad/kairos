<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="docs/assets/logo/kairos-dark.png">
    <img src="docs/assets/logo/kairos-light.png" alt="Kairos" width="120">
  </picture>
</p>

<h1 align="center">Kairos</h1>

<p align="center">
  <strong>Adaptive Retrieval Intelligence Platform</strong>
</p>

<p align="center">
  Every query deserves a different retrieval strategy.
</p>

<p align="center">
  Kairos classifies, plans, and routes every query to the optimal retrieval strategy —<br>
  balancing quality, latency, confidence, and cost in real time.
</p>

<p align="center">
  <a href="https://kairos.dev"><strong>kairos.dev</strong></a> ·
  <a href="https://kairos.dev/docs">Documentation</a> ·
  <a href="https://kairos.dev/pricing">Pricing</a> ·
  <a href="https://github.com/ANUBprad/Kairos">GitHub</a>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Python-3.11+-3776AB?style=flat&logo=python&logoColor=white" alt="Python">
  <img src="https://img.shields.io/badge/Go-1.26-00ADD8?style=flat&logo=go&logoColor=white" alt="Go">
  <img src="https://img.shields.io/badge/Tests-1802-22c55e?style=flat" alt="Tests">
  <img src="https://img.shields.io/badge/License-MIT-yellow?style=flat" alt="License">
  <img src="https://img.shields.io/badge/Docker-compose-2496ED?style=flat&logo=docker&logoColor=white" alt="Docker">
</p>

---

## What is Kairos?

Kairos is NOT a chatbot. NOT a vector database. NOT ChatGPT.

Kairos is an **Adaptive Retrieval Intelligence Platform** that sits between your data and your LLM to make intelligent retrieval decisions:

- **Classifies** query complexity (simple, complex, multi-hop)
- **Selects** the optimal retrieval strategy per query
- **Allocates** retrieval budget based on difficulty
- **Calibrates** confidence scores for every result
- **Learns** from feedback to improve over time

The result: higher accuracy, lower latency, and reduced LLM costs — automatically.

---

## Product

| | |
|---|---|
| **Website** | [kairos.dev](https://kairos.dev) |
| **App** | [app.kairos.dev](https://app.kairos.dev) |
| **Documentation** | [kairos.dev/docs](https://kairos.dev/docs) |
| **API** | `POST https://api.kairos.dev/v1/query` |
| **Status** | [status.kairos.dev](https://status.kairos.dev) |

### Plans

| Plan | Queries/mo | Features |
|------|-----------|----------|
| **Free** | 1,000 | API access, 1 project, community support |
| **Developer** | 50,000 | 10 projects, email support, analytics |
| **Pro** | 500,000 | Unlimited projects, priority support, SSO |
| **Enterprise** | Custom | Dedicated infra, SLA, on-premise option |

---

## Quick Start

```bash
# Clone the repository
git clone https://github.com/ANUBprad/Kairos.git
cd Kairos

# Create virtual environment
python -m venv venv
source venv/bin/activate

# Install Python dependencies
pip install -r requirements.txt

# Run the test suite
pytest tests/ -v
```

### Self-Hosted Backend

```bash
# Start the full backend stack
docker compose up -d

# Backend services:
#   Gateway  → localhost:8080
#   API      → localhost:8000
#   Grafana  → localhost:3000
#   Prometheus → localhost:9090
```

### Internal Developer Dashboard

```bash
# Start the internal Streamlit dashboard
streamlit run apps/internal-dashboard/app.py
```

> **Note:** The Streamlit dashboard is an **internal developer tool** only. It is not deployed publicly. The public SaaS app lives at [app.kairos.dev](https://app.kairos.dev).

---

## Architecture

```
gateway/              Go API gateway — auth, rate limiting, caching, gRPC routing
intelligence/         Python intelligence service — 28 modules
benchmarks/           Benchmark suite — runner, metrics, datasets, leaderboard
apps/
  portal/             Next.js SaaS application (public)
  internal-dashboard/ Streamlit developer dashboard (internal)
tests/                1,802 tests across 37 test files
proto/                gRPC protocol buffer definitions
sdk/keiro/            Python client SDK
docs/                 Architecture, benchmarks, deployment, operations
docker/               Dockerfiles for each service
```

```
                    +-------------------------------------+
                    |          Go API Gateway             |
  HTTP Request -->  |  Auth -> Rate Limit -> Cache -> gRPC |
                    +------------------+------------------+
                                       | gRPC
                    +------------------v------------------+
                    |     Python Intelligence Service      |
                    |  +----------+  +----------+          |
                    |  |Classifier|  | Planner  |          |
                    |  +----------+  +----------+          |
                    |  +----------+  +----------+          |
                    |  |Retrievers|  |Evaluator |          |
                    |  +----------+  +----------+          |
                    |  +----------+  +----------+          |
                    |  |Calibrator|  | Judge    |          |
                    |  +----------+  +----------+          |
                    +------------------+------------------+
                                       |
                    +------------------v------------------+
                    |        ChromaDB Vector Store         |
                    |  Finance | Legal | Medical | Tech    |
                    +-------------------------------------+
```

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for the complete system design.

---

## API

```bash
curl -X POST https://api.kairos.dev/v1/query \
  -H "X-API-Key: kai_sk_..." \
  -H "Content-Type: application/json" \
  -d '{"query": "What is our refund policy?", "project_id": "proj_abc"}'
```

Response:

```json
{
  "answer": "Our refund policy allows returns within 30 days...",
  "confidence": 0.94,
  "strategy": "hybrid",
  "latency_ms": 163,
  "cost": 0.0145
}
```

See [API Platform Plan](docs/API_PLATFORM_PLAN.md) for full API documentation.

---

## Benchmark Results

| Rank | Mode | Composite | Recall | Latency | Cost/Query |
|------|------|-----------|--------|---------|------------|
| 1 | **Kairos Adaptive** | **0.890** | 0.940 | 163ms | $0.0145 |
| 2 | Always Multi-Hop | 0.800 | 0.910 | 190ms | $0.0220 |
| 3 | Always Complex | 0.780 | 0.900 | 170ms | $0.0184 |
| 4 | Always Simple | 0.750 | 0.880 | 133ms | $0.0100 |
| 5 | Naive RAG | 0.720 | 0.850 | 145ms | $0.0123 |

Kairos Adaptive achieves the highest scores across all retrieval quality metrics while maintaining competitive latency and cost.

Source: [benchmarks/leaderboard/leaderboard.md](benchmarks/leaderboard/leaderboard.md)

---

## Documentation

| Document | Description |
|----------|-------------|
| [SAAS_ARCHITECTURE.md](docs/SAAS_ARCHITECTURE.md) | Production SaaS architecture |
| [DEPLOYMENT_PLAN.md](docs/DEPLOYMENT_PLAN.md) | Deployment and infrastructure |
| [API_PLATFORM_PLAN.md](docs/API_PLATFORM_PLAN.md) | REST API design and SDKs |
| [PHASE14_IMPLEMENTATION_PLAN.md](docs/PHASE14_IMPLEMENTATION_PLAN.md) | Full implementation roadmap |
| [ARCHITECTURE.md](docs/ARCHITECTURE.md) | System architecture and component design |
| [BENCHMARKS.md](docs/BENCHMARKS.md) | Benchmark methodology and metrics |
| [DEPLOYMENT.md](docs/DEPLOYMENT.md) | Deployment guide and configuration |
| [OBSERVABILITY.md](docs/OBSERVABILITY.md) | Monitoring, tracing, and alerting |
| [OPERATIONS.md](docs/OPERATIONS.md) | Production operations guide |
| [CONTRIBUTING.md](CONTRIBUTING.md) | Contributor guide |
| [CHANGELOG.md](CHANGELOG.md) | Version history |

---

## Repository Structure

```
Kairos/
+-- gateway/              Go API gateway
+-- intelligence/         Python intelligence service (28 modules)
+-- benchmarks/           Benchmark suite
+-- apps/
|   +-- portal/           Next.js SaaS application (public)
|   +-- internal-dashboard/  Streamlit dashboard (internal only)
+-- tests/                1,802 tests across 37 test files
+-- docs/                 Architecture, deployment, product plans
+-- docker/               Dockerfiles for each service
+-- proto/                gRPC protocol buffer definitions
+-- sdk/keiro/            Python client SDK
+-- docker-compose.yml    Full stack orchestration
+-- requirements.txt      Python dependencies
+-- go.mod                Go module definition
```

---

## Product Vision

Kairos is production-grade adaptive retrieval infrastructure designed for teams building AI-powered products.

- **Ship as infrastructure** — Drop-in gateway, intelligent routing, observability included
- **Scale with confidence** — 1,802 passing tests, comprehensive benchmarks, statistically validated results
- **Integrate anywhere** — REST API, Python SDK, gRPC, Docker deployment
- **Improve over time** — Feedback loops, retraining pipelines, calibratable confidence
- **Run in production** — Prometheus metrics, Grafana dashboards, health checks, circuit breakers, structured logging

---

## Contributing

We welcome contributions. See [CONTRIBUTING.md](CONTRIBUTING.md) for our contributor workflow, coding standards, and pull request process.

---

## License

Distributed under the MIT License. See [LICENSE.md](LICENSE.md) for more information.

---

<p align="center">
  <a href="https://kairos.dev">kairos.dev</a> ·
  <a href="https://github.com/ANUBprad/Kairos">GitHub</a> ·
  <a href="docs/ARCHITECTURE.md">Architecture</a> ·
  <a href="docs/BENCHMARKS.md">Benchmarks</a> ·
  <a href="CONTRIBUTING.md">Contributing</a>
</p>
