---
phase: 38.2-admin-custos-operacionais
plan: 08
subsystem: ui-admin
tags: [ai-operation-costs, admin-ui, react-testing-library, drilldown, d9, badges, tdd]

# Dependency graph
requires:
  - phase: 38.2-admin-custos-operacionais (plan 38-2-06)
    provides: "API GET /api/admin/ai-operation-runs (lista D4/D9 com summary/aggregations) e GET /[operationRunId] (detalhe call-level com BRL/componentes/badges) — contratos consumidos pela página e pelo drilldown"
  - phase: 38.2-admin-custos-operacionais (plan 38-2-05)
    provides: "OperationRunsService.listRuns/getRunDetail (server-only) — BRL D1/D4, badges D5, segmentação D9, summary + 8 agregados sobre o conjunto filtrado inteiro"
  - phase: 38.2-admin-custos-operacionais (plan 38-2-07)
    provides: "Padrão visual admin (cards bg-bg-surface, Badge, EmptyState, force-dynamic + requireAdmin)"
provides:
  - "Página /admin/ai-operation-costs 'Custos de Operação' (Server Component, force-dynamic, requireAdmin, leitura via OperationRunsService direto — padrão das páginas admin): estados dados/503 fail-closed/vazio, filtros dos searchParams (período/loja/tipo/status/provider/model/gen_type/run_id/segmento), KPIs do summary, tabela por entrega com badges D5, drilldown call-level D4 via fetch à API, agregados por segmento D9"
  - "Componentes: ai-operation-costs-filters (presets 7/30/90 dias + limite 365d, segmento econômico), kpis-grid (11 KPIs do summary — UI nunca recalcula), operation-runs-table (12 colunas + placeholder F38.3), run-detail-dialog (fetch sob demanda, componentes textComponentUsd/imageToolComponentUsd), cost-badge (5 badges + legend 'estimativas operacionais'), segment-aggregations (bloco D9 + 7 distribuições)"
  - "Link 'Custos de Operação' na nav admin (layout.tsx)"
  - "17 testes (5 page + 12 componentes) — tarefa 12.6 (piso 5) — + regressão completa 1832 testes/213 files"
affects: [38-2-10 verificacao (I1-I6 + UAT visual do painel), 38-2-11 runbook trackings, F38.3 (placeholder reconciliação provider)]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Página admin que consome o service server-only diretamente (padrão operation-costs/metrics) — somente o drilldown (client) usa fetch à API de detalhe sob requireAdmin"
    - "Testes de página admin via renderToString (node) com componentes client mockados para inspecionar os props repassados (runs/summary/aggregations/filters) + testes de componentes client via RTL/jsdom (badges, filtros com useRouter mockado, drilldown com fetch mockado)"
    - "Componentes client com props server-rendered (sem estado global de URL): filtros são form com router.push; tabela gerencia o dialog de drilldown via estado local"

key-files:
  created:
    - "src/app/(app)/admin/ai-operation-costs/page.tsx"
    - "src/app/(app)/admin/ai-operation-costs/ai-operation-costs-filters.tsx"
    - "src/app/(app)/admin/ai-operation-costs/kpis-grid.tsx"
    - "src/app/(app)/admin/ai-operation-costs/operation-runs-table.tsx"
    - "src/app/(app)/admin/ai-operation-costs/run-detail-dialog.tsx"
    - "src/app/(app)/admin/ai-operation-costs/cost-badge.tsx"
    - "src/app/(app)/admin/ai-operation-costs/segment-aggregations.tsx"
    - "src/app/(app)/admin/ai-operation-costs/__tests__/page.test.tsx"
    - "src/app/(app)/admin/ai-operation-costs/__tests__/components.test.tsx"
  modified:
    - "src/app/(app)/admin/layout.tsx"

