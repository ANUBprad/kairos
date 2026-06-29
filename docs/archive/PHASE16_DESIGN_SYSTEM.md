# Phase 16 — Product Design System

**Status:** Final  
**Version:** 2.0 (Merges and supersedes BRAND_GUIDELINES.md + DESIGN_SYSTEM.md)

---

This is the single source of truth for all Kairos visual design. Frontend engineers can build every pixel from this document. No design decisions are left to interpretation.

---

## 1. Brand Identity

### Brand Essence

Kairos is intelligent, adaptive, and precise. The brand communicates confidence without arrogance, sophistication without complexity, and power without intimidation.

### Brand Values

| Value | Manifestation |
|-------|--------------|
| **Intelligence** | Every interaction feels smart. The system understands context. |
| **Adaptability** | Nothing is rigid. The product molds to each query, each user, each use case. |
| **Precision** | Every decision is deliberate. Every result is measured. Every improvement is tracked. |
| **Clarity** | Complex technology, simple experience. Users understand what's happening and why. |

### Brand Voice

| Attribute | How It Sounds | Example |
|-----------|--------------|---------|
| Confident | Declarative statements. No hedging. | "Kairos classifies, plans, and routes every query." Not "Kairos can help classify..." |
| Precise | Specific numbers, concrete claims. | "40% lower costs, 24% better recall." Not "Significantly better results." |
| Calm | No exclamation points. No hype. | "Start building — it's free." Not "Start building now!" |
| Technical | Assumes intelligence. | Uses "strategy selection, confidence calibration, budget optimization." Defines once, then uses freely. |
| Human | Warm but professional. | "Thoughtful engineer, not corporate marketer." |
| Error messages | Apologetic + actionable. | "Something went wrong. Our team has been notified. Your data is safe." Not "Error 500." |

### Writing Style Rules

- Oxford comma: **Yes** ("quality, latency, and cost" not "quality, latency and cost")
- Serial comma: **Yes** (same as Oxford)
- "Kairos": Always capitalized. Never "kairos" or "KEIROS."
- Product references: "the Kairos API", "Kairos platform" (lowercase p)
- API versioning: `/api/v1/query` (code formatting)
- Numbers: Spell out 1-9, digits 10+. Percentages always digits ("24%", not "twenty-four percent")
- Currency: $ sign + digits ("$49", "USD 49" only in legal)
- Dates: "June 25, 2026" (spelled month, comma after day)
- Time: 24h in technical docs, 12h in marketing ("14:30 UTC" vs "2:30 PM ET")

---

## 2. Logo

### Primary Logo

`docs/assets/logo/kairos-light.png` (light theme) / `docs/assets/logo/kairos-dark.png` (dark theme)

The Kairos logo is an orange paper-style maple leaf on a dark circular badge.

### Meaning

| Element | Significance |
|---------|-------------|
| Leaf shape | Adaptability — changes with seasons; Kairos adapts to every query |
| Clean lines | Precision — engineered, deliberate |
| Circular badge | Completeness — full-stack, end-to-end |
| Orange | Energy, warmth, confidence |

### Usage Rules

| Rule | Detail |
|------|--------|
| Minimum size (digital) | 24px |
| Minimum size (print) | 0.5in |
| Clear space | Equal to leaf width on all sides |
| Light bg | Full-color logo |
| Dark bg | White/orange inverted variant |
| Never | Recolor, rotate, add effects, place on busy backgrounds, combine with other marks |

### Logo Variations

| Variant | File | Usage |
|---------|------|-------|
| Full logo — light (PNG) | `docs/assets/logo/kairos-light.png` | Light theme primary mark |
| Full logo — dark (PNG) | `docs/assets/logo/kairos-dark.png` | Dark theme primary mark |
| Favicon (SVG) | `apps/portal/public/favicon.svg` | Browser tab, 16×16 / 32×32 |
| Favicon (PNG) | `apps/portal/public/branding/favicons/favicon.png` | Generated from source logo |
| Apple touch icon | `apps/portal/public/branding/favicons/apple-touch-icon.png` | iOS home screen (180×180) |
| OG image | `apps/portal/public/branding/social/og-image.png` | Social share card (1200×630) |
| Logo mark only | Extracted from full logo | App sidebar, favicon only (no text) |

### Logo Usage on Marketing Site

- Primary position: Top-left of navigation bar
- Height: 28px (nav), 40px (footer), 64px (hero)
- Links to `/`
- Invert on dark hero backgrounds

---

## 3. Color System

### Brand Colors

```
Brand token            Hex       Contrast on white   Contrast on dark    WCAG AA
─────────────────────────────────────────────────────────────────────────────
--brand-primary        #FF5A0A   3.2:1 (fail)        9.8:1 (pass)        Use only on dark bg or large text
--brand-hover          #E54E00   4.0:1 (pass)        7.5:1 (pass)       
--brand-active         #CC4400   4.8:1 (pass)        5.9:1 (pass)       
--brand-light          #FFF0E5   1.2:1 (fail)        13.5:1 (pass)       Background tint only
--brand-dark           #CC4400   4.8:1 (pass)        1.7:1 (fail)        Dark bg element only
```

### Light Mode

| Token | Hex | Contrast on white | Usage |
|-------|-----|-------------------|-------|
| `--bg-primary` | `#FFFFFF` | — | Page background |
| `--bg-secondary` | `#F5F5F5` | — | Card background |
| `--bg-tertiary` | `#EEEEEE` | — | Hover state, table row hover |
| `--bg-inverse` | `#0B0F14` | — | Dark sections on light page |
| `--border-primary` | `#E5E5E5` | — | Borders, dividers |
| `--border-secondary` | `#D0D0D0` | — | Input borders, active borders |
| `--border-focus` | `#FF5A0A` | — | Focus ring |
| `--text-primary` | `#0A0A0A` | 17.1:1 | Headings, body |
| `--text-secondary` | `#6B6B6B` | 6.7:1 | Labels, captions, metadata |
| `--text-tertiary` | `#A0A0A0` | 3.2:1 | Placeholders, disabled (fine for 14px+) |
| `--text-inverse` | `#F0F0F0` | — | Text on dark backgrounds |

