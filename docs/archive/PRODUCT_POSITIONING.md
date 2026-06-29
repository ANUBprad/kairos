# Kairos — Product Positioning

> **Document**: Product Positioning & Market Strategy  
> **Product**: Kairos — Adaptive Knowledge Intelligence  
> **Brand**: Orange Leaf Logo | Charcoal `#0B0F14` | Orange `#FF5A0A`  
> **Status**: LOCKED — Phase 11A

---

## One-Sentence Pitch

> Kairos is the only retrieval platform that adapts per query — choosing the optimal strategy automatically so you get better answers, lower latency, and reduced costs than any static RAG system.

---

## Elevator Pitch (30 seconds)

> Every RAG system today retrieves the same way for every question — using a one-size-fits-all retriever that wastes money on simple lookups and fails on complex research. Kairos is different. It analyzes each query, classifies it by complexity, and selects the optimal retrieval strategy — hybrid keyword search for simple questions, deep semantic retrieval for complex ones, and iterative multi-hop reasoning for questions that require connecting information across documents. The result is 24% better recall, 18% lower cost, and transparent per-query reporting. It's open source, self-hostable, and integrates with any stack.

---

## Target Users

### Primary: AI Engineering Teams
- **Who**: ML/AI engineers at startups and mid-market companies building RAG applications
- **Pain**: "Our RAG pipeline uses one retriever for everything. Simple queries are over-engineered, complex queries return garbage."
- **Need**: A pluggable retrieval layer that instantly improves accuracy without rebuilding the stack
- **Buying trigger**: Proven benchmark numbers, open source, simple API

### Secondary: Knowledge Managers
- **Who**: Heads of knowledge, enterprise architects at 200–5,000 person companies
- **Pain**: "We have documents scattered across Confluence, Notion, SharePoint, and Google Drive. No one can find anything."
- **Need**: Unified search across all knowledge sources with enterprise security
- **Buying trigger**: Self-hosted option, SSO, audit logs, transparent pricing

### Tertiary: Independent Developers
- **Who**: Solo founders, indie hackers, open source contributors
- **Pain**: "I want to add document Q&A to my app but building a RAG pipeline from scratch is too much work."
- **Need**: Simple API, generous free tier, clear documentation
- **Buying trigger**: "pip install" in under 2 minutes

---

## Core Differentiators

### 1. Adaptive Retrieval Engine (Unmatched)
Kairos is the **only** platform that classifies every query and selects a retrieval strategy dynamically. Competitors use one retriever for everything. Kairos uses three — and switches between them per query based on confidence, budget, and learned performance data.

**Competitors**: LlamaIndex, LangChain, Haystack, Vectara, Cohere, Glean, Perplexity, NotebookLM — all use static retrieval.

### 2. Proven, Published Benchmarks
**23.6% recall improvement** over Naive RAG. **p < 0.001**. **Cohen's d = 0.89**. This is not a marketing claim — it's a statistically validated result on a standardized benchmark suite of 1,020 gold-standard queries across 5 domains.

**Competitors**: No competitor publishes retrieval benchmarks with statistical significance testing.

### 3. Cost-Aware Optimization
Kairos doesn't just improve answers — it reduces costs. By routing simple queries to cheap retrievers ($0.002/query) and complex queries to expensive ones only when needed ($0.022/query), users save **18–33%** compared to always-expensive approaches.

**Competitors**: ChatGPT/Perplexity charge fixed per-token. Glean/NotionLM charge flat enterprise fees. No competitor optimizes per-query cost.

### 4. Full Observability
Every query returns: strategy used, confidence score, latency breakdown, cost, and cited sources. Users get a transparent audit trail for every single answer.

**Competitors**: Black box answers. No per-query metrics.

### 5. Open Source + Self-Hosted
MIT-licensed. Deploy on your own infrastructure. No vendor lock-in. No data leaving your network.

**Competitors**: All major competitors are closed-source SaaS. Only Kairos offers both cloud and self-hosted.

