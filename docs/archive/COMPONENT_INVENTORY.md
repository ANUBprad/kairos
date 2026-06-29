# Component Inventory

> **Version:** 1.0  
> **Scope:** All reusable components in `apps/portal/src/components/`

---

## 1. Button (`ui/button.tsx`)

| Field | Detail |
|---|---|
| **Purpose** | Reusable button with 3 variants, 4 sizes, polymorphic `asChild` support via Radix Slot |
| **Import Path** | `@/components/ui/button` |
| **Tech** | Radix Slot, cva (class-variance-authority), cn utility |

### Variants

| Variant | Default | Hover | Active | Disabled |
|---|---|---|---|---|
| `primary` | `bg-brand text-white` | `bg-brand-hover` | `bg-brand-active scale-[0.97]` | `opacity-40 pointer-events-none` |
| `secondary` | `bg-transparent border border-border text-text-primary` | `bg-surface border-border-hover` | `scale-[0.97]` | `opacity-40 pointer-events-none` |
| `ghost` | `bg-transparent text-text-secondary` | `bg-surface text-text-primary` | — | `opacity-40 pointer-events-none` |

### Sizes

| Size | Height | Padding | Font |
|---|---|---|---|
| `sm` | `h-9` | `px-4` | `13px` |
| `md` (default) | `h-10` | `px-5` | `14px` |
| `lg` | `h-12` | `px-7` | `15px` |
| `xl` | `h-14` | `px-9` | `16px` |

### Props

```typescript
interface ButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "ghost";
  size?: "sm" | "md" | "lg" | "xl";
  asChild?: boolean;
}
```

### Animation

```css
transition-all duration-200 ease-out
active:scale-[0.97]    /* primary, secondary only */
```

### Accessibility

- `focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand`
- `select-none` (prevents accidental text selection on rapid clicks)
- `asChild` renders as whatever child element is (e.g., `<Link>`) via Radix Slot, preserving semantics

### Usage Examples

```tsx
<Button variant="primary" size="lg" asChild>
  <Link href="/signup">Start building</Link>
</Button>

<Button variant="ghost" size="sm" onClick={toggleTheme}>
  <SunIcon />
</Button>

<Button variant="secondary" size="md" disabled>
  Coming soon
</Button>
```

---

## 2. Card (`ui/card.tsx`)

| Field | Detail |
|---|---|
| **Purpose** | Two variants: static display card and interactive hover-card |
| **Import Path** | `@/components/ui/card` |

### Components

| Component | Class | Interactive |
|---|---|---|
| `Card` | `rounded-[14px] border border-border bg-surface p-6 transition-all duration-200` | No |
| `CardInteractive` | Same + `hover:-translate-y-[2px] hover:border-border-hover hover:shadow-lg cursor-pointer` | Yes (duration-300) |

### Props

```typescript
// Both Card and CardInteractive accept:
interface CardProps extends HTMLAttributes<HTMLDivElement> {
  // className, children, ref (forwarded)
}
```

### States

| State | Card | CardInteractive |
|---|---|---|
| Default | `border-border bg-surface` | `border-border bg-surface` |
| Hover | No change | `-translate-y-[2px] border-border-hover shadow-lg` |
| Focus | `focus-visible` (global) | `focus-visible` (global) |

### Animation

```css
/* Card */
transition-all duration-200

/* CardInteractive */  
transition-all duration-300
```

### Accessibility

No specific ARIA — rendered as generic `<div>`. For interactive cards, `cursor-pointer` hints at clickability.

### Usage Examples

```tsx
<Card className="flex flex-col gap-3">
  <h3>Title</h3>
  <p>Description</p>
</Card>

<CardInteractive onClick={() => router.push("/docs")}>
  <h3>Getting Started</h3>
</CardInteractive>
```

---

## 3. Badge (`ui/badge.tsx`)

| Field | Detail |
|---|---|
| **Purpose** | Inline badge/tag with 5 semantic color variants |
| **Import Path** | `@/components/ui/badge` |

### Variants

