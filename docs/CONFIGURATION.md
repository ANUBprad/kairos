# Configuration Reference

Complete configuration reference for Kairos.

---

## Environment Variables

### Required Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://user:pass@localhost:5432/kairos` |
| `OPENAI_API_KEY` | OpenAI API key (or GEMINI_API_KEY) | `sk-...` |
| `BETTER_AUTH_SECRET` | Auth token signing secret | Base64-encoded 32-byte string |

### Optional Variables

Portal (`apps/portal`):

| Variable | Default | Description |
|----------|---------|-------------|
| `DIRECT_URL` | - | Direct PostgreSQL connection (session mode; required for Supabase) |
| `NEXT_PUBLIC_BETTER_AUTH_URL` | `http://localhost:3000` | Public app URL |
| `AI_PROVIDER` | `openai` | Default provider for both chat and embeddings |
| `OPENAI_API_KEY` | - | OpenAI API key (chat + embeddings) |
| `GEMINI_API_KEY` | - | Google Gemini API key (chat + embeddings) |
| `OPENAI_CHAT_MODEL` | `gpt-4o-mini` | Chat/generation model. Does not affect embedding width |
| `GEMINI_CHAT_MODEL` | `gemini-2.0-flash` | Chat/generation model. Does not affect embedding width |
| `OPENAI_EMBEDDING_MODEL` | `text-embedding-3-small` | **Inert / non-indexable.** 1536 dims, which this database cannot store. Kept so the resolver can name the mismatch in its error; ingestion rejects it |
| `GEMINI_EMBEDDING_MODEL` | `text-embedding-004` | Retrieval embedding model. 768 dims — the width the pgvector column stores |
| `AI_MAX_OUTPUT_TOKENS` | `16384` | Server-side ceiling on generated tokens per provider call. A call may ask for less; none may ask for more |
| `EVALUATION_MAX_QUESTIONS` | `100` | Questions one benchmark, strategy, campaign, or experiment run may process. A larger dataset is refused (413) rather than partly run |
| `EVALUATION_MAX_CAMPAIGN_EXPERIMENTS` | `24` | Strategy x model x chunk-strategy x topK combinations one campaign may evaluate |
| `CLOUDINARY_CLOUD_NAME` | - | Cloudinary cloud name |
| `CLOUDINARY_API_KEY` | - | Cloudinary API key |
| `CLOUDINARY_API_SECRET` | - | Cloudinary API secret |
| `GITHUB_CLIENT_ID` | - | GitHub OAuth Client ID |
| `GITHUB_CLIENT_SECRET` | - | GitHub OAuth Client Secret |
| `KAIROS_API_SECRET` | - | Shared secret for `/api/v1/*` endpoints (`x-api-key`) |
| `PROMETHEUS_PORT` | `9090` | Prometheus metrics port |
| `GRAFANA_PASSWORD` | `admin` | Grafana admin password |

#### Chat model vs. embedding model

These are separate settings and changing one does not change the other:

- `*_CHAT_MODEL` selects the generation model. It has no effect on vector width.
- `*_EMBEDDING_MODEL` selects the retrieval model, and must be 768-dimensional.
  The width is pinned in the database by migration
  `20261122000000_pin_embedding_dimension_768`, so only the models listed in
  `indexableEmbeddingModels()` (`text-embedding-004`, `embedding-001`) can be
  written. Ingestion rejects anything else before calling a provider.
- `AI_PROVIDER` decides which pair is the fallback when a knowledge base has no
  explicit `retrievalConfig`. Precedence is: explicit override (request or CLI)
  → knowledge base `retrievalConfig` → env. One resolver,
  `resolveEmbeddingModel` in `apps/portal/src/lib/retrieval/embedding-models.ts`,
  is the single source of truth; ingestion, Research Chat and the Retrieval Lab
  all go through it, because a query embedded with a different model than the
  documents it searches returns nothing or raises a raw dimension error.

Legacy v1 stack (intelligence engine, `intelligence/`) — not read by the Portal:

