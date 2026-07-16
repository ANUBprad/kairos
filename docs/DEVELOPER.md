# Developer Guide

Guide for developers contributing to Kairos.

---

## Architecture Overview

Kairos follows a microservices architecture with three main components:

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│                 │     │                 │     │                 │
│   Next.js 15   │────▶│   Go Gateway    │────▶│   Python        │
│   Portal        │     │   (Chi Router)  │     │   Intelligence  │
│                 │     │                 │     │   (FastAPI)     │
└─────────────────┘     └─────────────────┘     └─────────────────┘
        │                       │                       │
        │                       │                       │
        ▼                       ▼                       ▼
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│                 │     │                 │     │                 │
│   PostgreSQL    │     │   Prometheus    │     │   ChromaDB      │
│   + pgvector    │     │   + Grafana     │     │   Vector Store  │
│                 │     │                 │     │                 │
└─────────────────┘     └─────────────────┘     └─────────────────┘
```

### Communication Flow

1. **Portal → Gateway**: REST API calls
2. **Gateway → Intelligence**: gRPC with Protocol Buffers
3. **Intelligence → Vector Store**: ChromaDB client
4. **Intelligence → Database**: SQLAlchemy/Prisma

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
    top_k: int = 10
) -> List[RetrievalResult]:
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
- **Linter**: ESLint
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
- **Linter**: `golangci-lint`
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
| Python | `tests/` | pytest |
| TypeScript | `apps/portal/src/__tests__/` | Jest |
| Go | `gateway/*_test.go` | testing |

### Running Tests

```bash
# Python tests
pytest tests/ -v

# Python with coverage
pytest tests/ --cov=intelligence --cov-report=html

# TypeScript tests
cd apps/portal
npm test

# Go tests
cd gateway
go test ./...

# All tests
make test
```

### Test Organization

```
tests/
├── unit/                    # Unit tests
│   ├── test_classifier.py
│   ├── test_retriever.py
│   └── test_evaluator.py
├── integration/             # Integration tests
│   ├── test_pipeline.py
│   └── test_api.py
├── e2e/                     # End-to-end tests
│   └── test_full_pipeline.py
└── fixtures/                # Test data
    ├── sample_documents/
    └── expected_results/
```

### Writing Tests

```python
import pytest
from intelligence.retrieval import VectorRetriever

class TestVectorRetriever:
    def test_retrieve_returns_results(self):
        retriever = VectorRetriever()
        results = retriever.retrieve("test query", top_k=5)
        assert len(results) <= 5
        assert all(hasattr(r, 'score') for r in results)
    
    def test_retrieve_empty_query_raises(self):
        retriever = VectorRetriever()
        with pytest.raises(ValueError):
            retriever.retrieve("", top_k=5)
```

---

## Adding New Retrieval Strategies

### Step 1: Create Strategy Class

```python
# intelligence/retrieval/my_strategy.py

from intelligence.retrieval.base import BaseRetriever
from intelligence.retrieval.retrieval_result import RetrievalResult

class MyRetriever(BaseRetriever):
    """My custom retrieval strategy."""
    
    def __init__(self, config: dict):
        super().__init__(config)
        self.param = config.get("param", "default")
    
    def retrieve(
        self, 
        query: str, 
        top_k: int = 10
    ) -> List[RetrievalResult]:
        """Retrieve documents using my strategy."""
        # Implementation here
        results = []
        ...
        return results
    
    def get_trace(self) -> dict:
        """Return trace data for debugging."""
        return {
            "strategy": "my_strategy",
            "param": self.param,
            "results_count": len(self.last_results)
        }
```

### Step 2: Register Strategy

```python
# intelligence/retrieval/__init__.py

from intelligence.retrieval.my_strategy import MyRetriever

RETRIEVAL_STRATEGIES = {
    "vector": VectorRetriever,
    "bm25": BM25Retriever,
    "hybrid_rrf": HybridRRFRetriever,
    "my_strategy": MyRetriever,  # Add here
    ...
}
```

### Step 3: Add Configuration

```python
# intelligence/config/settings.py

class RetrievalConfig:
    # Add new strategy config
    my_strategy_param: str = "default"
```

### Step 4: Write Tests

```python
# tests/unit/test_my_strategy.py

def test_my_strategy_basic():
    config = {"param": "test"}
    retriever = MyRetriever(config)
    results = retriever.retrieve("test query", top_k=5)
    assert len(results) > 0
```

---

## Adding New Metrics

### Step 1: Create Metric Class

```python
# intelligence/evaluation/my_metric.py

from intelligence.evaluation.base import BaseMetric
from typing import List, Dict, Any

class MyMetric(BaseMetric):
    """My custom evaluation metric."""
    
    def __init__(self, k: int = 10):
        super().__init__()
        self.k = k
    
    def compute(
        self,
        retrieved: List[str],
        relevant: List[str],
        **kwargs
    ) -> Dict[str, Any]:
        """Compute the metric."""
        # Implementation here
        score = ...
        
        return {
            "name": "my_metric",
            "score": score,
            "k": self.k,
            "details": {...}
        }
    
    def compute_with_statistics(
        self,
        results: List[Dict[str, Any]]
    ) -> Dict[str, Any]:
        """Compute metric with statistical analysis."""
        base_result = self.compute_all(results)
        
        # Add confidence intervals
        ci = self.bootstrap_ci(results)
        
        # Add effect sizes
        effect = self.cohens_d(results)
        
        return {
            **base_result,
            "confidence_interval": ci,
            "effect_size": effect
        }
```

### Step 2: Register Metric

```python
# intelligence/evaluation/__init__.py

from intelligence.evaluation.my_metric import MyMetric

EVALUATION_METRICS = {
    "recall": RecallMetric,
    "precision": PrecisionMetric,
    "my_metric": MyMetric,  # Add here
    ...
}
```

### Step 3: Write Tests

```python
# tests/unit/test_my_metric.py

def test_my_metric_basic():
    metric = MyMetric(k=10)
    result = metric.compute(
        retrieved=["doc1", "doc2", "doc3"],
        relevant=["doc1", "doc2"]
    )
    assert result["score"] > 0
    assert result["k"] == 10
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
from intelligence.embeddings import get_embedder
embedder = get_embedder()
vector = embedder.embed("test text")
print(f"Vector shape: {vector.shape}")
```

### Debug Mode

```bash
# Python with debug logging
LOG_LEVEL=DEBUG python -m intelligence.main

# Go with debug logging
LOG_LEVEL=debug go run main.go
```

### Performance Profiling

```python
# Profile retrieval
import cProfile
from intelligence.retrieval import retrieve

cProfile.run('retrieve("test query")')
```

---

## Development Workflow

### 1. Create Feature Branch

```bash
git checkout -b feature/my-feature
```

### 2. Make Changes

- Write code following style conventions
- Add tests for new functionality
- Update documentation if needed

### 3. Run Checks

```bash
# Python
ruff format .
ruff check .
pytest tests/

# TypeScript
cd apps/portal
npm run lint
npm test

# Go
cd gateway
gofmt -w .
golangci-lint run
```

### 4. Commit Changes

```bash
git add .
git commit -m "feat: add my new feature"
```

### 5. Create PR

- Fill out PR template
- Link to issue
- Request review

---

## Project Commands

```bash
# Install all dependencies
make install

# Run all tests
make test

# Lint all code
make lint

# Format all code
make format

# Build Docker images
make docker-build

# Start all services
make up

# Stop all services
make down

# View logs
make logs
```
