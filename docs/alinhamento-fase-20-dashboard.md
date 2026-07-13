# Alinhamento Fase 20 — Dashboard (v1.4)

## Contexto

```
v1.4 — Experiência SaaS (milestone)
  ├── Phase 18 — App Shell + UI Base + Rotas                               ✓ concluída
  ├── Phase 19 — Onboarding leve + Estados vazios fundacionais             ✓ concluída
  ├── Phase 20 — Dashboard                                                 ← esta fase
  ├── Phase 21 — Histórico & Busca
  └── Phase 22 — Mobile hardening + validação
```

A Fase 18 entregou app shell funcional com sidebar + topbar + drawer mobile, 7 componentes base de UI, roteamento PT-BR (`/dashboard`, `/campanhas`, `/campanhas/nova`, `/campanhas/[id]`, `/loja`, `/conta`), redirects 301, middleware atualizado, 600 testes passando.

A Fase 19 entregou o helper centralizado de onboarding (`getUserOnboardingState` com 3 estados), dashboard inteligente com estados vazios contextuais para `no_store` e `has_store_no_campaigns`, substituição de redirect por orientação visual em `/campanhas` e por `notFound()` em `/campanhas/[id]`, microcopy centralizada, e `countCampaigns(storeId)` com `SELECT COUNT(*)` — 628 testes passando.

**Problema:** O dashboard para `has_store_with_campaigns` ainda mostra um placeholder vazio ("Seu dashboard está sendo preparado"). Usuários com loja configurada e campanhas geradas não têm visão consolidada do seu progresso — total de campanhas, campanhas prontas, taxa de sucesso, ou acesso rápido às campanhas recentes.

**Dependências:** F18 (app shell, componentes base, rotas), F19 (`getUserOnboardingState`, `countCampaigns`, `EmptyState`, microcopy), F7–F11 (auth, sessão, ownership), F12–F17 (campanhas, listagem, loja).

---

## Propósito

1. **Criar helpers agregados de métricas** em `src/lib/campaign/metrics.ts`: `countCampaigns`, `countReadyCampaigns`, `getCampaignSuccessRate`, `getRecentCampaigns`
2. **Manter compatibilidade com F19** via reexport de `countCampaigns` em `src/lib/onboarding/count.ts`
3. **Substituir o placeholder do dashboard** por conteúdo real para o estado `has_store_with_campaigns`: saudação, métricas, campanhas recentes, próximo passo adaptativo
4. **Preservar intactos** os estados `no_store` e `has_store_no_campaigns` da F19
5. **Construir sem thumbnails** nas campanhas recentes — apenas nome, data, status e link
6. **Saudação com hora do servidor** ("Bom dia", "Boa tarde", "Boa noite") + nome da loja
7. **15-20 testes** (helpers, renderização, saudação, responsividade, estados)

**Entrega verificável:**
- Usuário com loja e campanhas vê no dashboard: saudação com nome da loja, 3 cards de métricas (total, prontas, taxa de sucesso), lista de campanhas recentes (3-5), card de próximo passo adaptativo, link "Configurar loja"
- Usuário sem loja continua vendo empty state "Configure sua loja" + CTA → `/loja` (F19, inalterado)
- Usuário com loja e sem campanhas continua vendo empty state "Crie sua primeira campanha" + CTA → `/campanhas/nova` (F19, inalterado)
- `countCampaigns(storeId)` funciona via reexport de `src/lib/campaign/metrics.ts` — nenhuma quebra em F19
- Layout responsivo: grid 3-col em desktop, 1-col em mobile
- `npm run typecheck`, `npm run lint`, `npm run build`, `npx vitest run` — zero erros

---

## Estado Atual (pós-F19)

