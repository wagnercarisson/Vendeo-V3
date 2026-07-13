# Phase 19: Onboarding & Estados Vazios - Context

**Gathered:** 2026-07-13
**Status:** Ready for planning
**Source:** OpenSpec (openspec/changes/fase-19-onboarding-estados-vazios/)

<domain>
## Phase Boundary

Phase 19 implementa a experiência de onboarding determinístico para novos usuários e garante estados vazios consistentes em toda a aplicação. Substitui redirects secos por orientação visual contextual, criando um helper centralizado de detecção de onboarding (`getUserOnboardingState`) com 3 estados: `no_store | has_store_no_campaigns | has_store_with_campaigns`. Transforma o dashboard de placeholder genérico em server component async com renderização condicional.

**O que NÃO faz:** Dashboard com métricas (F20), campanhas recentes no dashboard (F20), card de próximo passo adaptativo (F20), busca/filtros/paginação em `/campanhas` (F21), alterações no fluxo de criação/edição de loja (`/loja`), redirect pós-save da loja para dashboard, detecção de "primeiro login" por `created_at`, i18n, billing/planos, múltiplas lojas, componentes novos de UI (EmptyState e PageHeader de F18 atendem todos os casos).
</domain>

<decisions>
## Implementation Decisions

### D1 — `getUserOnboardingState`: helper centralizado de 3 estados
CONFIRMADO. `src/lib/onboarding/state.ts` com `"server-only"`, chama `getCurrentStore` + `countCampaigns`, retorna `no_store | has_store_no_campaigns | has_store_with_campaigns`. Centraliza detecção — se mudar a definição de "tem campanha", muda só aqui.

### D2 — `countCampaigns(storeId)`: `SELECT COUNT(*)` sem signed URLs
CONFIRMADO. `src/lib/onboarding/count.ts` com `"server-only"`, usa `createServerClient()`, `SELECT COUNT(*)` na tabela `campaigns` com `head: true`, filtro `store_id` + `status IN ('ready', 'error')`. Retorna `count` ou `0`.

### D3 — Dashboard server component com 3 estados
CONFIRMADO. DashboardPage como async server component: chama `requirePageUser()` → `getUserOnboardingState(user.userId)` → switch com 3 estados. Reutiliza `<PageHeader>` + `<EmptyState>` (F18). Nenhum componente novo de UI.

### D4 — `/campanhas` sem loja: empty state em vez de redirect
CONFIRMADO. Substituir `if (!store) { redirect("/loja"); }` por `return <EmptyState>` com `CAMPAIGNS_NO_STORE` + CTA → `/loja`. Não chama `countCampaigns` quando `no_store`.

### D5 — `/campanhas/nova`: redirect mantido
CONFIRMADO. Página funcionalmente depende de loja para operar. Redirect permanece inalterado.

### D6 — `/campanhas/[id]` sem loja: `notFound()`
CONFIRMADO. Substituir `redirect("/loja")` por `notFound()` quando `!store`. 404 é semanticamente correto para página de recurso específico.

### D7 — Microcopy centralizada
CONFIRMADO. `src/lib/onboarding/microcopy.ts` com constantes `EmptyStateCopy` tipadas: `DASHBOARD_NO_STORE`, `DASHBOARD_NO_CAMPAIGNS`, `DASHBOARD_PLACEHOLDER`, `CAMPAIGNS_NO_STORE`, `CAMPAIGNS_NO_CAMPAIGNS`.

### D8 — Estrutura de diretórios
CONFIRMADO.
```
src/lib/onboarding/
├── types.ts          → OnboardingState, EmptyStateCopy
├── state.ts          → getUserOnboardingState(userId)  [server-only]
├── count.ts          → countCampaigns(storeId)           [server-only]
└── microcopy.ts      → constantes de empty state
```

### D9 — Fluxo da loja NÃO alterado
CONFIRMADO. F19 guia o usuário até `/loja` via CTAs, não modifica comportamento pós-save.

### D10 — "Primeiro acesso" definido pelo estado real do produto
CONFIRMADO. Onboarding determinístico baseado em `no_store | has_store_no_campaigns | has_store_with_campaigns`. Sem heurísticas de `created_at` ou `user_metadata`.

### D11 — Três planos de execução
CONFIRMADO.
```
19-01 ──► 19-02 ──► 19-03
(helper)   (dashboard)   (campanhas)
```

