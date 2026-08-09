---
phase: 38-1-ai-cost-accounting
plan: 07
subsystem: ai-cost, api, database
tags: [AiCostTracker, resolveAiCost, operation_run_id, campaign_delivery, recordCall, generation_events, D1, D5, D6, D7, D11]

requires:
  - phase: 38-1-02
    provides: AiCostTracker (startRun/record) + AiCostEvent/AiCallInfo/CostResolution
  - phase: 38-1-04
    provides: resolveAiCost (4 fontes, nunca-null — D9)
  - phase: 38-1-05
    provides: onCall no CopyDirectorService (usage real) + onMetricsEvent com usage/durationMs/attempt no ImageGenerationService
provides:
  - Rota POST /api/campaign/generate-image instrumentada: startRun("campaign_delivery") + recordCall (canal único) substituindo os 4 inserts inline
  - campaigns.operation_run_id persistido na criação da campanha (D1/D2 — preparo reuso F37)
  - Eventos call-level com custo REAL por chamada (furo 1), delivery campaign_pipeline SEMPRE sem custo/tokens + duration_is_pipeline (D1/D6), totalCost = soma real (furo 2), duration_ms por chamada (furo 7), attempt real (furo 6)
  - 11 testes de pipeline (6.3) verdes — 44/44 na suíte da rota
affects: [38-1-08 (rota VS), 38-1-10 (views/RPCs de apuração — somam só call-level), F37 (reuso cross-request do operation_run_id)]

tech-stack:
  added: []
  patterns:
    - "recordCall: helper local best-effort na rota — call-level via resolveAiCost + tokens + durationMs; delivery SEM cost/tokens (flag de pipeline adicionada pelo tracker)"
    - "Mapeamento onMetricsEvent → generation_type (input_validation/image_generation/quality_review); done/prompt_assembly ignorados (D5 — não inventar chamada)"
    - "operationRunId propagado por closure do recordCall (T-38.1-33 sanado — um startRun por pipeline)"

key-files:
  created: []
  modified:
    - src/app/api/campaign/generate-image/route.ts
    - src/lib/campaign/persistence.ts
    - src/lib/campaign/types.ts
    - src/app/api/campaign/generate-image/__tests__/route.test.ts
    - src/lib/visual-signature/__tests__/brand-profiler.test.ts (fix Rule 3)

key-decisions:
  - "recordCall fire-and-forget (void) no caminho de resultado — telemetria nunca bloqueia geração (T-38.1-29, D7)"
  - "campaign_input_validation vem do onMetricsEvent do ImageGenerationService (fase input_validation, attempt 0) — a validação pré-stream da rota (guard de conflito/409) não emite evento pois não cria campanha"
  - "Teste 1 (unit persistence) do plano não tinha arquivo de teste existente — comportamento coberto pelos testes de rota 17/18 (createCampaign com operationRunId) + typecheck"
  - "duration_is_pipeline adicionada pelo helper recordCall (não pela chamada delivery) — tracker também a adiciona para delivery (idempotente)"

patterns-established:
  - "Rota com helper recordCall: resolveAiCost (await, dentro do try best-effort) → AiCostTracker().record com todas as colunas novas (D2)"
  - "Delivery marker gravado via mesmo canal recordCall com generationType campaign_pipeline — nunca inline"

requirements-completed: [F38.1-20, F38.1-21, F38.1-22, F38.1-23, F38.1-24, F38.1-30]

duration: 11min
completed: 2026-08-09
---

# Phase 38.1 Plan 07: Instrumentação do pipeline generate-image (rotas 6.3) — Summary

**Pipeline POST /api/campaign/generate-image com contabilidade de custo definitiva: startRun("campaign_delivery"), recordCall (canal único via AiCostTracker) substituindo os 4 inserts inline, custo REAL por chamada via resolveAiCost, delivery campaign_pipeline SEMPRE sem custo com duration_is_pipeline, totalCost = soma real, campaigns.operation_run_id persistido, e 11 testes de pipeline verdes**

## Performance

- **Duration:** 11 min
- **Started:** 2026-08-08T23:57:45Z
- **Completed:** 2026-08-09T00:08:44Z
- **Tasks:** 3
- **Files modified:** 5

## Accomplishments

- **Run context (D1/D7):** `new AiCostTracker().startRun("campaign_delivery")` no início do request gera `operationRunId` (agrupador econômico) + `traceId` (rastreio técnico) distintos; `operationRunId` propagado por closure a todos os eventos (recomposição mesmo run — T-38.1-33) e **persistido em `campaigns.operation_run_id`** na criação da campanha (D1/D2 — prepara reuso cross-request pela F37)
- **Canal único (D7/T-38.1-30):** os 4 inserts inline de `generation_events` (copy 595-607, image 616-632, pipeline delivery 644-660, pipeline failed 717+) foram **removidos** (0 restantes na rota) e substituídos pelo helper local `recordCall` → `AiCostTracker.record` com todas as colunas novas (operation_run_id, operation_run_type, cost_source, pricing_version, cached/image tokens)
- **Custo real por chamada (furo 1, D5/D11):** `campaign_copy` via `onCall` do CopyDirectorService com usage real do `TextProviderResult`; `campaign_input_validation` + `campaign_image` + `campaign_image_review` via `onMetricsEvent` do ImageGenerationService (fases mapeadas; done/prompt_assembly ignorados); cada evento com `estimated_cost_usd` computado de `resolveAiCost`, `attempt_number` real (furo 6) e `duration_ms` da chamada (furo 7)
- **Delivery anti-dupla-contagem (D1/D6/T-38.1-31):** `campaign_pipeline` sucesso e falha gravados **sem cost e sem tokens**; tracker adiciona `metadata.duration_is_pipeline: true`
- **Furo 2 sanado (T-38.1-32):** `metadata.totalCost` do `logPipelineEvent` (pipeline_complete) = **soma real acumulada** dos `estimatedCostUsd` call-level (`callCostSum`), nunca mais `generationMetadata.provider`
- **admin_get_metrics preservado (6.3 test 19):** `logPipelineEvent` intacto — todos os eventos operacionais (copy_generation, image_generation, pipeline_complete) seguem usando o `traceId` do run
- **11 testes de pipeline (6.3):** mock de `@/lib/ai-cost` (AiCostTracker capturando eventos + resolveAiCost computando custo do usage) — 44/44 na suíte da rota; suíte completa do repo 1672/1672

