# Phase 16 — Implementation Plan

**Status:** Final

---

Implementation-ready roadmap. Every technology decision is justified. Build order is optimized for parallel tracks and dependency resolution.

---

## 1. Technology Stack

### 1.1 Frontend

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| **Next.js** | 15 (App Router) | Full-stack React framework | Best SSR/SSG/CSR hybrid for marketing + dashboard. React 19 support. Turbopack for fast dev. |
| **React** | 19 | UI library | Latest stable. Concurrent features. Server components. |
| **TypeScript** | 5.x | Type safety | Mandatory for team scalability. Catches bugs at build time. |
| **Tailwind CSS** | v4 | Utility-first CSS | Zero-runtime CSS. JIT compilation. Consistent with v4's CSS-first config. |
| **shadcn/ui** | Latest | Accessible UI primitives | Radix-based. Tree-shakeable. Copy-paste not npm dependency. Full customization. |
| **Framer Motion** | Latest | Animation library | Declarative React animations. Spring physics. AnimatePresence for route transitions. |
| **Lucide React** | Latest | Icon library | Clean 2px stroke icons. Tree-shakeable. Consistent style. |
| **TanStack Query** | v5 | Server state management | Caching, deduplication, background refetch, optimistic updates. Industry standard. |
| **React Hook Form** | Latest | Form management | Performant (uncontrolled). Minimal re-renders. Zod integration. |
| **Zod** | Latest | Schema validation | TypeScript-first. Composeable. Runtime + type safety. |
| **Recharts** | Latest | Charting library | React-native. Composable. Good defaults. Supports responsiveness. |
| **TanStack Table** | Latest | Headless table | Sort, filter, paginate, select. UI-agnostic. Works with shadcn. |
| **date-fns** | Latest | Date manipulation | Tree-shakeable. Immutable. Functional. |
| **Auth.js (NextAuth)** | v5 | Authentication | Built for Next.js App Router. Multiple providers. Database sessions. |
| **next-themes** | Latest | Theme management | SSR-safe. localStorage persistence. System preference detection. |
| **@tailwindcss/typography** | Latest | Prose styling | Consistent typography for docs/blog content. |
| **next-mdx-remote** | Latest | MDX rendering | Render docs/blog from local MDX files. |
| **Motion One** | Latest | Lightweight animation (hero) | For hero SVG path animations (lighter than Framer for this use case). |

### 1.2 Backend / Infrastructure

| Technology | Purpose | Why |
|------------|---------|-----|
| **Go (chi)** | API Gateway | High throughput, low latency. Same pattern as Stripe/Cloudflare. |
| **Python (FastAPI)** | Intelligence Service | ML ecosystem (numpy, sklearn, torch). Existing codebase. |
| **Postgres (Supabase)** | Primary database | Relational data (users, projects, API keys, usage, billing). Managed option reduces ops. |
| **Redis** | Cache + Sessions | Sub-millisecond reads. Rate limiting counters. Session store. Job queues. |
| **ChromaDB** | Vector store | Self-hosted. Python-native. Good for MVP scale. Provider-agnostic architecture. |
| **Prometheus + Grafana** | Observability | Industry standard metrics + dashboards. Already in Docker Compose. |
| **Stripe** | Billing | Standard for SaaS billing. Checkout, webhooks, customer portal. |
| **Vercel** | Frontend hosting | Optimized for Next.js. Edge functions. ISR. Preview deployments. |
| **Docker Compose** | Backend deployment | Local dev + production backend. Consistent environments. |

### 1.3 Development Tooling

