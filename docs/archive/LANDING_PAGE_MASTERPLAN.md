# Kairos — Landing Page Masterplan

> **Document**: Complete Landing Page Design — Wireframes, Layout & Section Specs  
> **Product**: Kairos — Adaptive Knowledge Intelligence  
> **Status**: LOCKED — Phase 13  
> **Author**: Apple / Linear / Vercel Design Team

---

## 1. Design Direction

### Reference Aesthetic

| Property | Kairos Landing Page |
|----------|-------------------|
| **Primary reference** | Linear.app — clean typography, subtle animations, dark theme, data-driven |
| **Secondary reference** | Vercel.com — developer credibility, code snippets, performance focus |
| **Tertiary reference** | Stripe.com/payments — clear hierarchy, generous whitespace, confidence |

### Visual Principles

| Principle | Application |
|-----------|-------------|
| **Content-first** | Every section answers: "Why should I care?" before "How does it work?" |
| **Data as design** | Benchmark numbers, charts, and metrics are the primary visual content — not illustrations |
| **Narrative flow** | Problem → Solution → Proof → Trust → Action. The page tells a story. |
| **Developer credibility** | Code snippets, architecture diagrams, and benchmark methodology signal technical authenticity |
| **One leaf, one accent** | The orange leaf is the only decorative element. Orange is the only accent color. |

---

## 2. Page Layout

### Full Page Wireframe

