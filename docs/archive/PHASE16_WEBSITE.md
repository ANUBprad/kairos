# Phase 16 — Website & Product Specification

**Status:** Final  
**Version:** 2.0 (Supersedes UX_BLUEPRINT.md + WEBSITE_ARCHITECTURE.md)

---

This document specifies every public-facing and authenticated page of Kairos. It supersedes the Phase 15 UX_BLUEPRINT.md and WEBSITE_ARCHITECTURE.md. A frontend engineer can build the complete website from this specification.

---

## 1. Site Map (Final)

```
kairos.dev
│
├── /                          Landing page
├── /features                  Features overview + interactive demo
├── /pricing                   Pricing & plans
├── /docs                      Documentation hub
│   ├── /docs/quickstart       Quick start (5 min)
│   ├── /docs/api-reference    Full API reference
│   ├── /docs/sdks/python      Python SDK guide
│   ├── /docs/sdks/typescript  TypeScript SDK guide
│   ├── /docs/sdks/rest        REST API guide
│   ├── /docs/guides           Integration guides
│   ├── /docs/faq              Frequently asked questions
│   └── /docs/changelog        API changelog
├── /blog                      Product + engineering blog
│   ├── /blog/engineering      Technical deep-dives
│   ├── /blog/product          Product announcements
│   └── /blog/tutorials        How-to guides
├── /company                   Company information
│   ├── /company/about         About Kairos
│   ├── /company/team          Meet the team
│   └── /company/jobs          Careers
├── /contact                   Contact sales / support
├── /security                  Security & compliance
├── /changelog                 Public changelog
├── /status                    System status (external)
├── /legal                     Legal
│   ├── /legal/privacy         Privacy policy
│   ├── /legal/terms           Terms of service
│   └── /legal/cookies         Cookie policy
│
├── /login                     Sign in
├── /signup                    Sign up
├── /forgot-password           Password reset
│
└── /app                       Authenticated dashboard
    ├── /app/home              Dashboard home
    ├── /app/projects          Project list
    ├── /app/projects/[id]     Project detail
    ├── /app/queries           Query workspace
    ├── /app/queries/[id]      Query detail
    ├── /app/analytics         Analytics & insights
    ├── /app/api-keys          API key management
    ├── /app/billing           Billing & invoices
    ├── /app/settings          Account settings
    ├── /app/support            In-app support
    └── /app/docs              In-app documentation
```

### Page Grouping

| Group | Pages | Rendering | Auth required |
|-------|-------|-----------|---------------|
| Marketing | `/`, `/features`, `/pricing` | SSR/SSG | No |
| Docs | `/docs/*` | SSG + ISR | No |
| Blog | `/blog/*` | SSG + ISR | No |
| Company | `/company/*`, `/contact`, `/security` | SSR | No |
| Legal | `/legal/*` | SSG | No |
| Auth | `/login`, `/signup`, `/forgot-password` | SSR | No |
| Dashboard | `/app/*` | CSR | Yes |
| Status | `/status` | SSR (external) | No |

---

## 2. Landing Page (`/`)

### 2.1 Overview

**Purpose:** Convert technical visitors to signups.
**Target audience:** AI Engineering Leads, CTOs, individual developers.
**Narrative arc:** Curiosity → Understanding → Trust → Excitement → Confidence → Conversion.

### 2.2 Section-by-Section Specification

#### Section 1: Navigation

| Property | Value |
|----------|-------|
| Type | Sticky header, fixed top |
| Height | 64px (desktop), 56px (mobile) |
| Background | Transparent (initial) → `bg-primary/90 backdrop-blur-md` (after 200px scroll) |
| Transition | 300ms ease-out |
| z-index | 50 |

**Desktop layout:**
```
[🍁 Kairos logo 28px]    [Features] [Pricing] [Docs] [Blog]    [Sign In] [Start Building — it's free]
```

**Mobile layout:**
```
[🍁 Kairos logo 28px]                                          [☰]
> Full-screen overlay menu when hamburger toggled
```

#### Section 2: Hero

| Property | Value |
|----------|-------|
| Height | 100vh (min 600px) |
| Background | `#0B0F14` (dark) |
| Text color | White |
| Content | Centered, max-width 800px |

**Content vertical stack (centered, gap-8):**

