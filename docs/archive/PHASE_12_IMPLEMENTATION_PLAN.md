# Kairos — Phase 12 Implementation Plan

> **Document**: Phase 12 Implementation & Engineering Roadmap  
> **Product**: Kairos — Adaptive Knowledge Intelligence  
> **Status**: PLANNING → EXECUTION  
> **Duration**: 6 weeks (240 engineering hours)  
> **Goal**: Research project → Working SaaS MVP

---

## 1. Current State Assessment

### What Exists (Production-Ready)

| Component | Status | Notes |
|-----------|--------|-------|
| Intelligence engine | ✅ Complete | Planner, classifier, 3 retrievers, fallback, calibration, optimization |
| Go API gateway | ✅ Complete | Auth middleware (needs user integration), rate limiting, caching, metrics |
| gRPC service | ✅ Complete | 6 RPCs, well-defined proto |
| ChromaDB integration | ✅ Complete | Upsert, query, collection management |
| Prometheus/Grafana | ✅ Complete | Metrics, dashboards, alert rules deployed |
| Benchmark suite | ✅ Complete | 1,020 queries, 5 domains, 5 modes, leaderboard |
| Dashboard (internal) | ✅ Complete | 13-page Streamlit with dark theme |
| Tests | ✅ Complete | 1,802 passing, 38 test files |
| Docker Compose | ✅ Complete | 8 services, production topology |
| Documentation | ✅ Complete | 15+ markdown docs, architecture diagrams |

### What's Missing (MVP Gap)

| Component | Status | Effort |
|-----------|--------|--------|
| User authentication | ❌ Missing | 2 days |
| Database (PostgreSQL) | ❌ Missing (file-based JSON) | 3 days |
| API key management | ❌ Missing | 1 day |
| Usage metering | ❌ Missing | 2 days |
| Frontend application | ❌ Missing (Streamlit only) | 15 days |
| Landing page | ❌ Missing | 3 days |
| API documentation | ❌ Missing | 3 days |
| Billing integration | ❌ Missing | 2 days |
| Python SDK (auth-enabled) | ⚠️ Partial | 1 day |
| CI/CD for deployment | ⚠️ Partial (test/lint only) | 2 days |

---

## 2. Milestones

```
Week 1: Auth + Database Foundation
Week 2: API Enhancement + Metering
Week 3: Frontend Shell + Landing Page
Week 4: Core App Pages (Documents, Queries)
Week 5: Analytics + Settings + Docs
Week 6: Billing + Testing + Launch Prep
```

### Milestone 1: Auth + Database (Week 1)

**Dependencies**: None

**Deliverables**:
- [ ] Auth0/Clerk tenant configured
- [ ] GitHub OAuth + Google OAuth + Email/Password
- [ ] PostgreSQL schema deployed (Supabase)
- [ ] User model: create, read, update
- [ ] Workspace model: create on sign-up, CRUD
- [ ] API key model: generate, hash, validate
- [ ] Auth middleware in Go gateway (validate API key/JWT)
- [ ] Sign-up flow: OAuth → user created → workspace created → API key generated
- [ ] Login flow: OAuth → session created → redirect to app
- [ ] Session management (JWT or HTTP-only cookies)

**Risk**: Auth integration complexity with existing Go gateway  
**Mitigation**: Use Auth0's well-documented Go SDKs, test with Postman collection

**Definition of Done**: New user can sign up with GitHub, receive API key, make authenticated API call.

---

### Milestone 2: API Enhancement + Usage Metering (Week 1–2)

**Dependencies**: Milestone 1 (database schema)

**Deliverables**:
- [ ] Usage metering middleware in Go gateway
- [ ] UsageEvent table: workspace_id, event_type, tokens, latency, cost
- [ ] Record every /v1/query as a UsageEvent
- [ ] Record document ingestion as UsageEvent
- [ ] GET /v1/analytics/usage endpoint (queries over time, strategy breakdown)
- [ ] GET /v1/analytics/queries endpoint (recent queries, paginated)
- [ ] Document upload API (multipart, S3/R2 storage)
- [ ] Document status endpoint (poll ingestion progress)
- [ ] Feedback API (POST /v1/feedback with query_id + rating)
- [ ] Standardized error responses (RFC 7807 problem details)
- [ ] Rate limiting per API key (existing token bucket, wire to user)

