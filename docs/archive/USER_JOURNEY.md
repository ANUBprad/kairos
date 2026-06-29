# User Journey — Kairos Website

> **Version:** 1.0  
> **Scope:** Full funnel from discovery to retention  
> **Personas Covered:** AI/ML Engineer, Engineering Manager, Indie Developer

---

## 1. Journey Overview

```
DISCOVERY → EVALUATION → CONVERSION → ONBOARDING → RETENTION
```

---

## 2. Entry Points

| Source | Landing Page | % (Estimated) |
|---|---|---|
| Direct / Brand search | Homepage (`/`) | 30% |
| Organic search (SEO) | Various | 40% |
| Social / Community | Blog or Homepage | 15% |
| Referral / Word-of-mouth | Homepage | 10% |
| Paid / Campaign | Landing-specific | 5% |

---

## 3. Persona Journeys

### Persona A: AI/ML Engineer

**Goal:** Evaluate technical fit, test API quality, check LLM support

```
1. Lands on Homepage
   ├── Reads Hero headline
   ├── ✓ "Adaptive retrieval" matches their problem
   └── ✗ Bounces if headline doesn't resonate (15-20s)

2. Scrolls to Interactive Demo
   ├── Runs sample query "What is our refund policy?"
   ├── Watches pipeline animation (Query → Classify → Plan → Budget → Retrieve → Judge → Answer)
   ├── Reads result: strategy, confidence, latency, cost
   └── Decision: "The pipeline makes sense" → Continue

3. Checks Integrations
   ├── Scans LLMs: "They support OpenAI, Anthropic, Ollama — good"
   ├── Scans Vector DBs: "Pinecone and ChromaDB — we use both"
   └── Decision: "Works with our stack" → Continue

4. Reviews Benchmarks
   ├── Reads KPIs: +24% recall, -40% cost
   ├── Checks domain chart: "92% legal recall — relevant"
   └── Decision: "Numbers look real" → Continue

5. Visits /docs
   ├── Clicks "Getting Started" card
   └── Decision: "Docs are thorough" → Clicks "Start building"

6. Signs up at /signup
   ├── Fills name, email, password
   ├── OR clicks "Continue with GitHub"
   └── Decision: "Low friction" → Creates account

7. [Future] Dashboard → API key → First query
```

**Key pages visited:** `/` → `/docs` → `/signup`  
**Total time to conversion:** 8-15 minutes

---

### Persona B: Engineering Manager

**Goal:** Assess team productivity gain, compare with current solution

```
1. Lands on Homepage
   ├── Reads Hero → "Stop retrieving blindly. Start retrieving precisely."
   ├── Sees primary CTA "Start building" (not yet — too early)
   └── Decision: "Need to understand first" → Scrolls

2. Reads Problem Section
   ├── "Static RAG vs Kairos" comparison
   ├── ✓ "Full dense search — slow, expensive" resonates
   ├── ✓ "Right strategy every time" is compelling
   └── Decision: "Kairos solves a real problem" → Continue

3. Reads Features Grid
   ├── Scans: Adaptive Routing, Budget Optimization, Full Observability
   ├── ✓ "Observability and budget control — team needs this"
   └── Decision: "Feature set is comprehensive" → Continue

4. Reviews Architecture Section
   ├── Go API Gateway, Python engine, PostgreSQL + Redis
   ├── ✓ "Fits our infrastructure"
   └── Decision: "Architecture is sound" → Check pricing

5. Visits /pricing
   ├── Compares Developer ($49) vs Pro ($199)
   ├── Notes "Most Popular" badge on Pro
   ├── Checks feature list: "Confidence calibration, priority support"
   └── Decision 1: "Pro is right for us" → OR
   └── Decision 2: "Need to talk to someone" → Clicks "Contact sales"

6. Visits /security
   ├── Reads Encryption, Compliance, Access Control
   ├── Checks SOC 2 compliance in Enterprise tier
   └── Decision: "Security posture is solid" → OR

7. Visits /contact
   ├── Reads "Talk to sales" as secondary CTA
   ├── Fills contact form (name, email, message)
   └── OR clicks "Start building" → /signup
```

**Key pages visited:** `/` → `/features` → `/pricing` → `/security` → `/contact` (or `/signup`)  
**Total time to conversion:** 15-30 minutes

---

### Persona C: Indie Developer / Hobbyist

**Goal:** Quick start, free tier, see if it works for personal projects

