# Pipeline Documentation

Detailed documentation of the Kairos RAG pipeline architecture and components.

---

## Overview

The Kairos pipeline transforms documents into queryable knowledge through a series of well-defined stages. Each stage is configurable, observable, and produces trace data for debugging.

```
┌─────────────┐    ┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│  Ingestion  │───▶│  Chunking   │───▶│  Embedding  │───▶│ Vector Store│
└─────────────┘    └─────────────┘    └─────────────┘    └─────────────┘
                                                                │
                                                                ▼
┌─────────────┐    ┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│  Response   │◀───│  Generation │◀───│  Retrieval  │◀───│  Query      │
│             │    │             │    │             │    │  Processing │
└─────────────┘    └─────────────┘    └─────────────┘    └─────────────┘
       │
       ▼
┌─────────────┐
│  Evaluation │
└─────────────┘
```

---

## 1. Ingestion Pipeline

The ingestion pipeline parses raw documents into structured text with metadata.

**Location:** `intelligence/ingestion/`

### Supported Formats

| Format | Parser | Notes |
|--------|--------|-------|
| PDF | PyMuPDF / pdfplumber | Extracts text, tables, images metadata |
| DOCX | python-docx | Preserves headings, lists, tables |
| TXT | Plain text | UTF-8 with auto-detection |
| Markdown | markdown-it-py | Preserves structure and metadata |
| HTML | BeautifulSoup | Strips tags, preserves content |

### Pipeline Flow

```
Raw File → Format Detection → Parser → Metadata Extraction → Text Normalization → Clean Text
```

### Metadata Extracted

- Source filename and path
- Page numbers (PDF)
- Section headings
- Creation/modification dates
- Author information (when available)
- Document structure (headings hierarchy)

---

## 2. Chunking Strategies

Chunking splits parsed documents into manageable segments for embedding and retrieval.

**Location:** `intelligence/ingestion/chunker.py`

### Available Strategies

| Strategy | Description | Best For |
|----------|-------------|----------|
| **Recursive** | Splits by paragraphs, then sentences, then characters | General purpose |
| **Sentence** | Splits at sentence boundaries using NLP | Q&A systems |
| **Fixed-Size** | Splits into fixed token counts with overlap | Consistent chunk sizes |
| **Markdown-Aware** | Respects markdown headings and code blocks | Technical documentation |
| **Semantic** | Splits at semantic boundaries using embeddings | Research papers |

### Configuration

```python
ChunkingConfig(
    strategy="recursive",      # Strategy name
    chunk_size=512,            # Target tokens per chunk
    chunk_overlap=50,          # Overlap between chunks
    min_chunk_size=100,        # Minimum chunk size
    separators=["\n\n", "\n", ". ", " "]  # Split points (recursive)
)
```

### Chunk Output

Each chunk includes:
- `chunk_id`: Unique identifier
- `content`: Text content
- `metadata`: Source document, page, section
- `token_count`: Estimated token count
- `start_offset`: Character offset in original document

---

## 3. Embedding Models

Embeddings convert text chunks into dense vector representations for similarity search.

**Location:** `intelligence/embeddings/`

### Supported Models

| Provider | Model | Dimensions | Speed |
|----------|-------|------------|-------|
| OpenAI | text-embedding-3-small | 1536 | Fast |
| OpenAI | text-embedding-3-large | 3072 | Medium |
| Cohere | embed-english-v3.0 | 1024 | Fast |
| Cohere | embed-multilingual-v3.0 | 1024 | Medium |
| Local | all-MiniLM-L6-v2 | 384 | Very Fast |
| Local | BAAI/bge-large-en-v1.5 | 1024 | Medium |

### Configuration

```python
EmbeddingConfig(
    provider="openai",           # Provider name
    model="text-embedding-3-small",  # Model identifier
    dimensions=1536,             # Vector dimensions
    batch_size=100,              # Batch processing size
    cache_enabled=True,          # Enable embedding cache
    cache_ttl=3600               # Cache TTL in seconds
)
```

### Features

- **Batching**: Processes chunks in configurable batch sizes
- **Caching**: Redis-backed cache to avoid re-embedding
- **Retry Logic**: Automatic retry with exponential backoff
- **Rate Limiting**: Respects provider rate limits

