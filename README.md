# 🧠 Kairos — An Explainable RAG Research Workbench

![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)
![Build Status](https://img.shields.io/badge/build-passing-brightgreen.svg)
![Python 3.11+](https://img.shields.io/badge/python-3.11+-blue.svg)
![Go 1.22+](https://img.shields.io/badge/go-1.22+-00ADD8.svg)
![Node.js 20+](https://img.shields.io/badge/node.js-20+-339933.svg)
![Tests](https://img.shields.io/badge/tests-1%2C768-brightgreen.svg)

> **Enterprise-grade AI platform for systematic RAG experimentation, evaluation, and research.**

[//]: # (TODO: Add screenshot placeholders)

---

## What is Kairos?

Kairos is an open-source research workbench for **Retrieval-Augmented Generation** (RAG) pipelines. It provides end-to-end pipeline visibility across ingestion, chunking, embedding, retrieval, generation, and evaluation — with statistical rigor at every stage.

### Why Kairos?

Most RAG tools give you a black box. Kairos gives you full transparency:

- **Every query decision is inspectable** — trace retrieval strategies, chunk selection, and generation inputs
- **Statistical rigor** — 12+ IR metrics with confidence intervals, p-values, and effect sizes
- **Reproducible experiments** — run multiple strategies against labeled datasets with full configuration capture
- **Production architecture** — not a notebook, not a demo — a real platform with PostgreSQL, gRPC, and Prometheus

---

## 🏗️ Architecture

[//]: # (TODO: Add architecture diagram placeholder)

```
┌─────────────────────────────────────────────────────────────────┐
│                        Next.js 15 Portal                        │
│  React 19 · TypeScript · Tailwind v4 · Framer Motion · Recharts │
└──────────┬──────────────────────────────────────────┬────────────┘
           │ REST                                     │ gRPC
           ▼                                          ▼
┌──────────────────┐                    ┌──────────────────────┐
│   Go 1.22 API    │                    │   Python 3.11+       │
│   Gateway        │◄──────────────────►│   Intelligence       │
│   (Chi Router)   │                    │   Engine (FastAPI)   │
└────────┬─────────┘                    └──────────┬───────────┘
         │                                         │
         ▼                                         ▼
┌──────────────────┐                    ┌──────────────────────┐
│   PostgreSQL 15  │                    │   ChromaDB           │
│   + pgvector     │                    │   Vector Store       │
└──────────────────┘                    └──────────────────────┘
```

### AI Pipeline

```
Document → Ingestion → Chunking → Embedding → Vector Store
                                              ↓
User Query → Classification → Planning → Retrieval → Generation
                                              ↓
                                    Evaluation & Metrics
```

**Pipeline Stages:**
1. **Ingestion** — Parse PDFs, DOCX, TXT, Markdown with metadata extraction
2. **Chunking** — 5 strategies: recursive, sentence, fixed-size, markdown-aware, semantic
3. **Embedding** — OpenAI, Cohere, or local models with batching and caching
4. **Classification** — Query complexity analysis (simple, multi-hop, analytical)
5. **Planning** — Strategy selection based on query type and confidence
6. **Retrieval** — 8+ strategies: vector, BM25, hybrid RRF, query expansion, multi-query, reranking
7. **Generation** — Context-aware synthesis with citation tracking
8. **Evaluation** — 12+ metrics: Recall@K, Precision@K, MRR, nDCG, Hit Rate, Faithfulness

---

## ✨ Features

| Feature | Description |
|---------|-------------|
| 🔍 **Explainable Retrieval** | Full pipeline trace per query. Inspect retrieved chunks, similarity scores, and document inclusion decisions. |
| 🧪 **Statistical Evaluation** | 12+ metrics with confidence intervals, p-values, effect sizes, and distribution analysis. |
| 📊 **Benchmark Campaigns** | Leaderboard with composite scores. Run A/B comparisons across retrieval configurations. |
| 🧬 **Experiment Tracking** | Run multiple strategies against labeled datasets. Capture configurations, results, and reproduce any experiment. |
| 💬 **RAG Chat** | Production-grade chat interface with inline citations and per-message pipeline traces. |
| ✂️ **Chunking Studio** | 5 chunking strategies with visual preview and size analysis. |
| 📈 **Research Intelligence** | Automated pattern discovery, trend detection, root cause inference, and experiment suggestions. |
| 🏛️ **Architecture Visualization** | Interactive SVG diagram of the full system with module details. |
| 📝 **Report Generator** | Academic reports in Markdown with executive summaries, configuration matrices, and statistical analysis. |
| 🔬 **Retrieval Lab** | Test retrieval configurations interactively with real-time parameter adjustment. |

---

## 🛠️ Tech Stack

| Layer | Technology |
|-------|------------|
| **Frontend** | Next.js 15, React 19, TypeScript 5.8, Tailwind CSS v4, Framer Motion, Recharts |
| **API Gateway** | Go 1.22, Chi Router, gRPC, Protocol Buffers |
| **Intelligence** | Python 3.11+, FastAPI, NumPy, SciPy, scikit-learn |
| **Database** | PostgreSQL 15, pgvector, Prisma ORM |
| **Vector Store** | ChromaDB (pluggable) |
| **Observability** | Prometheus, Grafana, OpenTelemetry |
| **Infrastructure** | Docker, Docker Compose |

---

## 📁 Project Structure

```
kairos/
├── apps/
│   └── portal/                 # Next.js 15 frontend
│       ├── src/
│       │   ├── app/            # App router (pages & API routes)
│       │   ├── components/     # React components
│       │   └── lib/            # Utilities, hooks, actions
│       └── prisma/             # Database schema
├── gateway/                    # Go API gateway
│   ├── api/                    # HTTP handlers
│   ├── middleware/              # Auth, rate limiting
│   └── intelligence/           # gRPC client
├── intelligence/               # Python intelligence engine
│   ├── api/                    # FastAPI server
│   ├── classifier/             # Query classification
│   ├── planner/                # Retrieval planning
│   ├── retrieval/              # Search strategies
│   ├── evaluation/             # IR metrics
│   └── calibration/            # Confidence calibration
├── benchmarks/                 # Evaluation framework
│   ├── dataset/                # Dataset loading & validation
│   ├── runner/                 # Benchmark execution
│   ├── e2e/                    # End-to-end evaluation
│   └── leaderboard/            # Public leaderboard
├── sdk/                        # Python SDK
├── tests/                      # 1,768 tests
├── docker/                     # Dockerfiles
└── docs/                       # Documentation
```

---

## 🚀 Quick Start

### Prerequisites
- Node.js 20+
- Python 3.11+
- Go 1.22+
- PostgreSQL 15+ (with pgvector extension)
- Docker (optional)

### 1. Clone & Install

```bash
git clone https://github.com/your-org/kairos.git
cd kairos

# Frontend
cd apps/portal
cp .env.example .env
npm install

# Intelligence Engine
cd ../../
pip install -r requirements.txt
```

### 2. Setup Database

```bash
cd apps/portal
npx prisma generate
npx prisma db push
```

### 3. Run

```bash
# Frontend (port 3000)
cd apps/portal
npm run dev

# Intelligence Engine (port 8000)
cd ../../
python -m intelligence.main

# Gateway (port 8080)
cd gateway
go run main.go
```

### 4. Docker (Full Stack)

```bash
docker-compose up -d
```

Visit [http://localhost:3000](http://localhost:3000)

---

## 📸 Screenshots

[//]: # (TODO: Add screenshots)

| Screenshot | Description |
|------------|-------------|
| ![Dashboard](docs/screenshots/dashboard.png) | Research Dashboard with health metrics |
| ![Knowledge Base](docs/screenshots/knowledge-base.png) | Knowledge base management and document upload |
| ![Chat](docs/screenshots/rag-chat.png) | RAG Chat with inline citations and pipeline traces |
| ![Evaluation](docs/screenshots/evaluation.png) | Evaluation dashboard with 12+ IR metrics |
| ![Benchmark](docs/screenshots/benchmark-explorer.png) | Benchmark Explorer with scatter plots and filtering |
| ![Architecture](docs/screenshots/architecture.png) | Interactive architecture visualization |

---

## 📊 Evaluation Pipeline

Kairos implements 12+ Information Retrieval metrics:

| Metric | What It Measures |
|--------|------------------|
| Recall@K | Proportion of relevant documents retrieved in top K |
| Precision@K | Proportion of retrieved documents that are relevant |
| MRR | Mean Reciprocal Rank of first relevant result |
| nDCG@K | Normalized Discounted Cumulative Gain |
| Hit Rate | Whether any relevant document appears in top K |
| MAP | Mean Average Precision across queries |
| F1@K | Harmonic mean of Precision@K and Recall@K |
| Faithfulness | LLM-judged answer faithfulness to context |
| Answer Relevance | LLM-judged answer relevance to question |
| Context Precision | LLM-judged context quality |
| Statistical significance | Paired t-tests, Wilcoxon signed-rank, effect sizes (Cohen's d, Cliff's delta) |

---

## 📚 Documentation

- [Pipeline Documentation](docs/PIPELINE.md) — Detailed pipeline architecture and strategies
- [Deployment Guide](docs/DEPLOYMENT.md) — Production deployment with Docker and Vercel
- [Configuration Reference](docs/CONFIGURATION.md) — Environment variables and config options
- [Developer Guide](docs/DEVELOPER.md) — Architecture, conventions, and contribution workflow
- [Data Flow](docs/DATA-FLOW.md) — System data flow diagrams
- [Architecture](docs/ARCHITECTURE.md) — System architecture and design decisions
- [Observability](docs/OBSERVABILITY.md) — Logging, metrics, and monitoring

---

## 🔮 Future Improvements

- [ ] HNSW indexing for faster vector search
- [ ] Streaming RAG responses
- [ ] Multi-tenant support
- [ ] Custom embedding model training
- [ ] Automated hyperparameter optimization
- [ ] Integration with LangChain and LlamaIndex
- [ ] Real-time collaboration on experiments
- [ ] Export to Jupyter notebooks

---

## 🤝 Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for:
- Development setup
- Code style guide
- Pull request process
- Architecture overview

---

## 📄 License

MIT License — see [LICENSE](LICENSE) for details.

---

<p align="center">
  Built with ❤️ for the RAG research community
</p>
