# Kairos — SaaS App UX

> **Document**: Authenticated Application — Complete UX Design  
> **Product**: Kairos — Adaptive Knowledge Intelligence  
> **Status**: LOCKED — Phase 13  
> **Author**: Linear / Stripe Product Design Team

---

## 1. App Shell

### Layout Structure

```
┌──────────────────────────────────────────────────────────────────────┐
│  TOP BAR (56px)                                                      │
│  ┌──────────┬──────────────────────────────────┬──────┬──────────┐  │
│  │ 🍁 Kairos│  Workspace: My Workspace ▼       │ Docs │ [User] ▼ │  │
│  └──────────┴──────────────────────────────────┴──────┴──────────┘  │
│  ─────────────────────────────────────────────────────────────────── │
│  │ SIDEBAR      │  MAIN CONTENT AREA                               │  │
│  │ (240px)      │                                                    │  │
│  │              │  ┌──────────────────────────────────────────────┐ │  │
│  │ ● Dashboard  │  │                                              │ │  │
│  │ ○ Documents  │  │  Page content renders here                   │ │  │
│  │ ○ Queries    │  │                                              │ │  │
│  │ ○ Analytics  │  └──────────────────────────────────────────────┘ │  │
│  │ ○ Settings   │                                                    │  │
│  │              │                                                    │  │
│  │ ─────────── │                                                    │  │
│  │              │                                                    │  │
│  │ Usage        │                                                    │  │
│  │ 2,401 q/mo  │                                                    │  │
│  │ $34.21/mo   │                                                    │  │
│  └──────────────┴────────────────────────────────────────────────────┘  │
│                                                                          │
│  STATUS BAR (32px)                                                       │
│  🍁 Kairos v1.0 · MIT Licensed · Status: All Systems Go · [Docs]        │
└──────────────────────────────────────────────────────────────────────────┘
```

### Top Bar

| Element | Behavior |
|---------|----------|
| Logo | Navigates to /dashboard |
| Workspace selector | Dropdown: switch workspaces, create new, manage |
| Docs link | External link to docs.kairos.dev |
| User menu | Avatar (32px) → dropdown: Profile, API Keys, Sign out |
| Upgrade badge | Orange pill "Upgrade" — visible only on Free tier |

### Sidebar Navigation

| Icon | Label | Badge | Path |
|------|-------|-------|------|
| LayoutDashboard | Dashboard | — | /dashboard |
| FileText | Documents | Processing count | /documents |
| MessageSquare | Queries | — | /queries |
| BarChart3 | Analytics | — | /analytics |
| Settings | Settings | — | /settings |

**Active state**: Orange dot (8px) + `#131A22` bg highlight
**Hover**: `#1A2433` bg

### Sidebar States

| State | Width | Behavior |
|-------|-------|----------|
| Expanded (≥1024px) | 240px | Full labels, icons, usage widget |
| Collapsed (<1024px) | 64px | Icons only, tooltip on hover |
| Mobile (<768px) | Hidden | Hamburger toggle, overlay drawer |

### Status Bar

| Element | Detail |
|---------|--------|
| Left | "🍁 Kairos v1.0 · MIT Licensed" |
| Center | "Status: All Systems Go" — green dot if healthy |
| Right | "Docs" link, "Support" link |

---

## 2. Dashboard (`/dashboard`)

### Layout