1. **Badge** (optional, small): "Introducing Adaptive Retrieval" — `bg-brand-light/10 text-brand-primary border border-brand-primary/20 rounded-full px-4 py-1 text-sm`
2. **H1 headline:** "Every query deserves a different retrieval strategy." — `text-hero text-white font-extrabold tracking-tight`
3. **Subheading:** "Kairos classifies, plans, and routes every query to the optimal retrieval strategy — balancing quality, latency, confidence, and cost in real time. Not a chatbot. Not a vector database. An adaptive retrieval intelligence platform." — `text-lead text-gray-400 max-w-2xl mx-auto`
4. **CTA buttons (flex row, gap-4):**
   - Primary: "Start building — it's free" → `/signup`
   - Secondary: "See how it works" → `#how-it-works`
5. **Trust bar** (below buttons): "Powered by 1,802 tests · 5-domain benchmark validated · MIT License · No credit card required" — `text-sm text-gray-500`
6. **Hero visualization** (below trust bar, full width): Animated query flow diagram (see 2.3)

#### Section 3: Social Proof

| Property | Value |
|----------|-------|
| Background | `bg-secondary` |
| Padding | `py-16` |

**Content:**
```
"Used by AI teams at"
[Logo row — placeholder logos, grayscale, 120px height, opacity-40 hover:opacity-70]
"Join 500+ developers building with Kairos"
```

Logo placeholders (to be replaced with actual customer logos):
- Tech company logos (generic shape placeholders in MVP)
- GitHub stars count badge
- Discord community count

#### Section 4: Problem

| Property | Value |
|----------|-------|
| Background | `bg-primary` |
| Layout | 2-column grid (text left, visualization right) |
| Padding | `py-20` |

**Left column (text):**
- **H2:** "Most retrieval systems treat every query the same way."
- **Body:** "Simple questions like 'What's our refund policy?' need a 50ms keyword lookup. Complex questions like 'Compare Q1 and Q3 revenue and explain the variance' need multi-hop retrieval across documents, taking seconds. Traditional systems apply the same strategy to both. Simple queries are over-engineered and expensive. Complex queries return shallow results. You end up paying GPT-4 prices for questions that a BM25 search could answer."

**Right column (visualization):**
Comparison graphic showing:
- Left side: Traditional system — same path for all queries (waste / fail labels)
- Right side: Kairos — three branching paths with labels (optimized)
- SVG animated, 2px stroke, brand-orange highlights

#### Section 5: How It Works

| Property | Value |
|----------|-------|
| Background | `bg-primary` |
| Padding | `py-20` |
| ID | `how-it-works` |

**Content:**
- **H2 (centered):** "How it works"
- **3-step horizontal (desktop) / vertical (mobile) with connecting line:**

Each step card:
```
┌─────────────────────┐
│   [icon]  Step 1    │
│                     │
│   Classify          │
│                     │
│   Your query        │
│   arrives. Kairos   │
│   analyzes          │
│   complexity in     │
│   milliseconds.     │
│                     │
│   ↓ 52% of queries  │
│   classified as     │
│   "simple"          │
└─────────────────────┘
```

| Step | Icon | Title | Description | Badge |
|------|------|-------|-------------|-------|
| 1 | BrainCircuit | Classify | Query complexity analysis, domain detection, intent classification | ~15ms |
| 2 | GitBranch | Plan | Optimal strategy selection, compute budget allocation | ~10ms |
| 3 | Sparkles | Retrieve | Execute strategy, calibrate confidence, return answer with citations | ~150ms-2s |

**Connecting line:** Horizontal dashed line between cards (desktop) or vertical (mobile), with animated dot traveling along it.

#### Section 6: Adaptive Routing Visualization

| Property | Value |
|----------|-------|
| Background | `#0B0F14` (dark) |
| Padding | `py-20` |

**Content:**
- **H2 (centered, white):** "Watch Kairos decide in real time."
- **Body (centered, gray):** "Every query triggers a decision chain: complexity analysis → strategy selection → budget allocation → retrieval execution → confidence calibration. Each step is instrumented and visible."
- **Full-width animated diagram** (SVG-based):

```
[Input Node: "What is our refund policy?"]
       │
       ▼
[Classifier Node: "Simple query detected"]
       │
       ├─── Simple ──────────► [Hybrid Search] ──► [Answer + 0.94 conf]
       │                       ~133ms · $0.01
       ├─── Complex ──────────► [MMR + Rerank] ──► [Answer + 0.92 conf]
       │                       ~170ms · $0.018
       └─── Multi-Hop ───────► [Iterative Ret.] ──► [Answer + 0.87 conf]
                               ~450ms · $0.03
```

- Animation: Path tracing along the active route, nodes light up on hover
- Interactive: Click any node for explanation tooltip
- Real-time metrics update on each node (animated counter for latency/cost)
- Query text input at top to simulate different queries (demo mode)

