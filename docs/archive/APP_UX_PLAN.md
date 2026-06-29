# Kairos — App UX Plan

> **Document**: Authenticated Application UX Specification  
> **Product**: Kairos — Adaptive Knowledge Intelligence  
> **Brand**: Orange Leaf Logo | Charcoal `#0B0F14` | Orange `#FF5A0A`  
> **Status**: LOCKED — Phase 11A

---

## 1. Application Overview

### Product Name
**Kairos** — Adaptive Knowledge Intelligence

### Tagline
"Smarter retrieval. Better answers. Lower cost."

### App URL
`app.kairos.dev`

### Technology
- **Framework**: Next.js 14+ (App Router)
- **Styling**: Tailwind CSS + custom design tokens
- **Components**: shadcn/ui (Radix primitives)
- **Charts**: Recharts
- **State**: React Query (server) + Zustand (client)
- **Auth**: Auth0 / Clerk
- **API Client**: tRPC or custom fetch with Zod validation

---

## 2. App Layout

### Shell Layout

```
┌────────────────────────────────────────────────────────────────┐
│  🍁 Kairos          Workspace ▼    Docs    [User] ▼           │
│  ─────────────────────────────────────────────────────────────  │
│  │                         │                                    │
│  │  Dashboard              │                                    │
│  │  Documents              │   Main Content Area                │
│  │  Collections            │                                    │
│  │  Queries                │                                    │
│  │  Analytics              │                                    │
│  │  Settings               │                                    │
│  │                         │                                    │
│  │  ─────────────────      │                                    │
│  │  Usage This Month       │                                    │
│  │  2,401 queries          │                                    │
│  │  $34.21 spent           │                                    │
│  │                         │                                    │
│  └─────────────────────────┴────────────────────────────────────┘
│                                                                  │
│  Footer: 🍁 Kairos v1.0 · MIT Licensed · Status: All Systems Go │
└────────────────────────────────────────────────────────────────┘
```

### Navigation (Sidebar)

| Element | Type | Behavior |
|---------|------|----------|
| 🍁 Kairos | Logo + brand | Collapsed: just logo; expanded: logo + wordmark |
| Dashboard | Nav item | Active: orange highlight |
| Documents | Nav item | Active + badge (count of processing docs) |
| Collections | Nav item | Active |
| Queries | Nav item | Active |
| Analytics | Nav item | Active |
| Settings | Nav item | Bottom section, separated by divider |
| Usage widget | Info card | Shows monthly usage, always visible at bottom |

### Sidebar States

- **Expanded** (default, > 1024px): Full labels, icons, usage widget visible
- **Collapsed** (< 1024px or user toggle): Icons only, tooltip on hover
- **Mobile** (< 768px): Hidden sidebar, hamburger toggle, overlay drawer

### Top Bar

| Element | Position | Behavior |
|---------|----------|----------|
| Workspace selector | Left | Dropdown to switch workspaces |
| "Upgrade" button | Right | Only shown on Free tier, orange badge |
| Docs link | Right | External link to docs |
| User avatar | Right | Dropdown: Profile, Settings, Sign out |

---

## 3. Page Specifications

### PAGE 1: Dashboard

**URL**: `/dashboard`

**Purpose**: Overview of workspace activity and health

**Layout**:

```
┌────────────────────────────────────────────────────────────────┐
│  Dashboard                                                     │
│                                                                │
│  ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐      │
│  │  Queries│ │  Avg   │ │  Avg   │ │  Avg   │ │  Docs  │      │
│  │  This   │ │ Recall │ │Latency │ │Cost/Q  │ │ Indexed│      │
│  │  Month  │ │        │ │        │ │        │ │        │      │
│  │  2,401  │ │ 0.89   │ │ 163ms  │ │ $0.014 │ │  47    │      │
│  │  +12.3% │ │ +2.1%  │ │ -8ms   │ │ -5.3%  │ │  +3    │      │
│  └────────┘ └────────┘ └────────┘ └────────┘ └────────┘      │
│                                                                │
│  ┌────────────────────────┐  ┌────────────────────────┐        │
│  │  Queries Over Time     │  │  Strategy Breakdown    │        │
│  │  [line chart, 7d]      │  │  [donut chart]         │        │
│  └────────────────────────┘  └────────────────────────┘        │
│                                                                │
│  ┌────────────────────────┐  ┌────────────────────────┐        │
│  │  Recent Activity       │  │  Quick Actions         │        │
│  │  ┌──────────────────┐  │  │  ┌──────────────────┐ │        │
│  │  │ 2m ago · Query   │  │  │  │ 📄 Upload Doc   │ │        │
│  │  │ 15m ago · Doc    │  │  │  │ 💬 Ask Question │ │        │
│  │  │ 1h ago · Alert   │  │  │  │ 📊 View Analytics│ │        │
│  │  └──────────────────┘  │  │  └──────────────────┘ │        │
│  └────────────────────────┘  └────────────────────────┘        │
│                                                                │
│  Ask a question...                                       [→]  │
│  [Full-width query bar at bottom of dashboard]                  │
└────────────────────────────────────────────────────────────────┘
```

**Components**:
- **KPI Row**: 5 metric cards (queries, recall, latency, cost, docs indexed)
- **Queries Over Time**: Line chart, last 7 days by default, interactive (hover tooltips)
- **Strategy Breakdown**: Donut chart showing distribution (Simple/Complex/Multi-Hop/Fallback)
- **Recent Activity**: Timestamped feed of last 20 events
- **Quick Actions**: 3 contextual action cards
- **Quick Query Bar**: Always-visible text input at the bottom

**States**:
- **Loading**: Skeleton cards, shimmer animation
- **Empty (first visit)**: "Welcome to Kairos! Upload your first document to get started." with upload CTA
- **Error**: Red inline error with retry button
- **Populated**: Normal state with data

**Empty State Detail**:
```
┌────────────────────────────────────────────────────────────────┐
│                  🍁                                             │
│                                                                │
│              Welcome to Kairos                                 │
│                                                                │
│     Upload a document to start asking questions.               │
│     Your analytics will appear here once you have data.        │
│                                                                │
│     ┌──────────────────────────────┐                           │
│     │  📄 Upload Your First Doc   │                           │
│     └──────────────────────────────┘                           │
│                                                                │
│     Or try our sample document to see Kairos in action.        │
│     ┌──────────────────────────────┐                           │
│     │  🚀 Use Sample Document     │                           │
│     └──────────────────────────────┘                           │
└────────────────────────────────────────────────────────────────┘
```

---

### PAGE 2: Documents

**URL**: `/documents`

**Purpose**: Manage uploaded documents, track ingestion status

**Layout**:

```
┌────────────────────────────────────────────────────────────────┐
│  Documents                          [+ Upload]  [🔍 Search]   │
│                                                                │
│  ┌────┬──────────────┬──────┬───────────┬────────┬────────┐   │
│  │    │ Name         │ Pages│ Type      │ Status │ Date   │   │
│  ├────┼──────────────┼──────┼───────────┼────────┼────────┤   │
│  │ 📄 │ Q1 Report    │  24  │ PDF       │ ✅     │ 2h ago │   │
│  │ 📄 │ Policy Doc   │  12  │ PDF       │ ✅     │ 1d ago │   │
│  │ 📄 │ Research.pdf │  48  │ PDF       │ ⏳ 78% │ 5m ago │   │
│  │ 📄 │ Notes.txt    │  —   │ TXT       │ ✅     │ 2d ago │   │
│  │ 📄 │ Meeting.mp3  │  —   │ Audio     │ ❌     │ 1h ago │   │
│  └────┴──────────────┴──────┴───────────┴────────┴────────┘   │
│                                                                │
│  Showing 5 of 47 documents                              [1][2]│
│                                                                │
│  ┌────────────────────────────────────────────────────────┐   │
│  │  Drag & drop files here, or click to browse             │   │
│  │  Supported: PDF, DOCX, TXT, MD, HTML, MP3, WAV, M4A   │   │
│  │  Max 50MB per file. Max 10 files at once.              │   │
│  └────────────────────────────────────────────────────────┘   │
└────────────────────────────────────────────────────────────────┘
```