key-decisions:
  - "Página lê via OperationRunsService.listRuns direto (padrão do repo — operation-costs/metrics usam service server-only); o drilldown usa fetch à GET /api/admin/ai-operation-runs/[id] (client) — a página NUNCA calcula KPIs/agregados (summary/aggregations do service sobre o conjunto filtrado inteiro)"
  - "Filtros dos searchParams (camelCase, mesmo contrato do AiOperationRunsQuerySchema da API 38-2-06) repassados ao service; a UI de filtros é um form client que navega com router.push (/admin/ai-operation-costs?...)"
  - "Tabela gerencia o estado do drilldown internamente (linha clicável → RunDetailDialog com fetch sob demanda — mitigação T-38.2-38 DoS)"
  - "Placeholder F38.3 (D7) implementado como colunas fixas 'ainda indisponível'/'pendente' na tabela e blocos no cabeçalho do drilldown"

patterns-established:
  - "Pattern 1: Suite dupla de testes — page.test.tsx (node, renderToString, componentes mockados p/ assertar props) + components.test.tsx (jsdom, RTL, componentes reais com next/navigation e fetch mockados)"
  - "Pattern 2: Badge de confiança (D5) centralizado em cost-badge.tsx com legend fixa — reusado na tabela e no drilldown"

requirements-completed: [F38.2-13, F38.2-15]

# Metrics
duration: 11min
completed: 2026-08-11
---

# Phase 38.2 Plan 08: UI /admin/ai-operation-costs "Custos de Operação" Summary

**Painel admin "Custos de Operação" (D3/D9): Server Component force-dynamic + requireAdmin lendo o OperationRunsService direto (KPIs do summary, filtros por searchParams com presets de período 7/30/90, tabela por entrega com badges de confiança D5, drilldown call-level D4 com textComponentUsd/imageToolComponentUsd via fetch sob demanda, agregados por segmento econômico D9, placeholder F38.3) + link na nav admin — 17 testes verdes (tarefa 12.6, piso 5) e regressão completa 1832 testes/213 files.**

## Performance

- **Duration:** 11 min
- **Started:** 2026-08-11T17:29:42Z
- **Completed:** 2026-08-11T17:40:56Z
- **Tasks:** 4 (TDD — 3 commits: RED test + GREEN feat; suite de componentes)
- **Files modified:** 10 (page + 6 componentes + 2 suítes de teste + layout nav)

## Accomplishments

- **Página `/admin/ai-operation-costs` "Custos de Operação" (D3)** — `force-dynamic` + `requireAdmin` (try/catch → acesso negado); leitura via `new OperationRunsService().listRuns(filters)` **direto** (padrão das páginas admin — operation-costs/metrics usam service server-only, não fetch); filtros dos `searchParams` (período/loja/tipo/status/provider/model/gen_type/run_id/segmento — mesmo contrato camelCase da API 38-2-06); 503 fail-closed (`OperationRunsUnavailableError` → "Serviço indisponível no momento. Tente novamente em alguns instantes."); vazio (`runs.length === 0` → `EmptyState` "Aguardando dados de geração"); com dados → `<AiOperationCostsFilters> + <KpisGrid> + <OperationRunsTable> + <SegmentAggregations>`. **A página nunca recalcula KPIs/agregados** — summary/aggregations vêm do service sobre o conjunto filtrado inteiro (D3/D4).
- **Componentes (D3/D5/D9)** — `ai-operation-costs-filters.tsx` (form client com presets 7/30/90 dias + limite de janela 365d, loja, tipo, status, provider, model, gen_type, run_id, segmento econômico; submit → `router.push` com searchParams); `kpis-grid.tsx` (11 KPIs: custo USD/BRL, créditos, receita, resultado, margem %, tempo médio, P95, total, erros/sucessos); `operation-runs-table.tsx` (data, tipo, loja, status, custo USD/BRL, créditos, tempo, chamadas, regenerações, provider/model, badge D5 + colunas placeholder F38.3 "ainda indisponível"/"pendente"); `cost-badge.tsx` (5 badges com labels pt-BR + legend fixa "Estimativas operacionais — não custo financeiro reconciliado").
- **Drilldown call-level (D4)** — `run-detail-dialog.tsx`: client component com fetch sob demanda (clique na linha → `GET /api/admin/ai-operation-runs/[operationRunId]`), estados loading/erro/dados; tabela de eventos com etapa, provider/model, status, tokens, duração, custo USD/BRL, `textComponentUsd`/`imageToolComponentUsd` e badge por evento; placeholder F38.3 no cabeçalho do run ("Custo estimado Vendeo" / "Custo reconciliado provider: ainda indisponível" / "Diferença: pendente").
- **Agregados por segmento (D9)** — `segment-aggregations.tsx`: bloco priorizado por segmento (entregas, custo BRL, resultado operacional estimado, margem estimada %, taxa de erro) + distribuições por tipo de entrega, etapa, provider/model, status, loja (storeName), owner e hora (UTC) — consumidos de `aggregations` do service.
- **Link nav (D3)** — "Custos de Operação" → `/admin/ai-operation-costs` no `layout.tsx` (após "Configurações econômicas").
- **Testes (tarefa 12.6 — 5 testes)** — 17 verdes: 5 page (dados renderizam KPIs/tabela/agregados + título; 503 fail-closed; vazio; filtros repassados ao service com page numérica; filtros chegam ao AiOperationCostsFilters) + 12 componentes (badges D5 + legend; KPIs; tabela com placeholder F38.3 + drilldown; RunDetailDialog fetch + componentes de custo + 503; filtros presets/segmento + router.push; agregados D9).
- **Verificação** — typecheck limpo, lint limpo, suíte 17/17 verde, regressão completa **1832 testes / 213 files** (era 1804/209 no 38-2-06; +17 desta UI).