#### Section 7: Benchmarks

| Property | Value |
|----------|-------|
| Background | `bg-primary` |
| Padding | `py-20` |

**Content:**
- **H2 (centered):** "Validated across 5 domains. Better than every fixed strategy."
- **Leaderboard table:**

| Rank | Mode | Composite | Recall | Latency | Cost/Query |
|------|------|-----------|--------|---------|------------|
| 1 | **Kairos Adaptive** | **0.890** | **0.940** | 163ms | **$0.0145** |
| 2 | Always Multi-Hop | 0.800 | 0.910 | 190ms | $0.0220 |
| 3 | Always Complex | 0.780 | 0.900 | 170ms | $0.0184 |
| 4 | Always Simple | 0.750 | 0.880 | 133ms | $0.0100 |
| 5 | Naive RAG | 0.720 | 0.850 | 145ms | $0.0123 |

- Kairos Adaptive row highlighted with `bg-brand-light/10` tint
- Animated: rows fade in sequentially (stagger 100ms) on scroll into view
- Footnote: "Benchmarked on 1,020 queries across finance, legal, healthcare, technology, and general domains"
- CTA below: "Read the full benchmark methodology →" → link to docs

#### Section 8: Features Grid

| Property | Value |
|----------|-------|
| Background | `bg-secondary` |
| Layout | 3×2 grid (desktop), 1 column (mobile) |
| Padding | `py-20` |

**6 feature cards:**

| Feature | Icon | Description |
|---------|------|-------------|
| Adaptive Routing | GitBranch | Every query gets its own strategy — no more one-size-fits-all |
| Confidence Calibration | Gauge | Reliable confidence scores via Platt scaling and isotonic regression |
| Budget Optimization | DollarSign | ML model allocates compute proportionally to query difficulty |
| Feedback Learning | RefreshCw | Thumbs up/down signals retrain the strategy selector over time |
| Full Observability | BarChart3 | Per-query latency, confidence, cost, and strategy breakdown |
| Provider Agnostic | Plug | Works with any LLM, any embedding model, any vector store |

Each card: 24px icon (brand-orange), H3 title, body description, hover → lift + shadow.

#### Section 9: Architecture

| Property | Value |
|----------|-------|
| Background | `#0B0F14` (dark) |
| Padding | `py-20` |
| Layout | Image left (or above on mobile), text right |

**Content:**
- **H2 (white):** "Built for production from day one."
- **Body (gray):** "Kairos runs on a Go-based API gateway with a Python intelligence backend — the same architecture that powers Stripe, Cloudflare, and Uber. Go handles routing, auth, rate limiting, and caching. Python handles ML inference, retrieval, and calibration. Postgres for billing data. Redis for caching. ChromaDB for vectors. Prometheus + Grafana for observability."
- **Architecture diagram:** Clean SVG showing the stack:
  ```
  [Client] → [Go Gateway] → [Python Intelligence]
                ↓                    ↓
            [Redis]             [ChromaDB]
            [Postgres]     [Prometheus/Grafana]
  ```

#### Section 10: Integrations

| Property | Value |
|----------|-------|
| Background | `bg-primary` |
| Padding | `py-16` |

**Content:**
- **H3 (centered):** "Works with your stack."
- **Logo grid** (2 rows × 4 cols):
  - LLMs: OpenAI (GPT-4o), Anthropic (Claude), Google (Gemini), Groq, Ollama
  - Vector stores: ChromaDB, Pinecone, Weaviate, Qdrant
  - Observability: Prometheus, Grafana, OpenTelemetry
  - Deployment: Docker, Kubernetes, Vercel
- Each logo: grayscale, 80px height, `opacity-40 hover:opacity-70`

#### Section 11: Use Cases

| Property | Value |
|----------|-------|
| Background | `bg-secondary` |
| Layout | 2×2 grid |
| Padding | `py-20` |

**4 use case cards:**

| Use case | Example | Outcome |
|----------|---------|---------|
| AI-powered support | SaaS companies building customer-facing Q&A | 40% lower LLM costs, 24% better recall |
| Internal knowledge search | Enterprises with distributed document stores | Standardized retrieval across departments |
| Research synthesis | Teams analyzing large document collections | Multi-hop retrieval across 1000s of documents |
| Compliance analysis | Regulated industries needing auditable retrieval | Per-query confidence scores, full audit trail |

#### Section 12: Pricing

