# Product Strategy

**Phase 16 — Product Design System & Implementation Specification**  
**Status:** Final  
**Version:** 2.0

---

## Executive Summary

Kairos is an **Adaptive Retrieval Intelligence Platform** that sits between enterprise data and large language models to optimize every retrieval decision in real time.

Unlike every competitor that applies the same retrieval strategy to every query, Kairos classifies each query individually, selects the optimal strategy, allocates compute budget proportionally to difficulty, and improves over time through feedback — delivering higher accuracy at lower cost without human tuning.

---

## Product Positioning

### Chosen Position: Adaptive Retrieval Intelligence Platform

**Why this position:**

| Alternative | Rejected Because |
|-------------|-----------------|
| AI Retrieval Intelligence Layer | Implies middleware dependency; weakens standalone value |
| Enterprise RAG Optimization Platform | "RAG" is a technical implementation detail, not a value proposition |
| AI Infrastructure Platform | Too generic; indistinguishable from competitors |
| Retrieval Decision Engine | Technically accurate but unfamiliar; requires explanation |

**Adaptive Retrieval Intelligence Platform** wins because:
- **Adaptive** is the core differentiator — no competitor does per-query strategy selection
- **Retrieval** names the category clearly (not chatbot, not vector DB)
- **Intelligence** signals ML-driven optimization (not rules, not static config)
- **Platform** implies integration, APIs, and ecosystem (not a library, not a tool)

### Tagline

> **Every query deserves a different retrieval strategy.**

### One-Liner

Kairos is the adaptive retrieval layer that classifies, plans, and routes every query to its optimal strategy — balancing quality, latency, confidence, and cost in real time.

---

## Final Product Positioning — Phase 16

### Chosen Position (Permanent)

**Adaptive Retrieval Intelligence Platform**

### Why This Position Wins

| Factor | Evaluation |
|--------|-----------|
| **Adaptive** | Core differentiator — no competitor claims per-query strategy selection. This is the hill Kairos dies on. |
| **Retrieval** | Names the category (not chatbot, not vector DB, not RAG). Engineers immediately understand the problem space. |
| **Intelligence** | Signals ML-driven optimization. Not rules, not static config, not another API wrapper. |
| **Platform** | Implies API, SDKs, managed infrastructure, SLAs. Not a library, not a framework. |

### Alternatives Rejected

| Alternative | Reason |
|-------------|--------|
| Adaptive AI Retrieval Platform | "AI Retrieval" is redundant — retrieval implies AI. |
| AI Retrieval Intelligence Platform | Same redundancy. Three-word stack is tighter. |
| Retrieval Intelligence Cloud | "Cloud" is generic. Every SaaS is cloud. |
| Adaptive RAG Platform | "RAG" is a technique, not a product category. Will age poorly as the field moves beyond RAG. |

**This positioning is permanent. All branding, copy, and product decisions derive from it.**

---

## Final Value Propositions — Phase 16

### Elevator Pitch (15 seconds)

"Every AI app needs to retrieve information before answering questions. Most use one strategy for everything — wasting money on simple queries and failing on complex ones. Kairos classifies every query individually, picks the right retrieval strategy, and optimizes for quality, speed, and cost — automatically. No tuning required."

### One Sentence

Kairos is the adaptive retrieval platform that classifies every query individually, selects the optimal strategy, and balances quality, cost, and latency — without manual tuning.

### One Paragraph

Kairos is an adaptive retrieval intelligence platform that sits between your data and your LLM. Every query is classified by complexity, routed to the optimal retrieval strategy, and executed with a compute budget proportional to its difficulty. Responses include calibrated confidence scores, latency breakdowns, and cost per query. The system learns from feedback over time, improving without human intervention. Integration takes one API call. Used by AI engineering teams at B2B SaaS companies to reduce LLM costs by 40% and improve recall by 24%.

### 30-Second Investor Pitch

"We're building the intelligent routing layer for AI retrieval. Today, every RAG system applies the same strategy to every query — wasting GPT-4 money on questions a simple search could answer, while failing on complex questions that need multi-hop retrieval. Kairos classifies each query, selects the optimal strategy, and allocates compute budget proportionally to difficulty. The result: 24% better recall at 40% lower cost. We have 1,770 validated tests, a 5-domain benchmark, and a working open-source codebase. We're targeting AI engineering teams at B2B SaaS companies — a $2B+ market growing at 40% CAGR. Our SaaS platform monetizes through usage-based tiers starting at $49/month, with a free tier that drives top-of-funnel adoption."

### Landing Page Headline

**Every query deserves a different retrieval strategy.**

### Recruiter Explanation (for hiring)