| Variant | Border | Background | Text |
|---|---|---|---|
| `default` | `border-border` | `bg-surface` | `text-text-secondary` |
| `brand` | `border-brand/30` | `bg-brand/10` | `text-brand` |
| `success` | `border-success/30` | `bg-success/10` | `text-success` |
| `warning` | `border-warning/30` | `bg-warning/10` | `text-warning` |
| `info` | `border-info/30` | `bg-info/10` | `text-info` |

### Props

```typescript
interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: "default" | "brand" | "success" | "warning" | "info";
}
```

### States

- **All variants**: `transition-colors`
- Rendered as `<span>` — no interactive states

### Usage Examples

```tsx
<Badge variant="brand">Adaptive Retrieval Intelligence Platform</Badge>
<Badge variant="success">Live</Badge>
<Badge variant="warning">Beta</Badge>
<Badge variant="info">New</Badge>
```

---

## 4. Accordion (`ui/accordion.tsx`)

| Field | Detail |
|---|---|
| **Purpose** | Collapsible accordion built on Radix UI Accordion primitive |
| **Import Path** | `@/components/ui/accordion` |

### Sub-components

| Component | Renders | Role |
|---|---|---|
| `Accordion` | `<AccordionRoot>` | Wrapper, configures type/behavior |
| `AccordionItem` | `<AccordionItem>` | Individual item wrapper |
| `AccordionTrigger` | `<AccordionHeader><AccordionTrigger>` | Clickable header with chevron |
| `AccordionContent` | `<AccordionContent>` | Collapsible body |

### Props

Standard Radix Accordion props.

### States

| State | Trigger | Content |
|---|---|---|
| Closed | Default text, chevron at 0deg | `height: 0` |
| Open | Chevron rotated 180deg (`data-[state=open]:svg:rotate-180`) | Full height via `animate-accordion-down` |

### Animation

```css
/* Chevron rotation */
[data-state=open] svg { transform: rotate(180deg); }
transition-transform duration-200

/* Content slide */
data-[state=open]: animate-accordion-down (200ms ease-out)
data-[state=closed]: animate-accordion-up (200ms ease-out)
```

### Accessibility

Full ARIA support via Radix Accordion:
- `role="region"`
- `aria-expanded` on trigger
- `aria-controls` linking trigger to content
- `aria-labelledby` on content panel

### Usage

```tsx
<Accordion type="single" collapsible>
  <AccordionItem value="1">
    <AccordionTrigger>Question?</AccordionTrigger>
    <AccordionContent>Answer.</AccordionContent>
  </AccordionItem>
</Accordion>
```

---

## 5. ScrollReveal (`shared/scroll-reveal.tsx`)

| Field | Detail |
|---|---|
| **Purpose** | "use client" — Framer Motion scroll-triggered entrance animation wrapper |
| **Import Path** | `@/components/shared/scroll-reveal` |

### Components

#### ScrollReveal

| Prop | Type | Default | Description |
|---|---|---|---|
| `children` | `ReactNode` | required | Content to animate |
| `className` | `string` | — | Additional classes |
| `delay` | `number` | `0` | Delay before animation starts (seconds) |
| `direction` | `"up"\|"down"\|"left"\|"right"` | `"up"` | Direction of entrance |

**Animation:** Fade + translate (30px in direction) → opacity 1 + translate 0  
**Trigger:** `whileInView`, `viewport: { once: true, margin: "-60px" }`  
**Duration:** 0.5s, **Easing:** `[0.16, 1, 0.3, 1]`

#### StaggerContainer

| Prop | Type | Default | Description |
|---|---|---|---|
| `children` | `ReactNode` | required | Child elements to stagger |
| `className` | `string` | — | Additional classes |
| `staggerDelay` | `number` | `0.08` | Seconds between each child's animation |

**Animation:** Children animate sequentially with stagger  
**Trigger:** `whileInView`, `viewport: { once: true, margin: "-60px" }`  
**Easing:** `[0.16, 1, 0.3, 1]`

#### staggerItem (function)

```typescript
function staggerItem({ direction?: Direction } = {}): Variants
```

Returns Framer Motion variants object for child elements.

### Usage

```tsx
<ScrollReveal>
  <h2>Section Heading</h2>
</ScrollReveal>

<StaggerContainer className="grid grid-cols-3 gap-6">
  {items.map(item => (
    <motion.div key={item.id} variants={staggerItem()}>
      {item.content}
    </motion.div>
  ))}
</StaggerContainer>
```

