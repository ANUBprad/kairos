# Developer Guide

Guide for developers contributing to Kairos.

---

## Architecture Overview

Kairos is a microservices platform with three main components:

```
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

### Communication Flow

1. **Portal → Gateway**: REST API calls
2. **Gateway → Intelligence**: gRPC with Protocol Buffers
3. **Intelligence → Vector Store**: ChromaDB client
4. **Portal → Database**: Prisma ORM over PostgreSQL

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

# TypeScript tests
cd apps/portal
npx tsx --test "src/__tests__/*.test.ts"

# TypeScript type checking
npx tsc --noEmit

# Go tests
cd gateway
go test ./...
```

### Test Organization

```
tests/
├── test_*.py               # Unit and integration tests (flat layout)
├── benchmarks/             # Retrieval baseline, integration, adversarial suites
├── e2e/                    # End-to-end tests
└── conftest.py             # Shared fixtures
```

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