## Task Commits

Each task was committed atomically (TDD — RED `test(...)` + GREEN `feat(...)`):

1. **Task 1: Página — server component + estados (dados/503/vazio) + link nav (D3)** - `3642a32` (test, RED — 5 casos page) + `6f84468` (feat, GREEN — page.tsx + layout.tsx + 6 componentes para satisfazer os imports)
2. **Task 2: Filtros + KPIs + tabela com badges (D3/D5)** - `2d07f0f` (test — suite de componentes: badges/KPIs/tabela/filtros)
3. **Task 3: Drilldown call-level + agregados por segmento (D4/D9)** - `2d07f0f` (test — drilldown fetch + agregados D9; mesmo commit da suite de componentes)
4. **Task 4: Testes completos (tarefa 12.6 — 5 testes)** - `2d07f0f` (test — 17 testes verdes, regressão completa)

**Plan metadata:** (a ser commitado — docs 38-2-08)

## Files Created/Modified

- `src/app/(app)/admin/ai-operation-costs/page.tsx` - Server Component: force-dynamic + requireAdmin + listRuns(filters dos searchParams) + estados dados/503/vazio; repassa summary/aggregations (UI nunca recalcula)
- `src/app/(app)/admin/ai-operation-costs/ai-operation-costs-filters.tsx` - Filtros client: presets 7/30/90d, período, loja, tipo, status, provider, model, gen_type, run_id, segmento D9; router.push
- `src/app/(app)/admin/ai-operation-costs/kpis-grid.tsx` - 11 KPIs formatados pt-BR a partir do summary
- `src/app/(app)/admin/ai-operation-costs/operation-runs-table.tsx` - Tabela por entrega (12 colunas + F38.3) com linha clicável → drilldown
- `src/app/(app)/admin/ai-operation-costs/run-detail-dialog.tsx` - Drilldown call-level: fetch sob demanda à API de detalhe; componentes de custo + badge por evento
- `src/app/(app)/admin/ai-operation-costs/cost-badge.tsx` - Badge D5 (5 variações) + legend "estimativas operacionais"
- `src/app/(app)/admin/ai-operation-costs/segment-aggregations.tsx` - Agregados D9: bloco por segmento + 7 distribuições
- `src/app/(app)/admin/ai-operation-costs/__tests__/page.test.tsx` - 5 testes da página (node/renderToString)
- `src/app/(app)/admin/ai-operation-costs/__tests__/components.test.tsx` - 12 testes de componentes (jsdom/RTL)
- `src/app/(app)/admin/layout.tsx` - +link "Custos de Operação" na nav admin

