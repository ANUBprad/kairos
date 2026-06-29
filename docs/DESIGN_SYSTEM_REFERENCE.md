# Design System Reference

> **Version:** 1.0  
> **Engine:** Tailwind CSS v4 with `@theme`  
> **Scope:** All design tokens, utilities, and patterns

---

## 1. Color System

### Brand Colors

| Token | Dark Value | Light Value |
|---|---|---|
| `brand` | `#FF5A0A` | `#FF5A0A` |
| `brand-hover` | `#E54E00` | `#E54E00` |
| `brand-active` | `#CC4400` | `#CC4400` |
| `brand-light` | `#FFF0E5` | `#FFF0E5` |
| `brand-muted` | `rgba(255, 90, 10, 0.12)` | `rgba(255, 90, 10, 0.12)` |

### Semantic Colors

| Token | Dark Value | Light Value | Usage |
|---|---|---|---|
| `bg` | `#0B0F14` | `#FFFFFF` | Page background |
| `bg-secondary` | `#14181D` | `#F5F5F5` | Secondary surfaces |
| `surface` | `#14181D` | `#F5F5F5` | Card/surface backgrounds |
| `surface-hover` | `#1A2433` | `#EEEEEE` | Surface hover state |
| `border` | `#2A2A2A` | `#E5E5E5` | Default borders |
| `border-hover` | `#3A3A3A` | `#D0D0D0` | Hover borders |

### Text Colors

| Token | Dark Value | Light Value | Usage |
|---|---|---|---|
| `text-primary` | `#F0F0F0` | `#0A0A0A` | Primary content, headings |
| `text-secondary` | `#8B8B8B` | `#6B6B6B` | Body text, descriptions |
| `text-tertiary` | `#5C5C5C` | `#A0A0A0` | Labels, metadata, placeholders |

### Status Colors

| Token | Value | Usage |
|---|---|---|
| `success` | `#22C55E` | Positive states, check icons |
| `success-bg` | `#052E16` (dark) / `#F0FDF4` (light) | Success background tint |
| `warning` | `#F59E0B` | Warning badges, alerts |
| `error` | `#EF4444` | Error states, X icons |
| `info` | `#3B82F6` | Info badges, accent highlights |

### Color Usage Rules

1. **Brand** is accent-only. Never use as dominant background.
2. **Text contrast**: primary on bg = 14.5:1 (dark) / 14.3:1 (light) — exceeds WCAG AAA
3. **Text contrast**: secondary on bg = 7.5:1 (dark) / 5.0:1 (light) — meets WCAG AA
4. **Status colors** appear on tinted backgrounds only (10% opacity), never full-strength
5. **Dark theme** is default. Light theme requires `.light` class on `<html>`

### Color Class Reference

```
Text:          text-text-primary / text-text-secondary / text-text-tertiary / text-brand
Background:    bg-bg / bg-bg-secondary / bg-surface / bg-surface-hover
Border:        border-border / border-border-hover / border-brand / border-brand/30
Badge BG:      bg-brand/10 / bg-success/10 / bg-warning/10 / bg-info/10
Badge Border:  border-brand/30 / border-success/30 / border-warning/30 / border-info/30
```

---

## 2. Typography

### Font Family

```css
--font-sans: "Plus Jakarta Sans", system-ui, sans-serif;
```

### Font Weights

| Weight | Name | Usage |
|---|---|---|
| 400 | Regular | Body text, paragraphs |
| 500 | Medium | Button labels, card titles |
| 600 | Semibold | Headings (h1, h2) |
| 700 | Bold | Strong emphasis (rare) |

### Type Scale

