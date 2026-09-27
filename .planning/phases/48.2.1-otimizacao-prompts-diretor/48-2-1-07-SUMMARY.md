---
phase: 48.2.1-otimizacao-prompts-diretor
plan: 48-2-1-07
subsystem: lab
tags: [supabase, migration, fail-closed, budget, revocation, api, ui, vitest]

# Dependency graph
requires:
  - phase: 48.2.1
    provides: 48-2-1-05 (API/UI de programas, orçamento e isolamento do laboratório)
provides:
  - "lab_reserve_run fail-closed: somente status='authorized' reserva, antes de qualquer chamada paga"
  - "closed terminal no serviço (closeProgram, authorizeProgramBudget, updateProgram) e no banco (trigger)"
  - "histórico financeiro preservado no encerramento"
  - "PUT /programs/[id] com close:true e UI 'Encerrar programa / revogar autorização' com confirmação humana"
affects: [48-2-1-08, 48-2-1-09]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Guarda fail-closed por status sob lock FOR UPDATE antes de qualquer débito"
    - "Trigger BEFORE UPDATE de terminalidade (closed -> * recusado) no banco"
    - "Erro tipado program_closed mapeado para HTTP 409"

key-files:
  created:
    - src/lib/lab/domain/__tests__/program-service.test.ts
    - supabase/migrations/20260926000001_f48_2_1_lab_fail_closed_closure.sql
    - src/app/(app)/admin/laboratorio/_components/program-close-button.tsx
  modified:
    - src/lib/lab/domain/program-service.ts
    - src/lib/lab/__tests__/lab-isolation.contract.test.ts
    - src/lib/lab/__tests__/lab-financial-safety.contract.test.ts
    - src/lib/admin/schemas.ts
    - src/app/api/admin/laboratorio/programs/[id]/route.ts
    - src/app/api/admin/laboratorio/__tests__/lab-admin-api.contract.test.ts
    - src/app/(app)/admin/laboratorio/programas/page.tsx
    - src/app/(app)/admin/laboratorio/_components/__tests__/lab-admin-ui.contract.test.tsx

key-decisions:
  - "closed é terminal em três camadas: serviço (program_closed), rota (409) e banco (trigger BEFORE UPDATE)"
  - "Encerrar nunca autoriza: close:true + budgetUsd no mesmo payload é recusado com 400 invalid_payload"
  - "Migration local-first aplicada via 'npx supabase migration up' preservando os registros locais (sem db reset/db push)"

patterns-established:
  - "Fail-closed financeiro: guarda de status sob lock antes de débito/inserção de run"
  - "Ação destrutiva de UI reutiliza confirm-dialog (confirmação humana obrigatória)"

requirements-completed: [lab-isolation, lab-runs, lab-admin-api, lab-admin-ui, lab-prompt-optimization]

# Metrics
duration: 7min
completed: 2026-09-26
---

# Phase 48.2.1 Plan 48-2-1-07: Segurança financeira e revogação fail-closed Summary

**Reserva de run fail-closed exigindo `status='authorized'`, encerramento terminal de programa com histórico financeiro preservado (serviço + trigger no banco) e ação de UI "Encerrar programa / revogar autorização" com confirmação humana**

## Performance

- **Duration:** 7 min
- **Started:** 2026-09-26T21:02:22Z
- **Completed:** 2026-09-26T21:09:06Z
- **Tasks:** 3
- **Files modified:** 11 (3 criados, 8 modificados)

## Accomplishments

- `lab_reserve_run` passa a exigir `v_program.status = 'authorized'` sob `FOR UPDATE`, ANTES de qualquer débito de orçamento ou inserção de run — nenhuma chamada paga inicia com `draft`/`closed` (C1/C2).
- `closed` é terminal e efetivo: `closeProgram` (idempotente) encerra preservando `budget_usd`/`reserved`/`consumed`/autor/timestamp; `authorizeProgramBudget` recusa reautorização (`program_closed`); `updateProgram` recusa `closed → draft/authorized`; trigger `trg_lab_prompt_programs_terminal` reforça a terminalidade no banco (C3).
- Controle administrativo de encerramento: `PUT /programs/[id]` com `close: true` (ou `status: 'closed'`) chama `closeProgram`, mapeia `program_closed` → 409 e recusa `close` + `budgetUsd` com 400; a UI oferece o botão destrutivo com `ConfirmDialog` (confirmação humana obrigatória) e botão desabilitado ("Encerrado") em programa `closed` (C4).
- Cobertura de testes: domínio (fake em memória), contrato RPC (`lab-isolation`, `lab-financial-safety`), rota (API) e UI — todos verdes, sem rede e sem chamada paga.