```
┌──────────────────────────────────────────────────────────────────────┐
│  Dashboard                                                  [Refresh] │
│                                                                        │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐   │
│  │ Queries  │ │  Avg     │ │  Avg     │ │  Avg     │ │  Docs    │   │
│  │ This Mo  │ │ Recall   │ │ Latency  │ │ Cost/Q   │ │ Indexed  │   │
│  │ 2,401    │ │ 0.89     │ │ 163ms    │ │ $0.014   │ │  47      │   │
│  │ +12.3% ↑ │ │ +2.1% ↑  │ │ -8ms ↓   │ │ -5.3% ↓  │ │  +3 ↑    │   │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘ └──────────┘   │
│                                                                        │
│  ┌─────────────────────────────┐  ┌─────────────────────────────┐    │
│  │  Queries Over Time          │  │  Strategy Breakdown         │    │
│  │  [Line chart, 7d]          │  │  [Donut chart]              │    │
│  │  • 7-day trend line        │  │  • Simple: 45%              │    │
│  │  • Interactive tooltips     │  │  • Complex: 35%             │    │
│  │  • Hover for detail         │  │  • Multi-hop: 18%           │    │
│  │                             │  │  • Fallback: 2%            │    │
│  └─────────────────────────────┘  └─────────────────────────────┘    │
│                                                                        │
│  ┌─────────────────────────────┐  ┌─────────────────────────────┐    │
│  │  Recent Activity            │  │  Quick Actions              │    │
│  │  • 2m ago · Query: "What   │  │  ┌───────────────────────┐  │    │
│  │    are Q4 results?"         │  │  │ 📄 Upload Document   │  │    │
│  │  • 15m ago · Doc uploaded  │  │  └───────────────────────┘  │    │
│  │  • 1h ago · Alert: 95%     │  │  ┌───────────────────────┐  │    │
│  │    query limit reached     │  │  │ 💬 Ask a Question    │  │    │
│  │  └─ View all →              │  │  └───────────────────────┘  │    │
│  └─────────────────────────────┘  └─────────────────────────────┘    │
│                                                                        │
│  ┌────────────────────────────────────────────────────────────────┐  │
│  │  Ask a question about your documents...                 [→]    │  │
│  └────────────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────────┘
```

### KPI Cards

| Card | Data Source | Delta Direction |
|------|-------------|-----------------|
| Queries This Month | `usage_events` count (current month) | Up = good (engagement) |
| Avg Recall | `usage_events.confidence` (30d avg) | Up = good |
| Avg Latency | `usage_events.latency_ms` (30d avg) | Down = good |
| Avg Cost/Query | `usage_events.cost` (30d avg) | Down = good |
| Docs Indexed | `documents` count (total) | Up = good |

**Delta colors**: Up (green `#22C55E`), Down (red `#EF4444`), Flat (`#AAB4C3`)

### Empty State

```
┌──────────────────────────────────────────────────────────────────────┐
│                                                                        │
│                          🍁 (64px)                                    │
│                                                                        │
│                       Welcome to Kairos                                │
│                                                                        │
│            Upload a document to start asking questions.                │
│         Your analytics will appear here once you have data.           │
│                                                                        │
│              ┌──────────────────────────────────┐                     │
│              │  📄 Upload Your First Document   │                     │
│              └──────────────────────────────────┘                     │
│                                                                        │
│              Or try our sample document to see                        │
│                   Kairos in action.                                    │
│              ┌──────────────────────────────────┐                     │
│              │  🚀 Use Sample Document          │                     │
│              └──────────────────────────────────┘                     │
│                                                                        │
└──────────────────────────────────────────────────────────────────────┘
```

---

## 3. Documents (`/documents`)

### Layout

```
┌──────────────────────────────────────────────────────────────────────┐
│  Documents                                           [+ Upload]  🔍  │
│                                                                        │
│  ┌─────┬─────────────────┬───────┬────────┬──────────┬────────────┐  │
│  │     │ Name            │ Pages │ Type   │ Status   │ Date       │  │
│  ├─────┼─────────────────┼───────┼────────┼──────────┼────────────┤  │
│  │ 📄  │ Q4 Report 2025  │  42   │ PDF    │ ✅ Ready │ 2 hours ago│  │
│  │ 📄  │ Compliance Guide│  18   │ PDF    │ ✅ Ready │ 1 day ago  │  │
│  │ 📄  │ Research Paper  │  128  │ PDF    │ ⏳ 78%   │ 5 min ago  │  │
│  │ 📄  │ Meeting Notes   │  —    │ TXT    │ ✅ Ready │ 2 days ago │  │
│  │ 📄  │ Policy Draft    │  8    │ DOCX   │ ❌ Failed│ 1 hour ago │  │
│  └─────┴─────────────────┴───────┴────────┴──────────┴────────────┘  │
│                                                                        │
│  Showing 5 of 47                                        < 1 2 3 ... > │
│                                                                        │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │                                                                  │  │
│  │          Drag & drop files here, or click to browse              │  │
│  │                                                                  │  │
│  │   Supported: PDF, DOCX, TXT, MD, HTML  ·  Max 50MB per file     │  │
│  │                               │                                  │  │
│  │   ┌──────────────────────┐    │    ┌──────────────────────┐     │  │
│  │   │  Select Files        │────┘    │  Upload All          │     │  │
│  │   └──────────────────────┘         └──────────────────────┘     │  │
│  └──────────────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────────┘
```

