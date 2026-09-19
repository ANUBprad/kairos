# Kairos Architecture

## Overview

Kairos is an explainable AI research and learning workspace built around the idea that:

> Different queries require different retrieval strategies.

Instead of applying a fixed retrieval pipeline to every query, Kairos classifies the query and selects a retrieval strategy — dense vector, BM25, hybrid, or multi-hop — based on complexity and retrieval requirements. Every step is observable so answers carry provenance.

---

## High-Level Architecture

```text
Browser (Next.js Portal)
        │  REST / server actions
        ▼
Go API Gateway
        │  gRPC (Protocol Buffers)
        ▼
Python Intelligence Engine
        ├── Query Classification
        ├── Retrieval Planning
        ├── Retrieval Execution (BM25 / Dense / Hybrid / Multi-hop)
        ├── Reranking
        ├── Response Assembly
        └── Evaluation & Telemetry
   │                            │
   ▼                            ▼
PostgreSQL                 ChromaDB
   (users,                (vectors)
    knowledge bases,
    artifacts)
```

---

## Repository Structure

```text
kairos/
├── apps/portal/            # Next.js workspace (auth, knowledge bases, chat, artifact studio)
├── apps/internal-dashboard/# Streamlit research/ops dashboard
├── gateway/                # Go API gateway
├── intelligence/           # Python intelligence engine
│   ├── api/                # FastAPI management API
│   ├── config/             # Pydantic settings + environment profiles
│   ├── ingestion/          # Document parsing, chunking, embedding
│   ├── retrieval/          # Retrievers, planner, executor, persistent BM25
│   ├── evaluation/         # Metrics, evaluator, reporting
│   ├── experiments/        # Experiment tracking
│   ├── artifacts/          # Model/experiment/report registries
│   └── observability/      # Tracing, logging, metrics, alerting
├── proto/                  # gRPC contracts
├── sdk/                    # Python client SDK
├── benchmarks/             # Evaluation datasets, leaderboard
├── tests/                  # pytest suite (unit, integration, benchmarks, e2e)
├── examples/               # Runnable SDK/engine examples
├── docker/                 # Service Dockerfiles + Grafana provisioning
├── docs/                   # Architecture, deployment, operations docs
├── scripts/                # Build, release, evaluation, validation
└── .github/                # CI/CD workflows
```

---

## Component Responsibilities

### Portal — `apps/portal/`

Next.js 15 application (React 19, TypeScript, Tailwind). Responsibilities:

- Authentication (email + GitHub via better-auth) and user workspaces
- Knowledge base management and document upload (`PDF`, `DOCX`, `TXT`, `Markdown`, `CSV`)
- RAG chat with citations and retrieval traces
- Artifact Studio: generation of grounded learning artifacts (text pieces, illustrations, audio podcast renditions) from knowledge base material
- Podcast player with mid-play, grounded interruption Q&A (`src/lib/artifacts/interrupt-service.ts`, playback state machine in `src/lib/audio/playback.ts`)
- Marketing pages and changelog

### Gateway — `gateway/`

Go HTTP API gateway. Responsibilities:

- API routing and request validation
- Authentication and rate limiting
- Semantic + LRU caching
- gRPC communication with the intelligence engine
- Prometheus metrics and health endpoints

### Intelligence Engine — `intelligence/`

Python service. Responsibilities:

- Document ingestion, chunking, and embedding
- Query classification and retrieval planning
- Retrieval execution across strategies (vector, BM25, hybrid, multi-hop), reranking
- LLM response assembly and grounding
- Evaluation framework (IR + generation metrics, statistics)
- Experiment tracking and artifact registries

### Actors alongside the core services

| Component | Location | Purpose |
|-----------|----------|---------|
| FastAPI management API | `intelligence/api/` | Configuration/artifact/evaluation endpoints (`/api/v1/*`) |
| Internal dashboard | `apps/internal-dashboard/` | Streamlit research/ops dashboard (ablations, benchmarks, observability, planner analysis) |
| ChromaDB | docker service | Vector store |
| PostgreSQL | external / via DATABASE_URL | Users, knowledge bases, artifacts, podcast interruptions |
| Prometheus + Grafana | docker services | Metrics collection and dashboards |

### proto/

gRPC service definitions shared between the gateway and the intelligence engine.

### sdk/

Python client SDK (`kairos-client`) for integrating with the platform.

### benchmarks/

Evaluation datasets, the leaderboard, and performance harnesses used by the research/ops workflow.

---

## Retrieval Pipeline

```text
Query
  ↓
Classifier → retrieval complexity / strategy
  ↓
Retrieval Planner → strategy, top_k, budget, fallback policy
  ↓
Retriever (BM25 / Dense / Hybrid / Multi-hop)
  ↓
Reranking (when enabled)
  ↓
LLM (grounded response assembly)
  ↓
Response (with citations and trace)
```

The planner bakes in confidence-aware fallback: if a primary strategy under-performs or the vector store is unreachable, the pipeline degrades gracefully (e.g. to BM25-only) rather than failing the request.

---

## Evaluation Framework

- Retrieval metrics: Recall@K, Precision@K, MRR, nDCG@K, Hit Rate, MAP, F1@K, latency, cost, failure rate
- Generation metrics: faithfulness, answer relevance, context precision, context recall
- Statistical tools: confidence intervals, paired comparisons, effect sizes (Cohen's d, Cliff's delta)
- Evaluations run against labeled datasets and feed the internal leaderboard (`benchmarks/leaderboard/`)
- Adversarial hardening suites in `tests/benchmarks/` guard retrieval quality end to end

---

## Observability

- Portal: structured JSON logging, request correlation (`x-request-id`), health endpoints, in-memory metrics, PostHog analytics — see `docs/OBSERVABILITY.md`
- Gateway: Prometheus metrics (`/metrics`), structured logging, `/health`
- Intelligence: Prometheus metrics, gRPC health checks (port 8001), structured logging
- Grafana dashboards provisioned from `docker/grafana/`

---

## Deployment

The supported deployment is Docker Compose. Services: `chromadb`, `intelligence`, `api`, `internal-dashboard`, `gateway`, `prometheus`, `grafana`. See `docker-compose.yml` and `docs/DEPLOYMENT.md` for details.

---

## Research Direction

Kairos is built around a central hypothesis:

> Confidence-aware adaptive retrieval planning can improve retrieval quality while maintaining or reducing latency and retrieval cost compared to static retrieval routing.

The retrieval planner and fallback manager in `intelligence/retrieval/` implement this direction; the evaluation framework exists to test it empirically. Forward-looking design documents (extension framework, cloud CLI) live in `docs/EXTENSIBILITY.md` and `cli/SPECIFICATION.md`.