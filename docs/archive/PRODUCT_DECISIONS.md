# Product Decisions

**Phase 15 — Product Definition & UX Blueprint**  
**Status:** Final  
**Version:** 1.0

---

## Purpose

This document records every significant product decision made during Phase 15, including alternatives considered and rationale. Future teams can reference this to understand why the product is designed the way it is.

---

## Decision 1: Product Positioning

**Decision:** Position Kairos as an "Adaptive Retrieval Intelligence Platform"

**Alternatives considered:**
1. AI Retrieval Intelligence Layer — rejected because it implies middleware dependency
2. Enterprise RAG Optimization Platform — rejected because "RAG" is implementation detail
3. AI Infrastructure Platform — rejected because too generic
4. Retrieval Decision Engine — rejected because unfamiliar term

**Rationale:** "Adaptive" is the core differentiator no competitor claims. "Retrieval" names the category clearly. "Intelligence" signals ML-driven optimization. "Platform" implies API and ecosystem.

---

## Decision 2: Primary Target Customer

**Decision:** AI Engineering Leads at B2B SaaS Companies (50-500 employees)

**Alternatives considered:**
1. Enterprise AI Platform Directors — rejected for MVP; longer sales cycle, higher support needs
2. AI Startup Founders — valid but lower willingness to pay; Free tier serves this segment
3. Individual Developers — valid but zero revenue potential

**Rationale:** B2B SaaS companies have budget ($500-5K/mo), technical sophistication to integrate via API, and measurable pain (LLM costs, inconsistent quality). They can self-serve through signup without sales involvement.

---

## Decision 3: Free Tier Generosity

**Decision:** 1,000 queries/month, 1 project, no credit card

**Alternatives considered:**
1. 100 queries/month — too restrictive for meaningful evaluation
2. 10,000 queries/month — too expensive to support at scale
3. Time-limited trial (14 days) — creates urgency but may feel pressured
4. No free tier — eliminates top-of-funnel

**Rationale:** 1,000 queries = ~33/day. Enough for a developer to integrate, test, validate, and demonstrate ROI in a week. 1 project limits complexity. No credit card reduces signup friction to zero.

---

## Decision 4: Monetization Model

**Decision:** Usage-based pricing (per query) with tiered monthly caps

**Alternatives considered:**
1. Per-seat pricing — doesn't align with API usage patterns
2. Flat monthly fee — hard to price without usage data
3. Token-based (like OpenAI) — complex, user-hostile
4. Self-serve + enterprise — standard SaaS model

**Rationale:** Usage-based aligns cost with value. Tiers provide predictability. Free → Developer → Pro provides natural upgrade path as users grow. Enterprise handles custom cases.

---

## Decision 5: API Key Prefix

**Decision:** `kai_sk_` prefix for API keys

**Alternatives considered:**
1. No prefix — harder to identify
2. `kr_` — less recognizable
3. `keiro_` — branding inconsistency (project is named Kairos)

**Rationale:** `kai_sk_` is recognizable as Kairos secret key. Follows Stripe's pattern (`sk_live_`, `sk_test_`). Easy to regex/search. Brand-consistent.

---

## Decision 6: Authentication Strategy

**Decision:** NextAuth.js v5 with Email/Password + Google OAuth for MVP; Magic Link + GitHub OAuth for v1

**Alternatives considered:**
1. Clerk — third-party dependency, higher cost, less control
2. Supabase Auth — tied to Supabase ecosystem
3. Firebase Auth — Google lock-in
4. Custom auth — security risk, maintenance burden

**Rationale:** NextAuth.js is open source, maintained, supports multiple providers, works with any database. Email + Google covers 90%+ of users at MVP. Extensible for future providers.

---

## Decision 7: Vector Store Strategy

**Decision:** ChromaDB as default (self-hosted); support Pinecone/Weaviate as optional backends

**Alternatives considered:**
1. Pinecone-only — vendor lock-in, cost, no self-host option
2. Weaviate-only — more complex to operate than ChromaDB
3. Multiple simultaneous — operational complexity too high for MVP

**Rationale:** ChromaDB is the simplest self-hosted option, matches current implementation, good for MVP scale. Provider-agnostic architecture allows users to bring their own vector store for production.

---

## Decision 8: LLM Strategy

**Decision:** Provider-agnostic — support Gemini, OpenAI, Groq, Ollama from day one

**Alternatives considered:**
1. OpenAI-only — simpler but dangerous lock-in
2. Self-hosted models only — limited quality
3. Single provider — against Kairos value proposition

**Rationale:** Provider agnosticism is a core competitive advantage. Users choose their LLM based on cost, quality, latency requirements. Kairos optimizes retrieval regardless of the LLM used.

---

## Decision 9: Streaming Support

**Decision:** SSE streaming for query responses in MVP

