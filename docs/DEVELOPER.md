# Developer Guide

Guide for developers contributing to Kairos.

---

## Architecture Overview

Kairos ships two stacks, and the **Portal is the production application**.

```
Production (Portal)

Browser
   │  HTTP
   ▼
Next.js 15 Portal (apps/portal)
   │  server actions / route handlers / Prisma
   │  embedding provider calls (768 dims) + chat provider calls
   ▼
PostgreSQL 16 + pgvector
   ├─ users, knowledge bases, documents, chunks   (metadata)
   └─ DocumentEmbedding.embedding vector(768)     (vectors)
      + HNSW index (m = 16, ef_construction = 64)

Legacy v1 (still in the repo, still runs under Docker Compose)

┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│                 │     │                 │     │                 │
│   Next.js 15   │────▶│   Go Gateway    │────▶│   Python        │
│   Portal        │     │   (Chi Router)  │     │   Intelligence  │
│                 │     │                 │     │   (FastAPI)     │
└─────────────────┘     └─────────────────┘     └─────────────────┘
        │                       │                       │
        ▼                       ▼                       ▼
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│                 │     │                 │     │                 │
│   PostgreSQL    │     │   Prometheus    │     │   ChromaDB      │
│   (Prisma)      │     │   + Grafana     │     │   Vector Store  │
│                 │     │                 │     │                 │
└─────────────────┘     └─────────────────┘     └─────────────────┘
```

The Portal does not call the Go gateway, the Python intelligence engine or
ChromaDB. It owns ingestion, text extraction, chunking, embedding, storage,
retrieval and generation end to end, and its retrieval embeddings are Gemini
`text-embedding-004` at 768 dimensions — the width migration
`20261122000000_pin_embedding_dimension_768` pins in the database.

### Communication Flow

Production (Portal):

1. **Browser → Portal**: HTTP, server actions and route handlers
2. **Portal → Database**: Prisma over PostgreSQL, including the
   `DocumentEmbedding` vector column
3. **Portal → providers**: embedding generation (768 dims) and chat completion

Legacy v1:

4. **Portal → Gateway**: REST API calls
5. **Gateway → Intelligence**: gRPC with Protocol Buffers
6. **Intelligence → Vector Store**: ChromaDB client

The rest of this guide documents the legacy v1 stack, which is what
`gateway/`, `intelligence/`, `sdk/` and `proto/` implement. For the production
Portal, see [ARCHITECTURE.md](ARCHITECTURE.md) and
[DATA-FLOW.md](DATA-FLOW.md).

---

## Code Style Conventions

### Python

- **Formatter**: `ruff format`
- **Linter**: `ruff check`
- **Type Hints**: Required for all functions
- **Docstrings**: Google style for public functions
- **Max Line Length**: 88 characters

```python
def retrieve_chunks(
    query: str,
    config: RetrievalConfig,
    top_k: int = 10,
) -> list[RetrievalResult]:
    """Retrieve relevant chunks for a query.

    Args:
        query: The search query
        config: Retrieval configuration
        top_k: Number of results to return

    Returns:
        List of retrieval results with scores

    Raises:
        ValueError: If query is empty
    """
    if not query:
        raise ValueError("Query cannot be empty")
    ...
```

### TypeScript/React

- **Formatter**: Prettier
- **Linter**: ESLint (`npm run lint` in `apps/portal`)
- **Components**: Functional components with hooks
- **Naming**: PascalCase for components, camelCase for functions
- **File Structure**: One component per file

```typescript
interface ChatMessageProps {
  content: string;
  citations?: Citation[];
  trace?: PipelineTrace;
}

export function ChatMessage({ content, citations, trace }: ChatMessageProps) {
  return (
    <div className="message">
      <p>{content}</p>
      {citations && <CitationList citations={citations} />}
    </div>
  );
}
```

### Go

- **Formatter**: `gofmt`
- **Linter**: `go vet`
- **Naming**: CamelCase for exported, camelCase for unexported
- **Error Handling**: Always check errors explicitly

```go
func (h *Handler) Query(w http.ResponseWriter, r *http.Request) {
    var req QueryRequest
    if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
        http.Error(w, "Invalid request body", http.StatusBadRequest)
        return
    }
    ...
}
```

---

## Testing Approach

### Test Locations

