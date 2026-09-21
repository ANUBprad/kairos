<p align="center">
  <img src="assets/kai.png" alt="Kairos Logo" width="180">
</p>

<h1 align="center">Kairos</h1>

<p align="center">
  <strong>An explainable AI research and learning workspace.</strong>
</p>

<p align="center">
  Bring your own documents. Build knowledge that is grounded, inspectable, and reusable — with retrieval that explains itself.
</p>

<p align="center">
  <a href="#what-is-kairos">What is Kairos</a> ·
  <a href="#quick-start">Quick Start</a> ·
  <a href="#architecture">Architecture</a> ·
  <a href="#features">Features</a> ·
  <a href="#contributing">Contributing</a>
</p>

---

## About

Kairos is an open-source platform for retrieval-augmented AI research and learning. It combines a modern web workspace with a production-grade RAG engine, so answers come with the reasoning that produced them — the retrieval pipeline is visible end to end.

---

## What is Kairos

Kairos is a self-hostable platform built around one idea: **different questions need different retrieval strategies.**

You bring documents. Kairos ingests them into a knowledge base, then every AI interaction runs a real retrieval pipeline — classification, retrieval planning, and strategy selection among dense vector, BM25, and hybrid retrievers — before generating an answer grounded in your material.

Kairos is a *workspace*, not just an API:

- **Knowledge bases** — upload PDFs, DOCX, TXT, Markdown, and CSV; chunk, embed, and search over them.
- **RAG chat with citations** — answers reference the chunks they came from, and the retrieval trace for each message is inspectable.
- **Artifact Studio** — turn knowledge base material into reusable learning artifacts (text pieces, illustrations, and audio podcast renditions), each with source grounding.
- **Explainable podcast Q&A** — a podcast artifact can be interrupted mid-play to ask questions about what you just heard; the answers are grounded in the source material and surfaced inline.
- **Evaluation & benchmarks** — a statistical evaluation framework and a leaderboard for comparing retrieval configurations.
- **Ops-friendly** — Docker Compose stack with Prometheus/Grafana observability.

---

## What Kairos Does Today

Current production-shaped capabilities:

- Full-stack retrieval pipeline mounted behind a web portal: ingestion → chunking → embeddings → retrieval planning → strategy selection (BM25 / dense / hybrid) → reranking → grounded answer generation.
- Embedding and LLM providers are pluggable: local models via SentenceTransformers, or OpenAI and Gemini APIs; LLM generation via OpenAI, Gemini, or Ollama.
- Typical document formats handled end to end: PDF, DOCX, TXT, Markdown, CSV.
- Artifact generation from knowledge bases, including multi-part audio podcasts with mid-play, grounded interruption Q&A.
- Chat with citations, pipeline traces, and per-message grounding.
- Statistical retrieval evaluation (recall, precision, MRR, nDCG, latency, cost, faithfulness and failure-rate metrics) with an internal leaderboard.
- Dockerized full stack with health checks, rate limiting, semantic caching, and Prometheus/Grafana dashboards.

---

## Quick Start

**Prerequisites:** Docker and Docker Compose v2.

```bash
git clone https://github.com/ANUBprad/kairos.git
cd kairos

cp .env.example .env
# Edit .env: set at least DATABASE_URL, BETTER_AUTH_SECRET and an AI provider key
docker compose up -d

docker compose ps   # wait until all services report healthy
```

**Default services**

| Service | URL / Port | Purpose |
|---------|------------|---------|
| Portal (dev) | http://localhost:3000 | Web workspace — run via `npm run dev` in `apps/portal` |
| Gateway | http://localhost:8080 | Go HTTP API gateway |
| Intelligence | http://localhost:28080 | Python RAG engine (gRPC) |
| API | http://localhost:8000 | FastAPI management API |
| ChromaDB | http://localhost:7777 | Vector store |
| Prometheus | http://localhost:9090 | Metrics collection |
| Grafana | http://localhost:3000 | Metrics dashboards — conflicts with the Portal dev server; run them one at a time |

**Run the portal locally**

```bash
cd apps/portal
npm install
npx prisma generate
npx prisma db push        # applies the schema to your PostgreSQL database
npm run dev
```

The full environment reference lives in [`.env.example`](.env.example); see [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) for detailed deployment notes.

---

## Architecture

Kairos is a microservice platform with three layers:

```text
Browser (Next.js Portal)
        │  REST / server actions
        ▼
Go API Gateway ───gRPC───► Python Intelligence Engine
                                ├─ Query Classification
                                ├─ Retrieval Planning
                                ├─ Retrievers (BM25 / Dense / Hybrid / Multi-hop)
                                ├─ Reranking
                                ├─ Response Assembly
                                └─ Evaluation & Telemetry
   │                            │
   ▼                            ▼
PostgreSQL                 ChromaDB
   (users, artifacts,        (vectors)
    knowledge bases)
```

