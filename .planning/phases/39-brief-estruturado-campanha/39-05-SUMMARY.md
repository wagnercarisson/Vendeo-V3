---
phase: 39-brief-estruturado-campanha
plan: 05
subsystem: pipeline-adapters
tags: [campaign, copy, review, legalNotice, validity, domain]

# Dependency graph
requires:
  - phase: 39-04
    provides: buildCampaignBriefFromFlat + buildCampaignBriefSnapshot + CampaignBrief domain
  - phase: 39-03
    provides: ResolvedCampaignContext rename
provides:
  - mapBriefToCopyDirectorInput lendo do domínio (brief + context) com saída CopyDirectorInput inalterada
  - ImageReviewInput com legalNoticeText (canônico) + validityText
  - Route wired (context + brief na fronteira; copy call site)
affects: [39-06, 39-07]

# Tech tracking
tech-stack:
  added: []
  patterns: [domain-read seam, canonical field rename co-migrated in same plan, gated-by-enabled]

key-files:
  created: []
  modified: [src/lib/copy/mapper.ts, src/lib/copy/__tests__/copy-director-service.test.ts, src/lib/image-generation/services/image-review-service.ts, src/lib/image-generation/services/image-generation-service.ts, src/lib/image-generation/services/__tests__/image-review-service.test.ts, src/lib/image-generation/services/__tests__/image-generation-service.test.ts, src/app/api/campaign/generate-image/route.ts, prompts/campaign-image-reviewer.md]

key-decisions:
  - "mapBriefToCopyDirectorInput(brief: CampaignBrief, context: ResolvedCampaignContext, input) — domínio fornece product/commercial, contexto fornece store/brandProfile (decisão do usuário; divergência resolvida)"
  - "ImageReviewInput usa campo canônico legalNoticeText? (D9/OpenSpec); mandatoryArtworkText permanece apenas no transporte flat"
  - "validityText? aditivo + seção de validade no revisor (gated por enabled, VARS ausentes → seção vazia)"

patterns-established:
  - "Rename de campo canônico co-migrado no mesmo plano (typecheck global limpo ao fim)"
  - "legalNotice NUNCA entra no copy (fronteira copy × arte, D9)"

requirements-completed: [F39-17, F39-18, F39-20]

# Metrics
duration: 45min
completed: 2026-08-13
---

# Plan 39-05: Costuras de Consumo — Copy + Review Summary

**Mapper de copy lendo do domínio (`mapBriefToCopyDirectorInput(brief, context, input)`) com saída `CopyDirectorInput` byte-equivalente e `ImageReviewInput` com campo canônico `legalNoticeText` + `validityText` (gated por enabled) — rota wired no mesmo plano (context + brief na fronteira, call site do copy), suíte completa verde (1945 testes)**

## Performance

- **Duration:** 45 min
- **Started:** 2026-08-13T16:00:00Z
- **Completed:** 2026-08-13T16:45:00Z
- **Tasks:** 2
- **Files modified:** 8

## Accomplishments
- `mapBriefToCopyDirectorInput` agora recebe `(brief: CampaignBrief, context: ResolvedCampaignContext, input)` — lê product/commercial do domínio e store/brandProfile do contexto; `CopyDirectorInput` inalterado; `legalNotice` nunca entra; `validity` sem campo novo no schema
- `ImageReviewInput` renomeado: `mandatoryArtworkText?` → `legalNoticeText?` (canônico D9/OpenSpec) + `validityText?` aditivo; seção `validityTextSection` adicionada ao prompt do revisor (vazia quando ausente — comportamento idêntico)
- 2 call sites da assembly (generateImage:395 e validatePrompts:617) renomeados para `legalNoticeText: body.mandatoryArtworkText` (valor ainda do transporte flat — releitura p/ domínio no 39-06)
- Rota wired: `const context = await buildCampaignBrief(...)` (241→242) + `const brief = buildCampaignBriefFromFlat(parsed.data, parsed.data.storeId)` (243) + `mapBriefToCopyDirectorInput(brief, context, ...)` (582); generateImage/validatePrompts ainda usam `context` (wired p/ domínio no 39-06)
- Testes 8.19 (mapper equivalência) e 8.20 (legalNotice on/off + validityText gated) adicionados; fixtures co-migradas
- Validação: suíte completa 1945/1945 (216 files), `npm run typecheck` (exit 0), `npm run lint` (exit 0)

## Task Commits

1. **Task 1: mapBriefToCopyDirectorInput lê do domínio + wiring da rota + co-migração copy-director-service.test.ts** - `(hash)` (feat, tdd)
2. **Task 2: ImageReviewInput legalNoticeText + validityText + call sites co-migrados + 8.20 gated** - `(hash)` (refactor, test)

## Files Created/Modified
- `src/lib/copy/mapper.ts` - mapBriefToCopyDirectorInput(brief, context, input) lendo do domínio
- `src/lib/copy/__tests__/copy-director-service.test.ts` - Fixtures estruturadas + testes 8.19
- `src/lib/image-generation/services/image-review-service.ts` - ImageReviewInput legalNoticeText + validityText + buildValidityTextSection
- `src/lib/image-generation/services/image-generation-service.ts` - 2 call sites da assembly renomeados
- `src/lib/image-generation/services/__tests__/image-review-service.test.ts` - Literais renomeados + casos 8.20
- `src/lib/image-generation/services/__tests__/image-generation-service.test.ts` - Assert legalNoticeText co-migrado
- `src/app/api/campaign/generate-image/route.ts` - context + brief na fronteira; copy call site com (brief, context)
- `prompts/campaign-image-reviewer.md` - Placeholder {{validityTextSection}} adicionado

## Decisions Made
- Assinatura do mapper com 3 params (brief domínio + context + input overrides) — decisão do usuário (domínio fornece product/commercial; contexto fornece store/brandProfile)
- generateImage/validatePrompts continuam com `context` neste plano (39-05) — wiring para domínio é do 39-06 (plano declara typecheck global limpo ao fim de cada plano)

## Deviations from Plan
Nenhuma funcional; a assinatura do mapper foi ajustada conforme decisão explícita do usuário (Passar brief + context) — ver Issue abaixo.

## Issues Encountered
- **Divergência resolvida com o usuário:** o plano dizia `mapBriefToCopyDirectorInput(brief, input)` recebendo apenas o domínio, mas `CopyDirectorInput` exige storeName/segment (só no `ResolvedCampaignContext`). Solução autorizada: `(brief, context, input)`.
- 2 testes de fixture (image-generation-service.test.ts) ainda assertavam `mandatoryArtworkText` no reviewInput — co-migrados para `legalNoticeText`.

## User Setup Required
None

## Next Phase Readiness
- 39-05 completo — copy e revisor leem o domínio; rota wired (context + brief); typecheck global limpo
- 39-06 re-lê a assembly do review/prompts diretamente do domínio e wire generateImage/validatePrompts com (brief, context)

---
*Phase: 39-brief-estruturado-campanha*
*Completed: 2026-08-13*
