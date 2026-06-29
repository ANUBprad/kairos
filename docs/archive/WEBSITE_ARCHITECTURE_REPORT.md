# Kairos Website — UI/UX Architecture Specification

> **Document Version:** 1.0  
> **Phase:** 17.3 — Documentation & Analysis  
> **Last Updated:** June 25, 2026  
> **Purpose:** The definitive reference for every page, section, component, interaction, animation, and design decision. A new frontend engineer or designer should be able to recreate the entire website from this document alone.

---

## Table of Contents

1. [Website Overview](#section-1--website-overview)
2. [Site Map](#section-2--site-map)
3. [Page Breakdown](#section-3--page-breakdown)
4. [Landing Page Walkthrough](#section-5--landing-page-walkthrough)
5. [User Journey](#section-6--user-journey)
6. [Strengths](#section-11--strengths)
7. [Weaknesses](#section-12--weaknesses)
8. [Improvement Roadmap](#section-13--improvement-roadmap)

---

## SECTION 1 — WEBSITE OVERVIEW

### Overall Purpose

The Kairos website serves as the primary marketing and conversion surface for the Kairos Adaptive Retrieval Intelligence Platform. Its purpose is to:

1. **Educate** enterprise and developer audiences about the limitations of static RAG and the advantages of adaptive retrieval
2. **Demonstrate** the product through interactive demos, benchmarks, and architecture visualization
3. **Convert** visitors into signed-up users through a clear, premium SaaS funnel
4. **Establish Trust** through transparency (open-source friendly, SOC 2, benchmarks) and enterprise-grade branding

### Target Audience

| Persona | Primary Need | Decision |
|---|---|---|
| **AI/ML Engineer** | Evaluate technical fit, API quality, model support | Technical evaluation, POC |
| **Engineering Manager** | Assess team productivity gain, integration effort | Budget approval, team adoption |
| **CTO / VP Eng** | Evaluate architecture, security, cost model | Strategic investment |
| **Indie Developer** | Quick start, free tier, docs quality | Personal projects, small-scale use |

### Product Positioning

**Tagline:** "Adaptive Retrieval Intelligence Platform"

**Elevator Pitch:** One API call. The right retrieval strategy for every query — whether it's a simple keyword lookup or a multi-hop research question. Kairos dynamically classifies, plans, and executes the optimal retrieval path, delivering 24% better recall at 40% lower cost than static RAG.

**Competitive Positioning:**
- vs LangChain/LlamaIndex: Production-ready, no assembly required
- vs GPT-4 with search: Purpose-built for retrieval, not general chat
- vs Custom pipelines: 10x faster to integrate, self-optimizing

### Design Philosophy

**"Confident Minimalism"**

The design follows a premium, developer-first aesthetic inspired by Vercel, Stripe, and Linear. Every element serves a purpose. Decoration is purposeful and never gratuitous. The visual language communicates:

- **Precision** — Tight spacing, aligned grids, crisp typography
- **Confidence** — Bold headlines, strong visual hierarchy, no hedging in copy
- **Calm** — Dark theme by default, muted secondary elements, controlled animations
- **Technical Authority** — Code snippets, architecture diagrams, benchmark data

### Brand Identity

| Attribute | Expression |
|---|---|
| **Logo** | Kairos horizontal wordmark + icon (PNG, sourced from `docs/assets/logo/kairos-light.png` / `docs/assets/logo/kairos-dark.png`) |
| **Primary Color** | Kairos Orange `#FF5A0A` — used sparingly as accent, never as dominant background |
| **Typography** | Plus Jakarta Sans (400, 500, 600, 700) — Google Sans equivalent |
| **Iconography** | Lucide React icons, monochrome tinted to match text color |
| **Voice** | Confident, precise, calm, technical. No emojis, no exclamation points |
| **Imagery** | Abstract geometric diagrams, code snippets, benchmark visualizations |

### Visual Language

| Element | Style |
|---|---|
| Surfaces | Dark `#0B0F14` with layered `#14181D` cards |
| Borders | `#2A2A2A` (subtle, never harsh) |
| Glass | `rgba(20, 24, 29, 0.6)` with `blur(20px)` — used in nav, hero code snippet |
| Glow | Orange `rgba(255, 90, 10, 0.12–0.25)` radial gradients — used sparingly behind key elements |
| Dot Grids | `radial-gradient(circle, rgba(255,90,10,0.08) 1px, transparent 0)` — subtle texture on hero, integrations |
| Radii | Buttons: `10px`, Cards: `14px`, Badges: `8px`, Large containers: `24px` |

### Navigation Philosophy

- **Fixed top nav** with transparent-to-glass transition on scroll
- **4 primary links** (Features, Pricing, Docs, Blog) — right-sized for focus
- **Sign In + Start Building** as primary actions
- **Mobile**: hamburger with full-screen overlay menu
- **Auth pages**: Separate layout with split-screen branding panel (left) + form (right)

### Color System

**Dark Theme (Default)**

| Role | Token | Value |
|---|---|---|
| Background | `--color-bg` | `#0B0F14` |
| Surface | `--color-surface` | `#14181D` |
| Border | `--color-border` | `#2A2A2A` |
| Text Primary | `--color-text-primary` | `#F0F0F0` |
| Text Secondary | `--color-text-secondary` | `#8B8B8B` |
| Text Tertiary | `--color-text-tertiary` | `#5C5C5C` |
| Brand | `--color-brand` | `#FF5A0A` |
| Success | `--color-success` | `#22C55E` |
| Accent | `--color-info` | `#3B82F6` |

**Light Theme (`.light` class)**

| Role | Token | Value |
|---|---|---|
| Background | `--color-bg` | `#FFFFFF` |
| Surface | `--color-surface` | `#F5F5F5` |
| Border | `--color-border` | `#E5E5E5` |
| Text Primary | `--color-text-primary` | `#0A0A0A` |
| Text Secondary | `--color-text-secondary` | `#6B6B6B` |
| Text Tertiary | `--color-text-tertiary` | `#A0A0A0` |

### Typography

- **Font Family:** `"Plus Jakarta Sans", system-ui, sans-serif`
- **Weights Used:** 400 (regular), 500 (medium), 600 (semibold), 700 (bold)
- **Scale:**
  - H1 (Hero): `36px` / `1.1` line-height, semibold, tracking-tight
  - H2 (Section): `28px` / `36px` responsive, semibold, tracking-tight
  - Body: `16px` / `1.6` line-height
  - Small: `13–14px` (buttons, badges, secondary text)
  - Micro: `11px` uppercase, tracked `0.12em` (labels, category headers)

### Motion Philosophy

"Subtle and purposeful." All animations are:

- **Scroll-triggered** (never auto-play on load)
- **Fast** (300–600ms)
- **Eased with `[0.16, 1, 0.3, 1]`** (custom cubic-bezier, aggressive ease-out)
- **GPU-accelerated** (opacity + transform only)
- **Respectful** of `prefers-reduced-motion`
- **Used for**: entrance reveals, hover feedback, state transitions — never for decoration alone

---

## SECTION 2 — SITE MAP

```
kairos.dev/
│
├── /                                   (Landing Page)
│   ├── Hero
│   │   ├── Headline + Subheadline
│   │   ├── Primary CTA (→ /signup)
│   │   ├── Secondary CTA (→ #how-it-works)
│   │   ├── Trust Signals
│   │   ├── Quickstart Code Block (animated)
│   │   └── Floating Metric Cards
│   │
│   ├── Social Proof
│   │   └── Company logos (placeholder)
│   │
│   ├── Problem
│   │   ├── Heading
│   │   ├── Static RAG (bad) vs Kairos (good)
│   │   └── Summary tagline
│   │
│   ├── How It Works (3-step process)
│   │   ├── Classify → Plan → Retrieve & Answer
│   │   └── Fallback info card
│   │
│   ├── Interactive Demo (Engine Visualization)
│   │   ├── Query input + sample buttons
│   │   ├── 7-step animated pipeline
│   │   └── Result card with telemetry
│   │
│   ├── Benchmarks
│   │   ├── 4 KPI metric cards
│   │   └── Recall by domain bar chart
│   │
│   ├── Features Grid (9 cards)
│   │
│   ├── Use Cases Grid (4 cards)
│   │
│   ├── Architecture
│   │   ├── Tech stack bullets
│   │   └── Architecture flow diagram
│   │
│   ├── Integrations (3 categories, 16 items)
│   │
│   ├── Pricing (4 tiers)
│   │
│   ├── FAQ (8 items, accordion)
│   │
│   ├── CTA Section
│   │
│   └── Footer
│
├── /features
│   ├── Hero
│   ├── Feature cards (8, 2-column grid)
│   └── CTA → /signup
│
├── /pricing
│   ├── Hero
│   ├── Pricing cards (reuses component)
│   ├── FAQ (reuses component)
│   └── CTA (reuses component)
│
├── /docs
│   ├── Hero
│   ├── Doc section cards (6, 2-column grid)
│   └── CTA → /signup
│
├── /blog
│   ├── Hero
│   ├── Category filter bar
│   ├── Blog posts (3)
│   └── Newsletter signup
│
├── /security
│   ├── Hero
│   ├── Security cards (5, 2-column grid)
│   └── CTA → /contact
│
├── /about
│   ├── Hero
│   ├── Mission section
│   ├── Values (4 cards)
│   └── CTA → /contact
│
├── /changelog
│   ├── Hero
│   ├── Timeline (4 releases)
│   └── CTA → GitHub / /blog
│
├── /contact
│   ├── Hero
│   ├── Contact methods (Email, Discord, GitHub)
│   └── Contact form
│
├── /login
│   ├── Branding panel (left)
│   └── Sign-in form (right)
│
├── /signup
│   ├── Branding panel (left)
│   └── Registration form (right)
│
├── /forgot-password
│   ├── Branding panel (left)
│   └── Reset form (right)
│
├── /robots.txt
├── /sitemap.xml
├── /*                               (Custom 404)
│   └── Logo + 404 heading + Back to Home
│
└── [/dashboard]                     (Not implemented — future)
    └── Internal Streamlit app at /apps/internal-dashboard/
```

**Total Pages:** 17 (12 content + 3 auth + 1 SEO + 1 404)

---

## SECTION 3 — PAGE BREAKDOWN

### 3.1 Landing Page (`/`)

| Attribute | Detail |
|---|---|
| **Purpose** | Primary conversion surface. Tell the full product story end-to-end. |
| **Target Audience** | All personas |
| **Primary CTA** | "Start building" (links to `/signup`) — appears in Hero, Features Grid, Docs, Pricing, CTA Section |
| **Secondary CTA** | "See how it works" (scrolls to `#how-it-works`), "Talk to sales" (links to `/contact`) |
| **Layout Structure** | Single-column, sequential sections with variety (2-col, grid, full-width) |
| **Visual Hierarchy** | Hero (strongest) → Problem → Demo → Benchmarks → Features → Pricing → CTA (closing) |
| **Components** | Hero, SocialProof, Problem, HowItWorks, EngineVisualization, Benchmarks, FeaturesGrid, UseCasesGrid, ArchitectureSection, Integrations, PricingSection, FAQSection, CTASection, Nav, Footer |
| **Animations** | ScrollReveal on every section, StaggerContainer on grids, animated hero terminal, floating metric cards, animated bar chart, pulsing architecture nodes, interactive demo pipeline |
| **Responsive** | Full-width hero, 3→2→1 column grids, stacked demo on mobile, wrapped nav |
| **Expected Journey** | Read headline → see interactive demo → explore features → check integrations → evaluate pricing → sign up |

### 3.2 Features Page (`/features`)

| Attribute | Detail |
|---|---|
| **Purpose** | Detail 8 core platform features in a focused, scannable layout |
| **Target Audience** | AI/ML Engineers, Engineering Managers |
| **Primary CTA** | "Start building" → `/signup` |
| **Secondary CTA** | None (single CTA at bottom) |
| **Layout** | SectionWrapper → centered heading + subheading → 2-col grid of 8 cards → full-width CTA |
| **Components** | SectionWrapper, Button, ScrollReveal, StaggerContainer |
| **Animations** | Heading fade-up, grid stagger entrance |
| **Features Listed** | Adaptive Routing, Confidence Calibration, Budget Optimization, Feedback Learning, Full Observability, Provider Agnostic, Multi-Strategy Engine, Enterprise Security |

### 3.3 Pricing Page (`/pricing`)

| Attribute | Detail |
|---|---|
| **Purpose** | Present 4 pricing tiers with feature comparison |
| **Target Audience** | Engineering Managers, CTOs, Indie Developers |
| **Primary CTA** | "Start building" (Pro tier, primary button) |
| **Secondary CTA** | "Get started" (Free, ghost), "Contact sales" (Enterprise) |
| **Layout** | SectionWrapper → heading → PricingSection (4-card row) → FAQ → CTA |
| **Components** | PricingSection, FAQSection, CTASection (all shared with landing) |
| **Animations** | Card stagger entrance, Pro glow effect |
| **Plans** | Free ($0), Developer ($49), Pro ($199 "Most Popular"), Enterprise (Custom) |

### 3.4 About Page (`/about`)

| Attribute | Detail |
|---|---|
| **Purpose** | Company mission, story, values — build trust and emotional connection |
| **Target Audience** | All visitors (especially enterprise evaluators) |
| **Primary CTA** | "Get in Touch" → `/contact` |
| **Secondary CTA** | None |
| **Layout** | Heading → Mission paragraphs → 2-col grid of 4 value cards → CTA |
| **Components** | SectionWrapper, Card, Button, ScrollReveal, StaggerContainer |
| **Animations** | ScrollReveal on sections, stagger on value cards |
| **Values** | Intelligence, Adaptability, Precision, Clarity |

### 3.5 Blog Page (`/blog`)

| Attribute | Detail |
|---|---|
| **Purpose** | Content marketing — posts about product, engineering, methodology |
| **Target Audience** | AI/ML Engineers, Indie Developers |
| **Primary CTA** | "Read more" (per-post), "Subscribe" (newsletter) |
| **Secondary CTA** | Category filter (All, Engineering, Product, Tutorials) |
| **Layout** | Heading → category filter bar → 3 post cards → newsletter section |
| **Components** | Button, Badge, ScrollReveal |
| **Animations** | Staggered post entrance, newsletter fade-up |
| **Posts** | 3 posts — 2 Engineering, 1 Product |

### 3.6 Docs Page (`/docs`)

| Attribute | Detail |
|---|---|
| **Purpose** | Documentation hub — links to 6 doc sections |
| **Target Audience** | AI/ML Engineers, Indie Developers |
| **Primary CTA** | "Start building" → `/signup` |
| **Secondary CTA** | None |
| **Layout** | Heading → 2-col grid of 6 interactive cards → CTA |
| **Components** | SectionWrapper, CardInteractive, Button, ScrollReveal, StaggerContainer |
| **Animations** | ScrollReveal heading, stagger card entrance, card hover lift |
| **Sections** | Getting Started, API Reference, SDKs & Clients, Architecture, Tutorials, Integrations |

### 3.7 Contact Page (`/contact`)

| Attribute | Detail |
|---|---|
| **Purpose** | Contact discovery + lead generation form |
| **Target Audience** | Enterprise evaluators, support seekers |
| **Primary CTA** | "Send message" (form submit) |
| **Secondary CTA** | Email, Discord, GitHub links |
| **Layout** | Heading → 3 contact method cards → contact form (name, email, message) |
| **Components** | Card, Button, ContactForm, ScrollReveal |
| **Animations** | ScrollReveal heading + staggered method cards |
| **Contact Methods** | Email (`mailto:sales@kairos.dev`), Discord (external), GitHub (external) |

### 3.8 Changelog Page (`/changelog`)

| Attribute | Detail |
|---|---|
| **Purpose** | Release notes timeline — show product velocity |
| **Target Audience** | Existing users, engineering evaluators |
| **Primary CTA** | GitHub link, "Read more on our blog" → `/blog` |
| **Secondary CTA** | None |
| **Layout** | Heading → timeline (4 releases with dot-and-line) → "Stay updated" section |
| **Components** | Badge, ScrollReveal |
| **Animations** | Staggered scroll-reveal on each timeline entry |
| **Releases** | v1.0.0, v0.9.0, v0.8.0, v0.7.0 |

### 3.9 Security Page (`/security`)

| Attribute | Detail |
|---|---|
| **Purpose** | Build enterprise trust — document security practices |
| **Target Audience** | CTOs, Security teams |
| **Primary CTA** | "Contact Security Team" → `/contact` |
| **Secondary CTA** | None |
| **Layout** | Heading → 2-col grid of 5 security cards → CTA |
| **Components** | SectionWrapper, Card, Button, ScrollReveal, StaggerContainer |
| **Animations** | ScrollReveal heading, stagger card entrance |
| **Topics** | Encryption, Compliance, Access Control, Infrastructure, Vulnerability Disclosure |

### 3.10 Login Page (`/login`)

| Attribute | Detail |
|---|---|
| **Purpose** | User authentication — sign in |
| **Target Audience** | Returning users |
| **Primary CTA** | "Sign In" (form submit) |
| **Secondary CTA** | "Sign up" → `/signup`, "Forgot?" → `/forgot-password`, social auth buttons |
| **Layout** | Left: branding panel (logo, highlights, copyright) — Right: form (heading, email, password, social buttons) |
| **Components** | Button |
| **Animations** | None |
| **Form Fields** | Email (email), Password (password) |
| **Social Auth** | "Continue with Google" (Chrome icon), "Continue with GitHub" (GitHub icon) |

### 3.11 Signup Page (`/signup`)

| Attribute | Detail |
|---|---|
| **Purpose** | New user registration |
| **Target Audience** | New visitors, trial users |
| **Primary CTA** | "Create account" (form submit) |
| **Secondary CTA** | "Sign in" → `/login`, Terms/Privacy links, social auth buttons |
| **Layout** | Left: branding panel — Right: form (heading, name/email/password, social buttons, legal links) |
| **Components** | Button |
| **Animations** | None |
| **Form Fields** | Full name (text), Email (email), Password (password) |

### 3.12 Forgot Password Page (`/forgot-password`)

| Attribute | Detail |
|---|---|
| **Purpose** | Password reset request |
| **Target Audience** | Users who forgot credentials |
| **Primary CTA** | "Send reset link" (form submit) |
| **Secondary CTA** | "Back to sign in" → `/login` |
| **Layout** | Left: branding panel — Right: form (heading, email, submit, back link) |
| **Components** | Button |
| **Animations** | None |
| **Form Fields** | Email (email) |

### 3.13 404 Page (`/_not-found`)

| Attribute | Detail |
|---|---|
| **Purpose** | Custom 404 for broken/missing routes |
| **Target Audience** | Any visitor |
| **Primary CTA** | "Back to Home" → `/` |
| **Secondary CTA** | None |
| **Layout** | Centered: Kairos logo → "404" heading → description → button |
| **Components** | Button |
| **Animations** | None |

---

## SECTION 4 — LANDING PAGE WALKTHROUGH

### Hero

```
┌──────────────────────────────────────────────────────────────┐
│  [Nav — glass on scroll]                                     │
│  ┌──────────────────────────────────────────────────────────┐│
│  │  [Badge] Adaptive Retrieval Intelligence Platform        ││
│  │                                                          ││
│  │  Stop retrieving blindly.                                ││
│  │  Start retrieving precisely.                             ││
│  │                                                          ││
│  │  One API. Every query gets the right retrieval           ││
│  │  strategy — simple keyword or multi-hop deep research.   ││
│  │                                                          ││
│  │  [Start building →]  [See how it works ↓]               ││
│  │  1,802 tests passing  ·  5-domain benchmark  ·          ││
│  │  No credit card required                                 ││
│  │                                                          ││
│  │  ┌─────────────────────┐  ┌──────┐  ┌──────┐            ││
│  │  │ curl -X POST ...    │  │163ms │  │+24%  │            ││
│  │  │  kairos.dev/query   │  │Latency│  │Recall│            ││
│  │  └─────────────────────┘  └──────┘  └──────┘            ││
│  │                          ┌──────┐  ┌──────┐            ││
│  │                          │-40%  │  │99.2% │            ││
│  │                          │Cost  │  │Conf. │            ││
│  │                          └──────┘  └──────┘            ││
│  └──────────────────────────────────────────────────────────┘│
│  [Dot grid background + floating gradient orbs]              │
└──────────────────────────────────────────────────────────────┘
```

| Element | Detail |
|---|---|
| **Purpose** | Immediate value prop + interactive preview |
| **Content** | Badge + h1 + p + 2 CTAs + trust signals + code block + 4 metric cards |
| **Layout** | Two-column split (left: 55% copy, right: 45% code + metrics) |
| **Typography** | Badge: `11px` uppercase tracked brand; h1: `36px/1.1` semibold tracking-tight; p: `16px` text-secondary |
| **Buttons** | Primary `lg` + Secondary `lg` |
| **Animations** | Staggered children entrance (0.15s stagger), code block fades in from right (0.7s), cursor blinks, metric cards float up staggered (0.3/0.6/0.9/1.2s delays) |
| **Spacing** | `py-28` (112px) top/bottom padding, `gap-6` between CTAs |
| **Background** | Dot grid pattern + floating gradient orbs (orange `#FF5A0A` + blue `#3B82F6`, blurred, animate with `float-slow` keyframes) |
| **Interaction** | None (static hero, floating metrics are decorative) |

### Problem Section

| Element | Detail |
|---|---|
| **Purpose** | Establish the pain point — static RAG is inefficient |
| **Layout** | Heading → 2-col comparison (Static RAG vs Kairos) → summary tagline |
| **Left Card (Bad)** | Red-tinted (`bg-error/5 border-error/20`), X icons for bullet items |
| **Right Card (Good)** | Green-tinted (`bg-success/5 border-success/20`), Check icons for bullet items |
| **Animation** | ScrollReveal heading, cards enter from left/right respectively |

### How It Works

| Element | Detail |
|---|---|
| **Purpose** | Explain 3-step core process |
| **Layout** | Heading → 3 horizontal step cards with arrow connectors (hidden on mobile) → fallback info card |
| **Steps** | 1. Classify (LLM analyzes query complexity) → 2. Select Strategy (Budget allocator) → 3. Retrieve & Answer (Best retriever + confidence calibration) |
| **Animation** | StaggerContainer with 0.12s stagger, each step fades up |

### Interactive Demo (Engine Visualization)

| Element | Detail |
|---|---|
| **Purpose** | Let visitors experience the pipeline with real queries |
| **Layout** | Heading → query input + 3 sample query buttons → 7-step pipeline → result card |
| **Pipeline Steps** | Query → Classify → Plan → Budget → Retrieve → Judge → Answer (300ms each) |
| **States** | Idle, Running (steps animate sequentially, input disabled), Complete (result card appears) |
| **Interaction** | Click sample query or type custom → watch pipeline → read result → "Try another" |
| **Animation** | Step pills scale/opacity animate, AnimatePresence on result card |

### Benchmarks Section

| Element | Detail |
|---|---|
| **Purpose** | Data-driven proof points |
| **Layout** | Heading → 4 KPI metric cards (2x2 grid) → recall by domain bar chart |
| **KPIs** | +24% Recall, 163ms Latency, -40% Cost, 99.2% Success |
| **Domains** | General (94%), Technical (91%), Legal (92%), Medical (88%), Finance (85%) |
| **Animation** | Metric cards stagger entrance, bar chart fills width on scroll (0.8s duration, 0.1s stagger per bar) |

### Features Grid

| Element | Detail |
|---|---|
| **Purpose** | Showcase 9 product features |
| **Layout** | Heading → 3x3 grid of feature cards |
| **Cards** | Icon (brand circle bg) + title + description |
| **Hover** | `-translate-y-[2px]`, border changes to `brand/30`, icon bg darkens |
| **Animation** | StaggerContainer 0.06s stagger, each card fades up |

### Use Cases Grid

| Element | Detail |
|---|---|
| **Purpose** | Show 4 real-world applications |
| **Layout** | Heading → 2x2 grid of use case cards |
| **Cards** | Icon + title + description (same style as Features) |
| **Hover** | Same as Features grid |
| **Animation** | StaggerContainer 0.1s stagger |

### Architecture Section

| Element | Detail |
|---|---|
| **Purpose** | Technical credibility — show the stack |
| **Layout** | 2-col: left (tech stack bullets), right (architecture flow diagram) |
| **Tech Stack** | Go API Gateway, Python Intelligence Engine, PostgreSQL + Redis, ChromaDB (or BYO), Prometheus + Grafana, OpenTelemetry |
| **Flow Diagram** | Client SDK → Go API Gateway → Redis Cache → gRPC → Python Engine → Vector Store + LLM Provider → PostgreSQL + Prometheus |
| **Animation** | Bullets stagger in with Check icons, architecture boxes pulse with glow animation |

### Integrations Section

| Element | Detail |
|---|---|
| **Purpose** | Show ecosystem breadth — "works with your stack" |
| **Layout** | Heading → 3 category rows: LLMs (6), Vector DBs (6), Languages (4) |
| **Cards** | Monochrome SVG logo + name, glass background, `12px` radius |
| **Grid** | 6-col (desktop), 3-col (tablet), 2-col (mobile) |
| **Hover** | `scale(1.03)`, border glows orange, shadow-glow, icon turns brand, text turns primary |
| **Background** | Dot grid pattern + two soft orange radial glows |
| **Animation** | Each category fades up sequentially (0.1s delay per category), cards stagger within each row (0.04s stagger) |

### Pricing Section

| Element | Detail |
|---|---|
| **Purpose** | Present 4 pricing tiers |
| **Layout** | Heading → 4 cards in a row (Free, Developer $49, Pro $199, Enterprise Custom) |
| **Pro Card** | "Most Popular" badge, `shadow-glow`, `border-brand/40`, `bg-brand/[0.03]` |
| **CTAs** | Free: ghost, Developer: ghost, Pro: primary, Enterprise: secondary |
| **Animation** | StaggerContainer 0.06s stagger |

### FAQ Section

| Element | Detail |
|---|---|
| **Purpose** | Answer common objections |
| **Layout** | Heading → Radix Accordion with 8 items |
| **Questions** | RAG comparison, vs GPT-4, hosting, LLM support, pricing, trial, learning, security |
| **Animation** | ScrollReveal heading, accordion slide (200ms) with chevron rotate |

### CTA Section

| Element | Detail |
|---|---|
| **Purpose** | Final conversion push |
| **Layout** | Centered dual headline → 2 CTAs + trust signals |
| **Headline** | "Stop over-engineering simple queries. Stop under-serving complex ones." |
| **Subheadline** | "One API call. Optimal strategy every time." |
| **CTAs** | "Start building" (primary, ArrowRight icon) + "Talk to sales" (secondary) |
| **Trust Signals** | "No credit card required", "Cancel anytime", "1,000 free queries" |

### Footer

| Element | Detail |
|---|---|
| **Purpose** | Site footer — navigation, legal, social |
| **Layout** | Logo → 4-column link grid → bottom row (copyright + social links) |
| **Columns** | Product (4 links), Developers (4 links), Company (4 links), Legal (3 links) |
| **Social** | GitHub, Twitter/X, LinkedIn, Discord, Email |
| **Interaction** | Links hover to text-primary, external links open in new tab |

---

## SECTION 5 — USER JOURNEY

### Full Funnel Map

```
1. DISCOVERY
   │
   ├─ Search / Social / Referral
   │   → Lands on Homepage (/)
   │   → Sees Hero headline + demo
   │
   └─ Direct
       → Lands on Homepage or specific route (/features, /pricing, /docs)

2. EVALUATION (Homepage Flow)
   │
   ├─ Reads Hero headline + subheadline
   │   (Decision: "Is this relevant to me?" → No → bounce)
   │
   ├─ Interacts with Interactive Demo
   │   (Runs sample queries, watches pipeline)
   │   (Decision: "Does the tech seem real?" → No → explore benchmarks)
   │
   ├─ Scrolls to Benchmarks
   │   (Evaluates KPIs: +24% recall, -40% cost)
   │   (Decision: "Are numbers compelling?" → No → explore features)
   │
   ├─ Reads Features Grid
   │   (Evaluates: Adaptive Routing, Confidence Calibration, etc.)
   │   (Decision: "Does it do what I need?" → No → explore use cases)
   │
   ├─ Views Integrations
   │   (Checks: "Do they support my stack?" → No → bounce)
   │
   ├─ Views Pricing
   │   (Decision: "Is the pricing fair?" → No → contact sales)
   │
   └─ Reads FAQ
       (Resolves last objections)

3. CONVERSION
   │
   ├─ Primary: Clicks "Start building"
   │   → /signup
   │   → Fills name, email, password
   │   → Creates account
   │   → [Future: Dashboard]
   │
   └─ Secondary: Clicks "Talk to sales"
       → /contact
       → Fills form
       → Submits lead

4. POST-CONVERSION
   │
   ├─ Returns for /login
   ├─ Reads /docs for integration
   ├─ Monitors /changelog for updates
   └─ Reads /blog for best practices

5. EXIT / RETENTION
   │
   ├─ Newsletter signup (/blog)
   ├─ GitHub star → return visits
   └─ Word-of-mouth → new discovery cycle
```

### Decision Points & CTAs

| Decision Point | Question | CTA |
|---|---|---|
| Hero | "Is this for me?" | "Start building" or "See how it works" |
| Interactive Demo | "Does the tech work?" | Type a query (interaction) |
| Benchmarks | "Is it better than alternatives?" | Continue scrolling |
| Integrations | "Does it work with my stack?" | Continue scrolling |
| Pricing | "Can I afford it?" | "Start building" or "Contact sales" |
| FAQ | "Any hidden issues?" | "Get started" |
| CTA Section | "Should I commit?" | "Start building" or "Talk to sales" |
| Signup form | "Is registration worth it?" | "Create account" |

### Abandonment Points

| Point | Cause | Mitigation |
|---|---|---|
| Hero | Headline doesn't resonate, unclear value prop | A/B test headline variants |
| Interactive Demo | Too technical, doesn't work on mobile | Simplify mobile view |
| Pricing | Sticker shock | Free tier, "no credit card" signal |
| Signup form | Friction (too many fields) | Social auth, minimal fields |
| Any page | Slow load, poor mobile experience | Performance optimization |

---

## SECTION 6 — STRENGTHS

### Visual Design

- **Premium dark theme** — feels modern and enterprise-grade, comparable to Vercel/Linear
- **Consistent orange accent** — used sparingly and effectively, never overwhelms
- **Typography** — Plus Jakarta Sans is clean, readable, and distinctive
- **Glass navigation** — polished scroll-aware effect adds sophistication
- **Custom SVG logos** — 16 integration logos are cohesive in monochrome style

### Layout & Information Architecture

- **Clear hierarchy** — Each section has distinct layout (2-col, grid, full-width) avoiding monotony
- **Progressive disclosure** — Simple explanation first (How It Works) → detailed (Architecture)
- **Interactive demo** — Differentiator; most competitors have static screenshots
- **End-to-end story** — Problem → Solution → Proof → Features → Price → Convert

### Technical Implementation

- **Performance** — 102 kB shared JS, all static generation, minimal runtime JS
- **0 build errors** — Clean TypeScript, clean ESLint, consistent patterns
- **Dark/light mode** — Full theme system with localStorage persistence, no FOUC
- **Accessibility** — Skip link, focus-visible, ARIA labels, reduced motion, semantic HTML
- **SEO** — Sitemap, robots.txt, OG/Twitter cards, metadata template, canonical URLs

### Motion Design

- **Subtle and purposeful** — Animations enhance understanding, never distract
- **Consistent easing** — Single cubic-bezier `[0.16, 1, 0.3, 1]` throughout
- **Respects reduced motion** — Full disable via media query
- **Scroll-triggered** — No autoplay, performance-friendly

### Developer Experience

- **Clean component architecture** — UI primitives, shared utilities, marketing components
- **Single source of truth** — SectionWrapper, ScrollReveal, theme tokens
- **Zero runtime dependencies** beyond Framer Motion + Lenis

---

## SECTION 7 — WEAKNESSES

### Design

| Issue | Severity | Location |
|---|---|---|
| Social proof logos are placeholders ("TechCorp", "DataFlow") | **High** | `social-proof.tsx` |
| Hero right panel is static — code block is decorative, not interactive | **Medium** | Hero |
| No real product screenshots | **Medium** | Homepage |
| Light mode feels less polished than dark mode | **Low** | Global |
| No custom illustrations — only geometric/abstract shapes | **Medium** | Multiple sections |
| Layout can feel repetitive (same card patterns across sections) | **Low** | Multiple sections |
| Circular orbit layout for integrations was not implemented | **Low** | Integrations section |

### Content

| Issue | Severity | Location |
|---|---|---|
| No customer logos or testimonials | **High** | SocialProof, Homepage |
| Blog has only 3 posts | **Medium** | Blog |
| Blog category filter is non-functional | **Medium** | Blog |
| Docs have no actual content — just section cards | **Medium** | Docs |
| "Problem" section has placeholder domain examples | **Low** | Problem section |

### UX

| Issue | Severity | Location |
|---|---|---|
| No loading states for interactive elements | **Medium** | EngineVisualization |
| No error states for forms | **Medium** | Contact, Auth forms |
| No form validation feedback | **Medium** | Contact, Auth forms |
| No toast/notification system | **Medium** | Global |
| Auth pages have no password visibility toggle | **Low** | Login, Signup |
| Mobile nav covers full screen — no scrollable menu content | **Low** | Nav |
| No confirmation on "Send message" | **Low** | Contact form |
| No `reset-password` page (only forgot-password) | **Low** | Auth |

### Technical

| Issue | Severity | Location |
|---|---|---|
| No page transitions / route animations | **Low** | Global |
| No loading skeletons | **Low** | Global |
| No analytics integration | **Medium** | Global |
| No cookie consent banner | **Medium** | Global |
| No terms or privacy pages (linked but 404) | **Medium** | /terms, /privacy |

### Missing Features

| Issue | Severity | Location |
|---|---|---|
| No dashboard (roadmap item) | **High** | Future |
| No API status page | **Low** | Future |
| No comparison page (vs LangChain, vs LlamaIndex) | **Medium** | Future |
| No case studies | **Medium** | Future |
| No video demo / walkthrough | **Low** | Future |

---

## SECTION 8 — IMPROVEMENT ROADMAP

### Critical Impact

| # | Improvement | Why | Effort |
|---|---|---|---|
| 1 | Replace placeholder company names with real/potential customer logos | Social proof is the #1 trust builder | 2h |
| 2 | Add customer testimonial section | Third-party validation | 4h |
| 3 | Implement functional authentication (login/signup/forgot-password backend) | Auth pages do nothing | 40h+ |

### High Impact

| # | Improvement | Why | Effort |
|---|---|---|---|
| 4 | Add actual documentation content to /docs | Docs page is empty navigation | 20h+ |
| 5 | Add comparison page (vs LangChain, LlamaIndex, custom) | Critical for technical evaluation | 8h |
| 6 | Add form validation + error states to all forms | Basic UX hygiene | 4h |
| 7 | Add page transitions (Framer Motion AnimatePresence) | Improves perceived performance | 4h |
| 8 | Add analytics (PostHog / Plausible) | Data-driven optimization | 4h |
| 9 | Create /terms and /privacy pages | Legal requirement | 4h |
| 10 | Add cookie consent banner | Legal compliance | 3h |

### Medium Impact

| # | Improvement | Why | Effort |
|---|---|---|---|
| 11 | Add real product screenshots to Features page | Visual proof | 6h |
| 12 | Create a video demo / product walkthrough | Best conversion tool | 20h+ |
| 13 | Add case studies | Enterprise trust | 16h+ |
| 14 | Make hero code block interactive (copy button, editable) | Engagement | 4h |
| 15 | Add loading skeletons to interactive demo | UX polish | 2h |
| 16 | Add toast/notification system | UX feedback | 3h |
| 17 | Add password visibility toggle on auth forms | UX polish | 1h |
| 18 | Add blog post pagination or "load more" | Content scalability | 3h |
| 19 | Polish light mode for parity with dark mode | Visual consistency | 4h |

### Low Impact

| # | Improvement | Why | Effort |
|---|---|---|---|
| 20 | Add custom illustrations (not just geometric shapes) | Brand distinctiveness | 20h+ |
| 21 | Implement circular orbit integrations layout | Premium visual | 8h |
| 22 | Add API status page | Transparency | 6h |
| 23 | Add scroll progress indicator | UX polish | 2h |
| 24 | Add "back to top" button | UX on long pages | 1h |
| 25 | Increase blog post count (aim for 8-12) | Content marketing | 16h+ |

### Implementation Priority Matrix

```
                    HIGH EFFORT
                        │
    LOW IMPACT          │          HIGH IMPACT
    ────────────────────┼────────────────────
    (#20) Illustrations │ (#3) Auth backend
    (#21) Orbit layout  │ (#4) Docs content
    (#22) Status page   │ (#5) Comparison page
    (#25) More blog     │ (#1) Customer logos
                        │ (#2) Testimonials
                        │ (#8) Analytics
                        │
                    LOW EFFORT
                        │
    LOW IMPACT          │          HIGH IMPACT
    ────────────────────┼────────────────────
    (#24) Back to top   │ (#6) Form validation
    (#17) PW toggle     │ (#7) Page transitions
    (#23) Scroll bar    │ (#9) Terms/Privacy
                        │ (#10) Cookie consent
                        │ (#14) Interactive code
                        │ (#16) Toast system
                        │
                    LOW EFFORT
```

**Immediate Next 3 (Sprint Candidate):**
1. Replace placeholder company names (#1)
2. Add cookie consent banner (#10)
3. Wire up contact form to email service (#3 partial)

---

*End of WEBSITE_ARCHITECTURE_REPORT.md*
