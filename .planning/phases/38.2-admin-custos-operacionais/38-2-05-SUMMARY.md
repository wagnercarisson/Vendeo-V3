---
phase: 38.2-admin-custos-operacionais
plan: 05
subsystem: core-library
tags: [operation-runs, service-layer, typescript, server-only, supabase, economic-parameters, badges, segmentation, vitest, tdd]

# Dependency graph
requires:
  - phase: 38.2-admin-custos-operacionais (plan 38-2-01)
    provides: "RPCs admin_get_ai_operation_runs/_events no remoto (evidências brutas de segmento D9 + insumos de badge D5 + summary/P95/paginação)"
  - phase: 38.2-admin-custos-operacionais (plan 38-2-02)
    provides: "EconomicParameterService.getParameter (usd_brl_rate/credit_value_brl — fail-open 1.00 / fail-closed 503)"
  - phase: 38.2-admin-custos-operacionais (plan 38-2-03)
    provides: "AiCostTracker persiste cost_formula_version/cost_estimation_note/text_component_usd/image_tool_component_usd (D5) — insumos dos badges por evento"
provides:
  - "OperationRunsService (src/lib/ai-cost/operation-runs-service.ts) server-only: listRuns com paginação progressiva + filtro de segmento no service; BRL/receita/resultado/margem (D1/D4); badges por evento e por entrega (D5); segmentação classifySegment (D9); storeName/owner (D3); summary + 8 agregados sobre o conjunto filtrado inteiro"
  - "getRunDetail: wire do RPC admin_get_ai_operation_run_events + estimatedCostBrl/badges/componentes por evento (D4)"
  - "20 testes (src/lib/ai-cost/__tests__/operation-runs-service.test.ts): BRL 1-4, badges 5-8, segmento 9-14, agregados 15-17, detalhe 18-20"
affects: [38-2-06 ai-operation-runs-api, 38-2-08 ui ai-operation-costs, 38-2-09 admin-metrics-correcao, 38-2-10 verificacao]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Service server-only com client + economic injetáveis (padrão OperationCostService F38 / AiCostAdminService); testes com vi.mock supabase/server + fake do economic injetado (não mocka o service econômico real)"
    - "TDD por task: commits RED (test) e GREEN (feat) separados — 12 commits para 6 tasks"
    - "Paginação progressiva no service (loop p_page 1..n, page_size 100) até acumular summary.total do RPC — summary/aggregations sempre sobre o conjunto filtrado inteiro, nunca a página"
    - "Derivações centralizadas no service: BRL (D1/D4), badges (D5), segmento (D9) — SQL/RPC nunca derivam; toNumber normaliza NUMERIC string|number"
    - "Fail-closed para RPC/parâmetros econômicos (OperationRunsUnavailableError → 503); fail-open apenas para storeName/owner (dado de apresentação)"

key-files:
  created:
    - "src/lib/ai-cost/operation-runs-service.ts"
    - "src/lib/ai-cost/__tests__/operation-runs-service.test.ts"
    - ".planning/phases/38.2-admin-custos-operacionais/deferred-items.md"
  modified: []

key-decisions:
  - "Paginação progressiva aplicada SEMPRE (não só com filtro de segmento): o RPC retorna apenas a página, mas summary/aggregations (D3/D4) exigem o conjunto filtrado inteiro — o service acumula o conjunto base (page_size 100) e re-pagina no final"
  - "byStage agrupa sob 'unknown' quando o RPC não expõe generation_type por run (gap de contrato do 38-2-01) — lido como campo opcional quando presente; registro em deferred-items.md para 38-2-06/38-2-10"
  - "admin_grant (D9): shape confirmado do RPC ({ grant_count: N } com N > 0); shape divergente → unknown — nunca inferir errado (T-38.2-20)"
  - "Summary/P95 recomputados no service (helper percentile) sobre o conjunto inteiro — consistência com agregados; o summary do RPC serve como total da paginação"
  - "byHour usa hora UTC de created_at (determinística entre ambientes — Vercel/dev local)"
  - "storeName/owner fail-open (log + null → bucket 'unknown'): dado de apresentação; o RPC já falha-closed se stores estiver indisponível (is_test_store via JOIN)"