| Variable | Default | Description |
|----------|---------|-------------|
| `KAIROS_LLM_PROVIDER` | - | Generated-model provider: `openai` / `gemini` / `ollama` |
| `KAIROS_EMBEDDING_MODEL` | `local` | Embedding backend: `local` / `openai` / `gemini` |
| `INTELLIGENCE_HOST` / `INTELLIGENCE_PORT` | `localhost` / `28080` | Intelligence engine address |
| `CHROMA_STORE_HOST` / `CHROMA_STORE_PORT` | `localhost` / `7777` | ChromaDB address (v1 vector store) |
| `KAIROS_GRPC_BIND_HOST` | `127.0.0.1` | gRPC bind host. Loopback by default; `0.0.0.0` only on a private network or with TLS |
| `KAIROS_GRPC_TLS_CERT` / `KAIROS_GRPC_TLS_KEY` | - | PEM server certificate + key; setting both serves gRPC over TLS |
| `KAIROS_GRPC_TLS_CA` | - | PEM CA that signs client certificates; setting it also requires mTLS |
| `KAIROS_GRPC_TLS_CA` (gateway) | - | CA bundle the gateway uses to verify the Intelligence gRPC certificate |
| `KAIROS_GRPC_TLS_SERVER_NAME` | - | Server name the gateway expects in that certificate, when it differs from the dial target |

The gateway ↔ intelligence boundary is protected twice: by the shared
`KAIROS_SECRET` credential on every protected RPC, and by the transport. The
transport policy is that plaintext gRPC is allowed on loopback or outside
production, and **production refuses to start** on a non-loopback plaintext bind
— supply `KAIROS_GRPC_TLS_CERT`/`KAIROS_GRPC_TLS_KEY`, or keep the bind on
loopback. `X-Namespace` is caller-asserted, so `KAIROS_ALLOWED_NAMESPACES` is
what bounds which namespaces the shared credential may select; production
requires it to be set.

### Service Ports

| Service | Default Port | Variable |
|---------|--------------|----------|
| Portal (dev) | 3000 | `PORT` |
| Gateway (legacy v1) | 8080 | `GATEWAY_PORT` |
| Intelligence gRPC (legacy v1) | 28080 | `INTELLIGENCE_PORT` |
| Intelligence metrics (legacy v1) | 8001 | `KAIROS_METRICS_PORT` |
| ChromaDB (legacy v1) | 7777 | `CHROMA_STORE_PORT` |
| Prometheus | 9090 | `PROMETHEUS_PORT` |
| Grafana | 3000 | (conflicts with Portal dev — run one at a time) |

---

## Prisma Schema Overview

**Location:** `apps/portal/prisma/schema.prisma`

### Core Models

```prisma
model User {
  id            String    @id @default(cuid())
  email         String    @unique
  name          String?
  avatarUrl     String?
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt
  knowledgeBases KnowledgeBase[]
  experiments    Experiment[]
}

model KnowledgeBase {
  id            String    @id @default(cuid())
  name          String
  description   String?
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt
  userId        String
  user          User      @relation(fields: [userId], references: [id])
  documents     Document[]
  config        Json?     // ChunkingConfig, EmbeddingConfig
}

model Document {
  id            String    @id @default(cuid())
  name          String
  content       String
  fileType      String
  fileSize      Int
  createdAt     DateTime  @default(now())
  knowledgeBaseId String
  knowledgeBase KnowledgeBase @relation(fields: [knowledgeBaseId], references: [id])
  chunks        Chunk[]
}

model DocumentChunk {
  id            String    @id @default(cuid())
  content       String
  tokenCount    Int
  metadata      Json?
  documentId    String
  document      Document  @relation(fields: [documentId], references: [id])
  embedding     DocumentEmbedding?
}

model DocumentEmbedding {
  id         String @id @default(cuid())
  model      String @default("text-embedding-004")
  dimensions Int    @default(768)
  status     String @default("pending")

  chunkId String        @unique
  chunk   DocumentChunk @relation(fields: [chunkId], references: [id], onDelete: Cascade)

  embedding Unsupported("vector")?

  createdAt DateTime @default(now())
}
```