| Tool | Purpose | Why |
|------|---------|-----|
| **pnpm** | Package manager | Fast, disk-efficient, strict dependency resolution. |
| **Turbopack** | Dev server (Next.js) | 10x faster than webpack. Built into Next.js 15. |
| **ESLint + Prettier** | Code quality | Consistent code style. Catch errors early. |
| **Husky + lint-staged** | Pre-commit hooks | Run lint + format on staged files. |
| **Vitest + Testing Library** | Testing | Fast, Vite-native. Component + integration tests. |
| **Playwright** | E2E testing | Cross-browser. Reliable selectors. Visual regression. |
| **Storybook** | Component development | Isolated component development. Visual regression testing. Documentation. |
| **GitHub Actions** | CI/CD | Build, lint, test, typecheck, deploy. |

---

## 2. Why Each Technology (Extended Justification)

### Next.js 15 vs Alternatives

| Alternative | Rejected Because |
|-------------|-----------------|
| Remix | Less ecosystem maturity. Smaller community. Fewer deployment options. |
| SPA (Vite + React Router) | No SSR for marketing (SEO hit). No built-in file-based routing for API. |
| Astro | Not suitable for highly interactive dashboard. Islands architecture adds complexity. |
| Gatsby | Declining ecosystem. Slower builds. Not ideal for dashboard. |

**Winner:** Next.js 15 — best hybrid of SSR (marketing) + CSR (dashboard) + API routes in one codebase.

### Tailwind CSS v4 vs Alternatives

| Alternative | Rejected Because |
|-------------|-----------------|
| Styled Components | Runtime CSS-in-JS. Bundle size cost. Slower. |
| CSS Modules | No design-token consistency built-in. More boilerplate. |
| vanilla-extract | Build-time CSS-in-JS. More complex setup. Smaller ecosystem. |
| Panda CSS | Newer. Less mature Tailwind alternative. |

**Winner:** Tailwind CSS v4 — zero-runtime, design-token system, massive ecosystem (shadcn/ui built on it).

### Framer Motion vs Alternatives

| Alternative | Rejected Because |
|-------------|-----------------|
| CSS animations only | Limited orchestration (stagger, spring, layout animations). |
| GSAP | Not React-native. Imperative API. Larger bundle. |
| Motion One | Smaller but less feature-rich (no layout animations, no AnimatePresence). |

**Winner:** Framer Motion — best React animation library. Spring physics. `AnimatePresence` for exit animations.

### TanStack Query vs Alternatives

| Alternative | Rejected Because |
|-------------|-----------------|
| RTK Query | Tied to Redux. More boilerplate. |
| SWR | Fewer features (no mutations, no optimistic updates built-in). |
| Plain fetch | No caching, deduplication, or revalidation. |

**Winner:** TanStack Query v5 — industry standard. Full feature set. Devtools.

### Auth.js v5 vs Alternatives

| Alternative | Rejected Because |
|-------------|-----------------|
| Clerk | External dependency. Cost scales with users. Less control. |
| Supabase Auth | Tied to Supabase ecosystem. Harder to migrate. |
| Firebase Auth | Google lock-in. GDPR concerns. |
| Custom auth | Security risk. Maintenance burden. Time-intensive. |

**Winner:** Auth.js v5 — open source. Multiple providers. Database-agnostic. Built for Next.js.

### Stripe vs Alternatives

| Alternative | Rejected Because |
|-------------|-----------------|
| Paddle | Higher fees. Less control over checkout UX. |
| LemonSqueezy | Smaller. Fewer enterprise features. |
| Recurly | More expensive. Less developer-friendly API. |

**Winner:** Stripe — standard for B2B SaaS. Best DX. Checkout, Portal, webhooks, invoices.

### Postgres (Supabase) vs Alternatives

| Alternative | Rejected Because |
|-------------|-----------------|
| MongoDB | Document DB less suitable for relational billing/auth data. |
| PlanetScale | MySQL-compatible. No longer free tier. Vitess complexity. |
| Supabase | Postgres + managed. Free tier. Auth + storage optional. Easy migrations. |

**Winner:** Supabase Postgres — free tier, managed, Postgres-compatible, easy migration path.

---

## 3. Build Order (Milestones)