```
┌──────────────────────────────────────────────────────────────────────────────┐
│  SECTION 1: NAVIGATION (sticky)                                               │
│  ┌────────────────────────────────────────────────────────────────────────┐  │
│  │ 🍁 Kairos    Product ▼   Pricing   Docs   Blog    [⚡ Get Started]    │  │
│  └────────────────────────────────────────────────────────────────────────┘  │
│                                                                                │
│  SECTION 2: HERO                                                               │
│  ┌────────────────────────────────────────────────────────────────────────┐  │
│  │                       🍁 (64px, centered)                               │  │
│  │                                                                          │  │
│  │              Adaptive Knowledge Intelligence                              │  │
│  │                                                                          │  │
│  │   Upload documents. Ask questions. Get answers optimized per query —     │  │
│  │   not one-size-fits-all retrieval.                                        │  │
│  │                                                                          │  │
│  │       [⚡ Get Started]          [▸ Watch Demo]                           │  │
│  │                                                                          │  │
│  │   +23.6% Recall  |  -18% Cost  |  p < 0.001  |  1,802 Tests Passing     │  │
│  │                                                                          │  │
│  │   ┌──────────────────────────────────────────────────────────────────┐  │  │
│  │   │  pip install kairos-client                                       │  │  │
│  │   │  from kairos import Kairos                                       │  │  │
│  │   │  client = Kairos(api_key="sk-...")                               │  │  │
│  │   │  response = client.query("What are our Q4 results?")            │  │  │
│  │   │  print(response.answer)  # "According to the financial report..."│  │  │
│  │   └──────────────────────────────────────────────────────────────────┘  │  │
│  └────────────────────────────────────────────────────────────────────────┘  │
│                                                                                │
│  SECTION 3: SOCIAL PROOF                                                       │
│  ┌────────────────────────────────────────────────────────────────────────┐  │
│  │   Trusted by engineering teams building the future                       │  │
│  │   [Logo Row: 6 company logos in grayscale, #6B7A8F]                     │  │
│  └────────────────────────────────────────────────────────────────────────┘  │
│                                                                                │
│  SECTION 4: PROBLEM                                                            │
│  ┌────────────────────────────────────────────────────────────────────────┐  │
│  │   One retriever for every query? That's the problem.                    │  │
│  │                                                                          │  │
│  │   ┌──────── STATIC RAG ─────────┐   ┌───────── KAIROS ──────────┐       │  │
│  │   │ "What's our refund policy?" │   │ "What's our refund policy?"│       │  │
│  │   │   → Full dense search      │   │   → Simple keyword ($0.002)│       │  │
│  │   │     (slow, expensive)      │   │     (2ms response)          │       │  │
│  │   │                            │   │                              │       │  │
│  │   │ "Compare Q1 vs Q3 revenue" │   │ "Compare Q1 vs Q3 revenue"   │       │  │
│  │   │   → Same dense search     │   │   → Multi-hop (3 hops)       │       │  │
│  │   │     (misses connections)   │   │     ($0.021, cited sources)  │       │  │
│  │   └────────────────────────────┘   └──────────────────────────────┘       │  │
│  │                                                                          │  │
│  │   Static retrieval doesn't understand the query. Kairos does.            │  │
│  └────────────────────────────────────────────────────────────────────────┘  │
│                                                                                │
│  SECTION 5: HOW IT WORKS                                                       │
│  ┌────────────────────────────────────────────────────────────────────────┐  │
│  │   How Kairos Works                                                      │  │
│  │   One API call. Three retrieval strategies. Optimal results every time.  │  │
│  │                                                                          │  │
│  │    [① Classify] ──→ [② Select Strategy] ──→ [③ Retrieve] ──→ Answer     │  │
│  │                                                                          │  │
│  │   ┌──────────────────────────────────────────────────────────────┐      │  │
│  │   │ 🔄 Fallback: If confidence < threshold, auto-degrades safely │      │  │
│  │   └──────────────────────────────────────────────────────────────┘      │  │
│  └────────────────────────────────────────────────────────────────────────┘  │
│                                                                                │
│  SECTION 6: ADAPTIVE ENGINE VISUALIZATION                                      │
│  ┌────────────────────────────────────────────────────────────────────────┐  │
│  │   The Adaptive Engine                                                    │  │
│  │                                                                          │  │
│  │   [Full pipeline flow diagram — animated]                                │  │
│  │                                                                          │  │
│  │   Query → Classifier → Strategy Selector → [Simple | Complex | Multi]    │  │
│  │                                                                          │  │
│  │   Every step is measured: latency, cost, confidence — visible per query. │  │
│  └────────────────────────────────────────────────────────────────────────┘  │
│                                                                                │
│  SECTION 7: BENCHMARKS                                                         │
│  ┌────────────────────────────────────────────────────────────────────────┐  │
│  │   Proven Results — 1,020 Queries, 5 Domains                            │  │
│  │                                                                          │  │
│  │   ┌────────────────────────────┐   ┌────────────────────────────┐       │  │
│  │   │  +23.6% Recall ↑          │   │  -12.4% Latency ↓          │       │  │
│  │   │  vs Naive RAG baseline    │   │  vs baseline retrieval      │       │  │
│  │   │  p < 0.001   d = 0.89    │   │  95% CI: [-18%, -7%]        │       │  │
│  │   └────────────────────────────┘   └────────────────────────────┘       │  │
│  │                                                                          │  │
│  │   ┌────────────────────────────┐   ┌────────────────────────────┐       │  │
│  │  │  -18.3% Cost ↓            │   │  99.2% Query Success        │       │  │
│  │  │  Cost-aware routing       │   │  Fallback rate: <0.8%       │       │  │
│  │  │  saves on simple queries   │   │  Graceful degradation       │       │  │
│  │  └────────────────────────────┘   └────────────────────────────┘       │  │
│  │                                                                          │  │
│  │  ┌─── Benchmark by Domain ─────────────────────────────────────────┐    │  │
│  │  │  [Bar chart: recall by domain — Legal, Medical, Finance, ...]  │    │  │
│  │  └─────────────────────────────────────────────────────────────────┘    │  │
│  │                                                                          │  │
│  │  [View full benchmark methodology →]                                     │  │
│  └────────────────────────────────────────────────────────────────────────┘  │
│                                                                                │
│  SECTION 8: FEATURES GRID                                                     │
│  ┌────────────────────────────────────────────────────────────────────────┐  │
│  │  Everything you need for production retrieval                           │  │
│  │                                                                          │  │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐                  │  │
│  │  │ Adaptive     │  │ Multi-Hop    │  │ Confidence   │                  │  │
│  │  │ Planner      │  │ Retrieval    │  │ Calibration  │                  │  │
│  │  └──────────────┘  └──────────────┘  └──────────────┘                  │  │
│  │                                                                          │  │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐                  │  │
│  │  │ Cost         │  │ Benchmark    │  │ Observability│                  │  │
│  │  │ Optimization │  │ Suite        │  │              │                  │  │
│  │  └──────────────┘  └──────────────┘  └──────────────┘                  │  │
│  │                                                                          │  │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐                  │  │
│  │  │ Open Source  │  │ Self-Hosted  │  │ BYO LLM     │                  │  │
│  │  │ MIT Licensed │  │ Deploy Anywhere│ │ Any Model    │                  │  │
│  │  └──────────────┘  └──────────────┘  └──────────────┘                  │  │
│  └────────────────────────────────────────────────────────────────────────┘  │
│                                                                                │
│  SECTION 9: ARCHITECTURE                                                       │
│  ┌────────────────────────────────────────────────────────────────────────┐  │
│  │  Production Architecture                                                │  │
│  │                                                                          │  │
│  │  [Clean architecture diagram — boxes + arrows, dark theme]              │  │
│  │                                                                          │  │
│  │  Client → Go Gateway → gRPC → Intelligence Engine → Vector Store / LLM  │  │
│  │                                                                          │  │
│  │  • Go API Gateway with auth, rate limiting, caching                      │  │
│  │  • Python Intelligence Engine with adaptive retrieval                    │  │
│  │  • PostgreSQL, Redis, ChromaDB — battle-tested stack                     │  │
│  │  • Prometheus + Grafana — every query tracked                            │  │
│  │  • 1,802 passing tests — production confidence                           │  │
│  └────────────────────────────────────────────────────────────────────────┘  │
│                                                                                │
│  SECTION 10: INTEGRATIONS                                                     │
│  ┌────────────────────────────────────────────────────────────────────────┐  │
│  │  Works with your stack                                                  │  │
│  │                                                                          │  │
│  │  [LLM Logos: OpenAI, Anthropic, Google, Ollama]                         │  │
│  │  [Vector Store Logos: ChromaDB, Pinecone, Weaviate, Qdrant]             │  │
│  │  [Language Logos: Python, TypeScript, Go]                               │  │
│  │                                                                          │  │
│  │  Bring Your Own Everything — keep your LLM, vector store, embeddings.   │  │
│  └────────────────────────────────────────────────────────────────────────┘  │
│                                                                                │
│  SECTION 11: PRICING                                                           │
│  ┌────────────────────────────────────────────────────────────────────────┐  │
│  │  Simple pricing. Transparent limits.                                    │  │
│  │                                                                          │  │
│  │  ┌────────┐  ┌────────┐  ┌────────┐  ┌────────┐                        │  │
│  │  │  Free  │  │Developer│  │  Team  │  │Enterprise│                      │  │
│  │  │  $0    │  │  $29    │  │  $199  │  │ Custom   │                      │  │
│  │  │ 100 doc│  │ 1K doc  │  │ 10K doc│  │ Unlimited│                      │  │
│  │  │ 1K qry │  │ 10K qry │  │100K qry│  │ Custom   │                      │  │
│  │  │ 1 user │  │ 5 users │  │25 users│  │Unlimited │                      │  │
│  │  └────────┘  └────────┘  └────────┘  └────────┘                        │  │
│  │                                                                          │  │
│  │  [Compare Plans →]                                                       │  │
│  └────────────────────────────────────────────────────────────────────────┘  │
│                                                                                │
│  SECTION 12: FAQ                                                               │
│  ┌────────────────────────────────────────────────────────────────────────┐  │
│  │  Frequently Asked Questions                                             │  │
│  │                                                                          │  │
│  │  ▼ What is Kairos?                                                      │  │
│  │  ▼ How is it different from...                                          │  │
│  │  ▼ Can I self-host?                                                     │  │
│  │  ▼ What happens when I hit limits?                                      │  │
│  │  ▼ Do you offer discounts?                                              │  │
│  │  ▼ How is my data handled?                                              │  │
│  └────────────────────────────────────────────────────────────────────────┘  │
│                                                                                │
│  SECTION 13: CTA                                                               │
│  ┌────────────────────────────────────────────────────────────────────────┐  │
│  │                    🍁 (48px)                                            │  │
│  │                                                                          │  │
│  │         Start getting better answers today.                              │  │
│  │            No credit card required.                                      │  │
│  │                                                                          │  │
│  │              [⚡ Get Started — It's Free]                                │  │
│  │                                                                          │  │
│  │     • Free tier: 100 documents, 1,000 queries/month                     │  │
│  │     • No credit card required                                            │  │
│  │     • Sign up in 10 seconds with GitHub                                  │  │
│  └────────────────────────────────────────────────────────────────────────┘  │
│                                                                                │
│  SECTION 14: FOOTER                                                            │
│  ┌────────────────────────────────────────────────────────────────────────┐  │
│  │  🍁 Kairos — Adaptive Knowledge Intelligence                            │  │
│  │                                                                          │  │
│  │  Product     Developers     Company     Legal                           │  │
│  │  │           │              │           │                               │  │
│  │  Overview    Docs           About       Privacy                         │  │
│  │  Adaptive    API Ref        Blog        Terms                           │  │
│  │  Benchmarks  GitHub         Contact     Security                        │  │
│  │  Pricing     Status         —           —                               │  │
│  │                                                                          │  │
│  │  © 2026 Kairos. MIT Licensed. v1.0.0                                    │  │
│  └────────────────────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Section Specifications

### Navigation

| Element | Specification |
|---------|--------------|
| Sticky | Yes, at top of viewport |
| Background (default) | Transparent |
| Background (scrolled) | `#0B0F14` at 85% + backdrop-filter blur(12px), bottom border `#2A3441` |
| Height | 64px (scrolled: 56px) |
| Logo | 28px leaf + "Kairos" wordmark, Inter 600 |
| Nav links | Inter 500, `text-sm`, `#AAB4C3` → `#F5F7FA` on hover |
| CTA button | Primary button, `md` size, "⚡ Get Started" |

