# MVP Specification

**Phase 15 — Product Definition & UX Blueprint**  
**Status:** Final

---

## MVP Scope

The MVP targets **AI Engineering Leads at B2B SaaS companies** who need to reduce LLM costs and improve retrieval quality without weeks of manual tuning.

### MoSCoW Prioritization

| Priority | Count | Description |
|----------|-------|-------------|
| Must Have | 12 | Core platform; without these, the product has no value |
| Should Have | 8 | Important for retention; add within 3 months of launch |
| Could Have | 6 | Desirable but not blocking; evaluate post-launch |
| Won't Have | 5 | Explicitly out of scope for v1 |

---

## Must Have

### 1. Query API

**Description:** POST `/api/v1/query` — accept query text, return adaptive answer with citations

**Acceptance Criteria:**
- Accepts query text, project ID, optional strategy override
- Returns answer, confidence score, strategy used, latency, cost
- Returns source chunks with relevance scores
- Supports streaming (SSE)
- < 1s P50 latency for simple queries

**Priority:** P0 — without this, there is no product

### 2. Document Ingestion

**Description:** Upload documents (PDF, TXT, MD) — chunk, embed, store

**Acceptance Criteria:**
- Accepts PDF, TXT, MD files up to 50MB
- Returns job ID for async processing
- Webhook or polling for completion
- Automatic chunking with configurable size/overlap
- Stores in ChromaDB (or configured vector store)

**Priority:** P0 — without documents, there's nothing to retrieve from

### 3. API Key Authentication

**Description:** Generate and revoke API keys for programmatic access

**Acceptance Criteria:**
- Web UI to create/revoke keys
- Keys prefixed with `kai_sk_` for identification
- Keys scoped to projects
- Key hashing at rest (SHA-256)
- Rate limiting per key

**Priority:** P0 — platform security

### 4. User Authentication

**Description:** Email + Google OAuth login

**Acceptance Criteria:**
- Sign up with email/password or Google
- Email verification
- Password reset flow
- Session management
- NextAuth.js v5

**Priority:** P0 — without users, there is no SaaS

### 5. Project Management

**Description:** Users create projects to organize documents and queries

**Acceptance Criteria:**
- CRUD projects
- Each project has separate document store
- API keys scoped to projects
- Usage tracked per project

**Priority:** P0 — organizational foundation

### 6. Usage Tracking

**Description:** Track every API call for billing and monitoring

**Acceptance Criteria:**
- Every query/ingestion recorded
- Count toward monthly quota
- Real-time usage display in dashboard
- Usage alerts at 80%/100% of quota

**Priority:** P0 — without usage tracking, no billing

### 7. Free Tier

**Description:** 1,000 queries/month, 1 project, community support

**Acceptance Criteria:**
- Self-serve signup, no credit card required
- 1,000 query/month hard limit
- 1 project limit
- Rate limited at 10 req/s

**Priority:** P0 — acquisition channel

### 8. Basic Dashboard

**Description:** Web dashboard showing usage, recent queries, API keys

**Acceptance Criteria:**
- Login with SSO/email
- Usage overview (queries today, this month, vs quota)
- Recent queries list with results
- API key management UI
- Project settings

**Priority:** P0 — user must be able to self-serve

### 9. Quickstart Documentation

**Description:** Get a user from signup to first query in under 5 minutes

**Acceptance Criteria:**
- Quickstart guide with curl/Python examples
- API reference
- Project creation → ingest → query flow documented
- Working code examples

**Priority:** P0 — onboarding is critical

### 10. Rate Limiting

**Description:** Protect the platform from abuse

**Acceptance Criteria:**
- Per-key rate limiting
- Per-IP rate limiting for unauthenticated endpoints
- Proper error responses (429) with retry headers
- Configurable limits per tier

**Priority:** P0 — platform stability

### 11. Analytics Overview

**Description:** Dashboard page showing key usage metrics

**Acceptance Criteria:**
- Query volume over time (7d, 30d)
- Strategy distribution pie chart
- Avg latency, avg confidence, avg cost
- Simple, clean, actionable

**Priority:** P0 — users need to see value

### 12. Landing Page

**Description:** Marketing site explaining what Kairos does and why it matters

**Acceptance Criteria:**
- Hero with value prop
- How it works (3 steps)
- Pricing table
- CTA to sign up
- Blog/docs section

**Priority:** P0 — acquisition channel

---

## Should Have

### 1. Strategy Visualization

**Description:** Show users how Kairos classified and routed their query

**Acceptance Criteria:**
- Animated flow diagram per query
- Shows: query → classify → plan → retrieve → answer
- Labels for strategy, confidence, latency, cost

**Priority:** P1 — key differentiator, justifies premium pricing

### 2. Pro Tier ($199/mo)