### M0: Project Scaffolding (2 days)

| Task | Details |
|------|---------|
| Initialize Next.js 15 app in `apps/portal/` | `create-next-app` with TypeScript, Tailwind, App Router |
| Install all dependencies | pnpm, shadcn/ui, Framer Motion, TanStack Query, etc. |
| Configure Tailwind v4 with design tokens | `globals.css` with `@theme` block from DESIGN_SYSTEM |
| Set up folder structure | `components/`, `lib/`, `hooks/`, `providers/`, `types/`, `public/` |
| Add shadcn/ui base components | Button, Card, Input, Dialog, Dropdown, Tabs, Badge, Avatar, Skeleton, Toast |
| Configure ESLint + Prettier | Extend Next.js ESLint config. Add Prettier. |
| Set up Storybook | For component development |
| Create `.env.example` | All required env vars documented |

### M1: Design System Implementation (3 days)

| Task | Details |
|------|---------|
| Implement all CSS custom properties | Colors, typography, spacing, shadows, radius |
| Build LeafLogo component | SVG inline, size variants |
| Build theme provider | next-themes integration, system preference detection |
| Implement dark mode | CSS variables, transition, localStorage |
| Build shared component library | Skeleton, EmptyState, ErrorBoundary, ConfirmDialog, Toast |
| Create utility functions | `cn()` from `tailwind-merge`, formatDate, formatCurrency |
| Write component stories | Storybook for every shared + UI component |

### M2: Auth (5 days)

| Task | Details | Dependencies |
|------|---------|--------------|
| Configure Auth.js v5 | Database session adapter, providers setup | M0 |
| Set up Postgres schema via Prisma | Users table, sessions, accounts | M0 |
| Build login page | `/login` with email/password + Google OAuth | M1 |
| Build signup page | `/signup` with form validation (Zod) | M1 |
| Build forgot password | `/forgot-password` with email flow | M1 |
| Build auth layout | Centered card, minimal, logo | M1 |
| Add middleware | Protect `/app/*` routes, redirect unauthenticated | M2 |
| Write auth page stories | Storybook for all auth components | M1 |

### M3: Marketing Site (10 days — parallel with M2)

| Task | Details | Dependencies |
|------|---------|--------------|
| Build Navbar | Sticky, transparent→solid on scroll, mobile hamburger | M1 |
| Build Footer | 4-column, responsive | M1 |
| Build Hero section | Full viewport, dark bg, type animation | M1 |
| Build Social Proof section | Logo row | M1 |
| Build Problem section | 2-column text + visual | M1 |
| Build How It Works section | 3-step with connecting line | M1 |
| Build Engine Visualization (demo) | Interactive query flow SVG, predefined queries | M1 |
| Build Benchmark Table | Sortable, highlighted row | M1 |
| Build Features Grid | 6 cards, hover states | M1 |
| Build Architecture section | System diagram | M1 |
| Build Integrations section | Logo grid | M1 |
| Build Use Cases section | 4 cards | M1 |
| Build Pricing Cards | 4 tiers, "Most Popular" highlight | M1 |
| Build FAQ section | Accordion | M1 |
| Build CTA section | Full-width brand banner | M1 |
| Build Features page | Scroll-based narrative sections | M3.1-3.15 |
| Build Pricing page | Tier cards + comparison table + FAQ | M3.1-3.15 |
| Implement SEO | Meta tags, structured data, sitemap, robots.txt | M3 |
| Performance optimization | Image optimization, lazy loading, Core Web Vitals | M3 |

### M4: Dashboard Foundation (5 days)