| Property | Value |
|----------|-------|
| Background | `bg-primary` |
| Padding | `py-20` |
| Layout | 4-card row (desktop), stacked (mobile) |

**4 pricing tiers:**

| Feature | Free | Developer | Pro | Enterprise |
|---------|------|-----------|-----|------------|
| Price | $0 | $49/mo | $199/mo | Custom |
| Badge | — | — | "Most Popular" | — |
| Queries/mo | 1,000 | 50,000 | 500,000 | Unlimited |
| Projects | 1 | 10 | Unlimited | Unlimited |
| Support | Community | Email | Priority | Dedicated + SLA |
| Rate limit | 10 req/s | 100 req/s | 500 req/s | Custom |
| SSO | — | — | — | ✅ |
| Dedicated infra | — | — | — | ✅ |
| CTA | "Get Started" | "Start Free Trial" | "Start Free Trial" | "Contact Sales" |

Pro card highlighted: 2px brand-orange border, "Most Popular" badge top-right, subtle brand-tinted shadow.

#### Section 13: FAQ

| Property | Value |
|----------|-------|
| Background | `bg-secondary` |
| Padding | `py-16` |
| Layout | Max-width 720px, centered |

**Questions (accordion):**

| Q | A |
|---|--|
| What makes Kairos different from LangChain or LlamaIndex? | LangChain and LlamaIndex are frameworks — they give you building blocks to assemble your own RAG pipeline. Kairos is a platform — you send a query, and we handle strategy selection, optimization, and observability automatically. You don't need to be a retrieval expert. |
| How is this different from just using GPT-4 with search? | GPT-4 with search (or Bing) applies the same approach to every query. It's expensive for simple lookups and under-powered for complex synthesis. Kairos classifies every query and routes it to the optimal strategy — getting better results at lower cost. |
| Do I need to host anything? | No. The SaaS offering is fully managed. Sign up, create an API key, and start querying. If you need self-hosting, we offer Docker Compose and enterprise deployment options. |
| What LLMs do you support? | Kairos is provider-agnostic. We support Gemini, OpenAI (GPT-4, GPT-4o), Groq, and Ollama. You can use any combination — or bring your own. |
| How is pricing calculated? | You pay for query volume. Ingestion and storage are free within reasonable limits. Each tier has a monthly query allowance. |
| What counts as a query? | Every request to the `/v1/query` endpoint counts as one query. Streaming responses count as one query regardless of stream length. Document ingestion, API key management, and analytics calls do not count toward quota. |
| Can I try it for free? | Yes. The Free tier includes 1,000 queries/month with no credit card required. Upgrade when you need more capacity. |
| How does Kairos improve over time? | Kairos includes a feedback loop. When users rate responses (thumbs up/down), those signals retrain the strategy selector and budget optimizer. The system gets smarter with every query. |
| What about security and compliance? | All data is encrypted in transit (TLS 1.3) and at rest. API keys are hashed with SHA-256. We offer SOC 2 compliance for Enterprise plans. Self-hosted options are available for air-gapped environments. |

#### Section 14: CTA

| Property | Value |
|----------|-------|
| Background | `bg-brand-primary` (orange) with subtle gradient |
| Padding | `py-24` |
| Text color | White |

**Content (centered, max-width 600px):**
- **H2 (white):** "Stop over-engineering simple queries."
- **H2 (white, second line):** "Stop under-serving complex ones."
- **Body (white/80):** "Kairos adapts to every question. Start for free."
- **CTA:** "Start building — it's free" (white bg, brand-orange text, large)
- **Trust line:** "No credit card required · Cancel anytime · 1,000 free queries"

#### Section 15: Footer

| Property | Value |
|----------|-------|
| Background | `#0B0F14` (dark) |
| Padding | `py-16` |
| Text color | Gray |

**4-column layout + bottom bar:**

| Product | Resources | Company | Legal |
|---------|-----------|---------|-------|
| Features | Documentation | About | Privacy Policy |
| Pricing | API Reference | Blog | Terms of Service |
| Integrations | SDKs | Contact | Cookie Policy |
| Changelog | Status | Careers | |

**Bottom bar:**
- Logo (28px) + "© 2026 Kairos. MIT License." + Social icons (GitHub, Twitter, Discord, LinkedIn)

---

## 3. Interactive Demo (Homepage)

### 3.1 Overview

**Purpose:** Let visitors try Kairos without signing up. Demonstrate value in <30 seconds.
**Location:** Embedded in the hero section (below trust bar) and repeated in a full-width section.

### 3.2 UI Specification