```
                                        ANTES (F19)                        DEPOIS (F20)
═══════════════════════════════════════════════════════════════════════════════════════════

Dashboard — has_store_with_campaigns:
  Conteúdo                        placeholder "Seu dashboard está        dashboard real com:
                                    sendo preparado"                       saudação + métricas +
                                                                           recentes + next step

Dashboard — no_store:
  Conteúdo                        empty state "Configure sua loja"        MANTIDO (inalterado)
                                  CTA → /loja

Dashboard — has_store_no_campaigns:
  Conteúdo                        empty state "Crie sua primeira          MANTIDO (inalterado)
                                  campanha" CTA → /campanhas/nova

Métricas:
  countCampaigns(storeId)         existe em src/lib/onboarding/count.ts   promovido para
                                                                          src/lib/campaign/metrics.ts
                                                                          com reexport
  countReadyCampaigns(storeId)    inexistente                              criado
  getCampaignSuccessRate(storeId) inexistente                              criado
  getRecentCampaigns(storeId,     inexistente                              criado
    limit)

Microcopy:
  DASHBOARD_PLACEHOLDER           "Seu dashboard está sendo preparado"    DEIXA DE SER USADO
                                  "Em breve você verá aqui..."             (dashboard real substitui o
                                                                           placeholder; manter constante
                                                                           em microcopy.ts se houver valor
                                                                           de compatibilidade/testes)

Saudação:
  Com nome da loja                inexistente                              "Bom dia, Loja XYZ"
                                                                           ou "Bem-vindo ao Vendeo"
                                                                           (primeiro acesso)

Campanhas Recentes:
  3-5 itens no dashboard          inexistente                              lista com nome + data +
                                                                           status + link "Abrir"
  Thumbnails                      N/A (não existia)                       SEM thumbnails (decisão:
                                                                           F20 sem signed URLs extras)

Próximo Passo Adaptativo:
  Card contextual                 inexistente                              "Revise sua última
                                                                           campanha" ou
                                                                           "Criar nova campanha"

"Ver todas as campanhas →"        inexistente                              link → /campanhas

"Configurar loja" (discreto)      inexistente                              link → /loja

Helpers agregados:
  Localização                     onboarding/count.ts                      campaign/metrics.ts
  countCampaigns                  onboarding/count.ts                      campaign/metrics.ts +
                                                                           onboarding/count.ts
                                                                           reexporta
  countReadyCampaigns             inexistente                              campaign/metrics.ts
  getCampaignSuccessRate          inexistente                              campaign/metrics.ts
  getRecentCampaigns              inexistente                              campaign/metrics.ts

Testes                           628 existentes                           15-20 novos
```

---

## Decisões de Arquitetura

### D1 — Helpers agregados em `src/lib/campaign/metrics.ts`

`CONFIRMADO`

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

