# Kairos — Brand System

> **Document**: Complete Brand Identity & Visual Language  
> **Product**: Kairos — Adaptive Knowledge Intelligence  
> **Status**: LOCKED — Phase 13  
> **Author**: Apple / Linear / Stripe Design Team

---

## 1. Brand Foundation

### Brand Personality

| Trait | Manifestation | Example |
|-------|--------------|---------|
| **Precise** | Every claim is backed by data. No marketing fluff. | "23.6% recall improvement (p < 0.001)" — not "dramatically better" |
| **Confident** | Speaks with authority, not aggression. Knows its value. | "Kairos is the only platform that adapts per query." |
| **Transparent** | Open source. Open benchmarks. Open about limitations. | Strategy badges, confidence scores, cost per query — visible to every user. |
| **Premium** | Dark theme, orange accent, generous whitespace, deliberate design. | Every pixel is intentional. Nothing is accidental. |
| **Developer-first** | Built by developers, for developers. Technical depth is a feature. | Code snippets, API docs, architecture diagrams are first-class content. |
| **Ambitious** | Building the intelligent retrieval OS for every query, everywhere. | Not a feature — a platform. Not a tool — a standard. |

### Brand Archetype: **The Sage + The Creator**

Kairos sits at the intersection of:
- **The Sage** — Wisdom, knowledge, truth, transparency. "We reveal how retrieval works."
- **The Creator** — Innovation, craftsmanship, vision. "We built something that didn't exist before."

### Mission Statement

> Make document intelligence adaptive, transparent, and cost-aware so every organization gets the best possible answers from their knowledge at the lowest possible cost.

### Vision Statement

> A world where every question asked to every AI system is routed through an adaptive intelligence layer that understands what information is needed and the most efficient path to find it — making retrieval invisible, optimal, and universal.

### Brand Promise

> Kairos will always tell you why it gave you that answer, what strategy it used, what it cost, and how confident it is — because transparent AI is the only AI worth trusting.

---

## 2. Tone of Voice

### Voice Principles

| Principle | Do | Don't |
|-----------|----|-------|
| **Clear over clever** | "Kairos selects the optimal strategy for every query." | "Kairos is the quantum neural fabric of adaptive cognition." |
| **Specific over vague** | "24% better recall on 1,020 benchmark queries across 5 domains." | "Significantly better results across many use cases." |
| **Confident over humble** | "No other platform does this." | "We think we might be the only ones doing this." |
| **Human over corporate** | "Upload docs. Ask questions. Get answers." | "Leverage our platform to synergize your knowledge workflow." |
| **Technical over marketing** | "Platt-scaled confidence calibration with isotonic regression." | "AI-powered next-gen confidence optimization." |

### Voice by Channel

| Channel | Tone | Example |
|---------|------|---------|
| **Website / Marketing** | Confident, benefit-driven, benchmark-backed | "24% better recall. 18% lower cost. Proven." |
| **Documentation** | Technical, precise, example-heavy | "Send a POST request to /v1/query with your question." |
| **Blog / Content** | Educational, transparent, thoughtful | "Why static RAG leaves answers on the table." |
| **Social Media** | Concise, visual, data-focused | Benchmark chart + "p < 0.001" caption |
| **Email** | Helpful, personal, action-oriented | "Your weekly Kairos report: 47 queries, 92% confidence" |
| **Support** | Patient, thorough, human | "Let me help you understand why that query returned low confidence." |

### Words to Use / Avoid

| Use | Avoid |
|-----|-------|
| Adaptive, intelligent, optimized, transparent, efficient | Revolutionary, game-changing, disruptive, paradigm-shifting |
| Strategy, confidence, latency, cost, recall, precision | Next-gen, cutting-edge, state-of-the-art (without evidence) |
| Query, document, collection, workspace, source | Bot, agent, brain, neural, cognitive |
| Upload, ask, retrieve, answer, analyze | Train, deploy, orchestrate, synergize |
| Open source, MIT, self-hosted, BYO | Enterprise-grade, industrial-strength, battle-tested |

---

## 3. Logo System

### Primary Logo: Orange Leaf

The orange leaf is the sole official Kairos mark. No variations. No alternatives.

```
                    🍁
              (orange leaf)
         Sole brand mark. No substitutes.
```

### Logo Rules

| Rule | Specification |
|------|---------------|
| **Minimum size** | 24px (digital), 0.5in (print) |
| **Clear space** | Equal to leaf height on all sides |
| **Color** | `#FF5A0A` on dark backgrounds. White on orange backgrounds. |
| **Background** | Always on `#0B0F14` (digital). Never on light backgrounds. |
| **Wordmark** | "Kairos" in Inter 600, never separated from leaf |
| **Tagline placement** | Below wordmark, Inter 400, `#AAB4C3`, never same line |

### Logo Configurations

```
Primary (default):
  🍁 Kairos

App (favicon):
  🍁 (leaf only, 32px)

Social avatar:
  🍁 (leaf on #FF5A0A circle, 256px)

Footer:
  🍁 Kairos — Adaptive Knowledge Intelligence
```

### Logo Don'ts