**Features**:
- **Upload zone**: Drag-and-drop or click to browse. Progress bars for concurrent uploads.
- **File list**: Sortable columns (name, pages, type, status, date). Search/filter.
- **Status indicators**:
  - ✅ Ready: Searchable, ready for queries
  - ⏳ Processing: Progress bar showing stage (Extracting → Chunking → Embedding)
  - ❌ Failed: Red badge, hover for error message, retry button
  - 🗑 Deleted: Grayed out with restore option
- **Row actions**: Preview, rename, move to collection, delete
- **File preview**: Click to open preview panel (sidebar or modal)
  - PDF: Embedded PDF viewer
  - Text: Syntax-highlighted content
  - Audio: Waveform visualization + transcription
- **Batch operations**: Select multiple → add to collection, delete, download

**Upload Modal**:
```
┌────────────────────────────────────────────────────────────┐
│  Upload Documents                           [X Close]       │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐   │
│  │                                                      │   │
│  │        Drag & drop files here                        │   │
│  │        or click to browse                            │   │
│  │                                                      │   │
│  │        Supported: PDF, DOCX, TXT, MD, HTML           │   │
│  │        Audio: MP3, WAV, M4A                          │   │
│  │        Max 50MB per file                             │   │
│  │                                                      │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                              │
│  ┌───┬────────────┬──────────┬───────────┐                  │
│  │   │ File       │ Size     │ Status    │                  │
│  ├───┼────────────┼──────────┼───────────┤                  │
│  │ 📄│ report.pdf │ 2.4 MB   │ ✅ Queued │                  │
│  │ 📄│ policy.pdf │ 1.1 MB   │ ⏳ 45%    │                  │
│  └───┴────────────┴──────────┴───────────┘                  │
│                                                              │
│  ┌──────────────────────────────┐                           │
│  │  Upload 2 files              │                           │
│  └──────────────────────────────┘                           │
└────────────────────────────────────────────────────────────┘
```

---

### PAGE 3: Collections

**URL**: `/collections`

**Purpose**: Group documents into knowledge bases for focused queries

**Layout**:

```
┌────────────────────────────────────────────────────────────────┐
│  Collections                                 [+ New Collection] │
│                                                                │
│  ┌────────────────────┐  ┌────────────────────┐                │
│  │  📁 Legal Docs     │  │  📁 Engineering    │                │
│  │  12 documents      │  │  8 documents       │                │
│  │  892 queries       │  │  415 queries       │                │
│  │  Last queried: 2h  │  │  Last queried: 1d  │                │
│  │  [Open] [Delete]   │  │  [Open] [Delete]   │                │
│  └────────────────────┘  └────────────────────┘                │
│                                                                │
│  ┌────────────────────┐  ┌────────────────────┐                │
│  │  📁 HR Policies   │  │  📁 Product Specs  │                │
│  │  5 documents       │  │  22 documents      │                │
│  │  201 queries       │  │  893 queries       │                │
│  │  Last queried: 3d  │  │  Last queried: 5m  │                │
│  │  [Open] [Delete]   │  │  [Open] [Delete]   │                │
│  └────────────────────┘  └────────────────────┘                │
└────────────────────────────────────────────────────────────────┘
```

**Collection Detail View** (click a collection):

