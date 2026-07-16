# Data Flow Documentation

Detailed data flow diagrams for Kairos system operations.

---

## Overview

This document describes the data flows through the Kairos system for key operations: document upload, query execution, evaluation, and experiment management.

---

## 1. Document Upload Flow

```
┌─────────────┐    ┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│   User      │    │   Portal    │    │   Gateway   │    │ Intelligence│
│   Browser   │    │   (Next.js) │    │   (Go)      │    │   (Python)  │
└──────┬──────┘    └──────┬──────┘    └──────┬──────┘    └──────┬──────┘
       │                  │                  │                  │
       │  Upload File     │                  │                  │
       │─────────────────▶│                  │                  │
       │                  │                  │                  │
       │                  │  POST /upload    │                  │
       │                  │─────────────────▶│                  │
       │                  │                  │                  │
       │                  │                  │  gRPC: Ingest    │
       │                  │                  │─────────────────▶│
       │                  │                  │                  │
       │                  │                  │                  │  Parse Document
       │                  │                  │                  │─────────────────┐
       │                  │                  │                  │                  │
       │                  │                  │                  │  Chunk Text     │
       │                  │                  │                  │◀────────────────┘
       │                  │                  │                  │
       │                  │                  │                  │  Generate Embeddings
       │                  │                  │                  │─────────────────┐
       │                  │                  │                  │                  │
       │                  │                  │                  │  Store in ChromaDB
       │                  │                  │                  │◀────────────────┘
       │                  │                  │                  │
       │                  │                  │                  │  Store Metadata in PostgreSQL
       │                  │                  │                  │─────────────────┐
       │                  │                  │                  │                  │
       │                  │                  │  Response        │                  │
       │                  │                  │◀─────────────────│                  │
       │                  │                  │                  │                  │
       │                  │  Upload Success  │                  │                  │
       │                  │◀─────────────────│                  │                  │
       │                  │                  │                  │                  │
       │  Success Message │                  │                  │                  │
       │◀─────────────────│                  │                  │                  │
       │                  │                  │                  │                  │
```

### Steps

1. **User uploads file** via browser interface
2. **Portal validates** file type and size
3. **Gateway receives** upload request
4. **Intelligence engine** processes document:
   - Parses content based on file type
   - Splits into chunks using configured strategy
   - Generates embeddings for each chunk
   - Stores vectors in ChromaDB
   - Stores metadata in PostgreSQL
5. **Success response** returned to user

---

## 2. Query Execution Flow

```
┌─────────────┐    ┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│   User      │    │   Portal    │    │   Gateway   │    │ Intelligence│
│   Browser   │    │   (Next.js) │    │   (Go)      │    │   (Python)  │
└──────┬──────┘    └──────┬──────┘    └──────┬──────┘    └──────┬──────┘
       │                  │                  │                  │
       │  Enter Query     │                  │                  │
       │─────────────────▶│                  │                  │
       │                  │                  │                  │
       │                  │  POST /query     │                  │
       │                  │─────────────────▶│                  │
       │                  │                  │                  │
       │                  │                  │  gRPC: Query     │
       │                  │                  │─────────────────▶│
       │                  │                  │                  │
       │                  │                  │                  │  Classify Query
       │                  │                  │                  │─────────────────┐
       │                  │                  │                  │                  │
       │                  │                  │                  │  Select Strategy │
       │                  │                  │                  │◀────────────────┘
       │                  │                  │                  │
       │                  │                  │                  │  Execute Retrieval
       │                  │                  │                  │─────────────────┐
       │                  │                  │                  │                  │
       │                  │                  │                  │  Rerank Results  │
       │                  │                  │                  │◀────────────────┘
       │                  │                  │                  │
       │                  │                  │                  │  Generate Response
       │                  │                  │                  │─────────────────┐
       │                  │                  │                  │                  │
       │                  │                  │                  │  Extract Citations
       │                  │                  │                  │◀────────────────┘
       │                  │                  │                  │
       │                  │                  │  Response        │
       │                  │                  │◀─────────────────│
       │                  │                  │                  │
       │                  │  Response        │                  │
       │                  │◀─────────────────│                  │
       │                  │                  │                  │
       │  Display Response│                  │                  │
       │◀─────────────────│                  │                  │
       │                  │                  │                  │
```

### Steps

1. **User enters query** in chat interface
2. **Portal sends** query to gateway
3. **Gateway forwards** to intelligence engine via gRPC
4. **Intelligence engine** processes query:
   - Classifies query complexity
   - Selects optimal retrieval strategy
   - Executes retrieval across knowledge base
   - Reranks results using cross-encoder
   - Generates response with LLM
   - Extracts citations from response
5. **Response returned** to user with:
   - Answer text
   - Citations list
   - Pipeline trace (optional)

---

## 3. Evaluation Flow

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

## 4. Experiment Flow

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

## 6. Streaming Response Flow

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