### Hero

| Element | Specification |
|---------|--------------|
| Padding top | 120px (space-12) |
| Padding bottom | 80px (space-20) |
| Max content width | 720px centered |
| Leaf | 64px, centered, fade-in at 0ms |
| H1 | Inter 800, clamp(2.5rem, 5vw, 4rem), centered, -0.03em tracking |
| Subtitle | Inter 400, 1.125rem, `#AAB4C3`, max-width 600px centered |
| CTAs | Centered, `lg` size, 16px gap |
| Trust bar | 4 stat pills, JetBrains Mono 500 for numbers, Inter 400 for labels |
| Code snippet | `#131A22` bg, `12px` radius, 1px `#2A3441` border, copy button |

### Social Proof

| Element | Specification |
|---------|--------------|
| Heading | Inter 500, `text-sm`, `#6B7A8F`, centered |
| Logos | 6 grayscale logos, max 120px width each, `#6B7A8F` |
| Layout | Horizontal row, centered, 40px gap |

### Problem / Solution

| Element | Specification |
|---------|--------------|
| Layout | Two-column split, 16px gap |
| Left card | Red-tinted header ("Static RAG"), examples with crossed-out results |
| Right card | Green-tinted header ("Kairos"), examples with optimal results |
| Bottom emphasis | Inter 700, `text-xl`, centered |
| Animation | Cards slide in from left/right on scroll |