---

## 4. Query Classification

Before retrieval, queries are classified to determine optimal strategy.

**Location:** `intelligence/classifier/`

### Classification Categories

| Category | Description | Example |
|----------|-------------|---------|
| **Simple** | Direct factual question | "What is the capital of France?" |
| **Multi-Hop** | Requires connecting multiple sources | "How does X compare to Y in terms of Z?" |
| **Analytical** | Requires synthesis and reasoning | "What are the implications of X on Y?" |
| **Ambiguous** | Unclear or underspecified | "Tell me about that thing" |

### Classification Output

```json
{
  "category": "multi_hop",
  "confidence": 0.87,
  "reasoning": "Query requires connecting information from multiple documents",
  "suggested_strategies": ["hybrid_rrf", "multi_query"],
  "complexity_score": 0.72
}
```

### Strategy Selection

Based on classification, the planner selects retrieval strategies:

| Category | Primary Strategy | Fallback |
|----------|-----------------|----------|
| Simple | Vector Search | BM25 |
| Multi-Hop | Hybrid RRF | Multi-Query |
| Analytical | Multi-Query | Hybrid RRF |
| Ambiguous | Query Expansion | Vector Search |

---

## 5. Retrieval Strategies

Kairos implements 8+ retrieval strategies with a unified interface.

**Location:** `intelligence/retrieval/`

### Strategy Overview

| Strategy | Description | Latency | Quality |
|----------|-------------|---------|---------|
| **Vector Search** | Cosine similarity in embedding space | Low | Good |
| **BM25** | Lexical keyword matching | Low | Medium |
| **Hybrid RRF** | Reciprocal Rank Fusion of vector + BM25 | Medium | High |
| **Query Expansion** | LLM-generated query variations | Medium | High |
| **Multi-Query** | Multiple queries fused together | High | Very High |
| **Reranking** | Cross-encoder reranking of initial results | High | Very High |
| **Context Compression** | LLM-guided chunk summarization | Medium | High |
| **Adaptive Routing** | Dynamic strategy selection per query | Medium | Very High |

### Vector Search

```python
# Cosine similarity search in embedding space
results = vector_store.similarity_search(
    query_embedding=query_vec,
    top_k=20,
    collection="knowledge_base"
)
```

### BM25 Lexical Search

```python
# TF-IDF based keyword matching
from rank_bm25 import BM25Okapi
bm25 = BM25Okapi(tokenized_corpus)
scores = bm25.get_scores(tokenized_query)
```

### Hybrid RRF (Reciprocal Rank Fusion)

Combines multiple retrieval results using rank fusion:

```
RRF_score(d) = Σ 1 / (k + rank_i(d))
```

Where `k` is a smoothing constant (default: 60) and `rank_i(d)` is the rank of document `d` in result list `i`.

### Query Expansion

Uses LLM to generate alternative query formulations:

```python
expanded_queries = llm.generate(
    prompt=f"Generate 3 alternative queries for: {original_query}",
    count=3
)
# Merge results from all queries
```

### Multi-Query Retrieval

Generates multiple diverse queries and fuses results:

```
Original Query → [Query1, Query2, Query3] → [Results1, Results2, Results3] → RRF Fusion
```

### Reranking

Cross-encoder model reranks initial retrieval results:

```python
# Initial retrieval (top 50)
initial_results = vector_store.search(query, top_k=50)

# Rerank to top 10
reranker = CrossEncoderReranker(model="cross-encoder/ms-marco-MiniLM-L-6-v2")
final_results = reranker.rerank(query, initial_results, top_k=10)
```

### Context Compression

LLM-guided summarization of retrieved chunks:

```python
compressed = compressor.compress(
    query=query,
    chunks=retrieved_chunks,
    max_tokens=1000
)
```

### Adaptive Routing

Dynamically selects strategy based on query classification:

```python
if classification.category == "simple":
    strategy = VectorSearch()
elif classification.category == "multi_hop":
    strategy = HybridRRF()
elif classification.category == "analytical":
    strategy = MultiQuery()
```

---

