# Kairos Polyglot Evolution: Architectural Proposal

> **Status:** Proposal Only - No Code Changes
> **Scope:** Evolve Kairos into a production-quality polyglot AI platform
> **Constraint:** Preserve UI, UX, routing, pages, documentation, and existing APIs

---

## Table of Contents

1. Executive Summary
2. Phase 1 - Full Performance Audit
3. Phase 2 - Architectural Analysis
4. Phase 3 - Rust Candidate Identification
5. Phase 4 - Go Candidate Identification
6. Phase 5 - Integration Strategy
7. Phase 6 - Preserve Identity
8. Phase 7 - Cost vs Benefit Analysis
9. Phase 8 - Migration Plan
10. Risk Register
11. Architecture Diagrams
12. Recommendation

---

## 1. Executive Summary

Kairos is already a well-architected polyglot system: **Next.js 15 (TypeScript)** for the portal, **Go** for the API gateway, and **Python** for the intelligence engine. The existing architecture is sound and leverages each language strengths where they currently exist.

The key finding of this audit is that **the highest-impact optimizations are internal improvements to existing services, not language migrations**. The system has clear bottlenecks, but most are addressable through targeted code changes within the existing languages.

That said, there are **three specific areas** where introducing Rust would yield measurable, non-trivial gains:

1. **Document parsing pipeline** - PDF/DOCX extraction and text preprocessing
2. **BM25 index building** - Corpus-wide tokenization and scoring
3. **Semantic chunking similarity loop** - When combined with parser crate

And **two areas** where Go improvements would enhance throughput:

1. **Concurrent ingestion pipeline** - Replace the single-goroutine worker with a pool
2. **Semantic cache lookup** - Replace O(n) linear scan with approximate nearest neighbor indexing

### Recommendation Summary

| Action | Language | Expected Gain | Priority |
|--------|----------|---------------|----------|
| TypeScript-only optimizations | TS | 15-30% frontend perf | Phase A (Immediate) |
| Go ingestion concurrency | Go | 3-5x ingestion throughput | Phase B (3 months) |
| Go semantic cache ANN | Go | 10-50x cache lookup | Phase B (3 months) |
| Rust document parser crate | Rust | 5-15x parsing speed | Phase C (6 months) |
| Rust BM25 tokenizer | Rust | 3-8x indexing speed | Phase C (6 months) |

---

## 2. Phase 1 - Full Performance Audit

### 2.1 Current Architecture Overview

`
+---------------------+     +------------------+     +---------------------+
|  Next.js 15 Portal  |--> |   Go Gateway      |--> | Python Intelligence |
|  (TypeScript)       |     |   (Chi + gRPC)    |     | (gRPC server)       |
|  Port 3000          |     |   Port 8080        |     | Port 28080          |
+---------------------+     +------------------+     +---------------------+
        |                          |                          |
        v                          v                          v
   PostgreSQL               Semantic Cache              ChromaDB
   + pgvector               (in-memory LRU)            (vector store)
`

### 2.2 Bottleneck Inventory

#### Tier 1 - Critical Bottlenecks

| Bottleneck | Location | Metric | Severity |
|-----------|----------|--------|----------|
| BM25 full-corpus fetch | simple_retriever.py:21-29 | Loads ALL chunks from ChromaDB into Python memory for every query | CRITICAL |
| Semantic chunking embedding | chunker.py:49-62 | Embeds every sentence in document (N embedding calls for N sentences) | CRITICAL |
| Single-goroutine ingestion | ingestion_queue.go | Sequential processing of 254 queued jobs | HIGH |
| O(n) semantic cache scan | semantic_cache.go:56-92 | Linear scan of ALL cached embeddings per query | HIGH |

#### Tier 2 - Significant Bottlenecks

