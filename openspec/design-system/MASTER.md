# Design System — Vendeo V3 (Motor de Geração de Campanhas)

> **CONTROLLED DESIGN SOURCE OF TRUTH.** This file defines design rules for all agents building UI for Vendeo V3.
> Rules evolve only via registered design decisions — no ad-hoc deviations.
> When building a page, first check `openspec/design-system/pages/[page-name].md`.
> If that file exists, its rules override this Master for that page only.

---

## 1. Visual Identity

**Product:** Ferramenta SaaS / motor de geração de campanhas profissionais para pequenos e médios lojistas físicos
**Core Value:** Gerar uma campanha profissional de Produto + Oferta que o lojista tenha confiança de publicar e que ajude a vender mais
**Tone:** Simples, profissional, comercial, acessível, confiável

### Style
- **Primary:** Dark Mode (OLED) — profissional, foco no conteúdo visual
- **Keywords:** dark, high-contrast, professional, clean, commercial, trustworthy, accessible
- **Best For:** Geração de campanhas, ferramentas comerciais, pequenos negócios, plataformas de conteúdo visual
- **Performance:** ⚡ Excellent
- **Accessibility:** ✓ WCAG AAA

### Anti-patterns (DO NOT USE)
- ❌ Aparência técnica ou data-dense — o Vendeo é para lojistas, não para analistas de tráfego
- ❌ Emojis as icons — use SVG (Lucide/Heroicons)
- ❌ Layout-shifting hover states (avoid scale transforms)
- ❌ Low contrast text — maintain 7:1 minimum on dark bg
- ❌ Instant transitions — always use 150-300ms
- ❌ Missing cursor:pointer on interactive elements
- ❌ White (#FFFFFF) backgrounds — use `#020617` or `#0F172A`
- ❌ Jargão de marketing digital — prefira termos do dia a dia do lojista
- ❌ Poluição visual — cada tela deve ter UMA ação principal clara

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
| `--accent-green` | `#22C55E` | CTA buttons, success, confirmação |
| `--accent-blue` | `#3B82F6` | Links, info, ações secundárias |
| `--accent-amber` | `#F59E0B` | Warnings, highlights, atenção |
| `--accent-red` | `#EF4444` | Errors, validação negativa |

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
    amber: '#F59E0B',
    red: '#EF4444',
  },
}
```

---

## 3. Typography

| Role | Font | Weight | Size Scale |
|------|------|--------|------------|
| Headings | `Poppins` | 600, 700 | `text-xl` (1.25rem) to `text-3xl` (1.875rem) |
| Body | `Open Sans` | 400, 500 | `text-sm` (0.875rem) to `text-base` (1rem) |
| Labels/Captions | `Poppins` | 500 | `text-xs` (0.75rem) |
| Monospace (dados) | `JetBrains Mono` | 400, 500 | `text-xs` (0.75rem) to `text-sm` (0.875rem) |

**CSS Import:**
```css
@import url('https://fonts.googleapis.com/css2?family=Open+Sans:wght@300;400;500;600;700&family=Poppins:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap');
```

**Font Weights by Context:**
- Page title: Poppins 700
- Section heading: Poppins 600
- Card title: Poppins 500
- Body text: Open Sans 400
- Small print / helper: Open Sans 400
- Data/monospace: JetBrains Mono 500
- Label/caption: Poppins 500, uppercase tracking-wider

**Why this pairing:** Poppins é geométrica e amigável — passa modernidade sem ser "tech".
Open Sans é altamente legível em corpo de texto. Juntas, transmitem profissionalismo comercial, não técnico.

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

---

## 6. Component Specifications (V1)

### 6.1 Buttons

**Primary (CTA):**
- bg: `accent-green` (#22C55E), text: white
- Padding: px-6 py-2.5, rounded-lg
- Font: Poppins 600, text-sm
- Hover: brightness(110%)
- Transition: 200ms ease
- Cursor: pointer
- Uso: ação principal da tela (Gerar Campanha, Exportar, Salvar)

**Secondary Outline:**
- bg: transparent, border: border-light (#334155), text: text-primary
- Padding: px-6 py-2.5, rounded-lg
- Hover: bg `#1E293B`
- Transition: 200ms ease
- Uso: ações secundárias, cancelar

**Ghost:**
- bg: transparent, text: text-secondary
- Hover: bg `#1E293B`, text: text-primary
- w-9 h-9, rounded-lg
- Uso: botões de ação em toolbar, voltar

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
  font-family: 'Open Sans', sans-serif;
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
  font-family: 'Poppins', sans-serif;
}
```

**Form validation:**
- Inline validation on blur
- Error: text-accent-red text-xs, with alert-circle icon
- Success: text-accent-green text-xs, with check-circle icon
- Never validate only on submit

### 6.4 Badges / Tags

```css
.badge {
  padding: 0.125rem 0.5rem;
  border-radius: 9999px;
  font-size: 0.75rem;
  font-weight: 500;
  font-family: 'Poppins', sans-serif;
}
.badge-green {
  background: rgba(34, 197, 94, 0.1);
  color: #22C55E;
  border: 1px solid rgba(34, 197, 94, 0.2);
}
.badge-blue {
  background: rgba(59, 130, 246, 0.1);
  color: #3B82F6;
  border: 1px solid rgba(59, 130, 246, 0.2);
}
.badge-amber {
  background: rgba(245, 158, 11, 0.1);
  color: #F59E0B;
  border: 1px solid rgba(245, 158, 11, 0.2);
}
.badge-gray {
  background: rgba(100, 116, 139, 0.1);
  color: #94A3B8;
  border: 1px solid rgba(100, 116, 139, 0.2);
}
```

### 6.5 Modals / Dialogs

- Overlay: `rgba(2, 6, 23, 0.8)` + backdrop-blur-sm
- Content: bg `#1E293B`, border `#334155`, rounded-xl (16px)
- Padding: 1.5rem-2rem
- Max-width: 480px for dialogs
- Close button: ghost icon top-right

