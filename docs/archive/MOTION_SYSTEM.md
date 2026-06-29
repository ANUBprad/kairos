# Kairos — Motion System

> **Document**: Complete Animation & Transition Design System  
> **Product**: Kairos — Adaptive Knowledge Intelligence  
> **Status**: LOCKED — Phase 13  
> **Author**: Apple / Linear Interaction Design Team

---

## 1. Motion Philosophy

| Principle | Application |
|-----------|-------------|
| **Purposeful** | Every animation has a reason — direction, focus, feedback, or delight. Never decorative. |
| **Subtle** | Micro-movements (2–4px, 200–300ms). Nothing that calls attention to itself. |
| **Fast** | Animations complete in 150–300ms. Users should never wait for an animation to finish. |
| **Consistent** | Same easing curves, same durations, same patterns everywhere. Predictable motion language. |
| **Performance-first** | Animations use GPU-accelerated properties only (`opacity`, `transform`). Never animating `width`, `height`, `top`, `left`. |

### Motion Personality

| Trait | Expression |
|-------|-----------|
| **Precise** | Ease-out cubic bezier (0.16, 1, 0.3, 1). No bouncy or elastic curves. |
| **Responsive** | Immediate feedback on interaction (0ms delay). Deliberate reveals on scroll (100ms stagger). |
| **Calm** | Staggered reveals create a sense of order. No simultaneous animations. |
| **Premium** | Subtle glows, gentle lifts, smooth gradients. Nothing feels mechanical or cheap. |

---

## 2. Easing Curves

```css
/* Primary easing — used for all UI animations */
--ease-out-expo: cubic-bezier(0.16, 1, 0.3, 1);
--ease-in-out: cubic-bezier(0.65, 0, 0.35, 1);
--ease-out: cubic-bezier(0, 0, 0.2, 1);
--ease-in: cubic-bezier(0.12, 0, 1, 1);
```

| Curve | Usage |
|-------|-------|
| `ease-out-expo` | **Default** — page transitions, card reveals, modal appears |
| `ease-out` | Scroll reveals, hover effects, button presses |
| `ease-in-out` | Loading shimmer, skeleton pulse |
| `ease-in` | Modal exits, element removals |

---

## 3. Duration Tokens

```css
--duration-instant: 0ms;
--duration-fast: 100ms;
--duration-normal: 200ms;
--duration-slow: 300ms;
--duration-reveal: 500ms;
--duration-page: 800ms;
```

| Duration | Usage |
|----------|-------|
| `instant` | Theme toggle, color changes |
| `fast` | Hover effects, button press, active states |
| `normal` | Card hover lift, border transitions, icon rotations |
| `slow` | Dropdown opens, tooltip appears, badge changes |
| `reveal` | Scroll-triggered section reveals, chart animations |
| `page` | Page transitions, initial load sequence |

---

## 4. Animation Patterns

### 4.1 Page Load Sequence

```
Timeline (entire sequence: 1,000ms)
0ms    → Orange leaf logo fades in + subtle scale (0.9 → 1)
200ms  → H1 headline fades up (translateY 20px → 0)
400ms  → Subheadline fades up (translateY 16px → 0)
600ms  → CTA buttons fade up (translateY 12px → 0)
800ms  → Trust bar stats fade up (translateY 8px → 0)
1,000ms → Code snippet fades up (translateY 8px → 0)
```

### 4.2 Scroll Reveal Sequence

| Section | Trigger | Animation | Stagger |
|---------|---------|-----------|---------|
| Problem cards | Enters viewport | Slide from edges (±40px → 0) | Left card 0ms, right card 100ms |
| How It Works steps | Enters viewport | Fade up (30px → 0) | Step 1: 0ms, Step 2: 200ms, Step 3: 400ms |
| Engine diagram | Enters viewport | Fade up + nodes highlight sequentially | 100ms per node |
| Benchmark counters | Enters viewport | Count up from 0 (JetBrains Mono) | All simultaneously, 500ms |
| Benchmark chart | Enters viewport | Chart draws left-to-right | 600ms draw duration |
| Feature cards | Enters viewport | Fade up (20px → 0) | 100ms stagger per card |
| Architecture diagram | Enters viewport | Fade up + connectors draw | 300ms |
| Pricing cards | Enters viewport | Scale (0.95 → 1) + fade | 100ms stagger per card |
| FAQ accordion | Click | Chevron rotate 180°, content expand | 200ms |
| CTA section | Enters viewport | Leaf subtle pulse + text fade up | 300ms |

