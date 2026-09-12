---
phase: 46-gateway-unico-de-ia-e-registry-de-modelos
plan: 03
subsystem: ai
tags: [ai-gateway, text-provider, copy-director, campaign-spec, telemetry, ai-invoker, cost-accumulation]

# Dependency graph
requires:
  - phase: 46-gateway-unico-de-ia-e-registry-de-modelos
    provides: AiGateway/AiInvoker + AiCallEnvelope + AiTelemetryContext/sink + CAPABILITY_GENERATION_TYPE + createDefaultTelemetryContext (46-02, incl. correções de sink ffd90d76)
provides:
  - "campaign_copy via gateway — CopyDirectorService como dono único do invoke, com AiInvoker (seam de teste) e options target/telemetry"
  - "Fallback de texto = rota chamando o serviço de novo com target: 'fallback' (rota não chama invoke; sem conhecer provider)"
  - "campaign_correction_analysis via gateway (sem createTextProvider; persistência pelo sink)"
  - "brand_profile_text via gateway (mock dev + timeout preservados; persistência pelo sink)"
  - "campaign_spec legado via gateway (Structured Outputs + fallback json_object como 2ª invoke explícita, attempt 1→2)"
  - "AiInvoker seam + AiGateway.hasFallback + withOnCallTelemetry (aditivos ao 46-02)"
  - "Testes reais campaign-spec.test.ts e generate/route.test.ts + co-migração das suites de texto"
affects: [46-04, 46-05, 46-06, 46-07, 46-08, 46-09]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Serviço de texto é dono único do invoke; o caller só seleciona o alvo (primary/fallback) e fornece o AiTelemetryContext"
    - "Fallback de modelo = segunda chamada explícita ao serviço com target; o gate usa AiInvoker.hasFallback (sem conhecer provider)"
    - "onCall legado é adaptador fino do envelope já produzido (withOnCallTelemetry), não conduz a telemetria de produção"
    - "Acumulação de custo híbrida: sink via onCostResolved + recordCall residual das capacidades ainda não migradas"
    - "Fachadas OpenAITextProvider/GeminiTextProvider delegam ao gateway e exigem AiTelemetryContext injetado (sem Noop interno)"

key-files:
  created:
    - src/lib/campaign-intelligence/__tests__/campaign-spec.test.ts
    - src/app/api/campaign/generate/__tests__/route.test.ts
  modified:
    - src/lib/ai/gateway.ts
    - src/lib/ai/index.ts
    - src/lib/ai/telemetry-sink.ts
    - src/lib/copy/copy-director-service.ts
    - src/lib/text-provider/openai.ts
    - src/lib/text-provider/gemini.ts
    - src/lib/text-provider/factory.ts
    - src/lib/campaign/correction-intent-service.ts
    - src/lib/brand-assets/text-only-inference-service.ts
    - src/lib/campaign-intelligence/providers/openai.ts
    - src/lib/campaign-intelligence/providers/types.ts
    - src/lib/campaign-intelligence/providers/mock.ts
    - src/lib/campaign-intelligence/service.ts
    - src/app/api/campaign/generate-image/route.ts
    - src/app/api/campaign/[id]/problem-report/route.ts
    - src/app/api/store/[id]/brand-profile/infer/route.ts
    - src/app/api/campaign/generate/route.ts
    - src/lib/copy/__tests__/copy-director-service.test.ts
    - src/lib/text-provider/__tests__/text-provider.test.ts
    - src/__tests__/lib/campaign/correction-intent-service.test.ts
    - src/lib/brand-assets/__tests__/text-only-inference-service.test.ts
    - src/app/api/campaign/generate-image/__tests__/route.test.ts
    - src/app/api/store/[id]/brand-profile/infer/__tests__/route.test.ts
    - src/__tests__/lib/campaign/correction-v2-persistence.test.ts
    - src/__tests__/api/campaign-matrix.test.ts

key-decisions:
  - "AiInvoker seam expõe invoke + hasFallback; o gateway é a implementação padrão (injeção por construtor nos serviços)"
  - "Rota de generate-image seleciona o alvo e chama o serviço 2x (primary → fallback) sem chamar invoke nem conhecer provider"
  - "campaign_spec mantém o fallback json_object no provider, mas como segunda invoke explícita (attemptNumber 1 → 2) só por capability de response_format/json_schema"
  - "Telemetria de campaign_correction_analysis passa a vir do envelope do gateway; a classificação de parsing (json_parse_failed/schema_validation_failed/empty_response) permanece no resultado do serviço"
  - "Soma de custo híbrida preservada (sink + recordCall residual de validação/review/imagem/delivery)"

