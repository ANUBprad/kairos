# Data Flow Documentation

Detailed data flow diagrams for Kairos system operations.

---

## Overview

This document describes the data flows through the Kairos system for key operations: document upload, query execution, evaluation, and experiment management.

**Two stacks exist in this repository.** Sections 1, 2 and 5 describe the
production Portal path. The Portal does not call the Go gateway or the Python
intelligence engine, and it does not use ChromaDB. Sections 3, 4 and 6 still
show the legacy v1 flows (gateway → intelligence), which remain in the
repository and still run under Docker Compose.

### Production pipeline

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
PostgreSQL + pgvector   (vector(768) + HNSW index)
  ↓
Research retrieval
  ↓
LLM generation
  ↓
citations
```

---

## 1. Document Upload Flow

```text
Browser
  │  Upload file
  ▼
Portal (Next.js)
  │  Validate type + size
  │  Extract text (PDF, DOCX, TXT, Markdown, CSV, URL, YouTube)
  │  Chunk the text
  │  Embed each chunk              ← 768-dim provider call, rejected if not 768
  ▼
PostgreSQL + pgvector
     Write DocumentChunk + DocumentEmbedding (model + dimensions recorded)
  │
  ▼
Browser
     Processing status / success
```

### Steps

1. **User uploads file** via the browser
2. **Portal validates** file type and size
3. **Portal extracts** text (PDF, DOCX, TXT, Markdown, CSV, URL, YouTube)
4. **Portal chunks** the extracted text
5. **Portal embeds** each chunk with the knowledge base's resolved embedding
   provider/model. Ingestion refuses any model that is not 768-dimensional
   before it calls the provider
6. **Portal writes** `DocumentChunk` and `DocumentEmbedding` rows in one
   transaction, recording the model and dimensions actually used
7. **Success response** returned to user

The vector column is `DocumentEmbedding.embedding vector(768)` and the HNSW
index over it is created by the SQL migration
`20261122000000_pin_embedding_dimension_768`, not by Prisma's datamodel.

---

## 2. Query Execution Flow

```text
Browser
  │  Enter query
  ▼
Portal (Next.js)
  │  Embed the query at 768 dims (same provider/model as the documents)
  ▼
PostgreSQL + pgvector
     Vector search (cosine distance), BM25, or both fused with RRF  → candidates
  │
  ▼
Portal (Next.js)
  │  Rerank and assemble the prompt
  │  LLM generation
  │  Persist message + citations + retrieval trace
  ▼
Browser
     Answer + citations
```

### Steps

1. **User enters query** in the chat interface
2. **Portal embeds the query** using the knowledge base's resolved embedding
   provider/model. A query embedded with a different model than the documents
   it searches returns nothing or raises a raw dimension error, so the
   provider/model is resolved from one place (`resolveEmbeddingModel`)
3. **Portal retrieves** candidates: pgvector cosine-distance search, BM25, or
   both fused with reciprocal rank fusion, according to the knowledge base's
   retrieval config
4. **Portal reranks** and assembles the prompt
5. **Portal generates** the answer with the chat provider
6. **Portal persists** the message with its citations and retrieval trace

**Latency is not a fixed property of this path.** pgvector uses the HNSW index
only when the filter is selective enough; a selective single-knowledge-base
filter can fall back to a sequential scan, while a multi-knowledge-base query
can use the index. Report any latency figure together with the corpus shape,
filter selectivity, hardware and provider conditions it was measured under.

---

## 3. Evaluation Flow (legacy v1)

The Portal's own evaluation, regression and leaderboard pages read and write
`BenchmarkDataset`, `BenchmarkRun`, `BenchmarkResult` and `Experiment` rows
directly through Prisma — no service hop. The flow below is the legacy v1
evaluation path and is what the gateway routes to.


```
┌─────────────┐    ┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│   User      │    │   Portal    │    │   Gateway   │    │ Intelligence│
│   Browser   │    │   (Next.js) │    │   (Go)      │    │   (Python)  │
└──────┬──────┘    └──────┬──────┘    └──────┬──────┘    └──────┬──────┘
       │                  │                  │                  │
       │  Start Eval      │                  │                  │
       │─────────────────▶│                  │                  │
       │                  │                  │                  │
       │                  │  POST /evaluate  │                  │
       │                  │─────────────────▶│                  │
       │                  │                  │                  │
       │                  │                  │  gRPC: Evaluate  │
       │                  │                  │─────────────────▶│
       │                  │                  │                  │
       │                  │                  │                  │  Load Dataset
       │                  │                  │                  │─────────────────┐
       │                  │                  │                  │                  │
       │                  │                  │                  │  Execute Queries │
       │                  │                  │                  │◀────────────────┘
       │                  │                  │                  │
       │                  │                  │                  │  Compute Metrics
       │                  │                  │                  │─────────────────┐
       │                  │                  │                  │                  │
       │                  │                  │                  │  Statistical     │
       │                  │                  │                  │  Analysis        │
       │                  │                  │                  │◀────────────────┘
       │                  │                  │                  │
       │                  │                  │  Results         │
       │                  │                  │◀─────────────────│
       │                  │                  │                  │
       │                  │  Results         │                  │
       │                  │◀─────────────────│                  │
       │                  │                  │                  │
       │  Display Results │                  │                  │
       │◀─────────────────│                  │                  │
       │                  │                  │                  │
