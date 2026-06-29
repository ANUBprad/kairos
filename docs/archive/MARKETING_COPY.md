# Kairos — Marketing Copy

> **Document**: Complete Marketing Copy — Landing Page, Features, Pricing, FAQ  
> **Product**: Kairos — Adaptive Knowledge Intelligence  
> **Status**: LOCKED — Phase 13  
> **Author**: Apple / Stripe Product Marketing Team

---

## 1. Hero Section

### Headline (H1)

**Primary:**
> Adaptive Knowledge Intelligence

**Backup:**
> Intelligent Retrieval for Every Query

**Short (mobile):**
> Adaptive Knowledge Intelligence

### Subheadline

**Primary:**
> Upload documents. Ask questions. Get answers optimized per query — not one-size-fits-all retrieval.

**Backup:**
> The only retrieval platform that classifies every query and selects the optimal strategy automatically. Better answers. Lower costs. Full transparency.

**Short (mobile):**
> Upload documents. Ask questions. Get better answers.

### Trust Bar Stats

| Stat | Label |
|------|-------|
| +23.6% | Recall vs Naive RAG |
| -18.3% | Average cost reduction |
| p < 0.001 | Statistical significance |
| 1,802 | Tests passing |

### CTA Buttons

| Button | Copy | Destination |
|--------|------|-------------|
| Primary | ⚡ Get Started — It's Free | /signup |
| Secondary | ▸ Watch Demo | Scrolled to demo section |

### Code Snippet Title

> Get started in seconds

```python
pip install kairos-client
from kairos import Kairos
client = Kairos(api_key="sk-...")
response = client.query("What are our Q4 results?")
print(response.answer)
# "According to the Q4 2025 Financial Report..."
```

---

## 2. Social Proof Section

### Headline

> Trusted by engineering teams building the future

### Alt (if no logos yet)

> Join 500+ engineers already using Kairos

---

## 3. Problem Section

### Headline

> One retriever for every query? That's the problem.

### Subtitle

> Static retrieval doesn't understand the query. Kairos does.

### Before/After Labels

| Column | Label |
|--------|-------|
| Left | Static RAG |
| Right | Kairos Adaptive |

### Example Queries

**Simple Query:**
> "What's our refund policy?"
> Static: Full dense search (slow, expensive, $0.022)
> Kairos: Simple keyword search (2ms, $0.002)

**Complex Query:**
> "Compare Q1 vs Q3 revenue and explain the variance"
> Static: Same dense search (misses cross-document connections)
> Kairos: Multi-hop reasoning (3 hops, cited sources, $0.021)

### Closing Statement

> One strategy fits none. Every query deserves the right approach.

---

## 4. How It Works Section

### Headline

> How Kairos Works

### Subheadline

> One API call. Three retrieval strategies. Optimal results every time.

### Step Labels

| Step | Label | Description |
|------|-------|-------------|
| 1 | Classify | LLM analyzes query complexity in milliseconds |
| 2 | Select Strategy | Budget allocator chooses the optimal approach |
| 3 | Retrieve & Answer | Best retriever executes with confidence calibration |

### Fallback Callout

> 🔄 **Fallback built-in**: If confidence falls below threshold, Kairos automatically falls back to a safer strategy — never leaving your question unanswered.

---

## 5. Adaptive Engine Section

### Headline

> The Adaptive Engine

### Description

> Every query is processed through a decision system that understands what kind of question you're asking and selects the optimal retrieval path.

### Pipeline Labels

| Node | Label |
|------|-------|
| 1 | Query |
| 2 | Query Classifier |
| 3 | Strategy Selector |
| 4 | Simple (Hybrid Search) |
| 5 | Complex (Deep Semantic) |
| 6 | Multi-Hop (3 hops) |
| 7 | Fallback Manager |
| 8 | Answer + Sources |

### Bottom Note

> Every step is measured: latency, cost, confidence — visible per query.

---

## 6. Benchmark Section

### Headline

> Proven Results. 1,020 Queries. 5 Domains.

### Subheadline

> Statistically validated on standardized benchmarks across legal, medical, financial, technical, and general domains.

### Metric Cards

