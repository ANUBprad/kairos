# Phase 14 Implementation Plan

**Kairos SaaS Platform — Product Transformation & Public Web Experience**  
**Status:** Superseded by PHASE16_IMPL_PLAN.md  

---

## Overview

Phase 14 transforms Kairos from a research repository into a production SaaS platform. This is a product transformation — the Streamlit dashboard becomes an internal tool, and a new Next.js SaaS application becomes the public face of Kairos.

---

## Milestones

| Milestone | Timeline | Description |
|-----------|----------|-------------|
| M1: Foundation | Week 1-2 | Next.js setup, auth, database, deployment |
| M2: Marketing Site | Week 3-4 | Landing page, pricing, docs, blog |
| M3: User Dashboard | Week 5-7 | Authenticated app, query workspace, analytics |
| M4: API Platform | Week 8-9 | Public API, SDKs, rate limiting, usage tracking |
| M5: Billing | Week 10 | Stripe integration, plan management |
| M6: Internal Migration | Week 11 | Move Streamlit, update README, docs cleanup |
| M7: Public Beta | Week 12 | Launch to beta users |
| M8: v1.0 Launch | Week 14 | Public launch |

---

## Detailed Work Breakdown

### M1: Foundation (Weeks 1-2)

**Objective:** Production-ready Next.js app with auth, database, and CI/CD.

| Task | Effort | Dependencies | Details |
|------|--------|--------------|---------|
| 1.1 Initialize Next.js app | 2 days | — | Configure `apps/portal/` with Next.js 15, TypeScript, Tailwind v4 |
| 1.2 Add authentication | 3 days | 1.1 | Integrate Auth.js (NextAuth.js v5) with Email, Google, GitHub providers |
| 1.3 Set up database schema | 2 days | 1.1 | Prisma schema for Users, Projects, API Keys, Queries, Usage |
| 1.4 Run database migrations | 1 day | 1.3 | Initial migration to Supabase Postgres |
| 1.5 Configure deployment | 2 days | 1.1 | Vercel for frontend, Docker Compose for backend |
| 1.6 Set up CI/CD | 1 day | 1.5 | GitHub Actions for lint, test, deploy |
| 1.7 Add environment configuration | 1 day | 1.5 | `.env.example`, environment validation |
| **Total** | **12 days** | | |

### M2: Marketing Site (Weeks 3-4)

**Objective:** World-class marketing site with landing page, pricing, docs, and blog.

| Task | Effort | Dependencies | Details |
|------|--------|--------------|---------|
| 2.1 Build landing page | 4 days | 1.1 | Hero, Social Proof, How It Works, Engine Viz, Benchmarks, Features, CTA |
| 2.2 Build features page | 1 day | 2.1 | Detailed feature breakdown with visuals |
| 2.3 Build pricing page | 2 days | 2.1 | Tiered pricing cards, feature comparison, FAQ |
| 2.4 Build docs hub | 3 days | 1.1 | MDX-based documentation with sidebar nav and search |
| 2.5 Build blog | 2 days | 1.1 | MDX blog with category filtering, RSS |
| 2.6 Build company pages | 1 day | 2.1 | About, team, careers |
| 2.7 Build contact page | 1 day | 2.1 | Contact form + support options |
| 2.8 Build security page | 1 day | 2.1 | Security overview, compliance, certifications |
| 2.9 Build legal pages | 1 day | 2.1 | Privacy policy, terms of service |
| 2.10 Implement SEO | 1 day | 2.1-2.9 | Meta tags, structured data, sitemap, robots.txt |
| **Total** | **17 days** | | |

### M3: User Dashboard (Weeks 5-7)

**Objective:** Full authenticated SaaS application replacing the Streamlit dashboard.

| Task | Effort | Dependencies | Details |
|------|--------|--------------|---------|
| 3.1 Build app layout | 2 days | 1.2 | Sidebar, topbar, responsive shell |
| 3.2 Build dashboard home | 2 days | 3.1 | Stats cards, recent queries, usage chart |
| 3.3 Build project management | 3 days | 3.1 | CRUD projects, project detail, settings |
| 3.4 Build query workspace | 5 days | 1.2, 3.1 | Query input, strategy viz, results, history |
| 3.5 Build analytics pages | 4 days | 3.1 | Charts for volume, latency, cost, confidence |
| 3.6 Build API keys UI | 2 days | 3.1 | Key management, usage per key |
| 3.7 Build settings pages | 2 days | 3.1 | Profile, account, notifications, appearance |
| 3.8 Connect to backend API | 3 days | 3.4 | TanStack Query integration with Go gateway |
| 3.9 Implement loading/error/empty states | 1 day | 3.2-3.7 | Consistent UX across all pages |
| 3.10 Add dark mode | 1 day | 3.1 | Theme toggle with system preference detection |
| **Total** | **25 days** | | |

