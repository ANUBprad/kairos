# Kairos Architecture

## Overview

Kairos is an explainable AI research and learning workspace built around the idea that:

> Different queries require different retrieval strategies.

Instead of applying a fixed retrieval pipeline to every query, Kairos classifies the query and selects a retrieval strategy — dense vector, BM25, hybrid, or multi-hop — based on complexity and retrieval requirements. Every step is observable so answers carry provenance.

---

## High-Level Architecture

Kairos ships two stacks. The **Portal is the production application**: it owns
ingestion, embedding, storage, retrieval and generation end to end.

```text
Browser
   │  HTTP
   ▼
Next.js Portal (apps/portal)
   │  server actions / route handlers / Prisma
   │  embedding provider calls
   ▼
PostgreSQL 16 + pgvector
   ├─ users, knowledge bases, documents, chunks   (metadata)
   └─ DocumentEmbedding.embedding vector(768)     (vectors)
      + HNSW index (m = 16, ef_construction = 64)   ← created in SQL, see below
```

There is no Gateway hop and no separate retrieval service on this path.

### Vector storage contract

| Concern | Value | Authoritative source |
|---------|-------|----------------------|
| Vector store | PostgreSQL + pgvector | migration `20260913000000_add_embedding_vectors` (`CREATE EXTENSION "vector"`) |
| Column | `DocumentEmbedding.embedding vector(768)` | migration `20261122000000_pin_embedding_dimension_768` |
| ANN index | HNSW, `vector_cosine_ops`, `m = 16`, `ef_construction = 64` | migration `20261122000000_pin_embedding_dimension_768` |
| Retrieval embedding | `gemini/text-embedding-004`, 768 dimensions | `apps/portal/src/lib/retrieval/embedding-models.ts` |

pgvector cannot index a typmod-less `vector` column, which is why the width is
pinned in the database. Ingestion rejects any model that is not 768-wide before
it calls a provider (`assertIndexableEmbeddingModel`).

Prisma's datamodel cannot express the pgvector HNSW index: `schema.prisma`
declares the column as `Unsupported("vector")?` and nothing else. **The SQL
migration and the live database index are authoritative**, not
`schema.prisma` and not `prisma migrate diff`.

Query plans are not a fixed property of the system. Postgres only uses the
HNSW index when the filter is selective enough; a selective
single-knowledge-base filter can fall back to a sequential scan. Report
benchmark results with their conditions rather than as a latency guarantee.

### Legacy v1 stack

The Go gateway, the Python intelligence engine and ChromaDB still exist in this
repository and still run under Docker Compose. They are not on the Portal
production path, and they have not been deleted.

```text
SDK / clients
   │  HTTP
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
├── gateway/                # Go API gateway (legacy v1)
├── intelligence/           # Python intelligence engine (legacy v1)
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
- Text extraction, chunking and embedding generation
- Vector storage and retrieval over PostgreSQL + pgvector (HNSW)
- RAG chat with citations and retrieval traces
- Artifact Studio: generation of grounded learning artifacts (text pieces, illustrations, audio podcast renditions) from knowledge base material
- Podcast player with mid-play, grounded interruption Q&A (`src/lib/artifacts/interrupt-service.ts`, playback state machine in `src/lib/audio/playback.ts`)
- Evaluation, benchmark and experiment persistence (Prisma reads and writes)
- Marketing pages and changelog

### Podcast audio path

A podcast artifact is a text artifact plus a synthesized rendition. The two are
separate, so a synthesis failure never invalidates the generated script.

```text
grounded artifact + source material
        │
        ▼
podcast script          src/lib/artifacts/podcast.ts
  schema-validated      exactly two speakers, alternating turns,
                        2–30 turns, each turn ≤ 1200 characters
        │
        ▼
per-turn synthesis      src/lib/audio/pipeline.ts
  one TTS request per   each request is bounded by the per-turn cap, so a
  turn                  long episode cannot exceed a provider request limit
        │
        ▼
segment assembly        segments concatenated in turn order
        │
        ▼
media storage          src/lib/storage/index.ts
  Cloudinary-only       throws when unconfigured rather than silently
                        falling back to local disk
        │
        ▼
media route             app/api/artifacts/[artifactId]/audio/route.ts
  session required,    authorization re-checked per request via
  org membership       canAccessKnowledgeBase, never trusted from the URL