"Kairos is a high-growth AI infrastructure startup building the intelligent routing layer for enterprise retrieval systems. Our platform automatically classifies and routes search queries to the optimal strategy, reducing costs and improving accuracy for companies building AI products. Think of it as the intelligent middleware between enterprise data and large language models."

### Technical Explanation (for engineers)

"Kairos is an adaptive retrieval system that uses a trained classifier to categorize incoming queries by complexity (simple, complex, multi-hop), then routes each query to an optimized retrieval strategy. Simple queries hit hybrid keyword+vector search (≈150ms). Complex queries use MMR diversity sampling with cross-encoder reranking (≈300ms). Multi-hop queries perform iterative retrieval with query reformulation (≈500ms-2s). A budget optimization model allocates compute tokens proportionally to expected difficulty. Confidence is calibrated using Platt scaling and isotonic regression. The system supports any LLM provider and any vector store. API is REST + SSE streaming."

### Enterprise Explanation (for decision-makers)

"Kairos is a managed retrieval intelligence platform that helps organizations reduce LLM infrastructure costs while improving answer accuracy. Our proprietary per-query routing technology automatically optimizes every search, eliminating the need for manual tuning across different use cases, departments, or document types. We provide full observability into retrieval quality, cost allocation, and system performance. Deployable in your cloud or consumed as a managed API with SOC 2 compliance and 99.9% uptime SLA."

---

## Target Customers

### Primary: AI Engineering Teams at B2B SaaS Companies

Building AI features (semantic search, RAG, Q&A) for customers. They need retrieval that works across diverse query types without manual tuning.

### Secondary: Internal Enterprise AI Platforms

Central AI teams building internal knowledge retrieval tools for employees across departments. They need predictable accuracy, cost control, and observability.

### Tertiary: AI Startups & RAG Builders

Early-stage teams shipping AI products. They need fast integration, reasonable free tier, and growth path.

---

## Pain Points Solved

| Pain Point | Kairos Solution |
|------------|----------------|
| One strategy fails across diverse queries | Adaptive per-query strategy selection |
| High LLM costs from over-retrieving | Budget optimization routes compute proportionally |
| Manual tuning per domain/corpus | Automatic confidence calibration + feedback learning |
| No visibility into retrieval quality | Per-query confidence, latency, cost breakdown |
| Hard to compare strategies | Built-in benchmark suite (5 domains, 5 modes) |
| Feedback doesn't improve system | Online retraining from user signals |

---

## Market Sizing (TAM/SAM/SOM)

| Metric | Value | Source |
|--------|-------|--------|
| Total Addressable Market | $2.8B | AI infrastructure middleware, 2026 |
| Serviceable Addressable Market | $620M | Companies using RAG/retrieval in production |
| Serviceable Obtainable Market (Y3) | $18M | 3% SAM at $199 avg monthly ACV |
| Target ACV (blended) | $2,388/yr | Weighted across Free/Dev/Pro/Enterprise |

### Bottom-Up Projection

```
Year 1 (MVP):     100 users × $0 (Free) + 30 × $49 + 10 × $199 + 2 × $10K = $23,170 MRR
Year 2 (Scale):  1,000 users × $49 avg = ~$50K MRR
Year 3 (Growth): 5,000 users × $49 avg = ~$250K MRR
```

### Growth Drivers

| Driver | Impact | Timeline |
|--------|--------|----------|
| Open-source adoption → SaaS conversion | High traffic, 2-5% conversion | Ongoing |
| Technical blog SEO | Organic growth, high-intent | 6-month flywheel |
| Product Hunt / HN launch | Spike traffic, validation | Launch day |
| AI newsletter sponsorships | Targeted reach | Monthly |
| Enterprise outbound | High ACV, long cycle | Post-v1 |

---

## Go-to-Market Strategy

### Channels