### 4.3 Hover Effects

| Element | Normal | Hover | Duration |
|---------|--------|-------|----------|
| Nav link | `color: #AAB4C3` | `color: #F5F7FA` | 150ms |
| Nav link underline | `scaleX(0)` | `scaleX(1)` | 200ms |
| Card | `translateY(0)`, `border: #2A3441` | `translateY(-4px)`, `border: #3D4A5C` | 200ms |
| Primary button | Default | `scale(1.02)`, `shadow-orange` | 150ms |
| Secondary button | Default | `bg: #131A22` | 150ms |
| Ghost button | Default | `bg: #131A22` | 150ms |
| Table row | Background transparent | `bg: #1A2433` | 100ms |
| Sidebar item | `color: #AAB4C3` | `color: #F5F7FA`, `bg: #1A2433` | 150ms |
| Status badge | Default | Subtle scale (1.05) | 100ms |

### 4.4 Active / Press Effects

| Element | Animation |
|---------|-----------|
| Primary button | `scale(0.98)`, 100ms |
| Card (clickable) | `translateY(-1px)`, 100ms |
| Toggle switch | Knob slides to position, bg color transition, 200ms |
| Checkbox | Checkmark draw animation, 200ms |
| Close button (modal) | Rotate 90° on hover, 200ms |

### 4.5 Loading States

#### Skeleton Shimmer

```css
@keyframes shimmer {
  0% { background-position: -200% 0; }
  100% { background-position: 200% 0; }
}

.skeleton {
  background: linear-gradient(
    90deg,
    #131A22 25%,
    #1A2433 50%,
    #131A22 75%
  );
  background-size: 200% 100%;
  animation: shimmer 1.5s ease-in-out infinite;
}
```

| Element | Skeleton Shape |
|---------|---------------|
| KPI card | 120×80px rectangle, `radius-lg` |
| Chart area | Full width × 240px, `radius-lg` |
| Table row | Full width × 40px, `radius-md` |
| Text line | 60–80% width × 16px, `radius-sm` |
| Button | 120×40px, `radius-md` |

#### Page Loading

| State | Visual | Duration |
|-------|--------|----------|
| Initial load | Orange leaf pulse (scale 1↔1.1, opacity 0.5↔1) | Until data loads |
| Navigation | Content fades out (100ms) → new content fades in (200ms) | 300ms total |
| Mutation (upload, delete) | Optimistic UI update + subtle highlight on changed row | 500ms |

### 4.6 Dashboard Transitions

| Transition | Animation | Duration |
|------------|-----------|----------|
| Sidebar collapse/expand | Width transitions 240px ↔ 64px, icons move | 200ms |
| Page change | Content fades out op 1→0 (100ms), delay 50ms, new content fades 0→1 (200ms) | 350ms |
| KPI value change | Number counts from old value to new (JetBrains Mono digit transitions) | 500ms |
| Chart data update | Smooth path/path transition (d3 interpolate) | 500ms |
| Modal open | Overlay fades in 0→0.6 (150ms), modal scales 0.95→1 + fades (200ms) | 350ms |
| Modal close | Modal scales 1→0.95 + fades (150ms), overlay fades (100ms) | 250ms |
| Toast appear | Slides in from right (translateX 100% → 0) + fades | 300ms |
| Toast dismiss | Slides right + fades | 200ms |
| Dropdown open | Scales from top (0.95→1, origin top) + fades | 200ms |
| Tooltip appear | Fades in + subtle scale (0.9→1) | 150ms |

### 4.7 Form Interactions

