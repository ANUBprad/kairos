# Phase 16 — Component Inventory & Interaction Design

**Status:** Final

---

Complete inventory of every reusable UI component in the Kairos product. Each entry specifies: states, props, behavior, responsive adaptation, and accessibility requirements.

---

## 1. Marketing Components

### 1.1 Navbar

**File:** `components/marketing/navbar.tsx`

**Props:** `{ transparent?: boolean }`

| State | Visual | Transition |
|-------|--------|------------|
| Top of page | Transparent bg, white text | 300ms bg cross-fade |
| Scrolled >200px | `bg-primary/90 backdrop-blur-md`, dark text | 300ms ease-out |
| Mobile menu open | Full-screen overlay, nav links stacked | Slide-in from right, 300ms |

**Desktop layout:** Logo (left) | Links (center, gap-8) | Auth buttons (right, gap-4)
**Mobile layout:** Logo (left) | Hamburger icon (right)
**Height:** 64px (desktop), 56px (mobile)
**z-index:** 50

**Accessibility:**
- `role="navigation"`
- `aria-label="Main navigation"`
- Hamburger: `aria-expanded` toggles
- Skip link visible on Tab

### 1.2 Footer

**File:** `components/marketing/footer.tsx`

**Props:** `{ minimal?: boolean }`

**Layout:** 4-column grid (desktop), 2-column (tablet), stacked (mobile)
**Sections:** Product, Resources, Company, Legal (see PHASE16_WEBSITE.md)
**Bottom bar:** Logo + copyright + social links

### 1.3 Hero

**File:** `components/marketing/hero.tsx`

**Props:** `{ headline: string; subheading: string; cta: CTAProps; secondaryCta?: CTAProps; trustBar?: string[]; visual: ReactNode }`

**Layout:** Centered content, max-width 800px, full viewport height
**Content stack:** Badge → H1 → Subheading → CTAs → Trust bar → Visualization
**Responsive:** Stack vertically on mobile, reduce type scale by 1 step

### 1.4 SocialProof

**File:** `components/marketing/social-proof.tsx`

**Props:** `{ logos: Logo[]; stat?: string }`

**Layout:** Centered text + logo row (flex, wrap, justify-center)
**Logo style:** Grayscale, `h-8` to `h-12`, `opacity-40 hover:opacity-70`

### 1.5 ProblemSection

**File:** `components/marketing/problem-section.tsx`

**Props:** `{ headline: string; body: string; visual: ReactNode; reversed?: boolean }`

**Layout:** 2-column grid, `gap-16`, text + visual side-by-side
**Responsive:** Single column on mobile, visual below text

### 1.6 HowItWorks

**File:** `components/marketing/how-it-works.tsx`

**Props:** `{ steps: Step[] }`

**Layout:** 3 cards in a row with animated connecting line
**Responsive:** Stack vertically on mobile, connecting line becomes vertical
**Animation:** Stagger fade-in on scroll into view

### 1.7 EngineVisualization (Interactive Demo)

**File:** `components/marketing/engine-visualization.tsx`

**Props:** `{ query?: string; onQuerySubmit?: (q: string) => void; compact?: boolean }`

**States:**

| State | Behavior |
|-------|----------|
| Idle | Input visible, placeholder text, cursor blinking |
| Processing | Animated flow: query → classify → plan → retrieve → answer |
| Complete | Result card with metrics and sources |
| Error | Error message with retry button |

**Full spec:** See PHASE16_WEBSITE.md §3

### 1.8 BenchmarkTable

**File:** `components/marketing/benchmark-table.tsx`

**Props:** `{ data: BenchmarkRow[]; highlightedRow?: string }`

**States:** Loaded | Empty | Loading (skeleton)
**Interactive:** Sortable columns, highlighted row for Kairos Adaptive

### 1.9 FeaturesGrid

**File:** `components/marketing/features-grid.tsx`

**Props:** `{ features: Feature[]; columns?: 2 | 3 | 4 }`

