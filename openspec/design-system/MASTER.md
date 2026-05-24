# Design System — Vendeo V3 (Ad Automation SaaS)

> **SOURCE OF TRUTH.** This file defines immutable design rules for all agents building UI for Vendeo V3.
> When building a page, first check `openspec/design-system/pages/[page-name].md`.
> If that file exists, its rules override this Master for that page only.

---

## 1. Visual Identity

**Product:** SaaS de automação de campanhas de anúncios para lojistas de lojas físicas
**Core Value:** Gerar campanhas profissionais que o lojista tenha confiança de publicar

### Style
- **Primary:** Dark Mode (OLED)
- **Secondary:** Data-Dense Dashboard (for analytics/metrics views)
- **Keywords:** dark, high-contrast, professional, data-driven, clean, technical
- **Best For:** SaaS dashboards, analytics, ad management, campaign builder
- **Performance:** ⚡ Excellent
- **Accessibility:** ✓ WCAG AAA

### Anti-patterns (DO NOT USE)
- ❌ Light mode as default — dark mode is THE identity
- ❌ Emojis as icons — use SVG (Lucide/Heroicons)
- ❌ Layout-shifting hover states (avoid scale transforms)
- ❌ Low contrast text — maintain 7:1 minimum on dark bg
- ❌ Instant transitions — always use 150-300ms
- ❌ Missing cursor:pointer on interactive elements
- ❌ White (#FFFFFF) backgrounds — use `#020617` or `#0F172A`
- ❌ Excessive glow/neon — minimal glow only for active states

---

## 2. Color Palette (Dark Mode)

### Core Surface Colors
| Token | Hex | Usage |
|-------|-----|-------|
| `--bg-deep` | `#020617` | Page background (deepest layer) |
| `--bg-surface` | `#0F172A` | Cards, sidebars, secondary surfaces |
| `--bg-elevated` | `#1E293B` | Modals, dropdowns, hover states |
| `--bg-hover` | `#334155` | Row hover, button hover backgrounds |
| `--border` | `#1E293B` | Card borders, dividers |
| `--border-light` | `#334155` | Input borders, subtle dividers |

### Text Colors
| Token | Hex | Contrast Ratio | Usage |
|-------|-----|----------------|-------|
| `--text-primary` | `#F8FAFC` | 18.5:1 | Headings, primary content |
| `--text-secondary` | `#94A3B8` | 9:1 | Body text, descriptions |
| `--text-muted` | `#64748B` | 5.5:1 | Labels, secondary info |
| `--text-disabled` | `#475569` | 3.5:1 | Disabled states |

### Accent Colors
| Token | Hex | Usage |
|-------|-----|-------|
| `--accent-green` | `#22C55E` | CTA buttons, success, active metrics |
| `--accent-blue` | `#3B82F6` | Links, info, primary actions |
| `--accent-purple` | `#8B5CF6` | Premium features, campaign types |
| `--accent-amber` | `#F59E0B` | Warnings, pending states, highlights |
| `--accent-red` | `#EF4444` | Errors, negative metrics, alerts |

### Chart Data Colors
| Token | Hex |
|-------|-----|
| `--chart-1` | `#22C55E` |
| `--chart-2` | `#3B82F6` |
| `--chart-3` | `#8B5CF6` |
| `--chart-4` | `#F59E0B` |
| `--chart-5` | `#EC4899` |
| `--chart-6` | `#06B6D4` |
| `--chart-grid` | `#1E293B` |
| `--chart-text` | `#64748B` |

### CSS Variables (tailwind.config)
```js
colors: {
  bg: {
    deep: '#020617',
    surface: '#0F172A',
    elevated: '#1E293B',
    hover: '#334155',
  },
  border: {
    DEFAULT: '#1E293B',
    light: '#334155',
  },
  text: {
    primary: '#F8FAFC',
    secondary: '#94A3B8',
    muted: '#64748B',
    disabled: '#475569',
  },
  accent: {
    green: '#22C55E',
    blue: '#3B82F6',
    purple: '#8B5CF6',
    amber: '#F59E0B',
    red: '#EF4444',
  },
  chart: {
    1: '#22C55E',
    2: '#3B82F6',
    3: '#8B5CF6',
    4: '#F59E0B',
    5: '#EC4899',
    6: '#06B6D4',
    grid: '#1E293B',
    text: '#64748B',
  },
}
```

---

## 3. Typography

| Role | Font | Weight | Size Scale |
|------|------|--------|------------|
| Headings | `Fira Sans` | 600, 700 | `text-2xl` (1.5rem) to `text-4xl` (2.25rem) |
| Body | `Fira Sans` | 400, 500 | `text-sm` (0.875rem) to `text-base` (1rem) |
| Data/Monospace | `Fira Code` | 400, 500, 600 | `text-xs` (0.75rem) to `text-base` (1rem) |
| Labels/Captions | `Fira Sans` | 500 | `text-xs` (0.75rem) |

**CSS Import:**
```css
@import url('https://fonts.googleapis.com/css2?family=Fira+Code:wght@400;500;600;700&family=Fira+Sans:wght@300;400;500;600;700&display=swap');
```

**Font Weights by Context:**
- Page title: Fira Sans 700
- Section heading: Fira Sans 600
- Card title: Fira Sans 500
- Body text: Fira Sans 400
- Metric value: Fira Code 600
- Table data: Fira Code 400
- Label/caption: Fira Sans 500, uppercase tracking-wider

---

## 4. Spacing & Sizing Tokens

| Token | Rem | px | Usage |
|-------|-----|----|-------|
| `--space-2xs` | 0.25rem | 4px | Icon padding, tight gaps |
| `--space-xs` | 0.5rem | 8px | Inline spacing, small gaps |
| `--space-sm` | 0.75rem | 12px | Button padding, compact |
| `--space-md` | 1rem | 16px | Card padding, standard |
| `--space-lg` | 1.5rem | 24px | Section padding, between cards |
| `--space-xl` | 2rem | 32px | Between sections |
| `--space-2xl` | 3rem | 48px | Page margins, large gaps |
| `--space-3xl` | 4rem | 64px | Hero/header padding |

---

## 5. Shadows

| Level | Value | Usage |
|-------|-------|-------|
| sm | `0 1px 2px 0 rgb(0 0 0 / 0.3)` | Subtle card lift |
| md | `0 4px 6px -1px rgb(0 0 0 / 0.4)` | Cards, dropdowns |
| lg | `0 10px 15px -3px rgb(0 0 0 / 0.5)` | Modals, side panels |
| xl | `0 20px 25px -5px rgb(0 0 0 / 0.6)` | Dialogs, overlays |

On dark surfaces, shadows are naturally harder to see — use higher opacity.

---

## 6. Component Specifications

### 6.1 Buttons

**Primary (CTA):**
- bg: `accent-green` (#22C55E), text: white
- Padding: px-6 py-2.5, rounded-lg
- Font: Fira Sans 600, text-sm
- Hover: brightness(110%)
- Transition: 200ms ease
- Cursor: pointer

**Secondary Outline:**
- bg: transparent, border: border-light (#334155), text: text-primary
- Padding: px-6 py-2.5, rounded-lg
- Hover: bg `#1E293B`
- Transition: 200ms ease

**Ghost (icon/toolbar):**
- bg: transparent, text: text-secondary
- Hover: bg `#1E293B`, text: text-primary
- W-9 h-9, rounded-lg
- Only icon inside

**Danger:**
- bg: `#EF4444`/10, border: `#EF4444`/30, text: `#EF4444`
- Hover: bg `#EF4444`/20

### 6.2 Cards

```css
.card {
  background: #0F172A;
  border: 1px solid #1E293B;
  border-radius: 12px;
  padding: 1.5rem;
  transition: border-color 200ms ease, box-shadow 200ms ease;
}
.card:hover {
  border-color: #334155;
  box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.4);
}
```

### 6.3 Inputs & Forms

```css
.input {
  background: #0F172A;
  border: 1px solid #334155;
  border-radius: 8px;
  padding: 0.625rem 0.875rem;
  color: #F8FAFC;
  font-size: 0.875rem;
  transition: border-color 200ms ease;
}
.input:focus {
  border-color: #3B82F6;
  outline: none;
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.15);
}
.input::placeholder {
  color: #64748B;
}
.label {
  color: #94A3B8;
  font-size: 0.75rem;
  font-weight: 500;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  margin-bottom: 0.5rem;
}
```

### 6.4 Modals / Dialogs

- Overlay: `rgba(2, 6, 23, 0.8)` + backdrop-blur-sm
- Content: bg `#1E293B`, border `#334155`, rounded-xl (16px)
- Padding: 1.5rem-2rem
- Max-width: 480px for dialogs, 640px for panels
- Close button: ghost icon top-right

### 6.5 Badges / Tags

```css
.badge-green {
  background: rgba(34, 197, 94, 0.1);
  color: #22C55E;
  border: 1px solid rgba(34, 197, 94, 0.2);
  padding: 0.125rem 0.5rem;
  border-radius: 9999px;
  font-size: 0.75rem;
  font-weight: 500;
}
```

Same pattern for blue, amber, red, purple, gray badges.

### 6.6 Tables

- Header: bg `#0F172A`, text text-muted (uppercase, tracking-wider, text-xs)
- Row: bg transparent, hover bg `#1E293B`
- Border: `#1E293B` between rows
- Padding: px-4 py-3
- Font: Fira Code 400 for data columns, Fira Sans for text columns

### 6.7 Tabs

- Tab: text text-secondary, hover text text-primary, border-bottom transparent
- Active tab: text accent-blue, border-bottom 2px solid accent-blue
- Transition: 200ms ease

### 6.8 Progress / Status Indicators

- Active: accent-green pulse glow
- Paused/draft: accent-amber
- Error: accent-red
- Completed: accent-green solid

---

## 7. Dashboard Base Layout

```
┌─────────────────────────────────────────────┐
│  Header (h-16)                              │
│  Logo | Search | Notifications | Profile    │
├──────────┬──────────────────────────────────┤
│ Sidebar  │  Main Content Area               │
│ (w-64)   │  • Page Title + Actions          │
│          │  • KPI Cards Row (4)             │
│ Top-level │  • Chart Section                │
│ campaigns │  • Campaigns Table              │
│ analytics │  • Recent Activity              │
│ settings  │                                 │
│           │                                 │
└──────────┴──────────────────────────────────┘
```

### Layout Rules

**Sidebar (w-64):**
- Fixed, full height below header
- bg `#0F172A`, right border `#1E293B`
- Nav items: py-2.5 px-4, rounded-lg, hover bg `#1E293B`
- Active item: bg `#1E293B`, left border 3px accent-blue, text accent-blue
- Icon + label per item (icons: lucide-react, 20px)
- Spacing between groups: pt-6 with group label text-muted uppercase text-xs

**Header (h-16):**
- Fixed top, bg `#0F172A` with bottom border `#1E293B`
- Left: logo/brand
- Center: search input (max-w-md)
- Right: notification bell + avatar/profile dropdown
- z-index: 40 (stacks above sidebar)

**Main Content:**
- ml-64 (sidebar width), pt-16 (header height)
- Inner padding: p-6 lg:p-8
- Max content width: 1440px

---

## 8. Responsive Breakpoints

| Breakpoint | Width | Layout Change |
|------------|-------|---------------|
| Mobile | < 768px | Sidebar becomes drawer (overlay), header compact |
| Tablet | 768-1023px | Sidebar collapsible icons, 2-column cards |
| Desktop | 1024-1439px | Full sidebar, 3-4 column grid |
| Wide | 1440px+ | Max content width centered |

**Mobile sidebar:** use a slide-over drawer triggered by hamburger icon. Same nav structure, overlay behind.

---

## 9. Interaction Patterns

### Hover States
- Cards: border-color lightens, subtle shadow lift (no transform)
- Buttons: brightness/opacity shift (no scale)
- Table rows: bg-hover (#334155)
- Sidebar items: bg-surface (#1E293B)

### Loading
- Skeleton shimmer: bg `#1E293B` with moving gradient `#334155` at 45deg
- Pulse animation for status dots
- Spinner: accent-blue, 1s linear infinite

### Empty States
- Icon (lucide, 48px) + title + description + optional CTA
- Centered in content area
- Color: text-muted for text, text-disabled for icon

### Error States
- Inline error: text accent-red, text-sm, with alert-circle icon
- Toast: fixed top-right, bg elevated (#1E293B), border border-light, slide-in from right

### Transitions
- All interactive elements: `transition-colors duration-200` or `transition-all duration-200`
- Sidebar collapse: 300ms ease
- Modal open: 200ms ease, overlay fade 150ms
- Page content: 150ms ease

---

## 10. Animation Guidelines

- Keep animations under 300ms
- Use `motion-safe:` prefix for Tailwind — respect `prefers-reduced-motion`
- Chart animations: 800ms ease-out for initial render
- Page transitions: subtle fade (opacity 0→1, 150ms)
- No parallax, no auto-play, no infinite animations (except spinner/pulse)
- Entrance animations: fade-in-up for cards, staggered by 50ms per card (max 300ms total)

---

## 11. Accessibility Requirements

- All interactive elements focusable and have visible focus ring (`ring-2 ring-accent-blue`)
- Color not the only indicator — add icons, patterns, or labels
- Form inputs associated with labels via `htmlFor`
- Data tables use `<th>` with scope
- Images have meaningful alt text
- `prefers-reduced-motion` respected via Tailwind `motion-safe:` / `motion-reduce:`
- Minimum touch target: 44x44px on mobile
- Semantic HTML: `<nav>`, `<main>`, `<aside>`, `<header>`, `<section>`

---

## 12. Icon Usage

- **Library:** lucide-react (consistent with React/Next.js stack)
- **Size:** w-5 h-5 for inline, w-6 h-6 for standalone, w-4 h-4 for dense areas
- **Sidebar:** w-5 h-5, strokeWidth 1.5
- **Buttons:** w-4 h-4 inline with text
- **Empty states:** w-12 h-12
- **No emojis as icons. EVER.**

---

## 13. File Organization (Next.js App Router)

```
src/
  app/
    (dashboard)/
      layout.tsx        ← sidebar + header layout
      campaigns/
      analytics/
      settings/
    page.tsx             ← landing/marketing (light mode, not dark)
  components/
    ui/                  ← design system primitives (button, card, input, etc.)
    dashboard/           ← page-specific components
    campaigns/           ← campaign domain components
  lib/
    utils.ts            ← cn() helper
  styles/
    globals.css         ← Tailwind + CSS variables
```

---

## 14. Conventions Checklist

- [ ] All colors from palette — no ad-hoc hex values
- [ ] Fira Sans for UI, Fira Code for data
- [ ] Dark mode default — no exceptions
- [ ] SVG icons via lucide-react
- [ ] cursor-pointer on every clickable element
- [ ] 200ms transitions on interactive states
- [ ] Focus ring visible on interactive elements
- [ ] Responsive: mobile sidebar drawer, full sidebar desktop
- [ ] prefers-reduced-motion respected
- [ ] Semantic HTML structure