### Dark Mode

| Token | Hex | Contrast on dark | Usage |
|-------|-----|------------------|-------|
| `--bg-primary` | `#0B0F14` | — | Page background |
| `--bg-secondary` | `#14181D` | — | Card background |
| `--bg-tertiary` | `#1A2028` | — | Hover state, table row hover |
| `--bg-inverse` | `#FFFFFF` | — | Light sections on dark page |
| `--border-primary` | `#1F2530` | — | Borders, dividers |
| `--border-secondary` | `#2A3140` | — | Input borders, active borders |
| `--border-focus` | `#FF5A0A` | — | Focus ring |
| `--text-primary` | `#F0F0F0` | 17.1:1 (on bg) | Headings, body |
| `--text-secondary` | `#8B8B8B` | 7.2:1 (on bg) | Labels, captions |
| `--text-tertiary` | `#5C5C5C` | 4.6:1 (on bg) | Placeholders, disabled |
| `--text-inverse` | `#0A0A0A` | — | Text on light backgrounds |

### Semantic Colors

| Token | Hex | Contrast on white | Contrast on dark | Usage |
|-------|-----|-------------------|------------------|-------|
| `--success` | `#22C55E` | 3.0:1 (icon/status only) | 8.1:1 | Positive metrics, confirmation |
| `--success-bg` | `#F0FDF4` | — | `#052E16` | Success background tint |
| `--warning` | `#F59E0B` | 2.5:1 (icon/status only) | 7.3:1 | Alerts, near-limits |
| `--warning-bg` | `#FFFBEB` | — | `#451A03` | Warning background tint |
| `--error` | `#EF4444` | 4.8:1 (pass) | 8.3:1 | Errors, failures |
| `--error-bg` | `#FEF2F2` | — | `#450A0A` | Error background tint |
| `--info` | `#3B82F6` | 4.5:1 (pass) | 7.8:1 | Information, links |

### Color Usage Rules

1. **Leaf Orange is the only accent color.** Do not introduce secondary accent colors.
2. Semantic colors used only for their specific meaning. Never for decoration.
3. **Never use color alone** to convey information — always pair with text or icons.
4. Light mode is default for marketing site. Dark mode is default for dashboard.
5. All interactive elements must have minimum 3:1 contrast ratio against background.
6. Text must meet WCAG AA (4.5:1 for body, 3:1 for large text 18px+ bold or 24px+).

### Chart Color Scale (10 colors)

```
C1: #FF5A0A (brand)
C2: #3B82F6 (blue)
C3: #22C55E (green)
C4: #F59E0B (amber)
C5: #8B5CF6 (purple)
C6: #EC4899 (pink)
C7: #06B6D4 (cyan)
C8: #F97316 (orange-light)
C9: #14B8A6 (teal)
C10: #A1A1AA (gray)
```

Always start from C1. Use C1-C5 for most charts. Extend to C10 only when needed.

---

## 4. Typography

### Font Stack

| Usage | Font | Weight | Fallback |
|-------|------|--------|----------|
| Headings | Inter | 400-800 | system-ui, sans-serif |
| Body | Inter | 400-600 | system-ui, sans-serif |
| Code | JetBrains Mono | 400-500 | monospace |
| UI labels | Inter | 500-600 | system-ui, sans-serif |

### Type Scale

```css
/* Tailwind v4 configuration */
@theme {
  --font-sans: 'Inter', system-ui, sans-serif;
  --font-mono: 'JetBrains Mono', monospace;
  
  --text-hero: 4.5rem;
  --text-hero--line-height: 1.05;
  --text-hero--letter-spacing: -0.02em;
  --text-hero--font-weight: 800;
  
  --text-h1: 3rem;
  --text-h1--line-height: 1.1;
  --text-h1--letter-spacing: -0.02em;
  --text-h1--font-weight: 700;
  
  --text-h2: 2.25rem;
  --text-h2--line-height: 1.15;
  --text-h2--letter-spacing: -0.015em;
  --text-h2--font-weight: 700;
  
  --text-h3: 1.5rem;
  --text-h3--line-height: 1.25;
  --text-h3--letter-spacing: -0.01em;
  --text-h3--font-weight: 600;
  
  --text-h4: 1.25rem;
  --text-h4--line-height: 1.3;
  --text-h4--letter-spacing: -0.01em;
  --text-h4--font-weight: 600;
  
  --text-lead: 1.125rem;
  --text-lead--line-height: 1.6;
  
  --text-body: 1rem;
  --text-body--line-height: 1.6;
  
  --text-sm: 0.875rem;
  --text-sm--line-height: 1.5;
  
  --text-label: 0.8125rem;
  --text-label--line-height: 1.4;
  --text-label--font-weight: 500;
  --text-label--letter-spacing: 0.01em;
  
  --text-xs: 0.75rem;
  --text-xs--line-height: 1.4;
  
  --text-code: 0.875rem;
  --text-code--line-height: 1.6;
  --text-code--font-family: 'JetBrains Mono', monospace;
}
```

### Typography Plugin

```css
/* apps/portal/app/globals.css */
@plugin "@tailwindcss/typography";

/* Prose configuration for docs/blog */
.prose {
  --tw-prose-body: var(--text-primary);
  --tw-prose-headings: var(--text-primary);
  --tw-prose-links: var(--brand-primary);
  --tw-prose-bold: var(--text-primary);
  --tw-prose-code: var(--text-primary);
  --tw-prose-quotes: var(--text-secondary);
  --tw-prose-quote-borders: var(--brand-primary);
}
```

---

## 5. Spacing System

