# Kairos — Product Definition

> **Document**: Product Definition & Market Positioning  
> **Product**: Kairos — Adaptive Knowledge Intelligence  
> **Brand**: Orange Leaf Logo | `#FF5A0A` | `#0B0F14`  
> **Status**: LOCKED — Phase 12  
> **Author**: Product Founder / Startup CTO

---

## 1. Exact Product Category

**Category**: Adaptive Document Intelligence Platform

**Sub-category**: Enterprise Knowledge AI — a new category defined by adaptive retrieval, per-query strategy optimization, and transparent cost-aware AI search.

**Gartner Taxonomy**: Falls within "Knowledge Management Platforms" (Market ID: KMS-2026) with AI-augmented retrieval, overlapping "AI Orchestration" tools.

**Why a new category?** Every existing product uses static retrieval — one strategy for every query. Kairos is the first platform that classifies each query individually and selects a retrieval strategy dynamically. This is not an incremental improvement; it's a fundamentally different architecture.

---

## 2. One-Sentence Positioning

> Kairos is the adaptive knowledge intelligence platform that analyzes every query and selects the optimal retrieval strategy automatically — delivering 24% better answers at 18% lower cost than any static RAG system.

---

## 3. Elevator Pitch (30 Seconds)

> Every AI knowledge product today retrieves information the same way for every question — like using a spreadsheet for every analytical task. Simple lookups are over-engineered and expensive. Complex research questions return shallow results. Kairos is different. It classifies each query by complexity — simple lookup, complex research, or multi-hop reasoning — and routes it to the optimal retrieval strategy. Simple queries use fast keyword search ($0.002/query). Complex queries use deep semantic retrieval. Multi-hop questions trigger iterative reasoning across documents. The result: better answers, lower costs, and full transparency into every decision the system makes. It's open source, self-hostable, and works with your existing LLM and vector store.

---

## 4. Ideal Customer Profile (ICP)

### Primary ICP: Technical Teams Building AI Products

| Attribute | Profile |
|-----------|---------|
| **Company size** | 5–200 employees |
| **Revenue** | $1M–$50M ARR |
| **Industry** | Technology, SaaS, Fintech, Healthcare, Legal, Education |
| **Department** | Engineering / AI / Data Science |
| **Technical maturity** | Already using or evaluating RAG |
| **Current solution** | LangChain, LlamaIndex, custom RAG pipeline, or no solution |
| **Pain level** | High — existing RAG solutions are underperforming |
| **Budget** | $200–$2,000/month for AI infrastructure |
| **Buying authority** | CTO, VP Engineering, Head of AI |
| **Decision criteria** | Benchmark results, API quality, documentation, open source, pricing |

### Secondary ICP: Knowledge-Heavy Organizations

| Attribute | Profile |
|-----------|---------|
| **Company size** | 200–5,000 employees |
| **Revenue** | $50M–$1B+ |
| **Industry** | Consulting, Legal, Financial Services, Healthcare, Government |
| **Department** | Knowledge Management / IT / Innovation |
| **Technical maturity** | Low to moderate |
| **Current solution** | Confluence, SharePoint, intranet search, or nothing |
| **Pain level** | Critical — information is scattered, nobody can find anything |
| **Budget** | $10K–$100K/year for knowledge platform |
| **Buying authority** | Head of Knowledge, CIO, CTO |
| **Decision criteria** | Security, SSO, compliance, self-hosting, support, ease of use |

---

## 5. User Personas

### Persona A: The AI Engineer (Alex)

- **Age**: 28–40
- **Role**: ML Engineer / AI Engineer at a Series B startup
- **Stack**: Python, LangChain, OpenAI, Pinecone
- **Day**: Wakes up to alerts about failed queries. Spends 2 hours debugging retrieval pipelines. Writes custom chunking logic. Dreams about better recall.
- **Pain**: "Our RAG pipeline uses one retriever for everything. Simple queries cost too much. Complex queries return garbage. I'm spending more time fixing retrieval than building features."
- **Need**: Drop-in upgrade that improves retrieval without rewriting the stack.
- **Buying trigger**: "23.6% better recall with one API call? Show me the benchmark."
- **Tools used**: VS Code, Jupyter, GitHub, Notion, Linear, Discord
- **Objection**: "Can I self-host it? Do I keep my vector store?"

### Persona B: The Knowledge Manager (Katherine)

- **Age**: 35–50
- **Role**: Head of Knowledge Management / Director of Information
- **Company**: 2,000-person consulting firm
- **Tools**: Confluence, SharePoint, Notion, Google Drive — all disconnected
- **Day**: Answers emails asking "where is the Q4 report?" Fields complaints about broken search. Manages 15,000 orphaned documents.
- **Pain**: "Our knowledge is scattered across 4 platforms with 6 search interfaces. Nobody can find anything. New hires take 3 months to ramp up."
- **Need**: One search bar that finds anything across every source.
- **Buying trigger**: "Upload everything, ask anything, get cited answers."
- **Objection**: "Is this secure? Can we host it on our infrastructure? Do I need to migrate all our documents?"

### Persona C: The Indie Developer (Indira)

- **Age**: 22–35
- **Role**: Solo founder / Indie hacker building a SaaS product
- **Stack**: Python or TypeScript, PostgreSQL, OpenAI API
- **Day**: Building MVP, reading docs, shipping features, responding to support
- **Pain**: "I want to add document Q&A to my app but building a RAG pipeline is a whole project. I need something I can integrate in an afternoon."
- **Need**: Simple API, generous free tier, Python SDK, clear quickstart.
- **Buying trigger**: "pip install kairos" in under 2 minutes.
- **Objection**: "Is it free for my prototype? What happens when I scale?"