### Status Indicators

| Status | Visual | Description |
|--------|--------|-------------|
| ✅ Ready | Green badge | Searchable, queryable |
| ⏳ Processing | Yellow badge with % | Show progress: "Extracting... Chunking... Embedding" |
| ❌ Failed | Red badge | Show error on hover, retry button |
| 🗑 Deleted | Grayed out | With undo option (5s timer) |

### Row Actions

| Action | Icon | Behavior |
|--------|------|----------|
| Preview | Eye | Sidebar/panel with PDF viewer or text content |
| Rename | Edit | Inline text edit |
| Delete | Trash | Confirmation modal, soft delete (30 day recovery) |
| Download | Download | Downloads original file |

### Upload Modal

```
┌────────────────────────────────────────────────────────────────┐
│  Upload Documents                                   [X Close]   │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │                                                          │  │
│  │                  Drag & drop files here                  │  │
│  │                  or click to browse                      │  │
│  │                                                          │  │
│  │     Supported: PDF, DOCX, TXT, MD, HTML, MP3, WAV, M4A  │  │
│  │     Max 50MB per file                                    │  │
│  │                                                          │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                  │
│  ┌─────┬──────────────┬──────────┬──────────────┐               │
│  │     │ File         │ Size     │ Status       │               │
│  ├─────┼──────────────┼──────────┼──────────────┤               │
│  │ 📄  │ report.pdf   │ 2.4 MB   │ ✅ Queued    │               │
│  │ 📄  │ policy.pdf   │ 1.1 MB   │ ⏳ 45%       │               │
│  │ 📄  │ notes.txt    │ 0.1 MB   │ ⏳ 12%       │               │
│  └─────┴──────────────┴──────────┴──────────────┘               │
│                                                                  │
│  ┌──────────────────────────────────────┐                       │
│  │  Upload 3 files                      │                       │
│  └──────────────────────────────────────┘                       │
└────────────────────────────────────────────────────────────────┘
```

---

## 4. Queries (`/queries`)

### Layout

```
┌──────────────────────────────────────────────────────────────────────┐
│  Queries                                                             │
│                                                                      │
│  ┌─────────────┐  ┌────────────────────────────────────────────────┐│
│  │  History    │  │                                                ││
│  │             │  │  ┌──────────────────────────────────────────┐  ││
│  │  Today      │  │  │  ⚡ Simple Strategy                     │  ││
│  │  • 2:30 PM  │  │  │  Confidence: 96%  ·  Latency: 142ms     │  ││
│  │    Q4       │  │  │  Cost: $0.002                           │  ││
│  │  • 2:15 PM  │  │  │                                          │  ││
│  │    Policy   │  │  │  According to the Q4 2025 Financial      │  ││
│  │             │  │  │  Report, total revenue grew 18% year-    │  ││
│  │  Yesterday  │  │  │  over-year reaching $12.4M...            │  ││
│  │  • 4:00 PM  │  │  │                                          │  ││
│  │    Meeting  │  │  │  ┌─────────────────────────────────┐     │  ││
│  │  • 11:20 AM │  │  │  │ Sources:                       │     │  ││
│  │    Budget   │  │  │  │ 📄 Q4_2025_Report.pdf  → pg 12 │     │  ││
│  │  • 9:00 AM  │  │  │  │ 📄 Q4_2025_Report.pdf  → pg 14 │     │  ││
│  │    Roadmap  │  │  │  └─────────────────────────────────┘     │  ││
│  │             │  │  │                                          │  ││
│  │  This Week  │  │  │  [👍 Helpful]  [👎 Not Helpful]         │  ││
│  │  • Dec 10   │  │  └──────────────────────────────────────────┘  ││
│  │    Compli-  │  │                                                ││
│  │    ance     │  │  ┌──────────────────────────────────────────┐  ││
│  │  • Dec 9    │  │  │  🔄 Multi-Hop Strategy (3 hops)         │  ││
│  │    Research │  │  │  Confidence: 88%  ·  Latency: 1.2s      │  ││
│  │             │  │  │  Cost: $0.021                           │  ││
│  └─────────────┘  │  │                                          │  ││
│                   │  │  To compare Q1 and Q3 revenue...         │  ││
│                   │  └──────────────────────────────────────────┘  ││
│                   │                                                ││
│                   │  ┌──────────────────────────────────────────┐  ││
│                   │  │  Ask a follow-up question...       [→]  │  ││
│                   │  └──────────────────────────────────────────┘  ││
│                   └────────────────────────────────────────────────┘│
└──────────────────────────────────────────────────────────────────────┘
```