## Decisions Made

- **Service direto na página, API só no drilldown**: a página segue o padrão do repo (operation-costs/metrics usam o service server-only); o drilldown é client e usa fetch à API de detalhe (único ponto que consome o endpoint 38-2-06). KPIs/agregados vêm do `summary`/`aggregations` do service — a UI nunca recalcula (D3/D4).
- **Filtros como form + router.push** (não links): atualiza os searchParams preservando o contrato camelCase da API; presets de período calculam o range no submit (janela ≤ 365d garantida pela API com 400 — a UI avisa o limite).
- **Tabela gerencia o dialog internamente** (estado local `selectedRunId`): drilldown sob demanda (clique), mitigando o T-38.2-38 (DoS por drilldown em massa).
- **Placeholder F38.3 (D7)** como colunas fixas na tabela + blocos no cabeçalho do dialog — a UI já está preparada para a reconciliação provider sem mudança de arquitetura.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Expectativas de teste ajustadas ao render real**
- **Found during:** Tasks 2-3 (suíte de componentes)
- **Issue:** Asserções assumiam formatos que o render real não produz: `toFixed(1)` gera "1.0s" (não "1,0s"); JSON em atributo data-* vira entidades HTML (`&quot;`); textos com prefixo em spans separados ("T US$ 0,04" quebrado em "T " + "US$ 0,04"); provider/model duplicado entre tabela e detalhe.
- **Fix:** Asserções corrigidas para o contrato real (texto completo do span, getAllByText para duplicatas, entidades no data-attribute, "1.0s").
- **Files modified:** src/app/(app)/admin/ai-operation-costs/__tests__/page.test.tsx, __tests__/components.test.tsx
- **Verification:** 17/17 testes verdes + regressão completa
- **Committed in:** 3642a32 (page.test.tsx) e 2d07f0f (components.test.tsx)

**2. [Rule 3 - Blocker] Componentes dos Tasks 2-3 criados no commit do Task 1**
- **Found during:** Task 1 (GREEN)
- **Issue:** a página `page.tsx` importa os 6 componentes (kpis-grid, operation-runs-table, run-detail-dialog, cost-badge, segment-aggregations, filters) — sem eles a página nem compila/typecheck. O plano divide a implementação em Tasks 2-3, mas a dependência de import é imediata.
- **Fix:** Componentes implementados integralmente no commit feat do Task 1 (6f84468) — a suíte de testes deles (que cobre as behaviors dos Tasks 2-3) foi commitada à parte (2d07f0f).
- **Files modified:** 6 componentes em src/app/(app)/admin/ai-operation-costs/
- **Verification:** typecheck/lint limpos; 17 testes verdes
- **Committed in:** 6f84468

---

**Total deviations:** 2 auto-fixed (1 bug de teste, 1 bloqueio de estrutura de commits)
**Impact on plan:** Nenhum desvio de escopo — todos os objetivos D3/D4/D5/D7/D9 entregues; a única divergência é de sequenciamento de commits (componentes no commit do Task 1 por dependência de import).

## Known Stubs