- **Portal** (`apps/portal/`) — Next.js 15 workspace: knowledge bases, document ingestion, RAG chat, artifact studio, podcast Q&A.
- **Gateway** (`gateway/`) — Go HTTP gateway: routing, auth, rate limiting, caching, Prometheus metrics.
- **Intelligence** (`intelligence/`) — Python engine: ingestion, classification, adaptive retrieval planning, multiple retriever backends, reranking, evaluation.
- **Data** — PostgreSQL via Prisma; ChromaDB for vector search; Cloudinary for artifact media.
- **Observability** — Prometheus + Grafana, structured logging.

A dedicated [ARCHITECTURE.md](docs/ARCHITECTURE.md) covers component responsibilities, the retrieval pipeline, and the evaluation framework.

---

## Features

**Grounded Q&A with explanations.** Every response cites the chunks it was built from; retrieval decisions are exposed so answers can be audited.

**Adaptive retrieval.** Queries are classified and routed to the right strategy — vector, BM25, hybrid, or multi-hop — rather than forcing one pipeline for everything.

**Artifact Studio.** Generate learning artifacts (text pieces, illustrations, audio podcasts) from knowledge base material, each grounded in its source documents.

**Explainable podcast Q&A.** Player-side interruption and resume with grounded, source-cited answers to questions about the content being played.

**Statistical evaluation.** A metrics-heavy evaluation framework (recall@K, MRR, nDCG, latency, cost, faithfulness, failure rate…) with confidence intervals and effect sizes, plus a leaderboard.

**Production fundamentals.** Health checks, rate limiting, semantic caching, provider failover, structured logging, and monitoring out of the box.

---

## Roadmap

Honest gaps and planned work:

- mTLS on the gateway ↔ intelligence channel (currently private-network only — do not expose publicly).
- Multi-tenant organization support beyond per-user knowledge bases.
- The public cloud CLI and REST API documented in `cli/SPECIFICATION.md` — designed, not shipped.
- The extension-framework roadmap in `docs/EXTENSIBILITY.md` (plugins, event bus, webhooks, marketplace) — a design report for future phases.

---

## Project Structure

```text
kairos/
├── apps/portal/          # Next.js workspace (auth, knowledge bases, chat, artifact studio)
├── gateway/              # Go API gateway (Chi, gRPC, caching, rate limiting)
├── intelligence/         # Python RAG engine (ingestion, retrieval, evaluation, telemetry)
├── proto/                # gRPC contract definitions
├── sdk/                  # Python client SDK (kairos-client)
├── benchmarks/           # Evaluation datasets, leaderboard
├── tests/                # Python test suite (unit, integration, benchmarks, e2e)
├── examples/             # Runnable SDK/engine examples
├── docker/               # Dockerfiles and grafana provisioning
├── docs/                 # Architecture, developer, deployment, and config docs
├── scripts/              # Build, release, evaluation, and validation scripts
└── .github/              # CI/CD workflows and issue/PR templates
```

---

## Developer Guide

Full development setup, code style, and testing conventions live in [docs/DEVELOPER.md](docs/DEVELOPER.md). The short version:

```bash
# Python suite
python -m pytest tests/

# Portal (TypeScript) suite
cd apps/portal
npx tsx --test "src/__tests__/*.test.ts"
npx tsc --noEmit

# Gateway (Go)
cd gateway
go test ./...
```

---

## Current Test Coverage Summary

Measured on this branch with the commands above — not badges, plain numbers:

- **Portal:** 377 tests across 79 suites, all passing (unit, integration, and structural coverage of the portal, including the artifact studio and podcast interaction flows).
- **Python:** ~2,275 tests in `tests/`. 2,237 pass in a default local environment; 38 depend on configured credentials/API keys and are validated in CI (running with a clean environment).
- **Go gateway:** covered by `go test ./...`.

CI (`test.yml`, `portal.yml`, `lint.yml`) additionally runs the full Python suite on Python 3.11/3.12, a Docker end-to-end pipeline test, ESLint, Prisma validation, and a production `next build`.

---

## Documentation Index

- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) — system architecture, components, pipeline.
- [docs/DEVELOPER.md](docs/DEVELOPER.md) — contributor guide, code style, testing.
- [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) — deployment options and production checklist.
- [docs/CONFIGURATION.md](docs/CONFIGURATION.md) — configuration and environment reference.
- [docs/OBSERVABILITY.md](docs/OBSERVABILITY.md) — logging, metrics, health, alerting.
- [docs/PIPELINE.md](docs/PIPELINE.md) — RAG pipeline stages in detail.
- [docs/DATA-FLOW.md](docs/DATA-FLOW.md) — data flow diagrams for key operations.
- [docs/SECURITY.md](docs/SECURITY.md) — security model and practices.
- [cli/SPECIFICATION.md](cli/SPECIFICATION.md) — cloud CLI specification (design-stage).
- [docs/diagrams/](docs/diagrams/) — Mermaid diagrams of the system.

---

## Contributing

Contributions are welcome. See [CONTRIBUTING.md](CONTRIBUTING.md) for the issue template, development setup, code style rules, and the pull request process.

---

## Changelog

See [CHANGELOG.md](CHANGELOG.md) for the release history.

---

## License

MIT License — see [LICENSE](LICENSE) for details.