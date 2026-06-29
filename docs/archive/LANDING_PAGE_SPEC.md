# Kairos — Landing Page Specification

> **Document**: Homepage Design Specification  
> **Product**: Kairos — Adaptive Knowledge Intelligence  
> **Brand**: Orange Leaf Logo | Charcoal `#0B0F14` | Orange `#FF5A0A`  
> **Status**: LOCKED — Phase 11A

---

## 1. Design Language

### Visual Direction
**Reference**: Linear.app, Vercel.com, Stripe.com/payments

**Characteristics**:
- Dark background (`#0B0F14`) with subtle noise texture
- Orange (`#FF5A0A`) as the sole accent color — used sparingly for CTAs, highlights, and data emphasis
- Large, bold typography (Inter 700–800 weight for headlines)
- Generous whitespace between sections (120–160px)
- Cards with rounded corners (16px), surface backgrounds (`#131A22`), subtle borders (`#2A3441`)
- Subtle hover animations: lift (translateY -2px), border glow (orange at 20% opacity)
- Data visualizations as primary visual content (charts, graphs, leaderboards)
- Code snippets with syntax highlighting for developer credibility
- No stock photos, no generic AI imagery, no illustrations of robots/brain/circuits

### Color Usage
| Element | Color |
|---------|-------|
| Background | `#0B0F14` |
| Surface | `#131A22` |
| Border | `#2A3441` |
| Text primary | `#F5F7FA` |
| Text secondary | `#AAB4C3` |
| Text muted | `#6B7A8F` |
| Accent / CTA | `#FF5A0A` |
| Accent hover | `#FF7A1A` |
| Success | `#22C55E` |
| Error | `#EF4444` |

### Typography
| Usage | Font | Weight | Size |
|-------|------|--------|------|
| Hero headline | Inter | 800 | clamp(2.5rem, 5vw, 4rem) |
| Section headline | Inter | 700 | clamp(1.5rem, 3vw, 2.25rem) |
| Subheading | Inter | 500 | 1.125rem |
| Body | Inter | 400 | 1rem |
| Small / caption | Inter | 400 | 0.875rem |
| Code / metrics | JetBrains Mono | 500 | 0.875rem |

### Animation Guidelines
- **Page load**: Stagger fade-in (hero first, then content below, 100ms delay between elements)
- **Scroll**: Reveal animations when sections enter viewport (fade-up, 200ms duration, ease-out)
- **Hover**: Card lift (translateY -4px, 200ms), border color transition
- **CTA buttons**: Subtle scale (1.02) on hover, orange glow shadow (0 0 30px rgba(255,90,10,0.2))
- **Numbers/counters**: Animate counting up on scroll into view
- **Charts**: Animate drawing on scroll into view
- **Navigation**: Glass blur on scroll (backdrop-filter: blur(12px))

---

## 2. Section-by-Section Specification

### SECTION 1: Navigation

```
┌────────────────────────────────────────────────────────────────────────────┐
│  🍁 Kairos          Product ▼  Pricing  Docs  Blog  ⚡ Get Started        │
│                                                                              │
│  [orange leaf SVG + "Kairos" wordmark, left]                                │
│  [nav links, center] [Get Started button, right, orange filled, 10px radius]│
└────────────────────────────────────────────────────────────────────────────┘
```

**States**:
- **Default**: Transparent background, text white
- **Scrolled (>100px)**: `#0B0F14` at 85% opacity + backdrop-filter blur(12px), 1px bottom border `#2A3441`
- **Mobile**: Hamburger icon replaces center links, slide-out drawer with full nav

**Behavior**:
- Sticky at top of viewport
- "Get Started" is always visible, scrolls with user
- Product dropdown on hover/click: links to /product, /product/adaptive-retrieval, /product/benchmarks

---

### SECTION 2: Hero

