# Kairos — Website Sitemap

> **Document**: Complete Sitemap — All Pages Across All Subdomains  
> **Product**: Kairos — Adaptive Knowledge Intelligence  
> **Status**: LOCKED — Phase 13  
> **Author**: Information Architecture / SEO Team

---

## 1. Domain Architecture

| Subdomain | Purpose | Tech Stack | Deployment |
|-----------|---------|------------|------------|
| `kairos.dev` | Public marketing site (landing, product, pricing, blog) | Next.js 15 + Tailwind + MDX | Vercel |
| `app.kairos.dev` | Authenticated SaaS application | Next.js 15 + Tailwind + shadcn/ui | Vercel |
| `docs.kairos.dev` | Developer documentation | Next.js 15 + MDX | Vercel |
| `status.kairos.dev` | System status page | Better Uptime (managed) | Better Uptime |
| `github.com/kairos-ai/kairos` | Open source repository | — | GitHub |

### SEO Priority

| URL | Priority | Index | Notes |
|-----|----------|-------|-------|
| `kairos.dev/` | 1.0 | ✅ | Primary landing page |
| `kairos.dev/pricing` | 0.9 | ✅ | High-intent commercial page |
| `kairos.dev/product/*` | 0.8 | ✅ | Deep product content |
| `kairos.dev/blog/*` | 0.7 | ✅ | SEO content marketing |
| `docs.kairos.dev/*` | 0.7 | ✅ | Developer content |
| `app.kairos.dev/*` | 0.0 | ❌ | Authenticated — noindex |

---

## 2. kairos.dev (Public Website)

### 2.1 Top-Level Pages

```
kairos.dev/
├── /                           # Homepage (12 sections: Nav, Hero, Social Proof, Problem,
│                               #   Solution, Engine Viz, Benchmarks, Features, Architecture,
│                               #   Pricing, FAQ, CTA, Footer)
│
├── /product                    # Product overview page
│   ├── /adaptive-retrieval     # Deep-dive: adaptive engine
│   ├── /multi-hop              # Deep-dive: multi-hop reasoning
│   ├── /benchmarks             # Benchmark leaderboard + methodology
│   └── /cost-optimization      # Deep-dive: cost-aware routing
│
├── /pricing                    # Pricing tiers, feature comparison, FAQ
│
├── /blog                       # Blog index (paginated)
│   ├── /blog/posts/:slug       # Individual blog post
│   └── /blog/changelog         # Product changelog
│
├── /about                      # Team, mission, open source philosophy
│
├── /contact                    # Contact form, support options, sales inquiry
│
├── /login                      # Login page (Auth0 hosted or embedded)
│
├── /signup                     # Sign-up page (Auth0 hosted or embedded)
│
├── /privacy                    # Privacy policy
│
├── /terms                      # Terms of service
│
└── /security                   # Security overview, encryption, compliance
```

### 2.2 Static Pages

```
kairos.dev/
└── /legal
    ├── /privacy                # Privacy policy
    ├── /terms                  # Terms of service
    ├── /security               # Security practices
    ├── /cookies                # Cookie policy
    ├── /gdpr                   # GDPR compliance
    └── /sla                    # Service level agreement
```

### 2.3 Navigation Structure

#### Primary Navigation (Header)

```
┌─────────────────────────────────────────────────────────────────────┐
│ 🍁 Kairos    Product ▼   Pricing   Docs   Blog    [⚡ Get Started]  │
│              │                                                      │
│              ├── Overview                                          │
│              ├── Adaptive Retrieval                                │
│              ├── Multi-Hop Reasoning                               │
│              ├── Benchmarks                                        │
│              └── Cost Optimization                                 │
└─────────────────────────────────────────────────────────────────────┘
```

#### Secondary Navigation (Footer)

