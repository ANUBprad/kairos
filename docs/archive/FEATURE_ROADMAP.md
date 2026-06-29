# Kairos — Feature Roadmap

> **Document**: Product Feature Roadmap — MVP through V3  
> **Product**: Kairos — Adaptive Knowledge Intelligence  
> **Status**: LOCKED — Phase 12  
> **Author**: Product Founder / Startup CTO

---

## 1. Roadmap Philosophy

| Principle | Rationale |
|-----------|-----------|
| **Ship the core value first** | MVP is one thing done well: upload a document, ask a question, get a great answer. Everything else is secondary. |
| **Usage before features** | Don't build features until you have users requesting them. Data from MVP behavior drives V1 priorities. |
| **Pay-as-you-grow architecture** | Every feature is designed for the Free tier first, then gated or expanded for paid tiers. |
| **Enterprise blocks V3** | SSO, audit, RBAC, self-host are not needed for product-market fit. They unlock enterprise revenue later. |
| **API is a product** | The API is not an afterthought. It ships in MVP and is expanded in every version. |

---

## 2. Release Cadence

| Version | Timeline | Theme | Team Size |
|---------|----------|-------|-----------|
| **MVP** | Week 1–6 | Core loop: upload → query → answer → analytics | 2 engineers + part-time PM |
| **V1** | Month 3 | Collaboration + organization + integrations | 3 engineers + 1 PM |
| **V2** | Month 5–6 | Enterprise foundations + advanced intelligence | 4 engineers + 1 PM + 1 designer |
| **V3** | Month 8–9 | Scale + ecosystem + platform | 5 engineers + 1 PM + 1 designer |

---

## 3. MVP (Week 1–6) — "Core Loop"

**Goal**: A user can sign up, upload a document, ask a question, receive an adaptive answer with full transparency, and see basic analytics.

### Authentication & Workspaces
- [x] GitHub OAuth sign-up / login
- [x] Google OAuth sign-up / login
- [x] Email/password sign-up / login
- [x] Automatic workspace creation on sign-up
- [x] Session management (JWT, HTTP-only cookies)
- [x] API key generation + management

### Document Management
- [x] Upload PDF, TXT, Markdown files
- [x] Drag-and-drop upload interface
- [x] Document processing status (pending → processing → ready → failed)
- [x] Document list (table view, searchable)
- [x] Document deletion
- [x] File size limit: 25MB per document

### Query Engine
- [x] Natural language question input
- [x] Adaptive retrieval (auto-strategy selection)
- [x] Answer with cited sources
- [x] Strategy badge display (Simple / Complex / Multi-Hop)
- [x] Confidence score display
- [x] Latency and cost per query
- [x] Fallback gracefully on errors
- [x] Suggested questions (on idle state)

### Analytics
- [x] Dashboard with KPI cards (queries today, docs indexed, avg confidence, avg latency)
- [x] Queries over time chart (last 7 days)
- [x] Strategy breakdown (pie/donut chart)
- [x] Recent activity feed (last 10 queries)

### Billing (MVP-Lite)
- [x] Free tier enforced (100 docs, 1K queries/month)
- [x] Stripe subscription checkout (Developer and Team plans)
- [x] Plan upgrade/downgrade from Settings
- [x] Usage limits enforced in API gateway

### Developer Experience
- [x] Python SDK with auth support
- [x] API documentation (quickstart + reference)
- [x] Landing page with product messaging
- [x] Pricing page
- [x] 404 / error pages

### Platform
- [x] User management (CRUD)
- [x] Usage metering (per-query, per-document)
- [x] Rate limiting (per API key)
- [x] Monitoring (Grafana, Sentry, Better Uptime)
- [x] CI/CD pipeline (test → build → deploy)

**Explicitly excluded from MVP**: Collections, team invitations, conversation history, feedback system, document preview, advanced analytics, webhooks, SSO, RBAC, self-hosted.

---

## 4. V1 (Month 3) — "Collaboration & Organization"

**Goal**: Users can organize documents, collaborate with teams, and get more value from the platform.

### Authentication & Workspaces
- [ ] Team invitations (email-based)
- [ ] Workspace member management (add/remove/role)
- [ ] Multiple workspaces per user
- [ ] Workspace switching

### Document Management
- [ ] Collections (tag-based document grouping)
- [ ] Multi-document upload (batch)
- [ ] Document preview (PDF viewer in browser)
- [ ] URL/document link ingestion
- [ ] HTML upload support
- [ ] Bulk document operations (delete, move, tag)

### Query Engine
- [ ] Conversation history (per-session thread)
- [ ] Follow-up questions within thread
- [ ] Query history sidebar (searchable)
- [ ] Feedback thumbs up/down per answer
- [ ] Manual strategy override (user selects strategy)
- [ ] Document-level query scoping ("search only in these docs")