```css
@theme {
  --spacing-0: 0px;
  --spacing-1: 4px;
  --spacing-2: 8px;
  --spacing-3: 12px;
  --spacing-4: 16px;
  --spacing-5: 20px;
  --spacing-6: 24px;
  --spacing-7: 28px;
  --spacing-8: 32px;
  --spacing-9: 36px;
  --spacing-10: 40px;
  --spacing-12: 48px;
  --spacing-14: 56px;
  --spacing-16: 64px;
  --spacing-20: 80px;
  --spacing-24: 96px;
  --spacing-32: 128px;
}
```

### Spacing Patterns

| Pattern | Value | Usage |
|---------|-------|-------|
| Section padding | `py-20` (80px) | Page sections |
| Card padding | `p-6` (24px) | Inside cards |
| Inset padding | `px-4 py-3` (16×12) | Input fields |
| Stack gap | `gap-2` (8px) | Between related elements |
| Form group gap | `gap-4` (16px) | Between form groups |
| Section gap | `gap-10` (40px) | Between sections |
| List gap | `gap-3` (12px) | List items |
| Grid gap | `gap-6` (24px) | Card grids |

---

## 6. Border Radius

```css
@theme {
  --radius-sm: 4px;    /* Inputs, badges, small elements */
  --radius-md: 8px;    /* Cards, buttons, dropdowns */
  --radius-lg: 12px;   /* Large cards, containers */
  --radius-xl: 16px;   /* Page sections, modals */
  --radius-2xl: 24px;  /* Hero sections */
  --radius-full: 9999px; /* Avatars, pills */
}
```

---

## 7. Elevation / Shadows

```css
@theme {
  /* Light mode */
  --shadow-level-1: 0 1px 2px rgba(0,0,0,0.04), 0 1px 1px rgba(0,0,0,0.02);
  --shadow-level-2: 0 2px 8px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04);
  --shadow-level-3: 0 4px 16px rgba(0,0,0,0.08), 0 2px 4px rgba(0,0,0,0.04);
  --shadow-level-4: 0 8px 32px rgba(0,0,0,0.10), 0 4px 8px rgba(0,0,0,0.04);
  
  /* Dark mode */
  --shadow-dark-1: 0 1px 2px rgba(0,0,0,0.2), 0 1px 1px rgba(0,0,0,0.1);
  --shadow-dark-2: 0 2px 8px rgba(0,0,0,0.3), 0 1px 2px rgba(0,0,0,0.15);
  --shadow-dark-3: 0 4px 16px rgba(0,0,0,0.4), 0 2px 4px rgba(0,0,0,0.2);
  --shadow-dark-4: 0 8px 32px rgba(0,0,0,0.5), 0 4px 8px rgba(0,0,0,0.25);
}
```

| Level | Component | Light | Dark |
|-------|-----------|-------|------|
| 0 | Flat surfaces | None | None |
| 1 | Cards, inputs | `level-1` | `dark-1` |
| 2 | Dropdowns, popovers | `level-2` | `dark-2` |
| 3 | Modals, sidebars | `level-3` | `dark-3` |
| 4 | Full-screen overlays | `level-4` | `dark-4` |

---

## 8. Iconography

### Icon Set

**Lucide Icons** — exclusively. Open source, consistent 24px grid, 2px stroke, round caps, round joints.

### Icon Sizes

| Context | Size | Color |
|---------|------|-------|
| Inline with text | 16px (w-4 h-4) | Inherit text color |
| Navigation | 20px (w-5 h-5) | `text-secondary` |
| Buttons | 18px (w-[18px] h-[18px]) | Match button text |
| Feature icons | 24px (w-6 h-6) | `text-brand-primary` |
| Large indicators | 32px (w-8 h-8) | Semantic color |
| Avatar fallback | 40px (w-10 h-10) | `text-brand-primary` |

### Icon Style

- Stroke width: 2px (Lucide default)
- No filled variants except for active navigation states
- Color inherits from parent text color unless specified

---

## 9. Illustration Language

### Principles

1. **Abstract geometric** — Not literal, not illustrative
2. **Orange leaf influence** — Warm tones, organic-meets-geometric
3. **Minimal** — Single focal point, plenty of negative space
4. **Dark-friendly** — Works in both modes without modification

### Pattern Library (Inline SVG)

#### Empty State Pattern A (No data yet)
```
<svg viewBox="0 0 120 120" fill="none">
  <circle cx="60" cy="50" r="30" stroke="#FF5A0A" stroke-width="2" fill="none"/>
  <path d="M50 40 L60 30 L70 40" stroke="#FF5A0A" stroke-width="2" stroke-linecap="round"/>
  <path d="M45 55 Q60 65 75 55" stroke="#E5E5E5" stroke-width="2" fill="none"/>
</svg>
```

#### Empty State Pattern B (Error / missing)
```
<svg viewBox="0 0 120 120" fill="none">
  <circle cx="60" cy="50" r="30" stroke="#EF4444" stroke-width="2" fill="none"/>
  <line x1="50" y1="40" x2="70" y2="60" stroke="#EF4444" stroke-width="2" stroke-linecap="round"/>
  <line x1="70" y1="40" x2="50" y2="60" stroke="#EF4444" stroke-width="2" stroke-linecap="round"/>
</svg>
```

#### Loading State
```
<svg viewBox="0 0 60 60" fill="none" class="animate-spin">
  <circle cx="30" cy="30" r="24" stroke="#E5E5E5" stroke-width="4" fill="none"/>
  <path d="M54 30 A24 24 0 0 0 30 6" stroke="#FF5A0A" stroke-width="4" stroke-linecap="round"/>
</svg>
```

#### Feature Illustration Style
- 120×120 viewBox
- 2px stroke, rounded caps
- Primarily brand orange + gray outlines
- One filled element max (for emphasis)
- No gradients in MVP (add post-v1)

---

## 10. Accessibility

### Compliance Target

**WCAG 2.1 Level AA** for all public-facing pages. Level AAA where practical.

### Requirements