### How It Works

| Element | Specification |
|---------|--------------|
| Layout | 3-step horizontal flow with arrows |
| Step cards | `#131A22` bg, `12px` radius, 1px `#2A3441`, orange number badge |
| Fallback callout | `#131A22` bg, left orange border (4px `#FF5A0A`) |
| Animation | Steps animate sequentially (1→2→3) on scroll |

### Adaptive Engine Visualization

| Element | Specification |
|---------|--------------|
| Layout | Full-width centered flow diagram |
| Components | Query → Classifier → Strategy Selector → 3 retrievers → Fallback → Answer |
| Style | Clean boxes with arrows, Inter 500 labels, orange accents |
| Hover | Each node highlights on hover with strategy explanation tooltip |
| Bottom note | Inter 400, `text-sm`, `#6B7A8F`, centered |

### Benchmarks

| Element | Specification |
|---------|--------------|
| Layout | 2x2 stat grid + full-width bar chart |
| Stat cards | Metric card component with large numbers, small deltas |
| Bar chart | Horizontal bars by domain, orange fill |
| Methodology link | Inter 500, `text-sm`, `#FF5A0A`, arrow icon |

### Features Grid

| Element | Specification |
|---------|--------------|
| Layout | 3-column grid, 3 rows |
| Feature cards | Interactive card component, orange left border on hover |
| Icon | Lucide icon, 24px, `#FF5A0A` |
| Title | Inter 600, `text-lg` |
| Description | Inter 400, `text-base`, `#AAB4C3` |