**Risk**: Usage metering adds latency to query path  
**Mitigation**: Async write to usage_events table, fire-and-forget pattern

**Definition of Done**: Authenticated API calls record usage, analytics endpoint returns data, document upload works with status tracking.

---

### Milestone 3: Frontend Shell + Landing Page (Week 2–3)

**Dependencies**: Milestone 1 (auth for sign-up flow)

**Deliverables**:
- [ ] Next.js project scaffolded with App Router
- [ ] Tailwind CSS + design tokens configured (matching theme.py)
- [ ] shadcn/ui component library installed
- [ ] Dark theme applied globally
- [ ] Orange leaf logo as SVG component
- [ ] Fonts: Inter (body), JetBrains Mono (code) — self-hosted
- [ ] Landing page implemented per LANDING_PAGE_SPEC.md
- [ ] Sign-up page with OAuth buttons
- [ ] Login page
- [ ] App layout shell (sidebar + top bar + content area)
- [ ] Sidebar navigation with all pages
- [ ] User avatar + dropdown menu
- [ ] Workspace selector
- [ ] Authenticated route protection
- [ ] API client library (typed fetch wrapper)

**Risk**: Frontend development takes longer than estimated  
**Mitigation**: Use shadcn/ui for rapid component assembly, prioritize landing page + auth flow first

**Definition of Done**: Visitor can view landing page, sign up, and land in authenticated app shell.

---

### Milestone 4: Core App Pages (Week 3–4)

**Dependencies**: Milestone 2 (API endpoints), Milestone 3 (app shell)

**Deliverables**:
- [ ] Dashboard page:
  - KPI cards (queries, recall, latency, cost, docs)
  - Queries over time chart (Recharts)
  - Strategy breakdown donut chart
  - Recent activity feed
  - Quick query bar
  - Empty state with upload/document-CTA
- [ ] Documents page:
  - Document list (table, sortable, searchable)
  - Upload zone (drag-and-drop)
  - Upload modal with progress tracking
  - Status indicators (ready, processing, failed)
  - Document preview panel
- [ ] Collections page:
  - Collection grid cards
  - Create collection modal
  - Collection detail view
  - Add/remove documents from collection
- [ ] Queries page:
  - Full-width query interface
  - Query history sidebar
  - Answer card with sources, strategy, confidence, latency, cost
  - Source preview (open document at chunk)
  - Feedback buttons
  - Suggested questions on idle
  - Conversation threading

**Risk**: Real-time query status requires polling — could feel slow  
**Mitigation**: Use server-sent events or shorter polling intervals (1s), show intermediate states

**Definition of Done**: User can upload a document, ask a question, receive an answer with sources, and see it in analytics.

---

### Milestone 5: Analytics + Settings + Docs (Week 4–5)

**Dependencies**: Milestone 2 (analytics API), Milestone 4 (documents/queries working)

**Deliverables**:
- [ ] Analytics page:
  - 5 KPI cards with trend indicators
  - Queries over time chart (interactive date range)
  - Strategy breakdown donut chart (+ click to filter)
  - Latency trend chart (p50, p95, p99)
  - Cost analysis stacked bar chart
  - Recent queries table (paginated)
  - Export to CSV
- [ ] Settings page:
  - General tab (workspace name, profile)
  - API Keys tab (list, generate, revoke, copy)
  - Team tab (member list, invite, roles)
  - Billing tab (plan, payment method, invoice history)
  - Integrations tab (webhooks, API docs link)
- [ ] Documentation site:
  - Quickstart guide (MDX)
  - API Reference (all endpoints with examples)
  - Python SDK docs
  - Integration guides (RAG, ingestion, best practices)
  - Architecture overview

**Risk**: Documentation is time-consuming  
**Mitigation**: Start docs early in parallel, use MDX templates, focus on quickstart + API reference first

**Definition of Done**: Full analytics visible, settings functional, documentation published.

---

### Milestone 6: Billing + Testing + Launch Prep (Week 5–6)

**Dependencies**: Milestone 2 (usage metering), Milestone 5 (settings page)