| Bottleneck | Location | Metric | Severity |
|-----------|----------|--------|----------|
| gRPC thread pool size=10 | grpc_server.py:305-306 | Only 10 concurrent gRPC handlers | MEDIUM |
| PDF text extraction | document_loader.py:7-21 | pypdf sequential page extraction | MEDIUM |
| CrossEncoder reranking | cross_encoder_reranker.py | CPU-bound model inference, no batching | MEDIUM |
| Cosine similarity (pure Python) | chunker.py:6-18 | Python loop for dot product, not vectorized | MEDIUM |
| Next.js bundle size | package.json | recharts (~400KB), framer-motion (~150KB) | MEDIUM |

#### Tier 3 - Minor

| Bottleneck | Location | Metric | Severity |
|-----------|----------|--------|----------|
| Token estimation via text.length/4 | chunking/index.ts:278-280 | Approximation, not actual tokenizer | LOW |
| In-memory job tracker (no eviction) | job_tracker.go | Memory leak under sustained load | LOW |

### 2.3 Estimated Latency Breakdown (Per RAG Query)

`
User Query
  |
  +-- ComputeEmbeddings (Python)          ~5-15ms
  +-- Semantic Cache Check (Go)            ~0.1ms (small) -> ~5-50ms (large, O(n))
  +-- ClassifyQueryType (Python)          ~200-2000ms (LLM API call)
  +-- ExecuteRetrieval (Python)
  |   +-- Dense search (ChromaDB)         ~5-20ms
  |   +-- BM25 full-corpus fetch          ~10-200ms
  |   +-- CrossEncoder reranking          ~50-500ms
  |   +-- MMR calculation                 ~1-10ms
  +-- GenerateResponse (Python)           ~500-3000ms (LLM API call)
  |
  +-- Total end-to-end                   ~800-6000ms
`

**Key observation:** LLM API calls dominate latency (60-80% of total). Local compute optimizations yield marginal total-latency improvement but significant throughput and cost reduction.

### 2.4 Memory Profile

| Component | Memory Footprint | Concern |
|-----------|-----------------|---------|
| Python intelligence engine | ~500MB-1GB (SentenceTransformer + CrossEncoder) | High baseline |
| BM25 full-corpus fetch | O(corpus_size) per query | Peak concern - unbounded |
| Semantic chunking | O(N_sentences) embeddings | Bounded by document size |
| Embedding cache | ~6MB (4096 x 384 x 4 bytes) | Negligible |
| Go gateway | ~20-50MB | Minimal |
| Next.js portal | ~100-200MB (Node.js heap) | Normal |

### 2.5 CPU Profile

| Operation | CPU Intensity | Parallelizable? |
|-----------|--------------|-----------------|
| SentenceTransformer inference | Very High | Yes (batch) |
| CrossEncoder inference | Very High | Yes (batch) |
| BM25Okapi scoring | Medium | Partially |
| Numpy MMR calculation | Low-Medium | Yes (vectorized) |
| Pure-Python cosine similarity | Low | Trivially |
| PDF text extraction | Low | Yes (per-page) |

---

## 3. Phase 2 - Architectural Analysis

### 3.1 Subsystem Language Assignment Matrix

| Subsystem | Current | Should Remain | Migration Candidate | Rationale |
|-----------|---------|---------------|-------------------|-----------|
| Portal (UI/UX) | TypeScript | TypeScript | - | React 19, Next.js 15. Rewriting destroys value. |
| Portal API Routes | TypeScript | TypeScript | - | Prisma ORM, server actions coupled to Next.js |
| Portal Chunking (preview) | TypeScript | TypeScript | - | Client-side preview only |
| Portal Extraction | TypeScript | TypeScript | - | Preview only; actual ingestion is Python |
| Portal BM25 | TypeScript | TypeScript | - | Client-side for chat RAG |
| Go Gateway HTTP | Go | Go | - | Already optimal. Chi router. |
| Go Gateway Cache | Go | Go | Improve in-place | O(n) scan to ANN index |
| Go Ingestion Queue | Go | Go | Improve in-place | Add worker pool |
| Go Middleware | Go | Go | - | Auth, rate limiting, tracing |
| Python Intelligence Engine | Python | Python (orchestration) | - | gRPC server, LLM calls |
| Python Document Parsing | Python | - | Rust (crate) | CPU-bound, native speed |
| Python BM25 Indexing | Python | - | Rust (crate) | Tokenization + scoring |
| Python Embedding | Python | Python | - | SentenceTransformer native |
| Python CrossEncoder | Python | Python | - | Model inference native |
| Python LLM Integration | Python | Python | - | HTTP client, minimal compute |
| ChromaDB | External | Keep | - | Vector store |