### Answer Card

| Section | Content |
|---------|---------|
| **Strategy badge** | Colored pill: ⚡ Simple (green), 🔍 Complex (blue), 🔄 Multi-Hop (purple) |
| **Metric line** | Confidence, Latency, Cost — all in JetBrains Mono |
| **Answer text** | Inter 400, `text-base`, 1.6 line height |
| **Sources** | Collapsible section, document name + page number, click to preview |
| **Feedback** | Thumbs up/down buttons with animation |

### Query Bar

| State | Visual |
|-------|--------|
| Empty | "Ask a question about your documents..." placeholder |
| Typing | Clear icon appears on right |
| Loading | Strategy name + spinner in input, "Analyzing query..." |
| Error | Red border, "Something went wrong. Try again." |

### Conversation Threading

- Follow-up questions maintain context from previous answer
- Thread appears as a conversation (user messages right-aligned, AI messages left)
- "New thread" button resets context
- Thread has title (auto-generated from first query)

---

## 5. Analytics (`/analytics`)

### Layout

```
┌──────────────────────────────────────────────────────────────────────┐
│  Analytics                                              Jul 1–Aug 1 ▼│
│                                                                        │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐   │
│  │ Queries  │ │ Avg Rec  │ │ Avg Lat  │ │ Avg Cost │ │ Success  │   │
│  │ 12,401   │ │  0.91    │ │  163ms   │ │ $0.014   │ │  98.2%   │   │
│  │ +8.2% ↑  │ │ +1.2% ↑  │ │ -5ms ↓   │ │ -3.1% ↓  │ │ +0.4% ↑  │   │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘ └──────────┘   │
│                                                                        │
│  ┌───────────────────────────────────┐  ┌──────────────────────────┐  │
│  │  Queries Over Time               │  │  Strategy Breakdown      │  │
│  │  [Area chart with gradient]      │  │  [Donut chart]           │  │
│  │  • Daily query volume            │  │  • Simple: 42%           │  │
│  │  • 30-day trend                  │  │  • Complex: 36%          │  │
│  │  • Compare previous period       │  │  • Multi-hop: 20%        │  │
│  │                                  │  │  • Fallback: 2%          │  │
│  └───────────────────────────────────┘  └──────────────────────────┘  │
│                                                                        │
│  ┌───────────────────────────────────┐  ┌──────────────────────────┐  │
│  │  Latency Trends                  │  │  Cost Analysis           │  │
│  │  [Line chart: p50, p95, p99]    │  │  [Stacked bar by         │  │
│  │  • Interactive legend            │  │   strategy]              │  │
│  │  • Hover for exact ms           │  │  • Cost breakdown         │  │
│  │                                  │  │  • Day/week/month view   │  │
│  └───────────────────────────────────┘  └──────────────────────────┘  │
│                                                                        │
│  ┌────────────────────────────────────────────────────────────────┐  │
│  │  Recent Queries                                              ▼│  │
│  │  ┌─────┬──────────────────┬──────────┬────────┬────────┬────┐ │  │
│  │  │     │ Query            │ Strategy │ Conf   │ Latency│Cost│ │  │
│  │  ├─────┼──────────────────┼──────────┼────────┼────────┼────┤ │  │
│  │  │     │ "What are Q4..." │ Simple   │ 96%    │ 142ms  │$002│ │  │
│  │  │     │ "Compare Q1..."  │ MultiHop │ 88%    │ 1.2s   │$021│ │  │
│  │  └─────┴──────────────────┴──────────┴────────┴────────┴────┘ │  │
│  │                                                                  │  │
│  │  [Export CSV] [Schedule Report]                                  │  │
│  └────────────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────────┘
```