```
┌────────────────────────────────────────────────────────────────────────────┐
│                                                                              │
│                                   🍁                                        │
│                              [orange leaf, 64px]                             │
│                                                                              │
│              Adaptive Knowledge Intelligence                                  │
│                                                                              │
│    Upload documents. Ask questions. Get answers optimized per query —        │
│    not one-size-fits-all retrieval.                                          │
│                                                                              │
│         ┌──────────────────────┐    ┌──────────────────────┐                 │
│         │ ⚡ Get Started       │    │  ▸ Watch Demo        │                 │
│         │  [orange filled]     │    │  [outline, white]    │                 │
│         └──────────────────────┘    └──────────────────────┘                 │
│                                                                              │
│      +23.6% Recall    -12.4% Latency    1,802 Tests    MIT Licensed         │
│       vs Naive RAG     vs baseline        Passing        Open Source         │
│       p < 0.001                                                            │
│                                                                              │
│  ┌────────────────────────────────────────────────────────────────────┐     │
│  │  ⚡ pip install keiro-client                                       │     │
│  │  from keiro import Kairos                                          │     │
│  │  client = Kairos(api_key="sk-...")                                 │     │
│  │  response = client.query("What are our compliance requirements?")  │     │
│  │  print(response.answer)  # "According to the documents..."         │     │
│  └────────────────────────────────────────────────────────────────────┘     │
│                                                                              │
└────────────────────────────────────────────────────────────────────────────┘
```

**Purpose**: Immediate value proposition + brand recognition + developer credibility

**Visual hierarchy**:
1. Orange leaf logo (centered, 64px)
2. H1: "Adaptive Knowledge Intelligence" (2.5rem–4rem, 800 weight, centered)
3. Subtitle: value proposition (1.125rem, text-secondary, max-width 600px, centered)
4. Two CTAs side by side (centered):
   - Primary: "Get Started" — orange filled, white text, 10px radius, 48px height
   - Secondary: "Watch Demo" — outline (1px `#2A3441`), white text, same dimensions
5. Trust bar: 4 stat pills inline (orange accent on numbers, muted labels)
6. Code snippet: dark card (`#131A22`) with syntax-highlighted Python, copy button

**CTA behavior**:
- "Get Started" → `/signup`
- "Watch Demo" → scrolls to demo section or opens modal video

**Loading animation**: Fade in sequence: logo (0ms) → headline (200ms) → subtitle (400ms) → CTA buttons (600ms) → stats (800ms) → code (1,000ms)

---

### SECTION 3: Problem

```
┌────────────────────────────────────────────────────────────────────────────┐
│                                                                              │
│  One retriever for every query? That's the problem.                          │
│                                                                              │
│  ┌──────────────────────────────┐  ┌──────────────────────────────┐          │
│  │  ❌ Static RAG               │  │  ✅ Kairos Adaptive          │          │
│  │                              │  │                              │          │
│  │  "What's our refund policy?" │  │  "What's our refund policy?" │          │
│  │       → Full dense search    │  │       → Simple keyword       │          │
│  │         (slow, expensive)    │  │         (2ms, $0.001)        │          │
│  │                              │  │                              │          │
│  │  "Compare Q1 vs Q3 revenue"  │  │  "Compare Q1 vs Q3 revenue"  │          │
│  │       → Same dense search    │  │       → Multi-hop (3 hops)   │          │
│  │         (misses connections) │  │         (1.2s, $0.021)       │          │
│  │                              │  │                              │          │
│  │  Wastes money on simple      │  │  Right strategy every time   │          │
│  │  Fails on complex queries    │  │  24% better recall, 18% less │          │
│  └──────────────────────────────┘  └──────────────────────────────┘          │
│                                                                              │
│  Static retrieval doesn't understand the query.                              │
│  Kairos does.                                                                 │
│                                                                              │
└────────────────────────────────────────────────────────────────────────────┘
```

**Purpose**: Validate the pain with concrete examples

**Layout**: Two-column split (before/after), dark cards with border

**Content**:
- Headline: "One retriever for every query? That's the problem."
- Left card: Static RAG — two example queries showing same slow/expensive pipeline
- Right card: Kairos — same queries showing optimized strategies
- Bottom emphasis: "Static retrieval doesn't understand the query. Kairos does."

**Animation**: Cards slide in from left/right on scroll

---

### SECTION 4: Solution — How It Works

```
┌────────────────────────────────────────────────────────────────────────────┐
│                                                                              │
│  How Kairos Works                                                            │
│                                                                              │
│  One API call. Three retrieval strategies. Optimal results every time.       │
│                                                                              │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐                   │
│  │  ① Classify  │───→│  ② Select    │───→│  ③ Retrieve  │───→ Answer      │
│  │              │    │              │    │              │                   │
│  │ LLM analyzes │    │ Budget       │    │ Simple:      │   + Sources      │
│  │ query        │    │ allocator    │    │   Hybrid     │   + Confidence   │
│  │ complexity   │    │ chooses best │    │ Complex:     │   + Latency      │
│  │              │    │ strategy     │    │   MMR + HyDE │   + Cost         │
│  │ Simple?      │    │              │    │ Multi-Hop:   │                   │
│  │ Complex?     │    │ Confidence   │    │   Iterative  │                   │
│  │ Multi-hop?   │    │ threshold    │    │   3 hops     │                   │
│  └──────────────┘    └──────────────┘    └──────────────┘                   │
│                                                                              │
│  ┌──────────────────────────────────────────────────────────────────┐       │
│  │  🔄 Fallback: If confidence < threshold, auto-falls back to      │       │
│  │     safer strategy with graceful degradation                     │       │
│  └──────────────────────────────────────────────────────────────────┘       │
│                                                                              │
└────────────────────────────────────────────────────────────────────────────┘
```