```
┌────────────────────────────────────────────────────────────────┐
│  📁 Legal Docs              [Edit Name] [Add Documents] [Delete]│
│                                                                │
│  Documents (12)                                                 │
│  ┌────┬──────────────┬────────┬────────┐                      │
│  │    │ Name         │ Pages  │ Added  │                      │
│  ├────┼──────────────┼────────┼────────┤                      │
│  │ 📄 │ Contract.pdf │  42    │ 1w ago │                      │
│  │ 📄 │ Policy.docx  │  18    │ 2w ago │                      │
│  └────┴──────────────┴────────┴────────┘                      │
│                                                                │
│  Collection Stats                                               │
│  ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐                  │
│  │  892   │ │  0.91  │ │  142ms │ │  47    │                  │
│  │ Queries│ │Avg Rec │ │Avg Lat │ │Sources │                  │
│  └────────┘ └────────┘ └────────┘ └────────┘                  │
└────────────────────────────────────────────────────────────────┘
```

---

### PAGE 4: Queries

**URL**: `/queries`

**Purpose**: Ask questions, view answers, browse conversation history

**Layout — Primary View**:

```
┌────────────────────────────────────────────────────────────────┐
│  Queries                         [Collection: All ▼] [🔍]     │
│                                                                │
│  ┌──────────────┐  ┌────────────────────────────────────────┐ │
│  │  History      │  │                                        │ │
│  │               │  │  Answer Area                           │ │
│  │  Today        │  │                                        │ │
│  │  ├ What is...│  │  According to the documents, Kairos's  │ │
│  │  ├ Compare... │  │  adaptive retrieval engine achieves    │ │
│  │  └ How does.. │  │  23.6% higher recall than standard     │ │
│  │               │  │  Naive RAG approaches...               │ │
│  │  Yesterday    │  │                                        │ │
│  │  ├ Show me... │  │  ─────────────────────────────────    │ │
│  │  ├ List all.. │  │  Sources:                              │ │
│  │  └ When was.. │  │  [1] benchmark_report.pdf (p.12)      │ │
│  │               │  │  [2] architecture_overview.md (p.3)   │ │
│  │  This Week    │  │                                        │ │
│  │  ├ Define...   │  │  ─────────────────────────────────    │ │
│  │  └ Explain... │  │  Strategy: 🟠 Multi-Hop · Conf: 0.94  │ │
│  │               │  │  Latency: 1.2s · Cost: $0.021         │ │
│  │               │  │                                        │ │
│  │               │  │  👍 Helpful   👎 Not   📋 Copy  🔗 Share│
│  │               │  └────────────────────────────────────────┘ │
│  │               │                                             │
│  │               │  ┌────────────────────────────────────────┐ │
│  │               │  │  Ask a question...              [→]    │ │
│  │               │  └────────────────────────────────────────┘ │
│  └──────────────┘                                             │
└────────────────────────────────────────────────────────────────┘
```

**Layout — Focused View (no sidebar)**:

```
┌────────────────────────────────────────────────────────────────┐
│  🍁 Kairos                                        [User ▼]    │
│                                                                │
│  ┌────────────────────────────────────────────────────────┐   │
│  │  Ask a question about your documents...          [→]    │   │
│  └────────────────────────────────────────────────────────┘   │
│                                                                │
│  [Answer area — full width, centered, max-width 720px]        │
│                                                                │
│  ┌────────────────────────────────────────────────────┐       │
│  │  Answer... sources... strategy... feedback...       │       │
│  └────────────────────────────────────────────────────┘       │
│                                                                │
│  Suggested questions:                                          │
│  ┌──────────────────────┐ ┌──────────────────────┐            │
│  │ What is our refund   │ │ Compare Q1 and Q3    │            │
│  │ policy?              │ │ revenue across regions│            │
│  └──────────────────────┘ └──────────────────────┘            │
│  ┌──────────────────────┐ ┌──────────────────────┐            │
│  │ List all compliance  │ │ When was the last    │            │
│  │ requirements         │ │ security audit?      │            │
│  └──────────────────────┘ └──────────────────────┘            │
└────────────────────────────────────────────────────────────────┘
```