## 6. Generation Pipeline

Generates responses using retrieved context with citation tracking.

**Location:** `intelligence/llm/`

### Pipeline Flow

```
Query + Retrieved Context → Prompt Construction → LLM Generation → Citation Extraction → Response
```

### Prompt Construction

```python
prompt = f"""
Answer the following question based on the provided context.

Context:
{formatted_context}

Question: {query}

Instructions:
- Answer based only on the provided context
- Cite sources using [1], [2], etc.
- If the context doesn't contain enough information, say so
"""
```

### Citation Tracking

Each response includes:
- Cited chunk IDs
- Source document references
- Page numbers (when available)
- Confidence scores per citation

### LLM Providers

| Provider | Models | Streaming |
|----------|--------|-----------|
| OpenAI | GPT-4o, GPT-4o-mini | Yes |
| Google | Gemini 2.0 Flash | Yes |
| Local | Ollama (any model) | Yes |

---

## 7. Evaluation Metrics

Kairos implements 12+ Information Retrieval metrics with statistical analysis.

**Location:** `intelligence/evaluation/`

### Standard IR Metrics

| Metric | Formula | Range |
|--------|---------|-------|
| Recall@K | \|relevant ∩ retrieved@K\| / \|relevant\| | [0, 1] |
| Precision@K | \|relevant ∩ retrieved@K\| / K | [0, 1] |
| MRR | 1/Σ rank of first relevant | [0, 1] |
| nDCG@K | DCG@K / IDCG@K | [0, 1] |
| Hit Rate | 1 if any relevant in top K | {0, 1} |
| MAP | Mean of average precision per query | [0, 1] |
| F1@K | 2 * (P@K * R@K) / (P@K + R@K) | [0, 1] |

### LLM-Judged Metrics

| Metric | Description |
|--------|-------------|
| Faithfulness | Whether answer is supported by context |
| Answer Relevance | Whether answer addresses the question |
| Context Precision | Quality of retrieved context |
| Context Recall | Coverage of relevant information |

### Statistical Analysis

For each metric, Kairos computes:

- **95% Confidence Intervals**: Bootstrap-resampled CIs
- **p-values**: Paired t-tests and Wilcoxon signed-rank tests
- **Effect Sizes**: Cohen's d and Cliff's delta
- **Distribution Analysis**: Histograms and summary statistics

### Evaluation Flow

```
Labeled Dataset → Execute Queries → Compute Metrics → Statistical Analysis → Report
```

---

## 8. Confidence Calibration

Calibrates retrieval confidence scores to improve decision making.

**Location:** `intelligence/calibration/`

### Calibration Methods

| Method | Description |
|--------|-------------|
| **Platt Scaling** | Logistic regression on confidence scores |
| **Isotonic Regression** | Non-parametric calibration |
| **Temperature Scaling** | Single parameter scaling |

### Usage

```python
calibrator = ConfidenceCalibrator(method="platt")
calibrator.fit(calibration_dataset)
calibrated_scores = calibrator.predict(raw_scores)
```

---

## 9. Experiment Tracking

Captures full experiment configurations and results for reproducibility.

**Location:** `intelligence/experiments/`

### Tracked Information

- Retrieval strategy and parameters
- Chunking configuration
- Embedding model and settings
- LLM model and parameters
- Query classification results
- Retrieval traces per query
- Evaluation metrics
- Statistical analysis

### Experiment Lifecycle

```
Configure → Execute → Evaluate → Compare → Report
    │                    │           │
    └── Store Config ────┘── Store Results ──┘
```

---

## 10. Observability

Full-stack observability across all pipeline stages.

**Location:** `intelligence/observability/`

### Metrics Collected

| Category | Metrics |
|----------|---------|
| **Ingestion** | documents_processed, chunks_created, ingestion_latency |
| **Retrieval** | queries_processed, retrieval_latency, strategy_used |
| **Generation** | tokens_used, generation_latency, model_used |
| **Evaluation** | metrics_computed, evaluation_latency |
| **System** | request_count, error_rate, memory_usage |

### Exporters

- Prometheus (primary)
- Grafana dashboards
- Structured JSON logging
- OpenTelemetry traces
