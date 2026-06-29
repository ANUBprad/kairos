# Design System

**Phase 15 — Product Definition & UX Blueprint**  
**Status:** Superseded by PHASE16_DESIGN_SYSTEM.md

---

## Overview

This design system defines the official Kaios visual language. It is inspired by Linear, Vercel, Stripe, and Notion — premium, minimal, intelligent.

The orange leaf logo influences every design decision: warmth balanced with precision, organic shapes within geometric structures.

---

## Color Palette

### Brand Colors

```
Leaf Orange:    #FF5A0A
  Hover:        #E54E00
  Active:       #CC4400
  Light:        #FFF0E5
  Dark:         #CC4400

Dark Surface:   #0B0F14
  Card:         #14181D
  Border:       #1F2530

White Surface:  #FFFFFF
  Card:         #F5F5F5
  Border:       #E5E5E5
```

### Light Mode

| Token | Hex | Usage |
|-------|-----|-------|
| `--bg-primary` | `#FFFFFF` | Page background |
| `--bg-secondary` | `#F5F5F5` | Card background |
| `--bg-tertiary` | `#EEEEEE` | Hover state |
| `--border-primary` | `#E5E5E5` | Borders, dividers |
| `--border-secondary` | `#D0D0D0` | Input borders |
| `--text-primary` | `#0A0A0A` | Headings, body |
| `--text-secondary` | `#6B6B6B` | Labels, captions |
| `--text-tertiary` | `#A0A0A0` | Placeholders |
| `--brand-primary` | `#FF5A0A` | Links, CTAs |
| `--brand-hover` | `#E54E00` | Hover states |

### Dark Mode

| Token | Hex | Usage |
|-------|-----|-------|
| `--bg-primary` | `#0B0F14` | Page background |
| `--bg-secondary` | `#14181D` | Card background |
| `--bg-tertiary` | `#1A2028` | Hover state |
| `--border-primary` | `#1F2530` | Borders, dividers |
| `--border-secondary` | `#2A3140` | Input borders |
| `--text-primary` | `#F0F0F0` | Headings, body |
| `--text-secondary` | `#8B8B8B` | Labels, captions |
| `--text-tertiary` | `#5C5C5C` | Placeholders |
| `--brand-primary` | `#FF5A0A` | Links, CTAs |
| `--brand-hover` | `#FF6A1A` | Hover states |

### Semantic Colors

| Token | Light | Dark | Usage |
|-------|-------|------|-------|
| `--success` | `#22C55E` | `#22C55E` | Positive metrics, confirmation |
| `--warning` | `#F59E0B` | `#F59E0B` | Alerts, near-limits |
| `--error` | `#EF4444` | `#EF4444` | Errors, failures |
| `--info` | `#3B82F6` | `#60A5FA` | Information |

### Color Usage Rules

1. **Leaf Orange** is the only accent color. Do not introduce secondary accent colors.
2. Semantic colors (success, warning, error, info) are used only for their specific meaning.
3. Never use color alone to convey information — always pair with text or icons.
4. Light mode is default for marketing site. Dark mode is default for dashboard.

---

## Typography

### Font Family

```
Headings: Inter (sans-serif)
  Weights: 600 (Semibold), 700 (Bold), 800 (ExtraBold)

Body: Inter (sans-serif)
  Weights: 400 (Regular), 500 (Medium), 600 (Semibold)

Code: JetBrains Mono (monospace)
  Weight: 400 (Regular)
```

### Type Scale

```
Text 1:  48px/3rem   800  1.1   "Hero headline"          Display
Text 2:  36px/2.25rem 700  1.2   "Section heading"        H1
Text 3:  30px/1.875r  700  1.25  "Page title"             H2
Text 4:  24px/1.5rem  600  1.3   "Card heading"           H3
Text 5:  20px/1.25rem 600  1.4   "Subsection"             H4
Text 6:  18px/1.125r  400  1.6   "Lead paragraph"         Body Large
Text 7:  16px/1rem    400  1.6   "Default body"           Body
Text 8:  14px/0.875r  400  1.5   "Caption"                Small
Text 9:  13px/0.8125r 500  1.4   "Label"                  Label
Text 10: 12px/0.75rem 400  1.4   "Timestamp"              Tiny
```

### Type Styles

