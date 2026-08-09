---
phase: 38-1-ai-cost-accounting
plan: 09
subsystem: api
tags: [ai-cost, brand-profile, ai-cost-tracker, onCall, generation-events, cost-accounting]

# Dependency graph
requires:
  - phase: 38-1-02
    provides: AiCostTracker (startRun/record) + AiCallInfo/AiCostEvent types
  - phase: 38-1-04
    provides: resolveAiCost (provider_reported → pricing_table → fallback_static → not_available)
  - phase: 38-1-06
    provides: BrandProfiler onCall (callVision/callVisionFull) + BrandProfilerInput.onCall
provides:
  - onCall no BrandDirectorService.analyze (brand-director.ts) — usage+durationMs best-effort
  - onCall no BrandTextOnlyInferenceService.infer (text-only-inference-service.ts) — usage+durationMs best-effort
  - 4 rotas /api/store/[id]/brand-profile/* instrumentadas com startRun("brand_profile"), call-level brand_profile_vision/text com custo real e delivery NULL + duration_is_pipeline
  - realign com 3 caminhos de IA instrumentados (text_only/text, logo/vision, regenerate/novo run)
affects: [38-1-10, 38-1-11, fase-38-1-verification, views admin_ai_*]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "recordCall best-effort (D7): resolveAiCost + AiCostTracker.record em try/catch — telemetria nunca bloqueia geração"
    - "Buffer de AiCallInfo emitidos durante generate() com gravação por sequência (1a = vision, 2a = text — T-38.1-39)"
    - "Delivery marker SEM cost/tokens + metadata.duration_is_pipeline:true (D1/D6 — anti-dupla-contagem T-38.1-40)"
    - "Regenerate = NOVO startRun (novo operationRunId — T-38.1-41, D1)"

key-files:
  created:
    - src/lib/brand-assets/__tests__/brand-director.test.ts
    - src/lib/brand-assets/__tests__/text-only-inference-service.test.ts
    - src/app/api/store/[id]/brand-profile/generate-without-logo/__tests__/generate-route.test.ts
    - src/app/api/store/[id]/brand-profile/infer/__tests__/route.test.ts
  modified:
    - src/lib/brand-assets/brand-director.ts
    - src/lib/brand-assets/text-only-inference-service.ts
    - src/app/api/store/[id]/brand-profile/generate-without-logo/route.ts
    - src/app/api/store/[id]/brand-profile/infer/route.ts
    - src/app/api/store/[id]/brand-profile/realign/route.ts
    - src/lib/visual-signature/__tests__/brand-profiler.test.ts
    - src/app/api/store/[id]/brand-profile/realign/__tests__/realign-route.test.ts
    - src/app/api/store/[id]/brand-profile/__tests__/route.test.ts

key-decisions:
  - "Rota principal /brand-profile (GET/PATCH/archive) NÃO gera via profiler — nenhuma instrumentação se aplica; entrega brand_profile_with_logo emitida no path logo do realign (director.analyze)"
  - "Buffer por sequência na rota: 1a entrada do onCall = brand_profile_vision, 2a = brand_profile_text (mapeamento determinístico por path — T-38.1-39)"

patterns-established:
  - "onCall de serviços brand: provider='openai', model via env (OPENAI_BRAND_DIRECTOR_MODEL/OPENAI_TEXT_ONLY_INFERENCE_MODEL ?? 'gpt-4o'), usage mapeado por helper local mapChatUsage (prompt/completion/total/cached/image tokens), durationMs = Date.now()-startTime"
  - "Caminho mock dev (sem OPENAI_API_KEY) NÃO emite onCall — não há chamada real de IA (6.5, D5)"

requirements-completed: [F38.1-34, F38.1-35, F38.1-36, F38.1-37, F38.1-38]

# Metrics
duration: 12min
completed: 2026-08-08
---

# Phase 38.1 Plan 09: Brand Profile — onCall nos serviços brand + rotas instrumentadas Summary

**onCall de telemetria adicionado ao BrandDirectorService.analyze e BrandTextOnlyInferenceService.infer (usage+durationMs best-effort) e TODAS as rotas /api/store/[id]/brand-profile/* instrumentadas com startRun("brand_profile"), eventos call-level brand_profile_vision/brand_profile_text com custo real via resolveAiCost e delivery markers (without_logo/with_logo) com custo NULL + duration_is_pipeline — fechando o furo D11 do escopo brand (infer/route.ts saiu de ZERO eventos e o realign cobriu seus 3 caminhos de IA, com regenerate = novo run)**

## Performance

- **Duration:** 12 min
- **Started:** 2026-08-08T21:33:00Z
- **Completed:** 2026-08-08T21:44:00Z
- **Tasks:** 3
- **Files modified:** 11 (5 code + 6 tests)

## Accomplishments
- `BrandDirectorService.analyze` aceita `onCall?: (info: AiCallInfo) => void | Promise<void>` invocado após o `chat.completions.create` com provider/model/usage/durationMs — best-effort (D7), não altera retorno nem caminhos de erro
- `BrandTextOnlyInferenceService.infer` aceita 3º param opcional `onCall` — invocado após o create com usage real; caminho mock dev (sem OPENAI_API_KEY) NÃO invoca onCall (sem chamada real de IA)
- `BrandProfilerWithoutLogoService.generate` repassa `onCall` do `BrandProfilerInput` ao `BrandProfiler` interno (threading já implementado em 38-1-06; verificado por teste spy — Teste 6)
- Rotas `generate-without-logo`, `infer` e `realign` instrumentadas: `startRun("brand_profile")`, buffer de AiCallInfo gravado por sequência (1a = vision, 2a = text) com custo real via resolveAiCost, delivery marker NULL + duration_is_pipeline
- `realign/route.ts` com os TRÊS caminhos de IA instrumentados: text_only → brand_profile_text + delivery without_logo; logo → brand_profile_vision + delivery with_logo; regenerate → NOVO startRun (operationRunId distinto)
- `infer/route.ts` saiu de ZERO eventos para call brand_profile_text + delivery brand_profile_without_logo
- 46 testes: 18 de serviço (6 novos + 12 existentes) + 28 de rota (15 novos + 13 existentes); suíte total 1700 testes verdes

## Task Commits

Each task was committed atomically:

1. **Task 1: onCall nos serviços brand (brand-director + text-only) + threading** - `49a93f9` (test, RED) + `4aa110c` (feat, GREEN)
2. **Task 2: Rotas brand — run context + buffer vision/text + delivery NULL** - `d2fafdf` (test, RED) + `d0f71d9` (feat, GREEN)
3. **Task 3: Testes 6.5 (4 cenários) + rota principal** - `61414eb` (test)

**Plan metadata:** `351a320` (docs: complete plan)

## Files Created/Modified
- `src/lib/brand-assets/brand-director.ts` - onCall no analyze (D11) + helper mapChatUsage
- `src/lib/brand-assets/text-only-inference-service.ts` - onCall no infer (D11) + helper mapChatUsage
- `src/app/api/store/[id]/brand-profile/generate-without-logo/route.ts` - startRun + buffer vision/text + delivery without_logo NULL
- `src/app/api/store/[id]/brand-profile/infer/route.ts` - startRun + call brand_profile_text + delivery without_logo (de zero eventos)
- `src/app/api/store/[id]/brand-profile/realign/route.ts` - 3 caminhos de IA instrumentados (text_only/logo/regenerate) + helpers recordBrandCall/recordBrandDelivery
- `src/lib/visual-signature/__tests__/brand-profiler.test.ts` - Teste 6 (threading spy)
- `src/lib/brand-assets/__tests__/brand-director.test.ts` - Testes 1-2 + retrocompatibilidade
- `src/lib/brand-assets/__tests__/text-only-inference-service.test.ts` - Testes 3-4 + best-effort + retrocompatibilidade
- `src/app/api/store/[id]/brand-profile/generate-without-logo/__tests__/generate-route.test.ts` - Testes 12/13/14 + sem-onCall
- `src/app/api/store/[id]/brand-profile/realign/__tests__/realign-route.test.ts` - Testes 9a/9b/15 + mock AiCostTracker
- `src/app/api/store/[id]/brand-profile/infer/__tests__/route.test.ts` - Teste 16 + sem-onCall
- `src/app/api/store/[id]/brand-profile/__tests__/route.test.ts` - decisão rota principal sem geração

## Decisions Made
- **Rota principal sem instrumentação:** `/brand-profile` (GET/PATCH/archive) não gera via profiler — o plano (task 2.3) previa instrumentá-la "se gera perfil com logo via BrandProfiler"; como não gera, a entrega `brand_profile_with_logo` é emitida no path logo do realign (único lugar que gera com logo). Documentado no teste da rota principal.
- **Mapeamento determinístico do buffer:** a rota grava os AiCallInfo na ordem de chegada — 1a entrada = `brand_profile_vision`, 2a = `brand_profile_text`. No path 2 do profiler a ordem fixa visão→texto garante determinismo (T-38.1-39). Na prática, `brand-profiler.ts` só emite chamadas de visão (callVision/callVisionFull — decisão 38-1-06); o text-only é serviço separado.
- **Helpers compartilhados no realign:** `recordBrandCall`/`recordBrandDelivery` evitam triplicar o padrão best-effort nos 3 caminhos.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
- Nenhum — os testes de rota exigiram re-assert de operationRunId para capturar por request (contador do mock de startRun acumula entre testes no mesmo arquivo); assertions relativas (distinto entre requests sequenciais) substituíram valores hardcoded.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Escopo brand do D1/D5/D11 completo: 3 serviços com onCall (2 novos + 1 threading) + 4 rotas brand instrumentadas
- Views/RPCs de apuração (38-1-10) poderão somar call-level `brand_profile_vision`/`brand_profile_text` por operationRunId sem dupla contagem (delivery markers com custo NULL)
- Próximo plano: 38-1-10 (Views/RPCs apuração + 50 testes + gates + UAT checkpoint)

---
*Phase: 38-1-ai-cost-accounting*
*Completed: 2026-08-08*

## Self-Check: PASSED

- 12 arquivos de código/teste criados ou modificados confirmados no disco
- 5 commits de tarefa confirmados no git log (49a93f9, 4aa110c, d2fafdf, d0f71d9, 61414eb)
- Greps do plano confirmados: startRun (generate=1, infer=1, realign=3), duration_is_pipeline (generate=1, infer=1), onCall (brand-director=3, text-only=3, brand-profiler=9)
- Suítes verdes: 4 rotas brand (28 testes) + 3 serviços (18 testes); suíte total 1700
- Gates: vitest ✅, typecheck ✅, lint ✅, build ✅ (EXIT=0)