---

## 6. Billing & Settings (`/settings`)

### Settings Layout

```
┌──────────────────────────────────────────────────────────────────────┐
│  Settings                                                             │
│                                                                      │
│  ┌──────────────┬──────────────────────────────────────────────────┐ │
│  │  General     │  ┌──────────────────────────────────────────┐   │ │
│  │  API Keys    │  │  Workspace Name                          │   │ │
│  │  Team        │  │  ┌──────────────────────────────────┐    │   │ │
│  │  Billing     │  │  │  My Workspace                    │    │   │ │
│  │  Integrations│  │  └──────────────────────────────────┘    │   │ │
│  │              │  │                                          │   │ │
│  │              │  │  Your Profile                            │   │ │
│  │              │  │  ┌──────────────────────────────────┐    │   │ │
│  │              │  │  │  anubhav@example.com             │    │   │ │
│  │              │  │  └──────────────────────────────────┘    │   │ │
│  │              │  │                                          │   │ │
│  │              │  │  [Save Changes]                          │   │ │
│  │              │  └──────────────────────────────────────────┘   │ │
│  └──────────────┴──────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────────────┘
```

### API Keys Tab

```
┌──────────────────────────────────────────────────────────────────────┐
│  API Keys                                                [+ Create]  │
│                                                                      │
│  ┌────────────────────────┬──────────┬────────────┬────────────┐    │
│  │ Key Name               │ Prefix   │ Created    │ Last Used  │    │
│  ├────────────────────────┼──────────┼────────────┼────────────┤    │
│  │ Production             │ kai-prod │ Jan 15     │ 2 min ago  │    │
│  │ Development            │ kai-dev  │ Feb 1      │ 1 hour ago │    │
│  │ CI/CD Pipeline         │ kai-ci   │ Mar 10     │ —          │    │
│  └────────────────────────┴──────────┴────────────┴────────────┘    │
│                                                                      │
│  Row actions: Copy, Edit name, Revoke (with confirmation)            │
│                                                                      │
│  Create modal: Name input → Generate → Show key once → Copy button  │
└──────────────────────────────────────────────────────────────────────┘
```

### Billing Tab

```
┌──────────────────────────────────────────────────────────────────────┐
│  Billing & Plan                                                      │
│                                                                      │
│  Current Plan: Team — $199/month                                     │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │  ● 2,401 / 100,000 queries used this month                   │   │
│  │  ████████░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░  2.4%              │   │
│  │  ● 47 / 10,000 documents indexed                              │   │
│  └──────────────────────────────────────────────────────────────┘   │
│                                                                      │
│  [Change Plan] [View Invoices] [Update Payment Method]               │
│                                                                      │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │  Invoice History                                               │   │
│  │  • Mar 1, 2026 — $199.00 — Paid                               │   │
│  │  • Feb 1, 2026 — $199.00 — Paid                               │   │
│  │  • Jan 1, 2026 — $29.00 — Paid (Developer → Team upgrade)    │   │
│  └──────────────────────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────────────────────┘
```

### Team Tab

