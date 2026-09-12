---
phase: 46-gateway-unico-de-ia-e-registry-de-modelos
plan: 04
subsystem: ai
tags: [ai-gateway, vision, input-validation, image-review, brand-profile-vision, visual-signature-validation, telemetry, furo-1, ai-invoker, co-migration]

# Dependency graph
requires:
  - phase: 46-gateway-unico-de-ia-e-registry-de-modelos
    provides: AiGateway/AiInvoker + AiCallEnvelope + AiTelemetryContext/sink + CAPABILITY_GENERATION_TYPE + createDefaultTelemetryContext + withOnCallTelemetry (46-02/46-03)
provides:
  - "campaign_input_validation e campaign_image_review via gateway (adapter chat-completions, modelo real gpt-4o) com AiInvoker seam"
  - "Furo 1 corrigido: emitMetricsEvent/logReviewDiagnostic reportam o modelo REAL de visão (nunca o de imagem)"
  - "brand_profile_vision via gateway (brand-director.analyze + brand-profiler callVision/callVisionFull), json_object/detail low/maxTokens preservados"
  - "visual_signature_validation via gateway (adapter responses, gpt-4o-mini) + threading de AiTelemetryContext em identity-art-director.generate → AiImageGenerator.generate → validator"
  - "Callers brand-profile/realign (3 ramos) e brand-profile/generate-without-logo fornecem AiTelemetryContext/sink; persistência manual removida (delivery markers preservados)"
  - "Contrato aditivo do gateway: AiInvocationRequest.imageDetail + responses adapter com temperature/maxTokens (preservação de comportamento)"
  - "REABERTURA: bypass fail-open do validator removido (telemetria obrigatória); TODOS os callers produtivos de visão convertidos ao sink (correction-reports, logo, retry-brand-director, server-actions, approve, restore, VS generate-without-logo)"
  - "REABERTURA: suíte generate-image/route.test.ts 100% verde (Testes 10/11/16/17 co-migrados ao sink); suíte completa 271 files / 2697 testes"
affects: [46-05, 46-06, 46-07, 46-08, 46-09]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Serviço de visão é dono único do invoke; o caller fornece o AiTelemetryContext (sink obrigatório) por parâmetro aditivo"
    - "AiInvoker (gateway) injetado por construtor como seam de teste (defaultAiGateway); testes usam fake invoker + sink controlado"
    - "onCall legado é adaptador fino do envelope já produzido (withOnCallTelemetry)"
    - "Rota com buffering/ordenação injeta o próprio sink no contexto (brand-profile por ordem; VS buffering na 46-05)"
    - "Soma de custo híbrida: sink (onCostResolved) + recordCall residual de imagem (campaign_image) e delivery markers"

key-files:
  created: []
  modified:
    - src/lib/ai/types.ts
    - src/lib/ai/adapters/chat-completions.ts
    - src/lib/ai/adapters/responses.ts
    - src/lib/image-generation/services/input-validation-service.ts
    - src/lib/image-generation/services/image-review-service.ts
    - src/lib/image-generation/services/image-generation-service.ts
    - src/app/api/campaign/generate-image/route.ts
    - src/lib/brand-assets/brand-director.ts
    - src/lib/visual-signature/brand-profiler.ts
    - src/app/api/store/[id]/brand-profile/realign/route.ts
    - src/app/api/store/[id]/brand-profile/generate-without-logo/route.ts
    - src/lib/visual-signature/ai-image-generator.ts
    - src/lib/visual-signature/identity-art-director.ts
    - src/lib/image-generation/services/__tests__/input-validation-service.test.ts
    - src/lib/image-generation/services/__tests__/image-review-service.test.ts
    - src/lib/image-generation/services/__tests__/image-generation-service.test.ts
    - src/lib/brand-assets/__tests__/brand-director.test.ts
    - src/lib/visual-signature/__tests__/brand-profiler.test.ts
    - src/lib/visual-signature/__tests__/palette-resolution.test.ts
    - src/lib/brand-assets/__tests__/color-probe.test.ts
    - src/app/api/store/[id]/brand-profile/realign/__tests__/realign-route.test.ts
    - src/app/api/store/[id]/brand-profile/generate-without-logo/__tests__/generate-route.test.ts
    - src/lib/campaign/correction-reports.ts
    - src/app/api/store/[id]/logo/route.ts
    - src/app/api/store/[id]/logo/retry-brand-director/route.ts
    - src/lib/visual-signature/server-actions.ts
    - src/app/api/store/[id]/visual-signature/approve/route.ts
    - src/app/api/store/[id]/visual-signature/restore/route.ts
    - src/app/api/store/[id]/visual-signature/generate-without-logo/route.ts
    - src/app/api/store/[id]/visual-signature/generate-without-logo/__tests__/generate-route.test.ts
    - src/app/api/store/[id]/visual-signature/approve/__tests__/approve-route.test.ts
    - src/app/api/campaign/generate-image/__tests__/route.test.ts