| Level | Size | Line Height | Weight | Tracking | Usage |
|---|---|---|---|---|---|
| H1 | `36px` (responsive to `28px` on mobile) | `1.1` | 600 | `-0.02em` | Hero headline |
| H2 | `28px` → `36px` (sm+) | `1.2` | 600 | `-0.02em` | Section headings |
| H3 | `18px` | `1.3` | 600 | — | Card titles |
| Body | `16px` | `1.6` | 400 | — | Paragraphs, descriptions |
| Body Large | `18px` | `1.6` | 400 | — | Section subheadings |
| Button | `13px` (sm), `14px` (md), `15px` (lg), `16px` (xl) | — | 500 | — | All buttons |
| Small | `13px` | — | 500 | — | Badges, footnotes |
| Micro | `11px` | — | 600 | `0.10–0.12em` | Labels, category headers |
| Code | `14px` (monospace inherited from system) | — | 400 | — | Code blocks, inline code |

### Typography Rules

1. **No more than 2 heading levels per section** (h2 + optional h3)
2. **Line length**: max `60ch` for body text (enforced by `max-w-2xl` on subheadings)
3. **No justified text**
4. **Code** inherits system monospace (no explicit font-family declaration for code)
5. `tracking-tight` on all headings for density
6. `antialiased` enabled globally

---

## 3. Spacing Scale

| Token | Pixels | Tailwind Class | Usage |
|---|---|---|---|
| 2 | 8px | `gap-2`, `p-2` | Tight icon gaps |
| 3 | 12px | `gap-3`, `p-3` | Card internal spacing |
| 4 | 16px | `gap-4`, `p-4` | Button padding, small elements |
| 5 | 20px | `gap-5`, `p-5` | Card padding |
| 6 | 24px | `gap-6`, `p-6` | Section internal spacing |
| 8 | 32px | `gap-8` | Between related sections |
| 10 | 40px | `gap-10` | Between sub-sections |
| 12 | 48px | `gap-12` | Between major sections |
| 14 | 56px | `mt-14` | Heading to content gap |
| 16 | 64px | `gap-16` | Wide separations |
| 20 | 80px | `py-20` | Section padding (mobile) |
| 28 | 112px | `py-28` | Section padding (desktop) |

### Section Spacing Pattern

```
py-20 md:py-28   (section top/bottom padding)
mt-14            (heading to content gap)
mt-4             (heading to subheading gap)
```

---

## 4. Grid & Layout

### Container

```
max-w-[1280px] mx-auto px-6 sm:px-8
```

### Grid Patterns

| Pattern | Columns | Gap | Usage |
|---|---|---|---|
| Full-width hero | 1 (flex row) | — | Hero |
| 2-col feature | `grid-cols-1 md:grid-cols-2` | `gap-6` | Features, Security, About |
| 3-col feature | `grid-cols-1 sm:grid-cols-2 lg:grid-cols-3` | `gap-5` | FeaturesGrid |
| 4-col pricing | `grid-cols-1 sm:grid-cols-2 lg:grid-cols-4` | `gap-6` | Pricing |
| 6-col integrations | `grid-cols-2 sm:grid-cols-3 lg:grid-cols-6` | `gap-3` | Integrations |
| 4-col footer | `grid-cols-2 md:grid-cols-4` | — | Footer |
| 2-col auth | `flex flex-col lg:flex-row` | — | Auth layout |

### Breakpoints

| Breakpoint | Width | Tailwind |
|---|---|---|
| Mobile | < 640px | Default (no prefix) |
| Tablet | 640px+ | `sm:` |
| Desktop | 1024px+ | `lg:` |
| Wide | 1280px+ | `xl:` |

---

## 5. Border Radius

| Token | Value | Tailwind | Usage |
|---|---|---|---|
| `--radius-sm` | `6px` | `rounded-sm` | Badges, small elements |
| `--radius-md` | `10px` | `rounded-[10px]` | Buttons, inputs, integration cards |
| `--radius-lg` | `14px` | `rounded-[14px]` | Cards, pricing cards |
| `--radius-xl` | `18px` | `rounded-[18px]` | Large containers |
| `--radius-2xl` | `24px` | `rounded-[24px]` | Auth panel, hero code block |
| `--radius-full` | `9999px` | `rounded-full` | Avatars, circles |

