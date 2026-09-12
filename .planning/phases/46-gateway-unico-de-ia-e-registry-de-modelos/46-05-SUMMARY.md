---
phase: 46-gateway-unico-de-ia-e-registry-de-modelos
plan: 05
subsystem: ai
tags: [ai-gateway, image-generation, campaign-image, campaign-image-edit, visual-signature-image, fallback, cost-estimator, telemetry, furo-3, furo-4, co-migration]

# Dependency graph
requires:
  - phase: 46-gateway-unico-de-ia-e-registry-de-modelos
    provides: AiGateway/AiInvoker + AiCallEnvelope + AiTelemetryContext/sink + CAPABILITY_GENERATION_TYPE + adapters responses/images + DefaultAiTelemetrySink/BufferingAiTelemetrySink (46-01/46-02/46-03/46-04)
provides:
  - "campaign_image via invoke(\"campaign_image\") — adapter responses (tool image_generation, gpt-5.5), size/quality/signal preservados"
  - "campaign_image_edit como SEGUNDA invoke explícita (adapter images, gpt-image-2) gated só por erro de capability + primary; falha+fallback = DOIS envelopes"
  - "Furo 3: fallback images.edit sem usage normaliza not_available + duração + estimativa por unidade (via sink)"
  - "visual_signature_image via invoke (responses, gpt-5.5) + furo 4 (imageGenerationTool: true + generationType visual_signature_image)"
  - "cost-estimator soma o componente da tool em campaign_image E visual_signature_image; visual_signature genérico e fallback gpt-image-2 sem tool"
  - "Fim da soma híbrida: persistência manual de imagem removida em generate-image/route, correction-reports, VS generate-without-logo (imagem no BufferingAiTelemetrySink)"
  - "ImageProvider permanece contrato interno/seam de testes; implementação delega ao gateway"
affects: [46-06, 46-07, 46-08, 46-09]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Provider de imagem delega ao gateway (AiInvoker injetável) e o orquestrador de fallback é o próprio provider (segunda invoke explícita)"
    - "attemptNumber real por tentativa derivado de ImageProviderInput.attempt / params.attempt no contexto de telemetria"
    - "Sink de buffering cobre imagem + validação (flush único com visual_signature_id)"
    - "Envelope é a única fonte do modelo real e do componente da tool (usageMeta.imageGenerationTool)"

key-files:
  created: []
  modified:
    - src/lib/image-generation/providers/openai.ts
    - src/lib/image-generation/providers/types.ts
    - src/lib/image-generation/services/image-generation-service.ts
    - src/lib/visual-signature/ai-image-generator.ts
    - src/lib/ai-cost/cost-estimator.ts
    - src/lib/ai-cost/__tests__/cost-estimator.test.ts
    - src/lib/ai/types.ts
    - src/lib/ai/adapters/responses.ts
    - src/app/api/campaign/generate-image/route.ts
    - src/lib/campaign/correction-reports.ts
    - src/app/api/store/[id]/visual-signature/generate-without-logo/route.ts
    - src/lib/image-generation/providers/__tests__/openai-provider.test.ts
    - src/app/api/campaign/generate-image/__tests__/route.test.ts
    - src/app/api/store/[id]/visual-signature/generate-without-logo/__tests__/generate-route.test.ts
    - src/__tests__/api/campaign-generate.test.ts
    - src/__tests__/concurrency.test.ts
    - src/__tests__/regression-master-switch.test.ts

key-decisions:
  - "OpenAIImageProvider recebe AiInvoker (default defaultAiGateway) e é o orquestrador do fallback: invoke(campaign_image) e, em erro kind=capability + primary, segunda invoke(campaign_image_edit, target primary)"
  - "AiInvocationRequest.timeout aditivo + ResponsesAdapter repassa o timeout — preserva o timeout do caminho visual_signature_image (Rule 2)"
  - "ImageGenerationService usa MODEL_REGISTRY.campaign_image.primary.model como rótulo default das métricas diagnósticas (fonte única; remove a env-var do pipeline)"
  - "GenerateImageServiceResult.model exposto para generationMetadata/delivery markers usarem o modelo real do envelope"
  - "VS route passa o mesmo BufferingAiTelemetrySink para imagem e validação (flush único com visual_signature_id); onCall legado deixa de existir"
  - "Fallback images.edit é segunda tentativa real: dois envelopes com modelos próprios (gpt-5.5 na falha, gpt-image-2 no sucesso)"