patterns-established:
  - "Um envelope por tentativa real; o sink é o único ponto de persistência call-level"
  - "createTextProvider fora do caminho produtivo (compat/teste); fachadas exigem AiTelemetryContext"

requirements: [F46-12, F46-13, F46-14, F46-15, F46-16]
requirements-completed: [F46-12, F46-13, F46-14, F46-15, F46-16]

# Metrics
duration: 18min
completed: 2026-09-12
---

# Phase 46 Plan 03: Migração das Capacidades de TEXTO Summary

**As 4 capacidades de texto (`campaign_copy`, `campaign_correction_analysis`, `brand_profile_text`, `campaign_spec` legado) passam a executar via gateway, com `CopyDirectorService` como dono único do `invoke`, fallback por alvo na rota e fallback `json_object` como segunda invoke explícita — 271 arquivos / 2684 testes e 4 gates verdes.**

## Performance

- **Duration:** 18 min
- **Started:** 2026-09-12T17:12:00Z
- **Completed:** 2026-09-12T17:30:00Z
- **Tasks:** 4
- **Files modified:** 25 (2 criados + 23 modificados)

## Accomplishments

- **`campaign_copy` via gateway (dono único):** `CopyDirectorService` recebe um `AiInvoker` (default `defaultAiGateway`), chama `invoke("campaign_copy", …)` e preserva `TextProviderResult`/prompt/parâmetros (`system`/`temperature 0.7`/`maxTokens 1000`/`AbortSignal`). `generateCopy` ganhou `options.target`/`options.telemetry` (aditivos) e `onCall` recebe o envelope já produzido.
- **Fallback de texto pela rota:** `generate-image/route.ts` chama o serviço com `target: "primary"` e, em erro retryable + fallback configurado (`copyDirector.hasFallback()`), com `target: "fallback"` — a rota não chama `invoke` nem conhece provider; zero `TEXT_FALLBACK_PROVIDER`/`createTextProvider`.
- **`createTextProvider` fora do produtivo:** `OpenAITextProvider`/`GeminiTextProvider` viram fachadas que delegam ao gateway e exigem `AiTelemetryContext` injetado (nunca `NoopAiTelemetrySink` interno); `createTextProvider(provider?, telemetry?)` sem leitura de `TEXT_PROVIDER`/`TEXT_FALLBACK_PROVIDER`; removido de `CorrectionIntentService`.
- **`campaign_correction_analysis` e `brand_profile_text`:** ambos via `invoke`; `recordCall` manual removido; `problem-report` e `brand-profile/infer` criam/fornecem o `AiTelemetryContext` (run + sink) — persistência pelo sink (D9). Caminho mock dev e timeout do brand preservados.
- **`campaign_spec` legado:** `OpenAIProvider` chama `invoke("campaign_spec")` preservando Structured Outputs (`json_schema`), a sobreposição de `generation_metadata` e a validação Zod; o fallback `json_object` virou segunda invoke explícita (attempt 1 → 2) só por erro de `capability` de `response_format`/`json_schema`; a rota legada usa `startRun("campaign_delivery")`.
- **Soma de custo híbrida:** `campaign_copy` deixou de gravar `AiCostTracker.record` manual; o custo vem do `onCostResolved` do sink (mesmo `CostResolution`), somado ao `recordCall` residual de validação/review/imagem/delivery.
- **Testes reais:** `campaign-intelligence/__tests__/campaign-spec.test.ts` (Structured Outputs + fallback json_object + auth sem fallback + conteúdo vazio) e `app/api/campaign/generate/__tests__/route.test.ts` (telemetria encaminhada ao provider) — sem `--passWithNoTests`. O teste do `CopyDirectorService` assere **dois envelopes** com gateway/adapter/sink falsos.

## Task Commits

Cada task foi commitada atomicamente:

1. **Task 1: campaign_copy + fachadas + fallback por alvo** — `3e7be175` (feat)
2. **Task 2: campaign_correction_analysis + brand_profile_text** — `03a9f1c4` (feat)
3. **Task 3: campaign_spec legado + fallback json_object + testes reais** — `57ead367` (feat)
4. **Task 4: co-migração de testes de texto + 4 gates** — `5f93fe75` (test)