| Task | Details | Dependencies |
|------|---------|--------------|
| Build Dashboard layout | Sidebar + Topbar + Content area | M0, M2 |
| Build Sidebar | Navigation links, active state, collapse behavior, responsive | M1 |
| Build Topbar | Breadcrumbs, search, notifications, avatar | M1 |
| Build Dashboard Home | Stats cards, recent queries list, usage chart, quick actions | M1 |
| Build Projects page | List view, create modal, detail page, settings | M1 |
| Build API Keys page | Table, create modal, revoke confirmation, empty state | M1 |
| Build Settings page | Profile, account, notifications, appearance tabs | M1 |

### M5: Query Workspace + Analytics (8 days)

| Task | Details | Dependencies |
|------|---------|--------------|
| Build Query Input | Text input with project selector | M1, M4 |
| Build Strategy Flow component | Animated query routing visualization | M1 |
| Build Query Result component | Answer, metrics, sources, feedback buttons | M1 |
| Build Query History panel | List, filter, search, restore | M1, M4 |
| Build Analytics Overview | KPI cards, usage charts | M1 |
| Build Analytics tabs | Queries, Cost, Performance | M1 |
| Add date range picker | 7d/30d/90d/custom | M1 |
| Add data export | CSV download for charts | M1 |
| Build Query Detail page | Full query result view with shareable URL | M4 |

### M6: Billing + Usage (5 days)

| Task | Details | Dependencies |
|------|---------|--------------|
| Set up Stripe products | Free, Developer, Pro, Enterprise in Stripe dashboard | — |
| Build Billing page | Current plan, usage bar, invoices, payment method | M1, M4 |
| Implement Stripe Checkout | Upgrade/downgrade flow | M6.1 |
| Implement Stripe webhook | Handle checkout.completed, invoice.paid, etc. | M6.2 |
| Build usage enforcement | Quota checks on API calls, 402 errors at limit | M4, M6.1 |
| Build usage alerts | Email notification at 80%/100%/150% of quota | M6.4 |

### M7: Docs + Blog (5 days — parallel)

| Task | Details | Dependencies |
|------|---------|--------------|
| Set up MDX compilation | next-mdx-remote or content-collections | M0 |
| Build Docs layout | Sidebar navigation, search, content area | M1 |
| Build Docs pages | Quickstart, API reference, SDKs, guides, FAQ | M1 |
| Build Blog layout | Card grid, categories, tags, RSS | M1 |
| Add search to docs | Fuse.js (MVP) | M1 |
| Write initial docs content | Quickstart, API ref, SDK guides | — |

### M8: Polish + Launch Prep (5 days)

| Task | Details | Dependencies |
|------|---------|--------------|
| Add loading/error/empty states audit | Every page checked | M2-M7 |
| Add page transitions | AnimatePresence on route changes | M1 |
| Add keyboard shortcuts | Command palette trigger, navigation shortcuts | M1 |
| Performance audit | Lighthouse, Core Web Vitals, bundle analysis | M2-M7 |
| Accessibility audit | Screen reader, keyboard nav, color contrast | M2-M7 |
| Write error boundary for every route | Catch and display friendly errors | M1 |
| Add analytics (PostHog or Plausible) | Page views, signups, conversions | M0 |
| Add Sentry for error tracking | Frontend error monitoring | M0 |
| Load test | k6 for API + page load | M6 |

---

## 4. Architecture Decisions

### 4.1 Route Design

```
Marketing pages:    SSR (dynamic) — enables ISR for content updates
Auth pages:         SSR (dynamic) — session-dependent
Dashboard pages:    CSR with client-side data fetching (TanStack Query)
API routes:         Next.js API routes for auth, proxies to Go backend
```

### 4.2 Data Fetching Strategy

| Context | Strategy | Library |
|---------|----------|---------|
| Marketing page content | SSG + ISR | `getStaticProps` + `revalidate` |
| Blog posts | SSG + ISR | `getStaticPaths` + `revalidate` |
| Docs content | SSG | `getStaticProps` |
| Dashboard data | CSR with stale-while-revalidate | TanStack Query |
| Auth check | SSR middleware | Auth.js |
| API calls | Client → Next.js rewrite → Go gateway | TanStack Query |