**Description:** 500,000 queries, unlimited projects, priority support

**Acceptance Criteria:**
- Self-serve upgrade
- Usage-based billing at tier limits
- Priority support channel

**Priority:** P1 — revenue driver

### 3. Billing Integration

**Description:** Stripe-based plan management

**Acceptance Criteria:**
- Credit card collection via Stripe
- Automatic plan upgrades/downgrades
- Invoice generation
- Payment method management

**Priority:** P1 — required for monetization

### 4. Detailed Analytics

**Description:** Per-query breakdown with strategy comparison

**Acceptance Criteria:**
- Query history with full details
- Strategy comparison view
- Cost analysis per project
- Export to CSV

**Priority:** P1 — power user feature

### 5. Developer Tier ($49/mo)

**Description:** 50,000 queries, 10 projects, email support

**Acceptance Criteria:**
- Self-serve upgrade path
- Usage-based billing

**Priority:** P1 — mid-market revenue

### 6. Documentation Site

**Description:** Full documentation with sidebar nav, search, code examples

**Acceptance Criteria:**
- Quickstart, API reference, SDK docs
- Search (Fuse.js or Algolia)
- Working code snippets in multiple languages
- Dark mode

**Priority:** P1 — developer adoption

### 7. Blog

**Description:** Technical blog for SEO and community building

**Acceptance Criteria:**
- MDX-based
- Engineering deep-dives
- Product announcements
- RSS feed

**Priority:** P1 — growth channel

### 8. Passwordless Login (Magic Link)

**Description:** Email-based magic link authentication

**Acceptance Criteria:**
- Enter email → receive link → click to login
- Works alongside email/password and OAuth

**Priority:** P1 — UX improvement

---

## Could Have

### 1. GitHub OAuth

**Description:** Login with GitHub

**Acceptance Criteria:**
- OAuth flow
- Avatar and name from GitHub

**Priority:** P2 — developer preference

### 2. Document Management UI

**Description:** Browse, search, and delete uploaded documents

**Acceptance Criteria:**
- List documents in project
- Search within documents
- Delete documents
- Document metadata display

**Priority:** P2 — convenience feature

### 3. Dark Mode

**Description:** System-preference-based theme switching

**Acceptance Criteria:**
- Respects prefers-color-scheme
- Manual toggle in settings
- Persists preference

**Priority:** P2 — polish

### 4. Webhook Notifications

**Description:** Webhooks for ingestion completion, usage alerts

**Acceptance Criteria:**
- Configurable webhook URLs
- Ingestion complete event
- Usage threshold event
- Retry with backoff

**Priority:** P2 — integration feature

### 5. Team Accounts

**Description:** Multiple users per project with roles

**Acceptance Criteria:**
- Invite team members by email
- Roles: Admin, Member, Viewer
- Shared project access

**Priority:** P2 — enterprise need, not MVP

### 6. API Playground

**Description:** In-browser API testing tool

**Acceptance Criteria:**
- OpenAPI-based interactive docs
- Execute queries from browser
- See request/response

**Priority:** P2 — developer experience

---

## Won't Have (v1)

| Feature | Reason |
|---------|--------|
| Self-hosted on-premise deployment | Complexity too high for MVP; evaluate post-v1 based on enterprise demand |
| SSO/SAML integration | Small percentage of customers need it at MVP; add for Enterprise tier |
| Custom strategy configuration | Power feature; MVP users get automatic optimization |
| Multi-region/ data residency | Infrastructure complexity; add for Enterprise |
| Mobile app | Not relevant for developer-targeted API platform |

---

## Feature Prioritization Summary

```
                    High Value
                         ↑
                 ┌───────┼───────┐
                 │Must   │ Should│
                 │Have   │ Have  │
                 │Query  │Strat  │
                 │Ingest │ Viz   │
                 │Auth   │Pro    │
                 │Projs  │Billing│
                 │Free   │Analyt │
                 │Rate   │Dev    │
                 │Dsah   │       │
                 │       │       │
    Low Effort ◄─┼───────┼───────┼──► High Effort
                 │       │       │
                 │Could  │Won't  │
                 │Have   │Have   │
                 │GitHub │On-prem│
                 │Docs UI│SSO    │
                 │Teams  │Mobile │
                 │Playgr │Custom │
                 └───────┼───────┘
                         │
                         ↓
                    Low Value
```

---

## Release Criteria

The MVP is release-ready when:

1. A new user can sign up and execute their first query in under 5 minutes
2. The free tier enforces quotas correctly
3. API responds within 1s P50 for simple queries
4. At least 100 beta users have been onboarded and validated the flow
5. Uptime is 99.5%+ over a 7-day trial period
6. Stripe billing is functional for self-serve upgrades
7. There are no known P0 or P1 bugs