- Never replace the leaf with a robot, brain, circuit, hexagon, or lightning bolt
- Never add effects (glow, gradient, shadow, 3D)
- Never rotate or flip the leaf
- Never place on a light/white background
- Never separate the leaf from the wordmark
- Never spell "Kairos" in lowercase
- Never add "AI" or "™" next to the logo

### Favicon

```svg
<!-- Leaf only, 32x32, orange #FF5A0A on transparent -->
```

---

## 4. Color System

### Primary Palette

| Token | Hex | Usage |
|-------|-----|-------|
| `--orange` | `#FF5A0A` | Primary brand color. CTAs, links, active states, data emphasis. |
| `--orange-hover` | `#FF7A1A` | Hover states for orange elements. |
| `--orange-muted` | `#FF5A0A` at 20% | Subtle backgrounds, hover card borders. |

### Dark Palette (Primary)

| Token | Hex | Usage |
|-------|-----|-------|
| `--bg` | `#0B0F14` | Page background. Deep charcoal. |
| `--surface` | `#131A22` | Card, panel, modal backgrounds. |
| `--surface-hover` | `#1A2433` | Card hover state. |
| `--border` | `#2A3441` | Borders, dividers, separators. |
| `--border-hover` | `#3D4A5C` | Border hover state. |

### Text Palette

| Token | Hex | Usage |
|-------|-----|-------|
| `--text-primary` | `#F5F7FA` | Headlines, body text. Near-white. |
| `--text-secondary` | `#AAB4C3` | Subheadings, captions, metadata. |
| `--text-muted` | `#6B7A8F` | Placeholder text, disabled states. |
| `--text-on-orange` | `#FFFFFF` | Text on orange backgrounds. |

### Semantic Palette

| Token | Hex | Usage |
|-------|-----|-------|
| `--success` | `#22C55E` | Status indicators, positive metrics. |
| `--warning` | `#F59E0B` | Near-limit alerts, caution. |
| `--error` | `#EF4444` | Errors, failed states. |
| `--info` | `#3B82F6` | Informational badges. |

### Color Usage Principles

| Principle | Rule |
|-----------|------|
| **Orange is sacred** | Use orange sparingly — only for CTAs, logo, and critical data emphasis. Overuse dilutes its power. |
| **Dark is the canvas** | `#0B0F14` is the default background everywhere. Never use white or light mode. |
| **Surface creates depth** | `#131A22` cards on `#0B0F14` background create subtle hierarchy without borders. |
| **Green/red are functional** | Only for metrics (positive/negative trends) and status indicators. Never decorative. |
| **Text contrast is king** | Primary text `#F5F7FA` on `#0B0F14` = 15.5:1 contrast ratio. WCAG AAA. |

### Accessibility Compliance

| Requirement | Our Compliance |
|-------------|---------------|
| WCAG AA text (4.5:1) | ✅ All text combinations exceed 4.5:1 |
| WCAG AAA text (7:1) | ✅ Primary/secondary text on bg exceeds 7:1 |
| WCAG AA UI components (3:1) | ✅ All interactive elements meet 3:1 |
| Color blindness safe | ✅ Orange + dark charcoal works for all common CB types |
| Focus indicators | ✅ 2px orange ring on all interactive elements |

---

## 5. Typography System

### Primary Font: Inter

| Weight | Usage | Size Range |
|--------|-------|------------|
| Inter 800 (Extra Bold) | Hero headlines, section titles | 2rem – 4rem |
| Inter 700 (Bold) | Section headings, metric values | 1.25rem – 2.25rem |
| Inter 600 (Semibold) | Subheadings, button text, nav links | 0.875rem – 1.125rem |
| Inter 500 (Medium) | Card titles, table headers | 0.875rem – 1rem |
| Inter 400 (Regular) | Body text, descriptions, paragraphs | 0.875rem – 1rem |

### Monospace: JetBrains Mono

| Weight | Usage | Size |
|--------|-------|------|
| JetBrains Mono 500 (Medium) | Code snippets, metrics, numbers, data values | 0.75rem – 0.875rem |
| JetBrains Mono 400 (Regular) | Secondary code, file paths | 0.75rem – 0.875rem |

### Type Scale

| Token | Size | Line Height | Usage |
|-------|------|-------------|-------|
| `--text-xs` | 0.75rem (12px) | 1rem | Captions, footnotes |
| `--text-sm` | 0.875rem (14px) | 1.25rem | Small text, metadata |
| `--text-base` | 1rem (16px) | 1.5rem | Body text |
| `--text-lg` | 1.125rem (18px) | 1.5rem | Larger body, subtitles |
| `--text-xl` | 1.25rem (20px) | 1.75rem | Section subheadings |
| `--text-2xl` | 1.5rem (24px) | 2rem | Section headings |
| `--text-3xl` | 1.875rem (30px) | 2.25rem | Major section titles |
| `--text-4xl` | 2.25rem (36px) | 2.5rem | Page headings |
| `--text-5xl` | 3rem (48px) | 3rem | Hero headings |
| `--text-6xl` | 3.75rem (60px) | 3.75rem | Large hero headings |

### Typography Rules

