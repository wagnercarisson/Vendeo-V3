---
phase: 49-ativacao-orientacao-contextual-campos
plan: 11
subsystem: testing
tags: [co-migracao, store-identity, f49, vitest, nao-mudanca]

# Dependency graph
requires:
  - phase: 49-ativacao-orientacao-contextual-campos
    provides: 49-04 apresentação/microcopy da loja (labels preservados; placeholder de Posicionamento e hints alterados)
provides:
  - Auditoria das seis suites de teste da loja: nenhuma asserção consulta strings alteradas pelo 49-04; co-migração dispensada (zero alterações) e suíte verde preservada
affects: [49-12, 49-13]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Co-migração condicional (D15): alterar apenas asserções que consultam labels/placeholders/microcopy alterados; ausência de asserções afetadas ⇒ nenhuma edição"

key-files:
  created: []
  modified: []

key-decisions:
  - "Nenhuma das seis suites da loja consulta labels/placeholders/microcopy alterados pelo 49-04; co-migração dispensada (zero alterações) com a suíte já verde"
  - "Nenhum arquivo de produção da loja foi tocado (tabs.ts, reason-text.ts, draft-store.ts intactos)"

patterns-established:
  - "Verificação de co-migração por auditoria de queries (grep) + execução da suíte verde antes de qualquer edição"

requirements-completed: [store-identity-ui]

# Metrics
duration: 3 min
completed: 2026-09-18
---

# Phase 49 Plan 11: Co-migração de Asserções da Loja Summary

**Auditoria das seis suites da loja: nenhuma asserção consulta strings alteradas pelo 49-04 — co-migração dispensada com zero alterações e 6 arquivos / 73 testes verdes**

## Performance

- **Duration:** 3 min
- **Started:** 2026-09-18T17:11:00Z
- **Completed:** 2026-09-18T17:14:00Z
- **Tasks:** 1
- **Files modified:** 0

## Accomplishments
- Auditadas as seis suites da loja (`aceite-legal`, `drift-tabs`, `drift`, `redirect-messages`, `store-page-client`, `store-tabs`) contra o diff de produção do 49-04.
- Confirmado que as asserções consultam **apenas** strings preservadas (`Nome da Loja`, `^Segmento`, papéis/labels de abas `Dados`/`Posicionamento`/`Direção Visual`, headings de aba, botões de drift/redirect, fixtures de dados) — as strings alteradas (label/placeholder de Posicionamento, `(opcional)` do Slogan, hints do Tom de Voz) **não** são consultadas.
- Suíte verde sem qualquer edição: 6 arquivos / 73 testes aprovados.
- Fences preservadas: `tabs.ts`, `reason-text.ts` e `draft-store.ts` não modificados; nenhum arquivo de produção alterado.

## Task Commits

Each task was committed atomically:

1. **Task 1: Co-migrar asserções da loja** — verificação-only; **nenhuma alteração de arquivo** (co-migração dispensada). Evidência no commit de metadados deste plano.

**Plan metadata:** commit de docs deste plano (SUMMARY + STATE/ROADMAP + OpenSpec tasks.md).

_Note: a co-migração da campanha/revisão ficou no 49-10; a regressão e o diff contra o baseline ficam no 49-12._

## Files Created/Modified
- Nenhum arquivo de teste ou produção foi criado/modificado neste plano (Task 1 verificação-only).

## Decisions Made
- Co-migração **não necessária**: as seis suites consultam somente strings preservadas pelo 49-04. Nenhuma edição foi feita para não introduzir mudanças sem co-migração real (respeita T-49-02 e o fence de não-mudança).
- Mantida a exigência de investigar antes de ajustar: `store-tabs.test.tsx` e `store-page-client.test.tsx` seguem intactos (nenhum caso removido, nenhuma asserção afrouxada).

## Deviations from Plan

### Auto-fixed Issues

Nenhuma.

### Observação de execução (não-bloqueante)

**1. [Sem regra — premissa do plano não se confirmou] Co-migração dispensada (zero alterações)**
- **Found during:** Task 1 (auditoria das seis suites)
- **Issue:** o plano previa possíveis ajustes de asserções ao placeholder de Posicionamento e a labels alterados; a auditoria (grep + execução) mostrou que nenhuma asserção das seis suites consulta strings alteradas.
- **Fix:** nenhuma edição; acceptance criteria satisfeitos com a suíte já verde.
- **Files modified:** nenhum
- **Verification:** comando de aceitação executado com 6 arquivos / 73 testes verdes.
- **Committed in:** commit de metadados do plano (não houve commit de teste por não haver mudança).

---

**Total deviations:** 0 auto-fixed.
**Impact on plan:** Nenhum. A co-migração é condicional por D15; a ausência de asserções afetadas dispensa alterações.

## Issues Encountered
None.

## Verification Evidence
- `npx vitest run src/components/flow/__tests__/store-identity-form.aceite-legal.test.tsx src/components/flow/__tests__/store-identity-form.drift-tabs.test.ts src/components/flow/__tests__/store-identity-form.drift.test.ts src/components/flow/__tests__/store-identity-form.redirect-messages.test.ts src/components/flow/__tests__/store-page-client.test.tsx src/components/flow/__tests__/store-tabs.test.tsx` → **Test Files 6 passed (6) / Tests 73 passed (73)** (nota benigna: `Not implemented: navigation to another Document`).
- `git status --short` → apenas o arquivo pré-existente não rastreado `docs/alinhamento-fase-44-temas-de-campanhas` (preservado, não tocado); nenhuma alteração nos seis testes ou em produção.
- `git diff --name-only` de `src/lib/store-onboarding/tabs.ts`, `src/lib/store-onboarding/reason-text.ts`, `src/lib/store-onboarding/draft-store.ts` → vazio (intocados).

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Suites da loja válidas e verdes; pronto para **49-12** (regressão, 4 gates e prova final de não-mudança).
- Sem blockers.

## Self-Check: PASSED

- [x] Task 1 executada (verificação-only, zero alterações)
- [x] Acceptance criteria verdes (6 arquivos / 73 testes)
- [x] Nenhum arquivo de produção modificado
- [x] Arquivo pré-existente não rastreado preservado

---
*Phase: 49-ativacao-orientacao-contextual-campos*
*Completed: 2026-09-18*