### M4: API Platform (Weeks 8-9)

**Objective:** Production-ready public API with SDKs and usage tracking.

| Task | Effort | Dependencies | Details |
|------|--------|--------------|---------|
| 4.1 Design OpenAPI spec | 2 days | — | Document all v1 endpoints |
| 4.2 Build API key auth | 2 days | 4.1 | Key generation, hashing, validation middleware |
| 4.3 Build rate limiting | 2 days | 4.2 | Token bucket per key + per IP |
| 4.4 Build usage tracking | 2 days | 4.3 | Log every API call to Postgres |
| 4.5 Build query streaming | 2 days | 3.4 | SSE streaming for real-time query results |
| 4.6 Build usage analytics endpoint | 1 day | 4.4 | Aggregate usage data for dashboard |
| 4.7 Add API documentation | 2 days | 4.1 | Interactive playground, code examples |
| 4.8 Build Python SDK | 3 days | 4.1 | Update existing `sdk/keiro/` with new endpoints |
| 4.9 Build TypeScript SDK | 3 days | 4.1 | New SDK for web/Node.js clients |
| **Total** | **19 days** | | |

### M5: Billing (Week 10)

**Objective:** Stripe integration with tiered plans and usage tracking.

| Task | Effort | Dependencies | Details |
|------|--------|--------------|---------|
| 5.1 Set up Stripe products | 1 day | — | Create plans in Stripe dashboard |
| 5.2 Build checkout flow | 2 days | 5.1 | Stripe Checkout + webhook handling |
| 5.3 Build billing portal | 2 days | 5.2 | Plan display, usage vs quota, invoices |
| 5.4 Build usage enforcement | 2 days | 4.4 | Quota checks, upgrade prompts, 402 errors |
| 5.5 Build invoice history | 1 day | 5.2 | List/download invoices |
| 5.6 Add payment method management | 1 day | 5.2 | Add/update/remove payment methods |
| **Total** | **9 days** | | |

### M6: Internal Migration (Week 11)

**Objective:** Move Streamlit dashboard, update all documentation.

| Task | Effort | Dependencies | Details |
|------|--------|--------------|---------|
| 6.1 Move Streamlit to apps/internal-dashboard/ | 1 day | — | Move `dashboard/` → `apps/internal-dashboard/` |
| 6.2 Update Docker Compose | 1 day | 6.1 | Point dashboard service to new location |
| 6.3 Update README.md | 1 day | — | Rewrite for SaaS product |
| 6.4 Remove public references | 1 day | 6.1 | Update docs, config files |
| 6.5 Update docs/INDEX.md | 0.5 day | 6.4 | Reflect new structure |
| 6.6 Update dashboard Dockerfile | 0.5 day | 6.1 | Fix paths for new location |
| **Total** | **5 days** | | |

### M7: Public Beta (Week 12)

**Objective:** Launch to beta users with monitoring and feedback collection.

| Task | Effort | Dependencies | Details |
|------|--------|--------------|---------|
| 7.1 Beta user onboarding | 2 days | M1-M6 | Invite flow, welcome email, docs |
| 7.2 Monitoring setup | 1 day | M1 | Grafana dashboards, alerting, uptime monitoring |
| 7.3 Feedback collection | 1 day | 7.1 | In-app feedback widget, NPS survey |
| 7.4 Bug fixes | 3 days | 7.1 | Address beta user issues |
| 7.5 Performance tuning | 2 days | 7.2 | Optimize slow queries, caching, CDN |
| **Total** | **9 days** | | |

### M8: v1.0 Launch (Weeks 13-14)

**Objective:** Public launch with marketing and press.