### 4.3 State Management

| State Type | Solution | Why |
|------------|----------|-----|
| Server state | TanStack Query | Cache, dedupe, refetch, optimistic updates |
| Auth state | Auth.js session context | Built-in provider |
| UI state | React useState/useReducer | Local to component |
| Form state | React Hook Form | Performant, controlled via refs |
| Theme state | next-themes | SSR-safe, localStorage |
| Global UI (sidebar, modals) | React Context | Small surface area |

No Redux, no Zustand, no Jotai. The app doesn't need global state management beyond what React + TanStack Query provide.

### 4.4 Component Architecture

```
pages/[route].tsx          → Page component (fetches data, composes sections)
components/[category]/     → Reusable components (no data fetching)
lib/api.ts                 → API client (fetch wrappers, typed responses)
hooks/use-*.ts             → Custom hooks (data fetching, business logic)
providers/                  → Context providers (theme, auth, query client)
types/                      → TypeScript interfaces and types
```

Components never fetch data directly. They receive data via props. Data fetching happens in page components or custom hooks.

### 4.5 API Communication

```
Browser → Next.js (app/) → Next.js rewrite (/api/*) → Go Gateway (api.kairos.dev)
                                                         ↓
                                                    Python Intelligence
                                                         ↓
                                                    Postgres / Redis / ChromaDB
```

Next.js rewrites proxy `/api/*` to the Go gateway, adding auth tokens from the session. This avoids CORS issues and keeps API keys server-side.

---

## 5. Testing Strategy

### 5.1 Test Pyramid

```
    ╱╲
   ╱ E2E ╲              Playwright — critical user journeys (5-10 tests)
  ╱────────╲
 ╱ Integration ╲        Testing Library + Vitest — page-level behavior (50+ tests)
╱────────────────╲
╱  Unit + Component ╲    Storybook + Vitest — individual components (200+ tests)
╱────────────────────╲
```

### 5.2 Test Focus Areas

| Level | What | Tool | Coverage Target |
|-------|------|------|-----------------|
| Unit | Utility functions, form validation, date formatting | Vitest | 100% of utils |
| Component | Every component state (loading, empty, error, edge cases) | Storybook + Testing Library | 100% of components |
| Integration | Page rendering, data fetching, form submission | Testing Library | All pages |
| E2E | Signup → first query flow, upgrade flow, auth | Playwright | 5 critical journeys |
| Accessibility | Automated aXe checks per page | Playwright + axe-core | All pages |
| Visual regression | Component screenshots | Storybook + Chromatic | All components |
| Performance | Lighthouse CI, bundle analysis | Lighthouse CI | Every PR |

### 5.3 CI/CD Pipeline (GitHub Actions)

```yaml
# .github/workflows/ci.yml
name: CI
on: [pull_request]

jobs:
  lint:
    runs-on: ubuntu-latest
    steps: [pnpm lint]
  
  typecheck:
    runs-on: ubuntu-latest
    steps: [pnpm typecheck]
  
  test:
    runs-on: ubuntu-latest
    steps: [pnpm test -- --coverage]
  
  build:
    runs-on: ubuntu-latest
    steps: [pnpm build]
  
  e2e:
    runs-on: ubuntu-latest
    steps: [pnpm e2e]
```

**CD:** Vercel auto-deploys `main` branch to production. Preview deployments for every PR.

---

## 6. Project Structure