| Requirement | Specification |
|-------------|--------------|
| Color contrast | 4.5:1 body text, 3:1 large text (18px bold+, 24px+), 3:1 UI components |
| Focus indicators | 2px solid `brand-primary` ring, 2px offset. Never `outline: none` without replacement |
| Skip to content | Visible on first Tab press. Links to `#main-content` |
| Heading hierarchy | Single `h1` per page. Sequential `h2→h3→h4`. No skipping levels |
| Landmarks | `header`, `nav`, `main`, `aside`, `footer` on every page |
| Form labels | Every `<input>` has associated `<label>`. Error messages linked via `aria-describedby` |
| Images | All `<img>` have `alt` text. Decorative images use `alt=""` |
| Interactive elements | Buttons have accessible names. Custom controls have `role` + `aria-*` attributes |
| Keyboard navigation | All interactive elements reachable and operable via keyboard. Tab order follows visual order |
| Motion | `prefers-reduced-motion` respected. Animations disabled or reduced |
| Screen readers | Charts include data table fallback. Status messages use `aria-live="polite"` |
| Touch targets | Minimum 44×44px for all interactive elements |

### Focus Ring Implementation

```css
/* globals.css */
*:focus-visible {
  outline: 2px solid var(--brand-primary);
  outline-offset: 2px;
  border-radius: var(--radius-sm);
}

/* Remove for mouse clicks only */
*:focus:not(:focus-visible) {
  outline: none;
}
```

---

## 11. Grid System

### Marketing Site

```css
@theme {
  --grid-max-width: 1280px;
  --grid-gutter: 32px;
  --grid-columns: 12;
  --grid-margin-mobile: 24px;
  --grid-margin-desktop: 64px;
}
```

```css
/* Center content container */
.container {
  max-width: 1280px;
  margin: 0 auto;
  padding: 0 24px;
}

@media (min-width: 768px) {
  .container {
    padding: 0 64px;
  }
}
```

### Dashboard

```css
@theme {
  --dashboard-max-width: 1440px;
  --dashboard-gutter: 24px;
  --dashboard-sidebar-width: 240px;
  --dashboard-content-gap: 24px;
}
```

Dashboard layout: `grid-cols-[240px_1fr]` with sidebar fixed, content area filling remaining width.

---

## 12. Responsive Breakpoints

```css
@theme {
  --breakpoint-sm: 640px;   /* Mobile landscape / small tablet */
  --breakpoint-md: 768px;   /* Tablet */
  --breakpoint-lg: 1024px;  /* Desktop */
  --breakpoint-xl: 1440px;  /* Wide desktop */
}
```

| Breakpoint | Target | Layout | Nav | Content width |
|------------|--------|--------|-----|---------------|
| Default | Mobile <640px | Single column | Hamburger | Full width |
| `sm` (640px) | Large phone / small tablet | Single column | Hamburger | 600px |
| `md` (768px) | Tablet | 2 columns | Collapsible sidebar | 720px |
| `lg` (1024px) | Desktop | Multi-column | Fixed sidebar | 1000px |
| `xl` (1440px) | Wide desktop | Multi-column | Fixed sidebar | 1280px max |

---

## 13. Performance Budgets

| Metric | Target | Measurement |
|--------|--------|-------------|
| LCP (Largest Contentful Paint) | < 2.5s | Lighthouse, RUM |
| CLS (Cumulative Layout Shift) | < 0.1 | Lighthouse, RUM |
| INP (Interaction to Next Paint) | < 200ms | RUM |
| TTFB (Time to First Byte) | < 800ms | Lighthouse |
| FCP (First Contentful Paint) | < 1.8s | Lighthouse |
| Lighthouse Performance | > 90 | CI gate |
| Lighthouse Accessibility | > 95 | CI gate |
| Lighthouse Best Practices | > 95 | CI gate |
| Lighthouse SEO | > 95 | CI gate |
| JS bundle (initial load) | < 150KB gzip | Bundle analyzer |
| Font load | < 300ms | Font-display: swap |

---

## 14. Components

### 14.1 Button

```tsx
// variants: primary | secondary | ghost | danger
// sizes: sm | md | lg
// states: default | hover | active | focus-visible | disabled | loading

interface ButtonProps {
  variant: 'primary' | 'secondary' | 'ghost' | 'danger';
  size: 'sm' | 'md' | 'lg';
  loading?: boolean;
  disabled?: boolean;
  icon?: LucideIcon;  // Left icon
  iconRight?: LucideIcon;
  children: ReactNode;
  onClick?: () => void;
  type?: 'button' | 'submit' | 'reset';
  asChild?: boolean; // Radix slot for link-as-button
}
```

| Variant | Default bg | Hover bg | Active bg | Text | Border |
|---------|-----------|----------|-----------|------|--------|
| Primary | `brand-primary` | `brand-hover` | `brand-active` | white | none |
| Secondary | transparent | `bg-tertiary` | `bg-tertiary` | `text-primary` | `border-primary` |
| Ghost | transparent | `bg-tertiary` | `bg-tertiary` | `text-secondary` | none |
| Danger | transparent | `error-bg` | `error-bg` | `error` | `error` |

| Size | Height | Padding | Font | Icon gap |
|------|--------|---------|------|----------|
| sm | 36px | 12px 16px | 14px/500 | 8px |
| md | 44px | 16px 24px | 15px/600 | 8px |
| lg | 48px | 20px 32px | 16px/600 | 10px |

**Loading state**: Replace children with a spinner. Same dimensions. Skeleton width preserved.
**Disabled state**: opacity-50, cursor-not-allowed, no hover effects.
**Focus state**: `focus-visible:ring-2 ring-brand-primary ring-offset-2`.

### 14.2 Input

```tsx
interface InputProps {
  label: string;
  description?: string;
  placeholder?: string;
  error?: string;
  hint?: string;
  disabled?: boolean;
  required?: boolean;
  icon?: LucideIcon; // Left icon
  type?: 'text' | 'email' | 'password' | 'search' | 'url';
  value: string;
  onChange: (value: string) => void;
}
```

