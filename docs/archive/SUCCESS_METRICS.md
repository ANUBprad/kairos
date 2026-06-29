# Kairos — Success Metrics & KPIs

> **Document**: Product Success Metrics, KPIs & OKRs  
> **Product**: Kairos — Adaptive Knowledge Intelligence  
> **Status**: LOCKED — Phase 12  
> **Author**: Product Founder / VC Advisor

---

## 1. North Star Metric

> **Answers delivered with adaptive intelligence per month.**

This metric captures the core value Kairos provides: every time a user gets an answer that was optimized by our adaptive engine, we've delivered value. It correlates with:
- User engagement (more queries = more value)
- Revenue (more queries = more usage = upgrade trigger)
- Platform improvement (more queries = more training data for CostOptimizer)
- Moat deepening (more queries = better optimization models)

**Why this over revenue or MAU**: Revenue can grow without value (price increases). MAU can grow without engagement. "Answers delivered" is the purest measure of Kairos actually doing its job.

---

## 2. Metric Categories

### 2.1 Revenue Metrics

| Metric | Definition | MVP Target (Month 1) | V1 Target (Month 3) | Year 1 Target |
|--------|-----------|---------------------|---------------------|---------------|
| **MRR** | Monthly recurring revenue | $2,000 | $15,000 | $42,000 |
| **ARR** | Annualized MRR | $24K | $180K | $500K |
| **ARPU** | Avg revenue per paid user | $29 (Developer only) | $45 (mix shift) | $85 (enterprise mix) |
| **LTV** | Lifetime value (avg paid user) | $150 | $350 | $800 |
| **CAC** | Customer acquisition cost | $0 (organic) | $20 | $50 |
| **LTV:CAC** | Efficiency ratio | ∞ (organic) | 17.5:1 | 16:1 |
| **Gross MRR churn** | Lost MRR / starting MRR | — | <5%/mo | <3%/mo |
| **Net MRR churn** | Gross churn - expansion | — | <3%/mo | <1%/mo (expansion from upgrades) |
| **Free → Paid conversion** | % of free users who pay | >3% | >5% | >8% |
| **Enterprise ACV** | Avg annual contract value | — | — | $42K |

### 2.2 Engagement Metrics

| Metric | Definition | MVP Target | V1 Target | Year 1 Target |
|--------|-----------|-----------|-----------|---------------|
| **Daily Active Users (DAU)** | Unique users who perform ≥1 query | 20 | 100 | 500 |
| **Monthly Active Users (MAU)** | Unique users who perform ≥1 query in 30 days | 200 | 1,000 | 5,000 |
| **DAU/MAU** | Daily engagement ratio | 10% | 15% | 20% |
| **Queries per active user/day** | Avg daily queries per DAU | 2 | 3 | 5 |
| **Queries per active user/month** | Avg monthly queries per MAU | 15 | 30 | 50 |
| **Documents per user** | Avg docs uploaded per user | 3 | 5 | 10 |
| **Session duration** | Avg time in app per session | 8 min | 12 min | 15 min |
| **Session frequency** | Avg sessions per week | 2 | 3 | 4 |

### 2.3 Activation Metrics

| Metric | Definition | MVP Target | V1 Target | Year 1 Target |
|--------|-----------|-----------|-----------|---------------|
| **Sign-up → First query** | % of users who ask first query within 24h | >60% | >70% | >80% |
| **Sign-up → Upload doc** | % of users who upload doc within 24h | >50% | >60% | >70% |
| **Time to activation** | Median time from sign-up to first query | <5 min | <3 min | <2 min |
| **Activation rate** | % of sign-ups who complete core loop (upload + query + answer) | >40% | >50% | >60% |
| **Day 1 retention** | % of users who return day after sign-up | >25% | >35% | >45% |
| **Day 7 retention** | % of users who return within 7 days | >15% | >25% | >35% |

### 2.4 Retention Metrics