- Never use more than 2 font weights on a single page
- Headlines should be Inter 800, max 8 words
- Body text should be Inter 400, max 75 characters per line
- Numbers in metrics and data always use JetBrains Mono
- Code snippets always use JetBrains Mono with syntax highlighting
- Never use system fonts or web-safe fallbacks

---

## 6. Iconography

### Philosophy

The orange leaf is the only icon. There is no secondary icon set.

For functional UI icons (upload, search, settings, etc.), use the minimal icon set from shadcn/ui (Lucide icons) in `#AAB4C3` (text-secondary) at 16–20px.

### Icon Rules

| Rule | Specification |
|------|---------------|
| **Style** | Outline-only, 1.5px stroke, rounded caps |
| **Size** | 16px (inline), 20px (buttons), 24px (empty states) |
| **Color** | `#AAB4C3` (default), `#F5F7FA` (hover/active), `#FF5A0A` (brand accent) |
| **Source** | Lucide icons (via shadcn/ui) — no custom icons |
| **Animation** | Subtle rotate/scale on hover for interactive icons |

### Icon Usage

| Context | Icon Set | Size | Color |
|---------|----------|------|-------|
| Navigation sidebar | Lucide | 18px | `#AAB4C3` |
| Button icons | Lucide | 16px | Match button text |
| Empty states | Lucide | 48px | `#AAB4C3` at 50% |
| Status indicators | Lucide | 12px | Semantic color |
| Table actions | Lucide | 14px | `#6B7A8F` |

---

## 7. Illustration Style

### Philosophy

No illustrations. No abstract art. No generic technology imagery.

Kairos's visual content is:
- Data visualizations (benchmark charts, strategy breakdowns, latency graphs)
- Architecture diagrams (system flow, pipeline visualization)
- Code snippets (syntax-highlighted, real API calls)
- Screenshots (product UI showing real functionality)

### What We Use

| Visual Type | Purpose | Example |
|-------------|---------|---------|
| **Charts & Graphs** | Show data, prove claims | Benchmark bar chart, cost comparison |
| **Flow Diagrams** | Explain technology | Adaptive engine pipeline, query flow |
| **Code Blocks** | Developer credibility | Python SDK example, API call |
| **Product Screenshots** | Show, don't tell | Dashboard, query interface, analytics |
| **Logo Animation** | Brand moments | Leaf rotates into view on load |

### What We Never Use

- Stock photography of people in meetings
- Abstract 3D renders of brains/neurons/circuits
- Robot or AI imagery
- Gradient blob backgrounds
- Generic technology patterns (hex grids, data streams)
- Illustrations of any kind

---

## 8. Brand Applications

### Website (kairos.dev)

- Dark background (`#0B0F14`) throughout
- Orange leaf in header + footer
- Inter for all text, JetBrains Mono for code/metrics
- No light mode toggle
- Orange CTAs only — no secondary color

### SaaS App (app.kairos.dev)

- Same dark theme as website
- Sidebar: leaf + wordmark
- Orange accent for active nav items, primary buttons
- No light mode (developer tools are dark by default)

### Documentation (docs.kairos.dev)

- MDX-based, dark theme
- Code blocks with syntax highlighting (JetBrains Mono)
- Sidebar navigation with search
- "Edit on GitHub" link on every page

### Social Media

| Platform | Avatar | Banner | Post Style |
|----------|--------|--------|------------|
| GitHub | Orange leaf on dark | — | Benchmark data, release notes |
| Twitter/X | Orange leaf on `#FF5A0A` circle | Dark with leaf pattern | Data visualizations, product updates |
| LinkedIn | Orange leaf on dark | Dark with mission statement | Thought leadership, case studies |
| Discord | Orange leaf on dark | — | Community support, announcements |

### GitHub Repository

- Dark theme README with orange leaf header
- GitHub star history badge
- "MIT Licensed" and "Open Source" badges
- Benchmark results in README with chart
- Quickstart code block below fold

### Marketing Materials

- PDF one-pager: Dark background, leaf header, benchmark data, feature grid
- Slide deck: Dark theme, orange accent, data-heavy slides
- Email templates: Dark header, orange CTAs, minimal design

---

## 9. Brand Guardian Checklist

Before publishing any Kairos-branded material, verify:

- [ ] Orange leaf is the only logo element used
- [ ] No robot, brain, circuit, hexagon, or lightning bolt icons
- [ ] Background is `#0B0F14` (not white, not gray)
- [ ] Primary accent is `#FF5A0A` (not a different orange)
- [ ] Headlines use Inter 800, body uses Inter 400
- [ ] Code/metrics use JetBrains Mono
- [ ] No stock photography or illustrations
- [ ] Every claim is backed by a specific number
- [ ] "Kairos" is capitalized (not "kairos")
- [ ] Product name is "Kairos" (not "Kairos AI" or "Kairos Intelligence")
- [ ] No superlatives without evidence
- [ ] CTAs are orange-filled buttons with white text

---

> *End of Brand System*  
> *Next: Design System → docs/DESIGN_SYSTEM.md*  
> *Brand: Orange Leaf Logo — LOCKED*