**States:**

| State | Border | Label | Description |
|-------|--------|-------|-------------|
| Default | `border-primary` | `text-primary` | `text-tertiary` |
| Hover | `border-secondary` | `text-primary` | — |
| Focus | `border-focus` + ring | `text-primary` | — |
| Error | `error` + ring | `text-error` | `text-error` |
| Disabled | `border-primary` opacity-50 | `text-tertiary` | `text-tertiary` |
| Success | `success` | `text-primary` | — |
| Filled | `border-primary` | `text-primary` | — |

**Dimensions:** height 44px, padding 12px 16px, radius `sm`, bg `bg-primary`.

**Error display:**
```
<label>{label}</label>
<input aria-invalid={!!error} aria-describedby={error ? 'input-error' : undefined} />
{error && <p id="input-error" className="text-error text-sm mt-1">{error}</p>}
```

### 14.3 Card

```tsx
interface CardProps {
  variant?: 'default' | 'interactive' | 'pricing' | 'metric';
  padding?: 'sm' | 'md' | 'lg';
  hoverable?: boolean;
  selected?: boolean;
  onClick?: () => void;
  children: ReactNode;
}
```

| Variant | bg | border | shadow | radius | padding |
|---------|----|--------|--------|--------|---------|
| Default | `bg-secondary` | `border-primary` | level-1 | lg | lg (24px) |
| Interactive | `bg-secondary` | `border-primary` | level-1 → level-2 on hover | lg | lg |
| Pricing | `bg-secondary` (featured: `bg-primary` + brand-border) | `border-primary` | level-1 | lg | lg |
| Metric | `bg-secondary` | none | level-1 | lg | md (16px) |

**Interactive card hover:** translateY(-2px), shadow level-2, border `brand-primary`.
**Selected card:** border `brand-primary`, shadow brand-tinted.

### 14.4 Dialog / Modal

```tsx
interface DialogProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'full';
  closeOnOutsideClick?: boolean;
  closeOnEscape?: boolean;
}
```

| Size | Max width | Usage |
|------|-----------|-------|
| sm | 400px | Confirmations, key creation |
| md | 560px | Forms, settings |
| lg | 720px | Complex content |
| full | 100vw-64px | Query result detail |

**Behavior:**
- Backdrop: bg-black/50, click to close
- Focus trap on open (first focusable element or close button)
- Escape key closes
- `aria-labelledby` on title, `aria-describedby` on description
- Close button (X) top-right
- Enter animation: scale(0.95→1) + fade overlay, 250ms, spring easing
- Exit animation: scale(1→0.95) + fade, 150ms, ease-in

### 14.5 Table

```tsx
interface TableProps {
  columns: TableColumn[];
  data: any[];
  sortable?: boolean;
  filterable?: boolean;
  paginated?: boolean;
  pageSize?: number;
  onRowClick?: (row: any) => void;
  loading?: boolean;
  emptyState?: ReactNode;
  error?: string;
}
```

**States:**

| State | Visual |
|-------|--------|
| Loaded with data | Standard table |
| Empty | Centered empty state with illustration |
| Loading | Skeleton rows (3-5 pulsing rectangles) |
| Error | Error banner above table + retry button |
| Sorting | Active sort column: `text-brand` + sort indicator arrow |

**Specs:**
- Header: 13px/600, `text-secondary`, uppercase, letter-spacing 0.05em
- Cell: 14px/400, `text-primary`
- Row hover: `bg-tertiary`
- Container radius: md
- Cell padding: 12px 16px
- Bottom border: 1px `border-primary`
- Pagination: "Showing 1-10 of 247" + prev/next buttons

**Status badges in cells:**

| Variant | bg | Text color | Example |
|---------|----|-----------|---------|
| Active | `success-bg` | `success` | Active, Live, Connected |
| Inactive | muted | `text-tertiary` | Disabled, Paused |
| Warning | `warning-bg` | `warning` | Expiring, Near limit |
| Error | `error-bg` | `error` | Failed, Revoked |
| Neutral | `bg-tertiary` | `text-secondary` | Pending, Processing |

### 14.6 Toast / Notification

```tsx
interface Toast {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  title: string;
  description?: string;
  action?: { label: string; onClick: () => void };
  duration?: number; // milliseconds, 0 = persistent
  onDismiss?: () => void;
}
```

**Architecture:**
- Position: top-right, 24px from edges
- Stack: newest at top, max 3 visible (older auto-dismiss or collapse)
- Animation: slide in from right (+ translateX 100% → 0), spring easing, 300ms
- Dismiss: slide out to right (+ translateX 100%), 200ms
- Auto-dismiss: success=4s, info=6s, warning=8s, error=persistent
- Action button: ghost style, white text on dark bg

**Visual:**

| Type | Border left | Icon | bg |
|------|-------------|------|----|
| Success | `success` | CheckCircle | `bg-secondary` |
| Error | `error` | XCircle | `bg-secondary` |
| Warning | `warning` | AlertTriangle | `bg-secondary` |
| Info | `info` | Info | `bg-secondary` |

### 14.7 Dropdown Menu

Uses shadcn/ui `dropdown-menu.tsx` (Radix DropdownMenu).

**States:** default, hover (`bg-tertiary`), active, disabled (`text-tertiary` opacity-50), separator (`border-primary` h-[1px] my-1).

### 14.8 Tabs

```tsx
interface TabsProps {
  tabs: { id: string; label: string; icon?: LucideIcon; badge?: number }[];
  activeTab: string;
  onChange: (tabId: string) => void;
}
```

- Active: `text-brand` + 2px brand underline
- Inactive: `text-secondary`, hover → `text-primary`
- Gap: 24px between tabs
- Transition: cross-fade content 200ms

### 14.9 Command Palette