**Purpose**: Explain the core technology simply

**Layout**: Horizontal flow diagram with 3 steps + answer output

**Content**:
- Headline: "How Kairos Works"
- Subtitle: "One API call. Three retrieval strategies. Optimal results every time."
- Three steps in connected flow: Classify → Select Strategy → Retrieve + Generate
- Result box showing what the user gets back
- Fallback explanation callout at bottom

**Animation**: Steps animate sequentially (1 → 2 → 3 → answer) on scroll

---

### SECTION 5: Adaptive Engine Visualization

```
┌────────────────────────────────────────────────────────────────────────────┐
│                                                                              │
│  The Adaptive Engine                                                         │
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │                                                                      │    │
│  │     ┌─────────────┐                                                  │    │
│  │     │   Query      │                                                  │    │
│  │     └──────┬──────┘                                                  │    │
│  │            │                                                          │    │
│  │     ┌──────┴──────┐                                                  │    │
│  │     │  Classifier  │                                                  │    │
│  │     │  (LLM-based) │                                                  │    │
│  │     └──────┬──────┘                                                  │    │
│  │            │                                                          │    │
│  │     ┌──────┴──────────────────────────────────────┐                   │    │
│  │     │  Strategy Selector                          │                   │    │
│  │     │  (Budget Allocator + Confidence Calibrator)  │                   │    │
│  │     └──────┬──────────────────────────────────────┘                   │    │
│  │            │                                                          │    │
│  │     ┌──────┴──────┐    ┌──────┴──────┐    ┌──────┴──────┐            │    │
│  │     │  Simple     │    │  Complex    │    │  Multi-Hop  │            │    │
│  │     │  Retriever  │    │  Retriever  │    │  Retriever  │            │    │
│  │     │  (Hybrid)   │    │  (MMR+HyDE) │    │  (3 hops)   │            │    │
│  │     └──────┬──────┘    └──────┬──────┘    └──────┬──────┘            │    │
│  │            │                 │                 │                     │    │
│  │     ┌──────┴─────────────────┴─────────────────┴──────┐              │    │
│  │     │  Fallback Manager                                │              │    │
│  │     │  (Confidence check → degrade or retry)           │              │    │
│  │     └──────┬──────────────────────────────────────────┘              │    │
│  │            │                                                          │    │
│  │     ┌──────┴──────┐                                                  │    │
│  │     │   Answer +   │                                                  │    │
│  │     │   Sources    │                                                  │    │
│  │     └─────────────┘                                                  │    │
│  │                                                                      │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                                                              │
│  Every step is measured: latency, cost, confidence — visible per query.     │
│                                                                              │
└────────────────────────────────────────────────────────────────────────────┘
```

**Purpose**: Technical depth for engineering audience

**Layout**: Full-width flow diagram with all components labeled

**Content**: Complete adaptive retrieval pipeline with all components

**Bottom note**: "Every step is measured: latency, cost, confidence — visible per query."

---

### SECTION 6: Features Grid

```
┌────────────────────────────────────────────────────────────────────────────┐
│                                                                              │
│  Everything you need for production retrieval                                │
│                                                                              │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐              │
│  │  Adaptive        │  │  Multi-Hop      │  │  Confidence     │              │
│  │  Planner         │  │  Retrieval      │  │  Calibration    │              │
│  │                  │  │                 │  │                 │              │
│  │  Classifies each │  │  Connects info  │  │  Platt scaling  │              │
│  │  query → routes  │  │  across docs in │  │  + isotonic     │              │
│  │  to best retriever│  │  up to 3 hops  │  │  regression     │              │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘              │
│                                                                              │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐              │
│  │  Cost            │  │  Benchmark      │  │  Observability  │              │
│  │  Optimization   │  │  Suite          │  │                 │              │
│  │                  │  │                 │  │                 │              │
│  │  Learned budget  │  │  1,020 gold-std │  │  Per-query      │              │
│  │  allocation      │  │  queries, 5     │  │  metrics,       │              │
│  │  saves 18–33%   │  │  domains        │  │  Grafana dash   │              │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘              │
│                                                                              │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐              │
│  │  Feedback Loop   │  │  Fallback       │  │  Open Source    │              │
│  │                  │  │  Manager        │  │                 │              │
│  │  User ratings →  │  │  Graceful       │  │  MIT licensed   │              │
│  │  auto-adjust     │  │  degradation on │  │  Self-hostable  │              │
│  │  budget tables   │  │  low confidence │  │  No vendor lock │              │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘              │
│                                                                              │
└────────────────────────────────────────────────────────────────────────────┘
```