- **Nenhum stub funcional.** O placeholder F38.3 (D7) é intencional por desenho: colunas "Custo reconciliado provider: ainda indisponível" e "Diferença: pendente" na tabela e no drilldown — a reconciliação financeira real é F38.3 (fora de escopo, D7).
- **`byStage` → bucket "unknown" em produção** (gap pré-existente do contrato RPC, deferred-items.md #1 — 38-2-05): a UI trata "unknown" como "sem etapa identificada" (comportamento previsto na 38-2-05). Não é stub novo desta página.

## Issues Encountered

- **ESLint com caminhos contendo `(app)` e `[operationRunId]`**: diretórios com parênteses/colchetes são interpretados como globs pelo ESLint ao passar caminhos explícitos — contornado rodando `npm run lint` (raiz, `eslint .`), que respeita o config flat e passa limpo. Sem impacto.
- **renderToString + componentes client**: `page.test.tsx` (node) mocka os componentes client para inspecionar os props (runs/summary/aggregations/filters) — comportamento interativo (filtros/drilldown) testado em `components.test.tsx` (jsdom/RTL com useRouter/fetch mockados).
- **`requirements.mark-complete F38.2-13 F38.2-15`**: a seção F38.2 de REQUIREMENTS.md ainda é placeholder (mesma nota das fases 38-2-03/06/07 — índice F38.2 será cadastrado pelo plano 38-2-11). IDs copiados para `requirements-completed` do frontmatter.

## Authentication Gates

Nenhum — plano sem operações de rede/deploy (só código + testes locais).

## User Setup Required

None - no external service configuration required.

## Checkpoint Humano — Pendente (harvest end-of-phase)

`checkpoint:human-verify` do plano (gate blocking) — config `workflow.human_verify_mode = "end-of-phase"` (default #3309): o executor não pausa mid-flight; o verifier coleta este bloco para o HUMAN-UAT.md no fim da fase.

**What was built:** Página /admin/ai-operation-costs "Custos de Operação" completa (filtros com presets, KPIs, tabela por entrega com badges, drilldown call-level, agregados por segmento, placeholder F38.3) + link "Custos de Operação" na nav admin.

**How to verify (com servidor local rodando — `npm run dev`):**
1. Acessar /admin/ai-operation-costs — link "Custos de Operação" na nav admin; título "Custos de Operação"
2. Filtros: presets de período 7/30/90 dias; selecionar segmento econômico e ver KPIs/agregados reagirem (summary/aggregations do conjunto filtrado)
3. KPIs mostram custo USD/BRL, créditos, receita/resultado/margem BRL, tempo médio/P95, total de entregas, erros/sucessos
4. Tabela por entrega com data, tipo, loja, status, custo, créditos, tempo, chamadas, regenerações, provider/model, badge de confiança + legend "estimativas operacionais"
5. Clicar numa entrega → drilldown com etapas, tokens, duração, estimatedCostUsd/Brl, text/image components, badge por evento
6. Agregados por segmento (custo/resultado/margem/taxa de erro) e gerações por hora/owner/loja/tipo/status/segmento
7. Placeholder F38.3: "Custo reconciliado provider: ainda indisponível" / "Diferença: pendente"
8. Regressão: demais páginas admin navegáveis sem erro

**Resume signal:** "approved" se tudo passou, ou descreva os problemas.

## Next Phase Readiness

- **Base pronta para 38-2-10 (Testes + Verificação I1–I6 + gates):** o painel completo (filtros/KPIs/tabela/drilldown/badges/segmentos/placeholder F38.3) está implementado e testado — a verificação I1-I6 e o UAT visual podem exercitar a página de ponta a ponta; a página de métricas (38-2-09) não sofreu alteração.
- **Pronto para F38.3 (reconciliação provider):** a UI já exibe os placeholders "Custo reconciliado provider: ainda indisponível" / "Diferença: pendente" sem quebrar a arquitetura.
- **Pendência conhecida:** `byStage` → "unknown" em produção (deferred-items.md #1) — indicada para 38-2-10 (verificação) ou quick fix dedicado.
- **Nenhum bloqueador** — typecheck/lint limpos + 17 testes verdes + regressão completa 1832 testes/213 files.

---
*Phase: 38.2-admin-custos-operacionais*
*Completed: 2026-08-11*

## Self-Check: PASSED
- Arquivos: 11/11 FOUND (page + 6 componentes + 2 suítes + layout + SUMMARY)
- Commits: 3/3 presentes no git log (3642a32, 6f84468, 2d07f0f)
- Verificação: typecheck limpo; lint limpo; 17 testes da página/componentes verdes; regressão completa 1832 testes / 213 files verdes