```
1. Lands on Homepage
   ├── Scans Hero quickly
   ├── Sees "1,000 free queries" in trust signals
   └── Decision: "Free tier exists" → Scrolls to pricing

2. Jumps to /pricing (via nav or scroll)
   ├── Finds Free tier: $0, 1,000 queries/month
   ├── ✓ "Enough to try out"
   └── Decision: "Worth a shot" → Clicks "Get started"

3. Signs up at /signup
   ├── Uses "Continue with GitHub" (1-click)
   ├── ✓ Minimal friction
   └── Creates account

4. [Future] Receives API key → reads quickstart → first query
```

**Key pages visited:** `/` → `/pricing` → `/signup`  
**Total time to conversion:** 2-5 minutes

---

## 4. Page-by-Page Journey Detail

### Landing Page Flow

```
┌─────────────────────────────────────────────────┐
│  HERO                                           │
│  "What does this product do?"                   │
│  ↓ Read headline + subheadline                  │
│  ↓ See interactive code example                 │
│  ├─ "Not for me" → Bounce (20%)                 │
│  └─ "Interesting" → Scroll                       │
└─────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────┐
│  SOCIAL PROOF                                   │
│  "Who uses this?"                               │
│  ↓ See company names (placeholder)              │
│  └─ "Unfamiliar names" → Low impact             │
└─────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────┐
│  PROBLEM                                        │
│  "Why do I need this?"                          │
│  ↓ Static RAG (bad) vs Kairos (good)            │
│  └─ "I have this problem" → Continue            │
└─────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────┐
│  HOW IT WORKS                                   │
│  "How does it work at high level?"              │
│  ↓ 3-step process: Classify → Plan → Execute    │
│  └─ "Makes sense" → Continue                    │
└─────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────┐
│  INTERACTIVE DEMO                               │
│  "Let me see it in action."                     │
│  ↓ Click a sample query                         │
│  ↓ Watch 7-step pipeline animation             │
│  ↓ Read result card                             │
│  ├─ "Impressive" → Continue                     │
│  └─ "Too slow / confusing" → Skip               │
└─────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────┐
│  BENCHMARKS                                     │
│  "Does it actually perform better?"             │
│  ↓ Read KPIs                                   │
│  ↓ Study domain recall chart                    │
│  ├─ "Data is convincing" → Continue             │
│  └─ "Need more proof" → Scroll to features      │
└─────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────┐
│  FEATURES GRID                                  │
│  "What exactly does it do?"                     │
│  ↓ Scan 9 feature cards                         │
│  └─ "Covers what I need" → Continue             │
└─────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────┐
│  USE CASES                                      │
│  "Can I use it for my specific need?"           │
│  ↓ Scan 4 use cases                             │
│  └─ "Relevant to me" → Continue                 │
└─────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────┐
│  ARCHITECTURE                                   │
│  "What's under the hood?"                       │
│  ↓ Read tech stack                              │
│  ↓ View flow diagram                            │
│  └─ "Solid architecture" → Continue             │
└─────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────┐
│  INTEGRATIONS                                   │
│  "Does it work with my tools?"                  │
│  ↓ Scan LLMs, Vector DBs, Languages             │
│  ├─ "All my tools are here" → Continue          │
│  └─ "Missing [X]" → Bounce / Contact            │
└─────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────┐
│  PRICING                                        │
│  "How much does it cost?"                       │
│  ↓ Compare 4 plans                              │
│  ├─ "Free is enough" → Click "Get started"      │
│  ├─ "Pro is worth it" → Click "Start building"  │
│  ├─ "Need enterprise" → Click "Contact sales"   │
│  └─ "Too expensive" → Bounce                    │
└─────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────┐
│  FAQ                                            │
│  "Any dealbreakers?"                            │
│  ↓ Open relevant questions                      │
│  └─ "Satisfied" → Continue                      │
└─────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────┐
│  CTA SECTION                                    │
│  Final conversion push                          │
│  ├─ "Start building" → /signup                  │
│  └─ "Talk to sales" → /contact                  │
└─────────────────────────────────────────────────┘
```

### Auth Flow