**Layout:** CSS Grid, `3col` desktop → `2col` tablet → `1col` mobile
**Animation:** Cards stagger-fade on scroll

### 1.10 PricingCards

**File:** `components/marketing/pricing-cards.tsx`

**Props:** `{ tiers: PricingTier[]; highlighted?: string; onSelect?: (tier: string) => void }`

**Layout:** 4 cards row, highlighted card elevated with brand border
**Mobile:** Horizontal scroll or stacked

### 1.11 FAQSection

**File:** `components/marketing/faq-section.tsx`

**Props:** `{ items: FAQItem[] }`

**Layout:** Accordion, max-width 720px, centered
**States:** Collapsed (default) | Expanded (arrow rotates, content slides down)

### 1.12 CTASection

**File:** `components/marketing/cta-section.tsx`

**Props:** `{ headline: string; subheading: string; cta: CTAProps; bg?: 'brand' | 'dark' }`

**Layout:** Centered, max-width 600px, full-width background

### 1.13 ComparisonTable (Pricing)

**File:** `components/marketing/comparison-table.tsx`

**Props:** `{ rows: ComparisonRow[] }`

**States:** Collapsed (show "Compare all features →") | Expanded (full table)

### 1.14 IntegrationGrid

**File:** `components/marketing/integration-grid.tsx`

**Props:** `{ categories: IntegrationCategory[] }`

**Layout:** Category headers with logo rows below

---

## 2. Dashboard Components

### 2.1 Sidebar

**File:** `components/dashboard/sidebar.tsx`

**Props:** `{ collapsed?: boolean; onToggle?: () => void }`

| State | Visual |
|-------|--------|
| Desktop expanded | 240px, full labels + icons |
| Desktop collapsed | 64px, icons only (tooltip labels) |
| Tablet | Collapsible overlay panel |
| Mobile | Hidden, toggle via hamburger |

**Navigation:** Active link highlighted with `bg-brand-light/10 text-brand border-l-2 border-brand`

**Accessibility:**
- `role="navigation"`
- `aria-label="Dashboard navigation"`
- Collapse button: `aria-expanded`

### 2.2 Topbar

**File:** `components/dashboard/topbar.tsx`

**Props:** `{ title: string; breadcrumbs?: Breadcrumb[]; actions?: Action[] }`

**Layout:** Breadcrumbs (left) | Search (center) | Notifications + Avatar (right)
**Height:** 64px, border-bottom `border-primary`

### 2.3 StatsCard (Metric Card)

**File:** `components/dashboard/stats-card.tsx`

**Props:**
```tsx
interface StatsCardProps {
  title: string;
  value: string | number;
  change?: { value: number; trend: 'up' | 'down' | 'neutral' };
  icon?: LucideIcon;
  loading?: boolean;
  onClick?: () => void;
}
```

**States:**

| State | Visual |
|-------|--------|
| Default | Icon (top-left), Value (large), Title (label), Change (trend indicator) |
| Loading | Skeleton variant (pulsing rectangles matching layout) |
| Error | Red border, "Failed to load" text, retry button |
| Interactive | Hover → shadow level-2, cursor pointer |

### 2.4 QueryInput

**File:** `components/dashboard/query-input.tsx`

**Props:**
```tsx
interface QueryInputProps {
  projectId: string;
  onSubmit: (query: string) => void;
  loading?: boolean;
  placeholder?: string;
}
```

**States:**

| State | Visual |
|-------|--------|
| Idle | Input field with placeholder, submit button disabled if empty |
| Focused | Brand ring, hint text visible |
| Typing | Characters appear, submit button becomes active |
| Submitting | Submit button shows spinner, input disabled |
| Error | Red border, error message below input |
| Disabled | Grayed out, "Select a project first" hint |

### 2.5 QueryResult

**File:** `components/dashboard/query-result.tsx`

**Props:**
```tsx
interface QueryResultProps {
  query: string;
  answer: string;
  confidence: number;
  strategy: string;
  latency: number;
  cost: number;
  sources: Source[];
  loading?: boolean;
  streaming?: boolean;
  feedback?: 'up' | 'down' | null;
  onFeedback?: (type: 'up' | 'down') => void;
  onCopy?: () => void;
  onExport?: () => void;
}
```