---

## 6. SmoothScroll (`shared/smooth-scroll.tsx`)

| Field | Detail |
|---|---|
| **Purpose** | "use client" — Wraps children in Lenis smooth scroll engine |
| **Import Path** | `@/components/shared/smooth-scroll` |

### Props

```typescript
interface SmoothScrollProviderProps {
  children: ReactNode;
}
```

### Lenis Configuration

| Parameter | Value |
|---|---|
| `duration` | 1.2 |
| `easing` | `(t) => Math.min(1, 1.001 - Math.pow(2, -10 * t))` |
| `wheelMultiplier` | 1 |
| `smoothWheel` | true |

### Usage

```tsx
// In layout.tsx:
<SmoothScrollProvider>
  <Nav />
  <main>{children}</main>
  <Footer />
</SmoothScrollProvider>
```

---

## 7. ThemeToggle (`shared/theme-toggle.tsx`)

| Field | Detail |
|---|---|
| **Purpose** | "use client" — Toggles dark/light theme with localStorage persistence |
| **Import Path** | `@/components/shared/theme-toggle` |

### Props

None.

### Behavior

| State | Icon | `html` class | localStorage |
|---|---|---|---|
| Dark (default) | Sun icon (Moon is shown when dark) | No `.light` | `theme: "light"` |
| Light | Moon icon | `.light` | `theme: "light"` |

### Accessibility

- `aria-label="Toggle theme"`
- Uses `<Button variant="ghost" size="sm">` internally

### Usage

```tsx
<ThemeToggle />
```

---

## 8. Nav (`marketing/nav.tsx`)

| Field | Detail |
|---|---|
| **Purpose** | "use client" — Fixed top navigation, scroll-aware glass effect, desktop + mobile responsive |
| **Import Path** | `@/components/marketing/nav` |

### Layout

| Element | Desktop | Mobile |
|---|---|---|
| Logo | Left (28px height) | Left |
| Nav Links | Center: Features, Pricing, Docs, Blog | Full-screen overlay menu |
| Actions | Right: Sign In, ThemeToggle, Start Building button | ThemeToggle + hamburger |

### States

| State | Header | Effect |
|---|---|---|
| Top of page (`scrollY <= 20`) | `bg-transparent border-transparent` | Transparent |
| Scrolled (`scrollY > 20`) | `glass border-b border-border/60` | Frosted glass + border |

### Mobile Menu

| State | Menu | Body |
|---|---|---|
| Closed | Hidden | Scrollable |
| Open | Full-screen overlay with links + CTA | `overflow: hidden` |

### Animations

| Element | Animation |
|---|---|
| Header transition | `transition-all duration-300` |
| Link underline | `::after` pseudo-element, `scale-x-0` → `scale-x-100` on hover, `origin-left transition-transform duration-300` |
| Mobile menu | AnimatePresence fade (duration 0.15) |

### Accessibility

- `aria-label="Kairos home"` on logo link
- `aria-label` on hamburger: "Open menu" / "Close menu"
- Focus management on menu open/close

### Props

None.

### Usage

```tsx
<Nav />
```

---

## 9. Hero (`marketing/hero.tsx`)

| Field | Detail |
|---|---|
| **Purpose** | "use client" — Main landing section with animated terminal + floating metrics |
| **Import Path** | `@/components/marketing/hero` |

### Anatomy

```
┌─────────────────────────────────────────────────────────────┐
│ Left Column (55%)                    Right Column (45%)    │
│ ─────────────────                    ─────────────────    │
│ Badge: "Adaptive Retrieval..."       Code block with curl  │
│ H1: "Stop retrieving blindly..."     + blinking cursor     │
│ P: "One API. Every query..."                               │
│ [Start building] [See how it works]  4 floating metric     │
│ Trust signals line                   cards (abs positioned) │
│                                      • 163ms Latency        │
│                                      • +24% Recall          │
│                                      • -40% Cost            │
│                                      • 99.2% Confidence     │
└─────────────────────────────────────────────────────────────┘
```

### Layout

Two-column responsive: `lg:flex-row flex-col`. 55/45 split on desktop, stacked on mobile.

### Background

