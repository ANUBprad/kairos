# Kairos — Adaptive Retrieval-Augmented Generation Research Platform

**A configurable RAG experimentation platform for studying chunking strategies, embedding models, retrieval configurations, and their impact on generation quality.**

---

## Project Overview

Kairos is a production-ready research platform for systematic evaluation of Retrieval-Augmented Generation (RAG) pipelines. It provides an end-to-end workflow spanning document ingestion, chunking, embedding, retrieval, LLM generation, and quantitative evaluation — with full observability into every stage. The platform enables researchers and engineers to run controlled experiments, benchmark retrieval strategies, generate statistical reports, and make data-driven decisions about RAG pipeline configuration.

---

## Problem Statement

Large Language Models (LLMs) exhibit two fundamental limitations when used in isolation: they are restricted to knowledge captured during training, and they are prone to hallucination — generating plausible but factually incorrect information. Retrieval-Augmented Generation (RAG) addresses these limitations by retrieving relevant documents from an external knowledge base and supplying them as context during generation.

However, building an effective RAG system requires navigating a complex configuration space:

- **Chunking:** How should documents be divided? What is the optimal chunk size and overlap?
- **Embeddings:** Which embedding model provides the best semantic representation for the domain?
- **Retrieval:** Should the system use vector search, keyword search, or a hybrid approach?
- **Ranking:** How many chunks should be retrieved? Should they be re-ranked?
- **Generation:** How does retrieval quality affect the final answer's faithfulness and relevance?

Without systematic evaluation, practitioners rely on intuition and guesswork — leading to suboptimal RAG pipelines that hurt application quality. Kairos provides the tooling to answer these questions empirically.

---

## Objectives

1. Build a complete, configurable RAG pipeline with observable intermediate states at every stage
2. Implement standard Information Retrieval metrics (Recall@K, Precision@K, MRR, nDCG, Hit Rate) for quantitative evaluation
3. Provide a benchmark campaign runner for large-scale, multi-configuration experiments
4. Include statistical analysis with confidence intervals for rigorous comparison
5. Generate exportable reports in Markdown and JSON formats for academic submission
6. Offer educational content explaining RAG concepts, metrics, and algorithms
7. Serve as a reference implementation demonstrating production-grade full-stack AI engineering

---

## Key Features

| Feature | Description |
|---------|-------------|
| **Document Ingestion** | Upload PDF, DOCX, TXT, CSV, Markdown files with SHA-256 deduplication |
| **Chunking Studio** | Visual chunking with 5 strategies: recursive, sentence, fixed-size, Markdown, semantic |
| **Embedding Pipeline** | Multi-provider embeddings (OpenAI, Gemini) with pgvector storage |
| **Retrieval Lab** | Interactive retrieval testing with real-time parameter adjustment |
| **Advanced Retrieval** | BM25, Hybrid (RRF), Query Expansion, Multi-Query, Reranking strategies |
| **Explainable RAG** | View which chunks were retrieved, why they matched, and how they influenced the answer |
| **Evaluation Framework** | 10+ metrics (Recall@K, Precision@K, MRR, nDCG, Hit Rate, Faithfulness, etc.) |
| **Benchmark Campaigns** | Run multiple strategy/model/chunk combinations across datasets |
| **Statistical Analysis** | Descriptive statistics, 95% confidence intervals, distribution comparison |
| **Strategy Leaderboard** | Rank configurations by composite score with best-configuration marking |
| **Recommendation Engine** | Automated insights for precision-recall tradeoffs, latency, hallucination risk |
| **Architecture Viewer** | Interactive 10-stage pipeline visualization with educational content |
| **Research Dashboard** | Central overview of KB stats, experiments, benchmarks, and trends |
| **Report Generator** | Comprehensive Markdown + JSON export with title page, metric tables, statistical analysis, discussion |
| **Project Guide** | Complete documentation with methodology, architecture, results, and 15 viva questions |
| **RAG Chat** | Production-grade chat interface with citations, streaming, and source attribution |

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
│                                                                          │
└──────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌──────────────────────────────────────────────────────────────────────────┐
│                            DATA LAYER                                    │
│  PostgreSQL (pgvector) · Prisma ORM · Redis (queue) · Cloudinary         │
└──────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌──────────────────────────────────────────────────────────────────────────┐
│                          EXTERNAL SERVICES                               │
│  OpenAI API · Google Gemini API · Anthropic Claude API · Better Auth     │
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
| **Monitoring** | Prometheus, Grafana |
| **API Gateway** | Go (gRPC + HTTP) |
| **Python SDK** | Keiro client library for programmatic access |

---

## Project Structure