| Interaction | Animation | Duration |
|-------------|-----------|----------|
| Input focus | Border color transition `#2A3441` → `#FF5A0A`, ring appears (box-shadow) | 200ms |
| Input error | Border color transition → `#EF4444`, shake (translateX 3px, 3 oscillations) | 400ms |
| Input valid | Border color transition → `#22C55E`, subtle check icon fades in | 200ms |
| Button loading | Spinner icon replaces text, button slightly wider | 200ms |
| Button success | Button turns green, checkmark icon appears | 300ms |

### 4.8 Micro-Interactions

| Interaction | Animation | Duration |
|-------------|-----------|----------|
| Copy to clipboard | Tooltip "Copied!" fades in/out | 1,500ms total |
| Star rating | Star fills in sequence (left to right) | 100ms per star |
| Thumbs up/down | Icon scales to 1.2 → back to 1, color changes | 200ms |
| Badge count change | Badge scales pulse (1→1.2→1) | 300ms |
| Progress bar fill | Width animates from 0 to target % | 500ms |
| Drag and drop overlay | Dashed border appears, drop zone glows orange | 200ms |
| File upload progress | Progress bar animates smoothly (not stepped) | Per file |

---

## 5. Strategy Badge Animations

Each strategy badge has a distinct animation when a query result arrives:

| Strategy | Badge Color | Animation |
|----------|-------------|-----------|
| Simple (Hybrid) | `#22C55E` green | Fade in + slide left, 200ms |
| Complex (Deep) | `#3B82F6` blue | Fade in + slide left, 200ms |
| Multi-Hop | `#8B5CF6` purple | Fade in + slide left + subtle glow pulse, 300ms |
| Fallback | `#F59E0B` yellow | Fade in + slide left + gentle shake, 300ms |

---

## 6. Chart Animations

| Chart Type | Animation | Duration |
|------------|-----------|----------|
| Line chart | Path draws left-to-right with gradient fill | 600ms |
| Donut chart | Segments animate from 0 to target angle | 500ms |
| Bar chart | Bars grow from bottom to target height | 400ms, 50ms stagger |
| Stacked bar | Segments stack from bottom up | 500ms |

All chart animations trigger when the section enters the viewport.

---

## 7. Implementation Notes

### Framer Motion (Landing Page)

```tsx
// Example: Stagger fade-up for feature cards
const container = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.1 }
  }
};

const item = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0, transition: { duration: 0.3, ease: [0.16, 1, 0.3, 1] } }
};
```

### CSS Transitions (App UI)

```css
/* Use CSS transitions for UI interactions — no JS animation library needed in-app */
.card {
  transition: transform var(--duration-normal) var(--ease-out-expo),
              border-color var(--duration-normal) var(--ease-out);
}

.button-primary {
  transition: transform var(--duration-fast) var(--ease-out-expo),
              box-shadow var(--duration-fast) var(--ease-out);
}
```

### Reduced Motion

```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
  }
}
```

### Performance Guidelines

| Rule | Rationale |
|------|-----------|
| Only animate `opacity` and `transform` | These are GPU-composited. Never animate `width`, `height`, `top`, `left`. |
| Use `will-change` sparingly | Only on elements that animate frequently (modals, toasts). Never on everything. |
| Keep animations under 300ms | Longer animations feel slow and unresponsive. |
| Use `transform-origin` for scale | Prevents layout shifts during scale animations. |
| Avoid simultaneous animations | Stagger reveals (50–100ms delay) to create visual order. |
| Test on low-power devices | Animations should work smoothly on M1 MacBook Air and 2019 Intel MacBook Pro. |

---

## 8. Animation Accessibility

| Requirement | Implementation |
|-------------|---------------|
| Respect `prefers-reduced-motion` | All animations disabled. Instant transitions. |
| No flashing content | No animations that flash >3 times per second. |
| No auto-playing content | All scroll-triggered animations play once on reveal. |
| Focus indicators | 2px orange ring on focus — not animated (instant) |
| Motion sickness safe | No parallax, no perspective shifts, no large-scale movements. |

---

> *End of Motion System*  
> *Next: Website Sitemap → docs/WEBSITE_SITEMAP.md*  
> *Brand: Orange Leaf Logo — LOCKED*