**Query States**:

| State | UI |
|-------|----|
| **Idle** | Query bar with placeholder text, suggested questions below |
| **Classifying** | Badge: "🔍 Classifying query..." (200ms–1s) |
| **Retrieving** | Badge: "📡 Retrieving with [Strategy]..." with strategy name + spinner |
| **Generating** | Badge: "🧠 Generating answer..." (typing animation) |
| **Complete** | Full answer card with sources, strategy badge, confidence, latency, cost |
| **Error** | Red card: "Failed to generate answer. [reason]" with retry button |
| **Low Confidence** | Warning banner: "Low confidence (0.52). Answers may be unreliable." |

**Answer Card Components**:

1. **Answer text** — Markdown-rendered with inline citations
2. **Sources panel** — Numbered list of source documents with page/chunk references
3. **Strategy badge** — Color-coded pill:
   - 🟢 Simple (green)
   - 🔵 Complex (blue)
   - 🟠 Multi-Hop (orange)
   - ⚪ Fallback (gray)
4. **Confidence bar** — Horizontal progress bar (0–1)
5. **Metrics row** — Latency, cost, tokens used
6. **Feedback buttons** — Thumbs up / down with optional text input
7. **Actions** — Copy, share, export

---

### PAGE 5: Analytics

**URL**: `/analytics`

**Purpose**: Usage metrics, performance trends, cost analysis

**Layout**:

```
┌────────────────────────────────────────────────────────────────┐
│  Analytics                        Period: Last 30 Days ▼ [Export] │
│                                                                │
│  ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐      │
│  │  Queries│ │ Avg    │ │ Avg    │ │ Avg    │ │ Success│      │
│  │         │ │ Recall │ │ Latency│ │ Cost/Q │ │ Rate   │      │
│  │  2,401  │ │ 0.89   │ │ 163ms  │ │ $0.014 │ │ 96.8%  │      │
│  │  +12.3% │ │ +2.1%  │ │ -8ms   │ │ -5.3%  │ │ +0.5%  │      │
│  └────────┘ └────────┘ └────────┘ └────────┘ └────────┘      │
│                                                                │
│  ┌────────────────────────────────┐  ┌──────────────────────┐ │
│  │  Queries Over Time             │  │  Strategy Breakdown  │ │
│  │  [area chart, interactive]     │  │  [donut chart]       │ │
│  └────────────────────────────────┘  └──────────────────────┘ │
│                                                                │
│  ┌────────────────────────────────┐  ┌──────────────────────┐ │
│  │  Latency Trend                 │  │  Cost Analysis       │ │
│  │  [line chart, p50/p95/p99]    │  │  [stacked bar chart]  │ │
│  └────────────────────────────────┘  └──────────────────────┘ │
│                                                                │
│  ┌────────────────────────────────────────────────────────┐   │
│  │  Recent Queries                                        │   │
│  │  ┌──────┬──────────────────────┬──────────┬──────┬────┐│   │
│  │  │ Time │ Query                │ Strategy │ Conf │Cost││   │
│  │  ├──────┼──────────────────────┼──────────┼──────┼────┤│   │
│  │  │ 09:42│ What is refund?      │ Simple   │ 0.97 │$0.0││   │
│  │  │ 09:15│ Compare Q1/Q3 rev    │ MultiHop │ 0.89 │$0.02││   │
│  │  └──────┴──────────────────────┴──────────┴──────┴────┘│   │
│  └────────────────────────────────────────────────────────┘   │
└────────────────────────────────────────────────────────────────┘
```

**Charts**:
1. **Queries Over Time**: Area chart, interactive date range, compare periods
2. **Strategy Breakdown**: Donut chart with legend, click to filter
3. **Latency Trend**: Multi-line chart (p50, p95, p99) with thresholds
4. **Cost Analysis**: Stacked bar (embedding + LLM + storage per day)