**States:**

| State | Visual |
|-------|--------|
| Empty | Nothing displayed |
| Loading | Skeleton layout with pulsing rectangles |
| Streaming | Pulsing left border, answer text streams character by character |
| Complete | Full result with metrics badge row, answer text, sources list |
| Error | Red left border, error message, retry button |
| No results | "No relevant documents found" with suggestion |

### 2.6 StrategyFlow (Query Visualization)

**File:** `components/dashboard/strategy-flow.tsx`

**Props:**
```tsx
interface StrategyFlowProps {
  query: string;
  classification: { type: string; confidence: number };
  strategy: string;
  latency: number;
  cost: number;
  steps: FlowStep[];
  animated?: boolean;
}
```

**Visual:**
```
[Query] → [Classify: "Simple" 0.94] → [Plan: "Hybrid" 0.97] → [Retrieve: 3 docs] → [Answer: 163ms]
```

Each step is a rounded pill with label + value. Active step glows brand-orange. Completed steps have checkmark. Connecting arrows animate on progress.

### 2.7 UsageChart

**File:** `components/dashboard/usage-chart.tsx`

**Props:**
```tsx
interface UsageChartProps {
  data: { date: string; value: number }[];
  metric: string;
  period: '7d' | '30d' | '90d';
  loading?: boolean;
  height?: number;
}
```

**States:** Loading (skeleton chart shape) | Loaded (Recharts area chart) | Empty (flat line with "No data" overlay)

### 2.8 ApiKeyManager

**File:** `components/dashboard/api-key-manager.tsx`

**Props:**
```tsx
interface ApiKeyManagerProps {
  keys: ApiKey[];
  onCreate: (name: string, projectId: string) => Promise<{ key: string }>;
  onRevoke: (keyId: string) => Promise<void>;
  loading?: boolean;
}
```

**States:**

| State | Visual |
|-------|--------|
| Empty | "No API keys" empty state with "Create Key" CTA |
| List | Table with name, prefix, created, last used, status, actions |
| Creating | Modal form → key created → display with copy button |
| Revoking | Confirm dialog → key grayed out → "Revoked" badge |
| Error | Toast notification + inline message |

### 2.9 ProjectList

**File:** `components/dashboard/project-list.tsx`

**Props:**
```tsx
interface ProjectListProps {
  projects: Project[];
  onCreate: (name: string, description: string) => Promise<void>;
  onDelete: (projectId: string) => Promise<void>;
  loading?: boolean;
}
```

**States:** Empty | List (table or cards) | Creating (modal) | Deleting (confirm dialog)

### 2.10 BillingCard

**File:** `components/dashboard/billing-card.tsx`

**Props:**
```tsx
interface BillingCardProps {
  plan: Plan;
  usage: { used: number; limit: number };
  onUpgrade: () => void;
  onManage: () => void;
}
```

**States:** Free (upgrade prompts) | Active (plan details) | Over-limit (warning banner) | Past due (error state)

### 2.11 NotificationBell

**File:** `components/dashboard/notification-bell.tsx`

**Props:** `{ count?: number; items: Notification[] }`

**States:** No notifications (bell icon only) | Has unread (red dot badge) | Dropdown open (list of notifications)

---

## 3. Auth Components

### 3.1 LoginForm

**File:** `components/auth/login-form.tsx`

**States:** Idle | Submitting | Error (wrong credentials, network error) | Success (redirect)

### 3.2 SignupForm

**File:** `components/auth/signup-form.tsx`

**States:** Idle | Submitting | Error (email taken, validation) | Success (redirect to verify email)

### 3.3 OAuthButtons

**File:** `components/auth/oauth-buttons.tsx`

**Props:** `{ providers: ('google' | 'github')[] }`

**States:** Idle | Authenticating (spinner on clicked button) | Error (OAuth failure toast)

### 3.4 ForgotPasswordForm

