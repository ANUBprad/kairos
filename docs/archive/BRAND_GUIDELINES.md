# Brand Guidelines

**Phase 15 — Product Definition & UX Blueprint**  
**Status:** Superseded by PHASE16_DESIGN_SYSTEM.md

---

## Brand Identity

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

| Attribute | How It Sounds |
|-----------|--------------|
| Confident | "Kairos classifies, plans, and routes every query." (Not "Kairos tries to...") |
| Precise | Specific numbers, concrete claims, no vague marketing language |
| Calm | No hype, no exclamation points, no pressure |
| Technical | Assumes intelligence; explains complexity without condescension |
| Human | Warm but professional. Think thoughtful engineer, not corporate marketer |

---

## Logo

### Primary Logo

`docs/assets/logo/kairos-light.png` (light theme) / `docs/assets/logo/kairos-dark.png` (dark theme)

The Kairos logo is an orange paper-style maple leaf. It represents:
- **Adaptability** — A leaf changes with seasons; Kairos adapts to every query
- **Precision** — Clean, sharp leaf lines reflect engineered precision
- **Growth** — Organic shape balanced with geometric structure

### Usage Rules

| Rule | Detail |
|------|--------|
| Minimum size | 24px (digital), 0.5in (print) |
| Clear space | Equal to the leaf width on all sides |
| Background | Light backgrounds: full-color logo. Dark backgrounds: white/orange variant |
| Never | Recolor, rotate, add effects, place on busy backgrounds, combine with other marks |

### Logo Variations

Only ONE official logo exists. Do not create alternate versions, simplified marks, or icon-only variants. The full logo must always be used.

---

## Color Palette

### Primary Colors

| Color | Hex | Usage |
|-------|-----|-------|
| Leaf Orange | `#FF5A0A` | Primary actions, brand accents, links |
| Dark Background | `#0B0F14` | Page backgrounds (dark mode) |
| White | `#FFFFFF` | Page backgrounds (light mode), text on dark |

### Neutral Colors

| Token | Light | Dark | Usage |
|-------|-------|------|-------|
| Background | `#FFFFFF` | `#0B0F14` | Page background |
| Surface | `#F5F5F5` | `#14181D` | Cards, panels |
| Border | `#E5E5E5` | `#1F2530` | Dividers, inputs |
| Text Primary | `#0A0A0A` | `#F0F0F0` | Headings, body |
| Text Secondary | `#6B6B6B` | `#8B8B8B` | Labels, captions |
| Text Tertiary | `#A0A0A0` | `#5C5C5C` | Placeholders, disabled |

### Semantic Colors

| Token | Light | Dark | Usage |
|-------|-------|------|-------|
| Success | `#22C55E` | `#22C55E` | Confirmation, positive metrics |
| Warning | `#F59E0B` | `#F59E0B` | Alerts, near-limits |
| Error | `#EF4444` | `#EF4444` | Errors, failures |
| Info | `#3B82F6` | `#3B82F6` | Information, links |

---

## Typography

### Font Stack

| Usage | Font | Fallback |
|-------|------|----------|
| Headings | Inter (Bold/ExtraBold) | system-ui, sans-serif |
| Body | Inter (Regular/Medium) | system-ui, sans-serif |
| Code | JetBrains Mono | monospace |

### Type Scale

| Level | Size | Weight | Line Height | Usage |
|-------|------|--------|-------------|-------|
| Display | 72px / 4.5rem | 800 | 1.1 | Hero headline |
| H1 | 48px / 3rem | 700 | 1.2 | Page title |
| H2 | 36px / 2.25rem | 700 | 1.25 | Section heading |
| H3 | 24px / 1.5rem | 600 | 1.3 | Card heading |
| H4 | 20px / 1.25rem | 600 | 1.4 | Subsection |
| Body Large | 18px / 1.125rem | 400 | 1.6 | Lead paragraph |
| Body | 16px / 1rem | 400 | 1.6 | Default text |
| Body Small | 14px / 0.875rem | 400 | 1.5 | Captions, metadata |
| Caption | 12px / 0.75rem | 400 | 1.4 | Labels, timestamps |

---

## Spacing

| Token | Value | Usage |
|-------|-------|-------|
| 0 | 0px | None |
| 1 | 4px | Micro spacing |
| 2 | 8px | Tight spacing |
| 3 | 12px | Dense spacing |
| 4 | 16px | Default spacing |
| 5 | 20px | Comfortable |
| 6 | 24px | Section padding |
| 8 | 32px | Double default |
| 10 | 40px | Section gap |
| 12 | 48px | Page padding |
| 16 | 64px | Large section gap |
| 20 | 80px | Hero padding |