### Architecture

| Element | Specification |
|---------|--------------|
| Layout | Centered diagram with left-side bullet list |
| Diagram style | Clean boxes, Inter 500, orange connector arrows |
| Bullets | 4 architecture highlights with `#22C55E` checkmarks |

### Pricing

| Element | Specification |
|---------|--------------|
| Layout | 4-column card grid |
| Highlighted card (Team) | Orange border, "Most Popular" badge, slightly larger |
| Card content | Plan name, price, key limits, feature list, CTA button |
| Compare link | Below cards, links to /pricing |

### FAQ

| Element | Specification |
|---------|--------------|
| Layout | Single column, centered, max-width 720px |
| Accordion style | Click to expand, orange chevron rotation |
| Hover | `#131A22` bg on question row |

### CTA

| Element | Specification |
|---------|--------------|
| Layout | Centered, max-width 600px |
| Leaf | 48px above headline |
| Headline | Inter 700, `text-3xl`, centered |
| Subtitle | Inter 400, `text-lg`, `#AAB4C3` |
| CTA button | Primary button, `xl` size |
| Feature bullets | 3 bullets, Inter 400, `text-sm`, `#AAB4C3`, green checkmarks |

### Footer

| Element | Specification |
|---------|--------------|
| Layout | 4-column links + bottom legal bar |
| Top divider | 1px `#2A3441` |
| Link columns | Inter 400, `text-sm`, `#AAB4C3` |
| Column headers | Inter 600, `text-sm`, `#F5F7FA` |
| Legal bar | Inter 400, `text-xs`, `#6B7A8F` |

---

## 4. Scroll Behavior

| Scroll Position | Event |
|-----------------|-------|
| 0–100px | Transparent nav, hero enters with stagger fade |
| 100px+ | Nav becomes glass (blur + bg), hero fully visible |
| Problem section | Before/after cards slide in from edges |
| How It Works | Steps animate sequentially on scroll into view |
| Benchmarks | Counters animate up from 0, chart draws |
| Features | Cards fade up in sequence (100ms stagger) |
| Architecture | Diagram fades in from bottom |
| Pricing | Cards scale up from 0.95 → 1 |
| CTA | Final section, subtle leaf pulse animation |

---

## 5. Responsive Behavior

| Element | Mobile (<640px) | Tablet (640–1023px) | Desktop (≥1024px) |
|---------|----------------|---------------------|-------------------|
| Navigation | Hamburger menu, hidden links | Hamburger menu, hidden links | Full nav, visible links |
| Hero | Stacked CTAs, smaller code | Side-by-side CTAs | Full hero |
| Problem/Solution | Stacked cards | Side-by-side cards | Side-by-side cards |
| Features | Single column | 2-column grid | 3-column grid |
| Pricing | Single card, horizontal scroll | 2x2 grid | 4-column grid |
| Footer | Single column, stacked | 2x2 grid | 4-column grid |

---

## 6. Performance Budget

| Metric | Target |
|--------|--------|
| LCP | <1.5s |
| TBT | <100ms |
| CLS | <0.05 |
| Lighthouse | >95 |
| Page weight | <500KB (HTML + CSS + JS) |
| Fonts | Self-hosted Inter + JetBrains Mono (~40KB each) |
| Images | Zero (no photos, SVG-only) |
| Third-party JS | Plausible analytics only (~1KB) |

---

> *End of Landing Page Masterplan*  
> *Next: SaaS App UX → docs/SAAS_APP_UX.md*  
> *Brand: Orange Leaf Logo — LOCKED*
