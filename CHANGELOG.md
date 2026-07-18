# Changelog

All notable changes to the Kairos project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

## [1.0.0-rc1] - 2026-07-18

### Added
- Persistent BM25 inverted index (build-once, query-many)
- Worker pool for concurrent ingestion (configurable workers, exponential backoff)
- LRU retrieval cache with TTL, namespace invalidation, and Prometheus metrics
- Streaming document loader with bounded memory and cancellation support
- Upload validation with magic-byte MIME detection and PDF bomb detection
- Structured JSON logging with correlation IDs
- OpenTelemetry tracing bridge with structured logging fallback
- Request context propagation (trace ID, namespace, user agent)
- 17 new Prometheus metrics (ingestion timing, cache ratios, connection counts)
- Multi-stage Docker builds for all Python services (25-98% image reduction)
- Resource limits on all Docker Compose services
- Health checks with startup probes on all services
- Distroless runtime for Go gateway
- Integration tests (29 tests covering ingestion, caching, BM25, chunking, pipelines)
- Stress tests (10 tests covering concurrent access, memory pressure, thread safety)
- Load testing suite (10/25/50/100 concurrent users with markdown/JSON reports)
- Memory profiling suite (leak detection, allocation analysis, thread safety)
- RAG evaluation framework (BM25 vs Dense vs Hybrid with Recall/Precision/MRR/nDCG)
- CODEOWNERS file
- RELEASE_NOTES.md
- Showcase-quality README with Mermaid diagrams, badges, deployment guide

### Fixed
- BM25 per-query corpus loading replaced with persistent index
- Ingestion pipeline now records per-stage timing
- Go gateway graceful shutdown now stops worker pool before HTTP server
- Job tracker TTL eviction prevents memory leaks from completed jobs

### Changed
- Docker images reduced from ~2GB to ~1.5GB (Python) and ~800MB to ~15MB (Go)
- All Docker services now have CPU and memory resource limits
- All Docker services now have health checks with appropriate intervals
- Ingestion queue now supports configurable worker count (default 4)
- Ingestion jobs now retry up to 3 times with exponential backoff
- Error messages sanitized to prevent information leakage
- Python cache bytecode disabled in Docker images (PYTHONDONTWRITEBYTECODE=1)

## [Unreleased]

### Added
- Email + password authentication alongside GitHub OAuth
- Forgot password and email verification flows
- Regional pricing with currency detection
- Session persistence fixes for Vercel serverless

### Fixed
- Middleware cookie name mismatch causing 401 on `/app`
- Open redirect vulnerability in login flow
- Layout crash on auth failure (missing try/catch)
- SQL injection in vector store knowledge base queries
- Error message leakage in Go gateway and Python gRPC
- CORS configuration now environment-driven
- Rate limiter instantiated once per namespace (data race fix)
- Unsafe Go type assertions replaced with comma-ok pattern
- Auth timing attack via constant-time comparison
- Prisma transactions for multi-step document operations

### Changed
- Branded from Keiro to Kairos across entire codebase
- Python API CORS default changed from `["*"]` to `[]`
- Middleware checks multiple cookie name candidates for production compatibility

## [RC-2] - 2026-07-14

### Fixed
- Production auth session persistence
- Go gateway data race in query handler
- IDOR in conversation title update
- Prisma transaction wrapping for document uploads

### Changed
- All error messages sanitized to prevent information leakage

## [RC-1] - 2026-07-13

### Added
- Full security audit and hardening
- Rate limiting on all API routes
- Input validation across all endpoints
- HTTP security headers (CSP, HSTS, Permissions-Policy)
- Error sanitization middleware

### Fixed
- Vercel deployment configuration
- CSP blocking inline scripts
- Build failures from module-level side effects

## [0.1.0] - 2026-07-01

### Added
- Initial repository setup
- Next.js 15 portal with App Router
- Python intelligence engine with gRPC
- Go HTTP gateway
- Prisma schema with PostgreSQL
- BetterAuth with GitHub OAuth
- Document upload and processing pipeline
- RAG chat with citations
- Retrieval debugger
- Chunking studio
- Benchmark campaigns
- Research intelligence engine