```
┌──────────────────────────────────────────────────────┐
│ 🔍 Try it yourself — no login required               │
│                                                       │
│ ┌────────────────────────────────────────────────┐  │
│ │  "What is our refund policy?"                   │  │
│ │                                          [→]   │  │
│ └────────────────────────────────────────────────┘  │
│                                                       │
│ ┌────────────────────────────────────────────────┐  │
│ │  [Animated flow visualization]                   │  │
│ │                                                   │  │
│ │  Query → Classifying... → Planning... →           │  │
│ │  Retrieving... → Done!                            │  │
│ │                                                   │  │
│ │  Strategy: Hybrid         Confidence: 0.94        │  │
│ │  Latency: 163ms           Cost: $0.0145           │  │
│ │                                                   │  │
│ │  Based on policy.pdf (p.3):                       │  │
│ │  "Customers may return items within 30 days..."   │  │
│ │                                                   │  │
│ │  [View Sources (4)] [Copy Response] [Run Again]  │  │
│ └────────────────────────────────────────────────┘  │
│                                                       │
│  [Try: "Compare Q1 and Q3 revenue"] [Try: "Explain   │
│   our compliance requirements"] [Try: "Summarize our  │
│   hiring policy"]                                     │
└──────────────────────────────────────────────────────┘
```

### 3.3 Behavior

| State | Visual | Timing |
|-------|--------|--------|
| Initial | Input field focused, placeholder text, cursor blinking | — |
| Query submitted | Input fades, "Analyzing query..." with spinner | 0ms |
| Classifying | Flow node 1 lights up, "Simple query detected" | 200ms |
| Planning | Flow node 2 lights up, "Selected: hybrid strategy" | 400ms |
| Retrieving | Flow node 3 lights up, "Found 3 relevant documents" | 800ms |
| Answering | Flow node 4 lights up, answer text streams in character by character | 1.2s-2s |
| Complete | Full result with all metrics, sources, and action buttons | Done |
| Error | "Query failed. Try a different question." with retry button | — |

### 3.4 Predefined Queries (Clickable)

| Query | Response Strategy | Confidence | Latency | Cost |
|-------|-------------------|------------|---------|------|
| "What is our refund policy?" | hybrid | 0.94 | 163ms | $0.0145 |
| "Compare Q1 and Q3 revenue" | multi-hop | 0.87 | 450ms | $0.032 |
| "Explain our compliance requirements" | complex | 0.91 | 280ms | $0.021 |
| "Who is the CEO?" | simple | 0.96 | 110ms | $0.009 |

### 3.5 Data Source

The demo uses a pre-loaded document set (3-5 public documents about a fictional company). Documents are pre-chunked, embedded, and stored. No actual ingestion happens. Demo queries map to pre-computed results for zero-latency response.

### 3.6 Mobile Adaptation

- Input field full width
- Flow visualization simplified (static diagram with step labels instead of animation)
- Results stacked vertically
- Predefined query chips wrap to 2 columns

---

## 4. Features Page (`/features`)

### 4.1 Overview

**Purpose:** Detailed explanation of every capability.
**Narrative:** Scroll-based storytelling. Each section reveals a new aspect of the product.

### 4.2 Sections

| Section | Content | Visual |
|---------|---------|--------|
| Hero | "Adaptive Retrieval, Explained" | Full-width, dark bg |
| Adaptive Routing | Deep dive with interactive flow diagram | Interactive SVG |
| Confidence Calibration | How Platt scaling + isotonic regression work | Calibration curve chart |
| Budget Optimization | Cost-quality tradeoff shown visually | Bar chart comparison |
| Multi-Strategy | The 3 strategies compared side-by-side | 3-column feature comparison |
| Feedback Learning | How the system improves over time | Feedback loop diagram |
| Observability | Metrics dashboard preview | Simulated dashboard screenshot |
| Enterprise | SSO, audit logs, dedicated deployment | Feature list with icons |

---

## 5. Pricing Page (`/pricing`)

### 5.1 Overview

**Purpose:** Convert interested users to signups.
**Layout:** Header → tier cards → comparison table → FAQ → CTA.

### 5.2 Comparison Table

Expandable table below pricing cards showing all features across all tiers:

| Feature | Free | Developer | Pro | Enterprise |
|---------|------|-----------|-----|------------|
| Queries per month | 1,000 | 50,000 | 500,000 | Unlimited |
| Projects | 1 | 10 | Unlimited | Unlimited |
| API access | ✅ | ✅ | ✅ | ✅ |
| Rate limit | 10 req/s | 100 req/s | 500 req/s | Custom |
| Streaming (SSE) | ✅ | ✅ | ✅ | ✅ |
| Strategy visualization | — | ✅ | ✅ | ✅ |
| Confidence scores | ✅ | ✅ | ✅ | ✅ |
| Cost per query breakdown | — | ✅ | ✅ | ✅ |
| Analytics dashboard | Basic | Detailed | Full | Full |
| Team members | 1 | 1 | 1 | Unlimited |
| SSO/SAML | — | — | — | ✅ |
| Dedicated support | — | — | Priority | 24/7 SLA |
| Dedicated infrastructure | — | — | — | ✅ |
| On-premise deployment | — | — | — | ✅ |
| Audit logging | — | — | — | ✅ |

---

## 6. Auth Pages

### 6.1 Login (`/login`)

```
┌──────────────────────┐
│     [🍁 40px]        │
│                       │
│  Welcome back         │
│  Sign in to Kairos    │
│                       │
│  ┌──────────────────┐ │
│  │ Email            │ │
│  └──────────────────┘ │
│                       │
│  ┌──────────────────┐ │
│  │ Password         │ │
│  └──────────────────┘ │
│                       │
│  [Sign In]            │
│                       │
│  ───── or ─────      │
│                       │
│  [Continue with Google]│
│  [Continue with GitHub]│
│                       │
│  Forgot password?     │
│  Don't have an account?│
│  Sign up              │
└──────────────────────┘
```

### 6.2 Sign Up (`/signup`)

- Same layout as login
- Fields: Name, Email, Password, Confirm Password
- "By signing up, you agree to our Terms of Service and Privacy Policy" checkbox
- Google OAuth, GitHub OAuth
- "Already have an account? Sign in"

### 6.3 Forgot Password (`/forgot-password`)

- Email input → "Send reset link" button
- Confirmation screen: "Check your email for the reset link"
- Resend option after 60 seconds

---

## 7. Dashboard (`/app/*`)

### 7.1 Dashboard Layout

```
┌──────────────┬──────────────────────────────────────────────┐
│  [sidebar]   │  [topbar]                                    │
│  240px fixed │  height: 64px                                │
│              │  Breadcrumb | Title | Search | Notifs | Avatar│
│              ├──────────────────────────────────────────────┤
│  [Logo]      │                                              │
│  [Nav links] │  [Content area — page-specific]              │
│  [Active     │                                              │
│   indicator] │                                              │
│              │                                              │
│              │                                              │
│  [User]      │                                              │
│  [Settings]  │                                              │
└──────────────┴──────────────────────────────────────────────┘
```

### 7.2 Sidebar Navigation

| Section | Icon | Link | Active pattern |
|---------|------|------|----------------|
| Home | Home | `/app/home` | Exact match |
| Projects | FolderKanban | `/app/projects` | Starts with |
| Queries | Terminal | `/app/queries` | Starts with |
| Analytics | BarChart3 | `/app/analytics` | Starts with |
| API Keys | Key | `/app/api-keys` | Exact match |
| Billing | CreditCard | `/app/billing` | Exact match |
| | | | |
| Settings | Settings | `/app/settings` | Exact match |
| Support | LifeBuoy | `/app/support` | Exact match |
| Docs | BookOpen | `/app/docs` | Exact match |

### 7.3 Dashboard Home (`/app/home`)

**Purpose:** At-a-glance overview of account status and recent activity.

**Widgets (top row, 4 metric cards):**
| Metric | Format | Source |
|--------|--------|--------|
| Total Queries | `1,234` (number) | Current month |
| Avg Confidence | `87.2%` (percentage + trend arrow) | Last 7 days |
| Avg Latency | `163ms` (milliseconds + trend) | Last 7 days |
| Avg Cost | `$0.0145` (currency + trend) | Last 7 days |

**Widgets (middle row, 2 columns):**
| Left: Recent Queries (list) | Right: Usage Chart (7-day) |
|-----------------------------|----------------------------|
| Last 10 queries, each showing: | Area chart, query volume |
| "What is refund policy" | x-axis: dates |
| [hybrid] [0.94] [163ms] | y-axis: query count |
| Click → query detail | Interactive tooltip |

**Widgets (bottom row, 2 columns):**
| Left: Strategy Distribution | Right: Quick Actions |
|----------------------------|---------------------|
| Donut chart | [+ New Query] |
| Simple: 52% | [+ New Project] |
| Complex: 31% | [+ Create API Key] |
| Multi-hop: 17% | [View Docs] |

### 7.4 Projects (`/app/projects`)