### Analytics
- [ ] Advanced analytics page
- [ ] Latency trends (p50, p95, p99 charts)
- [ ] Cost analysis (stacked bar by strategy, model)
- [ ] Custom date range picker
- [ ] Export analytics to CSV
- [ ] Strategy performance comparison

### Billing
- [ ] Usage-based billing alerts
- [ ] Invoice history in Settings
- [ ] Payment method management (Stripe customer portal)
- [ ] Plan change confirmation + proration

### Developer Experience
- [ ] JavaScript / TypeScript SDK
- [ ] OpenAI-compatible API endpoint (drop-in replacement)
- [ ] Webhook system (query.completed, document.ready, usage.threshold)
- [ ] Status page (Better Uptime public)
- [ ] Changelog page

### Platform
- [ ] Redis query caching (reduce latency, cost)
- [ ] Async document ingestion pipeline (queued processing)
- [ ] Email notifications (welcome, usage alerts, invoice)
- [ ] Rate limit increase for paid plans

---

## 5. V2 (Month 5–6) — "Enterprise Foundations"

**Goal**: Kairos is enterprise-ready: secure, scalable, self-hostable, and compliant.

### Authentication & Workspaces
- [ ] SSO / SAML authentication
- [ ] Role-based access control (admin, member, viewer)
- [ ] Audit logging (all user actions logged)
- [ ] Custom branding / white-label option

### Document Management
- [ ] Audio/video transcription + indexing
- [ ] Image OCR + text extraction
- [ ] 100MB+ document support
- [ ] Automated document sync (Confluence, Notion, Google Drive connectors)
- [ ] Document version history

### Query Engine
- [ ] Custom strategy configuration (weights, thresholds, fallback behavior)
- [ ] Custom re-ranking model integration
- [ ] Batch query API (multiple questions, one call)
- [ ] A/B query testing (compare strategies side-by-side)
- [ ] Query explanations ("why this answer?" modal)

### Analytics
- [ ] Custom analytics dashboard builder
- [ ] Scheduled report generation (daily/weekly PDF)
- [ ] API-level analytics access (programmatic)
- [ ] Anomaly detection (unexpected query patterns)

### Billing
- [ ] Enterprise tier (custom pricing, dedicated support)
- [ ] Self-hosted deployment option (Docker Compose + Helm chart)
- [ ] Usage commitment discounts (annual contracts)
- [ ] Custom SLA (99.95%+)

### Developer Experience
- [ ] REST API v2 (enhanced with all V2 features)
- [ ] Terraform provider (infrastructure-as-code integration)
- [ ] CLI tool (kairosctl)
- [ ] Postman collection
- [ ] Integration marketplace (community-contributed connectors)

### Platform
- [ ] ChromaDB → Pinecone migration (for scale)
- [ ] Read replicas for PostgreSQL (analytics queries)
- [ ] Multi-region deployment (EU, US, APAC)
- [ ] Data export / GDPR compliance tools
- [ ] Penetration testing + SOC 2 Type II audit

---

## 6. V3 (Month 8–9) — "Platform & Ecosystem"

**Goal**: Kairos is a platform with an ecosystem of integrations, custom pipelines, and advanced intelligence capabilities.

### Authentication & Workspaces
- [ ] SCIM provisioning (Okta, Azure AD)
- [ ] Just-in-time (JIT) user provisioning
- [ ] Cross-workspace search (for multi-tenant organizations)

### Document Management
- [ ] Real-time collaborative document editing (built-in editor)
- [ ] Document publishing workflow (draft → review → published)
- [ ] Automated document classification + tagging
- [ ] Knowledge graph visualization (entity relationships)

### Query Engine
- [ ] LLM Judge Framework (automated answer quality evaluation)
- [ ] Active learning (feedback-driven strategy improvement)
- [ ] Multi-modal query support (image → text, audio → text)
- [ ] Agentic retrieval (autonomous multi-step research)
- [ ] Custom retrieval pipeline builder (visual drag-and-drop)

### Analytics
- [ ] ML-powered usage insights (churn prediction, growth opportunities)
- [ ] ROI calculator (cost savings dashboard)
- [ ] Competitor benchmark comparison (anonymous aggregate data)
- [ ] Custom metric definitions

### Billing
- [ ] Usage pool plans (team shares query pool)
- [ ] Add-on marketplace (premium connectors, advanced models)
- [ ] Reseller / OEM licensing
- [ ] Revenue share for marketplace contributions

### Developer Experience
- [ ] Plugin SDK (build custom retrievers, strategies, connectors)
- [ ] gRPC API (direct integration for high-performance use cases)
- [ ] Integration with major platforms (Salesforce, Zendesk, Intercom)
- [ ] Community forum + knowledge base
- [ ] Certified integration partner program