### 3.2 Key Architectural Decision

Kairos already has clean separation of concerns:
- **Frontend:** React/Next.js (UI, state, client logic)
- **Gateway:** Go (HTTP, auth, caching, routing)
- **Intelligence:** Python (ML models, LLM calls, retrieval)

Optimize within each boundary. Only introduce new languages where they provide measurable advantage unachievable in the existing language.

---

## 4. Phase 3 - Rust Candidate Identification

### 4.1 Document Parsing

**Current:** intelligence/ingestion/document_loader.py - pypdf for PDF, UTF-8 for text. Only PDF and plain text supported.

**Rust Opportunity:** HIGH VALUE

**Proposed Crate:** kairos-parser

Libraries:
- lopdf or pdf-extract - PDF text extraction
- docx-rs - DOCX parsing (currently unsupported!)
- pulldown-cmark - Markdown parsing
- csv - CSV parsing
- encoding_rs - Character encoding detection

Expected Speedup:

| Operation | Python | Rust | Speedup |
|-----------|--------|------|---------|
| PDF extraction (100 pages) | ~2-5s | ~0.1-0.5s | 5-10x |
| DOCX extraction | Not supported | ~0.05-0.2s | N/A |
| CSV parsing (10K rows) | ~0.5s | ~0.02s | 25x |

FFI: PyO3 bindings. Drop-in replacement for load_document().

### 4.2 Chunking

**Recommendation: Do NOT migrate.** Fixed-size already uses Rust-backed semantic_text_splitter. Semantic chunking bottleneck is embedding generation (Python SentenceTransformer), not similarity computation.

### 4.3 Tokenization

**Rust Opportunity:** HIGH VALUE (as part of BM25 crate). Unicode-aware tokenization with stemming and stop-word removal. Currently naive 	ext.lower().split().

### 4.4 Hash Generation

**No value.** Go crypto/sha256 is already native-speed.

### 4.5 Embedding Batching

**No value.** SentenceTransformer handles batching natively.

### 4.6 BM25 Implementation

**Current:** simple_retriever.py - Loads ALL chunks from ChromaDB into Python memory for EVERY query. Naive tokenization.

**Rust Opportunity:** VERY HIGH VALUE

**Proposed Crate:** kairos-bm25

Key Improvements:
1. Persistent index - Build once, query many (currently rebuilds per query!)
2. Incremental updates - Add/remove without full rebuild
3. Proper tokenization - Unicode-aware, stemmed
4. Memory-mapped index - No full corpus load

Expected Speedup:

| Operation | Python | Rust | Speedup |
|-----------|--------|------|---------|
| BM25 index build (10K docs) | ~2-5s (per query!) | ~0.3s (once) | ~15x amortized |
| BM25 query scoring | ~50-200ms | ~1-5ms | ~40x |
| Tokenization | ~10ms | ~0.5ms | ~20x |
| Memory usage | O(corpus) per query | O(1) after build | Unbounded to Bounded |

### 4.7 Summary of Rust Candidates

| Candidate | Crate | Value | Complexity | Speedup |
|-----------|-------|-------|------------|---------|
| Document parsing | kairos-parser | Very High | Medium | 5-25x |
| BM25 tokenizer + index | kairos-bm25 | Very High | High | 15-40x |
| Semantic chunking | (skip) | Low | Low | 1.5x |
| Hash generation | (skip) | None | - | 1x |

---

## 5. Phase 4 - Go Candidate Identification

### 5.1 Ingestion Pipeline Concurrency

**Current:** Single consumer goroutine, buffered channel (254), sequential processing.

**Opportunity:** VERY HIGH VALUE