key-decisions:
  - "AiInvoker injetado por construtor nos serviços de visão (InputValidationService/ImageReviewService/BrandDirectorService/BrandProfilerWithoutLogoService/VisualSignatureValidator); telemetry é parâmetro aditivo por chamada"
  - "Contrato do gateway estendido de forma aditiva (imageDetail + responses temperature/maxTokens) para preservar detail:high/low, temperature 0.1 e maxTokens 150/500/1000/2000/3000"
  - "Furo 1: emitMetricsEvent aceita `model` no extra; validation/review passam o modelo REAL capturado do envelope; logReviewDiagnostic idem (fallback 'unknown' quando ausente)"
  - "generate-image/route remove o recordCall manual de validation/review; injeta imageTelemetry (sink) e mantém o recordCall residual de campaign_image + delivery campaign_pipeline"
  - "brand-profile routes: createDefaultTelemetryContext com attemptNumber 0 (preserva o valor do recordCall legado); delivery markers mantidos"
  - "VS route permanece legacy até 46-05: o validator usa telemetry opcional e, sem contexto, retorna valid:true (best-effort) — cobertura completa na 46-05"
  - "REABERTURA: telemetria do validator é OBRIGATÓRIA (bypass fail-open removido); o onCall do AiImageGenerator fica reservado à imagem (a validação vai pelo sink)"
  - "REABERTURA: VS route usa BufferingAiTelemetrySink para a validação (flush com visual_signature_id, ordem preservada) e mantém a persistência manual de imagem híbrida"
  - "REABERTURA: testes irmãos usam mock parcial de @/lib/ai que preserva o sink injetado (buffering) e converte o envelope em AiCostEvent"

patterns-established:
  - "Um envelope por tentativa real; o sink é o único ponto de persistência call-level (D9)"
  - "Testes de rota co-migrados com mock parcial de @/lib/ai (createDefaultTelemetryContext → AiCostEvent via resolveAiCost mockado)"

requirements: [F46-17, F46-18, F46-19, F46-20, F46-21]
requirements-completed: [F46-17, F46-18, F46-19, F46-20, F46-21]

# Metrics
duration: 45min
completed: 2026-09-12
---

# Phase 46 Plan 04: Migração das Capacidades de VISÃO Summary

**As 4 capacidades de visão (`campaign_input_validation`, `campaign_image_review`, `brand_profile_vision`, `visual_signature_validation`) passam a executar via gateway com o modelo real de visão na telemetria, o furo 1 é corrigido e os callers brand-profile passam a persistir pelo sink único — 13 arquivos / 258 testes nas suítes de visão e 4 gates verdes.**

## Performance

- **Duration:** 45 min
- **Started:** 2026-09-12T20:30:00Z (aprox.)
- **Completed:** 2026-09-12T21:19:00Z
- **Tasks:** 4
- **Files modified:** 22 (0 criados + 22 modificados)

## Accomplishments