| Metric | Value | Detail |
|--------|-------|--------|
| Recall Improvement | +23.6% | vs Naive RAG baseline, p < 0.001 |
| Latency Reduction | -12.4% | vs baseline retrieval |
| Cost Savings | -18.3% | Cost-aware routing optimization |
| Query Success | 99.2% | Fallback rate: <0.8% |

### Methodology Link

> View full benchmark methodology and dataset →
> /product/benchmarks

---

## 7. Features Section

### Headline

> Everything you need for production retrieval

### Feature Cards

| Feature | Short Description | Long Description |
|---------|------------------|------------------|
| **Adaptive Planner** | Classifies every query → routes to the best retriever | Automatically analyzes query complexity and selects the optimal retrieval strategy — simple, complex, or multi-hop. |
| **Multi-Hop Reasoning** | Connects information across documents in 3 hops | Answers questions that require synthesizing information from multiple documents with iterative retrieval and confluence detection. |
| **Confidence Calibration** | Platt-scaled confidence with isotonic regression | Every answer includes a statistically calibrated confidence score so you know how much to trust the result. |
| **Cost Optimization** | Routes simple queries to cheap retrievers | Saves 18–33% by using the cheapest retriever that can handle each query, with full cost transparency. |
| **Benchmark Suite** | 1,020 gold-standard queries across 5 domains | Industry-first standardized benchmark with published methodology and statistical significance testing. |
| **Observability** | Per-query strategy, latency, cost, confidence | Every query returns a complete audit trail — no black boxes, no blind spots. |
| **Open Source** | MIT-licensed, community-driven | Free to use, inspect, modify, and contribute. No vendor lock-in, ever. |
| **Self-Hosted** | Deploy on your infrastructure | Run Kairos on your own servers with Docker Compose or Kubernetes. Your data never leaves your network. |
| **BYO Everything** | Any LLM, any vector store, any embeddings | Keep your existing stack — OpenAI, Anthropic, Ollama, Pinecone, ChromaDB, Weaviate. Kairos adapts to you. |

---

## 8. Architecture Section

### Headline

> Production Architecture

### Bullet Points

> • **Go API Gateway** — Auth, rate limiting, caching, Prometheus metrics
> • **Python Intelligence Engine** — Adaptive retrieval with query classification
> • **PostgreSQL + Redis + ChromaDB** — Battle-tested data stack
> • **Prometheus + Grafana** — Every query tracked, every metric visible
> • **1,802 passing tests** — Production confidence from day one

---

## 9. Integrations Section

### Headline

> Works with your stack

### Subheadline

> Bring Your Own Everything — keep your LLM, vector store, and embeddings. Kairos integrates with what you already use.

### Integration Categories

| Category | Providers |
|----------|-----------|
| LLMs | OpenAI · Anthropic · Google Gemini · Ollama · Any OpenAI-compatible API |
| Vector Stores | ChromaDB · Pinecone · Weaviate · Qdrant · Milvus |
| Languages | Python · TypeScript · Go (more coming) |

---

## 10. Pricing Section

### Headline

> Simple pricing. Transparent limits.

### Subheadline

> Start free. Upgrade when you grow. Enterprise when you need control.

### Plan Cards

**Free — $0**
> For individuals getting started
> • 100 documents
> • 1,000 queries/month
> • 1 user
> • Auto strategy only
> • Basic analytics
> • Community support
> [⚡ Get Started]

**Developer — $29/mo**
> For solo developers and small teams
> • 1,000 documents
> • 10,000 queries/month
> • 5 users
> • Auto + Manual strategy
> • Advanced analytics
> • Email support
> [⚡ Get Started]

**Team — $199/mo** (MOST POPULAR)
> For growing teams and startups
> • 10,000 documents
> • 100,000 queries/month
> • 25 users
> • Full strategy control
> • Custom dashboards
> • Slack priority support
> [⚡ Get Started]

**Enterprise — Custom**
> For organizations with advanced needs
> • Unlimited documents
> • Custom query volume
> • Unlimited users
> • Self-hosted option
> • SSO/SAML + audit logs
> • Dedicated support + SLA
> [Contact Sales]

### Bottom Note

> All plans include: API access, Python SDK, documentation. Save 20% with annual billing.

---

## 11. FAQ Section

### Headline

> Frequently Asked Questions

### Q&A Pairs

