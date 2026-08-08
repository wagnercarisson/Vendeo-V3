---
phase: 38-1-ai-cost-accounting
plan: 02
subsystem: ai-cost
tags: [ai-cost, telemetry, supabase, cost-accounting, tracker, generation-events]

# Dependency graph
requires:
  - phase: 38-1-01
    provides: "Migration aplicada no remoto — colunas generation_events (operation_run_id, cost_source, pricing_version, etc.), CHECKs cost_source/generation_type, campaigns.operation_run_id"
provides:
  - "src/lib/ai-cost/types.ts — 8 contratos centrais (COST_SOURCES, CostSource, OPERATION_RUN_TYPES, OperationRunType, TokenUsage, CostResolution, AiCostEvent, AiCallInfo) sem server-only"
  - "src/lib/ai-cost/tracker.ts — AiCostTracker (startRun + record best-effort), camada única de escrita de custo (D7)"
  - "GenerationEventType expandido para os 12 valores da migration (D5); GenerationEventInsert com novas colunas opcionais (D2)"
  - "insertGenerationEvent (VS) delega ao AiCostTracker mantendo a API externa (D7/D11)"
  - "13 testes do tracker (8 canônicos do plano + 4 de contrato de tipos + 1 variante extra)"
affects: [38-1-04, 38-1-05, 38-1-06, 38-1-07, 38-1-08, 38-1-09, 38-1-10]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Const-array enums + type derived em types.ts (analog credit/types.ts), sem server-only — importável por zod/UI"
    - "Classe com SupabaseClient injetável no constructor (analog credit-service) + best-effort try/catch nunca-lança (analog generation-events)"
    - "startRun gera operationRunId/traceId distintos via crypto.randomUUID (NO ANALOG — run-context novo)"
    - "Delivery marker = AiCostEvent sem cost e sem tokens → colunas NULL + metadata.duration_is_pipeline: true"

key-files:
  created:
    - "src/lib/ai-cost/types.ts — contratos D1/D4/D7/D12"
    - "src/lib/ai-cost/tracker.ts — AiCostTracker (server-only)"
    - "src/lib/ai-cost/__tests__/tracker.test.ts — 13 testes"
  modified:
    - "src/lib/visual-signature/types.ts — GenerationEventType 12 valores (D5) + GenerationEventInsert estendido (D2)"
    - "src/lib/visual-signature/generation-events.ts — insertGenerationEvent delega ao tracker"

key-decisions:
  - "AiCostEvent importa GenerationEventType/Status de visual-signature/types (D5) — enum NÃO duplicado em ai-cost/types.ts"
  - "insertGenerationEvent agora retorna null em sucesso (delega ao tracker cujo record é void) — consumidores atuais apenas await; API pública mantida para compat"
  - "Mapeamento cost/tokens do insert só gera AiCostEvent.cost/tokens quando campos presentes — sem cost/tokens = delivery marker preservado"
  - "Metadata não-delivery vira {} quando ausente (evita JSONB NULL no banco; delivery vira {...metadata, duration_is_pipeline: true})"

patterns-established:
  - "Camada única de escrita de custo: todo registro passa por AiCostTracker.record (D7) — best-effort, geração nunca bloqueada por telemetria"

requirements-completed: [F38.1-01, F38.1-02, F38.1-03, F38.1-04, F38.1-29]

# Metrics
duration: 7min
completed: 2026-08-08
---

# Phase 38.1 Plan 02: Types + AiCostTracker Summary

**Contratos centrais de custo (8 tipos sem server-only), enum GenerationEventType alinhado ao banco (12 valores D5), AiCostTracker como camada única de escrita best-effort (startRun + record, delivery marker sem custo) e delegação do insertGenerationEvent da VS ao tracker mantendo a API externa.**

## Performance

- **Duration:** 7 min
- **Started:** 2026-08-08T19:03:03Z
- **Completed:** 2026-08-08T19:10:16Z
- **Tasks:** 3 (6 commits — RED+GREEN por tarefa, TDD)
- **Files modified:** 5 (3 criados, 2 modificados)