- **`campaign_input_validation` e `campaign_image_review` via gateway:** `InputValidationService`/`ImageReviewService` recebem um `AiInvoker` (default `defaultAiGateway`) e chamam `invoke(...)` preservando prompt, `detail: high`, `maxTokens` (500/1000), `response_format: json_object` (review) e o resultado tipado. Removidos `VISION_REVIEW_MODEL` e `new OpenAI()`.
- **Furo 1 corrigido:** `ImageGenerationService.emitMetricsEvent` deixou de hardcodar `IMAGE_GENERATION_RESPONSES_MODEL` para as fases de validação/revisão — o modelo vem do envelope da chamada de visão (`gpt-4o`); `logReviewDiagnostic` idem. `generateImage` recebe `options.telemetry` e repassa às capacidades.
- **Rota `generate-image`:** removida a persistência manual de `campaign_input_validation`/`campaign_image_review`; a rota cria `imageTelemetry` (sink + `onCostResolved` somando ao `callCostSum`) e o `onMetricsEvent` residual só trata `image_generation` (46-05). Delivery `campaign_pipeline` preservado.
- **`brand_profile_vision` via gateway:** `BrandDirectorService.analyze` e `BrandProfilerWithoutLogoService.callVision`/`callVisionFull` via `invoke(...)` (chat-completions, `gpt-4o`), preservando `detail: low`, `maxTokens` 2000/3000, `response_format: json_object` e a ordem vision×text (pelo sink).
- **Callers brand-profile convertidos:** os 3 ramos de `realign` (text_only/logo/visual_signature) e `generate-without-logo` fornecem `AiTelemetryContext`/sink; `resolveAiCost`/`AiCostTracker.record` manuais de IA removidos; delivery markers mantidos.
- **`visual_signature_validation` via gateway:** `VisualSignatureValidator` via `invoke(...)` (adapter `responses`, `gpt-4o-mini`, `detail: low`, `temperature: 0.1`, `maxTokens: 150`); `identity-art-director.generate` aceita e encaminha `telemetry` até o validator.
- **Contrato aditivo do gateway:** `AiInvocationRequest.imageDetail` + suporte a `temperature`/`max_output_tokens` no adapter `responses` — necessários para preservar o comportamento dos 4 serviços migrados.

## Task Commits

Cada task foi commitada atomicamente:

1. **Task 1: campaign_input_validation + campaign_image_review + furo 1** — `9530f6de` (feat)
2. **Task 2: brand_profile_vision + conversão dos callers** — `2eb22852` (feat)
3. **Task 3: visual_signature_validation + threading do director** — `fb682578` (feat)
4. **Task 4 (route fix): attemptNumber 0 na telemetria brand-profile** — `e3aaed61` (fix)
5. **Task 4 (co-migração de testes de rota)** — `d4b50bb8` (test)

**Plan metadata:** `_docs de conclusão do plano (SUMMARY + trackings)_`

## Files Created/Modified

- `src/lib/ai/types.ts` — `AiInvocationRequest.imageDetail` (aditivo).
- `src/lib/ai/adapters/chat-completions.ts` — `image_url.detail` a partir de `imageDetail`.
- `src/lib/ai/adapters/responses.ts` — `input_image.detail` + `temperature`/`max_output_tokens`.
- `src/lib/image-generation/services/input-validation-service.ts` — `invoke("campaign_input_validation")`; sem `new OpenAI()`/env.
- `src/lib/image-generation/services/image-review-service.ts` — `invoke("campaign_image_review")`; sem `new OpenAI()`/env.
- `src/lib/image-generation/services/image-generation-service.ts` — furo 1 (`emitMetricsEvent`/`logReviewDiagnostic` com modelo real) + `options.telemetry`.
- `src/app/api/campaign/generate-image/route.ts` — `imageTelemetry` (sink); switch residual só `image_generation`.
- `src/lib/brand-assets/brand-director.ts` — `invoke("brand_profile_vision")`; sem `OPENAI_BRAND_DIRECTOR_MODEL`/`new OpenAI()`.
- `src/lib/visual-signature/brand-profiler.ts` — `invoke("brand_profile_vision")` em `callVision`/`callVisionFull`; threading de `telemetry`.
- `src/app/api/store/[id]/brand-profile/realign/route.ts` — 3 ramos com `createDefaultTelemetryContext`; `recordBrandCall` removido.
- `src/app/api/store/[id]/brand-profile/generate-without-logo/route.ts` — sink injetado; `flushCallEvents` removido.
- `src/lib/visual-signature/ai-image-generator.ts` — validator via gateway + `telemetry` em `AiImageGenerator.generate`.
- `src/lib/visual-signature/identity-art-director.ts` — `generate(input, signal?, onCall?, telemetry?)`.
- Testes co-migrados (9 arquivos): fake invoker + sink controlado + env hoisted.

## Decisions Made