```

### Steps

1. **User starts evaluation** with selected dataset
2. **Portal sends** evaluation request
3. **Gateway forwards** to intelligence engine
4. **Intelligence engine** executes evaluation:
   - Loads labeled dataset
   - Executes queries using configured strategies
   - Computes 12+ IR metrics
   - Performs statistical analysis
   - Generates evaluation report
5. **Results returned** with:
   - Metric scores
   - Confidence intervals
   - Statistical significance tests
   - Distribution analysis

---

## 4. Experiment Flow (legacy v1)

The Portal's experiment planner persists `Experiment` and `ExperimentRun` rows
directly through Prisma. The flow below is the legacy v1 experiment path.

```
┌─────────────┐    ┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│   User      │    │   Portal    │    │   Gateway   │    │ Intelligence│
│   Browser   │    │   (Next.js) │    │   (Go)      │    │   (Python)  │
└──────┬──────┘    └──────┬──────┘    └──────┬──────┘    └──────┬──────┘
       │                  │                  │                  │
       │  Create Experiment│                  │                  │
       │─────────────────▶│                  │                  │
       │                  │                  │                  │
       │                  │  POST /experiment│                  │
       │                  │─────────────────▶│                  │
       │                  │                  │                  │
       │                  │                  │  gRPC: Experiment│
       │                  │                  │─────────────────▶│
       │                  │                  │                  │
       │                  │                  │                  │  Store Config
       │                  │                  │                  │─────────────────┐
       │                  │                  │                  │                  │
       │                  │                  │                  │  Run Strategies  │
       │                  │                  │                  │◀────────────────┘
       │                  │                  │                  │
       │                  │                  │                  │  Compare Results
       │                  │                  │                  │─────────────────┐
       │                  │                  │                  │                  │
       │                  │                  │                  │  Generate Report │
       │                  │                  │                  │◀────────────────┘
       │                  │                  │                  │
       │                  │                  │  Results         │
       │                  │                  │◀─────────────────│
       │                  │                  │                  │
       │                  │  Results         │                  │
       │                  │◀─────────────────│                  │
       │                  │                  │                  │
       │  Display Results │                  │                  │
       │◀─────────────────│                  │                  │
       │                  │                  │                  │