```

Synthesis is per turn rather than per episode so a single long episode cannot
produce one over-long provider request, and the pipeline records a `FAILED`
artifact atomically instead of persisting a partial rendition.

Two caveats for anyone evaluating this path:

- Podcast synthesis requires live TTS provider credentials and Cloudinary
  credentials. Without them the storage provider throws on first use. Nothing
  fakes media, so this path is covered in tests only up to the provider
  boundary; end-to-end podcast audio is manual QA.
- The `vector(768)` contract applies to ingestion and retrieval only. Podcast
  media lives in Cloudinary, not PostgreSQL.

### Gateway — `gateway/` (legacy v1)

Go HTTP API gateway. Not called by the Portal. Responsibilities:

- API routing and request validation
- Authentication and rate limiting
- Semantic + LRU caching
- gRPC communication with the intelligence engine
- Prometheus metrics and health endpoints

### Intelligence Engine — `intelligence/` (legacy v1)

Python service. Not called by the Portal. Responsibilities:

- Document ingestion, chunking, and embedding
- Query classification and retrieval planning
- Retrieval execution across strategies (vector, BM25, hybrid, multi-hop), reranking
- LLM response assembly and grounding
- Evaluation framework (IR + generation metrics, statistics)
- Experiment tracking and artifact registries

### Actors alongside the core services

| Component | Location | Purpose |
|-----------|----------|---------|
| pgvector | pgvector extension on PostgreSQL | Production vector store, HNSW-indexed |
| FastAPI management API | `intelligence/api/` (legacy v1) | Configuration/artifact/evaluation endpoints (`/api/v1/*`) |
| ChromaDB | docker service (legacy v1) | Vector store for the v1 stack only |
| PostgreSQL | external / via DATABASE_URL | Users, knowledge bases, chunks, embeddings, artifacts, podcast interruptions |
| Prometheus + Grafana | docker services | Metrics collection and dashboards |

### proto/

gRPC service definitions shared between the gateway and the intelligence engine
(legacy v1).

### sdk/

Python client SDK (`kairos-client`) for integrating with the platform.

### benchmarks/

Evaluation datasets, the leaderboard, and performance harnesses used by the research/ops workflow.

---

## Retrieval Pipeline

Production (Portal):

```text
Source
  ↓
Portal ingestion
  ↓
text extraction
  ↓
chunking
  ↓
embedding generation   (gemini/text-embedding-004, 768 dims)
  ↓
PostgreSQL + pgvector   (vector(768) + HNSW)
  ↓
Research retrieval      (vector / BM25 / hybrid RRF)
  ↓
LLM generation
  ↓
citations
```

The legacy v1 stack runs the same shape through the gateway and the
intelligence engine's planner:

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

Do not read a latency number as a property of the pipeline. Retrieval cost is
set by the query plan Postgres chooses, which depends on filter selectivity and
corpus shape; report benchmarks with their conditions.

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
- Gateway (legacy v1): Prometheus metrics (`/metrics`), structured logging, `/health`
- Intelligence (legacy v1): Prometheus metrics, gRPC health checks (port 8001), structured logging
- Grafana dashboards provisioned from `docker/grafana/`

---

## Deployment

- **Production:** the Portal is deployed as a Next.js application and needs
  PostgreSQL with the pgvector extension. Apply migrations with
  `npx prisma migrate deploy`; the pgvector extension and the HNSW index are
  created by migration, not by Prisma's datamodel.
- **Docker Compose (local / legacy v1 stack):** `postgres`, `chromadb`,
  `intelligence`, `gateway`, `prometheus`, `grafana`. The Portal is not part of
  the compose file — run it locally with `npm run dev` in `apps/portal`. See
  `docker-compose.yml` and `docs/DEPLOYMENT.md`.

---

## Research Direction

Kairos is built around a central hypothesis:

> Confidence-aware adaptive retrieval planning can improve retrieval quality while maintaining or reducing latency and retrieval cost compared to static retrieval routing.

The retrieval planner and fallback manager in `intelligence/retrieval/` implement this direction; the evaluation framework exists to test it empirically. Forward-looking design documents (extension framework, cloud CLI) live in `docs/EXTENSIBILITY.md` and `cli/SPECIFICATION.md`.
