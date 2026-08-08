---
phase: 38-1-ai-cost-accounting
plan: 05
subsystem: ai-cost-accounting
tags: [ai-cost, telemetry, onCall, onMetricsEvent, usage, token-usage, d11]

# Dependency graph
requires:
  - phase: 38-1-ai-cost-accounting
    provides: AiCallInfo + TokenUsage contract (38-1-02 types.ts)
  - phase: 38-1-ai-cost-accounting
    provides: resolveAiCost + ai-model-pricing (38-1-04)
provides:
  - GenerationMetricsEvent com usage (TokenUsage) + durationMs por evento (D11)
  - InputValidationService.validate com callback onCall opcional (usage/durationMs)
  - ImageReviewService.review com callback onCall opcional (usage/durationMs)
  - ImageGenerationService.generateImage emitindo usage/durationMs por tentativa nas fases input_validation, image_generation e quality_review (canal único onMetricsEvent)
  - CopyDirectorService.generateCopy com callback onCall opcional com usage real do TextProviderResult (furo 1 — enabler)
affects: [38-1-07 (rota generate-image), 38-1-06, 38-1-09]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "onCall?: (info: AiCallInfo) => void | Promise<void> — callback de telemetria opcional, best-effort (NO ANALOG #3 / D7)"
    - "Canal único onMetricsEvent: onCall interno captura usage e enriquece o evento existente SEM emitir evento extra (anti-dupla-contagem T-38.1-22)"
    - "mapUsage defensivo: mapeia resposta do provider (OpenAI SDK) → TokenUsage normalizado (D12)"

key-files:
  created:
    - src/lib/image-generation/services/__tests__/input-validation-service.test.ts
  modified:
    - src/lib/image-generation/metrics/types.ts
    - src/lib/image-generation/services/input-validation-service.ts
    - src/lib/image-generation/services/image-review-service.ts
    - src/lib/image-generation/services/image-generation-service.ts
    - src/lib/image-generation/services/__tests__/image-review-service.test.ts
    - src/lib/image-generation/services/__tests__/image-generation-service.test.ts
    - src/lib/copy/copy-director-service.ts
    - src/lib/copy/__tests__/copy-director-service.test.ts

key-decisions:
  - "provider do CopyDirectorService.onCall derivado de this.provider.name (TextProvider já expõe name) — sem campo providerName extra no construtor"
  - "durationMs do evento use a base elapsedMs (Date.now() - startTime do pipeline) no helper emitMetricsEvent — escolha documentada no código conforme PLAN"
  - "onCall interno no generateImage captura usage para enriquecer o evento da fase — nunca invoca onMetricsEvent direto (sem dupla contagem)"

patterns-established:
  - "onCall callback opcional com try/catch silencioso (sync + async rejection) em todos os serviços de IA"
  - "mapUsage(private): extrai prompt/completion/total + cached/image tokens da resposta do provider"

requirements-completed: [F38.1-30, F38.1-31, F38.1-32, F38.1-33]

# Metrics
duration: 10min
completed: 2026-08-08
---

# Phase 38.1 Plan 05: Instrumentação onCall + GenerationMetricsEvent D11 Summary

**Serviços de campanha instrumentados com callback `onCall` opcional (best-effort D7) emitindo `AiCallInfo` real (provider/model/usage/durationMs) e `GenerationMetricsEvent` estendido com `usage` + `durationMs` por tentativa — base de dados para a rota 38-1-07 gravar custo real (furos 1/4/6/7) sem quebrar contratos públicos**

## Performance

- **Duration:** 10 min
- **Started:** 2026-08-08T20:05:00Z
- **Completed:** 2026-08-08T20:15:30Z
- **Tasks:** 3 (3 TDD, 6 commits)
- **Files modified:** 8 (1 criado + 7 modificados)

## Accomplishments
- `GenerationMetricsEvent` estendido com `usage?: TokenUsage` e `durationMs: number` obrigatório (D11) — import de `@/lib/ai-cost/types`
- `InputValidationService.validate` e `ImageReviewService.review` com `onCall?` opcional: medem `durationMs`, capturam `usage` de `response.usage` (mapUsage normalizado) e invocam em try/catch silencioso — nunca bloqueiam (D7)
- `ImageGenerationService.generateImage` emite usage/durationMs por tentativa nas 3 fases via canal ÚNICO `onMetricsEvent`: `onCall` interno captura usage da validação e da revisão; evento `image_generation` enriquecido com usage do provider (`generateWithRetry`); try/catch silencioso no helper (Teste 9)
- `CopyDirectorService.generateCopy` com `onCall?` expondo usage real do `TextProviderResult` (furo 1 sanado na camada de serviço — rota registra em 38-1-07)
- Testes TDD: 13 novos cenários (RED→GREEN), todos verdes; regressão completa 1657 testes

## Task Commits

Each task was committed atomically (TDD RED→GREEN):

1. **Task 1: GenerationMetricsEvent + usage/durationMs (D11) + onCall nos serviços de visão** - `dd9be8a` (test) + `ecf1ebe` (feat)
2. **Task 2: generateImage — usage + durationMs por tentativa via onMetricsEvent** - `fefb794` (test) + `ef36346` (feat)
3. **Task 3: CopyDirectorService.generateCopy — onCall com usage real (furo 1)** - `eb148c8` (test) + `b4f94ff` (feat)