| Task | Effort | Dependencies | Details |
|------|--------|--------------|---------|
| 8.1 Penetration test | 2 days | M7 | Third-party security audit |
| 8.2 Load test | 2 days | M7 | k6/stress testing for launch traffic |
| 8.3 Launch blog post | 1 day | — | Product Hunt, Hacker News ready |
| 8.4 Status page setup | 1 day | M7 | Public status page |
| 8.5 Final QA pass | 2 days | 8.1, 8.2 | Full regression test |
| 8.6 Flip DNS to production | 0.5 day | 8.5 | Cutover to production |
| **Total** | **8.5 days** | | |

---

## Estimated Effort Summary

| Milestone | Days | Parallelizable |
|-----------|------|----------------|
| M1: Foundation | 12 | Low |
| M2: Marketing Site | 17 | Medium |
| M3: User Dashboard | 25 | Medium |
| M4: API Platform | 19 | Medium |
| M5: Billing | 9 | Low |
| M6: Internal Migration | 5 | Medium |
| M7: Public Beta | 9 | Medium |
| M8: v1.0 Launch | 8.5 | Low |
| **Total** | **~104.5 days** | |
| **With parallelism** | **~12 weeks** | |

---

## Dependencies Graph

```
M1: Foundation
├── M2: Marketing Site (can start after M1.1)
├── M3: User Dashboard (needs M1.2)
├── M4: API Platform (needs M1.2)
│   └── M5: Billing (needs M4.4)
├── M6: Internal Migration (can start after M3)
│   └── M7: Public Beta (needs M1-M6)
│       └── M8: v1.0 Launch (needs M7)
```

### Parallel Tracks

```
Week  1  2  3  4  5  6  7  8  9  10  11  12
M1    ████████░░░░░░░░░░░░░░░░░░░░░░░░░░░░░
M2    ░░░░█████████████░░░░░░░░░░░░░░░░░░░░
M3    ░░░░░░░░░░░░█████████████████░░░░░░░░
M4    ░░░░░░░░░░░░░░░░░██████████████░░░░░░
M5    ░░░░░░░░░░░░░░░░░░░░░░░░░███████░░░░
M6    ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░████░░
M7    ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░████
M8    ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░██
```

---

## Blockers

| Blocker | Impact | Resolution |
|---------|--------|------------|
| No Postgres database configured | Blocks M1.3 | Set up Supabase project (2 hours) |
| No Auth.js providers configured | Blocks M1.2 | Register OAuth apps (1 day) |
| Stripe account not set up | Blocks M5 | Create Stripe account + configure products (2 days) |
| Portal uses static export | Limits M3 features | Update `next.config.ts` for SSR (1 day) |
| Dashboard pages reference deleted modules | Blocks M6.1 | Verify imports after move (1 day) |

---

## MVP Definition

**Minimum Viable Product for Public Beta (M7):**

| Feature | Required for MVP | Notes |
|---------|-----------------|-------|
| Landing page | ✅ | Already partially built |
| User signup/login | ✅ | Email + Google |
| API key generation | ✅ | Web UI |
| Query endpoint | ✅ | POST /api/v1/query |
| Document ingestion | ✅ | PDF upload + chunking |
| Usage dashboard | ✅ | Basic charts |
| Free tier | ✅ | 1,000 queries/month |
| Documentation | ✅ | Quickstart + API reference |

## Post-MVP (M7 → v1.0)

| Feature | Priority | Timeline |
|---------|----------|----------|
| Team accounts | Medium | M7.5 |
| SSO (SAML) | Low | Post-v1 |
| Audit logs | Medium | Post-v1 |
| Custom strategies | Low | Post-v1 |
| Webhooks | Medium | Post-v1 |
| API playground | Low | Post-v1 |
| Mobile app | Low | Post-v1 |

---

## Risks

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| LLM API costs higher than expected | Medium | High | Set hard budget caps, monitor daily |
| ChromaDB performance at scale | Low | Medium | Benchmark with production data volumes |
| Auth.js migration issues | Low | High | Test auth flows thoroughly in staging |
| Stripe webhook failures | Low | Medium | Idempotency keys, retry logic, manual reconciliation |
| Portal build time too long | Medium | Low | Optimize imports, use turbopack |

---

## Success Metrics

| Metric | Beta Target | v1.0 Target |
|--------|-------------|-------------|
| Signups (weekly) | 100 | 500 |
| Active users (weekly) | 50 | 200 |
| Queries served (daily) | 1,000 | 10,000 |
| API uptime | 99.5% | 99.9% |
| P95 latency | < 500ms | < 300ms |
| NPS score | > 30 | > 50 |
| Documentation satisfaction | > 80% | > 90% |