Replace with worker pool (configurable N, default runtime.NumCPU()):
- sync.WaitGroup for graceful shutdown
- Job priority queue
- Job timeout and retry
- TTL-based job eviction

Expected Gains:

| Metric | Current | Worker Pool (4) | Gain |
|--------|---------|-----------------|------|
| Throughput (docs/min) | ~6-12 | ~24-48 | 4x |
| Time-to-first-doc | ~5-10s | ~1-3s | 3x |
| Memory (job tracker) | Unbounded | TTL-evicted | Bounded |

### 5.2 Semantic Cache Optimization

**Current:** O(n) linear scan via Keys() + iterate cosine similarity.

**Opportunity:** HIGH VALUE

Replace with HNSW (Hierarchical Navigable Small World) index.

| Metric | Linear | HNSW | Gain |
|--------|--------|------|------|
| Cache lookup (1K) | ~1-5ms | ~0.1-0.5ms | 10x |
| Cache lookup (10K) | ~10-50ms | ~0.2-1ms | 50x |
| Cache lookup (100K) | ~100-500ms | ~0.5-2ms | 250x |

### 5.3 Job Tracker Persistence

Medium value. Add TTL-based eviction. Optional Redis for crash recovery.

### 5.4 Summary of Go Candidates

| Candidate | Location | Value | Complexity | Gain |
|-----------|----------|-------|------------|------|
| Ingestion worker pool | queue/ | Very High | Medium | 3-5x throughput |
| Semantic cache ANN | cache/ | High | High | 10-50x lookup |
| Job tracker eviction | queue/ | Medium | Low | Memory bounded |

---

## 6. Phase 5 - Integration Strategy

### 6.1 Current Communication

`
Next.js 15 --HTTP/SSE--> Go Gateway --gRPC--> Python Intelligence
     |                                           |
     | Prisma ORM                           gRPC |
     v                                           v
 PostgreSQL                                ChromaDB
`

### 6.2 Proposed Communication (After Migration)

Same topology. No new services. Rust crates loaded via PyO3 FFI (in-process, zero network overhead).

| Path | Protocol | Change? |
|------|----------|---------|
| Portal to Gateway | HTTP/SSE | No change |
| Gateway to Intelligence | gRPC | No change |
| Intelligence to ChromaDB | HTTP | No change |
| Intelligence to Rust | FFI (PyO3) | NEW - in-process |
| Intelligence to LLM | HTTPS | No change |
| Portal to PostgreSQL | TCP (Prisma) | No change |

### 6.3 Why NOT New Services

Adding separate Rust/Go services for FFI-callable work adds network latency, deployment complexity, and operational overhead for zero benefit. PyO3 FFI calls are ~1000x faster than gRPC.

### 6.4 Deployment Impact

**Current:** 8 Docker Compose services.
**After:** Same 8 services. Rust crates compiled into the Python intelligence container. No new images, ports, or health checks.

---

## 7. Phase 6 - Preserve Identity

### 7.1 Unchanged Elements

| Element | Why |
|---------|-----|
| All React components | Core UI identity |
| All pages and routing | User-facing routes |
| All API routes | Existing API contracts |
| Prisma schema + migrations | Database schema |
| All CSS/Tailwind styles | Visual identity |
| Marketing pages | Public-facing |
| Server actions | Frontend-backend bridge |
| gRPC proto definition | Service contract |
| Go gateway HTTP endpoints | External API surface |
| Go gateway middleware | Auth, rate limiting |
| Next.js configuration | Build config |
| Docker Compose definitions | Deployment topology |
| Documentation | User-facing docs |
| Examples | Developer examples |

### 7.2 User Experience

Users should notice ONLY:
1. Faster document upload and processing
2. Support for more formats (DOCX, CSV, Markdown via Rust parser)
3. Better BM25 search quality

Users should NEVER notice different URLs, UI components, API responses, error messages, or deployment processes.

---

## 8. Phase 7 - Cost vs Benefit Analysis

### 8.1 TypeScript Optimizations (Phase A)