```
┌─────────────────────────────────────────────────────────────────────┐
│ 🍁 Kairos — Adaptive Knowledge Intelligence                         │
│                                                                     │
│ Product          Developers       Company         Legal            │
│ ├── Overview     ├── Docs         ├── About       ├── Privacy      │
│ ├── Adaptive     ├── API Ref      ├── Blog        ├── Terms        │
│ ├── Multi-Hop    ├── GitHub       ├── Changelog   ├── Security     │
│ ├── Benchmarks   ├── Status       ├── Contact     └── Cookies      │
│ └── Pricing      └── SDKs         └── Careers                       │
│                                                                     │
│ © 2026 Kairos. MIT Licensed. v1.0.0                                 │
│ Twitter/X · GitHub · Discord                                         │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 3. app.kairos.dev (SaaS Application)

### 3.1 Authentication Pages

```
app.kairos.dev/
├── /login                      # Login (GitHub OAuth, Google OAuth, Email)
├── /signup                     # Sign up (GitHub OAuth, Google OAuth, Email)
├── /forgot-password            # Password reset request
├── /reset-password             # Password reset form (from email link)
└── /callback                   # OAuth callback handler (Auth0)
```

### 3.2 Authenticated Pages

```
app.kairos.dev/app/
│
├── /dashboard                  # Home dashboard — KPIs, charts, activity, quick query
│
├── /documents                  # Document list, search, filter
│   ├── /documents/:id          # Document detail (preview, metadata, queries)
│   └── /documents/upload       # Upload modal (or inline on /documents)
│
├── /collections                # Collection grid (V1+)
│   ├── /collections/:id        # Collection detail (documents, stats)
│   └── /collections/new        # Create collection
│
├── /queries                    # Query interface
│   ├── /queries/:id            # Query detail (single answer view)
│   └── /queries/thread/:id     # Conversation thread
│
├── /analytics                  # Full analytics dashboard
│   ├── /analytics/queries      # Query performance breakdown
│   ├── /analytics/cost         # Cost analysis
│   ├── /analytics/latency      # Latency trends
│   └── /analytics/export       # Data export (CSV)
│
├── /settings                   # Settings hub
│   ├── /settings/general       # Workspace name, profile
│   ├── /settings/api-keys      # API key management
│   ├── /settings/team          # Team members, invitations
│   ├── /settings/billing       # Plan, invoices, payment method
│   └── /settings/integrations  # Webhooks, connectors (V1+)
│
└── /support                    # Support hub (in-app)
    ├── /support/tickets         # Support ticket list
    └── /support/tickets/new     # Create support ticket
```

### 3.3 App States

| State | Behavior |
|-------|----------|
| **Loading** | Skeleton screens on all pages until data loads |
| **Empty (first visit)** | Welcoming empty state with upload CTA and sample document option |
| **Error** | Inline error message with retry or support link |
| **Offline** | "Connection lost" toast with auto-retry |
| **Maintenance** | Banner: "Scheduled maintenance in X minutes" (from status endpoint) |

---

## 4. docs.kairos.dev (Documentation)

### 4.1 Documentation Structure

```
docs.kairos.dev/
│
├── /                          # Documentation home / getting started
│
├── /quickstart                # 5-minute quickstart guide
│
├── /api-reference             # Full API reference
│   ├── /authentication        # API keys, session auth
│   ├── /query                 # POST /v1/query
│   ├── /documents             # POST/GET/DELETE /v1/documents
│   ├── /collections           # POST/GET/DELETE /v1/collections (V1+)
│   ├── /analytics             # GET /v1/analytics/*
│   ├── /feedback              # POST /v1/feedback
│   ├── /api-keys              # POST/GET/DELETE /v1/api-keys
│   ├── /errors                # Error codes and handling
│   └── /rate-limits           # Rate limit policies
│
├── /sdks
│   ├── /python                # Python SDK documentation
│   │   ├── /installation      # pip install
│   │   ├── /quickstart        # First query in 5 lines
│   │   ├── /api               # Full SDK API reference
│   │   └── /examples          # Code examples
│   └── /javascript            # JavaScript SDK documentation (V1+)
│       ├── /installation      # npm install
│       ├── /quickstart        # First query in 5 lines
│       ├── /api               # Full SDK API reference
│       └── /examples          # Code examples
│
├── /guides
│   ├── /rag-integration       # Integrating Kairos into existing RAG
│   ├── /document-ingestion    # Best practices for document processing
│   ├── /query-optimization    # Getting the best answers
│   ├── /strategy-tuning       # Manual strategy configuration (Developer+)
│   ├── /best-practices        # General best practices
│   ├── /migration             # Migrating from other RAG solutions
│   └── /self-hosting          # Self-hosted deployment guide (Enterprise)
│       ├── /docker            # Docker Compose deployment
│       ├── /kubernetes        # Helm chart deployment
│       ├── /configuration     # Environment variables, secrets
│       └── /monitoring        # Prometheus, Grafana setup
│
├── /architecture              # System architecture
│   ├── /overview              # High-level architecture
│   ├── /adaptive-engine       # Adaptive retrieval engine design
│   ├── /data-model            # Database schema
│   └── /security              # Security architecture
│
├── /faq                       # Frequently asked questions
│
├── /changelog                 # API changelog / version history
│
└── /search                    # Documentation search results (powered by Fuse.js or Algolia)
```

### 4.2 Documentation Features

| Feature | Implementation |
|---------|---------------|
| Search | Full-text search across all docs (Fuse.js client-side or Algolia) |
| Code blocks | Syntax highlighting with copy button |
| Edit on GitHub | Link to MDX source file on every page |
| Dark theme | Same theme as website (`#0B0F14` bg, Inter font) |
| Sidebar navigation | Collapsible tree with active page highlight |
| Breadcrumbs | Page hierarchy for deep navigation |
| Keyboard shortcuts | `Ctrl+K` for search, `Escape` to close |

---

## 5. status.kairos.dev (Status Page)