**Purpose**: Detailed capability showcase

**Layout**: 3×3 grid of feature cards

**Each card**:
- Title (bold, 1rem, text-primary)
- Two-line description (0.875rem, text-secondary)
- Hover: subtle lift + orange border glow

**Animation**: Cards stagger in on scroll (100ms intervals)

---

### SECTION 7: Benchmark Results

```
┌────────────────────────────────────────────────────────────────────────────┐
│                                                                              │
│  Proven Performance                                                          │
│                                                                              │
│  Statistically validated across 1,020 queries, 5 domains, 5 modes.           │
│                                                                              │
│  ┌────────┐  ┌────────┐  ┌────────┐  ┌────────┐  ┌────────┐                │
│  │ +23.6%│  │ -12.4% │  │ 0.89   │  │ p<0.001│  │ 1,802  │                │
│  │ Recall│  │ Latency│  │ Cohen's│  │ Signif.│  │ Tests  │                │
│  │ vs Naive│  │ vs base│  │ d      │  │        │  │ Passing│                │
│  └────────┘  └────────┘  └────────┘  └────────┘  └────────┘                │
│                                                                              │
│  Leaderboard                                                                 │
│  ┌──────┬──────────────────┬────────┬────────┬────────┬────────┬────────┐   │
│  │ Rank │ Mode             │ Recall │ Prec   │ Latency│ Cost   │Composite│   │
│  ├──────┼──────────────────┼────────┼────────┼────────┼────────┼────────┤   │
│  │ 🥇   │ Kairos Adaptive  │  0.89  │  0.85  │ 163ms  │ $0.014 │  0.89  │   │
│  │ 🥈   │ Always Multi-Hop │  0.80  │  0.76  │ 190ms  │ $0.022 │  0.80  │   │
│  │ 🥉   │ Always Complex   │  0.78  │  0.74  │ 170ms  │ $0.018 │  0.78  │   │
│  │  4   │ Always Simple    │  0.75  │  0.71  │ 133ms  │ $0.010 │  0.75  │   │
│  │  5   │ Naive RAG        │  0.72  │  0.68  │ 145ms  │ $0.012 │  0.72  │   │
│  └──────┴──────────────────┴────────┴────────┴────────┴────────┴────────┘   │
│                                                                              │
│  📊 Kairos Adaptive dominates all quality metrics while keeping latency and  │
│     cost in check. Full methodology available.                               │
│                                                                              │
│  ┌──────────────────────┐                                                    │
│  │  View Full Benchmarks│                                                    │
│  └──────────────────────┘                                                    │
│                                                                              │
└────────────────────────────────────────────────────────────────────────────┘
```

**Purpose**: Quantifiable proof — the most important section for conversion

**Layout**: Stat row + full leaderboard table + methodology note

