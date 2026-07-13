## Context

O Vendeo funciona como formulário em `/` com páginas soltas sem estrutura de produto. A milestone v1.4 (Experiência SaaS) começa com a F18 para entregar App Shell, UI base e roteamento profissional. Dependências: F7 (middleware, sessão SSR), F8 (signup, login), F9 (getCurrentStore), F12 (tabelas), F15 (página de campanha), F16 (listagem), F17 (edição publication copy). Design tokens existentes em `tailwind.config.ts` e `globals.css`.

## Goals / Non-Goals

**Goals:**
- 7 componentes base de UI (Button, Card, Input, Badge, EmptyState, Skeleton, PageHeader) em `src/components/ui/`
- App Shell com sidebar + topbar + drawer mobile + menu de conta, responsivo, tolerante a `store = null`
- Route group `(app)/` com layout protegido (requirePageUser) e todas as rotas filhas
- Migração de rotas: `/` → `/campanhas/nova`, `/minhas-campanhas` → `/campanhas`, `/campanha/[id]` → `/campanhas/[id]`, `/store` → `/loja`
- 5 redirects 301 em `next.config.ts` (puramente baseados em path)
- `/dashboard` placeholder (conteúdo chega na F20), `/conta` mínima útil
- AuthHeader removido, funcionalidade absorvida pelo shell
- Design token cleanup e substituição de emoji por Lucide nas telas migradas
- 25+ testes (componentes, shell, redirects, middleware)

**Non-Goals:**
- Dashboard com métricas (F20)
- Onboarding completo / estados vazios contextuais (F19)
- Busca, filtros, paginação em `/campanhas` (F21)
- Mobile hardening / focus trap / prefers-reduced-motion (F22)
- Billing, planos, múltiplas lojas, times/permissões
- PWA, Supabase gen types, tema light
- Componentes além dos 7 base (sem DropdownMenu, DataTable, Command, etc.)

## Decisions

### D1 — Route group `(app)/` com App Shell layout

`CONFIRMADO` — alinhado com docs/alinhamento-fase-18.

```
src/app/
├── (auth)/              # Layout centrado (login, signup, forgot-password, etc.)
├── (app)/               # Layout com App Shell (dashboard, campanhas/*, loja, conta)
│   ├── layout.tsx       ← App Shell
│   ├── dashboard/page.tsx
│   ├── campanhas/page.tsx, nova/page.tsx, [id]/page.tsx, [id]/client.tsx
│   ├── loja/page.tsx
│   └── conta/page.tsx
├── api/                 # API routes (campaign generate-image: campaignUrl → novo path)
├── auth/                # signout, confirm (inalterado)
├── layout.tsx           # Root: html, body, fonts, globals (sem header)
└── page.tsx             # redirect("/dashboard")
```

- `(auth)/` e `(app)/` têm layouts radicalmente diferentes
- Layout usa `requirePageUser()` para proteger o grupo inteiro
- Layout NÃO chama `getCurrentStore()` — o shell não depende de loja; páginas funcionais resolvem loja quando necessário

### D2 — Redirects em `next.config.ts`

`CONFIRMADO` — redirects 301 puramente baseados em path:

| source | destination |
|--------|-------------|
| `/` | `/dashboard` |
| `/minhas-campanhas` | `/campanhas` |
| `/campanha/:id` | `/campanhas/:id` |
| `/store` | `/loja` |
| `/campaign/preview` | `/campanhas/nova` |

- Executam antes do middleware (mais performáticos)
- `/` e `/store` removidos do `config.matcher` do middleware

### D3 — Rotas antigas: remoção de arquivos

`CONFIRMADO` — `next.config.ts` é a fonte única de verdade para redirects. Arquivos removidos:
- `src/app/minhas-campanhas/` → migrado para `(app)/campanhas/`
- `src/app/campanha/[id]/` → migrado para `(app)/campanhas/[id]/`
- `src/app/store/` → migrado para `(app)/loja/`
- `src/app/campaign/preview/` → removido (redirect via next.config)

### D4 — `/dashboard` placeholder

`CONFIRMADO` — Server Component mínimo em `(app)/dashboard/page.tsx`:
- `<PageHeader title="Dashboard" />` + `<EmptyState>` com mensagem genérica
- Já nasce com tokens de design e App Shell

### D5 — `/conta` mínima útil

`CONFIRMADO` — Página de conta:
- Email via `claims.email` como identidade primária, fallback para `claims.sub?.slice(0, 8)`
- Link para `/update-password`
- Botão "Sair" (reutiliza LogoutButton com token cleanup)
- Layout: `<PageHeader title="Conta" />` + cards de informação

