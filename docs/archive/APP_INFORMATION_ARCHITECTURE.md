# App Information Architecture

**Phase 14 — Product Transformation**  
**Status:** Planning  

---

## Application Structure

The authenticated application lives at `app.kairos.dev` and serves as the primary user interface for the Kairos SaaS platform.

```
app.kairos.dev
│
├── /home                     Dashboard home
├── /projects                 Project management
│   ├── /projects             List all projects
│   ├── /projects/new         Create project
│   └── /projects/{id}        Project detail
│       ├── /overview         Project overview
│       ├── /queries          Project queries
│       ├── /documents        Project documents
│       ├── /analytics        Project analytics
│       └── /settings         Project settings
├── /queries                  Query workspace
│   ├── /queries/new          New query
│   └── /queries/{id}         Query detail
├── /api-keys                 API key management
├── /analytics                Global analytics
│   ├── /analytics/overview   Usage overview
│   ├── /analytics/queries    Query analytics
│   ├── /analytics/cost       Cost analysis
│   └── /analytics/performance Performance metrics
├── /usage                    Usage & quotas
├── /billing                  Billing & plans
│   ├── /billing/overview     Current plan & usage
│   ├── /billing/invoices     Invoice history
│   └── /billing/payment      Payment methods
├── /settings                 Account settings
│   ├── /settings/profile     Profile
│   ├── /settings/account     Account
│   ├── /settings/team        Team (Enterprise)
│   ├── /settings/notifications Notifications
│   └── /settings/appearance  Theme
├── /docs                     Documentation
└── /support                  Support
```

---

## Navigation Architecture

### Primary Navigation (Sidebar)

```
┌──────────────────────┐
│ 🍁 Kairos            │  ← Logo + product name
├──────────────────────┤
│ ⌂ Home               │
│ 📁 Projects          │
│ 🔍 Queries           │
│ 📊 Analytics         │  ← Expandable section
│   ├─ Overview        │
│   ├─ Queries         │
│   ├─ Cost            │
│   └─ Performance     │
│ 🔑 API Keys          │
│ 💳 Billing           │
├──────────────────────┤
│ ⚙ Settings           │
│ 📖 Docs              │
│ 💬 Support           │
└──────────────────────┘
```

### Top Bar

```
┌──────────────────────────────────────────────┐
│ ← Back          🔍 Search    🔔   👤 John   │
└──────────────────────────────────────────────┘
```

- Search: global search across projects, queries, docs
- Notifications: bell icon with badge
- User menu: Profile, Settings, Sign out

---

## Page Specifications

### Dashboard Home (`/home`)

**Purpose:** At-a-glance overview of user's Kairos activity

**Layout:**

```
┌──────────────────────────────────────────────┐
│ Welcome back, John                           │
│                                              │
│ ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐        │
│ │1,234 │ │ 87.2%│ │ 163ms│ │$0.014│        │
│ │Queries│ │Recall│ │Latency│ │Cost/Q│        │
│ └──────┘ └──────┘ └──────┘ └──────┘        │
│                                              │
│ ┌─────────────────┐ ┌──────────────────┐    │
│ │ Recent Queries   │ │ Usage (7d)        │   │
│ │ • "What is..."  │ │ [area chart]      │   │
│ │ • "Compare..."  │ │                    │   │
│ │ • "How does..." │ │                    │   │
│ └─────────────────┘ └──────────────────┘    │
│                                              │
│ ┌─────────────────┐ ┌──────────────────┐    │
│ │ System Status    │ │ Quick Actions     │   │
│ │ ● All systems   │ │ [+ New Query]     │   │
│ │   operational   │ │ [+ New Project]   │   │
│ └─────────────────┘ └──────────────────┘    │
└──────────────────────────────────────────────┘
```

### Query Workspace (`/queries/new`)

**Purpose:** Execute adaptive retrieval queries and view results

**Layout:**

```
┌──────────────────────────────────────────────┐
│ New Query                    [History] [↗]   │
│                                              │
│ ┌──────────────────────────────────────────┐ │
│ │ [Project: My Project ▼]                  │ │
│ │                                          │ │
│ │ ┌──────────────────────────────────────┐ │ │
│ │ │ Ask a question...                    │ │ │
│ │ │                                      │ │ │
│ │ │          [Submit Query →]            │ │ │
│ │ └──────────────────────────────────────┘ │ │
│ └──────────────────────────────────────────┘ │
│                                              │
│ ┌──────────────────────────────────────────┐ │
│ │ Strategy Visualization                    │ │
│ │                                          │ │
│ │  Query → Classify → Plan → Retrieve      │ │
│ │  (animated flow diagram)                 │ │
│ │                                          │ │
│ │  Strategy: Complex (MMR + Rerank)        │ │
│ │  Confidence: 0.87                        │ │
│ │  Latency: 163ms                          │ │
│ │  Cost: $0.014                            │ │
│ └──────────────────────────────────────────┘ │
│                                              │
│ ┌──────────────────────────────────────────┐ │
│ │ Answer                                    │ │
│ │                                          │ │
│ │ The refund policy states... [citations]  │ │
│ │                                          │ │
│ │ 👍 👎 📋 Export                          │ │
│ └──────────────────────────────────────────┘ │
│                                              │
│ ┌──────────────────────────────────────────┐ │
│ │ Retrieved Chunks (4)                     │ │
│ │                                          │ │
│ │ 1. [doc1.pdf] Page 3: Refund policy...   │ │
│ │ 2. [doc2.pdf] Page 7: Return window...   │ │
│ │ 3. ...                                   │ │
│ └──────────────────────────────────────────┘ │
└──────────────────────────────────────────────┘
```

