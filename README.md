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

- **Knowledge bases** — upload PDFs, DOCX, TXT, Markdown, and CSV, or ingest web URLs and available YouTube transcripts; chunk, embed, and search over them.
- **RAG chat with citations** — answers reference the chunks they came from, and the retrieval trace for each message is inspectable.
- **Artifact Studio** — turn knowledge base material into reusable learning artifacts (text pieces, illustrations, and audio podcast renditions), each with source grounding.
- **Explainable podcast Q&A** — a podcast artifact can be interrupted mid-play to ask questions about what you just heard; the answers are grounded in the source material and surfaced inline.
- **Evaluation & benchmarks** — a statistical evaluation framework and a leaderboard for comparing retrieval configurations.
- **Ops-friendly** — Docker Compose stack with Prometheus/Grafana observability.

---

## What Kairos Does Today

Current production-shaped capabilities:

- Full-stack retrieval pipeline mounted behind a web portal: ingestion → text extraction → chunking → embeddings → retrieval planning → strategy selection (BM25 / dense / hybrid) → reranking → grounded answer generation.
- Retrieval embeddings and LLM providers are pluggable, but not freely interchangeable: the Portal embeds with Gemini `text-embedding-004` (or `embedding-001`) because the database pins one width (768 dims), and generates through OpenAI, Gemini, or Ollama. Retrieval embeddings are a fixed contract; the chat model stays free.
- Sources handled end to end: PDF, DOCX, TXT, Markdown, CSV, web URLs (readable page content), and YouTube videos with available transcripts.
- Artifact generation from knowledge bases, including multi-part audio podcasts with mid-play, grounded interruption Q&A.
- Chat with citations, pipeline traces, and per-message grounding.
- Statistical retrieval evaluation (recall, precision, MRR, nDCG, latency, cost, faithfulness and failure-rate metrics) with an internal leaderboard.
- Docker Compose runs PostgreSQL and the legacy v1 services, including their semantic cache and Prometheus/Grafana dashboards; the Portal runs separately as described below.

---

## Quick Start

**Prerequisites:** Docker and Docker Compose v2.

```bash
git clone https://github.com/ANUBprad/kairos.git
cd kairos

cp .env.example .env
# Edit .env: set at least BETTER_AUTH_SECRET and an AI provider key
docker compose up -d

docker compose ps   # wait until all services report healthy
```

The compose stack provides the local database (PostgreSQL 16 with pgvector) at `localhost:5432/kairos`, matching the default `DATABASE_URL` in `.env.example`.

**Default services**

| Service | URL / Port | Purpose |
|---------|------------|---------|
| PostgreSQL | localhost:5432 | App database and production vector store (pgvector) — matches the default `DATABASE_URL` |
| Portal (dev) | http://localhost:3000 | Web workspace — run via `npm run dev` in `apps/portal` |
| Gateway | http://localhost:8080 | Go HTTP API gateway (legacy v1 stack) |
| Intelligence | http://localhost:28080 | Python RAG engine, gRPC (legacy v1 stack) |
| ChromaDB | http://localhost:7777 | Vector store for the v1 stack (legacy) |
| Prometheus | http://localhost:9090 | Metrics collection |
| Grafana | http://localhost:3000 | Metrics dashboards — conflicts with the Portal dev server; run them one at a time |

**Run the portal locally**

```bash
cd apps/portal
npm install
npx prisma migrate deploy   # applies all migrations to the compose-provided database
npm run dev
```

`npx prisma migrate deploy` is non-destructive: it only applies migrations that have not been recorded yet and never drops data. If you use the default compose Postgres, the schema is applied in one command.

**Using an existing database (e.g. a Neon instance)**

Point `DATABASE_URL` at your external PostgreSQL instead of the compose one and run `npx prisma migrate deploy` there. If the database was previously populated with `npx prisma db push` (no migration record), `migrate deploy` reports **P3005**. Baseline such a database once, non-destructively — the existing schema already reflects the repo's migration history, so you only seed the migration ledger (`migrate resolve` executes no SQL):

```bash
cd apps/portal
for d in prisma/migrations/2*/; do npx prisma migrate resolve --applied "$(basename "$d")"; done
npx prisma migrate deploy   # reports "No pending migrations to apply"
```

Future schema changes then ship via normal `npx prisma migrate deploy` runs.

The full environment reference lives in [`.env.example`](.env.example); see [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) for detailed deployment notes.

---

## Architecture

Kairos is a self-hostable platform built around one idea: **different questions
need different retrieval strategies.** The Portal is the production
application — it owns ingestion, embedding, storage, retrieval and generation
end to end, and stores its vectors in PostgreSQL alongside everything else.

```text
Browser
   │  HTTP
   ▼
Next.js Portal (apps/portal)
   │  server actions / route handlers / Prisma
   │  embedding + chat provider calls
   ▼
PostgreSQL 16 + pgvector
   ├─ users, knowledge bases, documents, chunks   (metadata)
   └─ DocumentEmbedding.embedding vector(768)     (vectors)
      + HNSW index (m = 16, ef_construction = 64)
```

