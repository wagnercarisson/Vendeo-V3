---
phase: 48.2.1-otimizacao-prompts-diretor
plan: 48-2-1-08
subsystem: lab
tags: [lab, budget, archive, experiment, patch, admin-api, admin-ui, vitest]

# Dependency graph
requires:
  - phase: 48.2.1-otimizacao-prompts-diretor
    provides: 48-2-1-07 — reserva fail-closed por `status='authorized'`, `closed` terminal, histórico financeiro preservado
provides:
  - Detalhe do experimento com orçamento completo do programa (autorizado/reservado/consumido/saldo)
  - `BudgetPanel` integrado à tela de detalhe (deixa de ser órfão)
  - `programRemainingUsd` propagado ao `RunExecutionPanel` (Gap B corrigido)
  - `archiveExperiment` no domínio + `PATCH /api/admin/laboratorio/experiments/[id]` (terminal, histórico preservado)
  - Ação de UI "Arquivar experimento" com confirmação humana e estados desabilitados de `archived`
affects: [48-2-1-09]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Leitura de orçamento do programa devolve autorizado/reservado/consumido/saldo numa única leitura (`remainingUsd` = budget − consumed − reserved)"
    - "Transição terminal exposta por PATCH com schema `.strict()` literal e mapeamento 400/404/409"
    - "Ação destrutiva de UI reutiliza `ConfirmDialog` local (nenhum PATCH antes da confirmação humana)"

key-files:
  created:
    - src/app/(app)/admin/laboratorio/_components/experiment-archive-button.tsx
  modified:
    - src/lib/lab/api/experiment-queries.ts
    - src/app/(app)/admin/laboratorio/experimentos/[id]/page.tsx
    - src/lib/lab/domain/experiment-service.ts
    - src/lib/admin/schemas.ts
    - src/app/api/admin/laboratorio/experiments/[id]/route.ts
    - src/lib/lab/api/__tests__/experiment-queries.test.ts
    - src/lib/lab/domain/__tests__/experiment-service.test.ts
    - src/lib/lab/domain/__tests__/lab-experiments.contract.test.ts
    - src/app/api/admin/laboratorio/__tests__/lab-admin-api.contract.test.ts
    - src/app/(app)/admin/laboratorio/_components/__tests__/lab-admin-ui.contract.test.tsx
    - src/app/(app)/admin/laboratorio/_components/__tests__/run-execution-panel.test.tsx

key-decisions:
  - "Saldo do programa mantém a definição única `budget_usd - budget_consumed_usd - budget_reserved_usd`; sem programa → `programBudgetUsd`/`programRemainingUsd` nulos e reservado/consumido zerados (nunca valores inventados)"
  - "`archiveExperiment` delega a `transitionExperiment(experimentId, 'archived', ...)` — `archived` é terminal e nenhuma variante/cenário/run/avaliação é removido"
  - "`LabExperimentArchiveRequestSchema` aceita apenas `{ status: 'archived' }` (`.strict()`), tornando o arquivamento explícito e não ambíguo"

patterns-established:
  - "BudgetPanel integrado ao detalhe + `data-testid='lab-program-balance'` no painel de execução como superfície de saldo"
  - "PATCH de arquivamento: requireAdmin + assertLabEnvironment + schema literal; 404 `experiment_not_found`, 409 `invalid_transition`, 400 `invalid_payload`"

requirements-completed: [lab-admin-api, lab-admin-ui, lab-experiments, lab-prompt-optimization]

# Metrics
duration: 5min
completed: 2026-09-27
---

# Phase 48.2.1 Plan 08: Orçamento visível e arquivamento seguro Summary

**Detalhe do experimento passa a exibir o orçamento completo do programa (autorizado/reservado/consumido/saldo) com o `BudgetPanel` integrado e o saldo propagado ao painel de execução, e ganha o caminho administrativo seguro de arquivamento (`PATCH` terminal + botão com confirmação) que preserva o histórico.**

## Performance

- **Duration:** 5 min
- **Started:** 2026-09-27T00:20:39Z
- **Completed:** 2026-09-27T00:26:10Z
- **Tasks:** 3
- **Files modified:** 12 (1 criado, 11 modificados)

## Accomplishments
- `LabExperimentDetail.budget` agora expõe `programBudgetUsd`, `programReservedUsd`, `programConsumedUsd` e `programRemainingUsd` (C5/C6), sem expor conteúdo de cenário/base64.
- `BudgetPanel` foi integrado à tela de detalhe (deixou de ser órfão) e `programRemainingUsd` passou a ser propagado ao `RunExecutionPanel` (corrige o Gap B — a linha de saldo e o bloqueio client-side passam a renderizar).
- `archiveExperiment` (domínio) + `PATCH /api/admin/laboratorio/experiments/[id]` implementam o arquivamento terminal e seguro (C7): payload `{ status: "archived" }`, 400/404/409, histórico preservado (zero deletes).
- `ExperimentArchiveButton` oferece "Arquivar experimento" com confirmação humana obrigatória (nenhum `PATCH` antes de confirmar) e estado desabilitado "Arquivado"; `experimentStatus="archived"` desabilita "Executar run" com "Experimento arquivado não executa."