```tsx
interface CommandPaletteProps {
  open: boolean;
  onClose: () => void;
  commands: Command[];
}

interface Command {
  id: string;
  label: string;
  description?: string;
  icon?: LucideIcon;
  shortcut?: string;
  category: string;
  action: () => void;
}
```

**Behavior:**
- Trigger: `Cmd+K` (Mac) / `Ctrl+K` (Windows)
- Modal overlay, centered
- Search input at top, auto-focused on open
- Results grouped by category
- Empty state: "No results found" with suggestion to use different keywords
- Keyboard: arrow up/down navigation, Enter to select, Escape to close
- Visual: dialog (sm), search-style input, list below

### 14.10 Skeleton / Loading

| Pattern | Element | Visual |
|---------|---------|--------|
| Page skeleton | Full page | Pulsing rectangles matching layout structure |
| Card skeleton | Card | 3-4 pulsing rectangles (image + 2 text lines) |
| Table skeleton | Rows | 3 rows of 5 columns, pulsing |
| Text skeleton | Paragraph | 4 lines, varying width (100%, 80%, 90%, 60%) |
| Chart skeleton | Chart | Pulsing chart-shaped placeholder |

```css
@keyframes shimmer {
  0% { background-position: -200% 0; }
  100% { background-position: 200% 0; }
}

.skeleton {
  background: linear-gradient(90deg, var(--bg-secondary) 25%, var(--bg-tertiary) 50%, var(--bg-secondary) 75%);
  background-size: 200% 100%;
  animation: shimmer 1.5s ease-in-out infinite;
  border-radius: var(--radius-sm);
}
```

### 14.11 Avatar

| Size | Dimensions | Usage |
|------|-----------|-------|
| sm | 24×24px | Inline with text |
| md | 32×32px | Settings, list items |
| lg | 40×40px | Navigation header |
| xl | 64×64px | Profile page |

Fallback: initials on `brand-primary` bg, white text. `border-radius: full`.

### 14.12 Badge

| Variant | bg | Text | Border |
|---------|----|------|--------|
| Default | `bg-tertiary` | `text-secondary` | — |
| Success | `success-bg` | `success` | — |
| Warning | `warning-bg` | `warning` | — |
| Error | `error-bg` | `error` | — |
| Info | `info-bg` | `info` | — |
| Outline | transparent | `text-primary` | `border-primary` |

Sizes: sm (18px height, 10px px, 11px font), md (22px, 12px px, 12px font), lg (26px, 14px px, 13px font).

### 14.13 Navigation

**Marketing Nav:**
- Fixed top, height 64px
- Transparent on hero → white/dark solid on scroll (200px threshold)
- Logo left, links center, CTA right
- Mobile: hamburger menu, full-width overlay

**Dashboard Sidebar:**
- Fixed left, width 240px
- Full viewport height
- Logo at top, nav links (with active indicator), user/settings at bottom
- Collapsible on tablet (icon-only icons, labels hidden)
- Hidden on mobile (overlay panel, toggle via hamburger)

### 14.14 Progress Bar

| Variant | Height | bg | Fill color | Radius |
|---------|--------|----|------------|--------|
| Default | 4px | `bg-tertiary` | `brand-primary` | full |
| Thick | 8px | `bg-tertiary` | `brand-primary` | full |
| Usage | 8px | `bg-tertiary` | `brand-primary` (green if <80%, amber 80-95%, red >95%) | full |

### 14.15 Tooltip

| Property | Value |
|----------|-------|
| Trigger | Hover (200ms delay) / Focus |
| Dismiss | Mouse leave / blur / Escape |
| Position | Top (default), bottom, left, right |
| Max width | 280px |
| Padding | 6px 10px |
| bg | `text-primary` (dark), `bg-primary` (light) |
| Text | `text-inverse` (dark), `text-primary` (light) |
| Radius | sm |
| Font | 13px/400 |

### 14.16 Query Card (Dashboard)

```
┌────────────────────────────────────────────┐
│ "What is our refund policy?"               │
│                                             │
│ [hybrid]  [0.94]  [163ms]  [$0.0145]       │
│                                             │
│ Based on policy.pdf, p.3: "Customers may    │
│ return items within 30 days..."            │
│                                             │
│ [👍] [👎] [Details] [Copy] [Export]       │
└────────────────────────────────────────────┘
```

States: default, hover (elevated), selected (brand border), streaming (pulsing left border), error (red left border).

### 14.17 Metric Card

```
┌──────────────┐
│  [icon]      │
│  1,234       │
│  Queries     │
│  ↑ 12% vs last week
└──────────────┘
```

| State | Change indicator |
|-------|-----------------|
| Positive | Green text + up arrow |
| Negative | Red text + down arrow |
| Neutral | Gray text + dash |
| Loading | Skeleton variant |

### 14.18 Pricing Card

```
┌────────────────────┐
│  Pro               │
│  $199 / month      │
│                     │
│  ✓ 500K queries    │
│  ✓ Unlimited proj  │
│  ✓ Priority support│
│  ✓ 500 req/s       │
│                     │
│  [Start Free Trial] │
└────────────────────┘
```

- Recommended tier: 2px `brand-primary` border, "Most Popular" badge top-right
- Feature checkmarks: `success` color
- CTA: primary for recommended, secondary for others, ghost/disabled for unavailable

---

## 15. Form Patterns

### 15.1 Inline Validation

Validates on blur and on change after first blur (not on first keystroke).

```tsx
// Timing
const [touched, setTouched] = useState(false);
const validateOnBlur = () => setTouched(true);
const error = touched ? validate(value) : undefined;
```

### 15.2 Form Submission

| State | Button | Fields | Message |
|-------|--------|--------|---------|
| Idle | Enabled | Editable | — |
| Submitting | Loading spinner | Disabled | "Saving..." |
| Success | "Done" checkmark (1.5s) | Reset | Green flash on border |
| Error | Re-enabled | Editable | Error toast + inline errors |

### 15.3 Multi-Step Form (Onboarding)