```
kairos/
├── apps/
│   └── portal/                    # Next.js web application
│       ├── prisma/                # Database schema + migrations
│       ├── public/                # Static assets
│       └── src/
│           ├── app/               # Next.js App Router pages
│           │   ├── (auth)/        # Login, signup, password reset
│           │   ├── (marketing)/   # Landing, features, pricing, docs
│           │   ├── api/           # API routes
│           │   └── app/           # Authenticated application pages
│           ├── components/        # React components
│           │   ├── app/           # Application UI components
│           │   ├── marketing/     # Marketing site components
│           │   ├── shared/        # Shared utilities (theme, scroll)
│           │   └── ui/            # Primitive UI components
│           ├── lib/               # Core business logic
│           │   ├── actions/       # Server Actions
│           │   ├── ai/            # AI service integration
│           │   ├── chunking/      # Document chunking strategies
│           │   ├── client/        # Client-side auth
│           │   ├── evaluation/    # Evaluation framework
│           │   │   ├── metrics/   # Retrieval & generation metrics
│           │   │   └── visualization/ # Chart components
│           │   ├── extraction/    # Document parsing
│           │   ├── jobs/          # Background job queue
│           │   ├── retrieval/     # Retrieval strategies & service
│           │   │   └── strategies/ # BM25, Hybrid, Reranking, etc.
│           │   ├── server/        # Server utilities (auth, org)
│           │   ├── storage/       # File storage abstraction
│           │   └── vector/        # Vector store abstraction
│           └── middleware.ts      # Next.js middleware
├── intelligence/                  # Python RAG engine
│   ├── retrieval/                 # Multi-strategy retrieval
│   ├── embeddings/                # Embedding providers
│   ├── llm/                       # LLM service layer
│   ├── evaluation/                # Evaluation metrics
│   ├── calibration/               # Confidence calibration
│   ├── feedback/                  # Feedback collection & analytics
│   ├── planner/                   # Retrieval planning & budget allocation
│   ├── judging/                   # Faithfulness & hallucination detection
│   ├── reporting/                 # Report generation
│   └── benchmarks/                # Benchmark dataset loaders
├── gateway/                       # Go API gateway
├── benchmarks/                    # Python benchmark framework
├── sdk/                           # Python SDK (keiro)
├── tests/                         # Python test suite
├── docker/                        # Docker configuration
├── docs/                          # Architecture documentation
└── proto/                         # Protobuf definitions
```

---

## Installation

### Prerequisites

- Node.js 20+
- PostgreSQL 15+ with pgvector extension
- Python 3.11+ (for intelligence engine)
- Go 1.22+ (for API gateway)

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
# Database
DATABASE_URL="postgresql://user:password@host:5432/kairos"
DIRECT_URL="postgresql://user:password@host:5432/kairos"

# Authentication
BETTER_AUTH_SECRET="your-secret-key"
BETTER_AUTH_URL="http://localhost:3000"
GITHUB_CLIENT_ID="your-github-client-id"
GITHUB_CLIENT_SECRET="your-github-client-secret"

# AI Services
OPENAI_API_KEY="sk-..."
GEMINI_API_KEY="AIza..."

# File Storage
NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME="..."
CLOUIDNARY_API_KEY="..."
CLOUDINARY_API_SECRET="..."

