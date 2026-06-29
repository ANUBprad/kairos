# Kairos — Monetization Strategy

> **Document**: Pricing, Packaging & Monetization Strategy  
> **Product**: Kairos — Adaptive Knowledge Intelligence  
> **Status**: LOCKED — Phase 12  
> **Author**: Product Founder / VC Advisor

---

## 1. Monetization Philosophy

| Principle | Rationale |
|-----------|-----------|
| **Usage-based + seat-based hybrid** | Usage correlates to value delivered. Seats correlate to team size. Hybrid captures both dimensions. |
| **Free tier as a growth engine** | The free tier is a marketing channel, not a revenue center. It exists to maximize activation and word-of-mouth. |
| **Generous limits, painful gates** | Free tier is genuinely useful (100 docs, 1K queries) but hits limits at the point where users are already hooked. |
| **Enterprise sells itself** | No outbound sales for MVP. Enterprise pricing is custom, driven by inbound demand. |
| **Transparent pricing** | No hidden fees, no "contact us" for mid-tier pricing. Enterprise is the only custom tier. |
| **Annual discount** | 20% discount for annual billing across all paid tiers. Improves retention and upfront cash. |

---

## 2. Pricing Tiers

### 2.1 Free — $0/month

**Target**: Indie developers, evaluators, students, open-source contributors

| Resource | Limit |
|----------|-------|
| Documents | 100 total |
| Queries | 1,000/month |
| Users | 1 (solo) |
| Strategies | Auto only |
| Analytics | Basic (dashboard KPI cards only) |
| API Access | Yes (1 API key, rate-limited) |
| Support | Community (Discord, GitHub Issues) |
| File size | 10MB per document |
| Retention | 30-day query history |

**Psychology**: No credit card required. Sign up in 10 seconds with GitHub OAuth. Useful enough to build a small project. Generous enough to create habit. Painful enough to upgrade when you outgrow it.

**Unit economics**: ~$0.50/mo infrastructure cost per active free user. At 10,000 free users = $5K/mo cost. This is the marketing budget.

### 2.2 Developer — $29/month (or $23/month annual)

**Target**: Solo developers, indie founders, small teams of 2–5

| Resource | Limit |
|----------|-------|
| Documents | 1,000 total |
| Queries | 10,000/month |
| Users | 5 |
| Strategies | Auto + Manual override |
| Analytics | Advanced (charts, trends, export) |
| API Access | Yes (5 API keys, 2x rate limit) |
| Support | Email (48-hour response) |
| File size | 25MB per document |
| Retention | 90-day query history |