## Task Commits

1. **Task 1: Run context + createCampaign com operation_run_id** - `50e92c9` (feat)
2. **Task 2: Substituição dos inserts por recordCall — custo real + delivery NULL + totalCost real** - `ed0c281` (feat)
3. **Task 3: Testes de pipeline (6.3 — 11 testes)** - `f4af9b5` (test)

## Files Created/Modified

- `src/app/api/campaign/generate-image/route.ts` - `startRun("campaign_delivery")` no início; helper `recordCall` (best-effort, delivery sem custo); onCall no copy (primary + fallback Gemini); onMetricsEvent mapeado p/ `campaign_input_validation`/`campaign_image`/`campaign_image_review`; delivery sucesso/falha via tracker; `metadata.totalCost` = `callCostSum`; imports de `estimateAiCost` removidos
- `src/lib/campaign/persistence.ts` - `createCampaign` grava `operation_run_id: input.operationRunId ?? null` no insert
- `src/lib/campaign/types.ts` - `CreateCampaignInput.operationRunId?: string`
- `src/app/api/campaign/generate-image/__tests__/route.test.ts` - mock `@/lib/ai-cost` (captura de eventos + custo computado do usage); describe "Pipeline cost accounting (6.3)" com 11 testes; beforeEach ampliado
- `src/lib/visual-signature/__tests__/brand-profiler.test.ts` - fix Rule 3: `afterEach` adicionado ao import do vitest (regressão 38-1-06 que bloqueava `npm run typecheck`)

## Decisions Made

- **recordCall fire-and-forget:** as invocações nos callbacks usam `void recordCall(...)` — telemetria é best-effort e nunca bloqueia o caminho de resultado (T-38.1-29 → F38.1-20); a ordem de resolução é garantida porque o pipeline aguarda `Promise.all` + upload/update antes do `logPipelineEvent` com `totalCost`
- **campaign_input_validation da fase do serviço:** o evento `campaign_input_validation` (attempt 0) vem do `onMetricsEvent` com fase `input_validation` do `ImageGenerationService` (D11) — a validação pré-stream da rota (guards 409/conflict) não emite evento pois não chega a criar campanha
- **`duration_is_pipeline` centralizada no helper:** o `recordCall` adiciona a flag no metadata para delivery; a chamada de delivery não repassa metadata — o tracker a adiciona de novo (idempotente), mantendo o grep de controle em 1 ocorrência na rota
- **Custo do delivery nunca é derivado:** removida a lógica `pipelineCost > 0 ? pipelineCost : null` — o delivery marker não soma nada (views somam só call-level — D10)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] `afterEach` não importado em brand-profiler.test.ts (regressão 38-1-06)**
- **Found during:** Task 1 (verificação `npm run typecheck`)
- **Issue:** `brand-profiler.test.ts` (commit 25563e2, plano 06) usa `afterEach` na linha 329 sem importá-lo do `vitest` — `tsc` falhava com `TS2304: Cannot find name 'afterEach'`, bloqueando o gate de typecheck obrigatório do plano.
- **Fix:** adicionado `afterEach` ao import existente do `vitest` (mudança mínima de 1 token).
- **Files modified:** src/lib/visual-signature/__tests__/brand-profiler.test.ts
- **Verification:** `npm run typecheck` limpo; suíte `brand-profiler.test.ts` 10/10 verde.
- **Committed in:** `50e92c9` (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking, regressão do plano 06)
**Impact on plan:** Sem impacto funcional — o fix desbloqueia o gate de typecheck; nenhum comportamento do plano 06 foi alterado.

## Issues Encountered

- **Teste 1 (unit persistence) do plano:** a ação dizia "Se houver teste de persistence existente, estender" — não existe arquivo de teste para `src/lib/campaign/persistence.ts` no repo; o comportamento `campaigns.operation_run_id` ficou coberto pelos testes de rota (Testes 17/18: `createCampaign` chamado com `operationRunId` do run) + typecheck compile-time.
- **Greps do plano vs comentários:** os greps de controle (`duration_is_pipeline == 1`, `startRun == 1`) contam também comentários — os comentários da rota foram redigidos para não conterem as strings de controle.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- **38-1-08 (rotas VS):** `generate-without-logo` pode seguir o mesmo padrão — `startRun("visual_signature")` + `recordCall`/tracker direto com `visual_signature_id`, custo e tokens (furo 5)
- **38-1-10 (views/RPCs):** a apuração (`admin_ai_*`, `admin_cost_vs_credits`) soma **apenas call-level** — o delivery `campaign_pipeline` agora nasce com custo/tokens NULL garantido por código (não só por view), reforçando a anti-dupla-contagem (D1/D6/D10)
- **F37:** `campaigns.operation_run_id` preenchido na criação — coluna pronta para a mecânica de reabertura cross-request do mesmo run
- **Regressão total:** 1672/1672 testes, typecheck/lint/build limpos

---
*Phase: 38-1-ai-cost-accounting*
*Completed: 2026-08-09*