## Task Commits

Each task was committed atomically:

1. **Task 1: Terminalidade e fail-closed no serviço de programa** - `66011f89` (feat)
2. **Task 2: Guarda fail-closed no RPC + terminalidade no banco** - `5a55882f` (feat)
3. **Task 3: Rota de encerramento + ação de UI** - `2949b8d1` (feat)

**Plan metadata:** (docs commit — ver abaixo)

## Files Created/Modified

- `src/lib/lab/domain/program-service.ts` - `program_closed` no union; `closeProgram`; guardas em `authorizeProgramBudget`/`updateProgram`
- `src/lib/lab/domain/__tests__/program-service.test.ts` - testes de domínio (fake Supabase em memória)
- `supabase/migrations/20260926000001_f48_2_1_lab_fail_closed_closure.sql` - guarda `status <> 'authorized'`, trigger de terminalidade, REVOKE/GRANT, REVERT
- `src/lib/lab/__tests__/lab-isolation.contract.test.ts` - fake RPC modela a guarda; testes closed/draft/authorized
- `src/lib/lab/__tests__/lab-financial-safety.contract.test.ts` - guarda no fake RPC; testes de recusa antes da chamada paga
- `src/lib/admin/schemas.ts` - `close: z.literal(true).optional()` em `LabProgramUpdateRequestSchema`
- `src/app/api/admin/laboratorio/programs/[id]/route.ts` - encerramento via `closeProgram`, `program_closed` → 409, `close`+`budgetUsd` → 400
- `src/app/api/admin/laboratorio/__tests__/lab-admin-api.contract.test.ts` - testes de encerramento/recusa de reautorização
- `src/app/(app)/admin/laboratorio/_components/program-close-button.tsx` - botão destrutivo com confirmação
- `src/app/(app)/admin/laboratorio/programas/page.tsx` - coluna de ação por programa
- `src/app/(app)/admin/laboratorio/_components/__tests__/lab-admin-ui.contract.test.tsx` - testes de confirmação/estado `closed`

## Decisions Made

- **Terminalidade em três camadas** (serviço, rota HTTP 409, trigger no banco) para que a revogação seja efetiva e não apenas um rótulo.
- **`close: true` tem precedência e nunca autoriza** — combinação com `budgetUsd` retorna 400 `invalid_payload`.
- **Migration aplicada com `npx supabase migration up`** (caminho local que preserva os registros) — ver seção de caminho da migration abaixo.

## Migration Path Used

- **Caminho:** `npx supabase migration up` (aplicação incremental, **sem** `db reset`).
- `npx supabase migration list --local` mostrou `20260926000001` pendente; após `migration up` a migration foi aplicada (`Applying migration 20260926000001_f48_2_1_lab_fail_closed_closure.sql...`).
- **Registros locais preservados e verificados:**
  - programa `860ca4fe-dc8b-4354-b94e-02f9e7b202c6` → `status='authorized'`, `budget_usd=2.808`
  - experimento `c48e21b5-c7a8-4456-a0d6-a2b4040fc1e3` → `status='ready'`
- Verificado no banco local: trigger `trg_lab_prompt_programs_terminal` presente e `lab_reserve_run` contém a guarda `v_program.status <> 'authorized'`.
- **Nenhum `db push` remoto** foi executado.
- `npx supabase db lint` → exit code 0 (apenas warnings preexistentes em funções não relacionadas).

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

- O shell PowerShell não executa `npm` sem pipe/`&` corretamente (`CantActivateDocumentInPipeline`); os comandos de verificação foram executados com `& npm.cmd ...`, preservando os exit codes esperados. Sem impacto no resultado.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- C1–C4 do OpenSpec cobertos. Pronto para o Plano `48-2-1-08` (orçamento visível / arquivamento seguro).
- **Não** foram executados runs, chamadas pagas nem reserva/consumo de budget; o programa `860ca4fe-…` continua `authorized` e o experimento `c48e21b5-…` continua `ready` — o encerramento operacional é do Plano `48-2-1-09`.
- `prompts/` intocado (`git status --porcelain prompts/` vazio).

---

## Self-Check: PASSED

- Created files present: `program-service.test.ts`, `20260926000001_f48_2_1_lab_fail_closed_closure.sql`, `program-close-button.tsx`, `48-2-1-07-SUMMARY.md`.
- Task commits present: `66011f89`, `5a55882f`, `2949b8d1`.
- Verification: domínio, contratos RPC, API e UI verdes; `npm run typecheck` exit 0; `npx supabase db lint` exit 0; `git status --porcelain prompts/` vazio.

---

*Phase: 48.2.1-otimizacao-prompts-diretor*
*Completed: 2026-09-26*
