# Phase 20: Dashboard — Context

**Gathered:** 2026-07-13
**Status:** Ready for planning
**Source:** OpenSpec (openspec/changes/fase-20-dashboard/)

<domain>
## Phase Boundary

Phase 20 implementa o dashboard real para o estado `has_store_with_campaigns`, substituindo o placeholder genérico da F19 ("Seu dashboard está sendo preparado"). Usuários com loja e campanhas passam a ter métricas consolidadas (total, prontas, taxa de sucesso), campanhas recentes, saudação com nome da loja, e card de próximo passo adaptativo. Os estados `no_store` e `has_store_no_campaigns` permanecem intactos.

**O que NÃO faz:** Thumbnails nas campanhas recentes (signed URLs), gráficos/charts, data range picker, exportação de dados, busca/filtros/paginação, mobile hardening, alterações no fluxo de criação/edição de loja, campos novos na tabela campaigns, componentes novos de UI, i18n, billing, múltiplas lojas, alterações em middleware/API routes/next.config.
</domain>

<decisions>
## Implementation Decisions

### D1 — Helpers agregados em `src/lib/campaign/metrics.ts`
CONFIRMADO. `countCampaigns`, `countReadyCampaigns`, `getCampaignSuccessRate`, `getRecentCampaigns`, `RecentCampaignItem` em `src/lib/campaign/metrics.ts` com `"server-only"`. `getCampaignSuccessRate` usa `Promise.all` para paralelizar queries. `getRecentCampaigns` retorna tipo próprio leve sem `storagePath`.

### D2 — Reexport de `countCampaigns` em `src/lib/onboarding/count.ts`
CONFIRMADO. `src/lib/onboarding/count.ts` vira reexport de `@/lib/campaign/metrics`. Mantém compatibilidade com F19 — nenhuma alteração em `state.ts` ou `microcopy.ts`.

### D3 — Dashboard sem thumbnails nas campanhas recentes
CONFIRMADO. `getRecentCampaigns` retorna tipo próprio `RecentCampaignItem` (id, productName, status, createdAt). Nenhuma signed URL no dashboard. `CampaignListItem` (de list.ts, que tem `thumbnailUrl`) não é usado no dashboard.

### D4 — Taxa de sucesso: `ready / (ready + error)`, ignorando `generating`
CONFIRMADO. `countCampaigns` conta `ready + error`. `countReadyCampaigns` conta apenas `ready`. `successRate = countReady / countCampaigns`. `Math.round` para inteiro. Retorna 0 quando `total === 0`.

### D5 — Saudação com hora do servidor + nome da loja
CONFIRMADO. Função `getGreeting(storeName)`: 6h-12h "Bom dia", 12h-18h "Boa tarde", 18h-6h "Boa noite". Fallback "Bem-vindo ao Vendeo" quando `storeName` é null.

### D6 — Card de próximo passo adaptativo
CONFIRMADO. Se `recentCampaigns[0]` existe: "Revise sua última campanha" + CTA → `/campanhas/[últimoId]`. Se lista vazia: "Criar nova campanha" + CTA → `/campanhas/nova`. Opção secundária "Nova" sempre visível.

### D7 — Layout responsivo: `grid-cols-1 md:grid-cols-3`
CONFIRMADO. Grid de métricas com `grid-cols-1 md:grid-cols-3 gap-4`. Mobile < 768px = 1 coluna; Desktop >= 768px = 3 colunas.

### D8 — Fluxo de dados do dashboard real
CONFIRMADO.
```
DashboardPage (server component, async)
  ├── const user = await requirePageUser()
  ├── const state = await getUserOnboardingState(user.userId)
  ├── switch (state):
  │   ├── "no_store"                → <PageHeader /> + <EmptyState> (F19, inalterado)
  │   ├── "has_store_no_campaigns"  → <PageHeader /> + <EmptyState> (F19, inalterado)
  │   └── "has_store_with_campaigns" → <DashboardContent />
  └── DashboardContent:
      ├── const store = await getCurrentStore(user.userId)
      ├── const [total, ready, recentCampaigns] = await Promise.all([
      │     countCampaigns(store.id),
      │     countReadyCampaigns(store.id),
      │     getRecentCampaigns(store.id, 5),
      │   ])
      ├── const rate = total > 0 ? Math.round((ready / total) * 100) : 0
      ├── <PageHeader title="Dashboard" />
      ├── <Greeting storeName={store.name} />
      ├── <MetricsGrid total={total} ready={ready} rate={rate} />
      ├── <RecentCampaigns campaigns={recentCampaigns} />
      ├── <NextStepCard latest={recentCampaigns[0]} />
      └── <Link href="/loja">Configurar loja</Link>
```

### D9 — Três planos de execução
CONFIRMADO.
| Plano | O quê | Arquivos |
|-------|-------|----------|
| **20-01** | Métricas e recentes | `src/lib/campaign/metrics.ts` (criar) + `src/lib/onboarding/count.ts` (reescrever como reexport) + testes unitários (8) |
| **20-02** | Dashboard completo | `src/app/(app)/dashboard/page.tsx` (substituir placeholder `has_store_with_campaigns`; manter estados F19 inalterados) |
| **20-03** | Testes e acabamento responsivo | Testes de renderização (8-10), saudação com mock Date, responsividade, validação de preservação F19 |
</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### OpenSpec Source (source of truth)
- `openspec/changes/fase-20-dashboard/design.md` — All design decisions D1-D9
- `openspec/changes/fase-20-dashboard/tasks.md` — Task breakdown for all 3 plans
- `openspec/changes/fase-20-dashboard/specs/campaign-metrics/spec.md` — Specs for countCampaigns, countReadyCampaigns, getCampaignSuccessRate, getRecentCampaigns
- `openspec/changes/fase-20-dashboard/specs/dashboard-inteligente/spec.md` — Specs for dashboard greeting, metrics, recent campaigns, next-step card