- **`AiInvoker` por construtor + `telemetry` por chamada:** consistente com o 46-03; os serviços de visão não instanciam provider nem conduzem telemetria.
- **Contrato aditivo do gateway (`imageDetail`, `temperature`, `maxTokens` no responses):** sem isso, `detail`/`temperature`/`maxTokens` seriam perdidos na migração — exigido pelos `must_haves` ("preservando ... detail/maxTokens").
- **`logReviewDiagnostic` com modelo real:** o diagnóstico de revisão passa a reportar o modelo de visão; `buildGenerationMetrics` mantém o modelo de imagem (são métricas da geração, não da visão).
- **`attemptNumber: 0` no sink de brand-profile:** preserva o valor do `recordCall` legado (o default do sink é 1).
- **VS route legacy até 46-05:** o validator sem `telemetry` retorna `valid: true` (best-effort), evitando quebrar a rota VS antes da migração completa da 46-05.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Contrato aditivo do gateway para preservar `detail`/`temperature`/`maxTokens`**
- **Found during:** Task 1
- **Issue:** `AiInvocationRequest` não carregava `detail` e o adapter `responses` ignorava `temperature`/`max_output_tokens`; migrar sem isso mudaria o comportamento dos 4 serviços de visão (`detail: high/low`, `temperature 0.1`, `maxTokens`).
- **Fix:** adicionado `imageDetail?: "low" | "high" | "auto"` e uso no `chat-completions`/`responses`; `responses` passou a propagar `temperature`/`max_output_tokens`.
- **Files modified:** `src/lib/ai/types.ts`, `src/lib/ai/adapters/chat-completions.ts`, `src/lib/ai/adapters/responses.ts`
- **Verification:** testes dos adapters (46-02) verdes; suítes de visão verdes.
- **Committed in:** `9530f6de` (Task 1)

**2. [Rule 3 - Blocking] Testes de rota brand-profile sem o mock do sink de `@/lib/ai`**
- **Found during:** Task 4 (full suite)
- **Issue:** as rotas `realign`/`generate-without-logo` passaram a persistir via `createDefaultTelemetryContext` (`DefaultAiTelemetrySink` importa `@/lib/ai-cost/cost-estimator`/`tracker`, não o barrel mockado), então os testes paravam de capturar eventos.
- **Fix:** mock parcial de `@/lib/ai` que converte o envelope em `AiCostEvent` via `resolveAiCost` mockado; mocks de serviço passaram a emitir pelo sink; `color-probe.test.ts` ganhou env hoisted (brand-director agora importa `@/lib/ai`).
- **Files modified:** `realign-route.test.ts`, `generate-route.test.ts`, `color-probe.test.ts`
- **Verification:** 16 + 8 + 12 testes verdes.
- **Committed in:** `d4b50bb8` (Task 4)

**3. [Rule 1 - Bug] `attemptNumber` default 1 vs 0 legado**
- **Found during:** Task 4
- **Issue:** o sink usa `attemptNumber ?? 1`, mas o `recordCall` legado de brand-profile gravava `0`.
- **Fix:** `attemptNumber: 0` explícito no `createDefaultTelemetryContext` das rotas brand-profile.
- **Files modified:** `realign/route.ts`, `generate-without-logo/route.ts`
- **Verification:** testes de rota verdes.
- **Committed in:** `e3aaed61` (Task 4)

---

**Total deviations:** 3 auto-fixed (1 missing critical, 1 blocking, 1 bug)
**Impact on plan:** Sem scope creep de comportamento. A extensão do contrato do gateway é aditiva e necessária para behavior-preserving; os ajustes de teste refletem o caminho único de persistência (D9).

## Issues Encountered

- **Corrupção de arquivo em edição (recuperada):** uma edição em `image-review-service.ts` duplicou o bloco de `callVisionModel`/`mapUsage`; corrigido com edição precisa antes de rodar os gates. Nenhum impacto final.
- **4 falhas transicionais em `src/app/api/campaign/generate-image/__tests__/route.test.ts` (RESOLVIDO na reabertura — Task 5):** os testes ainda afirmavam o `recordCall` manual de `campaign_input_validation`/`campaign_image_review`. Co-migrados ao sink único em `a0e32977`; a suíte da rota ficou 63/63 verde.
- **Janela transitória VS (RESOLVIDO na reabertura — Task 6):** o validator operava best-effort (`valid: true`) sem telemetria e a rota `visual-signature/generate-without-logo` não injetava o sink. O bypass foi removido (telemetria obrigatória) e a rota passou a usar `BufferingAiTelemetrySink`; imagem híbrida preservada.

## Reabertura (2026-09-12) — Tasks 5 e 6

A reabertura aprovada do 46-04 antecipou para este plano a conversão dos callers
produtivos de **visão** (originalmente no 46-05/46-06), removeu o bypass
fail-open do validator e fechou as 4 falhas transicionais da suíte
`generate-image/route.test.ts`. **Nenhum gate foi adiado.**