**Interactions**:
- Date range picker: 7d, 30d, 90d, custom
- Chart hover: Tooltip with exact values
- Chart click: Drill-down to filtered query list
- Export: CSV download, PDF report generation

---

### PAGE 6: Settings

**URL**: `/settings`

**Purpose**: Account management, API keys, billing, team, integrations

**Tab Layout**:

```
┌────────────────────────────────────────────────────────────────┐
│  Settings                                                       │
│                                                                │
│  [General] [API Keys] [Team] [Billing] [Integrations]          │
│                                                                │
│  ──── TAB: API KEYS ───────────────────────────────────────    │
│                                                                │
│  API Keys allow you to access Kairos programmatically.         │
│                                                                │
│  ┌────────────┬──────────────────────┬────────────────────┐    │
│  │ Name       │ Key                  │ Created    │ Actions│    │
│  ├────────────┼──────────────────────┼────────────┼────────┤    │
│  │ Production │ sk_live_abc123...def │ Jan 1, 2026│ [Copy] │    │
│  │            │                      │            │ [Revoke]│    │
│  │ Development│ sk_test_def456...ghi │ Mar 15, '26│ [Copy] │    │
│  │            │                      │            │ [Revoke]│    │
│  └────────────┴──────────────────────┴────────────┴────────┘    │
│                                                                │
│  [+ Generate New Key]                                          │
│                                                                │
│  ──── TAB: TEAM ────────────────────────────────────────────    │
│                                                                │
│  ┌────────────┬──────────┬──────────────┬────────────┐        │
│  │ Name       │ Email    │ Role         │ Joined     │        │
│  ├────────────┼──────────┼──────────────┼────────────┤        │
│  │ You        │ you@...  │ Admin        │ Jan 1, 2026│        │
│  │ Alice      │ alice@...│ Member       │ Feb 3, 2026│ [Remove]│
│  │ Bob        │ bob@...  │ Viewer       │ Mar 10, '26│ [Remove]│
│  └────────────┴──────────┴──────────────┴────────────┘        │
│                                                                │
│  [Invite Members]                                              │
│                                                                │
│  ──── TAB: BILLING ────────────────────────────────────────    │
│                                                                │
│  Current Plan: Developer ($29/mo)    [Change Plan]             │
│                                                                │
│  ┌──────────────┬──────────┬──────────────────┐               │
│  │ Period       │ Amount   │ Status           │               │
│  ├──────────────┼──────────┼──────────────────┤               │
│  │ Jun 1-30     │ $29.00   │ ✅ Paid          │               │
│  │ May 1-31     │ $29.00   │ ✅ Paid          │               │
│  └──────────────┴──────────┴──────────────────┘               │
│                                                                │
│  Payment Method: Visa ending in 4242    [Update]              │
└────────────────────────────────────────────────────────────────┘
```

---

## 4. Interaction Patterns

### Pattern 1: Query Flow

```
1. User clicks query bar or types "/"
2. Query bar focuses, expands slightly, shows placeholder
3. User types question (debounced suggestions optional)
4. User presses Enter or clicks send button
5. Query bar shows sending state (button becomes spinner)
6. Answer area shows streaming state:
   a. "🔍 Classifying query..." (badge)
   b. "📡 Retrieving with Multi-Hop..." (badge + strategy name)
   c. "🧠 Generating answer..." (typing dots animation)
7. Answer appears with fade-in animation
8. Sources panel loads with staggered appearance
9. Strategy badge, confidence, latency, cost appear in metrics bar
10. Feedback buttons appear after 2s delay
```

### Pattern 2: Document Upload Flow