**Content**:
- 5 stat pills in a row (recall, latency, Cohen's d, significance, tests)
- Full leaderboard with 🥇🥈🥉 medals
- Kairos Adaptive row highlighted in orange
- Methodology link
- CTA: "View Full Benchmarks" → `/product/benchmarks`

**Visual**: The leaderboard should be the most visually impressive element on the page. Dark table with subtle row hover, orange highlight on Kairos row.

---

### SECTION 8: Architecture — How It Integrates

```
┌────────────────────────────────────────────────────────────────────────────┐
│                                                                              │
│  Designed for Integration                                                    │
│                                                                              │
│  Drop this into your existing stack. Keep everything else.                   │
│                                                                              │
│  ┌────────────────────────────────────────────────────────────────────┐     │
│  │                              YOUR APPLICATION                        │     │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────────────┐   │     │
│  │  │ Frontend  │  │ Backend  │  │ Database │  │ Vector Store     │   │     │
│  │  │ (React)   │  │ (Python) │  │ (Postgres)│  │ (Pinecone/Chroma)│   │     │
│  │  └──────────┘  └────┬─────┘  └──────────┘  └──────────────────┘   │     │
│  │                     │                                              │     │
│  │              ┌──────┴──────┐                                        │     │
│  │              │  Kairos API  │                                        │     │
│  │              │  /v1/query   │                                        │     │
│  │              │  /v1/ingest  │                                        │     │
│  │              └─────────────┘                                        │     │
│  └────────────────────────────────────────────────────────────────────┘     │
│                                                                              │
│  ┌──────────────────────────────────────────────────────────────────┐       │
│  │  from keiro import Kairos                                        │       │
│  │  client = Kairos(api_key="sk-...")                                │       │
│  │                                                                   │       │
│  │  # Ask a question                                                │       │
│  │  result = client.query("What are our compliance requirements?")   │       │
│  │  print(f"Answer: {result.answer}")                                │       │
│  │  print(f"Sources: {result.sources}")                              │       │
│  │  print(f"Strategy: {result.strategy}")                            │       │
│  │  print(f"Confidence: {result.confidence}")                        │       │
│  └──────────────────────────────────────────────────────────────────┘       │
│                                                                              │
│  Works with any LLM · Any vector store · Any embedding model                 │
│                                                                              │
└────────────────────────────────────────────────────────────────────────────┘
```

**Purpose**: Show integration simplicity

**Layout**: Architecture diagram showing user's app with Kairos as a layer + code snippet

**Content**:
- Your application box containing frontend, backend, database, vector store
- Kairos API plugged in as a service layer
- Python code snippet showing API usage (3 lines to get started)
- Bottom badges: "Works with any LLM · Any vector store · Any embedding model"

---

### SECTION 9: Integrations

```
┌────────────────────────────────────────────────────────────────────────────┐
│                                                                              │
│  Works with your stack                                                       │
│                                                                              │
│  LLMs                              Vector Stores                     │
│  ┌────┐ ┌────┐ ┌────┐ ┌────┐      ┌────┐ ┌────┐ ┌────┐ ┌────┐     │
│  │Open │ │Gem │ │Claude│ │Ollama│    │Chrm│ │Pine│ │Weav│ │Qdrnt│     │
│  │ AI  │ │ ini│ │     │ │     │    │aDB │ │cone│ │iate│ │ant  │     │
│  └────┘ └────┘ └────┘ └────┘      └────┘ └────┘ └────┘ └────┘     │
│                                                                              │
│  Languages                        Frameworks                          │
│  ┌────┐ ┌────┐ ┌────┐      ┌────┐ ┌────┐ ┌────┐ ┌────┐            │
│  │Py  │ │ JS │ │ Go │      │LC   │ │Hay │ │Lla │ │Fast│            │
│  │thon│ │    │ │    │      │hain │ │stck│ │ma  │ │API │            │
│  └────┘ └────┘ └────┘      └────┘ └────┘ └────┘ └────┘            │
│                                                                              │
└────────────────────────────────────────────────────────────────────────────┘
```

**Purpose**: Show compatibility breadth

**Layout**: Logo grid rows (LLMs, Vector Stores, Languages, Frameworks)

---

### SECTION 10: Pricing Preview

```
┌────────────────────────────────────────────────────────────────────────────┐
│                                                                              │
│  Simple, transparent pricing                                                 │
│                                                                              │
│  Start free. Scale as you grow.                                              │
│                                                                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐    │
│  │  Free        │  │  Developer   │  │  Team        │  │  Enterprise  │    │
│  │  $0          │  │  $29/mo      │  │  $199/mo     │  │  Custom      │    │
│  │              │  │              │  │              │  │              │    │
│  │  100 docs    │  │  1,000 docs  │  │  10K docs    │  │  Unlimited   │    │
│  │  1K queries  │  │  10K queries │  │  100K queries│  │  Custom      │    │
│  │  1 user      │  │  5 users     │  │  25 users    │  │  Unlimited   │    │
│  │  Basic anal. │  │  Adv. anal.  │  │  Full anal.  │  │  Custom dash │    │
│  │  Community   │  │  Email supp  │  │  Slack supp  │  │  Dedicated   │    │
│  │              │  │              │  │              │  │              │    │
│  │  [Get Free]  │  │  [Subscribe] │  │  [Subscribe] │  │  [Contact]   │    │
│  └──────────────┘  └──────────────┘  └──────────────┘  └──────────────┘    │
│                                                                              │
│  All plans include: adaptive retrieval, multi-hop, confidence scoring,       │
│  observability, and 24% recall improvement.                                  │
│                                                                              │
└────────────────────────────────────────────────────────────────────────────┘
```

**Purpose**: Transparent pricing, low-friction entry

**Layout**: 4-column pricing cards

**Content**: Feature comparison per tier with highlight on the "best value" tier (Developer)

**CTA per tier**: Free → "Get Free" (outline), Developer → "Subscribe" (orange, recommended badge), Team → "Subscribe" (outline), Enterprise → "Contact" (outline)

---

### SECTION 11: CTA Section

```
┌────────────────────────────────────────────────────────────────────────────┐
│                                                                              │
│  🍁                                                                          │
│                                                                              │
│  Start building with Kairos today                                            │
│                                                                              │
│  No credit card required. Free tier includes 100 documents and 1,000         │
│  queries. Get started in under 2 minutes.                                    │
│                                                                              │
│  ┌──────────────────────────────┐                                           │
│  │  ⚡ Get Started — It's Free │                                           │
│  │  [orange filled, large]     │                                           │
│  └──────────────────────────────┘                                           │
│                                                                              │
│  ┌──────────────────────────────────────────────────────────────┐           │
│  │  ⚡ pip install keiro-client     ★ 1,802 tests passing       │           │
│  └──────────────────────────────────────────────────────────────┘           │
│                                                                              │
└────────────────────────────────────────────────────────────────────────────┘
```

**Purpose**: Final conversion push

**Layout**: Centered, minimal — logo, headline, subtitle, primary CTA, trust badges

**CTA**: Single large orange button "Get Started — It's Free"

**Trust signals**: "No credit card required", pip install command, test count

---

### SECTION 12: Footer

```
┌────────────────────────────────────────────────────────────────────────────┐
│                                                                              │
│  🍁 Kairos                                                                  │
│  Adaptive Knowledge Intelligence                                            │
│                                                                              │
│  Product     │  Developers  │  Company     │  Legal               │
│  ─────────── │  ─────────── │  ───────────  │  ───────────         │
│  Features    │  Docs        │  About       │  Privacy             │
│  Benchmarks  │  API Ref     │  Blog        │  Terms               │
│  Pricing     │  GitHub      │  Contact     │  Security            │
│              │  Status      │              │                      │
│                                                                              │
│  GitHub  │  Twitter  │  LinkedIn  │  Discord  │  Status                     │
│                                                                              │
│  © 2026 Kairos. MIT Licensed.                                                │
│  Built with 🍁 in open source.                                              │
│                                                                              │
└────────────────────────────────────────────────────────────────────────────┘
```

**Purpose**: Navigation, social proof, legal

**Layout**: 4-column link grid + social icons + copyright

---

## 3. Responsive Breakpoints

| Breakpoint | Width | Layout Changes |
|------------|-------|----------------|
| Desktop | > 1024px | Full layout, multi-column, side-by-side |
| Tablet | 768–1024px | 2-column grids collapse to single, smaller hero text |
| Mobile | < 768px | Single column, hamburger nav, stacked cards, smaller CTA buttons |

## 4. Performance Budget

| Metric | Target |
|--------|--------|
| First Contentful Paint (FCP) | < 1.5s |
| Largest Contentful Paint (LCP) | < 2.5s |
| Time to Interactive (TTI) | < 3.0s |
| Cumulative Layout Shift (CLS) | < 0.1 |
| Lighthouse Performance | > 95 |
| Lighthouse Accessibility | > 95 |
| Page weight (total) | < 500KB |
| JavaScript (initial) | < 150KB |
| Images | WebP, lazy-loaded |

## 5. Success Metrics

| Metric | Target (Week 1) | Target (Month 1) |
|--------|-----------------|------------------|
| Page load time | < 2s | < 1.5s |
| Bounce rate | < 50% | < 40% |
| Time on page | > 60s | > 90s |
| Scroll depth | > 70% (to benchmarks) | > 80% |
| CTA click rate | > 5% | > 8% |
| Sign-up rate | > 3% of visitors | > 5% |
| Demo engagement | > 50% of visitors | > 60% |

---

> *End of Landing Page Specification*  
> *Next: App UX Plan → docs/APP_UX_PLAN.md*  
> *Brand: Orange Leaf Logo — LOCKED*
