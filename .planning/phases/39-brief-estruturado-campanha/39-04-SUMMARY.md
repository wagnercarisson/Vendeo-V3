---
phase: 39-brief-estruturado-campanha
plan: 04
subsystem: domain-contract
tags: [campaign, mapper, snapshot, round-trip, base64]

# Dependency graph
requires:
  - phase: 39-02
    provides: CampaignBrief domain types + brief-schema
  - phase: 39-03
    provides: CampaignBriefSnapshot alias + ResolvedCampaignContext rename
provides:
  - buildCampaignBriefFromFlat (pure flat→domain mapper, D5)
  - buildCampaignBriefSnapshot (pure versioned snapshot builder, D6/D11)
  - Round-trip + no-base64 contract tests (8.7-8.14)
affects: [39-05, 39-06, 39-07]

# Tech tracking
tech-stack:
  added: []
  patterns: [pure mapper function, immutable-by-construction snapshot builder, recursive key-scan test]

key-files:
  created: [src/lib/campaign/__tests__/brief-mapper.test.ts, src/lib/campaign/__tests__/brief-snapshot.test.ts]
  modified: [src/lib/campaign/brief.ts]

key-decisions:
  - "Absence rule enforced by conditional spreads (key truly absent, not undefined) — D8/D9"
  - "offer preserveImageContext normalization ported from route.ts:376-378 into the mapper"

patterns-established:
  - "Recursive no-base64 scan (dataUrl/base64/data:image/) — novel test pattern in repo (D12)"

requirements-completed: [F39-09, F39-11, F39-12, F39-13, F39-14, F39-20]

# Metrics
duration: 30min
completed: 2026-08-13
---

# Plan 39-04: Mapper + Snapshot Builder Summary

**Mapper puro `buildCampaignBriefFromFlat` (flat→domínio, D5) e builder versionado `buildCampaignBriefSnapshot` (domínio→snapshot sem base64, D6/D11) implementados em `src/lib/campaign/brief.ts`, com 21 testes de round-trip e varredura recursiva sem base64 — gates vitest/typecheck/lint verdes**

## Performance

- **Duration:** 30 min
- **Started:** 2026-08-13T16:05:00Z
- **Completed:** 2026-08-13T16:35:00Z
- **Tasks:** 3
- **Files modified:** 3

## Accomplishments
- `buildCampaignBriefFromFlat(input, storeId, source)` — função pura: mapeia product/commercial/media/creativeContext/metadata; portada a regra canônica `preserveImageContext` offer→false (route.ts:376-378) e mimeType image/jpeg; regra de ausência por spreads condicionais (chave ausente, nunca `{enabled:false}` fabricado)
- `buildCampaignBriefSnapshot(brief)` — deriva imagens do próprio brief, remove dataUrl, schemaVersion no ROOT, metadata sem schemaVersion, imutável por construção (D6/D11)
- `brief-mapper.test.ts` (14 testes): round-trip flat→brief→snapshot, lar canônico dos adormecidos, compat payload benchmark (8.14 detalhes-variados), regra de ausência, PÓS-CONDIÇÃO safeParse
- `brief-snapshot.test.ts` (7 testes): shape EXATO CampaignBriefSnapshotImage, varredura recursiva `hasBase64Leak` (8.12), imutabilidade (8.13)
- Validação: `npx vitest run src/lib/campaign/__tests__/` (42/42), `npm run typecheck` (exit 0), `npm run lint` (exit 0)

## Task Commits

1. **Task 1: buildCampaignBriefFromFlat — mapper puro flat→domínio** - `(hash)` (feat, tdd)
2. **Task 2: buildCampaignBriefSnapshot — builder versionado sem base64** - `(hash)` (feat, tdd)
3. **Task 3: Compat payload benchmark → mesmo brief equivalente (8.14)** - `(hash)` (test)

## Files Created/Modified
- `src/lib/campaign/brief.ts` - Adicionados buildCampaignBriefFromFlat (mapper puro) e buildCampaignBriefSnapshot (builder versionado)
- `src/lib/campaign/__tests__/brief-mapper.test.ts` - 14 testes de round-trip + compat benchmark + ausência
- `src/lib/campaign/__tests__/brief-snapshot.test.ts` - 7 testes: shape snapshot, varredura recursiva sem base64, imutabilidade

## Decisions Made
- Regra de ausência implementada com spreads condicionais (`...(validity ? { validity } : {})`) para a chave ficar **verdadeiramente ausente** — não apenas `undefined`
- `spotlight` sem preserveImageContext → `false` (via `input.preserveImageContext ?? false`), conforme regra canônica portada

## Deviations from Plan

None - plan executed exactly as written

## Issues Encountered
- Ajuste de fixture: `flatInput` com `preserveImageContext: true` por padrão fez o teste "spotlight sem preserve" receber `true`; corrigido passando `preserveImageContext: undefined` explicitamente (lógica do mapper inalterada)

## User Setup Required
None

## Next Phase Readiness
- 39-04 completo — mapper + builder puros prontos para as costuras de consumo (copy/review 39-05, prompts 39-06) e rota (39-07)
- Sem migration; gates verdes; 42 testes de contrato no domínio

---
*Phase: 39-brief-estruturado-campanha*
*Completed: 2026-08-13*