- Dot grid pattern (`radial-gradient` dots at 28px spacing)
- Floating gradient orbs (orange `#FF5A0A` + blue `#3B82F6`) with `blur(120px)` and `float-slow` animation

### Animations

| Element | Animation | Config |
|---|---|---|
| Left column items | Stagger entrance | `staggerChildren: 0.15`, `delayChildren: 0.1`, each fades up 24px |
| Right panel | Slide in from right | `opacity 0→1, x:30→0`, duration 0.7 |
| Blinking cursor | Opacity loop | `[0.4, 1, 0.4]`, infinite |
| Floating metric cards | Fade up staggered | Delays: 0.3, 0.6, 0.9, 1.2s |
| Background orbs | Float | `float-slow 8s/10s ease-in-out infinite` |

### CTAs

| Button | Variant | Size | Link |
|---|---|---|---|
| "Start building" | `primary` | `lg` | `/signup` |
| "See how it works" | `secondary` | `lg` | `/#how-it-works` |

### Props

None.

---

## 10. Footer (`marketing/footer.tsx`)

| Field | Detail |
|---|---|
| **Purpose** | Site footer with 4-column link grid, social links, copyright |
| **Import Path** | `@/components/marketing/footer` |

### Columns

| Column | Links |
|---|---|
| **Product** | Features, Pricing, Docs, Changelog |
| **Developers** | API Reference, SDKs, GitHub, Status |
| **Company** | About, Blog, Contact, Security |
| **Legal** | Privacy, Terms, Cookies |

### Social Links (top row, after logo)

GitHub, Twitter/X, LinkedIn, Discord, Email — each with `aria-label` and `target="_blank" rel="noopener noreferrer"`

### Layout

Desktop: Logo + socials row → 4-column grid → copyright + theme badge  
Mobile: Stacked columns

### Animation

Link hover: `hover:text-text-primary transition-colors duration-200`

---

## 11. Section Wrapper (`marketing/section-wrapper.tsx`)

| Field | Detail |
|---|---|
| **Purpose** | Server component — reusable section container, heading, subheading |
| **Import Path** | `@/components/marketing/section-wrapper` |

### Components

#### SectionWrapper

| Prop | Type | Description |
|---|---|---|
| `children` | `ReactNode` | Content |
| `className` | `string` | Custom classes |
| `id` | `string` | Anchor ID for scroll links |

**Container:** `mx-auto max-w-[1280px] px-6 sm:px-8 py-20 md:py-28`

#### SectionHeading

```tsx
<h2 className="text-center text-[28px] sm:text-[36px] font-semibold tracking-tight text-text-primary">
```

#### SectionSubheading

```tsx
<p className="mt-4 text-center text-[16px] sm:text-[18px] text-text-secondary max-w-2xl mx-auto leading-relaxed">
```

---

## 12. PricingSection (`marketing/pricing-section.tsx`)

| Field | Detail |
|---|---|
| **Purpose** | "use client" — 4 pricing tier cards |
| **Import Path** | `@/components/marketing/pricing-section` |

### Plans

| Plan | Price | Queries | Key Features | CTA |
|---|---|---|---|---|
| Free | $0 | 1,000/month | 3 strategies, community support, basic analytics | "Get started" (ghost) |
| Developer | $49 | 10,000/month | All strategies, confidence calibration, email support, API | "Start building" (ghost) |
| Pro | $199 | 100,000/month | Multi-strategy, feedback learning, priority, custom strategies, full observability | "Start building" (primary) |
| Enterprise | Custom | Unlimited | Custom strategy, SOC 2, dedicated, self-hosting, SLA | "Contact sales" (secondary) |

### "Most Popular" Treatment (Pro)

- Absolute positioned badge (brand variant)
- `shadow-glow` on card
- `border-brand/40 bg-brand/[0.03]`

### Animation

StaggerContainer with `staggerDelay={0.06}`

---

## 13. Integrations (`marketing/integrations.tsx`)

| Field | Detail |
|---|---|
| **Purpose** | "use client" — Integration ecosystem showcase with SVG logos |
| **Import Path** | `@/components/marketing/integrations` |

### Internal Components