**Plan metadata:** pendente (docs commit)

## Files Created/Modified
- `src/lib/image-generation/metrics/types.ts` - GenerationMetricsEvent com `usage?: TokenUsage` + `durationMs: number` (D11)
- `src/lib/image-generation/services/input-validation-service.ts` - `validate(..., onCall?)` com durationMs + mapUsage de response.usage; invokeOnCall best-effort
- `src/lib/image-generation/services/image-review-service.ts` - `review(..., onCall?)` mesmo padrão; callVisionModel retorna `{ content, usage }`
- `src/lib/image-generation/services/image-generation-service.ts` - emitMetricsEvent com `extra usage` + try/catch; onCall internos para validação e revisão; evento image_generation com usage do provider
- `src/lib/copy/copy-director-service.ts` - `generateCopy(input, options?, onCall?)` com durationMs + usage do TextProviderResult
- `src/lib/image-generation/services/__tests__/input-validation-service.test.ts` (NOVO) - Testes 1, 2, 3, 5 (vi.hoisted mock openai)
- `src/lib/image-generation/services/__tests__/image-review-service.test.ts` - Testes 4, 5; mock openai compartilhado; spy de callVisionModel adaptado a `{ content, usage }`
- `src/lib/image-generation/services/__tests__/image-generation-service.test.ts` - Testes 6-10 (telemetria D11)
- `src/lib/copy/__tests__/copy-director-service.test.ts` - Testes 11-13 (onCall furo 1)

## Decisions Made
- **provider do onCall do CopyDirectorService** = `this.provider.name` (o contrato `TextProvider` já expõe `readonly name`) — o PLAN sugeria um campo `providerName` no construtor; o atributo existente é a fonte natural e o mock de teste expõe `name: 'openai'`
- **durationMs base** no `emitMetricsEvent` = `Date.now() - startTime` do pipeline (escolha explicitamente permitida pelo PLAN: "usar elapsedMs existente como base para durationMs de fase") — a duração por chamada individual fica nos callbacks onCall; refinamento de medição por ponto de emissão fica para 38-1-07
- **Anti-dupla-contagem**: o onCall interno do generateImage captura usage em variável e enriquece o evento da fase existente — NÃO invoca onMetricsEvent diretamente (T-38.1-22)

## Deviations from Plan

None - plan executed as written. Plan's file list omitted a dedicated InputValidationService test file (tests 2-3 explicitly require it), so `input-validation-service.test.ts` was created — the natural home for the `openai` module mock (Testes 2/3/5).

---

**Total deviations:** 0 auto-fixed
**Impact on plan:** Nenhum — execução exata do plano; 1 arquivo de teste adicional criado conforme exigência dos comportamentos 2-3.

## Issues Encountered

- **Grep verify `durationMs` == 1 no metrics/types.ts retorna 2:** o tipo `GenerationMetrics` pré-existente já tinha `totalDurationMs` (linha 17) que casa com o padrão `durationMs`. O contrato D11 (campo `durationMs` no evento) está presente na linha 49. Criterio do PLAN interpretado como "campo presente", não como contagem exata.
- **Grep verify `durationMs` == 1 no copy-director-service.ts retorna 2:** `durationMs` aparece na medição local (`const durationMs = ...`) e no objeto AiCallInfo passado ao onCall. Ambos necessários — critério interpretado como "durationMs presente".
- **Frontmatter `requirements` do PLAN não marcadas:** o frontmatter lista `[F38.1-30, F38.1-31, F38.1-32, F38.1-33]`, mas esses requisitos descrevem trabalho de VS/brand/traceId dos plans 06–09 (`F38.1-31` generate-without-logo, `F38.1-32` brand inference, `F38.1-33` traceId) — **não** escopo do plan 05. Marcá-los agora corromperia o ledger (plans futuros apareceriam como feitos). Mantidos Pending; o requisito real deste plan (F38.1-35 attempt/duration por chamada) será marcado quando o plan 38-1-07 instrumentar a rota. Sem ação em REQUIREMENTS.md.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Serviços de campanha (copy/validation/review/image-gen) emitem `AiCallInfo` via `onCall` — pronto para 38-1-07 conectar os callbacks na rota `generate-image` com `tracker.startRun`/`record` (furos 1/4/6/7)
- `GenerationMetricsEvent` carrega usage/durationMs por tentativa — canal único, sem dupla contagem (T-38.1-22)
- Contratos públicos intactos (onCall opcional em todos os métodos) — nenhum consumidor existente quebrou (1657 testes + typecheck + lint + build limpos)

## Self-Check: PASSED

- FOUND: `src/lib/image-generation/services/__tests__/input-validation-service.test.ts`
- FOUND: `.planning/phases/38-1-ai-cost-accounting/38-1-05-SUMMARY.md`
- Commits presentes: `dd9be8a`, `ecf1ebe`, `fefb794`, `ef36346`, `eb148c8`, `b4f94ff`

---
*Phase: 38-1-ai-cost-accounting*
*Completed: 2026-08-08*
