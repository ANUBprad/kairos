# Release Notes — Kairos v1.0.0-rc1

**Release Date:** 2026-07-18  
**Release Candidate:** RC1

---

## Highlights

Kairos v1.0.0-rc1 is the first production-ready release candidate. This release focuses on reliability, performance, security, and deployment quality — making Kairos suitable for self-hosted production deployments.

### Production Readiness (Phase A + B)

- **Persistent BM25 Index** — Build-once, query-many pattern eliminates per-query corpus loading
- **Worker Pool** — Configurable concurrent ingestion workers with exponential backoff retry
- **Retrieval Cache** — LRU cache with TTL, namespace isolation, and Prometheus metrics
- **Streaming Loader** — Bounded-memory PDF/text processing with cancellation support
- **Upload Validation** — Magic-byte MIME detection, PDF bomb detection, path traversal prevention
- **Structured Logging** — JSON logs with correlation IDs for distributed tracing
- **OpenTelemetry Bridge** — OTLP-compatible tracing with structured logging fallback
- **17 New Prometheus Metrics** — Per-stage ingestion timing, cache hit ratios, connection counts
- **Multi-stage Docker Builds** — 25-98% image size reduction across all services
- **Resource Limits** — CPU and memory limits on all Docker Compose services

### Security

- Magic-byte MIME detection (not trusting client Content-Type headers)
- PDF bomb detection (>10,000 pages rejected)
- Path traversal prevention in filename sanitization
- File size limits (configurable, default 50MB)
- Rate limiting per namespace
- Constant-time auth comparison (timing attack prevention)
- SQL injection prevention in vector store queries
- Error message sanitization (no information leakage)

### Testing

- 275+ automated tests
- Integration tests for document loading, caching, BM25, chunking, pipelines
- Stress tests for concurrent BM25 access, cache contention, thread safety
- Parser regression tests for edge cases
- Memory pressure tests for large corpora

---

## Breaking Changes

None. This release is fully backward-compatible with RC-2.

---

## Known Limitations

- BM25 full-corpus rebuild on corpus version change (could be incremental)
- Semantic chunker uses O(n²) cosine similarity (could be vectorized)
- ComplexRetriever makes 3 LLM calls per query (could cache)
- ChromaDB is single-node (no horizontal scaling)
- OpenTelemetry bridge created but not wired into Go gateway

---

## Upgrade Path

From RC-2:

```bash
git pull origin main
docker compose build
docker compose up -d
```

---

## Contributors

- @ANUBprad — Core architecture, intelligence engine, gateway, frontend

---

## License

MIT License
