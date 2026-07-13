## Context

O Vendeo pós-F19 tem dashboard com 3 estados via `getUserOnboardingState`, microcopy centralizada, `countCampaigns` em `src/lib/onboarding/count.ts`, e 628 testes passando. O estado `has_store_with_campaigns` ainda mostra placeholder genérico ("Seu dashboard está sendo preparado"). Usuários com loja e campanhas não têm métricas, campanhas recentes, ou próximo passo no dashboard.

Dependências: F18 (app shell, Card, Badge, PageHeader, EmptyState, roteamento), F19 (`getUserOnboardingState`, `countCampaigns`, microcopy, estados vazios), F7–F11 (auth, sessão, ownership), F12–F17 (campanhas, listagem, loja).

## Goals / Non-Goals

**Goals:**
- Helpers agregados em `src/lib/campaign/metrics.ts`: `countCampaigns`, `countReadyCampaigns`, `getCampaignSuccessRate`, `getRecentCampaigns`, `RecentCampaignItem`
- `src/lib/onboarding/count.ts` vira reexport de `@/lib/campaign/metrics` — compatibilidade F19 mantida sem alterar `state.ts`
- Dashboard para `has_store_with_campaigns`: saudação + 3 métricas + recentes + próximo passo adaptativo + links
- Estados `no_store` e `has_store_no_campaigns` intactos (F19 preservado)
- Saudação com hora do servidor + nome da loja ("Bom dia", "Boa tarde", "Boa noite" → "Bem-vindo ao Vendeo")
- Campanhas recentes sem thumbnails (tipo próprio `RecentCampaignItem`, sem `storagePath`, sem signed URLs)
- Card de próximo passo adaptativo: última campanha ou "Criar nova campanha"
- Layout responsivo: `grid-cols-1 md:grid-cols-3` para métricas
- 15-20 novos testes

**Non-Goals:**
- Thumbnails nas campanhas recentes (signed URLs) — D3
- Gráficos, charts, barras de progresso — fora da v1.4
- Data range picker — F21
- Exportação de dados — fora da v1.4
- Busca, filtros, paginação — F21
- Mobile hardening (focus trap, prefers-reduced-motion) — F22
- Alterações no fluxo de criação/edição de loja (`/loja`)
- Campos novos na tabela campaigns
- Componentes novos de UI (Card + Badge + PageHeader + EmptyState da F18 atendem)
- i18n, billing, múltiplas lojas (1:N)
- `listCampaigns()` com contrato evoluído — F21
- Alterações em middleware, API routes, ou next.config

## Decisions

### D1 — Helpers agregados em `src/lib/campaign/metrics.ts`

`CONFIRMADO` — alinhado com `docs/alinhamento-fase-20-dashboard.md`.

```typescript
// src/lib/campaign/metrics.ts
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

**Motivos:**
- `src/lib/campaign/` é o domínio correto para métricas de campanha
- Evita duplicação de query: `countCampaigns` existe uma vez só
- `getCampaignSuccessRate` usa `Promise.all` para paralelizar queries
- `getRecentCampaigns` retorna tipo próprio leve — sem `storagePath`, sem signed URLs
- Filtro `ready`/`error` consistente com F19

### D2 — Reexport de `countCampaigns` em `src/lib/onboarding/count.ts`

`CONFIRMADO`

```typescript
// src/lib/onboarding/count.ts
import "server-only";
export { countCampaigns } from "@/lib/campaign/metrics";
```

**Motivo:** F19 importa `countCampaigns` de `@/lib/onboarding/count`. Mudar o import quebraria F19. O reexport mantém a API pública exatamente igual.

### D3 — Dashboard sem thumbnails nas campanhas recentes

`CONFIRMADO`

- `getRecentCampaigns` não retorna `storagePath` — tipo próprio `RecentCampaignItem` (id, productName, status, createdAt)
- Nenhuma chamada a `supabaseAdmin.storage.createSignedUrl` no dashboard
- `CampaignListItem` (de `list.ts`, que tem `thumbnailUrl`) não é usado no dashboard

**Layout:**
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

### D4 — Taxa de sucesso: `ready / (ready + error)`, ignorando `generating`

`CONFIRMADO`

- `countCampaigns` conta `ready + error` (status IN 'ready', 'error')
- `countReadyCampaigns` conta apenas `ready`
- `successRate = countReady / countCampaigns` = `ready / (ready + error)`
- `generating` é estado transitório — ignorado na taxa
- `Math.round` para número inteiro — sem decimais
- Retorna 0 quando `total === 0`

### D5 — Saudação com hora do servidor + nome da loja

`CONFIRMADO`

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

**Motivo:** Hora do servidor é determinística e testável (mock de `Date`). Aceitável para F20 — fuso pode não ser do lojista, mas problema simples e não crítico.

### D6 — Card de próximo passo adaptativo

`CONFIRMADO`

| Condição | Card | CTA |
|----------|------|-----|
| Tem campanhas | "Revise sua última campanha" com nome da mais recente | [Abrir campanha] → `/campanhas/[últimoId]` |
| Lista vazia (edge case) | "Criar nova campanha" | [Criar campanha] → `/campanhas/nova` |

- Reutiliza `recentCampaigns[0]` da lista já carregada — nenhuma query extra
- Opção secundária "Criar nova campanha" sempre visível no mesmo card
- Card não substitui CTA "Nova Campanha" da topbar — é atalho contextual

### D7 — Layout responsivo: `grid-cols-1 md:grid-cols-3`

`CONFIRMADO`

```html
<div class="grid grid-cols-1 md:grid-cols-3 gap-4">
  <MetricCard ... />
  <MetricCard ... />
  <MetricCard ... />
