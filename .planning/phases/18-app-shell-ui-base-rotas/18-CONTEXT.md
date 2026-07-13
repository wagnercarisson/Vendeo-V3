# Phase 18: App Shell + UI Base + Rotas - Context

**Gathered:** 2026-07-13
**Status:** Ready for execution
**Source:** OpenSpec (openspec/changes/fase-18-app-shell-ui-base-rotas/)

<domain>
## Phase Boundary

Phase 18 estabelece a estrutura de navegação definitiva do Vendeo como produto SaaS coerente. Substitui navegação ad-hoc por app shell profissional com sidebar/topbar, cria 7 componentes base de UI enxutos, reorganiza todas as rotas para o padrão PT-BR, e migra páginas existentes. É a fundação da milestone v1.4 (Experiência SaaS).

**O que NÃO faz:** Dashboard com métricas (F20), onboarding/estados vazios contextuais (F19), busca/filtros/paginação (F21), mobile hardening (F22), billing/planos, múltiplas lojas, PWA, tema light, componentes além dos 7 base.
</domain>

<decisions>
## Implementation Decisions

### D1 — Route group `(app)/` com App Shell layout
CONFIRMADO. `(auth)/` e `(app)/` têm layouts radicalmente diferentes. Layout usa `requirePageUser()` para proteger o grupo inteiro. Layout NÃO chama `getCurrentStore()` — o shell não depende de loja.

### D2 — Redirects em next.config.ts
CONFIRMADO. 5 redirects 301 puramente baseados em path:
- `/` → `/dashboard`
- `/minhas-campanhas` → `/campanhas`
- `/campanha/:id` → `/campanhas/:id`
- `/store` → `/loja`
- `/campaign/preview` → `/campanhas/nova`

### D3 — Rotas antigas: remoção de arquivos
CONFIRMADO. next.config.ts é a fonte única de verdade para redirects. Arquivos de rotas antigas são removidos após migração.

### D4 — `/dashboard` placeholder
CONFIRMADO. Server Component mínimo: `<PageHeader title="Dashboard" />` + `<EmptyState>` com mensagem genérica. Conteúdo real chega na F20.

### D5 — `/conta` mínima útil
CONFIRMADO. Email via `claims.email` como identidade primária, fallback `claims.sub?.slice(0, 8)`. Link `/update-password`. Botão "Sair" (LogoutButton com token cleanup).

### D6 — `/campanhas` = `/minhas-campanhas` renomeada
CONFIRMADO. Conteúdo migrado sem alterações funcionais. Busca/filtros/paginação são F21.

### D7 — Componentes base enxutos
CONFIRMADO. 7 componentes em `src/components/ui/`:
- `Button` (Client): variant (primary/secondary/ghost), size, disabled, loading. Sem asChild/Slot.
- `Card` (Server): className, children — bg-bg-surface, border, rounded-xl.
- `Input` (Client): label, error, ...input.
- `Badge` (Server): variant (ready/error/generating/default).
- `EmptyState` (Server): icon, title, description, action (ReactNode).
- `Skeleton` (Server): width, height, rounded — animate-pulse.
- `PageHeader` (Server*): title, breadcrumbs ({label, href?}[]), actions.

### D8 — Breadcrumbs opcionais no PageHeader
CONFIRMADO. Cada página declara seus breadcrumbs. Sem sistema automático.

### D9 — Drawer mobile funcional em F18
CONFIRMADO. Sidebar visível em desktop (>768px). Em mobile: hamburger na topbar, drawer desliza da esquerda com overlay, fecha ao navegar/overlay click/Escape, aria attributes, body scroll lock. Sem focus trapping ou prefers-reduced-motion (F22).

### D10 — Store = null: shell tolera
CONFIRMADO. (app)/layout.tsx NÃO chama getCurrentStore(). Páginas funcionais resolvem loja quando necessário. F19 refina com estados vazios.

### D11 — Design token cleanup
CONFIRMADO. Aplicar tokens nas telas tocadas: shell, dashboard, campanhas, campanhas/nova, campanhas/[id], loja, conta, LogoutButton.

### D12 — AuthHeader removido
CONFIRMADO. Sidebar assume links estruturais, Topbar assume CTA + menu de conta.

### D13 — Três planos de execução
CONFIRMADO. 18-01 (UI base) → 18-02 (shell) → 18-03 (rotas + migração).
</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Design Tokens & Theming
- `tailwind.config.ts` — Design tokens existentes (bg-bg-*, text-text-*, accent-*, border-*)
- `src/app/globals.css` — Tokens CSS e animações globais

### Auth & Middleware Patterns
- `src/middleware.ts` — Middleware atual com matcher e requireUser
- `src/components/auth/logout-button.tsx` — LogoutButton existente (precisa de token cleanup)
- `src/components/auth/auth-header.tsx` — A SER REMOVIDO

### Existing Pages (to be migrated)
- `src/app/page.tsx` — Campaign form (→ campanhas/nova)
- `src/app/minhas-campanhas/` — Campaign list (→ campanhas)
- `src/app/campanha/[id]/` — Campaign detail (→ campanhas/[id])
- `src/app/store/` — Store identity (→ loja)
- `src/app/campaign/preview/` — Preview (→ removido)

### API Routes
- `src/app/api/campaign/generate-image/route.ts` — campaignUrl precisa atualizar path

### OpenSpec Source
- `openspec/changes/fase-18-app-shell-ui-base-rotas/` — Proposal, design, specs, tasks

### Phase Dependencies
- `src/app/layout.tsx` — Root layout (precisa remover header/AuthHeader)
- `next.config.ts` — Precisa adicionar redirects
</canonical_refs>

<specifics>
## Specific Ideas

### UI Component Patterns
- Button sem asChild/Slot: usar `<Link>` diretamente com classes de variante para links
- Lucide icons: Loader2 para loading, LayoutDashboard/Megaphone/Store/UserCircle para sidebar, Settings/LogOut para account menu
- Badge variantes: verde (ready), vermelho (error), âmbar (generating), cinza (default)
- Skeleton usar `animate-pulse` do Tailwind com `bg-bg-elevated`

### Shell Structure
- Sidebar: 200px-240px largura desktop, escondida em mobile
- Topbar: 100% largura, CTA "Nova Campanha" à direita, AccountMenu à direita do CTA
- Drawer mobile: fixed left 0, top 0, width 280px max, z-50, overlay z-40
- AccountMenu: dropdown simples com portal ou position absolute

### Route Structure
```
src/app/
├── (auth)/              # Layout centrado (login, signup, etc.)
├── (app)/               # Layout com App Shell
│   ├── layout.tsx       ← App Shell
│   ├── dashboard/page.tsx
│   ├── campanhas/page.tsx, nova/page.tsx, [id]/page.tsx, [id]/client.tsx
│   ├── loja/page.tsx
│   └── conta/page.tsx
├── api/                 # API routes
├── auth/                # signout, confirm
├── layout.tsx           # Root (sem header)
└── page.tsx             # redirect("/dashboard")
```
</specifics>

<deferred>
## Deferred Ideas

- Dashboard com métricas (F20)
- Onboarding completo / estados vazios contextuais (F19)
- Busca, filtros, paginação em /campanhas (F21)
- Mobile hardening / focus trap / prefers-reduced-motion (F22)
- Billing, planos, múltiplas lojas, times/permissões
- PWA, Supabase gen types, tema light
- Componentes além dos 7 base (sem DropdownMenu, DataTable, Command, etc.)
</deferred>

---

*Phase: 18-app-shell-ui-base-rotas*
*Context gathered: 2026-07-13 via OpenSpec synthesis*
