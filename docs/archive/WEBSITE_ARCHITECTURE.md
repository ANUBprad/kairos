# Website Architecture

**Phase 14 — Product Transformation**  
**Status:** Superseded by PHASE16_WEBSITE.md  

---

## Site Map

```
kairos.dev
│
├── /                          Landing page
├── /features                  Features overview
├── /pricing                   Pricing & plans
├── /docs                      Documentation hub
│   ├── /docs/quickstart       Quick start guide
│   ├── /docs/api-reference    API reference
│   ├── /docs/sdks/python      Python SDK
│   ├── /docs/sdks/go          Go SDK
│   ├── /docs/sdks/rest        REST API
│   ├── /docs/guides           Integration guides
│   └── /docs/faq              FAQ
├── /blog                      Blog
│   ├── /blog/engineering      Engineering blog
│   ├── /blog/product          Product updates
│   └── /blog/tutorials        Tutorials
├── /company                   About
│   ├── /company/about         About Kairos
│   ├── /company/team          Team
│   └── /company/jobs          Careers
├── /contact                   Contact / Sales
├── /security                  Security & compliance
├── /demo                      Request demo
├── /careers                   Careers
├── /legal                     Legal
│   ├── /legal/privacy         Privacy policy
│   ├── /legal/terms           Terms of service
│   └── /legal/cookies         Cookie policy
├── /status                    System status
│
├── /login                     Sign in
├── /signup                    Sign up
├── /forgot-password           Password reset
├── /magic-link                Magic link verification
│
└── /app                       Authenticated dashboard (app subdomain)
    ├── /app/home              Dashboard home
    ├── /app/projects          Project management
    ├── /app/queries           Query workspace
    ├── /app/analytics         Analytics & insights
    ├── /app/api-keys          API key management
    ├── /app/usage             Usage & billing
    ├── /app/billing           Billing & invoices
    ├── /app/settings          Account settings
    ├── /app/support           Support
    └── /app/docs              App documentation
```

---

## Page Architecture

### Public Pages

#### Landing Page (`/`)

| Section | Component | Description |
|---------|-----------|-------------|
| Navigation | `Nav` | Sticky header, transparent → solid on scroll |
| Hero | `Hero` | Value prop + CTA + animated visualization |
| Social Proof | `SocialProof` | Logos, testimonials, usage stats |
| Problem | `Problem` | "Every query is different" narrative |
| How It Works | `HowItWorks` | 3-step explainer (Classify → Plan → Retrieve) |
| Engine Viz | `EngineVisualization` | Animated adaptive routing diagram |
| Benchmarks | `Benchmarks` | Leaderboard table with 5 modes |
| Features Grid | `FeaturesGrid` | Card grid of capabilities |
| Architecture | `ArchitectureSection` | System diagram |
| Integrations | `Integrations` | Supported LLMs, data sources |
| Pricing | `PricingSection` | Tiered pricing cards |
| FAQ | `FAQSection` | Accordion FAQ |
| CTA | `CTASection` | Final call-to-action |
| Footer | `Footer` | Links, legal, social |

#### Features (`/features`)

| Section | Content |
|---------|---------|
| Hero | "Adaptive Retrieval, Explained" |
| Adaptive Routing | Interactive visualization of query routing |
| Confidence Calibration | How confidence scoring works |
| Budget Optimization | Cost-quality tradeoff visualization |
| Multi-Strategy | The 3 retrieval strategies |
| Feedback Learning | How the system improves over time |
| Observability | Monitoring & metrics |
| Enterprise | SSO, audit logs, dedicated support |

#### Pricing (`/pricing`)

| Tier | Price | Limits |
|------|-------|--------|
| Free | $0 | 1,000 queries/mo, 1 project, community support |
| Developer | $49 | 50,000 queries/mo, 10 projects, email support |
| Pro | $199 | 500,000 queries/mo, unlimited projects, priority support |
| Enterprise | Custom | Unlimited, dedicated infra, SSO, SLA |

#### Docs (`/docs`)

Serves the existing `docs/` content rendered as web pages with:
- Sidebar navigation
- Search (Fuse.js or Algolia)
- Code snippets with syntax highlighting
- Dark mode

#### Blog (`/blog`)

MDX-based blog with:
- Engineering deep-dives
- Product announcements
- Tutorials and guides
- RSS feed
- Category filtering

### Auth Pages

#### Login (`/login`)

- Email input → password or magic link
- Google OAuth button
- GitHub OAuth button
- "Sign up" link
- "Forgot password" link

#### Sign Up (`/signup`)

- Name, email, password form
- Google OAuth button
- GitHub OAuth button
- "Already have an account?" link