---

## 7. V1 Flow Pages

The V1 consists of a linear flow with these pages:

```
[Identidade da Loja] → [Dados da Campanha] → [Pré-visualização] → [Revisão & Exportação]
```

Each page maps to a corresponding override file in `openspec/design-system/pages/`.

### Page Roles
| Page | Purpose | File |
|------|---------|------|
| Store Identity | Logo, nome, segmento, cor da marca | `pages/store-identity.md` |
| Campaign Input | Produto, oferta, preço, descrição | `pages/campaign-input.md` |
| Preview | Visualização da arte gerada | `pages/campaign-preview.md` |
| Review & Export | Aprovação e download da campanha | `pages/review-export.md` |

These are documented individually in their respective override files.
The output visual (campaign image) follows `CAMPAIGN_VISUAL_SYSTEM.md`.

---

## 8. Navigation & Layout (V1)

### Layout Structure
```
┌──────────────────────────────────────────────┐
│  Top Bar (h-14)                              │
│  ← Voltar  |  Logo  |  [step indicator]     │
├──────────────────────────────────────────────┤
│                                              │
│        Main Content Area (centered)          │
│        max-w-3xl for forms                   │
│        max-w-5xl for preview                 │
│                                              │
└──────────────────────────────────────────────┘
```

### Step Indicator
- Horizontal steps above content
- Active step: text-accent-green, filled circle
- Completed step: text-accent-green, check icon
- Future step: text-muted, outlined circle
- Step labels: Poppins 500 text-xs

### Responsive Behavior
- Mobile (< 768px): single column, full-width inputs, preview stacks vertically
- Desktop (768px+): preview side-by-side with form where applicable, max-width constrained

---

## 9. Interaction Patterns

### Loading States
- Button loading: spinner icon + "Gerando..." text, button disabled
- Image generation: skeleton placeholder with shimmer, aspect-ratio preserved
- Page transitions: subtle fade (opacity 0→1, 150ms)

### Empty States
- Icon (lucide, 48px) + title + description + optional CTA
- Centered in content area
- Color: text-muted for text, text-disabled for icon

### Error States
- Inline form error: text-accent-red text-xs, with alert-circle icon below input
- Generation error: inline banner within preview area, with retry CTA
- Toast: fixed top-right, bg elevated (#1E293B), border border-light

### Transitions
- Step navigation: slide (horizontal) 250ms ease
- Preview image fade-in: 300ms ease
- All interactive elements: `transition-colors duration-200` or `transition-all duration-200`

---

## 10. Animation Guidelines

- Keep animations under 300ms
- Use `motion-safe:` prefix for Tailwind — respect `prefers-reduced-motion`
- No parallax, no auto-play, no infinite animations (except spinner/pulse)
- Step transitions: slide direction indicates forward/backward navigation

---

## 11. Accessibility Requirements

- All interactive elements focusable and have visible focus ring (`ring-2 ring-accent-blue`)
- Color not the only indicator — add icons, patterns, or labels
- Form inputs associated with labels via `htmlFor`
- Images have meaningful alt text
- `prefers-reduced-motion` respected via Tailwind `motion-safe:` / `motion-reduce:`
- Minimum touch target: 44x44px on mobile
- Semantic HTML: `<nav>`, `<main>`, `<header>`, `<form>`, `<section>`

---

## 12. Icon Usage

- **Library:** lucide-react (consistent with React/Next.js stack)
- **Size:** w-5 h-5 for inline, w-6 h-6 for standalone, w-4 h-4 for dense areas
- **Buttons:** w-4 h-4 inline with text (left of label for actions, right for external links)
- **Empty states:** w-12 h-12
- **Step indicators:** custom circles with check/numbers (not lucide icons)
- **No emojis as icons. EVER.**

---

## 13. File Organization (Next.js App Router — V1)

```
src/
  app/
    (flow)/
      layout.tsx           ← step indicator + top bar (shared across V1 flow)
      store-identity/
      campaign-input/
      preview/
      review-export/
    page.tsx                ← landing page (futuro)
  components/
    ui/                     ← design system primitives (button, card, input, etc.)
    flow/                   ← V1 flow-specific components
    campaign/               ← campaign domain components (preview card, etc.)
  lib/
    utils.ts                ← cn() helper
  styles/
    globals.css             ← Tailwind + CSS variables
```

---

## 14. Conventions Checklist

- [x] Produto reposicionado: ferramenta de geração de campanhas, NÃO plataforma de anúncios
- [x] Tom comercial e acessível, não técnico/data-dense
- [x] Tipografia amigável (Poppins + Open Sans), não monospace-heavy
- [x] Dark mode como identidade visual
- [x] SVG icons via lucide-react — proibido emoji
- [x] cursor-pointer on every clickable element
- [x] 200ms transitions on interactive states
- [x] Focus ring visible on interactive elements
- [x] prefers-reduced-motion respected
- [x] Semantic HTML structure
- [x] V1 flow linear de 4 etapas (sem dashboard)
- [x] Dashboard marcado como fase futura em pages/dashboard.md