```
/signup                               /login
  │                                     │
  ▼                                     ▼
┌────────────────────┐     ┌────────────────────┐
│ Branding Panel     │     │ Branding Panel     │
│ (logo, highlights, │     │ (same)             │
│  copyright)        │     │                    │
│                    │     │                    │
│ Form:              │     │ Form:              │
│ - Name             │     │ - Email            │
│ - Email            │     │ - Password         │
│ - Password         │     │ - [Forgot?]        │
│                    │     │                    │
│ [Create account]   │     │ [Sign In]          │
│                    │     │                    │
│ "Sign in" → /login │     │ "Sign up" → /signup│
│ Social: Google/GH  │     │ Social: Google/GH  │
│ Terms + Privacy    │     │                    │
└────────────────────┘     └────────────────────┘
         │                         │
         │                         ▼
         │                  ┌────────────────────┐
         │                  │ Forgot Password    │
         │                  │ - Email            │
         │                  │ [Send reset link]  │
         │                  │ "Back to sign in"  │
         │                  └────────────────────┘
         │
         ▼
  [Future: Dashboard]
```

---

## 5. Decision Points Map

| Point | Visitor Asks | Answer Provided | Action |
|---|---|---|---|
| Hero | "Is this relevant to my problem?" | Headline + subheadline | Scroll or bounce |
| Demo | "Is the tech real?" | Interactive pipeline | Continue or skip |
| Benchmarks | "Is it better than what I have?" | KPIs + domain chart | Continue or bounce |
| Integrations | "Does it work with my stack?" | 16 integration logos | Continue or bounce |
| Pricing | "Can I afford this?" | 4 tiers including Free | Sign up or contact or bounce |
| FAQ | "Any hidden drawbacks?" | 8 questions answered | Sign up or bounce |
| CTA | "Should I commit?" | Dual CTAs + trust signals | Sign up or contact |
| Signup form | "Is registration worth the effort?" | Social auth + minimal fields | Create account or leave |
| Login | "Can I get back in?" | Email + password + reset | Sign in or reset |

---

## 6. Conversion Funnel (Estimated)

```
Visitors: 100%

  ├─ Bounce on landing: 40%
  │     │
  │     └─ Reasons: 
  │         - Unclear value prop (headline not resonating)
  │         - Page load time (need to measure)
  │         - Wrong audience (not their problem)
  │
  └─ Continue scrolling: 60%
        │
        ├─ Exit before demo: 15%
        │     │
        │     └─ Reasons:
        │         - Content too long / repetitive
        │         - Distracted / comparison shopping
        │
        └─ Reaches interactive demo: 45%
              │
              ├─ Exit before pricing: 20%
              │
              └─ Reaches pricing: 25%
                    │
                    ├─ Clicks "Get started" (Free): 10%
                    ├─ Clicks "Start building" (Paid): 5%
                    ├─ Clicks "Contact sales": 3%
                    └─ Bounce on pricing: 7%

  Signup completion rate (of clicks): ~60%
  
  Overall conversion: ~8-10% of visitors → signup
```

---

## 7. Post-Conversion Journey

```
Account Created
       │
       ▼
[Future] Welcome Email
       │
       ├─ Includes:
       │   - API key
       │   - Quickstart guide
       │   - Docs link
       │   - Community links
       │
       ▼
[Future] First API Call
       │
       ├─ Success → Exploration
       │   ├─ Read docs
       │   ├─ Integrate SDK
       │   └─ Monitor dashboards
       │
       └─ Failure → Support
           ├─ Email support
           ├─ Discord community
           └─ Documentation search

  Retention Loop:
       │
       ├─ Product updates (changelog)
       ├─ Email newsletter (blog)
       └─ Community engagement (Discord, GitHub)
```

---

## 8. Edge Cases

### Returning Visitor (Has Account)

```
/ → /login → Dashboard (future)
```

### Lost Password

```
/login → "Forgot?" → /forgot-password → /login → Dashboard
```

### Enterprise Evaluation

```
/ → /features → /security → /pricing (Enterprise) → /contact → Sales call ↔ Demo
```

### Direct Link (Deep Link)

```
/docs → Top nav visible → Can explore other pages
/blog/[post] → (future) → Related posts → Newsletter → /features
```

---

## 9. UX Principles

1. **Minimize clicks to value** — Social auth, minimal signup fields
2. **Progressive disclosure** — Simple explanation first, detailed later
3. **Always show navigation** — Fixed nav on marketing pages
4. **Never leave without options** — Multiple CTAs, contact available
5. **Trust signals throughout** — Security badge, benchmarks, test count
6. **No dead ends** — Every page has a clear next action

---

*End of USER_JOURNEY.md*