```

### Steps

1. **User creates experiment** with configuration:
   - Retrieval strategies to compare
   - Dataset to use
   - Metrics to compute
2. **Portal sends** experiment request
3. **Gateway forwards** to intelligence engine
4. **Intelligence engine** runs experiment:
   - Stores experiment configuration
   - Executes each strategy against dataset
   - Computes metrics for each strategy
   - Compares results across strategies
   - Generates comparison report
5. **Results returned** with:
   - Strategy rankings
   - Metric comparisons
   - Statistical significance
   - Recommendations

---

## 5. Knowledge Base Management Flow

```
┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│   User      │    │   Portal    │    │   PostgreSQL │
│   Browser   │    │   (Next.js) │    │   Database   │
└──────┬──────┘    └──────┬──────┘    └──────┬──────┘
       │                  │                  │
       │  Create KB       │                  │
       │─────────────────▶│                  │
       │                  │                  │
       │                  │  INSERT INTO     │
       │                  │  knowledge_bases │
       │                  │─────────────────▶│
       │                  │                  │
       │                  │  Success         │
       │                  │◀─────────────────│
       │                  │                  │
       │  KB Created      │                  │
       │◀─────────────────│                  │
       │                  │                  │
       │  List KBs        │                  │
       │─────────────────▶│                  │
       │                  │                  │
       │                  │  SELECT FROM     │
       │                  │  knowledge_bases │
       │                  │─────────────────▶│
       │                  │                  │
       │                  │  KB List         │
       │                  │◀─────────────────│
       │                  │                  │
       │  Display KBs     │                  │
       │◀─────────────────│                  │
       │                  │                  │
```

---

## 6. Streaming Response Flow (legacy v1)

The production Portal streams its own generation: the chat route runs retrieval
and LLM generation in-process and streams tokens to the browser, with no gateway
or intelligence hop. The gateway-mediated stream below is the legacy v1 flow.

```
┌─────────────┐    ┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│   User      │    │   Portal    │    │   Gateway   │    │ Intelligence│
│   Browser   │    │   (Next.js) │    │   (Go)      │    │   (Python)  │
└──────┬──────┘    └──────┬──────┘    └──────┬──────┘    └──────┬──────┘
       │                  │                  │                  │
       │  Enter Query     │                  │                  │
       │─────────────────▶│                  │                  │
       │                  │                  │                  │
       │                  │  POST /stream    │                  │
       │                  │─────────────────▶│                  │
       │                  │                  │                  │
       │                  │                  │  gRPC: Stream    │
       │                  │                  │─────────────────▶│
       │                  │                  │                  │
       │                  │                  │                  │  Start Generation
       │                  │                  │                  │
       │                  │                  │  Chunk 1         │
       │                  │                  │◀─────────────────│
       │                  │                  │                  │
       │  Chunk 1         │                  │                  │
       │◀─────────────────│                  │                  │
       │                  │                  │                  │
       │                  │                  │  Chunk 2         │
       │                  │                  │◀─────────────────│
       │                  │                  │                  │
       │  Chunk 2         │                  │                  │
       │◀─────────────────│                  │                  │
       │                  │                  │                  │
       │                  │                  │  ...             │
       │                  │                  │                  │
       │                  │                  │  Stream End      │
       │                  │                  │◀─────────────────│
       │                  │                  │                  │
       │  Stream End      │                  │                  │
       │◀─────────────────│                  │                  │
       │                  │                  │                  │
```

---

## Data Models

The dataclasses below are the legacy v1 intelligence-engine types. The
production Portal persists its data through Prisma; see
`apps/portal/prisma/schema.prisma` (`Document`, `DocumentChunk`,
`DocumentEmbedding`, `Message`, `MessageCitation`).

### RetrievalResult

```python
@dataclass
class RetrievalResult:
    chunk_id: str
    content: str
    score: float
    metadata: Dict[str, Any]
    document_id: str
    document_name: str
    chunk_index: int
```

### EvaluationResult

```python
@dataclass
class EvaluationResult:
    metric_name: str
    score: float
    confidence_interval: Tuple[float, float]
    p_value: Optional[float]
    effect_size: Optional[float]
    details: Dict[str, Any]
```

### ExperimentConfig

```python
@dataclass
class ExperimentConfig:
    name: str
    description: str
    dataset_id: str
    strategies: List[str]
    metrics: List[str]
    parameters: Dict[str, Any]
```

### PipelineTrace

```python
@dataclass
class PipelineTrace:
    query: str
    classification: ClassificationResult
    strategy_used: str
    retrieval_results: List[RetrievalResult]
    generation_result: GenerationResult
    latency_ms: float
    token_usage: TokenUsage
```
