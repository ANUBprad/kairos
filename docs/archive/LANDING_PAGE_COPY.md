# Landing Page Copy

**Phase 15 — Product Definition & UX Blueprint**  
**Status:** Final

---

## Hero Section

### Headline (H1)

**Every query deserves a different retrieval strategy.**

### Subheading (H2)

Kairos classifies, plans, and routes every query to the optimal retrieval strategy — balancing quality, latency, confidence, and cost in real time. Not a chatbot. Not a vector database. An adaptive retrieval intelligence platform.

### CTA Buttons

| Button | Text | URL |
|--------|------|-----|
| Primary | **Start building — it's free** | /signup |
| Secondary | **See how it works** | #how-it-works |

### Trust Bar (below CTA)

Powered by 1,802 tests · 5-domain benchmark validated · MIT license

---

## Problem Section

### Headline

**Most retrieval systems treat every query the same way.**

### Body

Simple questions like "What's our refund policy?" need a 50ms keyword lookup. Complex questions like "Compare Q1 and Q3 revenue and explain the variance" need multi-hop retrieval across documents, taking seconds.

Traditional systems apply the same strategy to both. Simple queries are over-engineered and expensive. Complex queries return shallow results.

You end up paying GPT-4 prices for questions that a BM25 search could answer.

---

## How It Works (3 steps)

### Step 1: Classify

**Your query arrives.** Kairos analyzes complexity, domain, and intent — classifying it as simple, complex, or multi-hop in milliseconds.

*Visual: Query entering a classifier node, splitting into three paths*

### Step 2: Plan

**Kairos selects the optimal strategy.** Simple queries route to hybrid keyword + vector search. Complex queries get MMR diversity + cross-encoder rerank. Multi-hop queries trigger iterative retrieval with query reformulation.

*Visual: Three strategy paths with confidence scores and cost estimates*

### Step 3: Retrieve

**You get the answer with full transparency.** Every response includes confidence score, strategy used, latency, cost, and cited sources — so you always know what happened and why.

*Visual: Response card with confidence, latency, cost, and citation badges*

---

## Adaptive Routing Animation Section

### Headline

**Watch Kairos decide in real time.**

### Body

Every query triggers a decision chain: complexity analysis → strategy selection → budget allocation → retrieval execution → confidence calibration. Each step is instrumented and visible.

*Animated flow diagram showing a query being classified, routed, and answered with real metrics*

---

## Benchmark Results Section

### Headline

**Validated across 5 domains. Better than every fixed strategy.**

| Rank | Mode | Composite | Recall | Latency | Cost/Query |
|------|------|-----------|--------|---------|------------|
| 1 | **Kairos Adaptive** | **0.890** | **0.940** | 163ms | **$0.0145** |
| 2 | Always Multi-Hop | 0.800 | 0.910 | 190ms | $0.0220 |
| 3 | Always Complex | 0.780 | 0.900 | 170ms | $0.0184 |
| 4 | Always Simple | 0.750 | 0.880 | 133ms | $0.0100 |
| 5 | Naive RAG | 0.720 | 0.850 | 145ms | $0.0123 |

Kairos Adaptive beats every fixed strategy while maintaining competitive latency and cost.

*Small text: Benchmarked on 1,020 queries across finance, legal, healthcare, technology, and general domains*

---

## Features Section

### Feature Cards

| Feature | Description | Visual |
|---------|-------------|--------|
| **Adaptive Routing** | Every query gets its own strategy — no more one-size-fits-all | Strategy flow diagram |
| **Confidence Calibration** | Reliable confidence scores via Platt scaling and isotonic regression | Calibration curve |
| **Budget Optimization** | ML model allocates compute proportionally to query difficulty | Cost comparison chart |
| **Feedback Learning** | Thumbs up/down signals retrain the strategy selector over time | Feedback loop diagram |
| **Full Observability** | Per-query latency, confidence, cost, and strategy breakdown | Metrics dashboard |
| **Provider Agnostic** | Works with any LLM, any embedding model, any vector store | Integration logos |

---

## Use Cases Section

### Headline

**Built for teams that need retrieval to just work.**

| Use Case | Example Customer | Outcome |
|----------|-----------------|---------|
| **AI-powered support** | SaaS companies building customer-facing Q&A | 40% lower LLM costs, 24% better recall |
| **Internal knowledge search** | Enterprises with distributed document stores | Standardized retrieval across departments |
| **Research synthesis** | Teams analyzing large document collections | Multi-hop retrieval across 1000s of documents |
| **Compliance analysis** | Regulated industries needing auditable retrieval | Per-query confidence scores, full audit trail |

---

## Pricing Section

### Free

**$0** / month

- 1,000 queries/mo
- 1 project
- Community support
- API access
- Rate limited (10 req/s)

[Get Started](signup)

### Developer

**$49** / month

- 50,000 queries/mo
- 10 projects
- Email support
- API access
- Rate limited (100 req/s)

[Get Started](signup)

### Pro

**$199** / month

- 500,000 queries/mo
- Unlimited projects
- Priority support
- API access
- Rate limited (500 req/s)

[Get Started](signup)

### Enterprise

**Custom** pricing

- Unlimited queries
- Dedicated infrastructure
- SSO/SAML
- SLA guarantee
- On-premise option

[Contact Sales](/contact)

---

## FAQ Section

### Questions & Answers

**What makes Kairos different from LangChain or LlamaIndex?**

LangChain and LlamaIndex are frameworks — they give you building blocks to assemble your own RAG pipeline. Kairos is a platform — you send a query, and we handle strategy selection, optimization, and observability automatically. You don't need to be a retrieval expert.

**Do I need to host anything?**

No. The SaaS offering is fully managed. Sign up, create an API key, and start querying. If you need self-hosting, we offer Docker Compose and enterprise deployment options.

**What LLMs do you support?**

Kairos is provider-agnostic. We support Gemini, OpenAI (GPT-4, GPT-4o), Groq, and Ollama. You can use any combination — or bring your own.

**How is pricing calculated?**

You pay for query volume. Ingestion and storage are free within reasonable limits. Each tier has a monthly query allowance; overages are billed at the per-query rate for that tier.

**Can I try it for free?**

Yes. The Free tier includes 1,000 queries/month with no credit card required. Upgrade when you need more capacity.

**How does Kairos improve over time?**

Kairos includes a feedback loop. When users rate responses (thumbs up/down), those signals retrain the strategy selector and budget optimizer. The system gets smarter with every query.

**What about security and compliance?**

All data is encrypted in transit (TLS 1.3) and at rest. API keys are hashed with SHA-256. We offer SOC 2 compliance for Enterprise plans. Self-hosted options are available for air-gapped environments.

---

## CTA Section

### Headline

**Stop over-engineering simple queries.**

**Stop under-serving complex ones.**

### Subheading

Kairos adapts to every question. Start for free.

[Start building — it's free](/signup)

---

## Footer

### Links

| Product | Resources | Company | Legal |
|---------|-----------|---------|-------|
| Features | Documentation | About | Privacy |
| Pricing | API Reference | Blog | Terms |
| Integrations | SDKs | Contact | Cookies |
| Changelog | Status | Careers | |

### Social

GitHub · Twitter · Discord · LinkedIn

### Copyright

© 2026 Kairos. MIT License.