patterns-established:
  - "Pattern 1: funções puras exportadas (deriveEventBadge/deriveRunBadge/classifySegment) testadas diretamente + métodos públicos (listRuns/getRunDetail) testados via mock de RPC — contrato D4/D5/D9 verificado nas duas camadas"
  - "Pattern 2: lista mock de runs por paginação (slice por p_page/p_page_size) para exercitar a paginação progressiva real do service"
  - "Pattern 3: fake do economic ({ getParameter: vi.fn() } com resolvers por chave) injetado no constructor — teste 4 cobre o fail-closed via mockRejectedValue"

requirements-completed: [F38.2-12, F38.2-14]

# Metrics
duration: 13min
completed: 2026-08-10
---

# Phase 38.2 Plan 05: OperationRunsService — Custos de Operação Summary

**OperationRunsService server-only que chama os RPCs admin_get_ai_operation_runs/_events e deriva no service layer: BRL (custoBrl/receitaOpBrl/resultadoOpBrl/margemOpPct via EconomicParameterService — D1/D4), badges de confiança por evento e por entrega (D5), segmentação econômica classifySegment com filtro + re-paginação (D9), storeName/owner (D3), summary + 8 agregados sobre o conjunto filtrado inteiro, e detalhe call-level com BRL/badges/componentes por evento (D4) — 20 testes verdes**

## Performance

- **Duration:** 13 min
- **Started:** 2026-08-10T21:39:13Z
- **Completed:** 2026-08-10T21:51:51Z
- **Tasks:** 6 (TDD — 12 commits: RED test + GREEN feat por task)
- **Files modified:** 3 (2 arquivos de código/testes criados + deferred-items.md)

## Accomplishments

- **Derivação monetária BRL (D1/D4)** no service (nunca no SQL): `custoBrl = custoUsdTotal × usd_brl_rate`, `receitaOpBrl = creditosDebitados × credit_value_brl`, `resultadoOpBrl = receitaOpBrl − custoBrl`, `margemOpPct` (null quando receita ≤ 0 — sem divisão por zero), por run e no summary; parâmetros via `EconomicParameterService.getParameter` (fail-open 1.00 / fail-closed → `OperationRunsUnavailableError` → 503); NUMERIC normalizado via `toNumber`
- **Badges de confiança (D5)**: `deriveEventBadge` (mapa exato por evento — provider_reported / provisional image tool estimate / partial / estimated / not_available) e `deriveRunBadge` (prioridade das flags `has_*` do RPC, fallback mapa sobre cost_sources/notes); `CostBadge` exportado
- **Segmentação econômica (D9)**: `classifySegment` best-effort (test / freemium/promotional / paid / manual/admin / unknown) com confidence high/low; admin_grant apenas com shape confirmado `{ grant_count > 0 }` (divergente → unknown, nunca inferir errado — T-38.2-20); filtro de segmento + re-paginação NO SERVICE (total reflete o conjunto segmento-filtrado)
- **Paginação progressiva**: loop `p_page 1..n, page_size 100` até acumular `summary.total` do RPC (janela ≤ 365d garantida pelo RPC) — summary e aggregations derivados sobre o **conjunto filtrado inteiro**, nunca a página (a UI não recalcula KPIs — D3)
- **Aggregations (D3/D9)**: 8 chaves (`bySegment` com custo/resultado/margem %/taxa de erro, `byDeliveryType`, `byStage`, `byProviderModel`, `byStatus`, `byStore` com storeName, `byOwner` via `stores.user_id` — dono da loja, `byHour` UTC)
- **getRunDetail (D4)**: wire do RPC `admin_get_ai_operation_run_events`; `estimatedCostBrl = estimatedCostUsd × usd_brl_rate` por evento, `textComponentUsd`/`imageToolComponentUsd` repassados, badge por evento; `run null + events []` para id inexistente; erro → fail-closed 503
- **storeName/owner** resolvidos no service (stores, lote `.in()` de 100)
- **Verificação**: typecheck limpo, lint limpo, 20 testes do service verdes, regressão completa 1785 testes / 206 files verdes

## Task Commits

Each task was committed atomically (TDD — RED `test(...)` + GREEN `feat(...)`):