patterns-established:
  - "Um envelope por tentativa real; o sink é o único ponto de persistência call-level (D9) — inclusive para imagem"
  - "Testes de provider co-migrados para o seam AiInvoker; teste de dois envelopes com AiGateway real + adapters fake"

requirements: [F46-22, F46-23, F46-24, F46-25]
requirements-completed: [F46-22, F46-23, F46-24, F46-25]

# Metrics
duration: 15min
completed: 2026-09-12
---

# Phase 46 Plan 05: Migração das Capacidades de IMAGEM Summary

**`campaign_image`, `campaign_image_edit` e `visual_signature_image` passam a executar via gateway; o fallback images.edit vira segunda invoke explícita (dois envelopes), os furos 3/4 são corrigidos, o cost-estimator soma a tool nas duas capacidades e a soma híbrida manual de imagem é eliminada — 272 files / 2710 testes e 4 gates verdes.**

## Performance

- **Duration:** ~15 min
- **Started:** 2026-09-12T19:23:00Z (aprox.)
- **Completed:** 2026-09-12T19:38:00Z
- **Tasks:** 4
- **Files modified:** 17 (0 criados + 17 modificados)

## Accomplishments

- **`campaign_image` via gateway:** `OpenAIImageProvider.generateImage` invoca `campaign_image` (adapter `responses`, tool `image_generation`, default `gpt-5.5`) preservando `size`/`quality`/`AbortSignal`; removidos `IMAGE_GENERATION_RESPONSES_MODEL` e `new OpenAI()` do provider. `ImageProvider` permanece contrato interno com a implementação delegando ao gateway.
- **`campaign_image_edit` como segunda invoke + furo 3:** o fallback `images.edit` virou `invoke("campaign_image_edit", …, target: "primary")` (adapter `images`, `gpt-image-2`), acionado SOMENTE por `AiInvocationError.kind === "capability"` + imagem primary (auth/safety/rate-limit não acionam). Ordem determinística `[primary, auxiliares..., identity?]` e `1024x1024` preservados; sem usage → `not_available`/estimativa por unidade + duração via sink. Falha + sucesso = **dois envelopes** (teste explícito com `AiGateway` real).
- **`visual_signature_image` + furo 4:** `AiImageGenerator.generate` invoca `visual_signature_image` (responses, `gpt-5.5`) com `imageGenerationTool: true` + `generationType: "visual_signature_image"`; `attemptTelemetry` (attempt real 0/1) alimenta imagem e validação. `AiInvocationRequest.timeout` aditivo preserva o timeout.
- **`cost-estimator` estendido:** o gate do componente da tool aceita `campaign_image` **e** `visual_signature_image`; `visual_signature` genérico e fallback `gpt-image-2` continuam sem o componente (anti-dupla-cobrança). `cost-estimator.test.ts:332` co-migrado para testes separados por capacidade.
- **Fim da soma híbrida (D9):** removidas as persistências manuais de imagem em `generate-image/route.ts` (case `image_generation` do `onMetricsEvent` + canal residual), `correction-reports.ts` (`recordCall`/`onMetrics`) e `visual-signature/generate-without-logo/route.ts` (`pendingCalls`/`flushCallEvents`/`onImageCall`); a imagem entra no `BufferingAiTelemetrySink` (flush único com `visual_signature_id`). `onPhase` (progresso) e delivery markers preservados.
- **Co-migração das suites:** `openai-provider.test.ts` reescrito para o seam `AiInvoker` (13 testes); `route.test.ts`, `campaign-generate.test.ts`, `concurrency.test.ts`, `regression-master-switch.test.ts` e VS `generate-route.test.ts` passam a emitir `campaign_image`/`visual_signature_image` pelo sink.

## Task Commits

Cada task foi commitada atomicamente:

1. **Task 1+2: campaign_image + campaign_image_edit via gateway** — `b0ecde10` (feat)
2. **Task 3: visual_signature_image + furo 4 + cost-estimator** — `367267b3` (feat)
3. **Task 4: fim da soma híbrida + co-migração das suites** — `d1dca55f` (feat)

**Plan metadata:** `_docs de conclusão do plano (SUMMARY + trackings)_`

_Nota: as Tasks 1 e 2 compartilham o commit `b0ecde10` — a reescrita do `OpenAIImageProvider` cobre o caminho primário e o fallback num único arquivo/contrato; o teste de dois envelopes foi adicionado no commit `d1dca55f`._

