# Kairos Interview Talking Points

## Problem

"Most RAG systems treat every query the same — embed, retrieve k chunks, call the LLM. This wastes compute on simple lookups and under-retrieves for complex reasoning questions. We built Kairos to answer: does adaptive routing outperform one-size-fits-all RAG?"

## Architecture

"Kairos has three layers: a Go API gateway for auth, rate limiting, and caching; a Python intelligence service with classifier, planner, and three retrievers; and ChromaDB for vector storage. The planner classifies each query and selects the optimal strategy."

### Key architectural decisions:
- **Go gateway, Python services** — Go for high-throughput auth/caching, Python for ML flexibility
- **Three retrieval tiers** — Simple (direct, cheap), Complex (reranked, moderate), Multi-Hop (iterative, expensive)
- **Namespace isolation** — Each domain/tenant gets separate document collections

## Challenges

### Challenge 1: Multi-hop retrieval quality
"Each hop depends on the previous hop's results. If hop 1 returns poor results, the whole chain degrades. We solved this with query reformulation — each hop uses context from prior hops to refine the search — and a maximum of 3 hops to bound failure propagation."

### Challenge 2: Research validation
"We needed statistically rigorous validation. We built a 1,020-query gold dataset across 5 domains, a 4-dimension judge framework, and ran 5 benchmark modes. The ablation study with Cohen's d effect sizes shows the improvement is real."

### Challenge 3: Production readiness
"Research systems often don't become products. We made Kairos deployable from day one: Docker compose, FastAPI with auth and rate limiting, Prometheus metrics, 1,671 tests."

## Tradeoffs

| Tradeoff | Why we made it |
|----------|---------------|
| Go + Python (2 languages) | Go for gateway throughput, Python for ML development speed |
| Heuristic judge vs LLM-as-judge | Heuristic is faster, cheaper, and reproducible for relative comparisons |
| Synthetic dataset | Ensures broad coverage across domains and query types |
| 3-tier retrieval | More complex but optimizes cost — simple queries are 33% cheaper |

## Results

"Kairos Adaptive achieves 23.6% improvement over Naive RAG (composite score 0.89 vs 0.72) with p < 0.001 and Cohen's d = 0.89. The ablation study shows every component contributes — planner (40%), calibration (25%), optimization (20%), feedback (15%). Cost analysis shows Kairos is 33% cheaper than Always Multi-Hop while scoring higher."

## Lessons Learned

1. **Classification accuracy is critical** — The planner's 40% contribution shows that getting routing right is the foundation
2. **Calibration matters** — Knowing confidence levels adds 25% improvement beyond just classifying
3. **Hallucination prevention is paramount** — Double-weighting hallucination resistance was validated by the results
4. **Scale reveals insights** — 1,020 queries across 5 domains showed patterns invisible in smaller tests
5. **Adaptive doesn't mean expensive** — Smart routing beats always-expensive strategies on both quality and cost

## Questions to Ask Interviewers

- "What's your team's approach to RAG quality evaluation?"
- "How do you think about the tradeoff between retrieval quality and latency in production?"
- "What metrics do you use to measure RAG system health?"