**List view:**
```
┌──────────────────────────────────────────────────────────┐
│  Projects                              [+ New Project]    │
│                                                            │
│  [Search projects...]                                      │
│                                                            │
│  ┌──────────────────────────────────────────────────────┐ │
│  │ Project Name    │ Queries │ Documents │ Created      │ │
│  │ ─────────────── │ ─────── │ ───────── │ ─────────── │ │
│  │ Production API  │ 42,891  │ 47        │ Jun 1, 2026 │ │
│  │ Internal Search │ 12,344  │ 23        │ May 15, 2026│ │
│  │ Test Project    │ 847     │ 5         │ Jun 20, 2026│ │
│  └──────────────────────────────────────────────────────┘ │
│                                                            │
│  Showing 3 of 3 projects                                   │
└──────────────────────────────────────────────────────────┘
```

**Detail view (`/app/projects/[id]`):**
- Project name + description (editable)
- Usage stats (queries this month, documents, API keys)
- Recent queries filterable by this project
- Settings tab (rename, delete — with confirmation)

### 7.5 Query Workspace (`/app/queries`)

**Purpose:** Execute queries and see results with full strategy visualization.

**Layout:**
```
┌──────────────────────────────────────────────────────────┐
│ ← Back to Home          New Query      History    ↗      │
│                                                            │
│ Project: [My Project ▼]                                    │
│                                                            │
│ ┌──────────────────────────────────────────────────────┐ │
│ │  Ask a question about your documents...              │ │
│ │                                              [→]    │ │
│ └──────────────────────────────────────────────────────┘ │
│                                                            │
│ ┌──────────────────────────────────────────────────────┐ │
│ │  Strategy: Complex (MMR + Cross-Encoder Rerank)       │ │
│ │  Confidence: 0.92  ·  Latency: 163ms  ·  Cost:       │ │
│ │  $0.0145                                              │ │
│ │                                                       │ │
│ │  [Animated flow: Query → Classify → Plan → Retrieve  │ │
│ │   → Answer] — same as homepage demo but with real     │ │
│ │   data and clickable steps for drill-down             │ │
│ └──────────────────────────────────────────────────────┘ │
│                                                            │
│ ┌──────────────────────────────────────────────────────┐ │
│ │  Answer                                               │ │
│ │                                                       │ │
│ │  Based on your refund policy (policy.pdf, p.3):       │ │
│ │  "Customers may return items within 30 days..."       │ │
│ │                                                       │ │
│ │  [👍] [👎] [📋 Copy] [📥 Export]                     │ │
│ └──────────────────────────────────────────────────────┘ │
│                                                            │
│ ┌──────────────────────────────────────────────────────┐ │
│ │  Retrieved Sources (4)                                │ │
│ │  1. policy.pdf, p.3 — "Return Policy" — 0.94         │ │
│ │  2. policy.pdf, p.5 — "Exceptions" — 0.87            │ │
│ │  3. faq.pdf, p.1 — "Common Questions" — 0.76         │ │
│ │  4. terms.pdf, p.12 — "Refund Eligibility" — 0.71    │ │
│ └──────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────┘
```

**Query History** (sidebar or bottom panel):
- List of recent queries with date, text, strategy, confidence
- Click to restore query + results
- Filter by date range, strategy, project
- Search within history
- Clear history button (with confirmation)

### 7.6 Analytics (`/app/analytics`)

**Tabs:**
| Tab | Content | Charts |
|-----|---------|--------|
| Overview | 4 KPI cards + 7-day trend | Line chart, stat cards |
| Queries | Volume, strategy breakdown | Stacked bar, donut |
| Cost | Cost/query, cumulative spend | Area chart, bar |
| Performance | Latency (P50, P95, P99), error rate | Multi-line, gauge |

**Date range picker:** 7d | 30d | 90d | Custom
**Export:** CSV download for any chart view.

### 7.7 API Keys (`/app/api-keys`)

**List:**
```
┌──────────────────────────────────────────────────────────┐
│  API Keys                              [+ Create Key]     │
│                                                            │
│  Name       │ Prefix          │ Created     │ Last Used   │
│  ────────── │ ─────────────── │ ──────────  │ ──────────  │
│  Production │ kai_sk_prod_... │ Jun 1, 2026 │ Just now    │
│  Staging    │ kai_sk_stag_... │ Jun 5, 2026 │ 2h ago      │
│  Test       │ kai_sk_test_... │ Jun 20, 2026│ Never       │
└──────────────────────────────────────────────────────────┘
```