**Alternatives considered:**
1. WebSockets — over-engineered for request-response pattern
2. Polling — poor UX, higher latency
3. No streaming — acceptable for MVP but weakens product

**Rationale:** SSE is simpler than WebSockets, natively supported by HTTP, works with existing infrastructure. Streaming is expected by developers building real-time AI experiences.

---

## Decision 10: Dashboard Architecture

**Decision:** Next.js app router with client-side rendering for authenticated pages, SSR for marketing

**Alternatives considered:**
1. Separate React SPA (CRA/Vite) — no SSR for marketing, worse SEO
2. Pure SSR — slower dashboard navigation, more server load
3. Remix — less ecosystem maturity than Next.js

**Rationale:** Next.js hybrid approach gives best of both worlds: SSR/SSG for marketing (SEO), CSR for dashboard (fast navigation). One codebase, one deployment.

---

## Decision 11: Dashboard Not a Chatbot

**Decision:** The authenticated dashboard does NOT include a chat interface

**Alternatives considered:**
1. ChatGPT-style chat — would position Kairos as a chatbot
2. Query form with conversation history — blurs lines with chatbot

**Rationale:** Kairos is an API platform, not a chatbot. The dashboard is for managing usage, viewing analytics, and configuring projects — not for conversational interaction. A chat UI would confuse positioning and raise incorrect expectations. The query workspace is a developer tool for testing and debugging, not an end-user chat interface.

---

## Decision 12: Streamlit Dashboard Status

**Decision:** Move to `apps/internal-dashboard/`, mark as internal developer tool, never deploy publicly

**Alternatives considered:**
1. Delete entirely — loses internal tool for developers
2. Keep at root — misleads visitors about the product
3. Rebuild in Next.js — not worth the effort for internal tool

**Rationale:** The Streamlit dashboard has value as an internal development tool for team members to monitor system health, run benchmarks, and debug. It should NOT be the public face of Kairos.

---

## Decision 13: Open Source License

**Decision:** MIT License (unchanged)

**Alternatives considered:**
1. Apache 2.0 — more protective but compatible
2. AGPL — too restrictive, hurts adoption
3. BSL (source-available) — complex, unusual for infrastructure

**Rationale:** MIT maximizes adoption, contribution, and ecosystem growth. The SaaS product provides monetization. Open source drives awareness and trust.

---

## Decision 14: Landing Page Narrative

**Decision:** Curiosity → Understanding → Trust → Excitement → Confidence → Conversion

**Alternatives considered:**
1. Problem → Solution → Features → Pricing — too transactional
2. Brand → Product → Social Proof → CTA — too brand-heavy for technical audience
3. Feature list — no narrative, doesn't build conviction

**Rationale:** Technical buyers need to understand before they trust. The narrative arc moves from "what's wrong with current approaches" (curiosity) through "how Kairos solves it differently" (understanding) to "here's proof" (trust) to "imagine what you can build" (excitement) to "it's easy to start" (confidence) to signup (conversion).

---

## Decision 15: What NOT to Build (v1)

**Decision:** Explicitly exclude chat UI, model training, vector DB, no-code workflows, mobile app from v1

**Rationale:** Focus is critical at MVP. Every excluded feature is either (a) not our core competency, (b) better served by partners, or (c) premature for the target market. Building everything would dilute the product and delay launch.

---

## Decision 16: Pricing Psychology

**Decision:** Free tier prominently displayed; Pro recommended (not Enterprise)

**Alternatives considered:**
1. Enterprise-first — signal to enterprise buyers but scares SMB
2. Feature comparison table — overwhelming for time-pressed buyers
3. Annual-only pricing — too much commitment for evaluation

**Rationale:** Free tier drives top-of-funnel. Pro tier highlighted as "Most Popular" drives upgrade path. Enterprise is "Contact Sales" — signaling custom pricing without publishing numbers that may be higher than competitors.

---

## Decision 17: Benchmark Data Presentation

**Decision:** Show full leaderboard table (5 modes × 7 metrics) on landing page

**Alternatives considered:**
1. Summary only ("24% better recall") — less credible without data
2. Downloadable PDF — too much friction
3. Interactive chart — complex, potentially confusing

**Rationale:** Technical buyers want to see the data. A full table builds credibility. The 23.6% improvement and 40% cost reduction are immediately visible. The table is scannable, sortable, and verifiable.

---

## Decision 18: Logo Usage

**Decision:** Theme-aware logos (`docs/assets/logo/kairos-light.png` for light, `kairos-dark.png` for dark), no other variants

**Alternatives considered:**
1. Icon-only mark (leaf without text) — useful for favicons but creates inconsistency
2. Multiple color variants — over-engineered for current needs
3. SVG version — not needed; PNG works for all current use cases

**Rationale:** One logo, one location. Consistency > flexibility at this stage. Future versions may add a favicon-specific variant, but for MVP, the single logo is sufficient.