| Factor | Assessment |
|--------|-----------|
| Complexity | Low - config and import changes |
| Maintenance cost | None |
| Deployment impact | None |
| Performance gain | 15-30% smaller bundles, faster hydration |
| Memory reduction | ~20-50MB smaller client bundles |
| Worth it? | YES - High ROI, zero risk |

### 8.2 Go Worker Pool (Phase B)

| Factor | Assessment |
|--------|-----------|
| Complexity | Medium - rewrite queue consumer |
| Maintenance cost | Low - standard Go patterns |
| Deployment impact | None |
| Performance gain | 3-5x ingestion throughput |
| Worth it? | YES - High ROI, moderate effort |

### 8.3 Go HNSW Cache (Phase B)

| Factor | Assessment |
|--------|-----------|
| Complexity | High - HNSW implementation |
| Maintenance cost | Medium |
| Deployment impact | None |
| Performance gain | 10-50x cache lookup |
| Worth it? | YES for production scale, NO for showcase |

### 8.4 Rust Parser (Phase C)

| Factor | Assessment |
|--------|-----------|
| Complexity | Medium - PyO3 FFI, new crate |
| Maintenance cost | Medium - Rust toolchain |
| Deployment impact | Low - add Rust build step |
| Performance gain | 5-25x parsing speed + DOCX support |
| Worth it? | YES - adds real value (DOCX support) |

### 8.5 Rust BM25 (Phase C)

| Factor | Assessment |
|--------|-----------|
| Complexity | High - Persistent index, PyO3 |
| Maintenance cost | Medium |
| Deployment impact | Low - add Rust build step |
| Performance gain | 15-40x BM25 speed, bounded memory |
| Memory reduction | Critical - eliminates O(corpus) per query |
| Worth it? | YES - Highest-value Rust migration |

### 8.6 Overall Matrix

| Migration | ROI | Risk | Effort | Recommendation |
|-----------|-----|------|--------|----------------|
| TS bundle optimization | 10/10 | 1/10 | 1/10 | Implement immediately |
| Go worker pool | 8/10 | 3/10 | 4/10 | Implement in Phase B |
| Go HNSW cache | 6/10 | 5/10 | 6/10 | If scaling beyond 10K queries/day |
| Rust parser crate | 5/10 | 4/10 | 5/10 | Implement in Phase C |
| Rust BM25 crate | 7/10 | 5/10 | 7/10 | Implement in Phase C |

---

## 9. Phase 8 - Migration Plan

### Phase A - TypeScript Optimizations (Week 1-2)

1. Dynamic imports for recharts (saves ~400KB)
2. Dynamic imports for framer-motion (saves ~150KB)
3. Route-level code splitting with loading.tsx
4. Static generation for marketing pages
5. Font optimization via next/font

Testing: Lighthouse before/after. Target: 90+ Performance score.
Rollback: One-line revert per change. Zero risk.

### Phase B - Go Improvements (Month 1-3)

1. Ingestion Worker Pool (Month 1-2)
   - Rewrite ingestion_queue.go with WorkerPool
   - Add job priority, timeout, retry, TTL eviction
   - Add Prometheus pool utilization metrics

2. Semantic Cache HNSW (Month 2-3)
   - Integrate or implement HNSW
   - Replace Get() linear scan with ANN lookup
   - Keep existing Set() API

Testing: 1000 concurrent ingestion requests. Target: 4x throughput.
Rollback: Backward-compatible. Toggle via config.

### Phase C - Rust Crates (Month 3-6)

1. kairos-parser (Month 3-4)
   - PDF via lopdf, DOCX via docx-rs, CSV via csv, Markdown via pulldown-cmark
   - PyO3 bindings via maturin
   - Drop-in for load_document()

2. kairos-bm25 (Month 4-6)
   - Persistent BM25 index with incremental updates
   - Unicode-aware tokenizer with stemming
   - Memory-mapped file persistence
   - PyO3 bindings via maturin
   - Replace rank_bm25.BM25Okapi

Testing: 100-page PDF benchmark (target: 5x+ speedup). 10K doc BM25 benchmark (target: 15x+ speedup).
Rollback: Additive. Python falls back to pypdf/rank_bm25.

