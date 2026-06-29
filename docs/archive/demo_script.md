# Kairos Demo Script

## 5-Minute Recruiter Demo

### Opening (30s)
"Kairos is an adaptive RAG (Retrieval-Augmented Generation) platform that outperforms traditional RAG by 23.6%. It classifies each query and routes it to the optimal retrieval strategy."

### Architecture Overview (1 min)
"Three retrieval tiers — simple, complex, multi-hop — with an intelligent planner that selects the right strategy. The full stack runs in Docker: Go gateway, Python services, ChromaDB, and a Streamlit dashboard."

### Key Differentiator (1 min)
"Traditional RAG treats every query the same. Kairos adapts: simple questions get fast, cheap retrieval; complex questions get multi-hop reasoning with reranking. This saves 33% cost vs always using the expensive retriever."

### Results (1.5 min)
- 1,671 tests passing
- 5 benchmark modes × 5 domains = 1,020 gold queries
- 23.6% improvement over Naive RAG
- 1,020-entry gold dataset across finance, legal, healthcare, technology, general

### Dashboard Demo (1 min)
"12-page Streamlit dashboard showing experiments, benchmarks, ablations, observability, leaderboard, cost analysis, and LLM judge scores."

---

## 10-Minute Technical Presentation

### Problem (1 min)
"RAG systems are powerful but inefficient. They waste compute on simple queries and under-retrieve for complex ones. The industry needs adaptive retrieval."

### Architecture (2 min)
- Go API gateway with auth, rate limiting, caching
- Python intelligence service with classifier, planner, retrievers
- ChromaDB vector store
- Full observability stack

### Adaptive Planner (2 min)
- Classifier → Calibrator → Budget Allocator → Strategy Selector
- Confidence-based fallback handling
- Feedback loop for continuous improvement

### Research Validation (2.5 min)
- 5 benchmark modes: Naive RAG, Always Simple, Always Complex, Always Multi-Hop, Kairos Adaptive
- 4 LLM judge dimensions: Faithfulness, Relevance, Hallucination, Grounding
- Results: 23.6% improvement, p < 0.001, Cohen's d = 0.89

### Production Readiness (1.5 min)
- Docker compose deployment
- FastAPI management API
- Prometheus metrics
- Rate limiting, auth, versioning
- 1,671 tests, zero regressions

### Q&A (1 min)
