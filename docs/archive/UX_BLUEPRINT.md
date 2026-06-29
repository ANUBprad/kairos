# UX Blueprint

**Phase 15 — Product Definition & UX Blueprint**  
**Status:** Superseded by PHASE16_WEBSITE.md

---

## Information Architecture

### Site Structure

```
kairos.dev
│
├── /                    Landing Page
├── /features            Features Overview
├── /pricing             Pricing & Plans
├── /docs                Documentation Hub
├── /blog                Blog
├── /company/about       About Kairos
├── /company/careers     Careers
├── /contact             Contact / Sales
├── /security            Security & Compliance
├── /legal/privacy       Privacy Policy
├── /legal/terms         Terms of Service
├── /status              System Status
│
├── /login               Sign In
├── /signup              Sign Up
├── /forgot-password     Password Reset
│
└── /app                 Authenticated Dashboard
    ├── /app/home        Home
    ├── /app/projects    Projects
    │   └── /app/projects/{id}  Project Detail
    ├── /app/queries     Query Workspace
    │   └── /app/queries/{id}   Query Detail
    ├── /app/analytics   Analytics
    ├── /app/api-keys    API Key Management
    ├── /app/billing     Billing & Invoices
    ├── /app/settings    Account Settings
    └── /app/docs        In-App Documentation
```

---

## User Journeys

### Journey 1: New User Onboarding

```
1. LANDING PAGE
   Sees hero → "Every query deserves a different retrieval strategy."
   Emotion: Curious
   Action: Clicks "Start building — it's free"

2. SIGN UP
   Enters email + password (or Google OAuth)
   Emotion: Quick, frictionless
   Action: Submits form

3. VERIFY EMAIL
   Clicks link in email
   Emotion: Trust (secure process)

4. WELCOME
   Sees: "Welcome to Kairos. Let's run your first query."
   Sees: Quickstart wizard (3 steps)
   Emotion: Guided, not lost

5. CREATE FIRST PROJECT
   Clicks "Create Project"
   Enters name, description
   Emotion: Ready to start

6. UPLOAD DOCUMENT
   Drags PDF or pastes text
   Sees: "Processing..." → "Ready" (with chunk count)
   Emotion: Impressed (fast)

7. CREATE API KEY
   Clicks "Create API Key"
   Copies key
   Emotion: In control

8. EXECUTE FIRST QUERY
   Pastes curl command (auto-generated)
   OR uses in-app query builder
   Sees: Response with confidence, latency, cost
   Emotion: "Wow, that was fast"

9. SEE ANALYTICS
   Navigates to Analytics
   Sees first query appear in live feed
   Emotion: "I can see everything"

10. DECISION POINT
    Has used 1 of 1,000 free queries
    Emotion: "I want to keep using this"
    Action: Saves dashboard link, plans to integrate
```

### Journey 2: Developer Integration

```
1. LOGIN
   Emotion: Familiar

2. GO TO API KEYS
   Creates a named key ("Production")
   Copies key

3. READ QUICKSTART
   Opens /docs/quickstart
   Sees curl, Python, TypeScript examples
   Copies code snippet

4. FIRST API CALL
   curl -X POST https://api.kairos.dev/v1/query \
     -H "X-API-Key: kai_sk_..." \
     -d '{"query": "What is our refund policy?", "project_id": "proj_abc"}'

5. PARSE RESPONSE
   Gets JSON with answer, confidence, strategy, chunks
   Emotion: "This is exactly what I need"

6. INTEGRATE INTO APPLICATION
   Writes integration code using Python SDK
   Tests in staging
   Emotion: Confident

7. MONITOR
   Opens dashboard, sees query appear in real-time
   Checks latency, cost
   Emotion: In control

8. ITERATE
   Tries different strategies by overriding
   Compares results in analytics
   Emotion: "I can optimize without guessing"
```

### Journey 3: Enterprise Evaluation

```
1. LANDS ON WEBSITE
   Sees enterprise case studies
   Clicks "Contact Sales"

2. DEMO CALL
   Sales engineer demonstrates:
   - Adaptive routing with live query examples
   - Confidence calibration visualization
   - Cost comparison vs fixed strategies
   - Benchmark results across domains

3. TRIAL SETUP
   Gets Enterprise trial with dedicated support
   Onboards team (5 users)
   Connects own documents

4. TESTING PHASE
   Team evaluates across 3 use cases
   Compares against current solution
   Measures: recall, latency, cost, confidence

5. SECURITY REVIEW
   Reviews: encryption, data handling, compliance docs
   Meets with security team

6. PURCHASE DECISION
   Signs Enterprise agreement
   Provisioning of dedicated infrastructure
   SSO configured
```

### Journey 4: Team Admin