| Metric | Definition | MVP Target | V1 Target | Year 1 Target |
|--------|-----------|-----------|-----------|---------------|
| **D7 retention** | % active in days 4–10 after sign-up | >30% | >40% | >50% |
| **D30 retention** | % active in days 20–40 after sign-up | >15% | >20% | >30% |
| **D90 retention** | % active in days 80–100 after sign-up | >8% | >12% | >18% |
| **Weekly active rate** | % of MAU active in a given week | 40% | 50% | 60% |
| **Paid user retention** | % of paid users who renew | — | >80% | >90% |
| **Logo retention** | % of workspaces still active after 6 months | — | >70% | >80% |

### 2.5 Product Quality Metrics

| Metric | Definition | MVP Target | V1 Target | Year 1 Target |
|--------|-----------|-----------|-----------|---------------|
| **Query success rate** | % of queries that return a valid answer | >95% | >97% | >99% |
| **Avg confidence score** | Mean confidence across all queries | >85% | >88% | >90% |
| **Avg query latency** | Mean time from query → answer (end-to-end) | <3s | <2s | <1.5s |
| **p95 query latency** | 95th percentile query latency | <8s | <5s | <3s |
| **Avg query cost** | Mean cost per query (all strategies) | $0.008 | $0.006 | $0.005 |
| **Fallback rate** | % of queries requiring fallback | <5% | <3% | <2% |
| **Error rate** | % of queries returning an error | <2% | <1% | <0.5% |
| **User satisfaction (thumbs up)** | % of feedback with thumbs up | — | >80% | >85% |

### 2.6 Infrastructure Metrics

| Metric | Definition | MVP Target | V1 Target | Year 1 Target |
|--------|-----------|-----------|-----------|---------------|
| **API uptime** | % of time API responds successfully | >99.5% | >99.9% | >99.95% |
| **API availability (SLA)** | Measured by synthetic checks | >99.5% | >99.9% | >99.95% |
| **Page load time (landing)** | LCP for landing page | <2s | <1.5s | <1.2s |
| **Page load time (app)** | LCP for authenticated app shell | <3s | <2s | <1.5s |
| **Error budget** | Monthly allowable error rate | 2% | 1% | 0.5% |
| **P50 API latency** | Median gateway → response time | <200ms | <150ms | <100ms |
| **P95 API latency** | 95th percentile gateway → response time | <1s | <500ms | <300ms |

### 2.7 Business Health Metrics

| Metric | Definition | MVP Target | V1 Target | Year 1 Target |
|--------|-----------|-----------|-----------|---------------|
| **Gross margin** | (Revenue - COGS) / Revenue | >85% | >88% | >90% |
| **Burn rate** | Monthly operating cost | $15K | $25K | $40K |
| **Runway** | Cash / burn rate | 12 months | 18 months | 24 months |
| **Revenue per employee** | MRR / headcount | — | $3K | $5K |
| **Net Promoter Score** | User satisfaction survey (0–100) | — | >40 | >50 |

---

## 3. OKR Framework (First 3 Quarters)

### Q1: Launch + Traction (Weeks 1–12)

| Objective | Key Results |
|-----------|-------------|
| **Launch Kairos SaaS MVP** | 1. Ship MVP with auth, upload, query, analytics, billing — Week 6 |
| | 2. Achieve 200 sign-ups in first month |
| | 3. 40% activation rate (upload + query within 24h) |
| | 4. 30% D7 retention |
| | 5. $2,000 MRR by end of Q1 |
| **Validate product-market fit** | 1. 10 users complete NPS survey with score >40 |
| | 2. 50 queries/day processed by Week 8 |
| | 3. 5 unsolicited testimonials / shoutouts |
| | 4. <5% free → paid conversion |
| **Build reliable infrastructure** | 1. 99.5% API uptime |
| | 2. <2% query error rate |
| | 3. Landing page Lighthouse >95 |
| | 4. All 1,802 tests passing in CI |

### Q2: Growth + V1 Ship (Months 4–6)