**Psychology**: "Only $29/month for 10x the capacity." It feels like a great deal compared to free. The manual strategy override is a power-user feature that creates switching cost (users learn to tune strategies and won't want to lose that).

**Unit economics**: ~$2/mo infrastructure cost. 93% gross margin. LTV at 12-month retention: $348.

### 2.3 Team — $199/month (or $159/month annual)

**Target**: Startups, SMBs, growing teams of 5–25

| Resource | Limit |
|----------|-------|
| Documents | 10,000 total |
| Queries | 100,000/month |
| Users | 25 |
| Strategies | Full control (custom config) |
| Analytics | Full + Custom dashboards |
| API Access | Yes (25 API keys, 5x rate limit) |
| Support | Slack priority (4-hour response) |
| File size | 50MB per document |
| Retention | 1-year query history |

**Psychology**: "10x queries for ~7x the Developer price." Deliberately priced to feel like a bargain for teams. Slack support creates a direct relationship — users feel taken care of. Full strategy control appeals to engineering teams who want to tune the system.

**Unit economics**: ~$15/mo infrastructure cost. 92% gross margin. LTV at 18-month retention: $3,582.

### 2.4 Enterprise — Custom Pricing

**Target**: Mid-market and enterprise organizations (200–5,000+ employees)

| Resource | Limit |
|----------|-------|
| Documents | Unlimited |
| Queries | Custom (typically 500K–10M/month) |
| Users | Unlimited |
| Strategies | Full control + custom development |
| Analytics | Custom dashboards + API access |
| API Access | Unlimited keys, custom rate limits |
| Support | Dedicated account manager + engineering |
| SLA | 99.95%–99.99% |
| Self-hosted | Available (Docker + Helm chart) |
| SSO/SAML | Included |
| Audit logs | Included |
| Custom branding | Available |

**Psychology**: Pricing is based on annual contract value (ACV). Typical range: $12K–$120K/year. Enterprise is not just a bigger Team plan — it's a different product with self-hosting, compliance, and dedicated support.

---

## 3. Pricing Comparison Table

| | Free | Developer | Team | Enterprise |
|---|:----:|:---------:|:----:|:----------:|
| **Price (monthly)** | $0 | $29 | $199 | Custom |
| **Price (annual)** | $0 | $23/mo | $159/mo | Custom |
| **Documents** | 100 | 1,000 | 10,000 | Unlimited |
| **Queries/mo** | 1,000 | 10,000 | 100,000 | Custom |
| **Users** | 1 | 5 | 25 | Unlimited |
| **Strategy control** | Auto only | Auto + Manual | Full config | Full + custom |
| **Analytics** | Basic | Advanced | Full + Custom | Custom + API |
| **API keys** | 1 | 5 | 25 | Unlimited |
| **Rate limit** | 10/min | 60/min | 300/min | Custom |
| **File size** | 10MB | 25MB | 50MB | 100MB+ |
| **History retention** | 30 days | 90 days | 1 year | 3 years |
| **Support** | Community | Email (48h) | Slack (4h) | Dedicated |
| **Self-hosted** | ❌ | ❌ | ❌ | ✅ |
| **SSO/SAML** | ❌ | ❌ | ❌ | ✅ |
| **Audit logs** | ❌ | ❌ | ❌ | ✅ |
| **SLA** | None | 99.5% | 99.9% | 99.99% |

---

## 4. Revenue Model

### 4.1 Revenue Mix (Year 1 Target)

| Tier | % of Users | % of Revenue | Avg Revenue/User/Month |
|------|-----------|-------------|----------------------|
| Free | 85% | 0% | $0 |
| Developer | 10% | 10% | $29 |
| Team | 4% | 28% | $199 |
| Enterprise | 1% | 62% | $3,500 (avg ACV: $42K/yr) |

**Year 1 Target MRR**: $42,000
- 500 free users
- 60 Developer users → $1,740/mo
- 24 Team users → $4,776/mo
- 6 Enterprise customers → $21,000/mo (avg $3,500/mo each)
- **Total: ~$27,500/mo** (conservative)
- **Total: ~$42,000/mo** (target)

### 4.2 Growth Model (3-Year Projection)

| Year | Free Users | Developer | Team | Enterprise | MRR | ARR |
|------|-----------|-----------|------|------------|-----|-----|
| Y1 | 500 | 60 | 24 | 6 | $27.5K | $330K |
| Y2 | 2,000 | 250 | 100 | 20 | $130K | $1.56M |
| Y3 | 5,000 | 800 | 300 | 50 | $425K | $5.1M |

**Assumptions**:
- Free → Developer conversion: 5–8%
- Developer → Team upgrade: 10–15%
- Enterprise deals close in 60–90 days
- Monthly churn: 5% Developer, 3% Team, 1% Enterprise
- Annual billing adoption: 30% of paid users

### 4.3 Unit Economics

| Metric | Developer | Team | Enterprise |
|--------|-----------|------|------------|
| Avg infrastructure cost/user/mo | $2 | $15 | $500 |
| Gross margin | 93% | 92% | 85%+ |
| CAC (paid acquisition) | $50 | $200 | $2,000 |
| Payback period | 2 months | 1 month | 6 months |
| Monthly churn (target) | 5% | 3% | 1% |
| Avg LTV (12 months) | $348 | $3,582 | $42,000+ |

---

## 5. Upgrade Triggers & Funnel

### 5.1 Free → Developer

| Trigger | Timing | Action |
|---------|--------|--------|
| Document limit (100) | When uploading 90th doc | Upgrade prompt in upload modal |
| Query limit (1,000/mo) | At 800 queries / 20 days | Banner: "You're on track to exceed your monthly limit" |
| Manual strategy access | When clicking strategy selector | "Upgrade to Developer to choose strategies" |
| Advanced analytics | When clicking locked chart | "Upgrade to unlock advanced analytics" |

### 5.2 Developer → Team

| Trigger | Timing | Action |
|---------|--------|--------|
| User limit (5) | When trying to add 6th user | "Upgrade to Team for unlimited members" |
| Document limit (1,000) | At 900 documents | Upgrade prompt |
| Query limit (10K/mo) | At 9,000 queries | Notification + upgrade prompt |
| Slack support desire | When filing support ticket | "Get faster support with Team plan" |

### 5.3 Team → Enterprise

| Trigger | Timing | Action |
|---------|--------|--------|
| SSO requirement | Customer asks about SSO | "Enterprise plan includes SSO/SAML" |
| Self-hosting need | Customer asks about on-prem | "Enterprise plan includes self-hosted deployment" |
| Compliance requirement | Customer mentions SOC 2, GDPR | "Enterprise plan has audit logs and compliance tools" |
| Scale beyond limits | >50 users or >1M queries | "Contact sales for Enterprise pricing" |

---

## 6. Pricing Experiments (V1+)

| Experiment | Hypothesis | Metric |
|------------|------------|--------|
| Usage overage vs hard cap | Overage billing ($0.01/query) increases revenue without blocking power users | Revenue per user, churn rate |
| Annual-only Enterprise | Enterprise customers prefer annual contracts; monthly adds overhead | Deal velocity, ACV |
| Team seat pooling | "5 shared seats" vs "5 individual seats" affects team upgrade rate | Team conversion rate |
| Query pack add-ons | "Buy 5,000 extra queries for $10" could monetize power free users | Free user revenue |
| Startup program | 6 months free Team for YC/seed-stage startups with logo | Free → paid conversion at 6 months |

---

## 7. Pricing FAQ (For Website)

| Question | Answer |
|----------|--------|
| Can I switch plans anytime? | Yes. Upgrades take effect immediately. Downgrades apply at next billing period. |
| What happens if I exceed my plan limits? | You'll receive a notification. Queries above the limit will fail until you upgrade or the period resets. |
| Is there a free trial for paid plans? | The Free tier is effectively a trial — no time limit, just usage limits. |
| Do you offer student/open-source discounts? | Yes — 50% off Developer plan for verified students and open-source maintainers. |
| Can I cancel anytime? | Yes. Your data is retained for 30 days after cancellation. |
| Do you have annual billing? | Yes — save 20% with annual billing on Developer and Team plans. |
| What payment methods do you accept? | Credit/debit cards via Stripe. Invoicing available for Enterprise annual contracts. |
| Is there a refund policy? | 14-day money-back guarantee for all paid plans. |

---

## 8. Cost Analysis (Internal)

### 8.1 Cost Per Query (by strategy)

| Strategy | Avg LLM Cost | Avg Embedding Cost | Total Cost/Query |
|----------|-------------|-------------------|-----------------|
| Simple (Hybrid Search) | $0.001 | $0.001 | $0.002 |
| Complex (Deep Semantic) | $0.006 | $0.004 | $0.010 |
| Multi-Hop Reasoning | $0.015 | $0.007 | $0.022 |

### 8.2 Cost Per User (by tier)

| Tier | Avg Queries/User/Mo | Avg Storage/User | Infra Cost/User/Mo |
|------|-------------------|-----------------|-------------------|
| Free | 50 | 50MB | $0.50 |
| Developer | 200 | 500MB | $2.00 |
| Team | 800 | 5GB | $15.00 |
| Enterprise | 5,000 | 50GB | $500.00 |

### 8.3 Margin by Tier (at target pricing)

| Tier | Revenue/User | Cost/User | Gross Margin |
|------|-------------|-----------|-------------|
| Free | $0 | $0.50 | -∞ (but this is marketing cost) |
| Developer | $29 | $2 | 93% |
| Team | $199 | $15 | 92% |
| Enterprise | $3,500 | $500 | 86% |

---

> *End of Monetization Strategy*  
> *Next: Competitor Analysis → docs/COMPETITOR_ANALYSIS.md*  
> *Brand: Orange Leaf Logo — LOCKED*