```
1. LOGIN AS ADMIN
   Sees team management in settings

2. INVITE TEAM MEMBERS
   Enters email addresses
   Assigns roles: Admin, Member, Viewer

3. CREATE SHARED PROJECTS
   Teams collaborate on projects
   Shared document stores
   Shared API keys

4. MONITOR USAGE
   Sees usage across all team members
   Identifies heavy users
   Manages budget allocation

5. MANAGE BILLING
   Views consolidated invoice
   Updates payment method
   Changes plan
```

---

## Page Specifications

### Landing Page (`/`)

**Purpose:** Convert visitors to signups

| Section | Component | Behavior | Animations |
|---------|-----------|----------|------------|
| Navigation | Sticky header | Transparent → Solid on scroll | Background cross-fade |
| Hero | Headline + sub + CTA + trust bar | Full viewport height | Text fade-in, CTA pulse |
| Problem | 2-column text + visual | Scroll-triggered reveal | Slide-in from sides |
| How It Works | 3-step horizontal | Sticky progress indicator | Step-by-step scroll reveal |
| Adaptive Viz | Full-width animated diagram | Auto-playing on scroll | SVG path animation |
| Benchmarks | Data table | Sortable columns | Row fade-in |
| Features | 6-card grid | Hover state with description | Card scale on hover |
| Use Cases | 4-card grid | Click to expand | Accordion animation |
| Pricing | 4-tier comparison | Highlighted Pro (recommended) | Card lift on hover |
| FAQ | Accordion | Click to expand | Height animation |
| CTA | Full-width banner | Sticky bottom on scroll | Background parallax |
| Footer | 4-column link grid | Static | None |

### Features Page (`/features`)

**Purpose:** Detailed feature explanation

**Sections:**
- Adaptive Routing (interactive demo)
- Confidence Calibration (visualization)
- Budget Optimization (cost comparison)
- Feedback Learning (loop diagram)
- Observability (metrics dashboard preview)
- Provider Agnostic (integration logos)

**Interactions:** Scroll-based narrative, each section reveals a new aspect

### Pricing Page (`/pricing`)

**Purpose:** Convert interested users to signups

**Layout:**
- Header: "Simple pricing. Start free."
- Tier cards: Free → Developer → Pro → Enterprise
- Feature comparison table (expandable)
- FAQ

**CTA Hierarchy:**
1. "Get Started" (Free — no CC)
2. "Start Free Trial" (Developer/Pro — 14-day trial)
3. "Contact Sales" (Enterprise)

### Dashboard Home (`/app/home`)

**Purpose:** At-a-glance status and quick actions

**Wireframe:**
```
┌────────────────────────────────────────────────────────┐
│ 🍁 Kairos                           🔍    🔔   👤 John │
│                                                         │
│ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐   │
│ │ 1,234    │ │ 87.2%    │ │ 163ms    │ │ $0.0145  │   │
│ │ Queries  │ │ Avg Recall│ │ Avg Lat  │ │ Avg Cost │   │
│ └──────────┘ └──────────┘ └──────────┘ └──────────┘   │
│                                                         │
│ ┌───────────────────────────┐ ┌─────────────────────┐   │
│ │ Recent Queries           │ │ Usage (7 days)       │   │
│ │ ┌──────────────────────┐ │ │ [area chart]        │   │
│ │ │ "What is refund..." │ │ │                     │   │
│ │ │ 0.94 · 163ms · $0.01│ │ │                     │   │
│ │ ├──────────────────────┤ │ └─────────────────────┘   │
│ │ │ "Compare revenue..." │ │                           │
│ │ │ 0.87 · 450ms · $0.03│ │                           │
│ │ └──────────────────────┘ │                           │
│ └───────────────────────────┘                           │
│                                                         │
│ ┌───────────────────────────┐ ┌─────────────────────┐   │
│ │ Strategy Distribution    │ │ Quick Actions        │   │
│ │ [donut chart]            │ │ [+ New Query]       │   │
│ │ Simple: 52%              │ │ [+ New Project]     │   │
│ │ Complex: 31%             │ │ [+ Create API Key]  │   │
│ │ Multi-hop: 17%           │ │ [View Docs]         │   │
│ └───────────────────────────┘ └─────────────────────┘   │
└────────────────────────────────────────────────────────┘
```

### Query Workspace (`/app/queries`)

**Purpose:** Execute queries and see results