| Plano | O quê | Arquivos |
|-------|-------|----------|
| **19-01** | Fundação do onboarding helper | `src/lib/onboarding/types.ts`, `state.ts`, `count.ts`, `microcopy.ts` + testes unitários |
| **19-02** | Dashboard inteligente | `src/app/(app)/dashboard/page.tsx` (server component async, 3 estados) + testes |
| **19-03** | Campanhas + detalhe sem loja | `src/app/(app)/campanhas/page.tsx`, `[id]/page.tsx`, `nova/page.tsx` (verificar), `client.tsx` (revisar microcopy) + testes |
</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### OpenSpec Source (source of truth)
- `openspec/changes/fase-19-onboarding-estados-vazios/design.md` — All design decisions D1-D11
- `openspec/changes/fase-19-onboarding-estados-vazios/tasks.md` — Task breakdown for all 3 plans
- `openspec/changes/fase-19-onboarding-estados-vazios/specs/onboarding-helper/spec.md` — Specs for types, count, state, microcopy
- `openspec/changes/fase-19-onboarding-estados-vazios/specs/dashboard-inteligente/spec.md` — Specs for dashboard 3-state rendering
- `openspec/changes/fase-19-onboarding-estados-vazios/specs/campaign-list-ui/spec.md` — Specs for campaign list empty states
- `openspec/changes/fase-19-onboarding-estados-vazios/specs/campaign-page-ui/spec.md` — Specs for campaign detail 404 behavior

### Phase 18 Dependencies
- `.planning/phases/18-app-shell-ui-base-rotas/18-CONTEXT.md` — App Shell, EmptyState, PageHeader, route structure
- `src/components/ui/empty-state.tsx` — EmptyState component (reused for all empty states)
- `src/components/ui/page-header.tsx` — PageHeader component (used in dashboard)
- `src/app/(app)/dashboard/page.tsx` — Current dashboard placeholder (TO BE MODIFIED)
- `src/app/(app)/campanhas/page.tsx` — Current campaign list with redirect (TO BE MODIFIED)
- `src/app/(app)/campanhas/[id]/page.tsx` — Current campaign detail with redirect (TO BE MODIFIED)
- `src/app/(app)/campanhas/nova/page.tsx` — Current new campaign with redirect (TO BE VERIFIED)
- `src/app/(app)/campanhas/client.tsx` — Campaign list client component (TO BE REVIEWED)

### Auth & Ownership Patterns
- `src/lib/auth/require-user.ts` — `requirePageUser()` pattern
- `src/lib/auth/store-ownership.ts` — `getCurrentStore()` pattern
- `src/lib/supabase/server.ts` — `createServerClient()` pattern
</canonical_refs>

<specifics>
## Specific Ideas

### Microcopy Constants (src/lib/onboarding/microcopy.ts)

| Constant | icon | title | description | ctaLabel | ctaHref |
|----------|------|-------|-------------|----------|---------|
| `DASHBOARD_NO_STORE` | `Store` | Configure sua loja | Para começar a criar campanhas, primeiro precisamos conhecer sua loja. | Configurar loja | /loja |
| `DASHBOARD_NO_CAMPAIGNS` | `Megaphone` | Crie sua primeira campanha | Sua loja está pronta! Agora é hora de criar sua primeira campanha profissional. | Criar campanha | /campanhas/nova |
| `DASHBOARD_PLACEHOLDER` | `LayoutDashboard` | Seu dashboard está sendo preparado | Em breve você verá aqui suas métricas e campanhas recentes. | (sem CTA) | (sem CTA) |
| `CAMPAIGNS_NO_STORE` | `Store` | Configure sua loja | Suas campanhas aparecerão aqui depois que você configurar sua loja. | Configurar loja | /loja |
| `CAMPAIGNS_NO_CAMPAIGNS` | `Megaphone` | Nenhuma campanha ainda | Crie sua primeira campanha e ela aparecerá aqui. | Criar primeira campanha | /campanhas/nova |

### Dashboard Structure (3 states)
```
DashboardPage (server component, async)
  ├── const user = await requirePageUser()
  ├── const state = await getUserOnboardingState(user.userId)
  ├── switch (state):
  │   ├── "no_store"              → <PageHeader /> + <EmptyState> "Configure sua loja" CTA → /loja
  │   ├── "has_store_no_campaigns" → <PageHeader /> + <EmptyState> "Crie sua primeira campanha" CTA → /campanhas/nova
  │   └── "has_store_with_campaigns" → <PageHeader /> + <EmptyState> placeholder neutro (sem CTA)
```

### Route Changes
- `/campanhas`: `redirect("/loja")` → `<EmptyState>` com CTA `/loja` quando `!store`
- `/campanhas/[id]`: `redirect("/loja")` → `notFound()` quando `!store`
- `/campanhas/nova`: redirect mantido (inalterado)
- `/campanhas client.tsx`: texto inline "Nenhuma campanha encontrada" → referenciar `CAMPAIGNS_NO_CAMPAIGNS` de `microcopy.ts`
</specifics>

<deferred>
## Deferred Ideas

- Dashboard com métricas (F20)
- Campanhas recentes no dashboard (F20)
- Card de próximo passo adaptativo (F20)
- Busca, filtros, paginação em /campanhas (F21)
- Mobile hardening (F22)
- i18n / internacionalização
- Billing / planos / múltiplas lojas (1:N)
- Detecção de "primeiro login" por created_at ou user_metadata
- Redirect pós-save da loja para dashboard
</deferred>

---

*Phase: 19-onboarding-estados-vazios*
*Context gathered: 2026-07-13 via OpenSpec synthesis*