```
apps/
├── portal/                          # Next.js SaaS application
│   ├── app/
│   │   ├── globals.css              # Tailwind v4 + design tokens
│   │   ├── layout.tsx               # Root layout (providers, fonts)
│   │   ├── page.tsx                  # Landing page
│   │   ├── features/page.tsx
│   │   ├── pricing/page.tsx
│   │   ├── (marketing)/
│   │   │   ├── layout.tsx           # Marketing layout (nav, footer)
│   │   │   ├── blog/page.tsx
│   │   │   ├── docs/page.tsx
│   │   │   ├── company/page.tsx
│   │   │   ├── contact/page.tsx
│   │   │   └── security/page.tsx
│   │   ├── (auth)/
│   │   │   ├── layout.tsx           # Auth layout (centered, minimal)
│   │   │   ├── login/page.tsx
│   │   │   ├── signup/page.tsx
│   │   │   └── forgot-password/page.tsx
│   │   ├── (dashboard)/
│   │   │   ├── layout.tsx           # Dashboard layout (sidebar, topbar)
│   │   │   ├── home/page.tsx
│   │   │   ├── projects/page.tsx
│   │   │   ├── queries/page.tsx
│   │   │   ├── analytics/page.tsx
│   │   │   ├── api-keys/page.tsx
│   │   │   ├── billing/page.tsx
│   │   │   └── settings/page.tsx
│   │   └── api/                     # Next.js API routes
│   │       ├── auth/
│   │       └── proxy/               # Proxy to Go gateway
│   ├── components/
│   │   ├── ui/                      # shadcn/ui primitives
│   │   ├── marketing/               # Landing page components
│   │   ├── dashboard/               # Dashboard components
│   │   ├── auth/                    # Auth form components
│   │   └── shared/                  # Cross-app components
│   ├── lib/
│   │   ├── utils.ts                 # cn(), formatDate, formatCurrency
│   │   ├── api.ts                   # TanStack Query client + API functions
│   │   └── constants.ts             # Tier limits, breakpoints, routes
│   ├── hooks/
│   │   ├── use-auth.ts              # Auth hook
│   │   ├── use-queries.ts           # Query data hooks
│   │   └── use-media-query.ts       # Responsive breakpoint hook
│   ├── providers/
│   │   ├── theme-provider.tsx        # next-themes wrapper
│   │   ├── auth-provider.tsx         # Auth.js session provider
│   │   └── query-provider.tsx        # TanStack Query provider
│   ├── types/
│   │   ├── api.ts                   # API response types
│   │   ├── dashboard.ts             # Dashboard-specific types
│   │   └── marketing.ts             # Marketing content types
│   ├── public/
│   │   ├── favicon.ico
│   │   ├── favicon.svg
│   │   ├── apple-touch-icon.png
│   │   ├── og-image.png
│   │   └── logo.svg                 # Inline SVG logo
│   ├── content/                     # MDX content
│   │   ├── docs/
│   │   └── blog/
│   └── next.config.ts
├── internal-dashboard/              # Existing Streamlit (unchanged)
└── gateway/                         # Existing Go gateway (unchanged)
```

---

## 7. Environment Variables

```env
# App
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXT_PUBLIC_API_URL=http://localhost:8080

# Auth (Auth.js)
AUTH_SECRET=...
AUTH_GITHUB_ID=...
AUTH_GITHUB_SECRET=...
AUTH_GOOGLE_ID=...
AUTH_GOOGLE_SECRET=...
AUTH_RESEND_KEY=...                  # For magic link emails

# Database
DATABASE_URL=postgresql://...

# Stripe
STRIPE_SECRET_KEY=...
STRIPE_WEBHOOK_SECRET=...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=...
STRIPE_FREE_PRICE_ID=...
STRIPE_DEVELOPER_PRICE_ID=...
STRIPE_PRO_PRICE_ID=...

# Analytics
NEXT_PUBLIC_POSTHOG_KEY=...
NEXT_PUBLIC_POSTHOG_HOST=...

# Error Tracking
NEXT_PUBLIC_SENTRY_DSN=...
SENTRY_AUTH_TOKEN=...
```

---

## 8. Launch Checklist

### Pre-Launch (Beta)