**Q: What is Kairos?**
A: Kairos is an adaptive knowledge intelligence platform. You upload documents, ask questions in natural language, and receive answers that are optimized per query — using the best retrieval strategy for each question. Unlike every other platform, Kairos doesn't use a one-size-fits-all retriever.

**Q: How is Kairos different from Perplexity or NotebookLM?**
A: Perplexity searches the public web. NotebookLM is a personal research tool. Kairos is a developer platform for building knowledge intelligence into your own products. We're API-first, open source, self-hostable, and designed for teams.

**Q: Is Kairos open source?**
A: Yes. The core intelligence engine is MIT-licensed and available on GitHub. The SaaS platform is a managed service built on top of the open source engine.

**Q: Can I self-host Kairos?**
A: Yes. Self-hosting is available on the Enterprise plan. You can deploy with Docker Compose or Kubernetes on your own infrastructure. Your data never leaves your network.

**Q: What happens when I hit my plan limits?**
A: You'll receive notifications as you approach limits. Queries above the limit will fail until you upgrade or the period resets. Documents above the limit cannot be uploaded until you free up space or upgrade.

**Q: Do I keep my existing LLM and vector store?**
A: Absolutely. Kairos works with any OpenAI-compatible LLM, any embedding model, and any vector store (ChromaDB, Pinecone, Weaviate, Qdrant). You bring your stack. Kairos makes it smarter.

**Q: Is there a free trial?**
A: The Free tier is effectively a trial — no time limit, just usage caps. You can use it indefinitely. When you need more capacity, upgrade to a paid plan.

**Q: How is my data handled?**
A: Your documents are encrypted at rest (AES-256) and in transit (TLS 1.3). We never train on your data. On the Enterprise plan with self-hosting, your data never leaves your infrastructure.

**Q: Do you offer discounts for startups or open source projects?**
A: Yes. We offer 50% off the Developer plan for verified open source maintainers and Y Combinator / equivalent startup accelerator participants.

**Q: Can I cancel anytime?**
A: Yes. Your data is retained for 30 days after cancellation in case you change your mind. After 30 days, all data is permanently deleted.

---

## 12. CTA Section

### Headline

> Start getting better answers today.

### Subheadline

> No credit card required. Sign up in 10 seconds with GitHub.

### CTA Button

> ⚡ Get Started — It's Free

### Trust Points

> • Free tier: 100 documents, 1,000 queries/month
> • No credit card required
> • Sign up in 10 seconds with GitHub

---

## 13. Navigation Labels

| Element | Label |
|---------|-------|
| Product dropdown trigger | Product |
| Product overview | Overview |
| Adaptive retrieval deep-dive | Adaptive Retrieval |
| Benchmarks page | Benchmarks |
| Pricing | Pricing |
| Documentation | Docs |
| Blog | Blog |
| Primary CTA | ⚡ Get Started |
| Secondary CTA | Sign In |

---

## 14. Page Titles & Meta Descriptions

| Page | Title Tag | Meta Description |
|------|-----------|------------------|
| Home | Kairos — Adaptive Knowledge Intelligence Platform | Upload documents, ask questions, and get answers optimized per query with Kairos's adaptive retrieval engine. 24% better recall. 18% lower cost. Open source. |
| Product | Kairos Product — Adaptive Retrieval Engine | Learn how Kairos's adaptive retrieval engine classifies every query and selects the optimal strategy — simple, complex, or multi-hop reasoning. |
| Benchmarks | Kairos Benchmarks — 23.6% Recall Improvement | View our statistically validated benchmark results across 1,020 queries and 5 domains. p < 0.001, Cohen's d = 0.89. |
| Pricing | Kairos Pricing — Free, Developer, Team, Enterprise | Simple, transparent pricing for teams of all sizes. Start free. Upgrade when you grow. Enterprise when you need control. |
| Docs | Kairos Documentation — Quickstart, API Reference, Guides | Complete documentation for Kairos's adaptive retrieval platform. Quickstart guide, API reference, SDK docs, and integration guides. |
| Sign Up | Kairos — Sign Up Free | Create your free Kairos account. No credit card required. 100 documents and 1,000 queries/month included. |

---

> *End of Marketing Copy*  
> *Next: Motion System → docs/MOTION_SYSTEM.md*  
> *Brand: Orange Leaf Logo — LOCKED*