| Objective | Key Results |
|-----------|-------------|
| **Ship V1 features** | 1. Launch collections, team invitations, conversation history |
| | 2. Launch advanced analytics page |
| | 3. Ship JavaScript SDK + webhooks |
| | 4. Launch OpenAI-compatible API endpoint |
| **Grow paid revenue** | 1. $15,000 MRR |
| | 2. 1,000 MAU |
| | 3. 10% free → paid conversion rate |
| | 4. 60 paid users (Developer + Team) |
| **Improve product quality** | 1. 50% D7 retention |
| | 2. Avg query latency <2s |
| | 3. >85% user satisfaction (thumbs up) |
| | 4. NPS >45 |

### Q3: Scale + V2 Foundation (Months 7–9)

| Objective | Key Results |
|-----------|-------------|
| **Ship V2 enterprise features** | 1. Launch SSO/SAML authentication |
| | 2. Launch self-hosted deployment option |
| | 3. Launch RBAC + audit logging |
| | 4. Launch first 3 data connectors (Confluence, Notion, GDrive) |
| **Scale revenue** | 1. $42,000 MRR |
| | 2. 5,000 MAU |
| | 3. 2 enterprise deals closed |
| | 4. 70% paid user retention (6-month) |
| **Build for scale** | 1. 99.9% API uptime |
| | 2. <1% error rate |
| | 3. Pinecone migration for vector storage |
| | 4. p95 query latency <5s |

---

## 4. Metric Tracking & Reporting

### 4.1 Dashboard Structure

```
PRODUCT DASHBOARD (Weekly Review)
├── Revenue
│   ├── MRR (current + trend)
│   ├── New MRR (new customers)
│   ├── Churn MRR (lost customers)
│   ├── Expansion MRR (upgrades)
│   └── ARPU
│
├── Engagement
│   ├── DAU / MAU
│   ├── Queries per user/day
│   ├── Activation rate
│   └── D7 / D30 retention
│
├── Quality
│   ├── Query success rate
│   ├── Avg confidence
│   ├── Avg latency (p50, p95)
│   ├── Avg cost per query
│   └── Error rate
│
├── Infrastructure
│   ├── API uptime
│   ├── Page load time
│   └── Error budget remaining
│
└── Growth
    ├── New sign-ups (daily)
    ├── Free → Paid conversion
    ├── Active documents total
    └── GitHub stars
```

### 4.2 Reporting Cadence

| Frequency | Audience | Content |
|-----------|----------|---------|
| **Daily** | Engineering | Infrastructure metrics, error rate, latency, uptime |
| **Weekly** | Product team | Engagement, activation, retention, revenue, top issues |
| **Monthly** | All hands | MRR, growth, NPS, strategic KPIs, wins/challenges |
| **Quarterly** | Board / investors | OKR progress, ARR, unit economics, market traction |

### 4.3 Tools

| Tool | Purpose |
|------|---------|
| **PostHog** | Product analytics (events, funnels, retention, heatmaps) |
| **Stripe** | Revenue metrics (MRR, churn, ARPU, LTV) |
| **Grafana** | Infrastructure metrics (uptime, latency, error rate) |
| **Sentry** | Error tracking and crash reporting |
| **Plausible** | Website analytics (landing page, docs) |
| **Notion / Coda** | OKR tracking, weekly reviews, board reports |

---

## 5. Leading vs Lagging Indicators

| Stage | Leading Indicators (Predictive) | Lagging Indicators (Outcome) |
|-------|-------------------------------|------------------------------|
| **Discovery** | Website traffic growth, GitHub star rate, SEO keyword rankings | Sign-ups, demo requests |
| **Activation** | Upload completion rate, first query time, onboarding step completion | Activation rate, D1 retention |
| **Adoption** | DAU/MAU, queries/user/day, documents/user | D7/D30 retention, paid conversion |
| **Revenue** | Free → paid conversion rate, upgrade trigger events | MRR, ARPU, LTV |
| **Retention** | Feature usage depth, team invites sent, API integration | Churn rate, NPS, logo retention |
| **Advocacy** | Referral link clicks, social mentions, GitHub contributions | NPS promoters, case study participation |

---

## 6. OKR Health Check Criteria