`Unsupported("vector")?` is as far as Prisma's datamodel goes. It does **not**
carry the `vector(768)` typmod and it cannot express a pgvector index, so the
authoritative definition of the column and its HNSW index lives in the SQL
migration and in the live database:

- migration `20260710000000_add_evaluation_observability_embedding_tables` —
  creates the `DocumentEmbedding` table (without the vector column)
- migration `20260913000000_add_embedding_vectors` — `CREATE EXTENSION "vector"`
  and adds `DocumentEmbedding.embedding vector` (typmod-less)
- migration `20261122000000_pin_embedding_dimension_768` — pins the column to
  `vector(768)`, corrects the `model`/`dimensions` defaults, and creates
  `DocumentEmbedding_embedding_hnsw_idx` on `("embedding" vector_cosine_ops)`
  with `m = 16, ef_construction = 64`

`prisma migrate diff` against a live database will therefore always show drift
on this column. That is expected; do not "fix" it by editing the migration or
by adding the index to `schema.prisma`.

model Experiment {
  id            String    @id @default(cuid())
  name          String
  description   String?
  config        Json      // ExperimentConfig
  results       Json?     // ExperimentResults
  createdAt     DateTime  @default(now())
  userId        String
  user          User      @relation(fields: [userId], references: [id])
}

model ChatSession {
  id            String    @id @default(cuid())
  title         String?
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt
  userId        String
  messages      Message[]
}

model Message {
  id            String    @id @default(cuid())
  role          String    // "user" | "assistant"
  content       String
  citations     Json?     // Citation[]
  trace         Json?     // PipelineTrace
  createdAt     DateTime  @default(now())
  sessionId     String
  session       ChatSession @relation(fields: [sessionId], references: [id])
}
```

---

## RetrievalConfig Options

```python
class RetrievalConfig:
    strategy: str = "hybrid_rrf"  # Strategy name
    top_k: int = 10               # Number of results
    min_score: float = 0.5        # Minimum similarity score
    enable_reranking: bool = True  # Enable cross-encoder reranking
    reranker_model: str = "cross-encoder/ms-marco-MiniLM-L-6-v2"
    reranker_top_k: int = 50      # Initial results before reranking
    
    # Vector search specific
    vector_weight: float = 0.7    # Weight for vector scores in hybrid
    bm25_weight: float = 0.3     # Weight for BM25 scores in hybrid
    
    # Query expansion specific
    expansion_count: int = 3      # Number of expanded queries
    expansion_temperature: float = 0.7
    
    # Multi-query specific
    multi_query_count: int = 5    # Number of parallel queries
    fusion_method: str = "rrf"    # "rrf" or "convex"
    
    # Context compression specific
    compression_ratio: float = 0.5
    compression_model: str = "gpt-4o-mini"
```

---

## ChunkingConfig Options

```python
class ChunkingConfig:
    strategy: str = "recursive"   # Strategy name
    chunk_size: int = 512         # Target tokens per chunk
    chunk_overlap: int = 50       # Overlap between chunks
    min_chunk_size: int = 100     # Minimum chunk size
    
    # Recursive specific
    separators: List[str] = ["\n\n", "\n", ". ", " "]
    
    # Fixed-size specific
    stride: int = 256             # Sliding window stride
    
    # Semantic specific
    similarity_threshold: float = 0.5
    embedding_model: str = "text-embedding-3-small"
```

---

## Model Registry

**Location:** `intelligence/retraining/model_registry.py` (legacy v1 stack)

This registry belongs to the v1 Python engine and has no effect on the Portal.
The production retrieval contract is a single 768-dimensional model,
`gemini/text-embedding-004`; see the Portal table above and
`apps/portal/src/lib/retrieval/embedding-models.ts`.

### Registered Models

| Category | Model ID | Provider | Dimensions |
|----------|----------|----------|------------|
| **Embedding** | text-embedding-3-small | OpenAI | 1536 |
| **Embedding** | text-embedding-3-large | OpenAI | 3072 |
| **Embedding** | embed-english-v3.0 | Cohere | 1024 |
| **Embedding** | all-MiniLM-L6-v2 | Local | 384 |
| **Reranker** | cross-encoder/ms-marco-MiniLM-L-6-v2 | Local | 1 |
| **Reranker** | cross-encoder/ms-marco-MiniLM-L-12-v2 | Local | 1 |
| **LLM** | gpt-4o | OpenAI | - |
| **LLM** | gpt-4o-mini | OpenAI | - |
| **LLM** | gemini-2.0-flash | Google | - |

### Adding Custom Models

```python
from intelligence.retraining.model_registry import ModelRegistry