### Platform
- [ ] Global edge deployment (multi-region active-active)
- [ ] Custom ML model hosting (bring your own fine-tuned model)
- [ ] Data isolation clusters (dedicated infrastructure per customer)
- [ ] 99.99% SLA with multi-region failover

---

## 7. Feature by Version Summary

| Feature | MVP | V1 | V2 | V3 |
|---------|:---:|:--:|:--:|:--:|
| User auth (OAuth) | ✅ | ✅ | ✅ | ✅ |
| Workspace creation | ✅ | ✅ | ✅ | ✅ |
| Document upload (PDF, TXT, MD) | ✅ | ✅ | ✅ | ✅ |
| Adaptive query engine | ✅ | ✅ | ✅ | ✅ |
| Answer with sources + strategy | ✅ | ✅ | ✅ | ✅ |
| Basic analytics (KPI cards, charts) | ✅ | ✅ | ✅ | ✅ |
| API key management | ✅ | ✅ | ✅ | ✅ |
| Python SDK | ✅ | ✅ | ✅ | ✅ |
| API reference docs | ✅ | ✅ | ✅ | ✅ |
| Landing page + pricing | ✅ | ✅ | ✅ | ✅ |
| Free tier enforcement | ✅ | ✅ | ✅ | ✅ |
| Stripe billing (Developer, Team) | ✅ | ✅ | ✅ | ✅ |
| Usage metering | ✅ | ✅ | ✅ | ✅ |
| Rate limiting | ✅ | ✅ | ✅ | ✅ |
| Monitoring + alerts | ✅ | ✅ | ✅ | ✅ |
| Team invitations | — | ✅ | ✅ | ✅ |
| Collections | — | ✅ | ✅ | ✅ |
| Conversation history | — | ✅ | ✅ | ✅ |
| Feedback system | — | ✅ | ✅ | ✅ |
| Document preview (PDF) | — | ✅ | ✅ | ✅ |
| Advanced analytics | — | ✅ | ✅ | ✅ |
| JavaScript SDK | — | ✅ | ✅ | ✅ |
| OpenAI-compatible API | — | ✅ | ✅ | ✅ |
| Webhooks | — | ✅ | ✅ | ✅ |
| Redis caching | — | ✅ | ✅ | ✅ |
| URL ingestion | — | ✅ | ✅ | ✅ |
| Manual strategy override | — | ✅ | ✅ | ✅ |
| SSO / SAML | — | — | ✅ | ✅ |
| RBAC | — | — | ✅ | ✅ |
| Audit logging | — | — | ✅ | ✅ |
| Self-hosted option | — | — | ✅ | ✅ |
| Custom branding | — | — | ✅ | ✅ |
| Audio/video transcription | — | — | ✅ | ✅ |
| Connectors (Confluence, Notion, GDrive) | — | — | ✅ | ✅ |
| Custom strategy config | — | — | ✅ | ✅ |
| Batch query API | — | — | ✅ | ✅ |
| Enterprise tier + custom SLA | — | — | ✅ | ✅ |
| SOC 2 audit | — | — | ✅ | ✅ |
| Multi-region deployment | — | — | ✅ | ✅ |
| LLM Judge Framework | — | — | — | ✅ |
| Active learning | — | — | — | ✅ |
| Multi-modal queries | — | — | — | ✅ |
| Agentic retrieval | — | — | — | ✅ |
| Custom pipeline builder | — | — | — | ✅ |
| Plugin SDK | — | — | — | ✅ |
| Integration marketplace | — | — | — | ✅ |
| Global edge deployment | — | — | — | ✅ |
| Dedicated clusters | — | — | — | ✅ |
| 99.99% SLA | — | — | — | ✅ |

---

## 8. What Will NOT Be Built (Next 12 Months)

| Feature | Rationale |
|---------|-----------|
| Native mobile app | Web-based responsive PWA is sufficient. Mobile app development is expensive and low-ROI for an API-first product. |
| On-premise appliance | Self-hosted Docker Compose + Helm is the right model. Physical appliances are a legacy approach. |
| Custom LLM fine-tuning | Fine-tuning is a separate problem space. Kairos optimizes retrieval, not generation. |
| Video analysis | Audio transcription yes. Video analysis is a different product. |
| Real-time collaboration (Google Docs-style) | Expensive to build. Chat-style collaboration (threads, comments) is sufficient. |
| No-code chatbot builder | Too far from core value. API + integrations serve this need. |
| Data labeling / annotation platform | Not our market. Users can use Label Studio, Prodigy, etc. |
| General-purpose LLM chat | Kairos is a knowledge retrieval product, not a ChatGPT competitor. |

---

> *End of Feature Roadmap*  
> *Next: User Journey → docs/USER_JOURNEY.md*  
> *Brand: Orange Leaf Logo — LOCKED*