## Files Created/Modified

- `src/lib/image-generation/providers/openai.ts` — delega ao gateway (`campaign_image` + `campaign_image_edit`); sem SDK/env de modelo.
- `src/lib/image-generation/providers/types.ts` — `ImageProviderInput.telemetry` (AiTelemetryContext).
- `src/lib/image-generation/services/image-generation-service.ts` — thread telemetria; `AiInvocationError` no `detectErrorCode`; modelo das métricas via registry; `model` no resultado.
- `src/lib/visual-signature/ai-image-generator.ts` — `invoke("visual_signature_image")`; furo 4; validator compartilha o invoker.
- `src/lib/ai-cost/cost-estimator.ts` — componente da tool em `campaign_image` E `visual_signature_image`.
- `src/lib/ai/types.ts` / `src/lib/ai/adapters/responses.ts` — `AiInvocationRequest.timeout` aditivo.
- `src/app/api/campaign/generate-image/route.ts` — remove persistência manual de `campaign_image`; delivery markers usam o modelo real.
- `src/lib/campaign/correction-reports.ts` — remove `recordCall`/`onMetrics` manuais; telemetria única.
- `src/app/api/store/[id]/visual-signature/generate-without-logo/route.ts` — remove persistência manual de imagem; buffering cobre imagem + validação.
- Testes co-migrados (6 arquivos) — emissão pelo sink + seam `AiInvoker` + dois envelopes.

## Decisions Made

- **`OpenAIImageProvider` é o orquestrador do fallback:** mantém o contrato `ImageProvider` (seam de testes) e faz a segunda `invoke` explícita, preservando o state machine/retry do `ImageGenerationService`.
- **`timeout` aditivo no contrato do gateway:** único jeito de preservar o `timeout` do `responses.create` do caminho VS sem reter `new OpenAI()`.
- **`MODEL_REGISTRY` como default das métricas diagnósticas:** remove a env-var do pipeline sem hardcode de modelo.
- **`GenerateImageServiceResult.model`:** delivery markers e `generationMetadata` passam a usar o modelo real do envelope.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] `AiInvocationRequest.timeout` + `ResponsesAdapter`**
- **Found during:** Task 3
- **Issue:** o caminho `visual_signature_image` usava `openai.responses.create(..., { signal, timeout })`; o contrato do gateway não carregava `timeout`, o que perderia o timeout na migração.
- **Fix:** campo `timeout?: number` aditivo em `AiInvocationRequest` e repasse no `ResponsesAdapter`.
- **Files modified:** `src/lib/ai/types.ts`, `src/lib/ai/adapters/responses.ts`
- **Verification:** typecheck/lint/build verdes; `ai-image-generator.test.ts` verde.
- **Committed in:** `367267b3` (Task 3)

**2. [Rule 3 - Blocking] Co-migração das suites de rota/VS ao sink único**
- **Found during:** Task 4 (full suite)
- **Issue:** com o canal `onMetricsEvent`/`onCall` removido, os mocks das suites de rota e VS deixavam de capturar `campaign_image`/`visual_signature_image`.
- **Fix:** os mocks passaram a emitir os envelopes pelo `options.telemetry.sink`/`telemetry.sink`; asserts de args atualizados (`onCall` → `undefined`).
- **Files modified:** `route.test.ts`, VS `generate-route.test.ts`, `campaign-generate.test.ts`, `concurrency.test.ts`, `regression-master-switch.test.ts`
- **Verification:** suíte completa 272 files / 2702 testes verde.
- **Committed in:** `d1dca55f` (Task 4)

**3. [Rule 1 - Bug] `imageResult.model` no delivery marker de falha**
- **Found during:** Task 4 (typecheck)
- **Issue:** `GenerateImageServiceResult` de falha não expõe `model`; o acesso direto quebrava o typecheck.
- **Fix:** `imageResult?.success ? imageResult.model ?? "unknown" : "unknown"`.
- **Files modified:** `src/app/api/campaign/generate-image/route.ts`
- **Verification:** typecheck verde.
- **Committed in:** `d1dca55f` (Task 4)

---

**Total deviations:** 3 auto-fixed (1 missing critical, 1 blocking, 1 bug)
**Impact on plan:** Sem scope creep de comportamento. As extensões são aditivas e necessárias para preservar timeout/modelo real; os ajustes de teste refletem o caminho único de persistência (D9).