**File:** `components/auth/forgot-password-form.tsx`

**States:** Idle | Sending | Sent (confirmation) | Error

---

## 4. Shared Components

### 4.1 LeafLogo

**File:** `components/shared/leaf-logo.tsx`

**Props:** `{ size?: 'sm' | 'md' | 'lg'; variant?: 'default' | 'inverted'; link?: boolean }`

| Size | Height | Usage |
|------|--------|-------|
| sm | 24px | Inline, footer |
| md | 28px | Navbar |
| lg | 40px | Auth pages, hero |

### 4.2 ThemeToggle

**File:** `components/shared/theme-toggle.tsx`

**Props:** `{ className?: string }`

**Visual:** Sun/Moon icon toggle, click to cycle: light → dark → system

### 4.3 EmptyState

**File:** `components/shared/empty-state.tsx`

**Props:** `{ illustration: ReactNode; title: string; description: string; cta?: CTAProps }`

### 4.4 LoadingState

**File:** `components/shared/loading-state.tsx`

**Props:** `{ type: 'spinner' | 'skeleton' | 'shimmer'; rows?: number }`

### 4.5 ErrorBoundary

**File:** `components/shared/error-boundary.tsx`

**Props:** `{ fallback?: ReactNode; onError?: (error: Error) => void }`

**States:** Normal (render children) | Error (show fallback UI with retry)

### 4.6 ConfirmDialog

**File:** `components/shared/confirm-dialog.tsx`

**Props:** `{ open: boolean; title: string; description: string; confirmLabel?: string; variant?: 'danger' | 'default'; onConfirm: () => void; onCancel: () => void; loading?: boolean }`

### 4.7 SearchInput

**File:** `components/shared/search-input.tsx`

**Props:** `{ placeholder?: string; value: string; onChange: (v: string) => void; onClear?: () => void }`

**States:** Idle | Focused (brand ring) | Filled (clearable) | Empty

### 4.8 Toast (Notification)

**File:** `components/shared/toast.tsx`

**Implementation:** shadcn/ui `sonner` toast (with custom theme tokens)

### 4.9 Skeleton

**File:** `components/shared/skeleton.tsx`

**Props:** `{ variant: 'card' | 'text' | 'table' | 'chart' | 'avatar'; rows?: number }`

---

## 5. Animation System (Complete Reference)

### 5.1 Global Rules

```css
/* Tailwind v4 animation config */
@theme {
  --animate-fade-in: fade-in 0.2s ease-out;
  --animate-slide-up: slide-up 0.3s ease-out;
  --animate-slide-right: slide-right 0.3s ease-out;
  --animate-scale-in: scale-in 0.25s ease-out;
  --animate-shimmer: shimmer 1.5s ease-in-out infinite;
  --animate-spin-slow: spin 2s linear infinite;
}

@keyframes fade-in {
  from { opacity: 0; }
  to { opacity: 1; }
}

@keyframes slide-up {
  from { opacity: 0; transform: translateY(10px); }
  to { opacity: 1; transform: translateY(0); }
}

@keyframes slide-right {
  from { opacity: 0; transform: translateX(20px); }
  to { opacity: 1; transform: translateX(0); }
}

@keyframes scale-in {
  from { opacity: 0; transform: scale(0.95); }
  to { opacity: 1; transform: scale(1); }
}

@keyframes shimmer {
  0% { background-position: -200% 0; }
  100% { background-position: 200% 0; }
}
```

### 5.2 Scroll-Triggered Animations

Use `framer-motion` `useInView` or Intersection Observer for scroll-triggered reveals.

| Element | Animation | Trigger | Threshold |
|---------|-----------|---------|-----------|
| Section headers | Fade + slide up | Scroll into view | 0.2 |
| Card grids | Stagger fade + slide up (50ms delay per card) | Scroll into view | 0.1 |
| Number counters | Animate from 0 to target | Scroll into view | 0.5 |
| Benchmark rows | Sequential fade-in (100ms per row) | Scroll into table | 0.3 |

### 5.3 Hover Animations