| Component | Location | Framework |
|-----------|----------|-----------|
| Python | `tests/` (incl. `tests/benchmarks/`, `tests/e2e/`) | pytest |
| TypeScript | `apps/portal/src/__tests__/` | `node:test` via `tsx` |
| Go | `gateway/*_test.go` | `go test` |

### Running Tests

```bash
# Python tests
python -m pytest tests/ -v

# Python — targeted subset (fast)
python -m pytest tests/test_phase_b_integration.py tests/test_phase_b_stress.py -v

# TypeScript tests (from apps/portal)
node --import tsx --test src/__tests__/*.test.ts

# TypeScript type checking
npx tsc --noEmit

# Go tests
cd gateway
go test ./...
```

The glob must be unquoted so the shell expands it, and `node --import tsx`
is required rather than `npx tsx`: the suite resolves the `@/` path alias to
`apps/portal/src`, which only the loader hook does.

#### The Portal suite needs a real PostgreSQL with pgvector

Most Portal suites run against a real database and skip themselves when
`KAIROS_TEST_DATABASE_URL` is unset, so a silent skip looks like a green run.
Point **both** `DATABASE_URL` and `KAIROS_TEST_DATABASE_URL` at the same test
database: server actions like `ingestText` resolve their session user through
`DATABASE_URL`, so a split configuration fails on a foreign key against the
demo user rather than on a missing fixture.

```bash
docker run -d --name kairos-portal-test -p 5432:5432 \
  -e POSTGRES_USER=postgres -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB=kairos_test pgvector/pgvector:pg16

cd apps/portal
export DATABASE_URL=postgresql://postgres:postgres@localhost:5432/kairos_test
export KAIROS_TEST_DATABASE_URL=$DATABASE_URL
export KAIROS_DEMO_MODE=true
export BETTER_AUTH_SECRET=local-dev-secret
export AI_PROVIDER=gemini
export GEMINI_API_KEY=test-dummy-key-do-not-call
export OPENAI_API_KEY=test-dummy-key-do-not-call

npx prisma migrate deploy
node --import tsx --test src/__tests__/*.test.ts
```

No paid provider is contacted: the suites replace `globalThis.fetch` with a
stub that answers embedding and chat endpoints deterministically. The dummy
keys only need to exist so providers can be constructed. Retrieval is *not*
stubbed — vectors are written to the pgvector column and read back through the
same `<=>` search production uses, so a wrong embedding dimension or a broken
index fails the suite.

`.github/workflows/portal.yml` runs exactly this against a
`pgvector/pgvector:pg16` service with migrations applied.

### Test Organization

```
tests/
├── test_*.py               # Unit and integration tests (flat layout)
├── benchmarks/             # Retrieval baseline, integration, adversarial suites
├── e2e/                    # End-to-end tests
└── conftest.py             # Shared fixtures
```

### Release-Confidence Coverage

`src/__tests__/release-journey.integration.test.ts` is the canonical Portal
journey. The other suites prove one leg each; this proves the chain, for one
tenant in one pass:

| Step | Proves |
|------|--------|
| Ingest a text source | chunking, embedding rows, and a real 768-wide vector in the pgvector column |
| Retrieve it | the ingested chunk comes back through the production cosine search |
| Ask a question | a grounded answer, persisted citations, and an `OK` trace with retrieval + generation spans |
| Generate artifacts | summary and quiz are schema-valid, persisted, org-scoped, and traced |
| Study | the quiz is taken, graded server-side, and reported in study progress |
| Evaluate | a benchmark run over the same KB persists results and metrics |
| Observe | every step is readable back from the org's trace stream |
| Isolate | a foreign tenant reaches none of it, and gets `404`, not `403` |

The same file covers the request- and generation-side guardrails: an oversized
query is rejected at the chat route before any read or provider call, an
oversized evaluation dataset is refused with `413` before a run row exists, and
a spent per-user generation budget returns `429` without reaching the provider.

What this does **not** cover: podcast synthesis. The storage provider throws
unless Cloudinary credentials are configured, so TTS plus upload cannot run in
CI; episode media and its tenancy are covered separately in
`podcast-audio-media.integration.test.ts`. There is also no browser-level test —
the suite drives the route handlers and library functions directly, so it
verifies server behavior and persistence, not rendered UI or client-side
interactions.

### Writing Tests

```python
import pytest
from intelligence.retrieval import RealRetriever

def test_retrieve_returns_results():
    retriever = RealRetriever(namespace="test")
    results = retriever.retrieve("test query", top_k=5)
    assert len(results.results) <= 5
```

