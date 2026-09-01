---
phase: 40-campos-comerciais-avisos-brief
plan: 05
subsystem: ui
tags: [validity-field, form-sections, d8, wiring, design-system]

# Dependency graph
requires:
  - phase: 40-02
    provides: Constante ILLUSTRATIVE_NOTICE_TEXT + checkbox IllustrativeNoticeField
  - phase: 40-04
    provides: Form state com os 6 novos campos + helpers + ValidityMode type
provides:
  - Componente presentacional ValidityField (6 modos, 4 callbacks, sem estado interno)
  - Form reorganizado em 3 seções (Produto / Oferta / Avisos e texto obrigatório) com headers visuais
  - Wiring: MandatoryArtworkField → mandatoryArtworkTextFree, IllustrativeNoticeField → showIllustrativeNotice, ValidityField → 4 campos (só offer)
  - Credits test co-migrado (10.5)
affects: [40-06 (testes 1-15), 40-09 (UAT item 1/3)]

# Tech tracking
tech-stack:
  added: []
  patterns: [componente presentacional puro com callbacks, seções de form com header uppercase tracking-wider]

key-files:
  created: [src/components/campaign/validity-field.tsx]
  modified: [src/components/flow/campaign-input-form.tsx, src/app/(app)/campanhas/nova/__tests__/campaign-flow-credits.test.tsx]

key-decisions:
  - "ValidityField presentacional puro (sem useState, sem formatação) — displayText é responsabilidade dos helpers do hook (D4/D5)"
  - "Seção 'Validade da oferta' renderizada apenas para campaignIntent === 'offer' (D4)"
  - "mandatoryArtworkText da interface PERMANECE (compat/derivado) — este plano muda apenas o wiring"

patterns-established:
  - "Form com 3 seções agrupadas (Produto / Oferta / Avisos e texto obrigatório) — D8"

requirements-completed: [F40-01, F40-05, F40-06, F40-07, F40-09, F40-10, F40-16]

# Metrics
duration: 20min
completed: 2026-08-14
---

# Plan 40-05: ValidityField + Seções do Form Summary

**Componente presentacional ValidityField com 6 modos de validade criado, formulário reorganizado em 3 seções (Produto / Oferta / Avisos e texto obrigatório) com wiring dos novos campos do hook (MandatoryArtworkField → mandatoryArtworkTextFree, IllustrativeNoticeField → showIllustrativeNotice, ValidityField só para offer) e credits test co-migrado**

## Performance

- **Duration:** 20 min
- **Started:** 2026-08-14T13:50:00Z
- **Completed:** 2026-08-14T14:10:00Z
- **Tasks:** 3
- **Files modified:** 3 (1 novo componente, 1 form, 1 teste)

## Accomplishments
- `src/components/campaign/validity-field.tsx` criado — presentacional puro: props `{ mode, startDate, endDate, customText, disabled, onModeChange, onStartDateChange, onEndDateChange, onCustomTextChange }`; select com 6 opções (Nenhuma/Até uma data/De até/Somente hoje/Enquanto durarem os estoques/Texto personalizado); condicionais `type="date"` (until-date: 1, range: 2) e `type="text"` (custom, maxLength 60); texto de ajuda "A data aparece no formato dd/mm na campanha"; **zero `useState`**
- `campaign-input-form.tsx` — 3 headers de seção (`Produto` :291, `Oferta` :331, `Avisos e texto obrigatório` :525); Descrição permanece na seção Produto; ValidityField condicionado a `fields.campaignIntent === "offer"`; IllustrativeNoticeField → `showIllustrativeNotice`; MandatoryArtworkField → `fields.mandatoryArtworkTextFree`/`setField("mandatoryArtworkTextFree", ...)`; campo `mandatoryArtworkText` da interface intacto (compat/derivado)
- `campaign-flow-credits.test.tsx` — mock de fields com os 6 novos campos + mocks `IllustrativeNoticeField: () => null` e `ValidityField: () => null`

## Task Commits

Cada task foi commitada atomicamente:

1. **Task 1: validity-field.tsx — componente presentacional** - `d0dd89c` (feat)
2. **Task 2: campaign-input-form.tsx — seções D8 + wiring** - `d0dd89c` (feat)
3. **Task 3: credits test co-migrado (10.5)** - `d0dd89c` (feat)

**Plan metadata:** `d0dd89c` (feat(40-05))

## Files Created/Modified
- `src/components/campaign/validity-field.tsx` - ValidityField presentacional (6 modos, 4 callbacks)
- `src/components/flow/campaign-input-form.tsx` - 3 seções + wiring dos novos campos
- `src/app/(app)/campanhas/nova/__tests__/campaign-flow-credits.test.tsx` - Mocks co-migrados (6 campos + 2 componentes)

## Decisions Made
None - followed plan as specified (D8/D4/D5). ValidityField permanece presentacional — nenhuma formatação de displayText no componente.

## Deviations from Plan

Nenhuma - plano executado exatamente como escrito.

## Issues Encountered
None

## User Setup Required
None - sem configuração externa.

## Next Phase Readiness
- Form pronto para os testes 1-15 (40-06) e para o UAT (40-09 itens 1/3)
- Verificações: credits test 3/3; typecheck exit 0; grep `fields.mandatoryArtworkText\b` no form → 0 (wiring migrado)

---
*Phase: 40-campos-comerciais-avisos-brief*
*Completed: 2026-08-14*
