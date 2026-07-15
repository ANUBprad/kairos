# Changelog

All notable changes to the Kairos project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

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