| Channel | Priority | Why |
|---------|----------|-----|
| Product Hunt | Launch | Developer audience, validation, SEO |
| Hacker News | Launch | Technical audience, honest feedback |
| AI newsletters (The Rundown, TLDR AI, Ben's Bites) | Monthly | Targeted reach to AI builders |
| Technical blog (engineering deep-dives) | Ongoing | SEO, credibility, open-source community |
| GitHub (open-source contributions) | Ongoing | Developer adoption, organic distribution |
| Conferences (RAG World, AI Engineer Summit) | Quarterly | Enterprise relationships |
| Discord community | Ongoing | Support, feedback, retention |

### PLG (Product-Led Growth) Motion

1. **Acquisition**: Free tier (1K queries) + open-source codebase + technical content
2. **Activation**: First query in <5 minutes via quickstart docs
3. **Retention**: Weekly usage email, strategy visualization shows value
4. **Revenue**: Free → hit 800/1,000 queries → upgrade prompt → Developer or Pro
5. **Referral**: "Share Kairos" with team → invite members → team account adoption

---

## Cost Model

### Per-Query Cost Breakdown

| Component | Simple Query | Complex Query | Multi-Hop Query |
|-----------|-------------|---------------|-----------------|
| Embedding (API call) | $0.0001 | $0.0001 | $0.0003 |
| Vector search | $0.00005 | $0.0001 | $0.0003 |
| Cross-encoder rerank | — | $0.0003 | $0.0005 |
| LLM judge | $0.0001 | $0.0003 | $0.001 |
| Infrastructure overhead | $0.0002 | $0.0003 | $0.0005 |
| **Total** | **~$0.0005** | **~$0.0011** | **~$0.0026** |

### Blended Cost at Adaptive Mix (52% Simple / 31% Complex / 17% Multi-Hop)

| Metric | Value |
|--------|-------|
| Average cost per query | $0.0013 |
| Target price per query | $0.003-0.008 (depends on tier) |
| Gross margin target | 70-80% |
| Breakeven at | ~500 paying users |

### Comparison: Without Kairos (fixed Complex strategy)

- $0.0017/query average (wastes compute on simple queries)
- Kairos saves ~24% on direct costs before considering accuracy gains

---

## Competitive Moat Durability

| Moat Component | Erosion Timeline | Defense Strategy |
|----------------|-----------------|------------------|
| Per-query strategy selection | 12-18 months (competitors can implement) | Continuous improvement, patents pending |
| Confidence calibration | 6-9 months (known techniques) | Proprietary calibration data, domain adaptation |
| Budget optimization model | 9-12 months (can be reverse-engineered) | Data flywheel: more users → better model |
| Feedback learning loop | 12-18 months | Network effects: more feedback → smarter routing |
| Benchmark validation | 6 months (competitors can replicate) | Continuous public benchmarks, community validation |
| Provider agnosticism | Indefinite (architecture choice) | Make integration so easy that switching is painful |
| **Overall moat** | **12-18 month head start** | **Must achieve escape velocity before erosion** |

---

## Retention & Churn Prevention

| Churn Risk | Probability | Mitigation |
|------------|-------------|------------|
| Users try free tier, never see value | 40% | Improved onboarding, better docs, strategic viz on day 1 |
| LLM costs still too high | 15% | Cost optimization dashboard, proactive recommendations |
| Competitor copies core feature | 20% | Brand lock-in, ecosystem, support quality |
| Better LLMs eliminate retrieval need | 10% | Kairos agnostic — adapts to different LLM capabilities |
| Team churns due to budget cuts | 15% | Downgrade path (keep data, reduce queries) |

### Retention Tactics

1. Day 1: Welcome email with quickstart + first query suggestion
2. Day 3: "See your first week of savings" email with cost comparison
3. Day 7: Strategy visualization showing how Kairos classified their queries
4. Day 14: Usage growth notification + upgrade prompt if approaching limit
5. Day 30: "You've saved X% compared to fixed strategy" report
6. Ongoing: Weekly digest (queries, savings, accuracy trends)

---

## Competitive Moat

1. **Per-query strategy selection** — No competitor routes queries individually
2. **Confidence calibration** — Platt-scaled + isotonic regression for reliable confidence scores
3. **Budget optimization** — ML model that allocates compute proportional to query difficulty
4. **Feedback learning** — Thumbs up/down signals retrain the strategy selector
5. **Benchmark validation** — 1,770+ tests, 5-domain benchmark, statistically validated results
6. **Full-stack architecture** — Go gateway + Python intelligence + observability out of the box

---

## Business Model

| Tier | Price | Queries/mo | Projects | Support |
|------|-------|-----------|----------|---------|
| Free | $0 | 1,000 | 1 | Community |
| Developer | $49 | 50,000 | 10 | Email |
| Pro | $199 | 500,000 | Unlimited | Priority |
| Enterprise | Custom | Custom | Custom | Dedicated + SLA |

Revenue drivers: query volume, projects, support tier, SSO, dedicated infrastructure.

---

## Success Metrics

| Category | Metric | Target (v1) |
|----------|--------|-------------|
| Accuracy | Recall vs Naive RAG | +20% |
| Cost | Avg cost/query | < $0.02 |
| Speed | P95 latency | < 500ms |
| Adoption | Weekly active users | 200 |
| Business | MRR | $10k (month 6) |
| Quality | NPS | > 40 |
| Reliability | API uptime | 99.9% |