**Deliverables**:
- [ ] Stripe account configured
- [ ] Pricing tiers (Free, Developer, Team, Enterprise)
- [ ] Subscription management (create, change, cancel)
- [ ] Usage-based billing (metered API calls)
- [ ] Invoice generation + payment history
- [ ] Plan upgrade/downgrade flow in settings
- [ ] Usage limits per tier (enforced in gateway middleware)
- [ ] End-to-end testing:
  - Sign up → upload → query → answer → analytics
  - API key generation → SDK query → response
  - Team invitation → member queries → billing
  - Error states: rate limit, upload failure, query timeout
- [ ] Performance testing (load test query endpoint)
- [ ] Security review (auth, API keys, data encryption)
- [ ] Deployment automation:
  - Vercel for frontend (auto-deploy from main)
  - Fly.io for backend services
  - Supabase for database
  - GitHub Actions for CI/CD
- [ ] Monitoring setup:
  - Sentry for error tracking
  - Better Uptime for status page
  - Grafana alerts for production

**Risk**: Stripe integration complexity (webhooks, idempotency)  
**Mitigation**: Use Stripe's well-documented checkout + customer portal, test extensively in sandbox

**Definition of Done**: User can sign up for paid plan, usage is metered and billed, infra is deployed and monitored.

---

## 3. Detailed Task Breakdown

### Week 1: Auth + Database

| Day | Tasks | Owner |
|-----|-------|-------|
| Day 1 | Set up Auth0 tenant, configure GitHub/Google OAuth, test login flow | Backend |
| Day 2 | Create PostgreSQL schema in Supabase (users, workspaces, api_keys tables) | Backend |
| Day 3 | Implement user creation on OAuth callback, workspace creation on sign-up | Backend |
| Day 4 | Implement API key generation (with bcrypt hashing), key validation middleware | Backend |
| Day 5 | Wire auth middleware into Go gateway (validate JWT session or API key) | Backend |
| Day 6 | End-to-end auth flow test + bug fixes | Backend |
| Day 7 | Buffer / documentation of auth flow | Backend |

### Week 2: API + Metering

| Day | Tasks | Owner |
|-----|-------|-------|
| Day 8 | UsageEvent schema + recording middleware | Backend |
| Day 9 | GET /v1/analytics/usage + /v1/analytics/queries endpoints | Backend |
| Day 10 | Document upload API (multipart, S3/R2, status tracking) | Backend |
| Day 11 | Document status polling + feedback API | Backend |
| Day 12 | Standardized error responses + rate limit per key | Backend |
| Day 13 | API testing + documentation | Backend |
| Day 14 | Buffer / integration testing | Backend |

### Week 3: Frontend Shell + Landing Page

| Day | Tasks | Owner |
|-----|-------|-------|
| Day 15 | Next.js scaffold, Tailwind config, design tokens, shadcn/ui setup | Frontend |
| Day 16 | Landing page: Nav + Hero section | Frontend |
| Day 17 | Landing page: Problem + Solution + Features sections | Frontend |
| Day 18 | Landing page: Benchmarks + Architecture + Integrations + Pricing + CTA + Footer | Frontend |
| Day 19 | Sign-up page, Login page, App layout shell (sidebar + top bar) | Frontend |
| Day 20 | Auth flow integration (redirect, session, route protection) | Frontend |
| Day 21 | API client library + buffer | Frontend |

### Week 4: Core App Pages

| Day | Tasks | Owner |
|-----|-------|-------|
| Day 22 | Dashboard: KPI cards, recent activity, quick query bar, empty state | Frontend |
| Day 23 | Dashboard: Charts (queries over time, strategy breakdown) | Frontend |
| Day 24 | Documents: List view, upload zone, upload modal | Frontend |
| Day 25 | Documents: Status indicators, preview panel, delete/rename | Frontend |
| Day 26 | Queries: Full-width query interface, answer card, strategy badges | Frontend |
| Day 27 | Queries: History sidebar, conversation threading, suggested questions | Frontend |
| Day 28 | Buffer + polish + integration testing | Frontend |

### Week 5: Analytics + Settings + Docs