| Component | Purpose |
|---|---|
| `DotGrid` | Background dot pattern (positioned absolute, aria-hidden) |
| `OrangeGlow` | Decorative radial glow orb (positioned absolute, aria-hidden) |
| `IntegrationCard` | Single integration card with stagger animation |
| `CategorySection` | Category row with entrance animation |

### Categories

| Category | Items |
|---|---|
| **LLMs** | OpenAI, Anthropic, Gemini, Ollama, Groq, Mistral |
| **Vector Databases** | Pinecone, ChromaDB, Weaviate, Qdrant, Milvus, FAISS |
| **Languages** | Python, TypeScript, Go, Java |

### Grid

```css
grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3
```

### Card States

| State | Effect |
|---|---|
| Default | `border-border bg-surface/30 text-text-secondary` |
| Hover | `scale-[1.03] border-brand/25 bg-surface/60 shadow-glow` — icon turns `text-brand`, text turns `text-text-primary` |
| Transition | `transition-all duration-300 ease-out` |

### Animation

- **Category entrance**: fade-up with 0.1s delay per category
- **Card entrance**: staggerItem variants with `staggerDelay={0.04}`

### Accessibility

- DotGrid and OrangeGlow have `aria-hidden`

---

## 14. Other Marketing Components

### SocialProof (`marketing/social-proof.tsx`)

"use client" — Placeholder company logos bar. Shows 6 company names (TechCorp, DataFlow, etc.) with fade-up entrance.

### Problem (`marketing/problem.tsx`)

"use client" — Side-by-side comparison: Static RAG (error-themed, X icons) vs Kairos (success-themed, Check icons). Two cards with left/right entrance animations.

### HowItWorks (`marketing/how-it-works.tsx`)

"use client" — 3-step process with arrow connectors. Cards stagger at 0.12s delay. Fallback info card at bottom.

### EngineVisualization (`marketing/engine-visualization.tsx`)

"use client" — Interactive demo with states: Idle (input visible), Running (steps animate, input disabled), Complete (result card). 3 demo queries, 7-step pipeline, 300ms per step.

### Benchmarks (`marketing/benchmarks.tsx`)

"use client" — 4 KPI cards (stagger) + bar chart (animated width fill, 0.8s, staggered 0.1s per bar). 5 domains.

### FeaturesGrid (`marketing/features-grid.tsx`)

"use client" — 9 feature cards in 3x3 grid. Stagger 0.06s. Hover: lift + brand border + icon bg darken.

### UseCasesGrid (`marketing/use-cases-grid.tsx`)

"use client" — 4 use cases in 2x2 grid. Same style as FeaturesGrid. Stagger 0.1s.

### ArchitectureSection (`marketing/architecture-section.tsx`)

"use client" — 2-col: tech stack bullets (stagger, Check icons) + flow diagram (pulsing glow on key nodes).

### CTASection (`marketing/cta-section.tsx`)

"use client" — Final conversion: dual headline + 2 CTAs + trust signals. ArrowRight icon on primary CTA.

### ContactForm (`marketing/contact-form.tsx`)

"use client" — Name, Email, Message fields. Labels with `htmlFor`/`id`. Focus ring: `ring-2 ring-brand/20 focus:border-brand/50`. Submit button full-width.

### LeafLogo (`marketing/leaf-logo.tsx`)

Server component — renders Kairos PNG logo with responsive height. Props: `size?: number` (default 28). `KairosWordmark` returns null.

### IntegrationLogos (`marketing/integration-logos.tsx`)

16 SVG components (OpenAI, Anthropic, Gemini, Ollama, Groq, Mistral, Pinecone, ChromaDB, Weaviate, Qdrant, Milvus, FAISS, Python, TypeScript, Go, Java). Each accepts `size?: number` (default 24). Uses `currentColor` for fill/stroke.

---

## 15. Auth Components (Inline)

Auth pages (`/login`, `/signup`, `/forgot-password`) do not use shared form components. Each page inlines its form HTML directly. Only `<Button>` is imported from the UI library.

**Auth Layout** (`(auth)/layout.tsx`): Split-screen with left branding panel (logo, highlights, dot grid, gradient orbs) and right form area. Highlights: 24% better recall, Adaptive strategy, 40% lower cost, SOC 2 compliant.

---

*End of COMPONENT_INVENTORY.md*