### Analytics (`/analytics/overview`)

**Purpose:** Track usage, performance, and cost trends

**Layout:**

```
┌──────────────────────────────────────────────┐
│ Analytics                  [7d ▼] [Export]  │
│                                              │
│ ┌──────────┐ ┌──────────┐ ┌──────────┐     │
│ │ 84,291   │ │ 23.6%    │ │ $0.0145  │     │
│ │ Total    │ │ Improv.  │ │ Avg Cost │     │
│ │ Queries  │ │ vs Naive │ │ /Query   │     │
│ └──────────┘ └──────────┘ └──────────┘     │
│                                              │
│ ┌──────────────────────────────────────────┐ │
│ │ Query Volume                              │ │
│ │ [line chart - queries per day]           │ │
│ └──────────────────────────────────────────┘ │
│                                              │
│ ┌────────────────┐ ┌───────────────────────┐ │
│ │ Strategy Dist.  │ │ Latency (P50/P95)     │ │
│ │ [pie chart]     │ │ [line chart]          │ │
│ └────────────────┘ └───────────────────────┘ │
│                                              │
│ ┌────────────────┐ ┌───────────────────────┐ │
│ │ Cost/Query     │ │ Confidence Dist.      │ │
│ │ [bar chart]    │ │ [histogram]           │ │
│ └────────────────┘ └───────────────────────┘ │
└──────────────────────────────────────────────┘
```

### API Keys (`/api-keys`)

**Purpose:** Manage API keys for programmatic access

**Layout:**

```
┌──────────────────────────────────────────────┐
│ API Keys                      [+ Create Key] │
│                                              │
│ ┌──────────────────────────────────────────┐ │
│ │ Name          │ Key          │ Created   │ │
│ ├──────────────────────────────────────────┤ │
│ │ Production    │ kai_sk_a1b2 │ 2026-06-01│ │
│ │ Staging       │ kai_sk_c3d4 │ 2026-06-15│ │
│ │ Dev           │ kai_sk_e5f6 │ 2026-06-20│ │
│ └──────────────────────────────────────────┘ │
│                                              │
│ Usage per Key (last 30 days):                │
│ [bar chart]                                  │
└──────────────────────────────────────────────┘
```

### Billing (`/billing/overview`)

**Purpose:** View current plan, usage, and manage billing

**Layout:**

```
┌──────────────────────────────────────────────┐
│ Billing                                       │
│                                              │
│ ┌──────────────────────────────────────────┐ │
│ │ Current Plan: Pro                         │ │
│ │ $199/month  ·  342,500 / 500,000 queries │ │
│ │ [████████████████░░░░░░░] 68%             │ │
│ │                              [Upgrade ▼] │ │
│ └──────────────────────────────────────────┘ │
│                                              │
│ ┌────────────────┐ ┌───────────────────────┐ │
│ │ Invoice History │ │ Payment Method        │ │
│ │ Jun 2026  $199 │ │ ●●●● 4242  Exp 12/27 │ │
│ │ May 2026  $199 │ │ Visa                  │ │
│ │ Apr 2026  $199 │ │            [Edit]     │ │
│ │ [View All]     │ └───────────────────────┘ │
│ └────────────────┘                           │
└──────────────────────────────────────────────┘
```

### Settings (`/settings/profile`)

**Purpose:** Manage account settings

**Layout:**

```
┌──────────────────────────────────────────────┐
│ Settings                    Profile │ Account │
│                              Team │ Notif.  │
│                              Theme │         │
├──────────────────────────────────────────────┤
│                                              │
│ Avatar:   [image]                            │
│ Name:     [John Doe               ]          │
│ Email:    [john@example.com       ]          │
│                                              │
│ [Save Changes]                               │
└──────────────────────────────────────────────┘
```

---

## User Flows

### Flow 1: New User Signup

```
Landing Page → Sign Up → Email Verification → Create First Project
  → Welcome Tour → Execute First Query → See Results → Dashboard
```

### Flow 2: Developer Integration

```
Login → API Keys → Create Key → Copy Key →
  Read Docs → Install SDK → Make API Call →
  Check Usage → Monitor Analytics
```

### Flow 3: Production Deployment

```
Login → Create Project → Upload Documents →
  Configure Settings → Get API Key →
  Deploy to Production → Monitor →
  Upgrade Plan as Needed
```

### Flow 4: Billing Cycle

```
Dashboard → Usage Alert →
  View Billing → Compare Plans →
  Upgrade/Downgrade → New Invoice →
  Payment Confirmation
```

---

## States

Every component must handle:

| State | Behavior |
|-------|----------|
| **Loading** | Skeleton screens, shimmer animations |
| **Empty** | Empty state illustration + CTA |
| **Error** | Error message + retry action |
| **Success** | Success toast, confirmation |
| **Offline** | Offline indicator, cached data |

---

## Responsive Breakpoints

| Breakpoint | Width | Layout |
|------------|-------|--------|
| Mobile | < 640px | Single column, hamburger nav |
| Tablet | 640–1024px | 2-column, collapsible sidebar |
| Desktop | 1024–1440px | Full sidebar + content + optional panel |
| Wide | > 1440px | Max-width container, centered |
