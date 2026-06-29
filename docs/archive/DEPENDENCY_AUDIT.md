# Dependency Audit

## Python Dependencies

### Production Dependencies (`requirements.txt`)

| Package | Version | Purpose | Owner | Risk |
|---------|---------|---------|-------|------|
| grpcio | >=1.62.0 | gRPC server and client | intelligence/server | Low |
| protobuf | >=4.25.0 | Protocol buffer serialization | intelligence (generated) | Low |
| dotenv | >=1.0.0 | Environment file loading | intelligence/config | Low |
| pypdf | >=4.0.0 | PDF document parsing | intelligence/ingestion | Low |
| chromadb | >=1.0.0 | Vector store database | intelligence/vectorstore | Low |
| semantic_text_splitter | >=0.14.0 | Document chunking | intelligence/ingestion | Low |
| sentence_transformers | >=3.0.0 | Embedding models and cross-encoders | intelligence/embeddings, reranker | Low |
| google-genai | >=1.0.0 | Google Gemini LLM provider | intelligence/llm, classifier | Low |
| rank_bm25 | >=0.2.0 | BM25 keyword retrieval | intelligence/retrieval | Low |
| numpy | >=1.26.0 | Numerical operations | intelligence/calibration, metrics | Low |
| openai | >=1.12.0 | OpenAI LLM provider | intelligence/llm, classifier | Low |
| pydantic | >=2.7.0 | Data validation and settings | All intelligence modules | Low |
| pydantic-settings | >=2.1.0 | Environment-based settings | intelligence/config | Low |
| fastapi | >=0.111.0 | REST API framework | intelligence/api | Low |
| uvicorn | >=0.30.0 | ASGI server | intelligence/api | Low |
| starlette | >=0.37.0 | ASGI middleware framework | intelligence/api | Low |
| scipy | >=1.12.0 | Statistical computations | intelligence/statistics | Low |
| scikit-learn | >=1.4.0 | Calibration models (Platt scaling, isotonic) | intelligence/calibration | Low |
| pandas | >=2.2.0 | Data manipulation | dashboard | Low |
| plotly | >=5.20.0 | Interactive charts | dashboard | Low |
| streamlit | >=1.35.0 | Dashboard framework | dashboard | Low |
| prometheus-client | >=0.20.0 | Metrics exposition | intelligence/metrics | Low |
| grpcio-health-checking | >=1.62.0 | gRPC health check protocol | intelligence/server | Low |

### SDK Dependencies (`sdk/keiro/pyproject.toml`)

| Package | Version | Purpose |
|---------|---------|---------|
| httpx | >=0.27.0 | Async HTTP client for API calls |
| pydantic | >=2.7.0 | Request/response model validation |

### Dependencies Added During Phase 13.6

The following packages were missing from `requirements.txt` and have been added:

| Package | Reason Added | Previously Only In |
|---------|-------------|-------------------|
| scipy | Used by `intelligence/statistics/significance.py` | Not listed anywhere |
| scikit-learn | Used by `intelligence/calibration/calibration_model.py` | Not listed anywhere |
| pandas | Used by all dashboard pages | Dockerfile only |
| plotly | Used by all dashboard pages | Dockerfile only |
| streamlit | Required by dashboard framework | Dockerfile only |
| prometheus-client | Used by `intelligence/metrics/prometheus_metrics.py` | Not listed anywhere |
| grpcio-health-checking | Used by `intelligence/server/health.py` | Not listed anywhere |

### Dependencies Removed During Phase 13.6

| Package | Reason Removed |
|---------|---------------|
| None | No unnecessary packages found in requirements.txt |

## Go Dependencies (`go.mod`)

| Module | Version | Purpose |
|--------|---------|---------|
| go-chi/chi/v5 | v5.3.0 | HTTP router |
| go-chi/cors | v1.2.2 | CORS middleware |
| google/uuid | v1.6.0 | UUID generation for trace IDs and job IDs |
| hashicorp/golang-lru/v2 | v2.0.7 | LRU cache |
| joho/godotenv | v1.5.1 | Environment file loading |
| prometheus/client_golang | v1.23.2 | Prometheus metrics |
| golang.org/x/time | v0.15.0 | Rate limiting |
| google.golang.org/grpc | v1.81.1 | gRPC client |
| google.golang.org/protobuf | v1.36.11 | Protobuf serialization |

All Go dependencies are actively used. No unused dependencies detected.

## Docker Dependencies

### Bases

| Dockerfile | Base Image |
|------------|-----------|
| intelligence.Dockerfile | python:3.11-slim |
| api.Dockerfile | python:3.11-slim |
| dashboard.Dockerfile | python:3.11-slim |
| worker.Dockerfile | python:3.11-slim |
| gateway.Dockerfile | golang:1.26-alpine (build), alpine:3.19 (runtime) |

### Service Images

| Service | Image | Version |
|---------|-------|---------|
| chromadb | chromadb/chroma | 1.0.15 |
| prometheus | prom/prometheus | v2.51.0 |
| grafana | grafana/grafana | 10.4.2 |