- Step indicator at top: numbered circles, active = orange fill, completed = checkmark, future = gray outline
- Back/Continue buttons at bottom
- Form data persisted in local state (not API until final step)
- Allow navigation between steps (back edits previous)

---

## 16. Animation & Motion

### 16.1 Principles

1. **Fast** — 150-300ms for all interactions
2. **Subtle** — Motion supports, never distracts
3. **Purposeful** — Every animation has a reason
4. **Consistent** — Same duration/easing for same interaction types
5. **Accessible** — `prefers-reduced-motion` respected

### 16.2 Easing

```css
--ease-out-expo: cubic-bezier(0.16, 1, 0.3, 1);    /* Enter animations */
--ease-in-expo: cubic-bezier(0.4, 0, 0.2, 1);       /* Exit animations */
--ease-spring: cubic-bezier(0.34, 1.56, 0.64, 1);   /* Playful animations */
```

### 16.3 Animation Catalog

| Element | Trigger | Animation | Duration | Easing |
|---------|---------|-----------|----------|--------|
| Page transition | Route change | Fade 0→1 + slideUp 10px→0 | 200ms | ease-out-expo |
| Modal open | Open | Scale 0.95→1 + backdrop fade | 250ms | ease-out-expo |
| Modal close | Close | Scale 1→0.95 + backdrop fade | 150ms | ease-in-expo |
| Dropdown open | Open | Fade + slideDown -4px→0 | 150ms | ease-out-expo |
| Tooltip | Hover 200ms | Fade 0→1 | 100ms | ease-out-expo |
| Card hover | Hover | translateY -2px + shadow | 200ms | ease-out-expo |
| Button hover | Hover | Scale 1.02 | 150ms | ease-out-expo |
| List stagger | Mount | Each item fade 0→1 + slideUp 10px→0 | Stagger 50ms per item | ease-out-expo |
| Accordion | Click | Height 0→auto | 200ms | ease-out-expo |
| Toast enter | Auto | slideInRight (100%→0) | 300ms | ease-spring |
| Toast exit | Dismiss | slideOutRight (0→100%) | 200ms | ease-in-expo |
| Progress bar | Value change | Width 0→N% | 300ms | ease-out-expo |
| Tab switch | Click | Content cross-fade | 200ms | ease-out-expo |
| Skeleton | Mount | Shimmer gradient | 1.5s infinite | linear |
| Spinner | Continuous | Rotate 360deg | 1s infinite | linear |

### 16.4 Hero Animation (Landing Page)

**Concept:** Code editor-like background with real-time query flow visualization.

- Background: Subtle grid pattern (dotted lines, `border-primary` color, 20% opacity)
- Floating elements: Strategy cards (Simple/Complex/Multi-hop) that drift upward slowly (20s cycle)
- Query flow: SVG path animation showing a query being classified (query dot travels along a branching path)
  - Start at input node → branches to 3 strategy nodes → ends at output node
  - Real-time metrics (confidence, latency, cost) appear at each node
  - Animation loop: 8s per cycle, continuous
- Responsive: Complex on desktop, simplified on mobile (static diagram instead of animated)

### 16.5 Framer Motion Recommendations

```tsx
// Page transition wrapper
const pageVariants = {
  initial: { opacity: 0, y: 10 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.2, ease: [0.16, 1, 0.3, 1] } },
  exit: { opacity: 0, y: -10, transition: { duration: 0.15, ease: [0.4, 0, 0.2, 1] } },
};

// Card hover
<motion.div whileHover={{ y: -2 }} transition={{ duration: 0.2, ease: easeOutExpo }}>

// Stagger children
const staggerContainer = { animate: { transition: { staggerChildren: 0.05 } } };
const staggerItem = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
};

// Modal spring
<AnimatePresence>
  {open && (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ type: 'spring', stiffness: 300, damping: 25 }}
    />
  )}
</AnimatePresence>
```

### 16.6 prefers-reduced-motion

```css
/* Disable all non-essential animations */
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }
}
```

---

## 17. Dark Mode Implementation

### Strategy

- CSS custom properties on `:root` and `.dark`
- `prefers-color-scheme` media query for default
- Manual toggle in dashboard settings (persists to localStorage)
- Smooth transition: bg 300ms + text 200ms

### Implementation

```css
:root {
  --bg-primary: #FFFFFF;
  --bg-secondary: #F5F5F5;
  --text-primary: #0A0A0A;
  /* ... all light mode tokens */
}

@media (prefers-color-scheme: dark) {
  :root {
    --bg-primary: #0B0F14;
    --bg-secondary: #14181D;
    --text-primary: #F0F0F0;
    /* ... all dark mode tokens */
  }
}

.dark {
  --bg-primary: #0B0F14;
  --bg-secondary: #14181D;
  --text-primary: #F0F0F0;
  /* ... all dark mode tokens */
}
```

### Per-Section Rules

| Area | Default | Option |
|------|---------|--------|
| Marketing site | Light | Dark toggle in footer |
| Dashboard | Dark | Light toggle in settings |
| Docs | System preference | Manual toggle |
| Blog | Light | Dark toggle |
| Landing page | Light (hero may use dark section) | — |

---

## 18. Data Visualization

### Chart Types

| Chart | Usage | Visual |
|-------|-------|--------|
| Line | Trends over time | 2px stroke, smooth curve, brand-orange |
| Area | Cumulative volume | 20% opacity brand-orange fill under line |
| Bar | Comparison | Rounded top (4px), brand-orange, 4px gap |
| Donut | Distribution | 12px thickness, brand-orange primary, gray secondary |
| Histogram | Score distribution | Rounded bars, brand-orange |

### Chart Principles

1. **Clean** — No gridlines unless necessary for value reading
2. **Minimal** — One brand color, one neutral, one semantic (if needed)
3. **Labeled** — All axes labeled, tooltips on hover
4. **Interactive** — Hover tooltips, click for drill-down where applicable
5. **Accessible** — Data table fallback below chart (screen reader accessible)