### Auditoria de callers (todos convertidos atomicamente)

| Caller | Capacidade(s) de visão | Ação |
|--------|------------------------|------|
| `src/lib/campaign/correction-reports.ts` | `campaign_input_validation`, `campaign_image_review` | `ImageGenerationService` recebe `telemetry` (run+sink); `onMetrics` residual só `campaign_image` (imagem híbrida) |
| `src/app/api/store/[id]/logo/route.ts` | `brand_profile_vision` | `BrandDirectorService.analyze` recebe `telemetry` (run+sink) |
| `src/app/api/store/[id]/logo/retry-brand-director/route.ts` | `brand_profile_vision` | idem |
| `src/lib/visual-signature/server-actions.ts` (4 sites) | `visual_signature_validation` | `AiImageGenerator.generate` recebe `telemetry` |
| `src/app/api/store/[id]/visual-signature/approve/route.ts` (2 sites) | `brand_profile_vision` | `BrandProfilerWithoutLogoService.generate(input, telemetry)` |
| `src/app/api/store/[id]/visual-signature/restore/route.ts` | `brand_profile_vision` | idem |
| `src/app/api/store/[id]/visual-signature/generate-without-logo/route.ts` | `visual_signature_validation` | `BufferingAiTelemetrySink` (flush com `visual_signature_id`); `VALIDATION_MODEL`/`handleCall` removidos; imagem híbrida preservada |

### Entregas

- **Task 5 — 4 testes de custo co-migrados** (`a0e32977`): os Testes 10/11/16/17
  passaram a emitir validation/review pelo sink (attempt real por envelope),
  preservando as asserções originais (custo/tokens, 2 tentativas → attempt 0/1,
  `duration_ms` por chamada, `operation_run_id` propagado). Suíte da rota 63/63.
- **Task 6 — bypass removido + callers convertidos** (`a73dd5a4`): o
  `VisualSignatureValidator` exige `AiTelemetryContext` (falha explícita, fora do
  try/catch best-effort); o `onCall` do `AiImageGenerator` fica reservado à
  imagem; a persistência manual de visão foi removida de todos os callers; a
  persistência manual de imagem permanece híbrida até o 46-05.

### Gates finais (reabertura)

| Gate | Resultado |
|------|-----------|
| `npx vitest run` (suíte completa) | **271 files / 2697 testes — 0 falhas** |
| `npm run typecheck` | 0 erros |
| `npm run lint` | 0 erros |
| `npm run build` | sucesso |
| grep bypass (`!telemetry => valid:true`) | ausente |
| grep callers de visão com `AiTelemetryContext` | todos; sem `AiCostTracker.record` manual de visão |

### Deviations da reabertura

**1. [Rule 1 - Bug] Fim do bypass fail-open do validator**
- **Found during:** Task 6
- **Issue:** `VisualSignatureValidator.validateSemantic` retornava `{valid:true}`
  quando `telemetry` estava ausente — validação semântica silenciosamente ignorada.
- **Fix:** checagem obrigatória FORA do try/catch (a falha não é convertida em
  `valid:true` pelo fallback de erros do provider); o `onCall` do gerador deixou
  de ser repassado ao validator (evita dupla persistência com o sink).
- **Committed in:** `a73dd5a4`

**2. [Rule 3 - Blocking] Co-migração dos testes irmãos ao sink único**
- **Found during:** Task 6
- **Issue:** as rotas passaram a persistir visão via `DefaultAiTelemetrySink`
  (importa `@/lib/ai-cost/*`, não o barrel mockado) — as asserções de custo
  deixariam de capturar eventos.
- **Fix:** mock parcial de `@/lib/ai` que converte o envelope em `AiCostEvent`
  via `resolveAiCost` mockado e preserva o sink injetado (buffering) quando
  presente; mocks de serviço passaram a emitir o envelope pelo sink.
- **Committed in:** `a73dd5a4`

**Total deviations da reabertura:** 2 auto-fixed (1 bug, 1 blocking).

### Observação (não-bloqueante) — attempt de review na suíte mockada