### Phase 19 Dependencies
- `.planning/phases/19-onboarding-estados-vazios/19-CONTEXT.md` — Onboarding states, microcopy, empty states
- `src/lib/onboarding/state.ts` — `getUserOnboardingState` (preserved, unchanged)
- `src/lib/onboarding/count.ts` — will become reexport (D2)
- `src/lib/onboarding/microcopy.ts` — `DASHBOARD_PLACEHOLDER` constant
- `src/app/(app)/dashboard/page.tsx` — current dashboard with placeholder (TO BE MODIFIED)

### Phase 18 Dependencies (UI Components)
- `src/components/ui/card.tsx` — Card component for metrics and next-step
- `src/components/ui/badge.tsx` — Badge component for campaign status
- `src/components/ui/page-header.tsx` — PageHeader component
- `src/components/ui/empty-state.tsx` — EmptyState component (preserved for F19 states)

### Auth & Ownership Patterns
- `src/lib/auth/require-user.ts` — `requirePageUser()` pattern
- `src/lib/auth/store-ownership.ts` — `getCurrentStore()` pattern
- `src/lib/supabase/server.ts` — `createServerClient()` pattern

### Campaign Domain
- `src/lib/campaign/types.ts` — `CampaignStatus` type
- `src/lib/campaign/list.ts` — `CampaignListItem` (NOT used in dashboard, per D3)
</canonical_refs>

<specifics>
## Specific Ideas

### Metrics Module (`src/lib/campaign/metrics.ts`)

```typescript
import "server-only";
import { createServerClient } from "@/lib/supabase/server";
import type { CampaignStatus } from "./types";

export async function countCampaigns(storeId: string): Promise<number> {
  const supabase = await createServerClient();
  const { count, error } = await supabase
    .from("campaigns")
    .select("*", { count: "exact", head: true })
    .eq("store_id", storeId)
    .in("status", ["ready", "error"]);
  if (error) throw new Error(error.message);
  return count ?? 0;
}

export async function countReadyCampaigns(storeId: string): Promise<number> {
  const supabase = await createServerClient();
  const { count, error } = await supabase
    .from("campaigns")
    .select("*", { count: "exact", head: true })
    .eq("store_id", storeId)
    .eq("status", "ready");
  if (error) throw new Error(error.message);
  return count ?? 0;
}

export async function getCampaignSuccessRate(storeId: string): Promise<number> {
  const [total, ready] = await Promise.all([
    countCampaigns(storeId),
    countReadyCampaigns(storeId),
  ]);
  if (total === 0) return 0;
  return Math.round((ready / total) * 100);
}

export async function getRecentCampaigns(
  storeId: string,
  limit = 5,
): Promise<RecentCampaignItem[]> {
  const supabase = await createServerClient();
  const { data, error } = await supabase
    .from("campaigns")
    .select("id, product_name, status, created_at")
    .eq("store_id", storeId)
    .in("status", ["ready", "error"])
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => ({
    id: row.id,
    productName: row.product_name,
    status: row.status as CampaignStatus,
    createdAt: row.created_at,
  }));
}

export interface RecentCampaignItem {
  id: string;
  productName: string;
  status: CampaignStatus;
  createdAt: string;
}
```

### Greeting Logic
```typescript
function getGreeting(storeName: string | null): string {
  const hour = new Date().getHours();
  const period =
    hour >= 6 && hour < 12 ? "Bom dia" :
    hour >= 12 && hour < 18 ? "Boa tarde" :
    "Boa noite";
  if (!storeName) return "Bem-vindo ao Vendeo";
  return `${period}, ${storeName}`;
}
```

### Recent Campaigns Layout (no thumbnails)
```
┌──────────────────────────────────────────────────┐
│ Campanhas Recentes                                │
│                                                  │
│ Tênis Runner Pro          02/07     ✅  [Abrir]  │
│ Café Gourmet              01/07     ✅  [Abrir]  │
│ Sofá 3 Lugares            30/06     ❌  [Abrir]  │
│                                                  │
│ Ver todas as campanhas →                         │
└──────────────────────────────────────────────────┘
```
</specifics>

<deferred>
## Deferred Ideas

- Thumbnails nas campanhas recentes (signed URLs) — pós-v1.4
- Gráficos, charts, barras de progresso — fora da v1.4
- Data range picker — F21
- Exportação de dados — fora da v1.4
- Busca, filtros, paginação — F21
- Mobile hardening (focus trap, prefers-reduced-motion) — F22
- i18n, billing, múltiplas lojas (1:N)
- `listCampaigns()` com contrato evoluído — F21
</deferred>

---

*Phase: 20-dashboard*
*Context gathered: 2026-07-13 via OpenSpec synthesis*