| Style | Font Size | Weight | Line Height | Letter Spacing |
|-------|-----------|--------|-------------|----------------|
| Hero | 72px (4.5rem) | 800 | 1.05 | -0.02em |
| H1 | 48px (3rem) | 700 | 1.1 | -0.02em |
| H2 | 36px (2.25rem) | 700 | 1.15 | -0.015em |
| H3 | 24px (1.5rem) | 600 | 1.25 | -0.01em |
| H4 | 20px (1.25rem) | 600 | 1.3 | -0.01em |
| Lead | 18px (1.125rem) | 400 | 1.6 | 0 |
| Body | 16px (1rem) | 400 | 1.6 | 0 |
| Small | 14px (0.875rem) | 400 | 1.5 | 0 |
| Label | 13px (0.8125rem) | 500 | 1.4 | 0.01em |
| Tiny | 12px (0.75rem) | 400 | 1.4 | 0 |
| Code | 14px (0.875rem) | 400 | 1.6 | 0 |
| Monospace | 13px (0.8125rem) | 400 | 1.5 | 0 |

---

## Spacing System

```
0:   0px
1:   4px
2:   8px
3:   12px
4:   16px
5:   20px
6:   24px
7:   28px
8:   32px
9:   36px
10:  40px
12:  48px
14:  56px
16:  64px
20:  80px
24:  96px
32:  128px
```

### Spacing Patterns

| Pattern | Value | Usage |
|---------|-------|-------|
| Section padding | 80px top/bottom | Page sections |
| Card padding | 24px | Inside cards |
| Inset padding | 16px | Inside inputs |
| Stack gap | 8px | Between related elements |
| Group gap | 16px | Between form groups |
| Section gap | 40px | Between sections |

---

## Border Radius

```
sm:   4px   — Inputs, badges, small elements
md:   8px   — Cards, buttons, dropdowns
lg:   12px  — Large cards, containers
xl:   16px  — Page sections, modals
2xl:  24px  — Hero sections
full: 9999px — Avatars, pills
```

---

## Elevation / Shadows

### Light Mode

```
level-0:  none
level-1:  0 1px 2px rgba(0,0,0,0.04), 0 1px 1px rgba(0,0,0,0.02)
level-2:  0 2px 8px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)
level-3:  0 4px 16px rgba(0,0,0,0.08), 0 2px 4px rgba(0,0,0,0.04)
level-4:  0 8px 32px rgba(0,0,0,0.10), 0 4px 8px rgba(0,0,0,0.04)
```

### Dark Mode

```
level-0:  none
level-1:  0 1px 2px rgba(0,0,0,0.2), 0 1px 1px rgba(0,0,0,0.1)
level-2:  0 2px 8px rgba(0,0,0,0.3), 0 1px 2px rgba(0,0,0,0.15)
level-3:  0 4px 16px rgba(0,0,0,0.4), 0 2px 4px rgba(0,0,0,0.2)
level-4:  0 8px 32px rgba(0,0,0,0.5), 0 4px 8px rgba(0,0,0,0.25)
```

---

## Component Specifications

### Buttons

```
Primary (Orange)
┌──────────────────────────────┐
│  Start building — it's free  │
└──────────────────────────────┘
  bg: brand-primary (#FF5A0A)
  text: white
  hover: brand-hover (#E54E00)
  active: brand-active (#CC4400)
  disabled: brand-light/40
  height: 44px (md), 48px (lg)
  padding: 16px 24px (md), 20px 32px (lg)
  radius: 8px
  font: 15px/600 Inter

Secondary (Outline)
┌──────────────────────────────┐
│  See how it works            │
└──────────────────────────────┘
  bg: transparent
  border: border-primary
  text: text-primary
  hover: bg-secondary (lighten)
  height: same as primary
  padding: same as primary
  radius: same as primary

Ghost
┌──────────────────────────────┐
│  Cancel                      │
└──────────────────────────────┘
  bg: transparent
  text: text-secondary
  hover: bg-secondary
  height: 36px (sm)
  radius: 6px

Danger
┌──────────────────────────────┐
│  Delete API Key              │
└──────────────────────────────┘
  bg: error (#EF4444)
  text: white
  hover: darker red
  height: same as primary
```

### Inputs

```
┌────────────────────────────────────────┐
│  Label                                 │
│ ┌────────────────────────────────────┐ │
│ │ Ask a question...                  │ │
│ └────────────────────────────────────┘ │
│  Helper text or error message          │
└────────────────────────────────────────┘

  height: 44px
  padding: 12px 16px
  border: 1px solid border-primary
  focus: 2px solid brand-primary (ring)
  radius: 8px
  bg: bg-primary
  text: text-primary
  placeholder: text-tertiary
  disabled: opacity 50%
  error: border-error
```

### Cards

```
┌────────────────────────────────────────┐
│                                        │
│   Icon                                 │
│   Title                                │
│   Description text that explains       │
│   what this card represents            │
│                                        │
└────────────────────────────────────────┘

  bg: bg-secondary
  border: 1px solid border-primary
  radius: 12px
  padding: 24px
  shadow: level-1
  hover: level-2 + border brand-primary
  transition: 200ms ease-out
```

### Tables