| Element | Effect | Duration | Easing |
|---------|--------|----------|--------|
| Card | translateY(-2px) + shadow increase | 200ms | ease-out |
| Button (primary) | Scale 1.02 + brighter bg | 150ms | ease-out |
| Button (secondary) | bg becomes `bg-tertiary` | 150ms | ease-out |
| Link | Color transition to `brand-primary` | 150ms | ease-out |
| Logo in trust bar | Opacity 40% → 70% | 200ms | ease-out |
| Pricing card | Border becomes `brand-primary` | 200ms | ease-out |

### 5.4 Page Transitions

| Transition | Implementation | Duration |
|-----------|----------------|----------|
| Marketing page → Marketing page | Next.js built-in (no animation — instant) | 0 |
| Marketing → Auth | Fade 200ms | 200ms |
| Auth → Dashboard | Fade + logo scale animation | 300ms |
| Dashboard page → Dashboard page | Fade + content slide up 200ms | 200ms |

Use `framer-motion` `AnimatePresence` for route transitions with `layout.tsx`.

### 5.5 Loading Sequence (Query Execution)

```
t=0ms    [Spinner appears, "Analyzing query..."]
t=200ms  [Flow node 1 lights up: "Classifying..."]
t=400ms  [Flow node 2 lights up: "Planning..."]
t=800ms  [Flow node 3 lights up: "Retrieving..."]
t=1200ms [Answer begins streaming character by character]
t=2000ms [Full result with all metrics, feedback buttons appear]
```

### 5.6 Micro-interactions

| Element | Interaction | Effect |
|---------|------------|--------|
| Toast dismiss | Click X | Slide out to right, 200ms |
| Accordion toggle | Click header | Height expand/collapse, 200ms |
| Tab switch | Click tab | Cross-fade content, 150ms |
| Modal open | Trigger click | Scale up + backdrop fade, 250ms |
| Modal close | Click backdrop/Escape/X | Scale down + fade, 150ms |
| Dropdown open | Click trigger | Fade + slide down, 150ms |
| Dropdown close | Click outside/Escape | Fade + slide up, 100ms |
| Progress bar | Value update | Width transition, 300ms |
| Copy to clipboard | Click copy | Brief checkmark animation, 1.5s |

---

## 6. Responsive Strategy (Complete Reference)

### 6.1 Breakpoints

```css
@theme {
  --breakpoint-sm: 640px;   /* Large phones, small tablets */
  --breakpoint-md: 768px;   /* Tablets */
  --breakpoint-lg: 1024px;  /* Desktop */
  --breakpoint-xl: 1440px;  /* Wide desktop */
}
```

### 6.2 Layout Changes by Breakpoint

| Component | Default (<640px) | sm (640px) | md (768px) | lg (1024px) | xl (1440px) |
|-----------|-----------------|-------------|-------------|--------------|--------------|
| **Navbar** | Hamburger menu | Hamburger | Desktop nav | Desktop nav | Desktop nav |
| **Hero** | Stacked, smaller text | Stacked | Side-by-side | Side-by-side | Full |
| **How It Works** | Vertical steps | Vertical | Horizontal | Horizontal | Horizontal |
| **Feature grid** | 1 column | 2 columns | 2 columns | 3 columns | 3 columns |
| **Pricing cards** | Stacked | 2×2 grid | 2×2 grid | 4 columns | 4 columns |
| **Footer** | Stacked | 2 columns | 2 columns | 4 columns | 4 columns |
| **Dashboard** | Full screen (sidebar overlay) | Sidebar overlay | Collapsible sidebar | Fixed sidebar 240px | Fixed sidebar 240px |
| **Analytics charts** | 1 chart per row | 1 per row | 2 per row | 2 per row | 3 per row |
| **Query workspace** | Stacked | Stacked | Side-by-side | Side-by-side | Side-by-side |
| **Tables** | Card view (stacked) | Card view | Table view | Table view | Table view |

### 6.3 Typography Scaling