---

## Border Radius

| Token | Value | Usage |
|-------|-------|-------|
| sm | 4px | Inputs, small elements |
| md | 8px | Cards, modals |
| lg | 12px | Large cards, containers |
| xl | 16px | Page sections |
| full | 9999px | Badges, avatars |

---

## Elevation

| Token | Light | Dark | Usage |
|-------|-------|------|-------|
| 0 | None | None | Flat surfaces |
| 1 | `0 1px 2px rgba(0,0,0,0.05)` | `0 1px 2px rgba(0,0,0,0.2)` | Cards, inputs |
| 2 | `0 2px 8px rgba(0,0,0,0.08)` | `0 2px 8px rgba(0,0,0,0.3)` | Dropdowns, popovers |
| 3 | `0 4px 16px rgba(0,0,0,0.1)` | `0 4px 16px rgba(0,0,0,0.4)` | Modals, sidebars |
| 4 | `0 8px 32px rgba(0,0,0,0.12)` | `0 8px 32px rgba(0,0,0,0.5)` | Full-screen overlays |

---

## Motion Principles

### Duration

| Action | Duration | Easing |
|--------|----------|--------|
| Micro-interactions | 150ms | ease-out |
| Element transitions | 200ms | ease-out |
| Page transitions | 300ms | ease-in-out |
| Modals / overlays | 250ms | ease-out |

### Animation Types

| Type | When | Example |
|------|------|---------|
| Fade | Element appears/disappears | Tooltips, dropdowns |
| Slide | Element enters from edge | Sidebar, modal backdrop |
| Scale | Element grows from center | Modal content, card hover |
| Stagger | Multiple elements in sequence | List animations, grid reveals |

### Motion Principles

1. **Fast** — Animations complete before users wait
2. **Subtle** — Motion supports, never distracts
3. **Purposeful** — Every animation has a reason (spatial orientation, state change, attention direction)
4. **Consistent** — Same duration/easing for same interaction types

---

## Iconography

### Icon Set

Use **Lucide Icons** exclusively. They match Kairos' design language: clean, consistent, precise, geometric.

### Icon Sizes

| Context | Size |
|---------|------|
| Inline with text | 16px |
| Navigation | 20px |
| Buttons | 20px |
| Feature icons | 24px |
| Large indicators | 32px |

### Icon Style

- Stroke width: 2px
- Rounded caps: round
- Rounded joints: round
- Color: inherit (match text color)
- No filled variants except for active states

---

## Illustration Style

### Principles

1. **Abstract geometric** — Not literal, not illustrative
2. **Orange leaf influence** — Warm tones, organic-meets-geometric shapes
3. **Minimal** — Single focal point, plenty of negative space
4. **Dark-friendly** — Works in both modes without modification

### Style Guide

| Element | Specification |
|---------|--------------|
| Shapes | Circles, rounded rectangles, leaf-inspired curves |
| Colors | Orange (#FF5A0A), dark (#0B0F14), warm gray |
| Gradients | Optional, subtle, orange-to-warm |
| Lines | 2px stroke, rounded |
| Fills | Mostly empty space, selective fills for emphasis |

---

## Empty States

Every empty state must include:
1. Illustration (abstract geometric, inline SVG)
2. Title (what's missing)
3. Description (why it's empty)
4. CTA (what to do next)

### Design Pattern

```
┌──────────────────────┐
│                       │
│     [illustration]    │
│                       │
│  No queries yet       │
│                       │
│  Execute your first   │
│  query to see results │
│  here.                │
│                       │
│  [+ Execute Query]    │
│                       │
└──────────────────────┘
```

---

## Loading States

| Type | Visual | Usage |
|------|--------|-------|
| Skeleton | Pulsing gray rectangles | Page/panel loading |
| Spinner | Rotating orange ring | Button loading |
| Progress | Orange bar with fill | Document upload, export |
| Shimmer | Animated gradient | Card skeletons |

---

## Error & Success States

| State | Visual | Duration |
|-------|--------|----------|
| Success toast | Green background, check icon | 4s auto-dismiss |
| Error toast | Red background, X icon | Persistent until dismissed |
| Inline error | Red text below input | Persistent until fixed |
| Empty error | Full page with illustration + retry | Persistent |
| Form success | Green border flash | 1.5s then reset |