```
1. User clicks "Upload" button or drags file onto zone
2. File appears in list with "Queued" status
3. Upload progress bar fills (0–100%)
4. Status changes to "Processing" with stage indicator:
   - Extracting text (PDF parsing)
   - Chunking (semantic split)
   - Embedding (vector generation)
5. Status changes to "Ready" with green checkmark
6. Notification toast appears: "✅ report.pdf is ready for queries"
```

### Pattern 3: Empty → First Value

```
1. User signs up, no documents uploaded
2. Dashboard shows empty state with upload + sample options
3. User clicks "Use Sample Document"
4. Sample document uploads automatically (pre-staged)
5. Document processes (2–3s)
6. User is prompted: "Ask a question about the sample document"
7. Suggested questions appear as clickable chips
8. User clicks a suggestion → first answer → value moment
```

---

## 5. Component Library

### Reusable Components

| Component | Props | Used In |
|-----------|-------|---------|
| `KpiCard` | `label, value, delta, deltaDirection` | Dashboard, Analytics |
| `QueryBar` | `placeholder, onSubmit, loading, collectionId` | Dashboard, Queries |
| `AnswerCard` | `answer, sources, strategy, confidence, latency, cost, onFeedback` | Queries |
| `StrategyBadge` | `strategy: 'simple' | 'complex' | 'multihop' | 'fallback'` | Queries, Analytics |
| `ConfidenceBar` | `value: number (0-1)` | Queries |
| `DocumentCard` | `document, onPreview, onDelete` | Documents |
| `UploadZone` | `onUpload, accept, maxFiles, maxSize` | Documents |
| `CollectionCard` | `collection, onOpen, onDelete` | Collections |
| `StatusBadge` | `status: 'ready' | 'processing' | 'failed' | 'deleted'` | Documents |
| `MetricChart` | `type, data, options` | Analytics, Dashboard |
| `InsightBox` | `message, type: 'info' | 'success' | 'warning'` | All pages |
| `EmptyState` | `icon, title, description, action` | Dashboard, Documents, Queries |
| `ActivityFeed` | `events: ActivityEvent[]` | Dashboard |
| `UsageWidget` | `queries, cost, limit` | Sidebar |

---

## 6. Mobile Responsiveness

| Page | Desktop (>1024px) | Tablet (768–1024px) | Mobile (<768px) |
|------|-------------------|---------------------|------------------|
| Dashboard | 5-column KPIs, 2-column charts | 3-column KPIs, stacked charts | 2-column KPIs, single column |
| Documents | Table view with preview panel | Table view, no preview | Card list view |
| Queries | Split: history + answer | Split: history overlay | Full screen answer, history drawer |
| Analytics | 4-column KPIs, 2-column charts | 2-column KPIs, stacked charts | Single column, full-width charts |
| Settings | Tabs layout | Tabs layout | Accordion sections |

---

## 7. Error & Edge Cases

| Case | UX |
|------|----|
| Network offline | Banner: "You're offline. Some features may be unavailable." Disable querying. Show cached data. |
| API error (5xx) | Toast: "Something went wrong. Please try again." with retry button. Log error. |
| Rate limit exceeded | Modal: "You've exceeded your plan's query limit. Upgrade to continue." with pricing link. |
| Document upload failed | Inline error on document row: "Processing failed. [reason]" with retry button. |
| Query timeout (>30s) | Answer card: "This query is taking longer than expected." with option to retry or simplify. |
| No results found | Answer card: "No relevant documents found for your query. Try rephrasing or uploading more documents." |
| Low confidence | Warning banner on answer: "Low confidence. This answer may be unreliable. Consider rephrasing your query." |
| Free tier limits | Soft warning at 80% usage: "You've used 80% of your monthly queries." Hard block at 100%. |
| Session expired | Redirect to login with message: "Your session has expired. Please log in again." |

---

> *End of App UX Plan*  
> *Next: Phase 12 Implementation Plan → docs/PHASE_12_IMPLEMENTATION_PLAN.md*  
> *Brand: Orange Leaf Logo — LOCKED*