| Level | Mobile (<640px) | Tablet (640-1024px) | Desktop (>1024px) |
|-------|-----------------|---------------------|-------------------|
| Hero | 2.5rem (40px) | 3.5rem (56px) | 4.5rem (72px) |
| H1 | 2rem (32px) | 2.5rem (40px) | 3rem (48px) |
| H2 | 1.5rem (24px) | 1.75rem (28px) | 2.25rem (36px) |
| H3 | 1.25rem (20px) | 1.25rem (20px) | 1.5rem (24px) |
| Body | 0.938rem (15px) | 1rem (16px) | 1rem (16px) |

### 6.4 Touch Targets

All interactive elements must have minimum 44×44px touch target on mobile.

```css
/* Increase button padding on mobile */
@media (max-width: 639px) {
  .btn-sm { min-height: 44px; }
  .btn-icon { min-width: 44px; min-height: 44px; }
}
```

### 6.5 Dashboard Sidebar Responsive

| Breakpoint | State | Width | Behavior |
|------------|-------|-------|----------|
| <768px | Hidden (overlay) | 0 | Hamburger toggles overlay panel |
| 768-1023px | Collapsible | 64px (icons) | Click icon → overlay panel or tooltip |
| 1024px+ | Fixed | 240px | Always visible, full labels |

```tsx
// Logic
const [sidebarOpen, setSidebarOpen] = useState(false);
const isDesktop = useMediaQuery('(min-width: 1024px)');
const isTablet = useMediaQuery('(min-width: 768px)');

// Desktop: always show full sidebar
// Tablet: show icon-only sidebar, click to expand
// Mobile: hidden, hamburger toggles overlay
```

### 6.6 Responsive Tables

On mobile, tables convert to card list:

```
Desktop:
┌────────────┬──────────┬──────────┐
│ Name       │ Queries  │ Status   │
│ ────────── │ ──────── │ ──────── │
│ Prod API   │ 42,891   │ Active   │
└────────────┴──────────┴──────────┘

Mobile:
┌────────────────────────────┐
│  Prod API                  │
│  Queries: 42,891          │
│  Status: [Active]         │
├────────────────────────────┤
│  ...next card...           │
└────────────────────────────┘
```

### 6.7 Component Visibility

| Component | Mobile | Tablet | Desktop |
|-----------|--------|--------|---------|
| Dashboard sidebar labels | Hidden | Hidden (tooltip) | Visible |
| Dashboard sidebar icons | Visible | Visible | Visible |
| Marketing nav links | In hamburger | In hamburger | Visible |
| Auth page OAuth dividers | Visible | Visible | Visible |
| Chart tooltips | Tap to show | Tap to show | Hover to show |
| Benchmark table (full) | Scrollable | Scrollable | Visible |
| Pricing comparison table | Expandable | Expandable | Visible |
| Hero animation | Static diagram | Simplified animation | Full animation |

### 6.8 Print Styles

```css
@media print {
  .navbar, .sidebar, .footer, .toast { display: none; }
  body { color: black; background: white; }
  a { text-decoration: underline; }
}
```

---

## 7. Keyboard Shortcuts

| Shortcut | Context | Action |
|----------|---------|--------|
| `Cmd+K` / `Ctrl+K` | Dashboard | Open command palette |
| `?` | Dashboard | Show keyboard shortcut help |
| `g h` | Dashboard | Go to Home |
| `g p` | Dashboard | Go to Projects |
| `g q` | Dashboard | Go to Queries |
| `g a` | Dashboard | Go to Analytics |
| `g k` | Dashboard | Go to API Keys |
| `g b` | Dashboard | Go to Billing |
| `n` | Dashboard | New query / new project (context-dependent) |
| `/` | Any page | Focus search |
| `Esc` | Modal/dropdown | Close |
| `Enter` | Input | Submit |

---

## 8. Component Count Summary

| Category | Count |
|----------|-------|
| Marketing components | 14 |
| Dashboard components | 11 |
| Auth components | 4 |
| Shared components | 9 |
| UI primitives (shadcn/ui) | ~15 |
| **Total reusable components** | **~53** |