1. **Task 1: Derivação monetária BRL (D1/D4)** - `a372b02` (test) + `e4a8a32` (feat)
2. **Task 2: Badges de confiança por evento e por entrega (D5)** - `6e08d60` (test) + `edb2669` (feat)
3. **Task 3: Segmentação econômica classifySegment (D9) + storeName/owner + filtro/re-paginação** - `ab4d0a9` (test) + `ad47284` (feat)
4. **Task 4: Aggregations — 8 chaves sobre o conjunto filtrado inteiro (D3/D9)** - `0123003` (test) + `661a3f7` (feat)
5. **Task 5: getRunDetail — RPC de eventos + BRL/badges/componentes por evento (D4)** - `0676b51` (test) + `09fa77e` (feat)
6. **Task 6: Testes completos (tarefa 12.5 + 12.4 parcial)** - `0b1a7b7` (test) + `b807912` (refactor — limpeza de casts/dead code)

**Plan metadata:** `6c60dd8` (docs: complete plan)

## Files Created/Modified

- `src/lib/ai-cost/operation-runs-service.ts` - `OperationRunsService` server-only (listRuns + getRunDetail), `OperationRunsUnavailableError`, tipos do contrato (OperationRun/OperationRunsSummary/OperationRunsAggregations/OperationRunEvent/OperationRunDetail), exports `deriveEventBadge`/`deriveRunBadge`/`classifySegment`/`CostBadge`/`Segment` (872 linhas)
- `src/lib/ai-cost/__tests__/operation-runs-service.test.ts` - 20 testes (mock RPC paginado + fake economic + leitura de stores)
- `.planning/phases/38.2-admin-custos-operacionais/deferred-items.md` - gap de contrato do byStage registrado para 38-2-06/38-2-10

## Decisions Made

- **Paginação progressiva SEMPRE** (não apenas com `segment`): o RPC devolve só a página; como summary/aggregations exigem o conjunto filtrado inteiro (D3/D4 — teste com 60 runs e page=2 reflete os 60), o service acumula o conjunto base e re-pagina no final. Sem isso, agregados ficariam limitados à página — violando o contrato.
- **byStage com bucket `"unknown"`** quando o RPC não expõe `generation_type` por run (campo lido como opcional quando presente). Gap de contrato pré-existente do 38-2-01 registrado em deferred-items.md — correção (migration aditiva + push) recomendada para 38-2-06 ou 38-2-10.
- **Summary/P95 recomputados no service** (helper `percentile` replicando `percentile_cont`) sobre o conjunto inteiro — garante consistência entre summary e aggregations; o summary do RPC permanece como fonte do `total` da paginação.
- **admin_grant exige shape confirmado** `{ grant_count > 0 }` (shape real do RPC 38-2-01, que agrega `admin_audit_log` com `grant_type='admin_grant'`); shape divergente → `unknown` (T-38.2-20: nunca inferir errado).
- **storeName/owner fail-open** (log + null → bucket "unknown"): dado de apresentação; o caminho monetário/segmento é fail-closed (RPC + parâmetros econômicos → 503).
- **byHour UTC** de `created_at` — determinístico entre ambientes (Vercel = UTC; dev local em São Paulo não desloca o agregado).
- **20 testes em vez de 19 do plano**: +1 teste extra cobrindo o filtro de segmento com re-paginação (cenário do spec "GET filtra por segmento com paginação consistente") — o requisito de "19 testes" é um piso, superado sem perda.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] RPC não expõe `generation_type` por run — byStage não computável em produção**
- **Found during:** Task 4 (deriveAggregations — byStage)
- **Issue:** O contrato do RPC `admin_get_ai_operation_runs` (38-2-01) expõe `cost_sources`/`cost_estimation_notes`/flags `has_*` por run, mas NÃO `generation_type` (a etapa). O agregado `byStage` (D3) não pode ser derivado do conjunto de runs em produção. Gap pré-existente do contrato (fora dos arquivos deste plano).
- **Fix:** `deriveAggregations` lê `generation_type` do run bruto como campo opcional (presente nos mocks de teste) e agrupa sob o bucket `"unknown"` quando ausente — o service nunca quebra e o contrato da API (8 chaves) é mantido. Registrado em `deferred-items.md` com recomendação de migration aditiva (expor `array_agg(DISTINCT ge.generation_type)` por run) para 38-2-06/38-2-10.
- **Files modified:** src/lib/ai-cost/operation-runs-service.ts, .planning/phases/38.2-admin-custos-operacionais/deferred-items.md (novo)
- **Verification:** Teste 15 passa com `generation_type` no mock (byStage.campaign_image = 10); typecheck limpo
- **Committed in:** 661a3f7 (Task 4 GREEN)