### D6 — `/campanhas` = `/minhas-campanhas` renomeada

`CONFIRMADO` — conteúdo atual migrado sem alterações funcionais:
- `listCampaigns(storeId)` com `LIMIT 50`, filtro `ready`/`error`
- Lista com thumbnail, nome, data, status
- Links "Abrir" → `/campanhas/[id]`, "Baixar" → `/api/campaign/[id]/download`
- Busca/filtros/paginação são F21

### D7 — Componentes base enxutos

`CONFIRMADO` — 7 componentes em `src/components/ui/`:

| Componente | Runtime | Props |
|---|---|---|
| `Button` | Client | `variant` (primary/secondary/ghost), `size`, `disabled`, `loading`. Sem `asChild`/Slot |
| `Card` | Server | `className`, `children` — `bg-bg-surface`, `border`, `rounded-xl` |
| `Input` | Client | `label`, `error`, `...input` — label, placeholder, erro inline |
| `Badge` | Server | `variant` (ready/error/generating/default) — status colorido |
| `EmptyState` | Server | `icon`, `title`, `description`, `action` (ReactNode) |
| `Skeleton` | Server | `width`, `height`, `rounded` — placeholder animado |
| `PageHeader` | Server* | `title`, `breadcrumbs` (`{label, href?}[]`), `actions` |

### D8 — Breadcrumbs opcionais no PageHeader

`CONFIRMADO` — `Breadcrumb[]` com `{ label, href? }`. Cada página declara seus breadcrumbs. Sem sistema automático.

### D9 — Drawer mobile funcional em F18

`CONFIRMADO` — Sidebar visível em desktop (>768px). Em mobile:
- Hamburger button na topbar
- Drawer desliza da esquerda com overlay
- Fecha ao navegar, clicar fora (overlay), pressionar Escape
- `aria-controls`, `aria-expanded`, `aria-label` no hamburger
- Body scroll lock quando aberto
- Sem animações sofisticadas, focus trapping, ou prefers-reduced-motion (F22)

### D10 — Store = null: shell tolera

`CONFIRMADO` — `(app)/layout.tsx` NÃO chama `getCurrentStore()`. O shell não depende de loja — verifica apenas auth. Páginas funcionais resolvem loja quando necessário e mantêm redirects existentes (`if (!store) redirect(...)`). F19 refina com estados vazios.

### D11 — Design token cleanup

`CONFIRMADO` — Aplicar tokens nas telas tocadas pela F18: shell, dashboard, campanhas, campanhas/nova, campanhas/[id], loja, conta, LogoutButton.

Não escopo: renderização de arte, auth pages, componentes não-UI do app.

### D12 — AuthHeader removido

`CONFIRMADO` — `src/components/auth/auth-header.tsx` removido. Responsabilidades:
- Sidebar: links estruturais
- Topbar: CTA "Nova Campanha" + menu de conta
- Root layout: perde o `<header>`

### D13 — Três planos de execução

`CONFIRMADO`

```
18-01 ──► 18-02 ──► 18-03
(UI base)  (shell)   (rotas + migração)
```

- **18-01**: 7 componentes base + estrutura de diretórios + root layout sem AuthHeader + next.config.ts redirects + testes dos 7 componentes
- **18-02**: Sidebar, topbar, account-menu, sidebar-drawer, app-shell, (app)/layout.tsx, testes do shell (6-8)
- **18-03**: Migrar campanhas/nova, campanhas, campanhas/[id], loja; criar dashboard placeholder e conta; middleware matcher; remover AuthHeader; design token cleanup; LogoutButton tokens; redirect tests (5) + middleware tests (2-3)

## Risks / Trade-offs

| Risco | Mitigação |
|-------|-----------|
| Route group `(app)/` quebra links internos existentes | Mapear todos os `Link` e `redirect()` antes de migrar. Testar navegação completa |
| Drawer mobile sem focus trap causa problemas de acessibilidade | F18 entrega funcionalidade básica. Focus trapping completo em F22 |
| Escopo cresce ("já que vamos mexer...") | Alignment doc define fronteiras claras. Seção Fora do Escopo explícita |
| Middleware e next.config redirects em conflito | Redirects em next.config executam primeiro. Middleware só vê a rota final |
| `store = null` quebra página de campanhas/nova | Mantido redirect atual para `/loja`. F19 refina |
| Emoji icons substituídos por Lucide podem gerar regressão visual | Tarefa explícita no plano 18-03. Conferir todos os ícones |
| Breadcrumbs inconsistentes entre páginas | Cada página declara seus breadcrumbs. Consistência via revisão de código |