**Plan metadata:** `_docs de conclusão do plano (SUMMARY + trackings)_`

## Files Created/Modified

- `src/lib/ai/gateway.ts` — `AiInvoker` (invoke + hasFallback) + `AiGateway.hasFallback` (aditivo).
- `src/lib/ai/index.ts` — exporta `AiInvoker` e `withOnCallTelemetry`.
- `src/lib/ai/telemetry-sink.ts` — `withOnCallTelemetry` (adaptador fino do envelope).
- `src/lib/copy/copy-director-service.ts` — dono único de `invoke("campaign_copy")`; options target/telemetry; `hasFallback()`.
- `src/lib/text-provider/{openai,gemini,factory}.ts` — fachadas via gateway; sem SDK/env de modelo.
- `src/lib/campaign/correction-intent-service.ts` — `invoke("campaign_correction_analysis")`; sem `recordCall`.
- `src/lib/brand-assets/text-only-inference-service.ts` — `invoke("brand_profile_text")`; mock dev/timeout preservados.
- `src/lib/campaign-intelligence/providers/{openai,types,mock}.ts` — `campaign_spec` via gateway; `generate(input, telemetry?)`.
- `src/lib/campaign-intelligence/service.ts` — encaminha o `AiTelemetryContext`.
- `src/app/api/campaign/generate-image/route.ts` — copyTelemetry + target primary/fallback; sem recordCall de campaign_copy.
- `src/app/api/campaign/[id]/problem-report/route.ts` — telemetria (run + sink) ao `analyzeReport`.
- `src/app/api/store/[id]/brand-profile/infer/route.ts` — sink injetado; sem resolveAiCost/recordCall manuais.
- `src/app/api/campaign/generate/route.ts` — run `campaign_delivery` + sink ao `service.generate`.
- Testes co-migrados/criados (10 arquivos).

## Decisions Made

- **`AiInvoker` com `hasFallback`:** o seam é `{ invoke, hasFallback }`; permite ao orquestrador aplicar o gate "fallback configurado ≠ primary" (decisão A) sem conhecer o provider. Aditivo ao contrato do 46-02.
- **`onCall` como adaptador do envelope:** `withOnCallTelemetry` repassa o envelope ao `onCall` best-effort sem conduzir a telemetria de produção (D9).
- **`campaign_spec` fallback no provider:** mantido no `OpenAIProvider` (interfaces block), mas como segunda `invoke` explícita — não é retry do SDK.
- **Telemetria da correção vem do envelope:** status/errorType HTTP do gateway; a classificação de parsing permanece no resultado do serviço (json_parse_failed/schema_validation_failed/empty_response). Nota: o `errorType` de parsing deixa de ser persistido como antes (o envelope registra o sucesso HTTP) — consequência direta de D9 e do caminho único de telemetria.
- **`INPUT` do teste de campaign_spec** inclui `campaignIntent` (tipo de saída do schema com default).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] `hasFallback` adicionado ao `AiGateway`/`AiInvoker`**
- **Found during:** Task 1
- **Issue:** a decisão aprovada A exige que a rota acione o fallback apenas "quando houver fallback configurado (≠ primary)" sem conhecer o provider; o gateway não expunha essa informação.
- **Fix:** adicionado `hasFallback(capability)` ao `AiGateway` e ao seam `AiInvoker`; `CopyDirectorService.hasFallback()` delega.
- **Files modified:** `src/lib/ai/gateway.ts`, `src/lib/ai/index.ts`, `src/lib/copy/copy-director-service.ts`
- **Verification:** route.test.ts assere primary→fallback e "sem fallback → 1 chamada"; typecheck/build verdes.
- **Committed in:** `3e7be175` (Task 1)

**2. [Rule 3 - Blocking] `campaign-matrix.test.ts` sem `supabaseAdmin` no mock**
- **Found during:** Task 3 (gate vitest)
- **Issue:** a rota `POST /api/campaign/generate` passou a importar `@/lib/ai` (telemetria) → cost-estimator → ai-model-pricing, que usa `supabaseAdmin` no default do construtor; o mock do teste não o exportava.
- **Fix:** `supabaseAdmin: {}` adicionado ao mock de `@/lib/supabase/server`.
- **Files modified:** `src/__tests__/api/campaign-matrix.test.ts`
- **Verification:** 3 testes verdes.
- **Committed in:** `57ead367` (Task 3)