| Day | Tasks | Owner |
|-----|-------|-------|
| Day 29 | Analytics: KPI cards, queries over time chart | Frontend |
| Day 30 | Analytics: Strategy breakdown, latency trend, cost analysis | Frontend |
| Day 31 | Analytics: Recent queries table, export, date range picker | Frontend |
| Day 32 | Settings: General, API Keys tabs | Frontend |
| Day 33 | Settings: Team, Billing, Integrations tabs | Frontend |
| Day 34 | Documentation: Quickstart + API Reference | Docs |
| Day 35 | Documentation: SDK docs + Integration guides | Docs |

### Week 6: Billing + Testing + Launch

| Day | Tasks | Owner |
|-----|-------|-------|
| Day 36 | Stripe integration: products, prices, checkout | Backend |
| Day 37 | Stripe webhooks: subscription created/updated/cancelled | Backend |
| Day 38 | Usage limits middleware + billing UI in Settings | Backend + Frontend |
| Day 39 | End-to-end testing + bug fixing | All |
| Day 40 | Performance testing + security review | Backend |
| Day 41 | Deployment automation + monitoring setup | All |
| Day 42 | Launch prep: runbook, status page, monitoring alerts | All |

---

## 4. Effort Summary

| Milestone | Backend | Frontend | Docs | Total |
|-----------|---------|----------|------|-------|
| M1: Auth + Database | 6 days | 1 day | — | 7 days |
| M2: API + Metering | 7 days | — | — | 7 days |
| M3: Frontend Shell + Landing | — | 7 days | — | 7 days |
| M4: Core App Pages | — | 7 days | — | 7 days |
| M5: Analytics + Settings + Docs | — | 5 days | 2 days | 7 days |
| M6: Billing + Testing + Launch | 3 days | 2 days | 1 day | 7 days |
| **Total** | **16 days** | **22 days** | **3 days** | **42 days** |

### Resource Allocation

| Role | Allocation | Responsibility |
|------|------------|----------------|
| Backend engineer | 100% (weeks 1–2, 6) | Auth, API, metering, billing, deployment |
| Frontend engineer | 100% (weeks 3–6) | Landing page, app UI, charts, settings |
| Designer/PM | 25% (weeks 1–6) | UX reviews, content, launch coordination |
| Total effort | 240 engineering hours | 6 weeks |

---

## 5. Dependencies Graph

```
M1: Auth + Database
  │
  ├──→ M2: API + Metering     (needs database schema)
  │
  └──→ M3: Frontend Shell     (needs auth flow)
         │
         ├──→ M4: Core Pages  (needs API endpoints)
         │
         └──→ M5: Analytics   (needs analytics API + M4)
                  │
                  └──→ M6: Billing (needs usage metering + M5)
```

**Critical Path**: M1 → M3 → M4 → M5 → M6 (5 weeks minimum)

**Parallel Work**:
- M2 can run in parallel with M3 (different engineers)
- Documentation can start week 1 (not dependent on code)
- Landing page can start before app shell (different routes)

---

## 6. Risks & Mitigations

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| Auth integration with Go gateway complex | Medium | High | Use Auth0 Go middleware, test with separate staging first |
| Frontend 6 weeks is aggressive | Medium | High | Prioritize landing page + query flow first, defer analytics polish |
| ChromaDB performance at scale | Low | Medium | Keep file-based for MVP, plan Pinecone migration later |
| Stripe webhooks unreliable | Low | Medium | Idempotency keys, webhook retry, manual reconciliation UI |
| Developer docs take too long | Medium | Low | Start week 1, use templates, ship quickstart + API ref only for MVP |
| Browser testing matrix large | Low | Medium | Test Chrome + Firefox + Safari, responsive breakpoints |
| No dedicated designer | Medium | Medium | Use shadcn/ui, follow theme.py design tokens exactly |

---

## 7. Architecture Decisions

### Decision Log

