# Page Override — Dashboard

> **FUTURE SAAS PHASE — NOT PART OF V1 IMPLEMENTATION.**
> These rules are preserved for the SaaS dashboard phase (post-V1).
> Currently stored for reference only. Do not implement during V1.
>
> Override rules for the Dashboard page layout.
> These rules take precedence over `openspec/design-system/MASTER.md` when building the Dashboard.
> All non-overridden rules from MASTER.md still apply.

---

## 1. Layout Structure

```
┌───────────────────────────────────────────────────────┐
│  Top Nav Bar (h-14)                                   │
│  Logo | Search | Quick Actions | Notif | Profile      │
├──────────┬────────────────────────────────────────────┤
│ Sidebar  │  Content Area                              │
│ (w-56)   │                                            │
│          │  ┌──────────────────────────────────────┐  │
│ Nav      │  │  Page Header + Date Range Filter     │  │
│ Campaigns│  └──────────────────────────────────────┘  │
│ Analytics│                                            │
│ Settings │  ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐     │
│          │  │ KPI  │ │ KPI  │ │ KPI  │ │ KPI  │     │
│          │  └──────┘ └──────┘ └──────┘ └──────┘     │
│          │                                            │
│          │  ┌──────────────────────────────────────┐  │
│          │  │ Main Chart (Performance Trend)       │  │
│          │  └──────────────────────────────────────┘  │
│          │                                            │
│          │  ┌──────────────────┐  ┌────────────────┐  │
│          │  │ Campaigns Table  │  │ Quick Stats    │  │
│          │  │ (recent/sorted)  │  │ (mini cards)   │  │
│          │  └──────────────────┘  └────────────────┘  │
│          │                                            │
└──────────┴────────────────────────────────────────────┘
```

---

## 2. Sidebar Overrides

- **Width:** w-56 (instead of w-64) — more space for content
- **Style variation:** bg-surface, no right border line — use subtle shadow sm on the right edge
- **Active item:** left border 3px solid accent-blue, bg-hover (`#334155`), text accent-blue
- **Icon size:** w-4.5 h-4.5 (18px), strokeWidth 1.5
- **Collapsed state (tablet):** w-16, icons only, tooltip on hover

### Sidebar Navigation Items

| Icon (lucide) | Label | Path |
|---------------|-------|------|
| LayoutDashboard | Visão Geral | /dashboard |
| Megaphone | Campanhas | /dashboard/campaigns |
| BarChart3 | Analytics | /dashboard/analytics |
| Settings | Configurações | /dashboard/settings |

### Sidebar Section Secondary Items (collapsible)

| Icon | Label | Path |
|------|-------|------|
| PlusCircle | Nova Campanha | /campaigns/new |
| History | Histórico | /campaigns/history |
| TrendingUp | Performance | /analytics/performance |

---

## 3. KPI Cards

**Grid:** 4 columns on desktop, 2 on tablet, 1 on mobile
**Gap:** gap-4

### Each KPI Card
```
┌──────────────────────┐
│ [icon]  Label        │  ← text-muted, text-xs, uppercase
│                      │
│ R$ 1.234   +12.5%   │  ← metric Fira Code 600, text-xl
│                      │     change text-accent-green with ↑ icon
│                      │     negative change: text-accent-red with ↓ icon
└──────────────────────┘
```
- bg: surface (#0F172A)
- border: DEFAULT (#1E293B)
- hover: border-light (#334155)
- transition: 200ms ease
- cursor: pointer (clickable to filter by metric)
- Icon: w-5 h-5, accent-colored (green for revenue, blue for impressions, etc.)

### Default KPI Set
| KPI | Format | Color |
|-----|--------|-------|
| Impressions | `1.2M` | accent-blue |
| Cliques | `3.456` | accent-purple |
| CTR | `2.89%` | accent-amber |
| Gasto Total | `R$ 1.234` | accent-green |

---

## 4. Charts

### Main Chart — Performance Over Time
- **Type:** Line Chart (Recharts)
- **Height:** h-72 (288px)
- **Grid lines:** #1E293B, dashed
- **Line colors:** accent-green (primary metric), accent-blue (secondary)
- **X-axis:** date labels, text-muted, text-xs
- **Y-axis:** formatted values, text-muted, text-xs
- **Tooltip:** bg-elevated (#1E293B), border border-light, text-primary
- **Legend:** bottom, text-secondary, text-xs
- **Area fill:** gradient from accent-green/20 to transparent
- **Empty state:** "Nenhum dado no período" centered

### Secondary (Mini) Charts for Analytics Page
- **Type:** Bar Chart (horizontal for comparison)
- **Type:** Donut Chart (for campaign type distribution)
- **Type:** Funnel Chart (for conversion tracking)

---

## 5. Campaigns Table

### Column Structure
| Status | Nome da Campanha | Plataforma | Orçamento | Impressões | CTR | Ações |
|--------|-----------------|-----------|-----------|------------|-----|-------|

### Status Variants
| State | Badge Class |
|-------|-------------|
| Ativa | `badge-green` with pulsing dot |
| Pausada | `badge-amber` |
| Rascunho | `badge-gray` (bg `#1E293B`, text `#94A3B8`) |
| Concluída | `badge-green` solid |

### Actions Column
- Three-dot menu (lucide: `moreHorizontal`)
- Click opens dropdown: Editar, Pausar, Duplicar, Excluir
- Dropdown bg-elevated, border border-light, rounded-lg

### Empty State
```
[ icon: Megaphone, text-muted, 48px ]
Nenhuma campanha ainda
Crie sua primeira campanha para começar
[ button: "Criar Campanha" ]
```

---

## 6. Page Header

```
┌──────────────────────────────────────────────────┐
│  Visão Geral                        [ Date Range ]│  ← h-14 area
│  text-primary text-2xl fira-sans 700              │     below top nav
└──────────────────────────────────────────────────┘
```

**Date Range Picker:**
- Variant: secondary outline button with lucide `calendar` icon
- Dropdown: Últimos 7 dias | Últimos 30 dias | Este mês | Personalizado
- Active option: text-accent-blue

---

## 7. Responsive Behavior

| Breakpoint | Sidebar | Layout |
|------------|---------|--------|
| < 768px | Drawer overlay (w-64), triggered by hamburger | KPI: 1 col, chart: full width |
| 768-1023px | Collapsed icons (w-16) | KPI: 2 col, chart + table: stacked |
| 1024px+ | Full sidebar (w-56) | KPI: 4 col, chart full, table + stats side-by-side |

---

## 8. Loading State

```
┌──────────────────────────────────────────────────┐
│  Skeleton h-10 w-48 (title)                      │
│  Skeleton h-10 w-32 (date button)                │
│                                                   │
│  ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐            │
│  │skel  │ │skel  │ │skel  │ │skel  │            │
│  │ h-24 │ │ h-24 │ │ h-24 │ │ h-24 │            │
│  └──────┘ └──────┘ └──────┘ └──────┘            │
│                                                   │
│  ┌──────────────────────────────────────────┐     │
│  │  Skeleton h-72 (chart area)              │     │
│  └──────────────────────────────────────────┘     │
│                                                   │
│  ┌────────────────────────────────────┐           │
│  │  Skeleton table rows (h-10 x 5)   │           │
│  └────────────────────────────────────┘           │
└──────────────────────────────────────────────────┘
```

Shimmer skeleton: bg `#1E293B` base with `#334155` moving gradient at 45deg, rounded-lg.
