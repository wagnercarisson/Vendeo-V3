---
phase: 40-campos-comerciais-avisos-brief
plan: 02
subsystem: ui
tags: [constants, checkbox, form, legal-notice, design-system]

# Dependency graph
requires:
  - phase: fase-40-campos-comerciais-avisos-brief
    provides: D2 decision — constante única singular; módulo neutro sem server-only
provides:
  - Constante única `ILLUSTRATIVE_NOTICE_TEXT = "Imagem meramente ilustrativa"` em módulo neutro (`src/lib/campaign/constants.ts`)
  - Checkbox controlado `IllustrativeNoticeField` (props checked/onChange, label via constante)
  - Placeholder do `MandatoryArtworkField` normalizado para o singular via constante (maxLength 200 mantido)
affects: [40-04 (form state), 40-05 (form wiring), 40-06 (teste 14), 40-07 (fixtures), 40-08 (route fixtures)]

# Tech tracking
tech-stack:
  added: []
  patterns: [export-const-with-literal em módulo neutro (analog src/lib/constants.ts), checkbox controlado com label via constante]

key-files:
  created: [src/lib/campaign/constants.ts, src/components/campaign/illustrative-notice-field.tsx]
  modified: [src/components/campaign/mandatory-artwork-field.tsx]

key-decisions:
  - "Constante única singular ILLUSTRATIVE_NOTICE_TEXT em módulo neutro (sem server-only, sem imports do domínio) — D2"
  - "Checkbox controlado sem estado interno; default marcado é responsabilidade do form state (EMPTY_FIELDS, plano 40-04) — D2"

patterns-established:
  - "Constante canônica de texto de aviso importada pelos componentes (nunca literal solto)"

requirements-completed: [F40-01, F40-02]

# Metrics
duration: 15min
completed: 2026-08-14
---

# Plan 40-02: Constante Única + Checkbox Ilustrativo Summary

**Constante única `ILLUSTRATIVE_NOTICE_TEXT = "Imagem meramente ilustrativa"` criada em módulo neutro, checkbox controlado `IllustrativeNoticeField` adicionado e placeholder do textarea normalizado do plural para o singular via constante (D2)**

## Performance

- **Duration:** 15 min
- **Started:** 2026-08-14T12:20:00Z
- **Completed:** 2026-08-14T12:35:00Z
- **Tasks:** 3
- **Files modified:** 3 (1 novo lib, 1 novo componente, 1 modificado)

## Accomplishments
- `src/lib/campaign/constants.ts` criado com único export `ILLUSTRATIVE_NOTICE_TEXT = "Imagem meramente ilustrativa"` — módulo neutro: grep `server-only` → 0, grep `brief` (import de domínio) → 0, sem `"use client"`
- `src/components/campaign/illustrative-notice-field.tsx` criado — checkbox controlado com props `{ checked, onChange }`, label `Exibir 'Imagem meramente ilustrativa'` montado via constante (nunca literal solto), classes do design system do checkbox preserveImageContext (`text-accent-green`, `focus:ring-accent-green/20`)
- `src/components/campaign/mandatory-artwork-field.tsx` — placeholder `"Ex: Imagens meramente ilustrativas"` → `` `Ex: ${ILLUSTRATIVE_NOTICE_TEXT}` ``; `maxLength={200}`, `rows={2}`, classes e estrutura de label intactas; zero plurais no arquivo
- Verificações: `npx vitest run src/lib/campaign/__tests__/brief.test.ts` → 21/21 (sem regressão); `npx tsc -p tsconfig.typecheck.json --noEmit` → exit 0

## Task Commits

Cada task foi commitada atomicamente:

1. **Task 1: constants.ts — constante única ILLUSTRATIVE_NOTICE_TEXT** - `4138439` (feat)
2. **Task 2: illustrative-notice-field.tsx — checkbox controlado** - `4138439` (feat)
3. **Task 3: mandatory-artwork-field.tsx — placeholder normalizado** - `4138439` (feat)

**Plan metadata:** `4138439` (feat(40-02))

## Files Created/Modified
- `src/lib/campaign/constants.ts` - Constante única singular (D2), módulo neutro export-const
- `src/components/campaign/illustrative-notice-field.tsx` - Checkbox controlado com label via constante
- `src/components/campaign/mandatory-artwork-field.tsx` - Placeholder normalizado (plural → singular via constante)

## Decisions Made
None - followed plan as specified (D2). Default marcado não é responsabilidade do componente — definido no form state (EMPTY_FIELDS.showIllustrativeNotice: true, plano 40-04).

## Deviations from Plan

Nenhuma - plano executado exatamente como escrito.

## Issues Encountered
None

## User Setup Required
None - sem configuração externa.

## Next Phase Readiness
- Constante e checkbox prontos para consumo no 40-04 (form state) e 40-05 (form wiring)
- Consumidores mapeados: `illustrative-notice-field.tsx` (label), `mandatory-artwork-field.tsx` (placeholder), `use-campaign-form.ts` (concatenação D3), fixtures (10.2/10.3)
- Próximo: 40-03 (reframe dos 4 prompts do diretor)

---
*Phase: 40-campos-comerciais-avisos-brief*
*Completed: 2026-08-14*