**Layout:**
```
┌────────────────────────────────────────────────────────┐
│ ← Back to Home           New Query      [History] [↗] │
│                                                         │
│ Project: [My Project ▼]                                 │
│                                                         │
│ ┌────────────────────────────────────────────────────┐ │
│ │                                                    │ │
│ │  Ask a question about your documents...            │ │
│ │                                                    │ │
│ │                        [Execute Query →]           │ │
│ └────────────────────────────────────────────────────┘ │
│                                                         │
│ ┌────────────────────────────────────────────────────┐ │
│ │  Strategy: Complex (MMR + Cross-Encoder Rerank)    │ │
│ │  Confidence: 0.92  ·  Latency: 163ms  ·  Cost:     │ │
│ │  $0.0145                                            │ │
│ │                                                    │ │
│ │  [Animated flow: Query → Classify → Plan → Retrieve│ │
│ │   → Answer]                                        │ │
│ └────────────────────────────────────────────────────┘ │
│                                                         │
│ ┌────────────────────────────────────────────────────┐ │
│ │  Answer                                              │ │
│ │                                                    │ │
│ │  Based on your refund policy (policy.pdf, p.3):    │ │
│ │  "Customers may return items within 30 days..."    │ │
│ │                                                    │ │
│ │  [👍] [👎] [📋 Copy] [📥 Export]                   │ │
│ └────────────────────────────────────────────────────┘ │
│                                                         │
│ ┌────────────────────────────────────────────────────┐ │
│ │  Retrieved Sources (4)                              │ │
│ │                                                    │ │
│ │  1. policy.pdf, p.3 — "Return Policy" — 0.94      │ │
│ │  2. policy.pdf, p.5 — "Exceptions" — 0.87         │ │
│ │  3. faq.pdf, p.1 — "Common Questions" — 0.76      │ │
│ │  4. terms.pdf, p.12 — "Refund Eligibility" — 0.71 │ │
│ └────────────────────────────────────────────────────┘ │
└────────────────────────────────────────────────────────┘
```

### Analytics (`/app/analytics`)

**Purpose:** Understand usage patterns and performance

**Tabs:**
| Tab | Content | Chart Type |
|-----|---------|------------|
| Overview | KPIs + 7-day trends | Line chart, stat cards |
| Queries | Volume, strategy breakdown | Stacked bar, donut |
| Cost | Cost/query, cumulative cost | Area chart, bar |
| Performance | Latency (P50, P95, P99), error rate | Multi-line, gauge |

### API Keys (`/app/api-keys`)

**Purpose:** Manage programmatic access

**Features:**
- List of keys: Name, Prefix, Created, Last Used, Status
- Create key modal: Name, Scope (project), Expiration
- Revoke confirmation dialog
- Usage per key (mini chart)
- Copy to clipboard on creation

**States:**
- Empty: "Create your first API key to start building"
- List: Sortable, filterable table
- Creating: Modal with newly generated key (show once)
- Revoked: Key grayed out, "Revoked" badge

### Billing (`/app/billing`)

**Purpose:** Manage subscription and payment

**Sections:**
1. Current Plan — Plan name, price, usage bar, change plan button
2. Usage — Current period usage vs quota, overage info
3. Invoices — Table of past invoices with download
4. Payment Method — Card on file, update button

**States:**
- Free: Upgrade prompts, "You've used X of 1,000 queries"
- Paid: Plan details, usage, next billing date
- Over-limit: Warning banner, upgrade suggestion
- Past due: Error state, update payment required

### Settings (`/app/settings`)

**Purpose:** Account configuration

**Tabs:**
| Tab | Fields |
|-----|--------|
| Profile | Name, email, avatar |
| Account | Password change, email preferences, delete account |
| Notifications | Usage alerts, product updates |
| Appearance | Theme (light/dark/system) |

---

## Microcopy Patterns

### Buttons

| Context | Text |
|---------|------|
| Primary CTA | "Start building — it's free" |
| Query execution | "Execute Query →" |
| Create project | "Create Project" |
| Create API key | "Create Key" |
| Save settings | "Save Changes" |
| Delete | "Delete" (with confirmation: "Are you sure? This cannot be undone.") |
| Cancel | "Cancel" |
| Upgrade | "Upgrade Plan" |
| Contact sales | "Talk to Sales" |

### Empty States

| Context | Title | Description | CTA |
|---------|-------|-------------|-----|
| No projects | "No projects yet" | "Create your first project to get started." | "Create Project" |
| No queries | "No queries yet" | "Execute your first query to see Kairos in action." | "Execute Query" |
| No API keys | "No API keys" | "Create an API key to start integrating." | "Create Key" |
| No documents | "No documents" | "Upload documents to give Kairos something to search." | "Upload Document" |
| No analytics | "Not enough data" | "Analytics will appear once you've executed some queries." | "Execute Query" |

### Loading States

| Context | Text |
|---------|------|
| Query executing | "Analyzing query..." → "Selecting strategy..." → "Retrieving..." → "Done" |
| Document ingesting | "Processing document..." → "Chunking..." → "Embedding..." → "Ready" |
| Dashboard loading | "Loading your dashboard..." |

### Error States

| Context | Message |
|---------|---------|
| API key invalid | "Invalid API key. Check your key and try again." |
| Rate limited | "Rate limit exceeded. Please wait before retrying." |
| Query failed | "Query failed. Try rephrasing or check your document index." |
| Network error | "Connection error. Check your internet and try again." |
| Quota exceeded | "You've used all your queries for this month. Upgrade to continue." |
| 500 error | "Something went wrong. Our team has been notified." |