# Next.js
NEXT_PUBLIC_APP_URL="http://localhost:3000"
```

---

## Usage Guide

### 1. Authentication
Sign up via email/password or GitHub OAuth. The first user to sign up becomes the organization owner.

### 2. Create a Knowledge Base
Navigate to the Document Repository and create a knowledge base. This serves as the container for your documents and retrieval configuration.

### 3. Upload Documents
Upload PDF, DOCX, TXT, CSV, or Markdown files. The system automatically extracts text, detects duplicates via SHA-256 hashing, and queues them for processing.

### 4. Configure Chunking
Use the Chunking Studio to experiment with different chunking strategies, sizes, and overlap percentages. Preview how your documents will be divided.

### 5. Test Retrieval
Use the Retrieval Lab to test different retrieval configurations interactively. Compare vector search, BM25, hybrid, query expansion, and reranking strategies side by side.

### 6. Chat with your Knowledge Base
Use RAG Chat to ask questions and receive answers with citations. The Explainable RAG view shows which chunks were retrieved and why they matched.

### 7. Run Benchmarks
Create evaluation datasets with labeled questions. Run benchmarks to measure retrieval quality across multiple configurations. View results in the Evaluation Dashboard.

### 8. Generate Reports
Export comprehensive evaluation reports in Markdown and JSON formats. Reports include executive summaries, configuration matrices, metric tables, statistical analysis, and recommendations.

---

## Research Contributions

### Chunking Strategies
Five chunking strategies are implemented and compared: recursive (best general-purpose), sentence (best for factual QA), fixed-size (most predictable), Markdown (best for structured docs), and semantic (best recall for narratives). Optimal chunk size is 500-1000 tokens with 10-20% overlap.

### Hybrid Retrieval (Vector + BM25)
Combines semantic vector search with keyword-based BM25 using Reciprocal Rank Fusion (RRF). Consistently outperforms either strategy alone, achieving 80-92% Recall@K across benchmarks.

### Query Expansion
LLM-generated query variations improve recall by 5-10% at the cost of 20-30% additional latency. Most effective for complex, multi-faceted questions.

### Multi-Query Retrieval
Generates diverse semantic interpretations of a query and searches each independently. Results are merged with deduplication and score boosting for chunks retrieved by multiple variations.

### Reranking
Cross-encoder or LLM-based second-pass scoring improves Precision@K by 10-15% with marginal latency increase (50-200ms). Reorders retrieved chunks by deeper relevance assessment.

### Context Compression
Reduces retrieved context by 30-50% through deduplication, overlap merging, and redundancy trimming — lowering LLM token usage without significant quality loss.

---

## Evaluation Metrics

| Metric | Formula | Range | Interpretation |
|--------|---------|-------|----------------|
| **Recall@K** | `|Relevant ∩ Retrieved@K| / |Relevant|` | [0, 1] | Fraction of relevant docs retrieved. Higher = fewer missed docs. |
| **Precision@K** | `|Relevant ∩ Retrieved@K| / K` | [0, 1] | Fraction of retrieved docs that are relevant. Higher = less noise. |
| **Hit Rate** | `QueriesWithResults / TotalQueries` | [0, 1] | Whether the system finds anything relevant per query. |
| **MRR** | `(1/N) × Σ(1 / rank_of_first_relevant)` | [0, 1] | How quickly the first relevant result appears. Critical for QA. |
| **nDCG** | `DCG@K / IDCG@K` | [0, 1] | Ranking quality with graded relevance and position discount. |
| **Faithfulness** | `SupportedClaims / TotalClaims` | [0, 1] | Whether the answer stays consistent with retrieved context. |
| **Context Precision** | `RelevantSentences / TotalSentences` | [0, 1] | How much of the retrieved context is actually useful. |
| **Context Recall** | `InfoInContext / InfoNeeded` | [0, 1] | Whether the context contains all information needed for the answer. |

---

## Screenshots

*(Screenshots to be added)*

| Page | Description |
|------|-------------|
| Overview | Project dashboard with KB stats and recent activity |
| Chunking Studio | Visual chunk preview with strategy comparison |
| Retrieval Lab | Interactive retrieval testing with real-time metrics |
| Explainable RAG | Chunk-level retrieval explanation with similarity scores |
| Evaluation | Benchmark dashboard with radar charts and metric cards |
| Architecture Viewer | Interactive 10-stage pipeline visualization |

---

## Future Scope

- **LLM-as-Judge Evaluation:** Integrate GPT-4/Claude as automated judge for more accurate faithfulness assessment
- **Multi-Hop Retrieval:** Recursive retrieval for complex questions requiring multi-step reasoning
- **Adaptive Retrieval:** Dynamic top-K and similarity threshold adjustment based on query type
- **Cost-Aware Optimization:** Include API costs as first-class metrics in recommendations
- **Auto-Generated Datasets:** LLM-based question generation from document content
- **A/B Testing:** Live production A/B testing of retrieval configurations
- **Multi-Modal Retrieval:** Extend to images, tables, and structured data

---

## Deployment

Kairos deploys to **Vercel** (Next.js) + **Supabase** (PostgreSQL) with zero code changes.

### Quick Deploy

1. Fork the repository
2. Create a Supabase project and enable the `pgvector` extension
3. Create a Vercel project and import the repository
4. Set environment variables in Vercel (see [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md))
5. Deploy — Prisma migrations run automatically

For detailed instructions, see [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md).

---

## GitHub Topics

Suggested topics for repository discoverability:

```
rag  retrieval-augmented-generation  llm  embeddings  vector-search  
pgvector  evaluation  benchmarking  nextjs  prisma  openai  gemini  
research  ai  nlp  information-retrieval  chunking  semantic-search
```

---

## License

MIT License — see [LICENSE](LICENSE) for details.

---

## Acknowledgements

- Built with Next.js, Prisma, PostgreSQL, and pgvector
- Powered by OpenAI, Google Gemini, and Anthropic Claude APIs
- Inspired by the LlamaIndex and LangChain ecosystem
- IR metric conventions follow TREC and NIST evaluation standards