</div>
```

**Breakpoints:** Mobile < 768px = 1 coluna; Desktop >= 768px = 3 colunas. Consistente com App Shell (F18).

### D8 — Fluxo de dados do dashboard real

`CONFIRMADO`

```
DashboardPage (server component, async)
  ├── const user = await requirePageUser()
  ├── const state = await getUserOnboardingState(user.userId)
  │
  ├── switch (state):
  │   ├── "no_store"                → <PageHeader /> + <EmptyState> (F19, inalterado)
  │   ├── "has_store_no_campaigns"  → <PageHeader /> + <EmptyState> (F19, inalterado)
  │   └── "has_store_with_campaigns" → <DashboardContent />
  │
  └── DashboardContent:
      ├── const store = await getCurrentStore(user.userId)
      ├── const [total, ready, recentCampaigns] = await Promise.all([
      │     countCampaigns(store.id),
      │     countReadyCampaigns(store.id),
      │     getRecentCampaigns(store.id, 5),
      │   ])
      ├── const rate = total > 0 ? Math.round((ready / total) * 100) : 0
      │
      ├── <PageHeader title="Dashboard" />
      ├── <Greeting storeName={store.name} />
      ├── <MetricsGrid total={total} ready={ready} rate={rate} />
      ├── <RecentCampaigns campaigns={recentCampaigns} />
      ├── <NextStepCard latest={recentCampaigns[0]} />
      └── <Link href="/loja">Configurar loja</Link>
```

**Nota:** DashboardContent chama `getCurrentStore` apenas quando `has_store_with_campaigns`. Isso não é query extra: sem loja confirmada pelo onboarding state, as queries de métricas não seriam executadas.

### D9 — Três planos de execução

`CONFIRMADO`

| Plano | O quê | Arquivos |
|-------|-------|----------|
| **20-01** | Métricas e recentes | `src/lib/campaign/metrics.ts` (criar) + `src/lib/onboarding/count.ts` (reescrever como reexport) + testes unitários (6-8) |
| **20-02** | Dashboard completo | `src/app/(app)/dashboard/page.tsx` (substituir placeholder `has_store_with_campaigns`; manter estados F19 inalterados) |
| **20-03** | Testes e acabamento responsivo | Testes de renderização (8-10), saudação com mock Date, responsividade, validação de preservação F19 |

## Risks / Trade-offs

| Risco | Mitigação |
|-------|-----------|
| `countCampaigns` existir em dois lugares (onboarding + campaign) | D2 explícita: onboarding vira reexport. Um único `countCampaigns` real |
| Saudação com hora do servidor ignora fuso do lojista | Aceitável para F20 — dashboard não é timezone-critical. Pode usar `Intl.DateTimeFormat` com fuso em fase futura |
| Dashboard com 3 queries (count, countReady, recentes) impacta performance | Queries leves com índice `store_id`, `head: true` nas COUNT, `limit 5` nas recentes. `Promise.all` paraleliza |
| F20 cresce para incluir gráficos, analytics ou thumbnails | Non-Goals explícito |
| Card de próximo passo conflita com CTA "Nova Campanha" da topbar | Card é contextual e adaptativo — complementa, não substitui |
| `DASHBOARD_PLACEHOLDER` é usado em algum lugar não mapeado | Manter a constante em `microcopy.ts` — se não houver referência, não quebra build. Remover só se zero referências |
