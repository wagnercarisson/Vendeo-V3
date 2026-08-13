---
phase: 39-brief-estruturado-campanha
plan: 06
subsystem: pipeline-adapters
tags: [campaign, prompt-variables, commercial-repertoire, golden-tests, dataUrl]

# Dependency graph
requires:
  - phase: 39-05
    provides: route wired (context + brief), ImageReviewInput legalNoticeText/validityText
  - phase: 39-04
    provides: buildCampaignBriefFromFlat + CampaignBrief domain
provides:
  - ImageGenerationService 100% domain (no body alias, no string heuristic)
  - media.primary.dataUrl bridge to provider/InputValidation
  - Golden tests per intent (offer/spotlight/exclusive)
affects: [39-07]

# Tech tracking
tech-stack:
  added: []
  patterns: [domain-read seams, validity gated by enabled/displayText, golden key-set regression]

key-files:
  created: []
  modified: [src/lib/image-generation/services/image-generation-service.ts, src/lib/image-generation/services/__tests__/image-generation-service.test.ts, src/app/api/campaign/generate-image/route.ts, src/app/api/campaign/generate-image/__tests__/route.test.ts, src/__tests__/api/campaign-generate.test.ts, scripts/benchmark.ts]

key-decisions:
  - "generateImage(brief: CampaignBrief, context: ResolvedCampaignContext, ...) — domínio + contexto"
  - "buildCommercialRepertoire decide validade por validity.enabled/displayText (sem heurística string)"
  - "Ponte única primaryImageDataUrl(brief) para provider e InputValidationService (F39-16)"

patterns-established:
  - "Conjunto de variáveis de prompt idêntico (38 keys) garantido por golden test (F39-15)"

requirements-completed: [F39-15, F39-16, F39-19, F39-20]

# Metrics
duration: 55min
completed: 2026-08-13
---

# Plan 39-06: Costuras do Serviço de Geração Summary

**`ImageGenerationService` passou a consumir o domínio estruturado em `buildPromptVariables`/`buildCommercialRepertoire`/assembly do `ImageReviewInput`/ponte de imagem (eliminado o alias `body` e a heurística de validade por string), com golden tests por intent garantindo o mesmo conjunto de 38 variáveis — suíte completa 1950 testes verdes, typecheck/lint limpos e rota wired `generateImage(brief, context)`/`validatePrompts(brief, context)`**

## Performance

- **Duration:** 55 min
- **Started:** 2026-08-13T16:30:00Z
- **Completed:** 2026-08-13T17:25:00Z
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments
- `generateImage(brief: CampaignBrief, context: ResolvedCampaignContext, ...)`: elimina `const body = brief.campaignInput as GenerateImageRequest` (95/585) — todas as leituras agora vêm do domínio (product/commercial/media/creativeContext) + contexto (store/identity/brandProfile)
- `buildCommercialRepertoire(brief)`: heurística de validade (`includes("/")`, `até`, `válida`) substituída por `validity?.enabled && displayText && campaignIntent === "offer"` (D8)
- `buildPromptVariables(brief, context, ...)`: 38 variáveis idênticas ao fluxo flat (productName/prices/badge/hook/cta/validity/legalNotice gated/sensitiveConstraints/preserveImageDirective/commercialFrame...)
- Ponte `primaryImageDataUrl(brief)` para provider de imagem e InputValidationService (F39-16); assembly do `ImageReviewInput` lê do domínio com legalNotice/validity gated por enabled (8.20 final)
- `validatePrompts(brief, context)` e assembly do reviewerInput do domínio; rota wired `generateImage(brief, context, ...)` (641) e `validatePrompts(brief, context)` (691)
- Golden tests por intent (8.16 offer/spotlight/exclusive com as 38 keys, 8.17 repertoire por enabled/displayText, 8.18 ponte dataUrl)
- Validação: suíte completa **1950/1950** (216 files), `npm run typecheck` (exit 0), `npm run lint` (exit 0)

## Task Commits

1. **Task 1: buildPromptVariables + buildCommercialRepertoire lendo do domínio (sem heuristic string)** - `(hash)` (refactor, feat, tdd)
2. **Task 2: Ponte media.primary.dataUrl → provider/InputValidation + assembly do reviewInput do domínio** - `(hash)` (refactor, test)

## Files Created/Modified
- `src/lib/image-generation/services/image-generation-service.ts` - 100% domínio (sem body alias, sem heurística string, ponte dataUrl única, reviewInput do domínio)
- `src/lib/image-generation/services/__tests__/image-generation-service.test.ts` - createMinimalBrief estruturado (via mapper) + createContext + golden tests 8.16/8.17/8.18
- `src/app/api/campaign/generate-image/route.ts` - generateImage(brief, context) e validatePrompts(brief, context)
- `src/app/api/campaign/generate-image/__tests__/route.test.ts` - 2 mock implementations com a assinatura nova (6.3)
- `src/__tests__/api/campaign-generate.test.ts` - mock generateImage com (brief, context, onPhaseChange, ...)
- `scripts/benchmark.ts` - cast ajustado para 2 args (build completo via mapper no 39-07)

## Decisions Made
- `generateImage` e `validatePrompts` recebem (brief domínio + context) — padrão estabelecido na decisão do usuário no 39-05
- inputValidationOverride continua lido de `context.campaignInput.inputValidationOverride` (transporte flat no wrapper)
- Golden tests validam o conjunto de 38 keys + valores-chave por intent (F39-15/F39-19)

## Deviations from Plan

None - plan executed exactly as written (benchmark build via mapper fica para 39-07 conforme especificado; apenas ajuste mínimo de arg count no cast para manter typecheck verde)

## Issues Encountered
- Fixture `createMinimalBrief` precisou tipar o spread de Partial<GenerateImageRequest> com cast (campaignIntent default do zod vs Partial com undefined)
- 3 mocks de integração (campaign-generate.test.ts + 2 em route.test.ts) usavam a assinatura antiga de generateImage — co-migrados para (brief, context, onPhaseChange, signal, onMetricsEvent)
- Assert da ponte dataUrl: override é `undefined` (não `anything`) no validate

## User Setup Required
None

## Next Phase Readiness
- 39-06 completo — serviço 100% domínio; rota wired; golden tests verdes; 1950 testes
- 39-07 substitui o snapshot flat manual (route.ts:357-380) por `buildCampaignBriefSnapshot(brief)`, co-migra route.test.ts fixtures e aplica o build via mapper no benchmark

---
*Phase: 39-brief-estruturado-campanha*
*Completed: 2026-08-13*
