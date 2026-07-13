## Context

O Vendeo pós-F18 tem app shell funcional, 7 componentes base de UI, roteamento PT-BR, e 600 testes passando. O dashboard é placeholder genérico ("Em breve"). Usuário sem loja é barrado com redirect seco em páginas que poderiam mostrar orientação na UI. Não há onboarding. A milestone v1.4 (Experiência SaaS) definiu que "sem loja não é bloqueio" e deve virar guidance visual.

Dependências: F18 (app shell, EmptyState, PageHeader, roteamento), F7–F11 (auth, sessão, ownership), F12–F17 (campanhas, listagem, loja).

## Goals / Non-Goals

**Goals:**
- Helper `getUserOnboardingState(userId)` centralizado com 3 estados: `no_store | has_store_no_campaigns | has_store_with_campaigns`
- `countCampaigns(storeId)` com `SELECT COUNT(*)` + `head:true`, sem signed URLs
- Microcopy de todos os estados vazios centralizada em `src/lib/onboarding/microcopy.ts`, tipada via `EmptyStateCopy`
- Dashboard como server component async com switch de 3 estados, reutilizando `<PageHeader>` + `<EmptyState>` (F18)
- `/campanhas` sem loja: empty state contextual com CTA → `/loja` (não redireciona)
- `/campanhas/[id]` sem loja: `notFound()` (não redireciona para `/loja`)
- `/campanhas/nova` sem loja: redirect mantido (inalterado)
- Microcopy referenciada no empty state existente de "sem campanhas" em `/campanhas`
- 15+ testes (helper, dashboard 3 estados, campanhas, detail, nova)

**Non-Goals:**
- Dashboard com métricas (F20)
- Campanhas recentes no dashboard (F20)
- Card de próximo passo adaptativo (F20)
- Busca, filtros, paginação em `/campanhas` (F21)
- Alterações no fluxo de criação/edição de loja (`/loja`) (D9)
- Redirect pós-save da loja para dashboard (D9)
- Detecção de "primeiro login" por `created_at` ou `user_metadata` (D10)
- i18n / internacionalização
- Billing / planos / múltiplas lojas (1:N)
- Componentes novos de UI (EmptyState e PageHeader de F18 atendem todos os casos)

## Decisions

### D1 — `getUserOnboardingState`: helper centralizado de 3 estados

`CONFIRMADO` — alinhado com docs/alinhamento-fase-19.

```typescript
// src/lib/onboarding/types.ts
export type OnboardingState =
  | "no_store"
  | "has_store_no_campaigns"
  | "has_store_with_campaigns";

export interface EmptyStateCopy {
  icon: LucideIcon;
  title: string;
  description: string;
  ctaLabel?: string;
  ctaHref?: string;
}
```

```typescript
// src/lib/onboarding/state.ts
import "server-only";
export async function getUserOnboardingState(userId: string): Promise<OnboardingState> {
  const store = await getCurrentStore(userId);
  if (!store) return "no_store";
  const total = await countCampaigns(store.id);
  if (total === 0) return "has_store_no_campaigns";
  return "has_store_with_campaigns";
}
```

**Motivos:**
- Centraliza detecção — se no futuro mudar a definição de "tem campanha" ou "sem loja", muda só aqui
- Retorna enum tipado — páginas fazem `switch` com exaustividade garantida
- O terceiro estado (`has_store_with_campaigns`) prepara F20 sem refatoração

### D2 — `countCampaigns(storeId)`: `SELECT COUNT(*)` sem signed URLs

`CONFIRMADO`

```typescript
import "server-only";
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
```

**Motivos:**
- `SELECT COUNT(*)` é a operação mais barata — sem JOIN, sem signed URLs, sem carregar linhas
- `head: true` evita transferência de dados das linhas
- Usado como boolean em F19, mas retorno numérico prepara F20

### D3 — Dashboard server component com 3 estados

`CONFIRMADO`

```
DashboardPage (server component, async)
  ├── const user = await requirePageUser()
  ├── const state = await getUserOnboardingState(user.userId)
  ├── switch (state):
  │   ├── "no_store"              → <PageHeader /> + <EmptyState> "Configure sua loja" CTA → /loja
  │   ├── "has_store_no_campaigns" → <PageHeader /> + <EmptyState> "Crie sua primeira campanha" CTA → /campanhas/nova
  │   └── "has_store_with_campaigns" → <PageHeader /> + <EmptyState> placeholder neutro (sem CTA)
```

**Estados:**