- **Portal** (`apps/portal/`) — Next.js 15 workspace: knowledge bases, document ingestion, embedding, RAG chat, artifact studio, podcast Q&A, evaluation and experiment tracking.
- **Vector storage** — PostgreSQL with the pgvector extension. The column is pinned to `vector(768)` and indexed with HNSW using `vector_cosine_ops` (`m = 16`, `ef_construction = 64`); the index is created by [SQL migration `20261122000000_pin_embedding_dimension_768`](apps/portal/prisma/migrations/20261122000000_pin_embedding_dimension_768/migration.sql), because Prisma's datamodel cannot express a pgvector index.
- **Scoped retrieval** — Portal access checks authorize knowledge-base access; `PgVectorStore` applies the supplied knowledge-base and document IDs in the SQL similarity query, using cosine distance (`<=>`). This is application-authorized, knowledge-base-scoped semantic retrieval, not database row-level security.
- **Retrieval embedding** — `gemini/text-embedding-004`, 768 dimensions. The width is fixed by the database, so ingestion rejects any wider model before calling a provider. Chat and embedding models are configured separately: changing the chat model does not change the embedding width.
- **Data** — PostgreSQL via Prisma for everything, including vectors. Cloudinary for artifact media.
- **Observability** — Portal structured logging; Prometheus + Grafana dashboards for the legacy v1 services.

Query plans are not a fixed property of the setup: PostgreSQL chooses whether
to use the HNSW index, and a filtered knowledge-base query can use a sequential
scan. Any latency figure quoted from this
repository is a benchmark under stated conditions, not a guarantee.

### Legacy v1 stack

The Go gateway (`gateway/`) and Python intelligence engine (`intelligence/`)
are still in the repository and still run under Docker Compose, with ChromaDB as
their vector store. They are not on the Portal production path, and they have
not been deleted. The Portal is self-contained: it has no code path to the
gateway, the intelligence engine or ChromaDB.

A dedicated [ARCHITECTURE.md](docs/ARCHITECTURE.md) covers component responsibilities, the retrieval pipeline, and the evaluation framework.

---

## Features

**Grounded Q&A with explanations.** Every response cites the chunks it was built from; retrieval decisions are exposed so answers can be audited.

**Adaptive retrieval.** Queries are classified and routed to the right strategy — vector, BM25, hybrid, or multi-hop — rather than forcing one pipeline for everything.

**Artifact Studio.** Generate learning artifacts (text pieces, illustrations, audio podcasts) from knowledge base material, each grounded in its source documents.

**Explainable podcast Q&A.** Player-side interruption and resume with grounded, source-cited answers to questions about the content being played.

**Statistical evaluation.** A metrics-heavy evaluation framework (recall@K, MRR, nDCG, latency, cost, faithfulness, failure rate…) with confidence intervals and effect sizes, plus a leaderboard.

**Production fundamentals.** Health checks, per-user and per-knowledge-base rate limits, provider failover, structured logging, request correlation, and monitoring out of the box. (Semantic/LRU request caching lives in the v1 gateway.)

---

## Roadmap

Honest gaps and planned work:

- mTLS on the gateway ↔ intelligence channel (currently private-network only — do not expose publicly). Both services are v1-only; the Portal does not use them.
- The public cloud CLI and REST API documented in `cli/SPECIFICATION.md` — designed, not shipped.
- The extension-framework roadmap in `docs/EXTENSIBILITY.md` (plugins, event bus, webhooks, marketplace) — a design report for future phases.

---

## Project Structure

```text
kairos/
├── apps/portal/          # Next.js workspace (auth, knowledge bases, chat, artifact studio) — the production app
├── gateway/              # Go API gateway (Chi, gRPC, caching, rate limiting) — legacy v1
├── intelligence/         # Python RAG engine (ingestion, retrieval, evaluation, telemetry) — legacy v1
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
# Use a dedicated, migrated pgvector test database. Export DATABASE_URL and
# KAIROS_TEST_DATABASE_URL with the same URL, and KAIROS_DEMO_MODE=true.
# See .github/workflows/portal.yml for the complete test environment.
node --import tsx scripts/verify-test-database.ts
node --import tsx --test "src/__tests__/*.test.ts"
npx tsc --noEmit

# Gateway (Go)
cd ../../gateway
go test ./...
```

---

## Current Test Coverage Summary

Recorded test results — not coverage percentages or live CI status:

- **Portal:** 1,010 tests across 206 suites, all passing, with 0 failed and 0 skipped (unit, integration, and structural checks, including artifact studio and podcast interaction flows). This verified result is recorded in [commit `9e172d9a`](https://github.com/ANUBprad/kairos/commit/9e172d9ad0857d550c19868e5d46a0a51c2e8c3d). It requires the integration test database and demo session configuration. The database preflight above, also run by [Portal CI](.github/workflows/portal.yml), fails when those prerequisites are missing or unusable, preventing silent false-green database-test runs. Running the suite directly without the preflight can skip database-backed tests; that is not the full 1,010-test result.
- **Python:** the suite in `tests/` runs in [Python CI](.github/workflows/test.yml) on Python 3.11/3.12 with coverage reporting. The workflow does not provision external provider credentials; credential-dependent results require a separately configured environment.
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