> **Note:** Tailwind v4 does not auto-generate utilities from `--radius-*` tokens. Radii are applied with arbitrary values: `rounded-[10px]`, `rounded-[14px]`, etc.

---

## 6. Shadows

| Token | Dark Value | Light Value | Usage |
|---|---|---|---|
| `shadow-sm` | `0 1px 2px rgba(0,0,0,0.2)` | `0 1px 2px rgba(0,0,0,0.04)` | — |
| `shadow-md` | `0 2px 8px rgba(0,0,0,0.3)` | `0 2px 8px rgba(0,0,0,0.06)` | — |
| `shadow-lg` | `0 4px 16px rgba(0,0,0,0.4)` | `0 4px 16px rgba(0,0,0,0.08)` | Card hover |
| `shadow-xl` | `0 8px 32px rgba(0,0,0,0.5)` | `0 8px 32px rgba(0,0,0,0.1)` | Modals |
| `shadow-glow` | `0 0 30px rgba(255,90,10,0.15)` | `0 0 20px rgba(255,90,10,0.1)` | Card glow hover |
| `shadow-glow-strong` | `0 0 60px rgba(255,90,10,0.25)` | `0 0 40px rgba(255,90,10,0.15)` | Pro pricing glow |

---

## 7. Borders

| Token | Dark | Light | Usage |
|---|---|---|---|
| `border-border` | `1px solid #2A2A2A` | `1px solid #E5E5E5` | Default card/component borders |
| `border-border-hover` | `1px solid #3A3A3A` | `1px solid #D0D0D0` | Hover states |
| `border-brand` | `1px solid #FF5A0A` | Same | Active/interactive borders |
| `border-brand/xx` | With opacity | Same | Glow borders (30%, 40%) |

---

## 8. Buttons

### Structure

```css
inline-flex items-center justify-center gap-2 whitespace-nowrap
rounded-[10px] font-medium select-none
transition-all duration-200 ease-out
focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand
```

### Variants

| Variant | Style |
|---|---|
| `primary` | `bg-brand text-white hover:bg-brand-hover active:bg-brand-active active:scale-[0.97]` |
| `secondary` | `bg-transparent border border-border text-text-primary hover:bg-surface hover:border-border-hover active:scale-[0.97]` |
| `ghost` | `bg-transparent text-text-secondary hover:bg-surface hover:text-text-primary` |

### Sizes

| Size | Height | Padding X | Font Size |
|---|---|---|---|
| `sm` | `36px (h-9)` | `16px (px-4)` | `13px` |
| `md` | `40px (h-10)` | `20px (px-5)` | `14px` |
| `lg` | `48px (h-12)` | `28px (px-7)` | `15px` |
| `xl` | `56px (h-14)` | `36px (px-9)` | `16px` |

### States

| State | Effect |
|---|---|
| Default | Per variant |
| Hover | Per variant (bg/border change) |
| Active | `scale-[0.97]` (primary, secondary) |
| Disabled | `opacity-40 pointer-events-none` |
| Focus-visible | `outline-2 outline-brand outline-offset-2` |

---

## 9. Cards

### Structure (Card)

```css
rounded-[14px] border border-border bg-surface p-6
transition-all duration-200
```

### Interactive Card (CardInteractive)

```css
/* Same as Card + */
hover:-translate-y-[2px] hover:border-border-hover hover:shadow-lg
transition-all duration-300 cursor-pointer
```

---

## 10. Forms

### Input Structure

```css
w-full rounded-[10px] border border-border bg-bg px-4 py-2.5
text-[15px] text-text-primary placeholder:text-text-tertiary/60
transition-all duration-200
focus:outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand/50
```

### Label Structure

```css
block text-sm font-medium text-text-secondary mb-1.5
```

### Form Layout

```css
/* Single column form */
flex flex-col gap-4

/* Auth form container */
max-w-md mx-auto w-full
```

---

## 11. Glass Effect