**3. [Rule 3 - Blocking] `correction-v2-persistence.test.ts` (env + assert 15.7)**
- **Found during:** Task 4 (gate vitest)
- **Issue:** o teste importa o `CorrectionIntentService`, que agora importa `@/lib/ai` → supabase (sem env lança); e o assert 15.7 exigia o literal `"failed"` no serviço, removido com a persistência manual.
- **Fix:** env hoisted para supabase; assert atualizado para `invoke`/ausência de `AiCostTracker` (telemetria pelo envelope).
- **Files modified:** `src/__tests__/lib/campaign/correction-v2-persistence.test.ts`
- **Verification:** 9 testes verdes.
- **Committed in:** `5f93fe75` (Task 4)

**4. [Rule 3 - Blocking] Captura de eventos do sink nos route tests**
- **Found during:** Task 4 (gate vitest)
- **Issue:** com a persistência de `campaign_copy`/`brand_profile_text` no sink padrão (que importa `@/lib/ai-cost/cost-estimator`/`tracker`, não o barrel mockado), as asserções de custo paravam de capturar os eventos.
- **Fix:** mock parcial de `@/lib/ai` (`createDefaultTelemetryContext`) que converte o envelope no `AiCostEvent` usando o `resolveAiCost` mockado; os mocks de serviço passaram a emitir o envelope pelo sink.
- **Files modified:** `src/app/api/campaign/generate-image/__tests__/route.test.ts`, `src/app/api/store/[id]/brand-profile/infer/__tests__/route.test.ts`
- **Verification:** 63 + 6 testes verdes.
- **Committed in:** `5f93fe75` (Task 4)

---

**Total deviations:** 4 auto-fixed (4 blocking)
**Impact on plan:** Todas necessárias para implementar a decisão aprovada A (seam de fallback), manter as suites verdes com o caminho único de telemetria (D9) e o typecheck/build. Sem scope creep de comportamento.

## Issues Encountered

- **Caminho de teste divergente no plano:** a verificação da Task 2 referencia `src/lib/campaign/__tests__/correction-intent-service.test.ts` (inexistente); o teste real é `src/__tests__/lib/campaign/correction-intent-service.test.ts`. Executado o caminho real; co-migrado. Nenhuma mudança de comportamento.
- **Telemetria de parsing da correção:** por D9, o `errorType` de `json_parse_failed`/`schema_validation_failed` deixa de ser persistido no evento (o envelope registra o sucesso HTTP); a classificação permanece no resultado do serviço. Registrado como consequência esperada do caminho único de telemetria.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- **Onda 4 (46-04) desbloqueada:** o seam `AiInvoker`/gateway e o padrão de co-migração de testes (mock parcial de `@/lib/ai` + fake invoker) estão prontos para as capacidades de VISÃO; a persistência manual residual segue apenas em validação/review/imagem/logo/VS.
- **Soma híbrida:** `callCostSum` combina o sink (`onCostResolved`) com o `recordCall` residual; após 46-05 toda a soma virá do sink.
- Sem blockers.

## Self-Check: PASSED

- [x] `src/lib/copy/copy-director-service.ts` chama `invoke("campaign_copy", …)` (dono único)
- [x] `src/lib/campaign-intelligence/__tests__/campaign-spec.test.ts` existe
- [x] `src/app/api/campaign/generate/__tests__/route.test.ts` existe
- [x] Commits `3e7be175`, `03a9f1c4`, `57ead367`, `5f93fe75` existem (`git log`)
- [x] 271 arquivos / 2684 testes verdes; `typecheck`, `lint` e `build` verdes
- [x] Grep: zero `new OpenAI()`/`new GoogleGenerativeAI()` e zero env-var de modelo nos serviços de texto migrados
- [x] Grep: zero `createTextProvider` produtivo; zero `NoopAiTelemetrySink` instanciado fora de testes
- [x] Grep: zero `AiCostTracker.record` manual para `campaign_copy` em `generate-image/route.ts`

---
*Phase: 46-gateway-unico-de-ia-e-registry-de-modelos*
*Completed: 2026-09-12*