| ID | Decision | Rationale | Status |
|----|----------|-----------|--------|
| AD-01 | Vercel for frontend | Zero-config, auto-deploy, edge caching, team-friendly | ✅ Accepted |
| AD-02 | Fly.io for backend | Container-native, auto-scaling, global regions, simple deploy | ✅ Accepted |
| AD-03 | Supabase for PostgreSQL | Managed Postgres, auth helpers, real-time, generous free tier | ✅ Accepted |
| AD-04 | Auth0 for authentication | Enterprise-ready, social login, MFA, well-documented SDKs | ✅ Accepted |
| AD-05 | Stripe for billing | Industry standard, metered billing, customer portal, webhooks | ✅ Accepted |
| AD-06 | Cloudflare R2 for file storage | S3-compatible, no egress fees, global CDN | ✅ Accepted |
| AD-07 | MDX for documentation | Version-controlled, code examples, colocated with codebase | ✅ Accepted |
| AD-08 | ChromaDB for MVP vector store | Already integrated, works for small-medium scale | 🔄 Keep for MVP |
| AD-09 | Kept separate landing + app | SEO for landing, auth-protected for app, clean separation | ✅ Accepted |
| AD-10 | Keep existing Streamlit dashboard | Internal tool only, not customer-facing | ✅ Accepted |

---

## 8. Deployment Architecture

### Production Environment

```
Frontend:           Vercel (app.kairos.dev, kairos.dev)
Backend API:        Fly.io (api.kairos.dev)
Database:           Supabase (us-east-1)
File Storage:       Cloudflare R2
Vector Store:       Fly.io (ChromaDB container)
Monitoring:         Grafana Cloud + Sentry
Status Page:        Better Uptime
DNS:                Cloudflare
```

### CI/CD Pipeline

```yaml
# .github/workflows/deploy.yml
name: Deploy
on:
  push:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: pip install -r requirements.txt
      - run: pytest

  deploy-frontend:
    needs: test
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: cd apps/portal && vercel --prod --token=${{ secrets.VERCEL_TOKEN }}

  deploy-backend:
    needs: test
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: flyctl deploy --config fly.gateway.toml
      - run: flyctl deploy --config fly.intelligence.toml
```

---

## 9. Success Criteria

### Launch Gate Criteria

- [ ] User can sign up with GitHub OAuth
- [ ] User can upload a PDF document
- [ ] User can ask a question and receive an answer with sources
- [ ] Answer shows strategy badge, confidence score, latency, cost
- [ ] User can view analytics (queries over time, strategy breakdown)
- [ ] User can generate and manage API keys
- [ ] User can invite team members
- [ ] Free tier limits are enforced (100 docs, 1K queries)
- [ ] Paid subscription can be purchased via Stripe
- [ ] Landing page loads in <2s, Lighthouse >95
- [ ] All 1,802 tests pass
- [ ] API documentation published with quickstart guide
- [ ] Monitoring alerts configured and tested

### Post-Launch Validation

| Metric | Week 1 Target | Month 1 Target |
|--------|---------------|----------------|
| Sign-ups | 100 | 500 |
| Active users (DAU) | 20 | 100 |
| Queries processed | 1,000 | 50,000 |
| Documents uploaded | 200 | 2,000 |
| GitHub stars | 50 | 500 |
| Paid conversions | 5 | 50 |
| Page load time | <2s | <1.5s |
| API uptime | >99.5% | >99.9% |
| Error rate | <2% | <1% |
| NPS | — | >40 |

---

## 10. What We Will NOT Build in Phase 12

To maintain focus and meet the 6-week timeline, the following are explicitly **out of scope**:

- Self-hosted deployment (Phase 14)
- SSO/SAML authentication (Phase 14)
- Role-based access control (Phase 14)
- Audit logging (Phase 14)
- Custom branding / white-label (Phase 14)
- Dedicated instances (Phase 14)
- LLM Judge Framework (Phase 15)
- Webhook system (Phase 13)
- Real-time collaboration (Phase 16)
- Mobile app (Phase 16)
- JavaScript SDK (Phase 13)
- OpenAI-compatible API (Phase 13)
- Custom strategy configuration (Phase 13)
- Document collections UI (Phase 13)
- Audio/video transcription (Phase 13)
- Advanced analytics custom dashboards (Phase 13)

---

> *End of Phase 12 Implementation Plan*  
> *Next: Begin Phase 12 — Implementation*  
> *Brand: Orange Leaf Logo — LOCKED*