### 6. Bring Your Own Everything
Keep your LLM (OpenAI, Gemini, Claude, Ollama). Keep your vector store (ChromaDB, Pinecone, Weaviate, Qdrant). Keep your embeddings. Kairos is a retrieval layer, not a platform swap.

**Competitors**: Most require using their models, their storage, or their ecosystem.

---

## Competitive Comparison

| Capability | Kairos | LlamaIndex | LangChain | Vectara | Glean | Perplexity |
|------------|--------|------------|-----------|---------|-------|------------|
| Adaptive retrieval | ✅ Yes | ❌ No | ❌ No | ❌ No | ❌ No | ❌ No |
| Multi-hop reasoning | ✅ Yes | ⚠️ Manual | ⚠️ Manual | ❌ No | ❌ No | ⚠️ Limited |
| Confidence scoring | ✅ Yes | ❌ No | ❌ No | ❌ No | ❌ No | ❌ No |
| Cost optimization | ✅ Yes | ❌ No | ❌ No | ❌ No | ❌ No | ❌ No |
| Fallback handling | ✅ Yes | ❌ No | ❌ No | ❌ No | ❌ No | ❌ No |
| Open source | ✅ MIT | ✅ MIT | ✅ MIT | ❌ No | ❌ No | ❌ No |
| Self-hosted | ✅ Yes | ✅ Yes | ✅ Yes | ❌ No | ❌ Enterprise | ❌ No |
| Managed cloud | ✅ Planned | ✅ Yes | ✅ Yes | ✅ Yes | ✅ Yes | ✅ Yes |
| Benchmark results | ✅ 24% ↑ | ❌ None | ❌ None | ❌ None | ❌ None | ❌ None |
| Per-query metrics | ✅ Yes | ❌ No | ❌ No | ❌ No | ❌ No | ❌ No |
| BYO LLM | ✅ Yes | ✅ Yes | ✅ Yes | ❌ No | ❌ No | ❌ No |
| BYO vector store | ✅ Yes | ✅ Yes | ✅ Yes | ❌ No | ❌ No | ❌ No |
| Production monitoring | ✅ Grafana | ❌ No | ❌ No | ⚠️ Basic | ✅ Yes | ❌ No |
| API gateway | ✅ Go + gRPC | ❌ No | ❌ No | ✅ Yes | ✅ Yes | ❌ No |

---

## Pricing Recommendation

### Philosophy
Usage-based pricing for developers. Seat-based for teams. Enterprise for large organizations. Free tier as growth engine.

### Tiers

| | **Free** | **Developer** | **Team** | **Enterprise** |
|---|---|---|---|---|
| **Price** | $0 | $29/mo | $199/mo | Custom |
| **Documents** | 100 | 1,000 | 10,000 | Unlimited |
| **Queries/mo** | 1,000 | 10,000 | 100,000 | Custom |
| **Users** | 1 | 5 | 25 | Unlimited |
| **Strategies** | Auto only | Auto + Manual | Full control | Full control |
| **Analytics** | Basic | Advanced | Full + export | Custom dashboard |
| **Support** | Community | Email | Slack priority | Dedicated |
| **Self-hosted** | ❌ | ❌ | ❌ | ✅ |
| **SSO/SAML** | ❌ | ❌ | ❌ | ✅ |
| **Audit logs** | ❌ | ❌ | ❌ | ✅ |
| **SLA** | None | 99.5% | 99.9% | 99.99% |

### Why This Pricing
- **Free tier** removes friction for developers evaluating the product. Generous enough to be useful (100 docs, 1K queries), limited enough to create upgrade motivation.
- **Developer tier** ($29/mo) targets indie devs and small teams. Low price, high value. Converts from free when users hit limits.
- **Team tier** ($199/mo) targets startups and growing teams. 10x queries for 7x price. Feels like a good deal.
- **Enterprise** (custom) targets organizations needing self-hosted, SSO, audit, and SLA support.

---

## MVP Feature List

### Must Have (Launch Gate)