export async function getCampaignSuccessRate(
  storeId: string,
): Promise<number> {
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
- `src/lib/campaign/` é o domínio correto para métricas de campanha — não faz sentido ficar em `onboarding/`
- Evita duplicação de query: `countCampaigns` existe uma vez só
- F19 não quebra: o reexport mantém compatibilidade total
- `getCampaignSuccessRate` usa `Promise.all` para rodar as duas queries em paralelo
- `getRecentCampaigns` retorna tipo próprio leve (`RecentCampaignItem`) — sem storage_path, sem signed URLs
- O filtro `ready`/`error` é o mesmo da F19 — `generating` é ignorado na taxa de sucesso

---

### D2 — Reexport de `countCampaigns` em `src/lib/onboarding/count.ts`

`CONFIRMADO`

```typescript
// src/lib/onboarding/count.ts
import "server-only";

export { countCampaigns } from "@/lib/campaign/metrics";
```

**Motivo:** A F19 importa `countCampaigns` de `@/lib/onboarding/count` em `state.ts`. Mudar o import quebraria a F19 sem necessidade. O reexport mantém a API pública exatamente igual — `getUserOnboardingState` continua funcionando sem alterações.

**Nenhum outro arquivo de `onboarding/` é alterado.** `types.ts`, `state.ts` e `microcopy.ts` ficam exatamente como estão.

---

### D3 — Dashboard sem thumbnails nas campanhas recentes

`CONFIRMADO`

**O que NÃO fazer em F20:**
- `getRecentCampaigns` não retorna `storagePath` — não é possível gerar signed URLs mesmo que se quisesse
- `CampaignListItem` (de `list.ts`, que tem `thumbnailUrl`) não é usado — tipo próprio leve `RecentCampaignItem`
- Nenhuma chamada a `supabaseAdmin.storage.createSignedUrl` no dashboard

**Motivos:**
- `listCampaigns()` gera signed URLs via `generateBatchThumbnailUrls` que faz N chamadas ao Storage (1 por item)
- Adicionar signed URLs no dashboard = 3-5 chamadas extras ao Storage por carregamento de página
- O dashboard deve ser rápido e informativo — thumbnails são valor visual, não informacional
- A lista de `/campanhas` já tem thumbnails — o dashboard é um resumo, não um catálogo
- Thumbnails podem ser adicionadas em F21 ou em refinamento visual posterior sem quebrar nada

**Layout das recentes sem thumbnail:**
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

---

### D4 — Taxa de sucesso: `ready / (ready + error)`, ignorando `generating`

`CONFIRMADO`

```typescript
// Internamente:
// countCampaigns conta ready + error
// countReadyCampaigns conta ready
// successRate = countReady / (countReady + countError)
//            = countReady / countCampaigns
//            = ready / (ready + error)
```

**Motivos:**
- `generating` é estado transitório — não deve ser contado como sucesso nem como falha
- O mesmo filtro da F19 (`status IN ('ready', 'error')`) é mantido por consistência
- Taxa 0% quando `total === 0` (tratamento explícito no helper)
- Taxa 100% quando todas as campanhas estão `ready`
- Arredondado (`Math.round`) para número inteiro — sem decimais no dashboard

---

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

**Motivos:**
- Hora do servidor é determinística e testável (mock de `Date`)
- Aceitável para F20 — o fuso pode não ser o do lojista, mas é um problema aceitável e simples de resolver
- "Bem-vindo ao Vendeo" para primeiro acesso (quando `storeName` ainda não foi carregado — cobre o caso de `no_store` indo para o dashboard, mas esse estado tem empty state da F19)
- Na prática, para `has_store_with_campaigns`, `storeName` sempre existe — a saudação sempre terá o nome da loja

**Fluxo de dados do dashboard real:**

```
DashboardPage (server component, async)
  ├── const user = await requirePageUser()
  ├── const state = await getUserOnboardingState(user.userId)
  │
  ├── switch (state):
  │   ├── "no_store"                → <PageHeader /> + <EmptyState> (F19)
  │   ├── "has_store_no_campaigns"  → <PageHeader /> + <EmptyState> (F19)
  │   └── "has_store_with_campaigns" → <DashboardContent />
  │
  └── DashboardContent:
      ├── const store = await getCurrentStore(user.userId)  ← obtém store.name p/ saudação
      ├── const [total, ready, recentCampaigns] = await Promise.all([
      │     countCampaigns(store.id),
      │     countReadyCampaigns(store.id),
      │     getRecentCampaigns(store.id, 5),
      │   ])
      ├── const rate = total > 0 ? Math.round((ready / total) * 100) : 0
      │
      ├── <PageHeader title="Dashboard" />
      ├── <Greeting storeName={store.name} />            ← "Bom dia, Loja XYZ"
      ├── <MetricsGrid total={total} ready={ready} rate={rate} />
      ├── <RecentCampaigns campaigns={recentCampaigns} />
      ├── <NextStepCard latest={recentCampaigns[0]} />   ← reusa lista carregada
      └── <Link href="/loja">Configurar loja</Link>
```

**Nota sobre o fluxo:** A F19 propositalmente não expõe a loja no retorno de `getUserOnboardingState`. O dashboard real precisa de `store.id` para queries e `store.name` para saudação. Por isso o branch `has_store_with_campaigns` chama `getCurrentStore` antes de buscar métricas. Isso não é query extra: sem loja confirmada pelo onboarding state, as queries não seriam executadas.

---

### D6 — Card de próximo passo adaptativo

`CONFIRMADO`

O card de próximo passo aparece apenas no estado `has_store_with_campaigns`. Ele se adapta:

| Condição | Card | CTA |
|----------|------|-----|
| Tem campanhas | "Revise sua última campanha" com nome da mais recente | [Abrir campanha] → `/campanhas/[últimoId]` |
| Tem campanhas (alternativa) | "Criar nova campanha" | [Criar campanha] → `/campanhas/nova` |

**Implementação:**
- Reutilizar `recentCampaigns[0]` da lista já carregada — nenhuma query extra
- Se `recentCampaigns.length > 0` → "Revise sua última campanha: {{productName}}" com CTA → `/campanhas/[últimoId]`
- Opção secundária "Criar nova campanha" com CTA → `/campanhas/nova` (sempre visível no mesmo card)
- Se `recentCampaigns` vier vazio por inconsistência/race condition → fallback "Criar nova campanha"
- O card não substitui o CTA "Nova Campanha" da topbar — é um atalho contextual

**Nota:** O card não tem título fixo "Próximo passo" — pode ser um card visual com ícone + chamada + CTA. A milestone sugere:

```
┌────────────────────────────────────────────┐
│ 🎯 Revise sua última campanha              │
│ "Tênis Runner Pro"                         │
│ ┌──────────┐  ┌──────────┐                 │
│ │  Abrir   │  │  Nova    │                 │
│ └──────────┘  └──────────┘                 │
└────────────────────────────────────────────┘
```

---

### D7 — Layout responsivo: grid 3-col → 1-col

`CONFIRMADO`

```html
<!-- Métricas: 3 cards lado a lado em desktop, empilhados em mobile -->
<div class="grid grid-cols-1 md:grid-cols-3 gap-4">
  <MetricCard ... />
  <MetricCard ... />
  <MetricCard ... />
</div>

<!-- Campanhas Recentes: largura total em ambos -->
<div class="mt-6">
  <!-- lista -->
</div>

<!-- Próximo passo: largura total -->
<div class="mt-6">
  <!-- card adaptativo -->
</div>
```

**Breakpoints:**
- Mobile: `< 768px` — 1 coluna
- Desktop: `>= 768px` — 3 colunas (métricas)
- Consistente com o breakpoint do App Shell (F18)

---

### D8 — Três planos de execução

`CONFIRMADO`

| Plano | O quê | Arquivos |
|-------|-------|----------|
| **20-01** | Métricas e recentes | `src/lib/campaign/metrics.ts` (criar: countCampaigns, countReadyCampaigns, getCampaignSuccessRate, getRecentCampaigns, RecentCampaignItem) + `src/lib/onboarding/count.ts` (reescrever como reexport) + testes unitários |
| **20-02** | Dashboard completo | `src/app/(app)/dashboard/page.tsx` (substituir placeholder `has_store_with_campaigns` por dashboard real com saudação, métricas, recentes, next-step, links. Manter estados F19 inalterados) + microcopy (deixar de referenciar DASHBOARD_PLACEHOLDER; remover a constante apenas se zero referências remanescentes) |
| **20-03** | Testes e acabamento responsivo | Testes: helpers (count, ready count, success rate 0/100/normal, empty store, recentes vazia/com dados), dashboard (renderização real, saudação por horário com mock Date, métricas com valores, link "Ver todas", next-step com/sem campanhas, responsividade por classes esperadas) |

```
20-01 ──► 20-02 ──► 20-03
(helpers) (dashboard) (testes + responsivo)
```

**Testes distribuídos:**
- 20-01: 6-8 testes (count, readyCount, successRate 0%/50%/100%/empty, recentCampaigns vazia/com dados)
- 20-02: 6-8 testes (dashboard real renderiza saudação, métricas, recentes, next-step, links; estados F19 preservados)
- 20-03: 4-6 testes (saudação por horário, responsividade, taxa no limite, lista vazia defensiva)

---

## Estrutura de Código

```
src/
├── lib/
│   ├── campaign/
│   │   ├── metrics.ts                          ← NOVO: countCampaigns, countReadyCampaigns,
│   │   │                                          getCampaignSuccessRate, getRecentCampaigns,
│   │   │                                          RecentCampaignItem
│   │   ├── list.ts                             ← mantido (inalterado, F21 evolui)
│   │   ├── types.ts                            ← mantido (inalterado)
│   │   └── ...                                 ← mantido (inalterado)
│   │
│   ├── onboarding/
│   │   ├── count.ts                            ← MODIFICADO: reexport de campaign/metrics
│   │   ├── state.ts                            ← mantido (inalterado)
│   │   ├── types.ts                            ← mantido (inalterado)
│   │   └── microcopy.ts                        ← MODIFICADO (leve): DASHBOARD_PLACEHOLDER
│   │                                              deixa de ser referenciado pelo dashboard.
│   │                                              Manter a constante se houver valor de
│   │                                              compatibilidade/testes; remover só se
│   │                                              zero referências
│   └── auth/
│       └── store-ownership.ts                  ← mantido (inalterado)
│
├── app/(app)/
│   ├── dashboard/
│   │   └── page.tsx                            ← MODIFICADO: branch has_store_with_campaigns
│   │                                              recebe conteúdo real. Branches no_store e
│   │                                              has_store_no_campaigns inalterados (F19)
│   ├── campanhas/                              ← mantido (inalterado, F21 evolui)
│   └── layout.tsx                              ← mantido (inalterado)
│
├── components/
│   ├── ui/
│   │   ├── card.tsx                            ← mantido (reutilizado)
│   │   ├── badge.tsx                           ← mantido (reutilizado)
│   │   ├── empty-state.tsx                     ← mantido (reutilizado — F19)
│   │   ├── page-header.tsx                     ← mantido (reutilizado)
│   │   └── ...                                 ← mantido
│   └── shell/                                  ← mantido (inalterado)
│
└── middleware.ts                               ← mantido (inalterado)
```

**Nenhum componente novo de UI é criado.** `Card`, `Badge`, `PageHeader`, `EmptyState`, `Button` (F18) atendem todos os casos.

---

## Testes

### `lib/campaign/metrics.test.ts` (6-8 testes)

| Teste | O que valida |
|-------|-------------|
| `countCampaigns` retorna total (ready + error) | Query correta, soma ambos os status |
| `countCampaigns` retorna 0 quando não há campanhas | Store sem campanhas |
| `countReadyCampaigns` retorna apenas ready | Filtro por status='ready' |
| `getCampaignSuccessRate` retorna 0% quando total = 0 | Zero division safe |
| `getCampaignSuccessRate` retorna 100% quando todos ready | ready = total |
| `getCampaignSuccessRate` retorna 50% quando metade ready | ready / total arredondado |
| `getRecentCampaigns` retorna N itens ordenados por data | Limit funciona, ordenação descendente |
| `getRecentCampaigns` retorna array vazio quando sem campanhas | Store sem campanhas |

### `app/dashboard/page.test.tsx` (6-8 testes)

| Teste | O que valida |
|-------|-------------|
| Estado `no_store` → empty state "Configure sua loja" (F19 preservado) | Comportamento F19 intacto |
| Estado `has_store_no_campaigns` → empty state "Crie sua primeira campanha" (F19 preservado) | Comportamento F19 intacto |
| Estado `has_store_with_campaigns` → saudação "Bom dia, Loja Teste" | Greeting com nome da loja |
| Estado `has_store_with_campaigns` → saudação "Boa tarde, Loja Teste" (mock Date 14h) | Saudação varia com horário |
| Estado `has_store_with_campaigns` → saudação "Boa noite, Loja Teste" (mock Date 21h) | Saudação varia com horário |
| Estado `has_store_with_campaigns` → 3 cards de métricas visíveis | Total, prontas, taxa |
| Estado `has_store_with_campaigns` → lista de campanhas recentes com link "Ver todas" | Recentes renderizadas, link → /campanhas |
| Estado `has_store_with_campaigns` → card de próximo passo com CTA para última campanha | Next-step adaptativo com link |

### Testes de responsividade (1-2 testes)

| Teste | O que valida |
|-------|-------------|
| Grid de métricas tem classes `grid-cols-1 md:grid-cols-3` | Classes estruturais de grid responsivo |
| Cards têm `gap-4` consistente | Espaçamento entre cards |

**Nota:** Testes de viewport real (breakpoint simulator, redimensionamento) são escopo de F22 (mobile hardening). Em F20, validamos apenas a presença das classes responsivas no markup.

### Testes de microcopy (1 teste, opcional)

| Teste | O que valida |
|-------|-------------|
| Texto "Seu dashboard está sendo preparado" não aparece no dashboard para `has_store_with_campaigns` | Garante que o placeholder antigo não vazou para o conteúdo real |

**Nota sobre `DASHBOARD_PLACEHOLDER`:** A constante pode permanecer em `microcopy.ts` sem quebrar o build — não há necessidade de removê-la. O importante é que o dashboard pare de referenciá-la. Se houver valor de compatibilidade/testes, manter.

---

## Riscos

| Risco | Mitigação |
|-------|-----------|
| `countCampaigns` existir em dois lugares (onboarding + campaign) | D2 explícita: onboarding vira reexport. Um único `countCampaigns` real em `campaign/metrics.ts` |
| Saudação com hora do servidor ignora fuso do lojista | Aceitável para F20 — o dashboard não é timezone-critical. Pode usar `Intl.DateTimeFormat` com fuso detectado via `accept-language` ou configurado em `/conta` em fase futura |
| Dashboard com 3 queries (count, countReady, recentes) impacta performance | São queries leves com índices (`store_id`), `head: true` nas COUNT, `limit 5` nas recentes. `Promise.all` paraleliza as queries independentes |
| F20 cresce para incluir gráficos, analytics ou thumbnails | Seção Fora do Escopo abaixo é explícita. Nada de gráficos, charts, data range picker, exportação |
| Card de próximo passo conflita com o CTA "Nova Campanha" da topbar | O card é contextual e adaptativo — complementa, não substitui. A topbar mantém "Nova Campanha" persistente |
| `DASHBOARD_PLACEHOLDER` é usado em algum lugar não mapeado | Remover a constante de `microcopy.ts` quebrará o build se houver referência — o typecheck detecta. Remover apenas se `microcopy.ts` não for importado em outro lugar (é importado só pelo dashboard page, que para de usar o placeholder) |

---

## Fora do Escopo

| Item | Motivo |
|------|--------|
| Thumbnails nas campanhas recentes (signed URLs) | D3: F20 sem thumbnails. Adiciona latência e complexidade sem valor informacional essencial |
| Gráficos, charts, barras de progresso | Dashboard de geração, não de analytics |
| Data range picker | F21 (histórico) |
| Exportação de dados | Fora da v1.4 |
| Busca, filtros, paginação | F21 (histórico) |
| Mobile hardening (focus trap, prefers-reduced-motion) | F22 |
| Alterações no fluxo de criação/edição de loja (`/loja`) | Inalterado |
| Campos novos em `campaigns` table | Nenhuma migration necessária — só SELECT |
| Componentes novos de UI | Card + Badge + PageHeader + EmptyState (F18) atendem todos os casos |
| i18n | Fora da v1.4 |
| Billing / planos | Fora da v1.4 |
| Múltiplas lojas (1:N) | Fora da v1.4 |
| `listCampaigns()` com contrato de query evoluído | F21 |
| Alterações no middleware | Rotas não mudam |
| Alterações em API routes | Nenhuma |

---

## Checklist de Revisão

### Decisões de alinhamento
- [ ] D1 — Helpers agregados em `src/lib/campaign/metrics.ts`: `countCampaigns`, `countReadyCampaigns`, `getCampaignSuccessRate`, `getRecentCampaigns`, `RecentCampaignItem`
- [ ] D2 — `src/lib/onboarding/count.ts` vira reexport de `src/lib/campaign/metrics.ts` (compatibilidade F19 mantida)
- [ ] D3 — Dashboard sem thumbnails nas campanhas recentes (tipo próprio leve, sem storagePath, sem signed URLs)
- [ ] D4 — Taxa de sucesso = `ready / (ready + error)`, `generating` ignorado, 0% safe
- [ ] D5 — Saudação com hora do servidor + nome da loja ("Bom dia", "Boa tarde", "Boa noite")
- [ ] D6 — Card de próximo passo adaptativo: última campanha ou criar nova
- [ ] D7 — Layout responsivo: `grid-cols-1 md:grid-cols-3` para métricas
- [ ] D8 — Três planos de execução: 20-01 (helpers) | 20-02 (dashboard) | 20-03 (testes)

### Plano 20-01 — Métricas e recentes
- [ ] `src/lib/campaign/metrics.ts` com `countCampaigns(storeId)`
- [ ] `src/lib/campaign/metrics.ts` com `countReadyCampaigns(storeId)`
- [ ] `src/lib/campaign/metrics.ts` com `getCampaignSuccessRate(storeId)`
- [ ] `src/lib/campaign/metrics.ts` com `getRecentCampaigns(storeId, limit?)`
- [ ] `src/lib/campaign/metrics.ts` com `RecentCampaignItem` (id, productName, status, createdAt)
- [ ] `src/lib/onboarding/count.ts` modificado para reexportar `countCampaigns` de `campaign/metrics`
- [ ] `src/lib/onboarding/microcopy.ts`: `DASHBOARD_PLACEHOLDER` deixa de ser referenciado pelo dashboard. Manter a constante se houver valor de compatibilidade/testes; remover apenas se zero referências remanescentes
- [ ] Testes dos helpers (6-8 cenários)

### Plano 20-02 — Dashboard completo
- [ ] `src/app/(app)/dashboard/page.tsx`: branch `has_store_with_campaigns` com conteúdo real
- [ ] Branch `no_store` mantido inalterado (F19)
- [ ] Branch `has_store_no_campaigns` mantido inalterado (F19)
- [ ] Após confirmar `has_store_with_campaigns`, chamar `getCurrentStore(user.userId)` para obter `store.id` e `store.name` (necessário para saudação e queries de métricas)
- [ ] Saudação: "Bom dia, {{storeName}}" com hora do servidor
- [ ] 3 cards de métricas: total, prontas, taxa de sucesso (usando Card da F18)
- [ ] Seção "Campanhas Recentes": 3-5 itens com nome, data formatada (dd/mm), Badge de status, link "Abrir"
- [ ] Link "Ver todas as campanhas →" → `/campanhas`
- [ ] Card de próximo passo adaptativo: reutiliza `recentCampaigns[0]` para "Revise sua última campanha", com fallback "Criar nova campanha"
- [ ] Link discreto "Configurar loja" → `/loja`
- [ ] Layout responsivo: grid-cols-1 md:grid-cols-3
- [ ] Nenhum componente novo de UI (reutiliza Card, Badge, PageHeader)

### Plano 20-03 — Testes e acabamento responsivo
- [ ] Testes de helpers (migrate do 20-01 se separados)
- [ ] Teste: `no_store` preserva empty state F19
- [ ] Teste: `has_store_no_campaigns` preserva empty state F19
- [ ] Teste: `has_store_with_campaigns` renderiza saudação com nome
- [ ] Teste: saudação "Bom dia" (6h-12h) com mock Date
- [ ] Teste: saudação "Boa tarde" (12h-18h) com mock Date
- [ ] Teste: saudação "Boa noite" (18h-6h) com mock Date
- [ ] Teste: 3 cards de métricas com valores
- [ ] Teste: campanhas recentes com 3 itens + link "Ver todas"
- [ ] Teste: card de próximo passo com link para última campanha
- [ ] Teste: lista de recentes vazia não quebra
- [ ] Teste: taxa de sucesso 0%, 50%, 100%
- [ ] Teste: grid de métricas tem classes `grid-cols-1 md:grid-cols-3`
- [ ] Teste: card de próximo passo com `recentCampaigns[0]` (sem query extra)
- [ ] Teste: card de próximo passo fallback "Criar nova campanha" quando lista vazia (edge case)

### Verificação final
- [ ] Dashboard real visível para usuário com loja e campanhas
- [ ] Estados vazios da F19 preservados para `no_store` e `has_store_no_campaigns`
- [ ] `countCampaigns` importado de `@/lib/onboarding/count` ainda funciona (F19 compatível)
- [ ] Nenhuma signed URL gerada no dashboard
- [ ] `DASHBOARD_PLACEHOLDER` não é mais referenciado pelo dashboard (pode permanecer em `microcopy.ts` para compatibilidade, sem quebrar build)
- [ ] `npm run typecheck` — zero erros
- [ ] `npm run lint` — zero erros
- [ ] `npx vitest run` — todos os testes passando (15-20 novos + 628 existentes)
- [ ] `npm run build` — build bem-sucedido

---

*Documento criado: 2026-07-13*
*Baseado no alinhamento da milestone v1.4, estado atual do código (pós-F19), discussão exploratória com diagnóstico do escopo e contribuições do time de desenvolvimento.*
*Próximo passo: revisão do time, ajustes, então compor change proposal + plano GSD da Phase 20.*