```
┌────────────────────────────────────────┐
│  Column 1 │ Column 2 │ Column 3 │ ... │
│  ──────── │ ──────── │ ──────── │     │
│  Value    │ Value    │ Value    │     │
│  Value    │ Value    │ Value    │     │
│  Value    │ Value    │ Value    │     │
└────────────────────────────────────────┘

  header: 13px/600, text-secondary, uppercase, letter-spacing 0.05em
  cell: 14px/400, text-primary
  border: 1px solid border-primary
  hover row: bg-tertiary
  radius: 8px (container)
  padding: 12px 16px (cells)
```

### Tabs

```
┌────────────────────────────────────────┐
│  [Active] [Tab 2] [Tab 3]             │
│  ───────                              │
└────────────────────────────────────────┘

  active: text-brand + 2px brand underline
  inactive: text-secondary, hover → text-primary
  gap: 24px
  transition: 200ms ease-out
```

---

## Charts & Data Visualization

### Chart Types

| Chart | Usage | Visual Style |
|-------|-------|--------------|
| Line | Trends over time (queries, latency, cost) | 2px stroke, smooth curve, brand-orange line |
| Area | Cumulative volume | Filled area under line, 20% opacity brand-orange |
| Bar | Comparison (strategy distribution, per-key usage) | Rounded top (4px), brand-orange, gap 4px |
| Donut | Distribution (strategy mix, source types) | 12px thickness, brand-orange primary, gray secondary |
| Histogram | Distribution (confidence scores, latency) | Rounded bars, brand-orange |

### Chart Principles

1. **Clean** — No gridlines unless necessary for value reading
2. **Minimal** — One color (brand-orange), one neutral (gray), one semantic (if needed)
3. **Labeled** — All axes labeled, tooltips on hover
4. **Interactive** — Hover for values, click for drill-down where applicable

---

## Motion & Animation

### Principles

1. **Fast** — 150-300ms for all interactions
2. **Subtle** — Motion supports understanding, never distracts
3. **Easing** — `cubic-bezier(0.16, 1, 0.3, 1)` for enter, `cubic-bezier(0.4, 0, 0.2, 1)` for exit
4. **Purposeful** — Every animation has a reason

### Animation Catalog

| Element | Trigger | Animation | Duration | Easing |
|---------|---------|-----------|----------|--------|
| Page transition | Route change | Fade + slide up | 200ms | ease-out |
| Modal | Open | Scale up + fade backdrop | 250ms | spring |
| Modal | Close | Scale down + fade | 150ms | ease-in |
| Dropdown | Open | Fade + slide down | 150ms | ease-out |
| Tooltip | Hover | Fade | 100ms | ease-out |
| Card | Hover | Lift (translateY -2px) + shadow | 200ms | ease-out |
| Button | Hover | Slight scale (1.02) | 150ms | ease-out |
| List item | Mount | Staggered fade + slide | 300ms stagger 50ms | ease-out |
| Accordion | Click | Height expand | 200ms | ease-out |
| Notification | Auto | Slide in from right | 300ms | spring |
| Progress bar | Value change | Width animate | 300ms | ease-out |
| Tab switch | Click | Content cross-fade | 200ms | ease-out |

---

## Responsive Breakpoints

| Breakpoint | Width | Layout | Behavior |
|------------|-------|--------|----------|
| Mobile | < 640px | Single column | Hamburger nav, stacked cards |
| Tablet | 640-1024px | 2 columns | Collapsible sidebar, 2-col grid |
| Desktop | 1024-1440px | Full layout | Fixed sidebar, multi-col |
| Wide | > 1440px | Max-width 1280px | Centered content, wider panels |

---

## Dark Mode

### Implementation

- CSS custom properties for all colors (no hardcoded values)
- `prefers-color-scheme` media query for default
- Manual toggle in dashboard settings
- Toggle persists to localStorage
- Transition: 300ms background + 200ms text

### Rules

1. Marketing site: light mode default, dark mode optional
2. Dashboard: dark mode default, light mode optional
3. Docs: matches system preference
4. Blog: light mode default

---

## Iconography

### Icon Set

Lucide Icons — open source, consistent 24px grid, 2px stroke, round caps.

### Usage

| Context | Size | Color |
|---------|------|-------|
| Inline with text | 16px (1rem) | Inherit text color |
| Navigation | 20px (1.25rem) | text-secondary |
| Buttons | 18px (1.125rem) | Match button text |
| Feature icons | 24px (1.5rem) | brand-primary |
| Large indicators | 32px (2rem) | Semantic color |

---

## Grid System

### Marketing Site

- 12-column grid
- Max-width: 1280px
- Gutter: 32px
- Margin: 24px (mobile), 64px (desktop)

### Dashboard

- 12-column grid
- Max-width: 1440px
- Gutter: 24px
- Sidebar: 240px fixed
- Content: remaining width