```
status.kairos.dev/
├── /                          # Status overview — all systems
├── /api                       # API status detail
├── /ingestion                 # Document ingestion pipeline status
├── /history                   # Incident history
└── /subscribe                 # Subscribe to status updates (email/Slack)
```

**Managed via**: Better Uptime (or equivalent). Low-maintenance, high-reliability.

---

## 6. SEO & URL Strategy

### 6.1 URL Conventions

| Rule | Example |
|------|---------|
| Lowercase only | `/product/adaptive-retrieval` not `/product/Adaptive-Retrieval` |
| Hyphens for spaces | `/multi-hop-reasoning` not `/multi_hop_reasoning` |
| No trailing slashes | `/pricing` not `/pricing/` |
| No file extensions | `/about` not `/about.html` |
| No query params for content | `/blog/posts/why-adaptive-retrieval` not `/blog/post?id=123` |

### 6.2 Redirect Strategy

| Old URL | New URL | Type |
|---------|---------|------|
| `kairos.so/*` | `kairos.dev/*` | 301 (permanent) |
| `kairos.ai/*` | `kairos.dev/*` | 301 (permanent) |
| `app.kairos.dev/login` | `kairos.dev/login` | 301 (SEO consolidation for auth pages) |
| Any misspelled URLs | Corrected URL or 404 with search | 301 or 404 |

### 6.3 SEO Metadata Template

```html
<!-- Every page must have: -->
<title>Page Title | Kairos</title>
<meta name="description" content="Page description with primary keywords." />
<meta property="og:title" content="Page Title | Kairos" />
<meta property="og:description" content="Page description." />
<meta property="og:image" content="https://kairos.dev/og-image.png" />
<meta property="og:url" content="https://kairos.dev/page-path" />
<meta name="twitter:card" content="summary_large_image" />

<!-- Canonical URL (avoid duplicate content) -->
<link rel="canonical" href="https://kairos.dev/page-path" />

<!-- JSON-LD Structured Data (homepage only) -->
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  "name": "Kairos",
  "applicationCategory": "DeveloperApplication",
  "operatingSystem": "Web",
  "description": "Adaptive knowledge intelligence platform."
}
</script>
```

### 6.4 Sitemap.xml

```
kairos.dev/sitemap.xml
├── / (daily, 1.0)
├── /product (weekly, 0.9)
├── /product/adaptive-retrieval (weekly, 0.8)
├── /product/multi-hop (weekly, 0.8)
├── /product/benchmarks (weekly, 0.8)
├── /product/cost-optimization (weekly, 0.8)
├── /pricing (weekly, 0.9)
├── /blog (weekly, 0.7)
├── /about (monthly, 0.5)
├── /contact (monthly, 0.3)
├── /privacy (monthly, 0.2)
├── /terms (monthly, 0.2)
├── /security (monthly, 0.3)
└── /blog/posts/* (weekly, 0.7)

docs.kairos.dev/sitemap.xml
├── / (weekly, 0.7)
├── /quickstart (weekly, 0.7)
├── /api-reference (weekly, 0.7)
└── ... all doc pages
```

---

## 7. Page Content Inventory

| Page | Primary Purpose | Content Type | Target Keyword |
|------|----------------|--------------|----------------|
| `/` | Convert visitors to sign-ups | Marketing + code | "adaptive retrieval platform" |
| `/product/*` | Educate and convince | Technical marketing | "adaptive RAG", "multi-hop retrieval" |
| `/pricing` | Convert to paid | Comparison + CTA | "RAG pricing", "knowledge platform pricing" |
| `/blog/*` | SEO + thought leadership | Technical articles | Long-tail AI/retrieval keywords |
| `/docs/*` | Enable developers | Technical docs | "Kairos API", "document Q&A API" |
| `/app/*` | Deliver product value | UI | N/A (authenticated, noindex) |

---

## 8. App-to-Website Navigation

```
Public website (kairos.dev)          Authenticated app (app.kairos.dev)
┌─────────────────────┐              ┌─────────────────────────┐
│  Header → Sign In   │─────────────→│  Login / Sign Up        │
│  Get Started CTA    │              │                         │
│                     │              │  After auth:            │
│  Footer → Sign In   │              │  Redirect to /dashboard │
└─────────────────────┘              └─────────────────────────┘
                                            │
                                            │
                                     ┌──────┴──────┐
                                     │  Dashboard  │
                                     │  /dashboard │
                                     └─────────────┘
                                            │
                              ┌─────────────┼─────────────┐
                              │             │             │
                              ▼             ▼             ▼
                        ┌──────────┐ ┌──────────┐ ┌──────────┐
                        │Documents │ │ Queries  │ │Analytics │
                        │ /docs    │ │ /queries │ │ /analytics│
                        └──────────┘ └──────────┘ └──────────┘
```

---

> *End of Website Sitemap*  
> *Phase 13 — Complete. Ready for implementation.*  
> *Brand: Orange Leaf Logo — LOCKED*