| Estado | EmptyState | Ícone | Título | Descrição | CTA |
|--------|------------|-------|--------|-----------|-----|
| `no_store` | `<NoStoreEmptyState />` | `Store` | Configure sua loja | Para começar a criar campanhas, primeiro precisamos conhecer sua loja. | "Configurar loja" → `/loja` |
| `has_store_no_campaigns` | `<NoCampaignsEmptyState />` | `Megaphone` | Crie sua primeira campanha | Sua loja está pronta! Agora é hora de criar sua primeira campanha profissional. | "Criar campanha" → `/campanhas/nova` |
| `has_store_with_campaigns` | `<DashboardPlaceholder />` | `LayoutDashboard` | Seu dashboard está sendo preparado | Em breve você verá aqui suas métricas e campanhas recentes. | (sem CTA — F20 substitui) |

**Microcopy:** Toda string em `src/lib/onboarding/microcopy.ts`. `EmptyState` (F18) reutilizado — nenhum componente novo de UI.

### D4 — `/campanhas` sem loja: empty state em vez de redirect

`CONFIRMADO`

```typescript
const store = await getCurrentStore(user.userId);
if (!store) {
  return <CampaignsNoStoreEmptyState />;  // usa microcopy.CAMPAIGNS_NO_STORE
}
```

**Motivo:** `/campanhas` já precisa do `store.id` para chamar `listCampaigns` — não faz sentido passar pelo helper `getUserOnboardingState` que faria `countCampaigns` extra.

### D5 — `/campanhas/nova`: redirect mantido

`CONFIRMADO` — página funcionalmente depende de loja para operar.

### D6 — `/campanhas/[id]` sem loja: `notFound()`

`CONFIRMADO`

```typescript
const store = await getCurrentStore(user.userId);
if (!store) { notFound(); }
```

**Motivo:** Página de detalhe de recurso específico. Sem loja, não é possível verificar ownership. 404 é honesto — usuário sem loja não chega a essa URL por navegação natural.

### D7 — Microcopy centralizada

`CONFIRMADO` — `src/lib/onboarding/microcopy.ts` com constantes `DASHBOARD_NO_STORE`, `DASHBOARD_NO_CAMPAIGNS`, `DASHBOARD_PLACEHOLDER`, `CAMPAIGNS_NO_STORE`, `CAMPAIGNS_NO_CAMPAIGNS`.

**Motivo:** Textos visíveis para revisão sem abrir páginas. Facilita ajustes. Tipado.

### D8 — Estrutura de diretórios

`CONFIRMADO`

```
src/lib/onboarding/
├── types.ts          → OnboardingState, EmptyStateCopy
├── state.ts          → getUserOnboardingState(userId)  [server-only]
├── count.ts          → countCampaigns(storeId)           [server-only]
└── microcopy.ts      → constantes de empty state
```

### D9 — Fluxo da loja NÃO alterado

`CONFIRMADO` — F19 guia o usuário até `/loja` via CTAs, não modifica comportamento pós-save.

### D10 — "Primeiro acesso" definido pelo estado real do produto

`CONFIRMADO` — onboarding determinístico baseado em `no_store | has_store_no_campaigns | has_store_with_campaigns`. Sem heurísticas de `created_at` ou `user_metadata`.

### D11 — Três planos de execução

`CONFIRMADO`

```
19-01 ──► 19-02 ──► 19-03
(helper)   (dashboard)   (campanhas)
```

| Plano | O quê | Arquivos |
|-------|-------|----------|
| **19-01** | Fundação do onboarding helper | `src/lib/onboarding/types.ts`, `state.ts`, `count.ts`, `microcopy.ts` + testes unitários |
| **19-02** | Dashboard inteligente | `src/app/(app)/dashboard/page.tsx` (server component async, 3 estados) + testes |
| **19-03** | Campanhas + detalhe sem loja | `src/app/(app)/campanhas/page.tsx`, `[id]/page.tsx`, `nova/page.tsx` (verificar), `client.tsx` (revisar microcopy) + testes |

## Risks / Trade-offs

| Risco | Mitigação |
|-------|-----------|
| `getUserOnboardingState` faz 2 queries no dashboard | Queries leves: `maybeSingle` em `stores` (índice `user_id`) + `SELECT COUNT(*)` com `head:true`. Nenhuma outra página usa o helper |
| Empty state "Configure sua loja" em `/campanhas` conflita com usuário que já tem loja | Invariante v1.4: relação 1:1 user→store. Sem loja, não há campanhas |
| F19 cresce para incluir "melhorias no fluxo de loja" | Escopo explícito: D9 proíbe |
| `notFound()` em `[id]` para `no_store` é menos amigável que empty state | 404 em página de recurso específico é semanticamente correto. Usuário sem loja não chega por navegação natural |
| `countCampaigns` em `onboarding/` gera confusão | Decisão consciente: nasce como helper de onboarding. Se F20 precisar expandir, move para `campaign/` |
| Microcopy hardcoded em português dificulta i18n futuro | Fora de escopo. Quando precisar, strings estão centralizadas em arquivo único |