```
┌──────────────────────────────────────────────────────────────────────┐
│  Team Members                                            [+ Invite]  │
│                                                                      │
│  ┌──────────────────────────────┬──────────┬───────────┬──────────┐  │
│  │ Name                         │ Email    │ Role      │ Joined   │  │
│  ├──────────────────────────────┼──────────┼───────────┼──────────┤  │
│  │ Anubhav (you)               │ ---      │ Admin     │ ---      │  │
│  │ Priya Sharma                 │ priya@   │ Member    │ 2w ago   │  │
│  │ Raj Patel                    │ raj@     │ Member    │ 1w ago   │  │
│  └──────────────────────────────┴──────────┴───────────┴──────────┘  │
│                                                                      │
│  Invite Modal: Email input → Select role (Admin/Member) → Send      │
│  Pending invites shown below with "Resend" and "Cancel" actions      │
└──────────────────────────────────────────────────────────────────────┘
```

---

## 7. Interaction Patterns

### Query Flow

```
User types question → [Send]
   │
   ├── Gateway validates API key / session
   ├── Rate limit check
   ├── Usage quota check
   │
   ├── Request sent to Intelligence Engine
   │   ├── QueryClassifier runs (50–100ms)
   │   ├── RetrievalPlanner selects strategy (10–50ms)
   │   ├── Selected retriever executes
   │   │   ├── Simple: Hybrid search → response
   │   │   ├── Complex: MMR + HyDE → rerank → response
   │   │   └── Multi-hop: Iterative 3-hop → confluence → response
   │   ├── ConfidenceCalibrator scores (5ms)
   │   └── ResponseAssembler formats answer
   │
   ├── UsageEvent recorded (async)
   ├── Response returned to UI
   │
   └── UI renders: strategy badge, answer, sources, metrics
```

### Upload Flow

```
User drops file(s) on upload zone
   │
   ├── Client-side validation
   │   ├── File type check (PDF/TXT/MD/DOCX only)
   │   ├── File size check (<50MB)
   │   └── Duplicate check (by filename hash)
   │
   ├── Upload to Cloudflare R2 (presigned URL)
   │   ├── Progress bar updates per file
   │   └── Retry on failure (3 attempts)
   │
   ├── Ingestion pipeline triggered
   │   ├── Text extraction (PyMuPDF for PDF)
   │   ├── Chunking (recursive, 512 token chunks)
   │   ├── Embedding (via configured embedder)
   │   └── Index to ChromaDB
   │
   └── Document status: queued → processing → ready / failed
```

### Empty → First Value Flow

```
Sign up → Dashboard (empty state)
   │
   ├── "Welcome to Kairos" with two CTAs:
   │   ├── "Upload Your First Document" → /documents (with upload modal open)
   │   └── "Use Sample Document" → Uploads sample, redirects to /queries
   │
   ├── Upload first doc → processing animation → ready notification
   │
   ├── Navigate to /queries → ask first question
   │   ├── Strategy badge animation
   │   ├── Answer streams in (or appears on completion)
   │   └── Sources expandable
   │
   └── Dashboard now shows: 1 query, 1 doc, strategy breakdown (100% one strategy)
```

---

## 8. Error & Edge Case Handlers

| Scenario | UX |
|----------|-----|
| **Upload fails** | Red status badge, retry button, error message on hover |
| **Query times out** | "This query is taking longer than expected. Try rephrasing." + retry |
| **Low confidence answer** | Yellow banner: "I'm not very confident about this answer. Consider uploading more relevant documents." |
| **Rate limited** | "You've exceeded the rate limit. Please wait X seconds." + countdown |
| **Plan limit reached** | Modal: "You've used 100% of your monthly queries. Upgrade to continue." |
| **Network error** | Toast: "Connection lost. Retrying..." with auto-retry (3 attempts) |
| **Empty search results** | "No documents found. Try uploading a document first." + upload CTA |
| **Document processing fails** | Red badge with error message, "Delete and retry" action |
| **Session expired** | Redirect to login with toast: "Your session expired. Please log in again." |
| **500 Server error** | "Something went wrong. Our team has been notified." + support link |

---

> *End of SaaS App UX*  
> *Next: Marketing Copy → docs/MARKETING_COPY.md*  
> *Brand: Orange Leaf Logo — LOCKED*
