# Kairos — An Explainable RAG Research Workbench

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

## System Architecture

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
│  PostgreSQL (pgvector) · Prisma ORM · Redis (queue) · Cloudinary         │
└──────────────────────────────────────────────────────────────────────────┘
```

---

## Technology Stack

| Layer | Technologies |
|-------|-------------|
| **Frontend** | Next.js 15 (App Router), React 19, TypeScript, Tailwind CSS v4, Lucide React, Framer Motion |
| **Backend** | Next.js Server Actions, Prisma ORM, PostgreSQL (Aiven), pgvector |
| **AI Services** | OpenAI (GPT-4o, GPT-4o-mini, text-embedding-3-small/large), Google Gemini (2.0 Flash, embedding-004), Anthropic Claude |
| **Authentication** | Better Auth (email/password + GitHub OAuth) |
| **File Storage** | Cloudinary |
| **Deployment** | Vercel (Next.js), Docker, Supabase (PostgreSQL) |

---

## Installation

### Prerequisites

- Node.js 20+
- PostgreSQL 15+ with pgvector extension

### Setup

```bash
# Clone the repository
git clone https://github.com/your-org/kairos.git
cd kairos

# Install portal dependencies
cd apps/portal
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

## License

MIT License — see [LICENSE](LICENSE) for details.
