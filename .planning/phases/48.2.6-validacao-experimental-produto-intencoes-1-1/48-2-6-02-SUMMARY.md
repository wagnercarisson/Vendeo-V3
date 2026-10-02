---
phase: 48.2.6-validacao-experimental-produto-intencoes-1-1
plan: 02
subsystem: bench-domain
tags: [intent, price-validation, parity, vitest]
requires:
  - phase: 48.2.6
    provides: Baseline and approved bounded-context boundaries from plan 01
provides:
  - Pure bench intent inference/options authority and compatibility wrappers
  - Shared price-intent validator rejecting isolated original price
  - Tabular matrix coverage and production-helper parity checks
affects: [bench-domain, bench-intent-validation]
tech-stack:
  added: []
  patterns: [pure domain authority with compatibility delegation, derived validation options]
key-files:
  created:
    - src/lib/lab/bench/domain/intent-options.ts
    - src/lib/lab/bench/domain/intent-price-matrix.ts
    - src/lib/lab/bench/domain/__tests__/intent-price-matrix.test.ts
  modified:
    - src/lib/lab/bench/domain/form-rules.ts
    - src/lib/lab/bench/__tests__/form-parity.contract.test.ts
key-decisions:
  - "Keep the intent source inside the bench domain and have form-rules preserve its API through delegation."
  - "Derive available matrix options from the shared helper; only the adapter rejects isolated positive original price."
patterns-established:
  - "Pure shared domain rules can be imported without UI, service, or environment dependencies."
requirements-completed: [lab-bench-intent-validation]
duration: 8min
completed: 2026-10-02
---

# Phase 48.2.6 Plan 02: Bancada — autoridade de intenção e matriz de preços Summary

**Helpers puros de intenção extraídos para a bancada, com opções delegadas e recusa determinística de preço original isolado sem tocar a lógica produtiva.**

## Performance

- **Duration:** 8 min
- **Started:** 2026-10-02T20:28:00Z (approx.)
- **Completed:** 2026-10-02T20:36:00Z (approx.)
- **Tasks:** 2/2
- **Files modified:** 5

## Accomplishments

- Extraídos `inferIntent` e `availableIntents` para `domain/intent-options.ts`; `form-rules.ts` mantém os exports antigos delegando sem dependência circular.
- Criado `intent-price-matrix.ts`, que deriva suas opções da autoridade única e falha com `bench_intent_price_incompatible` para combinação inválida, incluindo preço original positivo sem preço de venda.
- Cobertos estados de preços informados, zero, `null` e `undefined`; contrato de paridade reafirma igualdade dos helpers delegados com o hook produtivo.
- Nenhuma edição em `src/components/flow/**`, rotas, banco, migrations, adapters ou integrações externas.

## Task Commits

1. **Task 1: Extrair autoridade pura e validar matriz** — `f951ebf8` (RED test); `2176f301` (GREEN implementation).
2. **Task 2: Preservar referência de paridade produtiva** — `eae21b39` (test).

## Files Created/Modified

- `src/lib/lab/bench/domain/intent-options.ts` — autoridade pura de inferência/opções.
- `src/lib/lab/bench/domain/intent-price-matrix.ts` — adaptador preço×intenção da bancada.
- `src/lib/lab/bench/domain/form-rules.ts` — exports retrocompatíveis delegados.
- `src/lib/lab/bench/domain/__tests__/intent-price-matrix.test.ts` — casos tabulares da matriz.
- `src/lib/lab/bench/__tests__/form-parity.contract.test.ts` — teste de delegação e paridade produtiva.

## Decisions Made

- Regras extraídas permanecem estritamente no bounded context da bancada. A matriz não enumera uma segunda lista de combinações: deriva opções de `intent-options.ts` e acrescenta somente a recusa do preço original isolado.

## Deviations from Plan

None - plan executed exactly as written.

**Total deviations:** 0. **Impact:** Sem expansão de escopo.

## Verification

- `npm.cmd test -- --run src/lib/lab/bench/domain/__tests__/intent-price-matrix.test.ts` — PASS, 14 testes.
- `npm.cmd test -- --run src/lib/lab/bench/__tests__/form-parity.contract.test.ts src/lib/lab/bench/domain/__tests__/intent-price-matrix.test.ts` — PASS, 2 arquivos / 76 testes.
- `npm.cmd run typecheck` — PASS.
- `git diff --name-only 5fb863e91f42e5daa218f5918f0b78afa31ec0c8..HEAD -- src/components/flow src/app/api/campaign/generate supabase/migrations` — vazio.
- Nenhum provider, leitura remota, geração paga, acesso a banco ou migration executado.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

Ready for Plan 03. A autoridade de domínio está pronta para consumo pelos demais pontos de validação da bancada; nenhuma regra produtiva foi alterada.

## Self-Check: PASSED

- Os cinco arquivos listados existem e os três commits desta execução estão no histórico.
- As verificações focadas e o typecheck passaram; nenhuma fronteira produtiva protegida foi tocada.

---
*Phase: 48.2.6-validacao-experimental-produto-intencoes-1-1*
*Completed: 2026-10-02*