- [ ] All 7 MVP features complete and tested
- [ ] Auth flow: signup → verify → login → dashboard
- [ ] Query flow: project → upload → API key → first query
- [ ] Free tier quota enforcement works
- [ ] Stripe Checkout functional (Developer and Pro)
- [ ] Core Web Vitals pass (LCP < 2.5s, CLS < 0.1, INP < 200ms)
- [ ] Lighthouse scores > 90 all categories
- [ ] Accessibility audit passes WCAG AA
- [ ] All pages have loading, empty, error states
- [ ] 100 beta users onboarded with feedback collected

### Pre-Launch (v1.0)

- [ ] Stripe billing functional for all tiers
- [ ] Usage alerts working (80%/100%/150%)
- [ ] Invoice generation and history working
- [ ] Docs complete (Quickstart, API Ref, SDKs, FAQ)
- [ ] Blog has 3+ launch posts
- [ ] OpenAPI spec published
- [ ] Python SDK updated with new endpoints
- [ ] Penetration test completed
- [ ] Load test passed (10x expected launch traffic)
- [ ] Status page active
- [ ] Sentry error tracking configured
- [ ] Uptime monitoring active
- [ ] DNS ready for production cutover
- [ ] Rollback plan documented

### Launch Day

- [ ] Flip DNS to production
- [ ] Post on Product Hunt
- [ ] Post on Hacker News
- [ ] Email beta users (launch announcement)
- [ ] AI newsletter submissions
- [ ] Social media posts
- [ ] Blog launch post published
- [ ] Monitor error rates (Sentry)
- [ ] Monitor response times (Grafana)
- [ ] Monitor signups and queries (dashboard)
- [ ] On-call engineer available

### Post-Launch (Week 1)

- [ ] Daily standup for launch issues
- [ ] Bug fix rotation
- [ ] User feedback triage
- [ ] Performance optimization based on real traffic
- [ ] Convert beta users to paid

---

## 9. Risk Register

| Risk | Probability | Impact | Mitigation |
|------|-----------|--------|------------|
| Auth.js migration breaks existing users | Low | Critical | Thorough E2E testing. Staging environment with prod data clone. |
| Stripe webhook delivery fails | Low | High | Idempotency keys. Retry logic. Manual reconciliation dashboard. |
| Next.js 15 has breaking changes before stable | Low | Medium | Pin Next.js version. Test upgrades in CI. |
| ChromaDB performance degrades at scale | Medium | Medium | Benchmark at 10K/100K queries. Add pagination. Consider Pinecone fallback. |
| LLM API costs exceed projections | Medium | High | Hard budget caps. Per-customer cost monitoring. Cost optimization dashboard. |
| Low conversion from free to paid | Medium | High | Improve trial UX. Add usage-triggered upgrade prompts. Email campaigns. |
| Core Web Vitals fail in production | Medium | Medium | Lighthouse CI gate. RUM monitoring. Bundle analysis. |
| Component library (shadcn/ui) breaking update | Low | Low | Version pin. Lockfile. Peer dependency review. |

---

## 10. Estimated Timeline

| Milestone | Days | Team Size | Parallel |
|-----------|------|-----------|----------|
| M0: Project Scaffolding | 2 | 1 FE | — |
| M1: Design System | 3 | 1 FE | — |
| M2: Auth | 5 | 1 FE | M3 |
| M3: Marketing Site | 10 | 1 FE | M2, M4 |
| M4: Dashboard Foundation | 5 | 1 FE | M2, M3 |
| M5: Query Workspace + Analytics | 8 | 1 FE | M6 |
| M6: Billing + Usage | 5 | 1 FE | M5 |
| M7: Docs + Blog | 5 | 1 FE | M5, M6 |
| M8: Polish + Launch Prep | 5 | 1 FE | — |
| **Total (sequential)** | **48 days** | | |
| **With parallelism** | **~35 days (~7 weeks)** | 2 FE | |

With 2 frontend engineers (one marketing, one dashboard), the timeline collapses to ~5 weeks.