---

## Adding New Retrieval Strategies

Retrievers live in `intelligence/retrieval/`, are selected by the `RetrievalPlanner`, and are executed via `RetrievalExecutor` (see `intelligence/retrieval/retrieval_executor.py`).

### Step 1: Create the Retriever

```python
# intelligence/retrieval/my_strategy.py

from intelligence.retrieval.retriever import BaseRetriever
from intelligence.retrieval.retrieval_result import RetrievalResult

class MyRetriever(BaseRetriever):
    """My custom retrieval strategy."""

    def retrieve(
        self,
        query: str,
        namespace: str = "default",
        top_k: int = 10,
        **kwargs,
    ) -> RetrievalResult:
        # Implementation here
        ...
        return result
```

### Step 2: Wire It Into the Pipeline

- Add the strategy name to the classifier/planner selection logic so queries can be routed to it
- Use `RetrievalExecutor` for execution (or `RealRetriever.retrieve(strategy=...)`)
- Add configuration defaults in `intelligence/config/settings.py`

### Step 3: Write Tests

```python
# tests/test_my_strategy.py

def test_my_strategy_basic():
    retriever = MyRetriever()
    result = retriever.retrieve("test query", top_k=5)
    assert len(result.results) > 0
```

---

## Adding New Metrics

Metrics live in `intelligence/evaluation/` and are wired into the evaluation framework (see `intelligence/evaluation/__init__.py`).

### Step 1: Create the Metric

```python
# intelligence/evaluation/my_metric.py

def my_metric(relevant, retrieved, k: int = 10) -> float:
    """Compute the metric. Follows the ranking_metrics.py conventions."""
    score = ...
    return score
```

### Step 2: Export It

Add the metric to the evaluation package exports in `intelligence/evaluation/__init__.py` so it joins `rank_metrics`/`Evaluator` evaluation paths.

### Step 3: Write Tests

```python
# tests/test_my_metric.py

from intelligence.evaluation.my_metric import my_metric


def test_my_metric_basic():
    score = my_metric(relevant={"doc1", "doc2"}, retrieved=["doc1", "doc2", "doc3"], k=10)
    assert score > 0
```

---

## Debugging Tips

### Common Issues

#### 1. gRPC Connection Failed

```bash
# Check if intelligence engine is running
curl http://localhost:28080/health

# Check gateway logs
docker compose logs gateway

# Check intelligence logs
docker compose logs intelligence
```

#### 2. Vector Store Connection

```bash
# Check ChromaDB
curl http://localhost:7777/api/v1/heartbeat

# Check collections
curl http://localhost:7777/api/v1/collections
```

#### 3. Database Connection

```bash
# Test connection
psql $DATABASE_URL -c "SELECT 1"

# Check pgvector extension
psql $DATABASE_URL -c "SELECT * FROM pg_extension WHERE extname = 'vector'"
```

#### 4. Embedding Errors

```python
# Test embedding generation
from intelligence.embeddings.local_embedder import LocalEmbedder
embedder = LocalEmbedder()
vector = embedder.embed("test text")
print(f"Vector shape: {len(vector)}")
```

### Debug Mode

```bash
# Python with debug logging
KAIROS_ENVIRONMENT=development python -m intelligence.main

# Go with debug logging
LOG_LEVEL=debug go run main.go
```

---

## Development Workflow

1. Create a feature branch: `git checkout -b feat/my-feature`
2. Make changes, write tests, update docs if behavior changes
3. Run checks (below)
4. Commit and open a pull request

### Checks

```bash
# Python
ruff format .
ruff check .
python -m pytest tests/

# TypeScript
cd apps/portal
npm run lint
npx tsc --noEmit
npx tsx --test "src/__tests__/*.test.ts"

# Go
cd gateway
gofmt -w .
go vet ./...
go test ./...
```

---

## Project Commands

```bash
# Run the Python intelligence engine locally
pip install -r requirements.txt
python -m intelligence.main

# Run the gateway locally
cd gateway && go run main.go

# Run the portal locally
cd apps/portal && npm install && npx prisma generate && npm run dev

# Full stack
docker compose up -d

# Stop / logs
docker compose down
docker compose logs -f
```

See [DEPLOYMENT.md](DEPLOYMENT.md) and [CONFIGURATION.md](CONFIGURATION.md) for deployment and environment configuration details.