---
phase: 39-brief-estruturado-campanha
plan: 07
subsystem: pipeline-adapters
tags: [campaign, route, snapshot, benchmark, versioned]

# Dependency graph
requires:
  - phase: 39-06
    provides: service 100% domínio + rota wired generateImage(brief, context)/validatePrompts(brief, context)
  - phase: 39-05
    provides: copy mapper do domínio + brief na fronteira (buildCampaignBriefFromFlat)
  - phase: 39-04
    provides: buildCampaignBriefSnapshot (builder versionado)
provides:
  - input_snapshot versionado campaign_brief_v1 na rota (substitui snapshot flat manual)
  - route.test.ts co-migrado (tests #26 atualizado)
  - benchmark com build via mapper (cast as any removido)
affects: [39-08]

# Tech tracking
tech-stack:
  added: []
  patterns: [snapshot versionado no input_snapshot, jsonb tolerante sem migration]

key-files:
  created: []
  modified: [src/app/api/campaign/generate-image/route.ts, src/app/api/campaign/generate-image/__tests__/route.test.ts, scripts/benchmark.ts]

key-decisions:
  - "input_snapshot = buildCampaignBriefSnapshot(brief) (versionado, sem base64)"
  - "Benchmark usa buildCampaignBriefFromFlat (payload flat mantido) + contexto ResolvedCampaignContext"

patterns-established:
  - "Snapshot versionado persistido no createCampaign como Record<string, unknown> (jsonb tolerante)"

requirements-completed: [F39-09, F39-19, F39-20]

# Metrics
duration: 30min
completed: 2026-08-13
---

# Plan 39-07: Integração Final na Rota Summary

**`input_snapshot` da rota agora é montado via `buildCampaignBriefSnapshot(brief)` (versionado `campaign_brief_v1`, substituindo o objeto flat manual de 357-380), `route.test.ts` co-migrado (test #26 asserta a estrutura versionada) e `scripts/benchmark.ts` usa `buildCampaignBriefFromFlat` com o cast `as any` removido — suíte completa 1950 testes verdes, typecheck/lint limpos**

## Performance

- **Duration:** 30 min
- **Started:** 2026-08-13T17:00:00Z
- **Completed:** 2026-08-13T17:30:00Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- `route.ts`: bloco flat manual (357-380) substituído por `buildCampaignBriefSnapshot(brief)` (import adicionado); snapshot versionado com schemaVersion no ROOT, seções por domínio, sem base64
- `route.test.ts`: test #26 atualizado para assertar `schemaVersion: 'campaign_brief_v1'` + `commercial.legalNotice` (em vez de `mandatoryArtworkText` top-level)
- `benchmark.ts`: build via `buildCampaignBriefFromFlat` (payload flat mantido, storeId 'benchmark') + contexto `ResolvedCampaignContext`; chamada `generateImage(brief, context)`; cast `as any` removido
- Seams verificados (sem re-wire): `mapBriefToCopyDirectorInput(brief, ...)` (559), `generateImage(brief, ...)` (618), `validatePrompts(brief, ...)` (668)
- Borda sem imagem → 400 preservada (zod do transporte inalterado); orquestração (crédito, rate limit, stream, telemetria, estorno) intocada
- Validação: suíte completa **1950/1950** (216 files), `npm run typecheck` (exit 0), `npm run lint` (exit 0)

## Task Commits

1. **Task 1: Rota — snapshot versionado substituindo o flat manual + co-migração route.test.ts** - `(hash)` (refactor, test)
2. **Task 2: Benchmark — build via mapper + remoção do cast `as any` + compat cenário 10** - `(hash)` (refactor)

## Files Created/Modified
- `src/app/api/campaign/generate-image/route.ts` - inputSnapshot via buildCampaignBriefSnapshot (flat manual removido)
- `src/app/api/campaign/generate-image/__tests__/route.test.ts` - Test #26 asserta snapshot versionado
- `scripts/benchmark.ts` - build via mapper + contexto; as any removido

## Decisions Made
- Snapshot persistido via cast `as unknown as Record<string, unknown>` (jsonb tolerante, sem migration — D6)
- Benchmark monta brief via mapper com `campaignIntent: 'offer'` explícito + cast de tipagem do payload de cenário (esparso)

## Deviations from Plan

None - plan executed exactly as written

## Issues Encountered
- Tipo `CampaignBriefSnapshot` não é `Record<string, unknown>` (sem index signature) — cast explícito mantido (jsonb tolerante, D6)
- `tsc --noEmit scripts/benchmark.ts` standalone reporta erros spurious do tsconfig raiz (module/interop) que existem também em estado limpo (verificado via stash) — o gate autoritativo é o `tsconfig.typecheck.json` (exit 0)

## User Setup Required
None

## Next Phase Readiness
- 39-07 completo — rota opera no domínio estruturado com snapshot versionado; benchmark compat
- 39-08 roda a verificação final (gates + UAT) e produz 39-VERIFICATION.md + 39-UAT.md

---
*Phase: 39-brief-estruturado-campanha*
*Completed: 2026-08-13*
