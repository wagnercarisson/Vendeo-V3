---
phase: 38-1-ai-cost-accounting
plan: 08
subsystem: api
tags: [ai-cost, generation-events, visual-signature, onCall, AiCostTracker, resolveAiCost]

# Dependency graph
requires:
  - phase: 38-1-02
    provides: AiCostTracker (startRun/record best-effort) + AiCostEvent
  - phase: 38-1-04
    provides: resolveAiCost 4 fontes nunca-null (D9)
  - phase: 38-1-06
    provides: onCall no AiImageGenerator (visual_signature_image, Responses API)
provides:
  - Rota VS instrumentada: startRun('visual_signature') + recordCall com custo real por chamada + delivery NULL
  - VisualSignatureValidator com onCall (visual_signature_validation — usage + durationMs)
  - Retry pós-falha = novo run (D1); visual_signature_id em todos os eventos (D2)
  - 6 testes 6.4 verdes (suíte da rota 14 testes)
affects: [38-1-10 (verificação views), 38-1-11 (runbook trackings)]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "recordCall local na rota (idêntico ao 38-1-07): call-level com resolveAiCost, delivery sem cost/tokens"
    - "Run context D1: let run = startRun + reassign no retry (novo operationRunId por tentativa)"
    - "Flush diferido: eventos call-level enfileirados até o visual_signature_id existir (D2)"
    - "Disambiguation do onCall único pelo model real (validação = IMAGE_VALIDATION_MODEL)"

key-files:
  created: []
  modified:
    - "src/app/api/store/[id]/visual-signature/generate-without-logo/route.ts"
    - "src/lib/visual-signature/ai-image-generator.ts"
    - "src/lib/visual-signature/identity-art-director.ts"
    - "src/app/api/store/[id]/visual-signature/generate-without-logo/__tests__/generate-route.test.ts"

key-decisions:
  - "D1: retry pós-falha técnica = NOVO startRun('visual_signature') (novo operationRunId — testado 6.4 test 10); run 1 é fechado com flushCallEvents(null) antes de abrir o run 2 (eventos da tentativa falha sem assinatura)"
  - "D11: imagem e validação atravessam o MESMO onCall — a rota distingue visual_signature_image vs visual_signature_validation pelo model real da chamada (validação = IMAGE_VALIDATION_MODEL || gpt-4o-mini)"
  - "D2: eventos call-level são enfileirados (pendingCalls) e gravados quando o visual_signature_id é conhecido (após persistSignature) — todos os eventos do run com o id"
  - "D7: onCall do validator só no caminho de sucesso da chamada LLM e em try/catch silencioso (anti-dupla-contagem T-38.1-28); tracker best-effort nunca bloqueia"
  - "Compat F37: delivery continua via insertGenerationEvent (que delega ao tracker) — apenas com operation_run_id/trace_id/operation_run_type/visual_signature_id adicionados"

patterns-established:
  - "Pattern 1: recordCall best-effort com fila diferida para colunas conhecidas só após a persistência (visual_signature_id)"
  - "Pattern 2: onCall único do AiImageGenerator (imagem + validação) com disambiguation por model na rota"

requirements-completed: [F38.1-25, F38.1-26, F38.1-27, F38.1-28, F38.1-29]

# Metrics
duration: 9min
completed: 2026-08-08
---

# Phase 38.1: Apuração de Custos de IA por Entrega — Plan 08 Summary

**Rota generate-without-logo instrumentada com run context D1 (startRun visual_signature, retry = novo operationRunId), eventos call-level visual_signature_image + visual_signature_validation com custo/tokens reais via resolveAiCost, delivery marker visual_signature sem custo com duration_is_pipeline, e 6 testes 6.4 verdes (14 no total na suíte da rota)**

## Performance

- **Duration:** 9 min
- **Started:** 2026-08-08T21:17:46-03:00
- **Completed:** 2026-08-08T21:26:29-03:00
- **Tasks:** 3 (4 commits de produção)
- **Files modified:** 4

## Accomplishments
- `VisualSignatureValidator.validate` aceita `onCall?` opcional: mede `durationMs`, captura usage do Responses API e invoca o callback em try/catch silencioso (D7); `AiImageGenerator.generate` propaga o mesmo callback ao validator
- Rota VS: `startRun("visual_signature")` no início; retry (ATTEMPT 2) = NOVO startRun com flush do run 1 (furo 5 — eventos sem custo — sanado)
- Eventos call-level com custo real (resolveAiCost), tokens, attempt correto (0 no attempt 1, 1 no retry) e `visual_signature_id` preenchido (D2)
- Delivery success/failed via `insertGenerationEvent` compat F37 com `operation_run_id`/`trace_id`/`operation_run_type`/`visual_signature_id` — sem cost/tokens = delivery marker (D1/D6)
- `StoreIdentityArtDirectorService.generate` aceita `onCall?` opcional e repassa ao `AiImageGenerator`
- 6 testes 6.4: custo/tokens por chamada, delivery NULL, retry novo run, visual_signature_id, typographic sem evento, compat F37

## Task Commits

Each task was committed atomically:

1. **Task 1: VisualSignatureValidator com onCall** — `796beb1` (feat)
2. **Task 2: Rota VS — run context + recordCall + delivery** — `d0b0aa5` (feat)
3. **Task 2b: fecha run 1 antes do retry** — `d3d157c` (feat)
4. **Task 3: Testes 6.4 (6 testes)** — `c9feeb6` (test)

## Files Created/Modified
- `src/lib/visual-signature/ai-image-generator.ts` - `VisualSignatureValidator.validate` com `onCall?` opcional; `validateSemantic` mede durationMs + captura usage + invoca onCall best-effort; `mapResponsesUsage` extraído para nível de módulo (compartilhado imagem+validação); `generate` propaga o callback ao validator
- `src/lib/visual-signature/identity-art-director.ts` - `generate` aceita 3º parâmetro opcional `onCall?` e repassa ao `AiImageGenerator.generate`
- `src/app/api/store/[id]/visual-signature/generate-without-logo/route.ts` - `startRun("visual_signature")`; `recordCall`/`pendingCalls`/`flushCallEvents` (call-level diferido até o id da assinatura); `handleCall` distingue imagem/validação pelo model; retry = novo startRun + flush do run 1; delivery success/failed com campos novos de run context
- `src/app/api/store/[id]/visual-signature/generate-without-logo/__tests__/generate-route.test.ts` - mock `@/lib/ai-cost` (MockAiCostTracker com startRun sequencial + resolveAiCost), beforeEach próprio do bloco 6.4, describe "VS cost accounting (6.4)" com 6 cenários; teste existente de rejection context atualizado (3º arg onCall)

## Decisions Made
- **Retry = novo run com fechamento do run 1:** além do `startRun` novo (D1), os eventos call-level da tentativa falha são gravados sob o run 1 com `visual_signature_id: null` ANTES de abrir o run 2 — o run falho é auditavelmente fechado (não recebe o id da assinatura do retry)
- **Disambiguation por model:** imagem e validação atravessam o mesmo callback onCall (D11); a rota classifica como `visual_signature_validation` quando `info.model === IMAGE_VALIDATION_MODEL` (default gpt-4o-mini), senão `visual_signature_image`
- **Flush diferido:** call-level enfileirado em `pendingCalls` (com operationRunId/traceId/attempt capturados no momento da chamada) e gravado no sucesso com `visual_signature_id` ou na falha com null — todos os eventos do run com o id (D2)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Teste existente "rejection context is passed to service" quebrado pelo novo 3º argumento**
- **Found during:** Task 2 (rota VS)
- **Issue:** a rota passou a chamar `service.generate(serviceInput, signal, handleCall)` — o teste assertava `toHaveBeenCalledWith(input, signal)` com apenas 2 args
- **Fix:** atualizada a asserção com `expect.any(Function)` como 3º argumento (onCall propagado)
- **Files modified:** generate-route.test.ts
- **Verification:** suíte da rota 14/14 verde
- **Committed in:** d0b0aa5 (part of Task 2 commit)

**2. [Rule 2 - Missing Critical] Fechamento do run 1 antes do retry (flushCallEvents(null))**
- **Found during:** Task 2/3 (semântica D1)
- **Issue:** sem o flush antes do retry, os eventos call-level da tentativa 1 ficariam pendentes e seriam gravados no final com o `visual_signature_id` da assinatura do retry — atribuição enganosa para auditoria (T-38.1-37)
- **Fix:** `await flushCallEvents(null)` no início do bloco de retry, fechando o run 1 (id null) antes de abrir o run 2
- **Files modified:** route.ts
- **Verification:** teste 10 (6.4) afirma run 1 com id null e run 2 distinto
- **Committed in:** d3d157c

---

**Total deviations:** 2 auto-fixed (1 bug, 1 missing critical)
**Impact on plan:** ambas correções de corretude semântica/exigidas pela mudança do próprio plano. Sem scope creep.

## Issues Encountered
- `capturedEvents` do mock de tracker vazava entre testes: o `beforeEach` do describe irmão não se aplica a describes novos (hooks não são herdados por describes irmãos) — resolvido com `beforeEach` próprio do bloco 6.4 que reconstrói o setup de forma idempotente
- TypeScript `TS18048` (possible undefined) no helper `findDeliveryCall` — retorno tipado como `any` (padrão dos testes de rota)

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Furo 5 (insertGenerationEvent sem custo) sanado; escopo VS de D1/D2/D5/D11 completo
- Próximo: **38-1-09** (rotas 6.5 — brand-profile/* com brand-director/text-only onCall)
- Gates: vitest 1678/1678, typecheck, lint e build limpos

## Self-Check: PASSED
- SUMMARY.md existe: `.planning/phases/38-1-ai-cost-accounting/38-1-08-SUMMARY.md` ✓
- Commits presentes: `796beb1` (Task 1), `d0b0aa5` (Task 2), `d3d157c` (Task 2b), `c9feeb6` (Task 3) ✓
- Arquivos-chave existem: route.ts, ai-image-generator.ts, identity-art-director.ts, generate-route.test.ts ✓
- Gates: vitest 1678/1678 (195 files), typecheck limpo, lint limpo, build OK ✓

---

*Phase: 38-1-ai-cost-accounting*
*Completed: 2026-08-08*