### Phase D - Future Scalability (Month 6+)

Optional: Redis cache persistence, pgvector migration, horizontal scaling, streaming RAG, multi-tenancy.

---

## 10. Risk Register

| Risk | Probability | Impact | Mitigation |
|------|------------|--------|-----------|
| PyO3 breaks on Python upgrade | Medium | High | Pin Python version; test on upgrade |
| Rust build increases Docker time | High | Low | Multi-stage builds; cache deps |
| HNSW has higher memory | Medium | Low | Make optional; fall back to linear |
| Worker pool exhausts gRPC | Low | High | Connection pooling; limit workers |
| BM25 index corruption | Low | High | Write-ahead log; periodic snapshots |
| Rust crate vulnerabilities | Low | High | cargo audit; pin versions |

---

## 11. Architecture Diagrams

### Current State

`
                        +-------------------+
                        |    User Browser   |
                        +--------+----------+
                                 |
                          HTTP / SSE
                                 |
                        +--------v----------+
                        |   Next.js 15      |
                        |   Portal (:3000)  |
                        +--------+----------+
                                 |
              +------------------+------------------+
              |                                     |
    +---------v---------+              +-----------v-----------+
    |   PostgreSQL       |              |    Go Gateway (:8080) |
    |   + pgvector       |              |    - Chi Router       |
    +-------------------+              |    - Auth, Rate Limit |
                                       |    - Semantic Cache   |
                                       |    - Ingestion Queue  |
                                       +-----------+-----------+
                                                   |
                                              gRPC (5 RPCs)
                                                   |
                                       +-----------v-----------+
                                       | Python Intelligence   |
                                       | Engine (:28080)       |
                                       +-----------+-----------+
                                                   |
                                    +--------------+--------------+
                                    |                             |
                           +--------v--------+          +--------v--------+
                           |    ChromaDB      |          | LLM Providers   |
                           +-----------------+          +-----------------+
`

### Target State

`
                        +-------------------+
                        |    User Browser   |
                        +--------+----------+
                                 |
                        +--------v----------+
                        |   Next.js 15      |  [Phase A: Optimized]
                        |   Portal (:3000)  |  Dynamic imports, code splitting
                        +--------+----------+
                                 |
              +------------------+------------------+
              |                                     |
    +---------v---------+              +-----------v-----------+
    |   PostgreSQL       |              |    Go Gateway (:8080) |
    |   + pgvector       |              |    [Phase B: Enhanced] |
    +-------------------+              |    Worker Pool (4-8)   |
                                       |    HNSW Cache Index    |
                                       +-----------+-----------+
                                                   |
                                              gRPC (5 RPCs)
                                                   |
                                       +-----------v-----------+
                                       | Python Intelligence   |  [Phase C: Rust FFI]
                                       | Engine (:28080)       |
                                       | kairos-parser (FFI)   |
                                       | kairos-bm25 (FFI)     |
                                       +-----------+-----------+
                                                   |
                                    +--------------+--------------+
                                    |                             |
                           +--------v--------+          +--------v--------+
                           |    ChromaDB      |          | LLM Providers   |
                           +-----------------+          +-----------------+
`

---

## 12. Recommendation

### For an Open-Source Showcase Project

- **Phase A (TS optimizations):** Implement. Zero risk, immediate improvement.
- **Phase B (Go improvements):** Implement worker pool. HNSW optional.
- **Phase C (Rust crates):** Implement kairos-parser for DOCX story. kairos-bm25 only if benchmarking shows need.
- **Phase D (Future):** Skip.

### For a Production System

Implement all phases. Rust BM25 alone prevents OOM crashes under large corpus loads.

### Non-Negotiables

1. The UI must never change
2. The API surface must never change
3. Deployment stays simple (Docker Compose)
4. Rust crates are FFI, not separate services
5. All changes backward-compatible

---

> Generated by architectural analysis of the Kairos codebase.
> No code was modified. No files were changed.
> This is a proposal only.