| Feature | Source | Effort |
|---------|--------|--------|
| User auth (GitHub OAuth) | New | 2 days |
| API key management | New | 1 day |
| Workspace creation | New | 1 day |
| Document upload (PDF, TXT, MD) | Extend existing | 3 days |
| Document ingestion pipeline | Extend existing | 3 days |
| Query interface (web) | New | 5 days |
| Answer display (sources, strategy, confidence) | New | 3 days |
| Strategy badges in UI | New | 1 day |
| Usage metering | New | 2 days |
| Basic analytics (queries over time, strategy breakdown) | New | 4 days |
| Settings (API keys, profile) | New | 2 days |
| Landing page | New | 3 days |
| Sign up / Login | New | 2 days |
| **Total** | | **32 days** |

### Should Have (Week 3–4)

| Feature | Effort |
|---------|--------|
| Document collections | 2 days |
| Multi-document upload | 1 day |
| Conversation history | 3 days |
| Feedback thumbs up/down | 2 days |
| Team invitations | 2 days |
| Advanced analytics (cost, latency trends) | 3 days |
| API documentation (MDX) | 3 days |
| Python SDK with auth | 2 days |
| Quickstart guide | 2 days |
| Status page | 1 day |

### Nice to Have (Post-Launch)

| Feature | Effort |
|---------|--------|
| JavaScript SDK | 3 days |
| Webhooks | 3 days |
| OpenAI-compatible API | 2 days |
| Document preview (PDF viewer) | 3 days |
| Audio/video transcription | 4 days |
| URL ingestion | 2 days |
| Custom strategy configuration | 3 days |
| Export reports | 2 days |
| Dark/light mode toggle | 1 day |

### Explicitly Out of Scope for V1

- Self-hosted deployment option
- SSO / SAML authentication
- Role-based access control (RBAC)
- Audit logging
- Custom branding / white-label
- Dedicated infrastructure / isolated clusters
- LLM Judge Framework (not production-ready)
- Real-time multi-user collaboration
- Mobile application
- API marketplace / integrations directory
- A/B testing framework
- Custom model training / fine-tuning

---

## Why Users Will Pay

1. **It saves money** — Cost-aware routing reduces query costs by 18–33% vs always-expensive approaches. At scale, this pays for the subscription.

2. **It improves accuracy** — 24% better recall means fewer failed queries, less manual searching, and higher confidence in AI-generated answers.

3. **It reveals what's happening** — Per-query strategy, confidence, latency, and cost information means users understand exactly what the system is doing. No black box.

4. **It's risk-free to try** — Free tier, open source, self-hostable. No commitment, no vendor lock-in, no data migration risk.

5. **It works with existing stacks** — No need to change LLM, vector store, or infrastructure. Kairos is a drop-in retrieval upgrade.

---

## Competitive Positioning Map

```
                    HIGH DIFFERENTIATION
                         │
                         │
              Kairos ●   │
                         │
      Vectara ●          │
                         │
─────────────────────────┼─────────────────────────
                         │   HIGH EASE OF USE
   HIGH COMPLEXITY       │
                         │
              LlamaIndex │●
              LangChain  │●
                         │
                         │
                    LOW DIFFERENTIATION
```

Kairos occupies the unique position of **high differentiation** (adaptive retrieval, cost optimization, observability) with **moderate ease of use** (API-first, but more automated than framework alternatives).

---

## Key Messages by Audience

| Audience | Message |
|----------|---------|
| **AI Engineer** | "One API call. 24% better retrieval. Drop-in upgrade for any RAG stack." |
| **Engineering Manager** | "Proven 24% recall improvement with statistical significance. Open source. No vendor lock-in." |
| **CTO** | "Lower costs, better answers, full observability. Deploy on your infrastructure or use our cloud." |
| **Knowledge Manager** | "Upload your documents. Ask questions. Get answers with cited sources. Works with your existing tools." |
| **Investor** | "The only adaptive retrieval engine validated against 1,020 benchmark queries. 23.6% improvement at p < 0.001. Defensible moat. Massive RAG market." |

---

> *End of Product Positioning*  
> *Next: Website Architecture → docs/WEBSITE_ARCHITECTURE.md*  
> *Brand: Orange Leaf Logo — LOCKED*