## Issues Encountered

- Nenhum bloqueio. A suíte completa fechou verde na primeira execução após a co-migração das 6 suites afetadas.

## Reabertura (2026-09-12)

A revisão apontou três ajustes; todos corrigidos:

1. **Usage da Images API (5.5):** o adapter `images` descartava o `usage` retornado pela API. Agora normaliza (`normalizeImagesUsage`: input/output/total + detalhes text/image) quando presente; ausência permanece explícita (`usage` undefined + `providerUsageSource: "images.edit"`), nunca zeros.
2. **Imagem ausente = falha (5.6):** o adapter `responses` retornava sucesso sem imagem quando a tool `image_generation` não produzia arte. Agora lança `AiInvocationError(kind: "capability")` → o gateway emite envelope `failed`.
3. **Dois gatilhos formais do `images.edit` (5.7):** Trigger 1 = retry explícito (`attempt >= 1` + primary); Trigger 2 = erro de capability do Responses (incl. imagem ausente) + primary. Auth/safety/rate-limit nunca acionam. O guard pós-invoke de imagem ausente lança capability (Trigger 2).
4. **Custo da tool Responses sem usage (5.8):** o `cost-estimator` só aplicava o componente da tool quando havia `usage` (branch 3a). Agora aplica o componente por unidade mesmo **sem usage** em `campaign_image`/`visual_signature_image` (`textComponentUsd = 0`, nota `provisional_image_tool_unit_cost_without_text_usage`) — não perde o custo da imagem. Testes para as duas capacidades (com e sem pricing da tool).

**OpenSpec:** `design.md` (D4 + revisão 14) e `specs/ai-image-generation/spec.md` atualizados com os dois gatilhos e a classificação de resposta sem imagem; `specs` cobrem o custo da tool sem usage e a normalização/ausência explícita do usage da Images API.

Testes adicionados: adapter responses sem imagem → capability; adapter images com usage → normalizado; provider sem imagem + primary → fallback (2 invokes); sem imagem sem primary → propaga; safety/rate-limit não acionam; cost-estimator `campaign_image`/`visual_signature_image` sem usage → componente da tool.

Gates re-executados: **272 files / 2710 testes — 0 falhas**; typecheck/lint/build verdes.

## User Setup Required

None - no external service configuration required.

## Threat Flags

Nenhuma nova superfície de segurança introduzida: mesmas imagens/provedor (T-46-05c accept), fallback gated só por capability + primary (T-46-05a mitigado), componente da tool somado nas duas capacidades e fallback sem tool (T-46-05b mitigado), retry/backoff/global-timeout preservados no serviço (T-46-05d mitigado).

## Next Phase Readiness

- **Onda 6 (46-06) desbloqueada:** as 3 capacidades de imagem executam via gateway e a persistência manual de imagem foi eliminada em todos os callers listados; resta o gate global de arquitetura + inventário.
- **Toda a telemetria call-level agora vem do sink único** — a soma híbrida terminou; `callCostSum` é alimentado exclusivamente por `onCostResolved`.
- Sem blockers.

## Self-Check: PASSED

- [x] `openai.ts` chama `invoke("campaign_image")` e `invoke("campaign_image_edit", …, target: "primary")`; sem `IMAGE_GENERATION_RESPONSES_MODEL`/`IMAGE_EDIT_FALLBACK_MODEL`/`GPT_IMAGE_MODEL`/`new OpenAI()`
- [x] `ai-image-generator.ts` chama `invoke("visual_signature_image", …)` com `imageGenerationTool: true` + `generationType: "visual_signature_image"`
- [x] `cost-estimator.ts` soma o componente da tool em `campaign_image` E `visual_signature_image` (grep)
- [x] `generate-image/route.ts`/`correction-reports.ts`/VS route sem persistência manual de `campaign_image`/`visual_signature_image` (grep)
- [x] Teste explícito de DOIS envelopes no fallback (gpt-5.5 falha + gpt-image-2 sucesso)
- [x] Commits `b0ecde10`, `367267b3`, `d1dca55f` existem (`git log`)
- [x] `npx vitest run` (suíte completa) → **272 files / 2710 testes, 0 falhas**
- [x] `npm run typecheck`, `npm run lint`, `npm run build` → verdes

---
*Phase: 46-gateway-unico-de-ia-e-registry-de-modelos*
*Completed: 2026-09-12*