registry = ModelRegistry()
registry.register(
    model_id="custom-embedding-v1",
    category="embedding",
    provider="custom",
    dimensions=768,
    endpoint="http://localhost:8000/embed"
)
```

---

## Docker Compose Configuration

**Location:** `docker-compose.yml`

The compose stack serves six services. The Portal is **not** part of it — run it locally with `npm run dev` in `apps/portal`. Apart from `postgres`, the services belong to the legacy v1 stack; the Portal reads and writes only PostgreSQL.

| Service | Build / Image | Port | Notes |
|---------|---------------|------|-------|
| `postgres` | `pgvector/pgvector:pg16` | 5432 | App database and production vector store — matches the default `DATABASE_URL` |
| `chromadb` | `chromadb/chroma:1.0.15` | 7777 → 8000 | v1 vector store (legacy) |
| `intelligence` | `docker/intelligence.Dockerfile` | 28080, 8001 | gRPC engine + metrics (legacy) |
| `gateway` | `docker/gateway.Dockerfile` | ${GATEWAY_PORT:-8080} | HTTP API gateway (legacy) |
| `prometheus` | `prom/prometheus:v2.51.0` | 9090 | Metrics collection |
| `grafana` | `grafana/grafana:10.4.2` | 3000 | Dashboards (provisioned from `docker/grafana/`) |

The stack reads its environment from `.env` (see `.env.example`). The `postgres` service provides the local development database (`localhost:5432/kairos`, user `postgres`/`postgres`); point `DATABASE_URL`/`DIRECT_URL` at any other PostgreSQL to use it instead.

---

## Gateway Configuration (legacy v1)

**Location:** `gateway/config/`

### Config Options

```go
type Config struct {
    Port                int           `env:"GATEWAY_PORT" default:"8080"`
    IntelligenceURL     string        `env:"INTELLIGENCE_URL" default:"localhost:28080"`
    RateLimitRPS        int           `env:"RATE_LIMIT_RPS" default:"100"`
    CacheSize           int           `env:"CACHE_SIZE" default:"1000"`
    CacheTTL            time.Duration `env:"CACHE_TTL" default:"5m"`
    MaxRequestSize      int64         `env:"MAX_REQUEST_SIZE" default:"10485760"` // 10MB
    EnableCORS          bool          `env:"ENABLE_CORS" default:"true"`
    AllowedOrigins      []string      `env:"ALLOWED_ORIGINS" default:"http://localhost:3000"`
}
```

---

## Intelligence Engine Configuration (legacy v1)

**Location:** `intelligence/config/settings.py`

### Config Options

Key settings exposed by `Settings` (Pydantic, populated from env):

```python
class Settings:
    # Server
    intelligence_port: int = 28080
    api_host: str = "0.0.0.0"
    api_port: int = 8000

    # Data
    chroma_store_host: str = "localhost"
    chroma_store_port: int = 7777
    # AI
    embedding_model: str = "local"
    llm_provider: Optional[str] = None  # "openai" | "gemini" | "ollama"
    gemini_api_key: Optional[str] = None
    openai_api_key: Optional[str] = None
    ollama_url: Optional[str] = None

    # Chunking
    chunk_size: int = 1024
    overlap: int = 150

    # Caching
    cache_maxsize: int = 4096
    cache_ttl_seconds: int = 300

    # Metrics / health
    metrics_enabled: bool = True
    metrics_port: int = 8001
    health_check_enabled: bool = True

    # Resilience
    provider_timeout_seconds: float = 30.0
    circuit_breaker_failure_threshold: int = 5
    circuit_breaker_recovery_timeout: float = 30.0
```

All of these are overridable via environment variables — see `.env.example` for the authoritative list.