## Task Commits

Each task was committed atomically:

1. **Task 1: Orçamento completo no detalhe e integração do painel (C5/C6)** - `03663504` (feat)
2. **Task 2: Arquivamento seguro — domínio e API (C7)** - `f423188f` (feat)
3. **Task 3: Ação de UI "Arquivar experimento" e estados desabilitados (C7)** - `4415e8ef` (feat)

**Plan metadata:** committed with this SUMMARY (docs: complete plan).

## Files Created/Modified
- `src/lib/lab/api/experiment-queries.ts` — orçamento completo do programa no detalhe (`programBudgetUsd`/`programReservedUsd`/`programConsumedUsd`/`programRemainingUsd`)
- `src/app/(app)/admin/laboratorio/experimentos/[id]/page.tsx` — `BudgetPanel` integrado, `programRemainingUsd` propagado e botão de arquivamento no cabeçalho
- `src/lib/lab/domain/experiment-service.ts` — `archiveExperiment` (transição terminal via `transitionExperiment`)
- `src/lib/admin/schemas.ts` — `LabExperimentArchiveRequestSchema` (`{ status: "archived" }`, `.strict()`)
- `src/app/api/admin/laboratorio/experiments/[id]/route.ts` — `PATCH` de arquivamento seguro
- `src/app/(app)/admin/laboratorio/_components/experiment-archive-button.tsx` — ação "Arquivar experimento" com confirmação e estado desabilitado
- `src/lib/lab/api/__tests__/experiment-queries.test.ts` — asserções dos quatro campos de orçamento + caso sem programa
- `src/lib/lab/domain/__tests__/experiment-service.test.ts` — testes de `archiveExperiment` (terminal, histórico preservado)
- `src/lib/lab/domain/__tests__/lab-experiments.contract.test.ts` — contrato de arquivamento (zero deletes)
- `src/app/api/admin/laboratorio/__tests__/lab-admin-api.contract.test.ts` — `PATCH` (200/400/404/409), orçamento completo no GET e reserva recusada em `archived`
- `src/app/(app)/admin/laboratorio/_components/__tests__/lab-admin-ui.contract.test.tsx` — `BudgetPanel`/saldo no detalhe + confirmação de arquivamento
- `src/app/(app)/admin/laboratorio/_components/__tests__/run-execution-panel.test.tsx` — bloqueio de execução com `archived`

## Decisions Made
- Saldo do programa mantém a fonte única `budget_usd - budget_consumed_usd - budget_reserved_usd`; sem programa, os valores de orçamento ficam nulos/zerados (nenhum valor inventado).
- `archiveExperiment` reutiliza a máquina de estados existente (`assertTransitionAllowed`); `archived` é terminal e o arquivamento altera apenas `status`/`updated_at`.
- O `PATCH` exige `requireAdmin` + `assertLabEnvironment` e aceita exclusivamente `{ status: "archived" }`.

## Deviations from Plan

None - plan executed exactly as written.

_(Operational note: `npm` resolves to a non-executable shim in this PowerShell pipeline; commands were run as `npm.cmd`, which is the same runner. No semantic change.)_

## Issues Encountered
- None. The only operational adjustment was invoking the package runner as `npm.cmd` on Windows PowerShell (the bare `npm` shim cannot be invoked in a pipeline here); this is equivalent to `npm test`/`npm run typecheck`.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- C5–C7 (orçamento visível/integrado e arquivamento seguro) cobertos; prontos para o Plano 09 (verificação e encerramento operacional).
- Estado local inalterado e verificado (leitura): programa `860ca4fe-dc8b-4354-b94e-02f9e7b202c6` segue `authorized` (budget 2.808, reserved 0, consumed 0); experimento `c48e21b5-c7a8-4456-a0d6-a2b4040fc1e3` segue `ready`; `lab_runs` = 0.
- Zero execuções, zero chamadas pagas, zero reserva/consumo de orçamento; `prompts/` intocado; nenhum `db push` remoto; nenhuma dependência nova.
- **Não** iniciar o Plano 09 neste passo; não arquivar o experimento local atual nem encerrar o programa local (ações do Plano 09).

## Self-Check: PASSED

- Created file exists: `src/app/(app)/admin/laboratorio/_components/experiment-archive-button.tsx` — FOUND
- Commits exist: `03663504`, `f423188f`, `4415e8ef` — FOUND
- Plan tests: 216 passed (6 files); `npm.cmd run typecheck` exit 0
- `git status --porcelain prompts/` empty

---
*Phase: 48.2.1-otimizacao-prompts-diretor*
*Completed: 2026-09-27*
