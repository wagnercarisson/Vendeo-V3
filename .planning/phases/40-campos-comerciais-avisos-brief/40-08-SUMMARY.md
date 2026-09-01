---
phase: 40-campos-comerciais-avisos-brief
plan: 08
subsystem: testing
tags: [route, fixtures, regression, d2, singular]

# Dependency graph
requires:
  - phase: 40-02
    provides: Constante ILLUSTRATIVE_NOTICE_TEXT (valor canônico singular das fixtures)
  - phase: 40-06
    provides: Testes 1-15 + 8.8 (integram a regressão)
  - phase: 40-07
    provides: Testes 16-21 + fixtures image-gen/review co-migradas (integram a regressão)
provides:
  - route.test.ts com 5 fixtures singular→plural co-migradas (10.1)
  - Regressão completa verde: vitest inteiro 1997/1997, typecheck exit 0, lint exit 0 (10.6/10.7)
affects: [40-09 (verificação final)]

# Tech tracking
tech-stack:
  added: []
  patterns: [co-migração de fixtures por grep, regressão completa da fase como gate]

key-files:
  created: []
  modified: [src/app/api/campaign/generate-image/__tests__/route.test.ts]

key-decisions:
  - "Co-migração 5/5 no route.test.ts (530, 775, 785, 796, 807) mantendo o assert do snapshot legalNotice.text (Test #26)"
  - "Testes com asserts negativos not.toContain('Imagens meramente ilustrativas') são intencionais (garantem zero divergência) — não são fixtures divergentes"

patterns-established:
  - "Gate de regressão da fase: npx vitest run + tsc + eslint"

requirements-completed: [F40-02, F40-15, F40-16]

# Metrics
duration: 20min
completed: 2026-08-14
---

# Plan 40-08: Co-migração Route Fixtures + Regressão Completa Summary

**Fixtures do route.test.ts co-migradas de plural para singular (5 ocorrências), Test #26 do snapshot continuando a assertar legalNotice.text com o valor canônico, e regressão completa da fase verde: 1997 testes em 221 arquivos, typecheck e lint sem erros**

## Performance

- **Duration:** 20 min
- **Started:** 2026-08-14T14:45:00Z
- **Completed:** 2026-08-14T15:05:00Z
- **Tasks:** 2
- **Files modified:** 1

## Accomplishments
- Co-migração 5/5 no `route.test.ts`: linhas 530, 775, 785, 796, 807 — `'Imagens meramente ilustrativas'` → `'Imagem meramente ilustrativa'` (via tool edit, preservando encoding)
- Suíte do route test verde: 46/46 (Test #7, #26-28 incluídos)
- Regressão completa: `npx vitest run` → **221 arquivos, 1997 testes passando** (referência F39: 1950 → +47 na F40); `npx tsc -p tsconfig.typecheck.json --noEmit` → exit 0; `npx eslint .` → exit 0
- Grep global em `src/`: as únicas 2 ocorrências de "Imagens meramente ilustrativas" são asserts negativos intencionais (`not.toContain`) nos testes 14/16 — garantem zero divergência, não são fixtures divergentes

## Task Commits

Cada task foi commitada atomicamente:

1. **Task 1: Co-migração de fixtures — route.test.ts (10.1)** - `a6db642` (test)
2. **Task 2: Regressão completa — testes, typecheck e lint (10.6/10.7)** - `a6db642` (test)

**Plan metadata:** `a6db642` (test(40-08))

## Files Created/Modified
- `src/app/api/campaign/generate-image/__tests__/route.test.ts` - 5 fixtures plural→singular; assert do snapshot legalNotice.text (Test #26) mantido com valor singular

## Decisions Made
None - followed plan as specified. A co-migração preserva a estrutura de testes e mocks (valores de fixture apenas).

## Deviations from Plan

Nenhuma - plano executado exatamente como escrito.

## Issues Encountered
None

## User Setup Required
None - sem configuração externa.

## Next Phase Readiness
- Fase íntegra: 1997 testes verdes + typecheck/lint limpos
- Zero fixtures plurais divergentes em src/ (ocorrências restantes são asserts negativos de teste)
- Próximo: 40-09 (verificação final — gates + VERIFICATION.md + UAT humana, checkpoint)

---
*Phase: 40-campos-comerciais-avisos-brief*
*Completed: 2026-08-14*