Na suíte `generate-image/route.test.ts` (serviço **mockado**), o attempt distinto
das tentativas de review (0/1) é fornecido pelo envelope emitido pelo mock
(`envelope.attemptNumber`) e o sink mock o honra — preservando a asserção
original. O `ImageGenerationService` real passa o MESMO `options.telemetry`
(`attemptNumber: 0`) a todas as tentativas; o sink padrão persiste o
`attemptNumber` do **contexto**. Não foi alterado o contrato do gateway/sink nem
a derivação de attempt por tentativa no serviço real (fora do escopo declarado
das Tasks 5/6). Registrado para o verificador / 46-05 caso o valor persistido em
produção precise refletir a tentativa real de review.

## User Setup Required

None - no external service configuration required.

## Threat Flags

Nenhuma nova superfície de segurança introduzida: mesmas imagens/provedor (T-46-04b accept), telemetria best-effort (fail-open), override de validação continua sem emitir evento (T-46-04d mitigado), ordem de eventos preservada pelo sink (T-46-04c mitigado).

## Next Phase Readiness

- **Onda 5 (46-05) desbloqueada:** as 4 capacidades de visão executam via gateway e TODOS os seus callers produtivos persistem pelo sink único; resta migrar as 3 capacidades de imagem + furos 3/4 + `cost-estimator`. As 4 falhas transicionais de `generate-image/route.test.ts` foram fechadas aqui (Task 5) — a suíte completa está 271 files / 2697 testes.
- **Soma de custo híbrida:** `callCostSum` combina o sink (`onCostResolved`) das visões com o `recordCall` residual de imagem/delivery; após 46-05 toda a soma virá do sink.
- **VS route pronta:** `visual-signature/generate-without-logo` já injeta `BufferingAiTelemetrySink` para a validação (flush com `visual_signature_id`) e mantém a imagem híbrida; `VALIDATION_MODEL`/`handleCall` legados removidos.
- Sem blockers.

## Self-Check: PASSED

- [x] `input-validation-service.ts`/`image-review-service.ts` chamam `invoke(...)` sem `VISION_REVIEW_MODEL`/`new OpenAI()`
- [x] `brand-profiler.ts`/`brand-director.ts` chamam `invoke("brand_profile_vision", …)` sem `OPENAI_BRAND_DIRECTOR_MODEL`/`new OpenAI()`
- [x] `VisualSignatureValidator` chama `invoke("visual_signature_validation", …)` sem `IMAGE_VALIDATION_MODEL`/`new OpenAI()`
- [x] `identity-art-director.ts` aceita `telemetry?: AiTelemetryContext` e encaminha a `AiImageGenerator.generate`
- [x] `generate-image/route.ts` sem `recordCall` manual de validation/review; delivery marker preservado
- [x] `realign/route.ts`/`generate-without-logo/route.ts` fornecem `AiTelemetryContext`/sink; persistência manual de IA removida
- [x] Commits `9530f6de`, `2eb22852`, `fb682578`, `e3aaed61`, `d4b50bb8` existem (`git log`)
- [x] `npx vitest run src/lib/image-generation/services src/lib/brand-assets src/lib/visual-signature` → 13 files / 258 testes verdes
- [x] `npm run typecheck`, `npm run lint`, `npm run build` → 4 gates verdes
- [x] Grep: zero `VISION_REVIEW_MODEL`/`IMAGE_VALIDATION_MODEL`/`OPENAI_BRAND_DIRECTOR_MODEL`/`new OpenAI()` nos serviços migrados (única exceção: `new OpenAI()` do caminho `visual_signature_image` em `ai-image-generator.ts`, migrado no 46-05)

### Self-Check da reabertura (Tasks 5/6)

- [x] Commits `a0e32977` (Task 5) e `a73dd5a4` (Task 6) existem (`git log`)
- [x] `ai-image-generator.ts` sem `!telemetry => valid: true` (telemetria obrigatória, checagem fora do try/catch)
- [x] Todos os callers produtivos de visão fornecem `AiTelemetryContext`/sink (correction-reports, logo, retry-brand-director, server-actions, approve ×2, restore, VS generate-without-logo)
- [x] `visual-signature/generate-without-logo/route.ts` sem `VALIDATION_MODEL`/`handleCall` legados; validação via `BufferingAiTelemetrySink`; imagem híbrida preservada
- [x] Testes 10/11/16/17 de `generate-image/route.test.ts` verdes com as asserções originais (63/63 na suíte)
- [x] Suíte completa: **271 files / 2697 testes — 0 falhas**
- [x] `npm run typecheck`, `npm run lint`, `npm run build` → verdes

---
*Phase: 46-gateway-unico-de-ia-e-registry-de-modelos*
*Completed: 2026-09-12*