#### Forgot Password (`/forgot-password`)

- Email input → send reset link
- Confirmation screen

### Authenticated Pages (App Router)

#### Dashboard Home (`/app/home`)

| Widget | Content |
|--------|---------|
| Welcome | Greeting + quick stats |
| Recent Queries | Last 10 queries with results |
| Usage Graph | 7-day query volume chart |
| System Health | Service status indicators |
| Quick Actions | New query, new project, view docs |

#### Projects (`/app/projects`)

- Project list with search + filter
- Create project modal
- Project detail page
- Project settings

#### Query Workspace (`/app/queries`)

- Query input with strategy visualization
- Results display with confidence, latency, cost
- History sidebar
- Export results

#### Analytics (`/app/analytics`)

| Chart | Metric |
|-------|--------|
| Query Volume | Queries per day/week/month |
| Strategy Distribution | Pie chart of strategies used |
| Latency Trends | Avg P50 P95 latency over time |
| Cost Analysis | Cost per query, per project |
| Confidence Distribution | Histogram of confidence scores |
| Error Rate | Failure rate over time |

#### API Keys (`/app/api-keys`)

- Key list with prefix, name, created date
- Create key modal (with scope selection)
- Revoke key confirmation
- Usage per key

#### Billing (`/app/billing`)

- Current plan display
- Usage vs quota progress bars
- Invoice history
- Payment method management
- Plan upgrade/downgrade

#### Settings (`/app/settings`)

| Tab | Fields |
|-----|--------|
| Profile | Name, email, avatar |
| Account | Password, email preferences |
| Team | Team members, roles (Enterprise) |
| Notifications | Alert preferences |
| Appearance | Theme toggle |

---

## Component Architecture

```
components/
├── ui/                       shadcn/ui primitives
│   ├── button.tsx
│   ├── card.tsx
│   ├── input.tsx
│   ├── dialog.tsx
│   ├── dropdown-menu.tsx
│   ├── tabs.tsx
│   ├── badge.tsx
│   ├── avatar.tsx
│   ├── skeleton.tsx
│   ├── table.tsx
│   ├── toast.tsx
│   └── tooltip.tsx
├── marketing/                Marketing site components
│   ├── nav.tsx
│   ├── footer.tsx
│   ├── hero.tsx
│   ├── social-proof.tsx
│   ├── problem.tsx
│   ├── how-it-works.tsx
│   ├── engine-visualization.tsx
│   ├── benchmarks.tsx
│   ├── features-grid.tsx
│   ├── architecture-section.tsx
│   ├── integrations.tsx
│   ├── pricing-section.tsx
│   ├── faq-section.tsx
│   ├── cta-section.tsx
│   ├── leaf-logo.tsx
│   └── contact-form.tsx
├── dashboard/                App dashboard components
│   ├── sidebar.tsx
│   ├── topbar.tsx
│   ├── stats-card.tsx
│   ├── query-input.tsx
│   ├── query-result.tsx
│   ├── usage-chart.tsx
│   ├── api-key-manager.tsx
│   ├── project-list.tsx
│   ├── billing-card.tsx
│   └── settings-form.tsx
├── auth/                     Auth-related components
│   ├── login-form.tsx
│   ├── signup-form.tsx
│   ├── oauth-buttons.tsx
│   ├── magic-link-form.tsx
│   └── forgot-password-form.tsx
└── shared/                   Shared utilities
    ├── theme-toggle.tsx
    ├── loading-state.tsx
    ├── error-boundary.tsx
    └── empty-state.tsx
```

---

## Data Flow

```
1. User visits kairos.dev
2. Vercel edge serves static pages (SSG) or SSR
3. Marketing pages are static + ISR
4. Auth pages are SSR with server actions
5. Dashboard pages are CSR with TanStack Query
6. API calls go through Next.js rewrites → Go Gateway
7. Gateway authenticates, rate limits, proxies to Intelligence
8. Intelligence executes query, returns results
9. Usage is logged to Postgres for billing
```

---

## SEO Strategy

| Page | Keywords | Priority |
|------|----------|----------|
| `/` | adaptive retrieval, RAG platform | Critical |
| `/features` | AI retrieval features, RAG optimization | High |
| `/pricing` | AI API pricing, RAG pricing | High |
| `/docs` | RAG documentation, retrieval API docs | Medium |
| `/blog` | RAG best practices, retrieval strategies | Medium |

- All pages: semantic HTML, meta tags, Open Graph, Twitter Cards
- Blog: structured data, sitemap, RSS
- Docs: technical SEO, code snippets indexing
- Performance: Core Web Vitals target, lazy loading, code splitting
