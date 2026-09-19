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

| Variable | Default | Description |
|----------|---------|-------------|
| `DIRECT_URL` | - | Direct PostgreSQL connection (session mode; required for Supabase) |
| `NEXT_PUBLIC_BETTER_AUTH_URL` | `http://localhost:3000` | Public app URL |
| `KAIROS_LLM_PROVIDER` | - | Generated-model provider: `openai` / `gemini` / `ollama` |
| `KAIROS_EMBEDDING_MODEL` | `local` | Embedding backend: `local` / `openai` / `gemini` |
| `OPENAI_API_KEY` | - | OpenAI API key |
| `GEMINI_API_KEY` | - | Google Gemini API key |
| `CLOUDINARY_CLOUD_NAME` | - | Cloudinary cloud name |
| `CLOUDINARY_API_KEY` | - | Cloudinary API key |
| `CLOUDINARY_API_SECRET` | - | Cloudinary API secret |
| `GITHUB_CLIENT_ID` | - | GitHub OAuth Client ID |
| `GITHUB_CLIENT_SECRET` | - | GitHub OAuth Client Secret |
| `KAIROS_API_SECRET` | - | Shared secret for `/api/v1/*` endpoints (`x-api-key`) |
| `PROMETHEUS_PORT` | `9090` | Prometheus metrics port |
| `GRAFANA_PASSWORD` | `admin` | Grafana admin password |

### Service Ports

| Service | Default Port | Variable |
|---------|--------------|----------|
| Portal (dev) | 3000 | `PORT` |
| Gateway | 8080 | `GATEWAY_PORT` |
| Intelligence (gRPC) | 28080 | `INTELLIGENCE_PORT` |
| Intelligence metrics | 8001 | `KAIROS_METRICS_PORT` |
| API (FastAPI) | 8000 | `API_PORT` |
| Internal Dashboard | 8501 | `DASHBOARD_PORT` |
| ChromaDB | 7777 | `CHROMA_STORE_PORT` |
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

model Chunk {
  id            String    @id @default(cuid())
  content       String
  tokenCount    Int
  metadata      Json?
  documentId    String
  document      Document  @relation(fields: [documentId], references: [id])
  embedding     Unsupported("vector(1536)")?
}

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

**Location:** `intelligence/retraining/model_registry.py`

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

The compose stack serves seven services. The Portal is **not** part of it — run it locally with `npm run dev` in `apps/portal`.

| Service | Build / Image | Port | Notes |
|---------|---------------|------|-------|
| `chromadb` | `chromadb/chroma:1.0.15` | 7777 → 8000 | Vector store |
| `intelligence` | `docker/intelligence.Dockerfile` | 28080, 8001 | gRPC engine + metrics |
| `api` | `docker/api.Dockerfile` | ${API_PORT:-8000} | FastAPI management API |
| `internal-dashboard` | `docker/dashboard.Dockerfile` | ${DASHBOARD_PORT:-8501} | Streamlit dashboard |
| `gateway` | `docker/gateway.Dockerfile` | ${GATEWAY_PORT:-8080} | HTTP API gateway |
| `prometheus` | `prom/prometheus:v2.51.0` | 9090 | Metrics collection |
| `grafana` | `grafana/grafana:10.4.2` | 3000 | Dashboards (provisioned from `docker/grafana/`) |

The stack reads its environment from `.env` (see `.env.example`). PostgreSQL is provided externally via `DATABASE_URL`/`DIRECT_URL` and is not part of the compose stack.

---

## Gateway Configuration

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

## Intelligence Engine Configuration

**Location:** `intelligence/config/settings.py`

### Config Options

Key settings exposed by `Settings` (Pydantic, populated from env):

```python
class Settings:
    # Server
    intelligence_port: int = 28080
    api_host: str = "0.0.0.0"
    api_port: int = 8000
    dashboard_port: int = 8501

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