**2. [Rule 1 - Bug] Mock do cliente Supabase com `from()` assíncrono quebrava o encadeamento `.from().select()...`**
- **Found during:** Task 3 GREEN (resolveStores — TypeError: from(...).select is not a function)
- **Issue:** O mock de `from()` era `async`, mas o cliente Supabase real é síncrono e encadeável — o service faz `this.client.from("stores").select(...)` sem `await` no `from`.
- **Fix:** Mock de `from()` síncrono retornando `{ select }` (encadeável), com `mockIn` filtrando stores por ids.
- **Files modified:** src/lib/ai-cost/__tests__/operation-runs-service.test.ts
- **Verification:** 14 testes verdes após o fix (era 4 falhas de TypeError)
- **Committed in:** ad47284 (parte do Task 3 GREEN — correção do mock antes do commit)

---

**Total deviations:** 2 auto-fixed (1 bloqueio de contrato, 1 bug de mock)
**Impact on plan:** O fix 1 é uma adaptação de contrato pré-existente (sem alterar RPC/ledger — dentro do escopo do service); o fix 2 é infraestrutura de teste. Nenhum scope creep; todos os 6 objetivos do plano entregues.

## Known Stubs

- **`byStage` agrupado sob `"unknown"` em produção** (src/lib/ai-cost/operation-runs-service.ts — deriveAggregations): o RPC não expõe `generation_type` por run; enquanto o RPC não for estendido (ver deferred-items.md #1), o agregado por etapa retornará majoritariamente o bucket `"unknown"`. Não bloqueia o plano (as 8 chaves e o pipeline de derivação existem e são testados); a UI (38-2-08) deve tratar o bucket como "sem etapa identificada".

## Issues Encountered

- **PowerShell 5.1 e pipelines**: `npm ... 2>&1 | Select-Object` falha nativamente (`CantActivateDocumentInPipeline`) — contornado com `cmd /c "..."` (mesmo padrão do 38-2-02). Sem impacto.
- **`requirements.mark-complete F38.2-12 F38.2-14`**: a seção F38.2 de REQUIREMENTS.md ainda é placeholder (nota de 2026-08-10; o índice F38.2-01..22 é registrado pelo plano 38-2-11, tarefa 14.5). Os IDs foram copiados para `requirements-completed` do frontmatter (obrigatório pelo template); o check-off em REQUIREMENTS.md fica para quando a fase cadastrar os requisitos.

## Authentication Gates

Nenhum — plano sem operações de rede/deploy (só código + testes locais).

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- **Base pronta para 38-2-06 (API ai-operation-runs):** `OperationRunsService` entrega `{ runs, summary, aggregations, page, total }` e `{ run, events }` já derivados (BRL/badges/segmento/agregados) — a API só precisa de zod + `requireAdmin` + mapeamento de erros (`OperationRunsUnavailableError` → 503; janela > 365d → 400 na camada da API).
- **Pronto para 38-2-08 (UI):** summary alimenta os KPIs e aggregations os agregados — a página nunca calcula KPIs (D3). `segment` repassado como filtro; confidence low para paid/unknown exibe indicador de baixa confiança.
- **Pendência de contrato:** `generation_type` por run no RPC (byStage) — ver deferred-items.md. Recomendado tratar em 38-2-06 (contrato) ou 38-2-10 (verificação I1–I6).
- **Nenhum bloqueador** — service testado (20 testes) + regressão completa verde (1785 testes).

---
*Phase: 38.2-admin-custos-operacionais*
*Completed: 2026-08-10*

## Self-Check: PASSED
- Arquivos: service + teste + SUMMARY + deferred-items encontrados no disco (4/4 FOUND)
- Commits: 12/12 presentes no git log (a372b02, e4a8a32, 6e08d60, edb2669, ab4d0a9, ad47284, 0123003, 661a3f7, 0676b51, 09fa77e, 0b1a7b7, b807912)
- Verificação: typecheck limpo; lint limpo; 20 testes do service verdes; regressão completa 1785 testes / 206 files verdes