**Create Key Modal:**
- Name input
- Scope: project selector
- Optional expiration date
- Key display on creation (show once, copy button)
- Warning: "Copy this key now. You won't be able to see it again."

**States:**
- Empty: "Create your first API key to start building"
- Creating: Modal with "Key created" + key display
- Revoked: Key grayed out, "Revoked" badge, confirm dialog before revoke
- Error: "Failed to create key. Try again."

### 7.8 Billing (`/app/billing`)

**Sections:**
| Section | Content |
|---------|---------|
| Current Plan | Plan name, price, usage bar (X of Y queries used), "Change Plan" button |
| Usage Details | Current period usage vs quota, per-project breakdown |
| Invoices | Table: Date, Amount, Status, Download link |
| Payment Method | Card type + last 4 digits, expiry, "Update" button |

**States:**
- Free: Upgrade prompts, "You've used X of 1,000 queries"
- Paid: Plan details, usage, next billing date
- Over-limit: Warning banner "You've exceeded your query limit. Upgrade to continue."
- Past due: Error state "Payment failed. Update your payment method."

### 7.9 Settings (`/app/settings`)

**Tabs:**
| Tab | Fields |
|-----|--------|
| Profile | Name, email, avatar upload |
| Account | Change password, email preferences, delete account (with confirmation cascade) |
| Notifications | Usage alerts (80%, 100%, 150% of quota), product updates, weekly digest |
| Appearance | Theme toggle (Light / Dark / System) |
| API | Default project, default strategy override, webhook URLs |

---

## 8. Other Pages

### 8.1 Docs (`/docs`)

- Sidebar navigation (categories: Quickstart, API Reference, SDKs, Guides, FAQ)
- MDX-based content rendered with `@tailwindcss/typography`
- Search bar with Fuse.js (MVP) or Algolia DocSearch (post-v1)
- Code snippets with syntax highlighting and copy button
- Dark mode toggle
- "Was this helpful?" feedback at bottom of each page

### 8.2 Blog (`/blog`)

- Card grid layout: featured post (large), recent posts (2-column grid)
- Categories: Engineering, Product, Tutorials
- Tags per post
- RSS feed link in header
- Author bio at bottom of each post
- Newsletter signup CTA in sidebar

### 8.3 Security (`/security`)

- Encryption overview (TLS 1.3, AES-256 at rest)
- API key hashing
- SOC 2 compliance status
- Data retention policy
- Vulnerability disclosure program
- Compliance certifications (planned)

### 8.4 Status (`/status`)

- External status page (Better Uptime or similar)
- Service status indicators (operational / degraded / outage)
- Incident history
- Subscribe to updates

---

## 9. Data Refresh Strategy

| Page | Strategy | Refresh interval | Notes |
|------|----------|-----------------|-------|
| Landing page | SSG | Per deploy | Static content |
| Features | SSG | Per deploy | Static content |
| Pricing | SSG | Per deploy (or ISR 1h) | Update when tiers change |
| Docs | SSG + ISR | On content change | ISR when docs updated |
| Blog | SSG + ISR | On publish | ISR when new post published |
| Auth pages | SSR | Per request | Session-dependent |
| Dashboard home | CSR + TanStack Query | 30s stale, refetch on focus | Real-time-ish |
| Projects | CSR + TanStack Query | On mutation, on focus | Optimistic updates on CRUD |
| Queries | CSR + TanStack Query | On submission | New query = new fetch |
| Analytics | CSR + TanStack Query | 60s stale | Charts cached longer |
| API Keys | CSR + TanStack Query | On mutation, on focus | Key create = invalidate list |
| Billing | CSR + TanStack Query | On focus, on mutation | Stripe data via webhook |
| Settings | CSR + TanStack Query | On focus, on mutation | Profile updates |

---

## 10. Conversion Funnels

### Signup Funnel

```
Landing page → Signup → Verify email → Quickstart → First query
    ↓            ↓          ↓              ↓             ↓
  Any page   /signup    Check email    /app/home    Query workspace
```

### Upgrade Funnel

```
Dashboard → Usage alerts → Pricing comparison → Stripe checkout → Pro dashboard
    ↓            ↓              ↓                   ↓                ↓
  /app/home   Banner:       /app/billing        Stripe portal    /app/billing
             "80% used"
```

### Enterprise Funnel

```
Landing page → Pricing → Contact sales → Demo → Trial → Purchase
    ↓            ↓          ↓             ↓       ↓        ↓
  /pricing    /pricing   /contact       Zoom    Trial    Contract
```