### Tooltip Design

```
┌──────────────────────┐
│  June 15, 2026       │
│  ─────────────────   │
│  Queries: 2,841      │
│  Latency: 163ms      │
│  Cost: $41.20        │
└──────────────────────┘
```

- bg: `bg-primary` (inverse), level-3 shadow
- padding: 12px 16px
- radius: md
- font: 13px/400, labels `text-secondary`, values `text-primary`

---

## 19. Error & Success States

### Toast Notifications

| Type | Icon | Color | Duration |
|------|------|-------|----------|
| Success | CheckCircle | `success` | 4s auto-dismiss |
| Error | XCircle | `error` | Persistent (manual dismiss) |
| Warning | AlertTriangle | `warning` | 8s auto-dismiss |
| Info | Info | `info` | 6s auto-dismiss |

### Inline Errors

- Red text below input, 13px/400
- Icon (AlertTriangle, 14px) left of message
- Border turns red
- `aria-invalid="true"` on input

### Page Errors

| Type | Illustration | Message | Action |
|------|-------------|---------|--------|
| 404 | Pattern B | "Page not found" | "Go home" |
| 500 | Pattern B | "Something went wrong" | "Try again" / "Contact support" |
| Network | Pattern B | "Connection lost" | "Retry" |
| Empty | Pattern A | "No data yet" | "Get started" CTA |

---

## 20. Empty States

Every empty state must include:
1. Illustration (abstract geometric, inline SVG)
2. Title (what's missing)
3. Description (why it's empty, what to do)
4. CTA button

### Empty State Registry

| Context | Title | Description | CTA |
|---------|-------|-------------|-----|
| No projects | "No projects yet" | "Create your first project to start using Kairos." | "Create Project" |
| No queries | "No queries yet" | "Execute your first query to see adaptive retrieval in action." | "Execute Query" |
| No API keys | "No API keys" | "Create an API key to integrate Kairos into your application." | "Create Key" |
| No documents | "No documents" | "Upload documents to give Kairos something to search and retrieve from." | "Upload Document" |
| No analytics | "Not enough data" | "Analytics will appear once you've executed some queries. Run a few to get started." | "Execute Query" |
| No search results | "No results found" | "Try different keywords or check your document sources." | — |
| No team members | "No team members yet" | "Invite your team to collaborate on projects." (Enterprise) | "Invite Members" |

---

## 21. Page Templates

### Marketing Page Template

```
[Navbar — transparent/white on scroll, 64px height]
[Hero — full viewport, centered content, animated bg]
[Section 1 — 2-column, image right, text left]
[Section 2 — full-width, centered]
[Section 3 — grid/cards]
[Section 4 — full-width data or comparison]
[Pricing — 3-4 card grid]
[FAQ — accordion]
[CTA — full-width banner]
[Footer — 4-column + logo + legal]
```

### Dashboard Page Template

```
[Sidebar — 240px, fixed]
  [Logo]
  [Nav links with active state]
  [User section at bottom]
[Topbar — 64px]
  [Breadcrumb / page title] [Search] [Notifications] [Avatar]
[Content area]
  [Page-specific content]
```

### Auth Page Template

```
[Centered card, max-width 400px]
  [Logo centered, 40px height]
  [Title + description]
  [Form / OAuth buttons]
  [Footer links (sign up / sign in)]
[Minimal, no nav/footer distraction]
```

---

## 22. Component Implementation Stack

| Category | Library / Tool | Reason |
|----------|---------------|--------|
| UI primitives | shadcn/ui (Radix-based) | Accessible, customizable, tree-shakeable |
| Icons | Lucide React | Clean design, tree-shakeable, 2px stroke |
| Animation | Framer Motion | React-native, performant, spring physics |
| Forms | React Hook Form + Zod | Performant, TypeScript-first validation |
| Data fetching | TanStack Query v5 | Caching, deduplication, SSR support |
| Charts | Recharts | React-native, composable, good defaults |
| Tables | TanStack Table | Headless, sort/filter/paginate, any UI |
| Date handling | date-fns | Tree-shakeable, immutable |
| Rich text | MDX | For docs/blog content |
| Theme | next-themes | SSR-safe theme management |
| Authentication | Auth.js (NextAuth v5) | Built for Next.js, multiple providers |
| Styling | Tailwind CSS v4 | Utility-first, consistent, JIT |
| Typography | @tailwindcss/typography | Prose styling for docs/blog |

---

## 23. File Structure

```
apps/portal/
├── app/
│   ├── globals.css              # Tailwind v4 + theme tokens
│   ├── layout.tsx               # Root layout with providers
│   ├── page.tsx                  # Landing page
│   ├── features/page.tsx
│   ├── pricing/page.tsx
│   ├── docs/page.tsx
│   ├── blog/page.tsx
│   ├── (auth)/
│   │   ├── login/page.tsx
│   │   ├── signup/page.tsx
│   │   └── forgot-password/page.tsx
│   ├── (dashboard)/
│   │   ├── layout.tsx           # Dashboard layout (sidebar + topbar)
│   │   ├── home/page.tsx
│   │   ├── projects/page.tsx
│   │   ├── queries/page.tsx
│   │   ├── analytics/page.tsx
│   │   ├── api-keys/page.tsx
│   │   ├── billing/page.tsx
│   │   └── settings/page.tsx
│   └── api/                      # Next.js API routes (auth proxies)
├── components/
│   ├── ui/                       # shadcn/ui primitives
│   ├── marketing/                # Landing page components
│   ├── dashboard/                # Dashboard components
│   ├── auth/                     # Auth form components
│   └── shared/                   # Cross-app components
├── lib/
│   ├── utils.ts                  # cn() helper
│   └── api.ts                   # TanStack Query client + API helpers
├── hooks/                        # Custom React hooks
├── providers/                    # Context providers (theme, auth, query)
├── types/                        # TypeScript types
└── public/                       # Static assets, favicon, OG image
```
