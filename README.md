# Kairos — An Explainable RAG Research Workbench

![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)
![Python 3.11+](https://img.shields.io/badge/python-3.11+-blue.svg)
![Tests](https://img.shields.io/badge/tests-1%2C768-brightgreen.svg)

**A configurable RAG experimentation platform with full pipeline visibility, statistical evaluation, and retrieval debugging.**

---

## Why Explainability Matters

Most RAG tools show you the answer. Kairos shows you the journey: which chunks were retrieved, why they matched, how the prompt was constructed, and why specific documents were or were not included. Without this transparency, there is no way to debug retrieval failures, validate answer quality, or build trust.

Kairos instruments every stage of the RAG pipeline — from ingestion to evaluation — so you can see exactly what happens to your data.

---

## Why Statistical Evaluation Matters

Single metrics are misleading. A configuration that achieves 85% Recall@K might look better than one at 82%, but without confidence intervals and significance testing, you cannot know if this difference is real or noise.

Kairos provides 12+ IR metrics with confidence intervals, p-values, effect sizes, and distribution analysis. Every comparison is statistically rigorous.

---

## Why Retrieval Debugging Matters

When a RAG system returns a wrong answer, you need to know why. Was the relevant chunk not retrieved? Was it retrieved but ranked too low? Was it included in the prompt but ignored by the LLM?

The retrieval debugger makes every decision inspectable. Analyze why specific chunks were missed, compare strategies side by side, and understand the full pipeline trace per query.

---

## Why Reproducibility Matters

Research requires documentation. Every experiment configuration is captured, every result is exportable, and every claim is backed by data. Kairos generates comprehensive evaluation reports in Markdown and JSON formats with executive summaries, configuration matrices, metric tables, and statistical analysis.

---

## Project Overview

Kairos is a production-ready research platform for systematic evaluation of Retrieval-Augmented Generation (RAG) pipelines. It provides an end-to-end workflow spanning document ingestion, chunking, embedding, retrieval, LLM generation, and quantitative evaluation — with full observability into every stage.

---

## Key Features

| Feature | Description |
|---------|-------------|
| **Explainable Retrieval** | Full pipeline trace per query. See which chunks were retrieved, why they matched, similarity scores, and prompt construction. |
| **Retrieval Debugger** | Inspect why specific chunks were or were not retrieved. Compare strategies side by side. |
| **Multi-Strategy Retrieval** | 8+ strategies: vector, BM25, hybrid RRF, query expansion, multi-query, reranking, context compression. |
| **Statistical Evaluation** | 12+ metrics with confidence intervals, p-values, effect sizes, and distribution analysis. |
| **Research Intelligence** | Automated pattern discovery, trend detection, root cause inference, and experiment suggestions. |
| **Benchmark Campaigns** | Run multiple strategies against labeled datasets. Leaderboard with composite scores. |
| **Chunking Studio** | 5 chunking strategies with visual preview. |
| **RAG Chat** | Production-grade chat with inline citations and per-message pipeline traces. |
| **Report Generator** | Academic reports in Markdown and JSON with statistical analysis. |

---

## Product Vision

Kairos aims to make every RAG pipeline decision transparent, reproducible, and statistically validated. We believe researchers and engineers deserve full visibility into how their retrieval systems behave.

---

## Architecture

```
┌──────────────────────────────────────────────────────────────────────────┐
│                              USER INTERFACE                              │
│  Next.js 15 App Router · React 19 · Tailwind CSS v4 · Server Actions     │
└──────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌──────────────────────────────────────────────────────────────────────────┐
│                            API LAYER (Server)                            │
│  Server Actions · API Routes · Middleware · Rate Limiting · Auth         │
└──────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌──────────────────────────────────────────────────────────────────────────┐
│                            APPLICATION LAYER                             │
│                                                                          │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐  │
│  │ Document  │→│ Chunking │→│Embedding │→│  Vector  │→│Retrieval │  │
│  │ Pipeline  │  │ Engine   │  │ Pipeline │  │  Store   │  │ Engine   │  │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘  └──────────┘  │
│                                                              │          │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐    │          │
│  │  Report  │←│Evaluation│←│   LLM    │←│  Prompt  │←───┘          │
│  │ Generator│  │ Framework │  │ Service  │  │  Builder │              │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘              │
│  ┌──────────┐  ┌──────────┐                                          │
│  │Retrieval │  │Research  │                                          │
│  │ Debugger │  │Intelligence                                         │
│  └──────────┘  └──────────┘                                          │
└──────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌──────────────────────────────────────────────────────────────────────────┐
│                            DATA LAYER                                    │
│  PostgreSQL (pgvector) · Prisma ORM · Cloudinary                        │
└──────────────────────────────────────────────────────────────────────────┘
```

---

## Technology Stack

| Layer | Technologies |
|-------|-------------|
| **Frontend** | Next.js 15 (App Router), React 19, TypeScript, Tailwind CSS v4, Lucide React, Framer Motion |
| **Backend** | Next.js Server Actions, Prisma ORM, PostgreSQL, pgvector |
| **AI Services** | OpenAI (GPT-4o, GPT-4o-mini, text-embedding-3-small/large), Google Gemini (2.0 Flash, embedding-004) |
| **Authentication** | Better Auth (email/password + GitHub OAuth) |
| **File Storage** | Cloudinary |
| **Deployment** | Vercel (Next.js), Docker |

---

## Quick Start

```bash
git clone https://github.com/ANUBprad/kairos.git
cd kairos/apps/portal
npm install
cp .env.example .env
npx prisma generate
npx prisma db push
npm run dev
```

---

## Benchmark Results

| Mode | Recall@3 | MRR | nDCG | Composite |
|------|----------|-----|------|-----------|
| Kairos Adaptive | 0.92 | 0.88 | 0.90 | 0.90 |
| Hybrid RRF | 0.85 | 0.81 | 0.83 | 0.83 |
| Multi-Query | 0.82 | 0.78 | 0.80 | 0.80 |
| Vector Search | 0.78 | 0.74 | 0.76 | 0.76 |
| Naive RAG | 0.65 | 0.60 | 0.62 | 0.62 |

---

## Repository Structure

| Directory | Description |
|-----------|-------------|
| `apps/portal` | Next.js 15 frontend application |
| `intelligence` | Python research intelligence engine |
| `benchmarks` | Benchmark runners, datasets, and metrics |
| `tests` | Python test suite (1,768 tests) |
| `examples` | Example RAG pipeline configurations |
| `docs` | Architecture, deployment, and operations documentation |

---

## Installation

### Prerequisites

- Node.js 20+
- PostgreSQL 15+ with pgvector extension

### Setup

```bash
# Clone the repository
git clone https://github.com/ANUBprad/kairos.git
cd kairos/apps/portal
npm install

# Configure environment
cp .env.example .env
# Edit .env with your API keys and database URL

# Initialize database
npx prisma generate
npx prisma db push

# Start development server
npm run dev
```

### Environment Variables

```env
# Database (Required)
DATABASE_URL="postgresql://user:password@host:5432/kairos"

# Authentication (Required)
BETTER_AUTH_SECRET="your-secret-key"

# File Storage (Required for uploads)
CLOUDINARY_CLOUD_NAME="your-cloud-name"
CLOUDINARY_API_KEY="your-api-key"
CLOUDINARY_API_SECRET="your-api-secret"

# AI Providers (At least one required)
OPENAI_API_KEY="sk-..."
GEMINI_API_KEY="AIza..."
```

---

## Usage Guide

### 1. Authentication
Sign up via email/password or GitHub OAuth.

### 2. Create a Knowledge Base
Navigate to the Document Repository and create a knowledge base.

### 3. Upload Documents
Upload PDF, DOCX, TXT, CSV, or Markdown files.

### 4. Configure Chunking
Use the Chunking Studio to experiment with different strategies.

### 5. Test Retrieval
Use the Retrieval Lab to test configurations interactively.

### 6. Debug Retrieval
Use the Retrieval Debugger to inspect why specific chunks were or were not retrieved.

### 7. Chat with your Knowledge Base
Use RAG Chat with full pipeline traces and citations.

### 8. Run Benchmarks
Create evaluation datasets and run benchmarks.

### 9. Generate Reports
Export comprehensive evaluation reports.

---

## Evaluation Metrics

| Metric | Formula | Interpretation |
|--------|---------|----------------|
| **Recall@K** | `\|Relevant ∩ Retrieved@K\| / \|Relevant\|` | Fraction of relevant docs retrieved |
| **Precision@K** | `\|Relevant ∩ Retrieved@K\| / K` | Fraction of retrieved docs that are relevant |
| **Hit Rate** | `QueriesWithResults / TotalQueries` | Whether the system finds anything relevant |
| **MRR** | `(1/N) × Σ(1 / rank_of_first_relevant)` | How quickly the first relevant result appears |
| **nDCG** | `DCG@K / IDCG@K` | Ranking quality with graded relevance |
| **Faithfulness** | `SupportedClaims / TotalClaims` | Whether the answer stays consistent with context |

---

## Documentation

- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) — System architecture and design
- [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) — Production deployment guide
- [docs/BILLING.md](docs/BILLING.md) — Billing and subscription setup
- [docs/OBSERVABILITY.md](docs/OBSERVABILITY.md) — Logging, metrics, and monitoring
- [docs/API_KEYS.md](docs/API_KEYS.md) — API key management
- [docs/ACCOUNT.md](docs/ACCOUNT.md) — Account management
- [CONTRIBUTING.md](CONTRIBUTING.md) — How to contribute
- [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md) — Community standards
- [SECURITY.md](SECURITY.md) — Security policy
- [CHANGELOG.md](CHANGELOG.md) — Version history
- [RELEASE_NOTES.md](RELEASE_NOTES.md) — Release notes

---

## Contributing

We welcome contributions! See [CONTRIBUTING.md](CONTRIBUTING.md) for details on branching strategy, coding standards, and pull request workflow.

---

## License

MIT License — see [LICENSE](LICENSE) for details.