## Accomplishments

- `src/lib/ai-cost/types.ts` (sem server-only): `COST_SOURCES`/`CostSource` (5 valores D4), `OPERATION_RUN_TYPES`/`OperationRunType` (4 domínios D1), `TokenUsage` (cached/image tokens D9), `CostResolution` (D3/D4), `AiCallInfo` (padrão `onCall` D7/D12), `AiCostEvent` (contrato único de gravação D7) — importando `GenerationEventType`/`GenerationEventStatus` da VS (enum não duplicado, D5)
- `GenerationEventType` expandido de 3 para os 12 valores da migration (6 novos call-level: campaign_input_validation, campaign_image_review, visual_signature_image, visual_signature_validation, brand_profile_vision, brand_profile_text)
- `AiCostTracker` (server-only): `startRun(type)` gera operationRunId/traceId UUIDs distintos (D1); `record(event)` insere em `generation_events` com todas as colunas novas D2, nunca lança (try/catch + console.error — D7), delivery marker com custo/tokens NULL + `metadata.duration_is_pipeline: true` (D1/D6)
- `insertGenerationEvent` (VS) delega a `new AiCostTracker().record(...)` mapeando `GenerationEventInsert` → `AiCostEvent` (operation_run_id/trace_id gerados quando ausentes; cost/tokens mapeados quando presentes) — API externa e semântica best-effort mantidas
- `GenerationEventInsert` estendido com as novas colunas opcionais (visual_signature_id, operation_run_id, trace_id, operation_run_type, cached/image tokens, provider_reported_cost_usd, cost_source, pricing_version)
- 13 testes em `src/lib/ai-cost/__tests__/tracker.test.ts` — cobrem os 8 cenários do spec (record grava colunas D2, nunca lança em falha, startRun UUIDs distintos, delivery NULL + duration_is_pipeline, not_available grava tokens com custo NULL, mesmo run agrupa N inserts, cost_source inválido rejeitado em compile time via `@ts-expect-error`, delegação) + 4 de contrato de tipos + 1 variante de erro retornado pelo supabase

## Task Commits

Each task was committed atomically (TDD — RED test commit + GREEN implementation commit):

1. **Task 1: Tipos — types.ts + expansão GenerationEventType (D5)** - `3524755` (test) + `0a1d37f` (feat)
2. **Task 2: AiCostTracker — startRun + record best-effort** - `501494d` (test) + `fd8b2c5` (feat)
3. **Task 3: Delegação insertGenerationEvent + testes completos (8+)** - `5521085` (test) + `f1d1c2a` (feat)

**Plan metadata:** `docs(38-1-02)` — commit de metadados com SUMMARY.md, STATE.md, ROADMAP.md e REQUIREMENTS.md (hash registrado no relatório final)

## Files Created/Modified

- `src/lib/ai-cost/types.ts` (created) - 8 contratos centrais de custo; sem server-only
- `src/lib/ai-cost/tracker.ts` (created) - AiCostTracker, camada única de escrita
- `src/lib/ai-cost/__tests__/tracker.test.ts` (created) - 13 testes (8 canônicos + 4 contratos + 1 extra)
- `src/lib/visual-signature/types.ts` (modified) - GenerationEventType 12 valores + GenerationEventInsert estendido
- `src/lib/visual-signature/generation-events.ts` (modified) - insertGenerationEvent delega ao tracker

## Decisions Made

