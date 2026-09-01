---
phase: 40-campos-comerciais-avisos-brief
plan: 04
subsystem: form
tags: [form-state, helpers, body, d3, d4, restore, sessionStorage]

# Dependency graph
requires:
  - phase: 40-02
    provides: Constante única ILLUSTRATIVE_NOTICE_TEXT (concatenada no body via buildMandatoryArtworkText)
provides:
  - CampaignFormFields com os 6 novos campos comerciais (showIllustrativeNotice default true, mandatoryArtworkTextFree, validityMode/StartDate/EndDate/CustomText) + mandatoryArtworkText mantido como compat/derivado (espelho)
  - Helpers puros exportados formatDDMM, buildValidityDisplayText, buildMandatoryArtworkText + type ValidityMode
  - Body assembly: validade gated por offer, aviso concatenado via helper, endDate ISO nunca enviado
  - Migração de draft legado (mandatoryArtworkText → free) + re-espelho incondicional no restore
affects: [40-05 (wiring do form), 40-06 (testes 1-15), 40-08 (regressão)]

# Tech tracking
tech-stack:
  added: []
  patterns: [helpers puros exportados do hook para testes isolados, espelho bidirecional compat/derivado, concatenação só na montagem do body (D3)]

key-files:
  created: []
  modified: [src/components/flow/use-campaign-form.ts, src/components/flow/__tests__/use-campaign-form-navigation.test.ts]

key-decisions:
  - "mandatoryArtworkText permanece como compat/derivado (espelho de mandatoryArtworkTextFree, nunca concatenado) — D3"
  - "Espelho bidirecional no setField mantém o textarea legado funcionando até o rewire do 40-05"
  - "Migração legada + re-espelho incondicional no restore (free ?? legacyNotice ?? '') cobre drafts de shape antigo e novo"

patterns-established:
  - "Form state preserva campos distintos (checkbox/texto/validade); concatenação apenas no submit (D3)"
  - "Validade só entra no body para offer; troca de intent nunca limpa o rascunho (D4)"

requirements-completed: [F40-03, F40-04, F40-07, F40-08, F40-16]

# Metrics
duration: 25min
completed: 2026-08-14
---

# Plan 40-04: Form State Expandido + Helpers + Body Assembly Summary

**Form state de use-campaign-form.ts expandido com os 6 novos campos comerciais (checkbox default marcado, texto livre, validade em 6 modos), helpers puros exportados (buildMandatoryArtworkText/buildValidityDisplayText/formatDDMM), body com validade gated por offer e aviso concatenado só no submit, migração de draft legado no restore e espelho compat/derivado mantido**

## Performance

- **Duration:** 25 min
- **Started:** 2026-08-14T12:55:00Z
- **Completed:** 2026-08-14T13:20:00Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- `CampaignFormFields` + `FieldErrors` + `EMPTY_FIELDS` + `touched` + `allFields` + `setTouched` de erro com os 6 novos campos (`showIllustrativeNotice: true` default, `mandatoryArtworkTextFree`, `validityMode`, `validityStartDate/EndDate`, `validityCustomText`)
- `mandatoryArtworkText: string` mantido como compat/derivado (comentário D3) — `campaign-input-form.tsx:503-506` continua compilando sem mudança
- Helpers exportados: `formatDDMM` (dd/mm), `buildValidityDisplayText` (6 modos, displayText nu, custom normaliza prefixo "Oferta válida"), `buildMandatoryArtworkText` (4 combinações, usa ILLUSTRATIVE_NOTICE_TEXT) + `export type ValidityMode`
- Body assembly: `validity` chamada gated por `campaignIntent === "offer"`; `mandatoryArtworkText` via helper (nunca do estado); spreads condicionais `...(x !== undefined ? { x } : {})`; endDate ISO nunca no body
- Restore: migração legada (`mandatoryArtworkText` → `mandatoryArtworkTextFree` + espelho) + re-espelho incondicional (`rest.mandatoryArtworkTextFree ?? legacyNotice ?? ""`) cobrindo drafts de shape antigo e novo (autosave F40)
- `setField`: espelho bidirecional `mandatoryArtworkText` ↔ `mandatoryArtworkTextFree`
- Intent switch: NENHUMA alteração — validade preservada ao trocar intenção (D4)
- Nav test: 3 mocks co-migrados com os 6 novos campos + 2 novos testes de restore (migração legada e shape novo com espelho)

## Task Commits

Cada task foi commitada atomicamente:

1. **Task 1: Form state expandido + helpers exportados + migração de draft legado** - `d23d0a8` (feat)
2. **Task 2: Body assembly + co-migração dos testes de navegação** - `d23d0a8` (feat)

**Plan metadata:** `d23d0a8` (feat(40-04))

## Files Created/Modified
- `src/components/flow/use-campaign-form.ts` - State + helpers + body + restore (Task 1/2)
- `src/components/flow/__tests__/use-campaign-form-navigation.test.ts` - 3 mocks co-migrados + 2 testes de restore

## Decisions Made
None - followed plan as specified (D3/D4). O contrato de helpers do bloco <interfaces> foi implementado exatamente (switch dos 6 modos, normalização `^Oferta válida[:\s-]*`, concatenação com `\n`).

## Deviations from Plan

Nenhuma - plano executado exatamente como escrito.

## Issues Encountered
None

## User Setup Required
None - sem configuração externa.

## Next Phase Readiness
- Helpers e body prontos para os testes 1-15 (40-06) e para o wiring do form (40-05: ValidityField + seções D8)
- Verificações: `npx vitest run src/components/flow/__tests__/use-campaign-form-navigation.test.ts` → 5/5; `npx tsc -p tsconfig.typecheck.json --noEmit` → exit 0

---
*Phase: 40-campos-comerciais-avisos-brief*
*Completed: 2026-08-14*