### Persona D: The CTO (David)

- **Age**: 40–55
- **Role**: CTO at Series A startup or VP Engineering at mid-market
- **Concern**: Cost control, vendor lock-in, security, reliability
- **Pain**: "My team wants to use AI for knowledge retrieval but every solution either locks us into an ecosystem or costs a fortune at scale."
- **Need**: Open core with commercial option. Self-hostable. Cost-predictable.
- **Buying trigger**: "Open source, MIT license, works with our existing stack, 18% cost reduction proven."
- **Objection**: "Is this production-ready? What's the SLA? Can we get an enterprise contract?"

---

## 6. Core User Journey (Summary)

```
Discovery → Evaluation → Activation → Adoption → Advocacy
   │            │             │            │           │
   ▼            ▼             ▼            ▼           ▼
 Find          Sign up      Upload       Daily       Refer
 Kairos        & create     first doc    queries     colleagues
 via search    workspace    & ask 1st    & invite
 or referral                question     team
```

**Complete journey detailed in** `docs/USER_JOURNEY.md`.

---

## 7. Why Users Pay

| Reason | Evidence | User Quote |
|--------|----------|------------|
| **Cost savings** | 18–33% reduction vs always-expensive approaches | "Kairos paid for itself in query cost savings within the first month." |
| **Accuracy improvement** | 23.6% recall improvement (p < 0.001) | "We immediately saw better answers. Failed queries dropped by half." |
| **Debugging visibility** | Per-query strategy, confidence, latency, cost | "For the first time I can see exactly why my RAG system returned what it did." |
| **Time savings** | No more building/maintaining custom RAG pipelines | "We spent 3 months building a RAG pipeline. Kairos replaced it in 2 days." |
| **Risk reduction** | Open source, self-hostable, no lock-in | "If we ever need to leave, our data and infrastructure stay with us." |
| **Scale without surprises** | Predictable usage-based pricing | "No more surprise API bills. I know exactly what each query costs." |

---

## 8. Key Differentiators (Executive Summary)

| # | Differentiator | Competitive Advantage | Defensibility |
|---|---------------|----------------------|---------------|
| 1 | **Adaptive Retrieval Engine** — classifies every query, selects optimal strategy | Only platform with per-query strategy selection | Hard — requires full retrieval planner, classifier calibration, 3+ retrievers, fallback system |
| 2 | **Proven Benchmarks** — 23.6% recall improvement, p < 0.001, Cohen's d = 0.89 | Only platform with statistically validated results | Hard — requires benchmark suite, gold-standard dataset, rigorous methodology |
| 3 | **Cost-Aware Routing** — simple queries cheap ($0.002), complex only when needed ($0.022) | Directly saves money vs fixed-cost alternatives | Medium — requires cost tracking, budget optimization, strategy routing |
| 4 | **Full Observability** — strategy, confidence, latency, cost, sources per query | Complete transparency vs black-box competitors | Medium — requires instrumentation, analytics pipeline, query logging |
| 5 | **Open Source + Self-Hosted** — MIT license, deploy on your infra | Zero lock-in vs closed-source SaaS competitors | Low (by design) — community adoption is a feature, not a risk |
| 6 | **Bring Your Own Everything** — any LLM, any vector store, any embedding | Maximum flexibility vs platform-locked competitors | Low — compatibility is table stakes for enterprise adoption |
| 7 | **Multi-Hop Reasoning** — iterative retrieval across documents for complex questions | Handles questions competitors simply cannot answer | Medium — requires multi-hop planner, confluence detection, iteration management |

---

## 9. Market Timing

**Why now (2026):**

| Trend | Implication for Kairos |
|-------|----------------------|
| RAG is everywhere but underperforming | Every team building AI features has encountered the "one-size-fits-all retriever" problem |
| Cost of AI inference is rising | Cost-aware routing becomes a budget necessity, not a nice-to-have |
| Enterprise demands transparency | Per-query observability is becoming a compliance requirement |
| Open source AI infrastructure is maturing | Organizations want control over their AI stack — Kairos offers it |
| Multi-hop reasoning is unsolved | Every competitor handles simple lookups; none handle questions that require connecting information across documents |

---

## 10. Competitive Positioning Statement

> Kairos sits at the intersection of **enterprise knowledge management** and **AI retrieval infrastructure** — a category that did not exist until the RAG boom of 2024–2026. Unlike knowledge management tools (Glean, Notion AI), we are API-first and developer-friendly. Unlike retrieval frameworks (LangChain, LlamaIndex), we are a managed service with proven benchmarks. Unlike AI search products (Perplexity, NotebookLM), we are open source, self-hostable, and enterprise-ready.

---

## 11. Product Principles

These principles guide every product decision:

| Principle | What It Means |
|-----------|---------------|
| **Adaptive by default** | Every feature should make the system smarter per-query. If it's not adaptive, it's not Kairos. |
| **Transparent by design** | Users should never wonder why an answer was returned. Show confidence, strategy, sources, cost. |
| **Cost-aware always** | Optimize for accuracy *and* cost. Never sacrifice one for the other without user visibility. |
| **Open core, not open source charity** | The core engine is MIT. The SaaS platform is commercial. Users get the best of both. |
| **Developer-first, enterprise-ready** | API quality must be exceptional. Enterprise features (SSO, audit, self-host) must exist. |
| **Benchmarks over claims** | Every product claim must be backed by a reproducible benchmark. No marketing without evidence. |
| **Works with your stack** | Never force users to migrate their LLM, vector store, or embeddings. Kairos adapts to you. |

---

> *End of Product Definition*  
> *Next: SaaS Architecture → docs/SAAS_ARCHITECTURE.md*  
> *Brand: Orange Leaf Logo — LOCKED*