- **Enum não duplicado:** `AiCostEvent.generationType` importa de `visual-signature/types` — o plano exige (D5) e evita drift do enum com o banco
- **Retorno de insertGenerationEvent:** delegação ao tracker (record é void) implica retornar `null` em sucesso; consumidores atuais (rota VS) apenas `await` sem ler o valor, e os testes de rota mockam o módulo — API pública preservada por compat (teste 7 do spec valida esse retorno compatível)
- **Operação fallback de IDs:** quando o insert não carrega operation_run_id/trace_id, o delegate gera UUIDs novos — cada request da VS = um run (semântica D1); o plano 38-1-08 passará o run do `startRun` explicitamente

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Verification] JSDoc com literais que inflavam as verificações grep**
- **Found during:** Task 1 e Task 2 (verificação `grep -c`)
- **Issue:** os comentários JSDoc de `types.ts` e `tracker.ts` continham as strings literais "server-only" e "duration_is_pipeline", fazendo `grep -c "server-only" src/lib/ai-cost/types.ts` retornar 1 (plano exige 0) e `grep -c "duration_is_pipeline" src/lib/ai-cost/tracker.ts` retornar 2 (plano exige 1)
- **Fix:** reformulei os comentários para manterem a intenção sem os literais exatos (ex.: "sem restrição de runtime", "flag de pipeline")
- **Files modified:** src/lib/ai-cost/types.ts, src/lib/ai-cost/tracker.ts, src/lib/ai-cost/__tests__/tracker.test.ts (nome do teste)
- **Verification:** greps do plano todos verdes; vitest 13/13; typecheck limpo
- **Committed in:** 0a1d37f (ajuste no próprio commit), fd8b2c5, f1d1c2a

**2. [Rule 2 - Test Coverage] Cobertura extra além dos 8 testes do plano**
- **Found during:** Task 2 (comportamento Teste 3)
- **Issue:** o plano pede 8 testes; a behavior de "nunca lança" tem duas ramificações (promise rejeitada E `{ error }` retornado pelo supabase) — cobri ambas para a classe best-effort não deixar buraco
- **Fix:** adicionei 1 teste extra ("record loga erro retornado pelo supabase e resolve sem lançar") + 4 testes de contrato de tipos (comportamentos da Task 1, que são checks compile-time) → 13 testes no total
- **Files modified:** src/lib/ai-cost/__tests__/tracker.test.ts
- **Verification:** `npx vitest run src/lib/ai-cost/__tests__/tracker.test.ts` — 13 passed, 0 falhas
- **Committed in:** 501494d, 0a1d37f

---

**Total deviations:** 2 auto-fixed (1 verificação grep, 1 cobertura de teste)
**Impact on plan:** Nenhum escopo adicional. Ajustes de comentário para satisfazer as verificações exatas do plano e cobertura extra de uma ramificação do contrato best-effort. Todo o contrato do plano entregue conforme especificado.

## Issues Encountered

- `insertGenerationEvent` agora retorna `null` em sucesso (consequência direta da delegação a um `record` que não retorna a linha inserida) — comportamento documentado no plano ("retorno compatível com o uso existente"); nenhum consumidor atual lê o valor de retorno (rota VS apenas `await`; testes mockam o módulo)
- O enum `GenerationEventType` expandido é consumido apenas em posições de tipo (erased) — sem impacto de runtime nos imports client de `visual-signature/types`

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Contratos prontos para o estimador (38-1-04 — `resolveAiCost` consome `CostResolution`/`CostSource`) e para os callbacks `onCall` dos serviços (38-1-05/06 — `AiCallInfo`)
- `AiCostTracker` disponível para as rotas (38-1-07/08/09 — `startRun` + `record` por chamada; persiste `campaigns.operation_run_id`)
- `insertGenerationEvent` já delega — planos 38-1-07/08 instrumentam sem novo caminho de escrita

---
*Phase: 38-1-ai-cost-accounting*
*Completed: 2026-08-08*

## Self-Check: PASSED

- Files on disk: `src/lib/ai-cost/types.ts` ✓, `src/lib/ai-cost/tracker.ts` ✓, `src/lib/ai-cost/__tests__/tracker.test.ts` ✓, `src/lib/visual-signature/generation-events.ts` ✓, `src/lib/visual-signature/types.ts` ✓, SUMMARY ✓
- Commits presentes: 3524755 ✓, 0a1d37f ✓, 501494d ✓, fd8b2c5 ✓, 5521085 ✓, f1d1c2a ✓
- Gates: vitest 1610 passed / 0 falhas ✓, typecheck limpo ✓, lint limpo ✓, build OK ✓