```css
/* Utility: glass */
background: rgba(20, 24, 29, 0.6);
backdrop-filter: blur(20px);
-webkit-backdrop-filter: blur(20px);
border-bottom: 1px solid rgba(42, 42, 42, 0.6);

/* Light mode override */
.light .glass {
  background: rgba(255, 255, 255, 0.7);
  border-bottom: 1px solid rgba(229, 229, 229, 0.7);
}
```

---

## 12. Background Patterns

### Dot Grid

```css
background-image: radial-gradient(circle at 1px 1px, rgba(255,90,10,0.08) 1px, transparent 0);
background-size: 28px 28px;
```

### Orange Radial Glow

```css
background: radial-gradient(circle, #FF5A0A 0%, transparent 70%);
/* Applied to a 500px rounded div with blur(120px) and opacity 0.04 */
```

### Auth Panel Dot Grid

```css
background-image: radial-gradient(circle at 1px 1px, rgba(255,255,255,0.04) 1px, transparent 0);
background-size: 24px 24px;
```

---

## 13. Icons

- **Library:** Lucide React
- **Style:** Monochrome, inherit text color (`currentColor`)
- **Sizing:** `w-4 h-4` (16px) standard, `w-5 h-5` (20px) for integration logos
- **Integration Logos:** Custom inline SVG, `currentColor`, `size` prop (default 24px)

---

## 14. Dark / Light Mode

### Mechanism

1. Inline `<script>` in `layout.tsx` checks `localStorage.getItem("theme")`
2. If `"light"`, adds `.light` class to `<html>` before paint (avoids FOUC)
3. No class = dark mode (default)
4. `ThemeToggle` component toggles localStorage and `document.documentElement.classList`

### Transition

```css
body {
  transition: background-color 300ms ease, color 200ms ease;
}
```

### Light Mode Overrides

Only these tokens change in light mode:
- Backgrounds (`bg`, `bg-secondary`, `surface`, `surface-hover`)
- Borders (`border`, `border-hover`)
- Text (`text-primary`, `text-secondary`, `text-tertiary`)
- Shadows (reduced opacity)
- Success bg (`success-bg`)

### Light Mode Testing

- Every page should be checked with `.light` class on `<html>`
- Glass effect should have white semi-transparent background
- Cards should use `#F5F5F5` surface on `#FFFFFF` bg

---

## 15. Motion Rules

### Default Easing

```typescript
const ease = [0.16, 1, 0.3, 1] as const;
```

### Timing

| Context | Duration |
|---|---|
| Scroll reveal entrance | 500ms |
| Stagger child delay | 40–120ms |
| Card hover | 200–300ms |
| Button hover | 200ms |
| Button active | Instant (`active:` pseudo) |
| Accordion slide | 200ms |
| Bar chart fill | 800ms |
| Nav scroll transition | 300ms |
| Theme toggle transition | 300ms (bg), 200ms (text) |

### What Animates

- `opacity` and `transform` (translate, scale) — GPU-accelerated
- `box-shadow` — only for pulsing glow (use sparingly)
- `background-color`, `border-color` — via CSS transition

### What Does NOT Animate

- `width`, `height` (except accordion content which uses Radix's built-in animation)
- `top`, `left`, `right`, `bottom`
- `margin`, `padding`

### Reduced Motion

```css
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

## 16. Z-Index Stack

| Layer | Value | Elements |
|---|---|---|
| Base | `0` | Page content |
| Decorative | `10` | Background orbs, dot grids |
| Sticky nav | `50` | Navigation bar |
| Mobile menu | `60` | Full-screen nav overlay |
| Modal/Overlay | `70` | (Future) |

---

## 17. Key CSS Utilities

```css
@utility text-balance { text-wrap: balance; }
@utility glass { /* see Glass Effect section */ }
@utility glow { box-shadow: var(--shadow-glow); }
@utility glow-strong { box-shadow: var(--shadow-glow-strong); }
@utility animate-accordion-down { animation: accordion-down 200ms ease-out; }
@utility animate-accordion-up { animation: accordion-up 200ms ease-out; }
```

---

*End of DESIGN_SYSTEM_REFERENCE.md*