| Signal | Green (On Track) | Yellow (At Risk) | Red (Off Track) |
|--------|-----------------|------------------|-----------------|
| MRR growth | >15% month-over-month | 5–15% month-over-month | <5% |
| Activation rate | >50% | 30–50% | <30% |
| D7 retention | >40% | 25–40% | <25% |
| Query success rate | >97% | 95–97% | <95% |
| API uptime | >99.9% | 99.5–99.9% | <99.5% |
| Free → Paid conversion | >8% | 5–8% | <5% |
| Monthly churn (paid) | <3% | 3–5% | >5% |
| NPS | >50 | 30–50 | <30 |

---

## 7. Experiment Framework

Every metric below target triggers an experiment:

| Metric | Below Target | Suggested Experiment |
|--------|-------------|---------------------|
| Activation rate | <40% | A/B test onboarding flow: sample doc vs upload-first |
| D7 retention | <30% | Email sequence: tips, sample queries, feature highlights |
| Free → Paid | <5% | Test lower Developer price ($19/mo) or annual-only discount |
| Query success rate | <95% | Investigate classifier calibration, fallback accuracy |
| Avg latency | >3s | Profile bottlenecks: classification, retrieval, generation |

---

## 8. Annual Revenue Model (Detailed)

### Year 1 Monthly Progression

| Month | Free Users | Developer | Team | Enterprise | MRR |
|-------|-----------|-----------|------|------------|-----|
| 1 | 200 | 5 | 0 | 0 | $145 |
| 2 | 350 | 12 | 2 | 0 | $746 |
| 3 | 500 | 25 | 5 | 1 | $1,720 |
| 4 | 700 | 40 | 8 | 2 | $2,896 |
| 5 | 900 | 55 | 12 | 3 | $4,015 |
| 6 | 1,200 | 75 | 16 | 4 | $5,359 |
| 7 | 1,500 | 100 | 20 | 5 | $6,800 |
| 8 | 1,800 | 130 | 25 | 6 | $8,460 |
| 9 | 2,100 | 160 | 30 | 7 | $10,120 |
| 10 | 2,500 | 200 | 38 | 8 | $12,620 |
| 11 | 3,000 | 250 | 48 | 10 | $16,150 |
| 12 | 5,000 | 300 | 60 | 12 | $20,100 |

**Conservative estimate**. Assumes 5% monthly free tier growth, 3% free → Developer conversion, 10% Developer → Team, 1 Enterprise per month from Month 3.

### Revenue Composition (Year 1, Month 12)

| Tier | Users | Monthly Revenue | % of Revenue |
|------|-------|----------------|--------------|
| Free | 5,000 | $0 | 0% |
| Developer | 300 | $8,700 | 43% |
| Team | 60 | $11,940 | 59% |
| Enterprise | 12 | -$540 (loss leader) | -3% (infra cost) |
| **Total** | **5,372** | **$20,100** | **100%** |

**Note**: Enterprise infra costs ($500/mo avg) exceed initial Enterprise revenue. This is intentional — enterprise is a long-term play. By Month 18, enterprise ACV should cover costs with healthy margin.

---

## 8. Key Risks to Metrics

| Risk | Affected Metric | Mitigation |
|------|----------------|------------|
| LLM API price increase | Gross margin, cost/query | Multi-model routing, negotiate volume discounts, cache aggressively |
| Competitor launches free tier | Free → Paid conversion, sign-up rate | Double down on differentiation (adaptive, open source, observability) |
| ChromaDB performance degrades | Latency, query success rate | Early migration to Pinecone if needed, optimize chunking |
| Auth0 pricing increase | Infrastructure cost | Evaluate Clerk, Supabase Auth, or self-hosted alternatives |
| Low organic traffic | Sign-up rate, MAU | SEO investment, content marketing, community building |
| Enterprise sales cycle too long | MRR growth, cash flow | Don't depend on enterprise for survival — build with self-serve first |

---

> *End of Success Metrics*  
> *Brand: Orange Leaf Logo — LOCKED*  
> *Phase 12 — Complete. Ready for implementation.*
