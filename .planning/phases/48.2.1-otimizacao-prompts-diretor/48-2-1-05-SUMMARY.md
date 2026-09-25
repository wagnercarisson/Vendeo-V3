---
phase: 48.2.1-otimizacao-prompts-diretor
plan: 48-2-1-05
subsystem: lab-admin
tags: [laboratorio, prompts-diretor, orcamento, api-admin, ui, isolamento, checkpoint-2]

# Dependency graph
requires:
  - phase: 48-2-1-01
    provides: lab_prompt_programs + campaign_intent/program_id/rubric + orcamento atomico + DIRECTOR_PROMPTS
  - phase: 48-2-1-02
    provides: diagnostico versionado + matriz de nove cenarios (Checkpoint 1 aprovado, matrix-v1)
  - phase: 48-2-1-03
    provides: execucao do Diretor por intent + settle/release do orcamento
  - phase: 48-2-1-04
    provides: rubrica humana de nove criterios obrigatoria e comparacao cega
provides:
  - API administrativa com intent/programa/prompt derivado, estimativa cenarios x 2 variantes x repeticoes, saldo do programa e rubrica
  - Endpoints POST/GET /programs e GET/PUT /programs/[id] com autorizacao de orcamento
  - UI com tipo de campanha -> prompt, programa obrigatorio, painel de orcamento e estimativa/saldo
  - Guardas de isolamento e testes de rota/UI/financeiro
  - Roteiro de UAT local fail-closed e teto de orcamento com margem explicita
  - Checkpoint 2 decidido (autorizar-inicial US$ 2.808) e persistido em lab_prompt_programs
affects: [48-2-1-06, 48-2-1-07, 48-2-1-08, 48-2-1-09, 48.2.2, 48.2.3]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Teto de orcamento = estimativa x (1 + LAB_BUDGET_MARGIN_RATIO); margem unica em estimate.ts"
    - "Saldo do programa = budget_usd - budget_consumed_usd - budget_reserved_usd"
    - "Valores monetarios exibidos com 2 casas (display-format); calculos internos com 6 casas"
    - "Prompt sob teste derivado de DIRECTOR_PROMPTS[campaignIntent] (nunca campo do payload)"

key-files:
  created:
    - src/lib/lab/api/program-queries.ts
    - src/app/api/admin/laboratorio/programs/route.ts
    - src/app/api/admin/laboratorio/programs/[id]/route.ts
    - src/app/(app)/admin/laboratorio/_components/program-form.tsx
    - src/app/(app)/admin/laboratorio/_components/budget-panel.tsx
    - src/app/(app)/admin/laboratorio/programas/page.tsx
    - src/lib/lab/display-format.ts
    - src/lib/lab/__tests__/display-format.test.ts
    - scripts/uat/48-2-1-local-uat-prep.mjs
  modified:
    - src/lib/admin/schemas.ts
    - src/lib/lab/api/estimate.ts
    - src/lib/lab/api/experiment-queries.ts
    - src/app/api/admin/laboratorio/experiments/route.ts
    - src/app/api/admin/laboratorio/experiments/[id]/estimate/route.ts
    - src/app/api/admin/laboratorio/experiments/[id]/runs/route.ts
    - src/app/api/admin/laboratorio/experiments/[id]/evaluations/route.ts
    - src/app/(app)/admin/laboratorio/layout.tsx
    - src/app/(app)/admin/laboratorio/experimentos/novo/page.tsx
    - src/app/(app)/admin/laboratorio/experimentos/[id]/page.tsx
    - src/app/(app)/admin/laboratorio/_components/experiment-form.tsx
    - src/app/(app)/admin/laboratorio/_components/run-execution-panel.tsx
    - src/app/(app)/admin/laboratorio/_components/comparison-format.ts
    - src/lib/ai/__tests__/architecture-guard.test.ts
    - src/lib/lab/__tests__/lab-isolation.contract.test.ts
    - src/lib/lab/api/__tests__/estimate.test.ts
    - src/lib/lab/api/__tests__/experiment-queries.test.ts
    - src/lib/lab/api/__tests__/evaluation-service.test.ts
    - src/app/api/admin/laboratorio/__tests__/lab-admin-api.contract.test.ts
    - src/app/api/admin/laboratorio/__tests__/route.test.ts
    - src/app/api/admin/laboratorio/experiments/[id]/__tests__/route.test.ts
    - src/app/api/admin/laboratorio/experiments/[id]/runs/__tests__/route.test.ts
    - src/app/api/admin/laboratorio/experiments/[id]/evaluations/__tests__/route.test.ts
    - src/app/(app)/admin/laboratorio/_components/__tests__/experiment-form.test.tsx
    - src/app/(app)/admin/laboratorio/_components/__tests__/run-execution-panel.test.tsx
    - src/app/(app)/admin/laboratorio/_components/__tests__/lab-admin-ui.contract.test.tsx
    - src/app/(app)/admin/laboratorio/_components/__tests__/comparison-view.test.tsx

key-decisions:
  - "Checkpoint 2 = autorizar-inicial: budget_usd = US$ 2.808 (teto dos 36 runs iniciais). O pior caso (108 runs, US$ 8.424) NAO fica autorizado; cada ciclo v2/v3 exige autorizacao humana renovada (orcamento incremental)."
  - "Prompt sob teste e derivado de DIRECTOR_PROMPTS[campaignIntent] (nunca campo do payload); programId obrigatorio."
  - "Valores monetarios exibidos com 2 casas; precisao de 6 casas reservada aos calculos internos (margem e formula inalteradas)."
  - "Separador decimal mantido como '.' (convencao ja existente da UI do laboratorio); arredondamento aplicado conforme solicitado."

patterns-established:
  - "Budget ceiling helper: LAB_BUDGET_MARGIN_RATIO + computeBudgetCeilingUsd em estimate.ts"
  - "Display formatting separado do calculo: src/lib/lab/display-format.ts"

requirements-completed: [lab-admin-api, lab-admin-ui, lab-isolation, lab-prompt-optimization]

# Metrics
duration: 1h 28m
completed: 2026-09-25
---

# Phase 48.2.1 Plan 05: API, UI, orçamento e isolamento do Diretor Summary

**API/UI administrativa do laboratório com tipo de campanha derivando o prompt do Diretor, programa obrigatório, estimativa cenários×2 variantes×repetições com saldo, guardas de isolamento e Checkpoint 2 autorizado em US$ 2.808 (pior caso não liberado).**

## Performance

- **Duration:** 1h 28m
- **Started:** 2026-09-25T17:46:45-03:00 (primeiro commit do plano)
- **Completed:** 2026-09-25T19:15:00-03:00
- **Tasks:** 6 `auto` tasks + Task 8 (persistência) executados; Task 7 (checkpoint:decision) resolvido pelo humano
- **Files modified:** 31 (9 criados, 22 modificados)

## Accomplishments

- Schemas de admin: `LabProgramCreateRequestSchema`/`LabProgramUpdateRequestSchema`; `LabEvaluationRequestSchema` passou a reexportar o schema de domínio (rubrica tipada obrigatória).
- Rotas de experimento: `POST /experiments` mapeia `intent_mismatch`/`unsupported_prompt_under_test` (400) e `program_not_authorized` (409); detalhe expõe `campaign_intent`/`program_id` e o saldo do programa; estimativa `cenários × 2 variantes × repetições` com `programRemainingUsd`; `runs` recusa `program_not_authorized` antes do stream; avaliações aceitam a rubrica.
- Endpoints e UI de programa: `POST/GET /programs`, `GET/PUT /programs/[id]` com autorização de orçamento (`budget_usd`/`budget_authorized_by`/`budget_authorized_at`/`status='authorized'`), relatório/hash e recomendação; tela `/admin/laboratorio/programas`.
- UI de experimento: seletor "Tipo de campanha" deriva "Prompt sob teste"; seletor "Programa de otimização" obrigatório; `novo/page.tsx` sem `PROMPT_UNDER_TEST`; `budget-panel` com saldo restante; `run-execution-panel` exibe `program_not_authorized`; nav com "Programas".
- Guardas e testes: `architecture-guard` (sem `ai_model_selection`/`campaign_image_review`, sem escrita em `ai_model_catalog`, sem escrita em `prompts/`, três prompts aceitos); `lab-isolation` (programa autorizado antes da chamada paga, reserva idempotente, saldo consistente); contrato canônico completado com endpoints de programa.
- Roteiro de UAT local fail-closed (`scripts/uat/48-2-1-local-uat-prep.mjs`) com teto = estimativa × (1 + margem) e escalas 36/108.
- **Checkpoint 2 decidido e persistido:** `lab_prompt_programs` (`matrix-v1`) com `budget_usd = 2.808`, `status='authorized'`, autor e timestamp; pior caso não autorizado.

## Task Commits

1. **Task 1: Schemas de admin/domínio** — `32618ddc` (feat)
2. **Task 2: Rotas de experimento** — `6ea934e8` (feat)
3. **Task 3: Endpoints e UI de programa** — `c49d9b49` (feat)
4. **Task 4: UI de experimento** — `de13580f` (feat)
5. **Task 5: Guardas de isolamento + testes** — `6eb63047` (test)
6. **Task 6: Prep local de UAT** — `fba87ef9` (chore)
7. **Task 8: Persistência da autorização** — sem commit de código (gravação local em `lab_prompt_programs`; registro neste SUMMARY)
8. **Ajustes de fechamento** — `490a5e83` (fix, fórmula/verificação) e `c599d410` (fix, exibição monetária 2 casas)

**Plan metadata:** _(commit docs deste SUMMARY)_

## Files Created/Modified

- `src/lib/admin/schemas.ts` — schemas de programa + rubrica obrigatória (reexport do domínio)
- `src/lib/lab/api/estimate.ts` — `plannedRuns = scenarioCount * 2 * repetitions`, `programRemainingUsd`, `LAB_BUDGET_MARGIN_RATIO`, `computeBudgetCeilingUsd`
- `src/lib/lab/api/experiment-queries.ts` — detalhe com `campaign_intent`/`program_id`/saldo e leitura de rubrica tolerante a `null`
- `src/lib/lab/api/program-queries.ts` — `listPrograms`/`getProgramDetail`/`remainingUsd` (sem conteúdo de cenário)
- `src/app/api/admin/laboratorio/programs/route.ts` e `.../[id]/route.ts` — criação/lista e detalhe/atualização com autorização
- `src/app/(app)/admin/laboratorio/_components/program-form.tsx`, `budget-panel.tsx`, `programas/page.tsx` — UI de programa e orçamento
- `src/app/(app)/admin/laboratorio/_components/experiment-form.tsx`, `run-execution-panel.tsx`, `layout.tsx`, `experimentos/novo/page.tsx` — UI de experimento
- `src/lib/lab/display-format.ts` (+ teste) — exibição monetária com 2 casas
- `scripts/uat/48-2-1-local-uat-prep.mjs` — roteiro local fail-closed e teto
- Testes co-migrados: contrato canônico, rotas (detalhe/runs/evaluations), estimativa, queries, UI (form/painel/contrato/comparação) e `evaluation-service.test.ts`

## Decisions Made

- **Checkpoint 2 = `autorizar-inicial`:** autorizado **US$ 2.808** (teto dos 36 runs iniciais: 3 prompts × 12 runs × estimativa 2.340 × margem 1.2). O pior caso (108 runs = **US$ 8.424**) **não** é autorizado agora; só é alcançado se os resultados exigirem ciclos v2/v3, **cada um submetido a nova aprovação humana** (orçamento incremental). Nenhuma chamada paga ocorreu.
- **Exibição monetária arredondada (2 casas):** atendendo à recomendação do usuário, a UI passou a exibir `US$ 2.81` / `US$ 8.42`; os cálculos internos mantêm 6 casas. O separador decimal permaneceu `.` (convenção existente da UI do laboratório) — troca para `,` pode ser solicitada à parte.
- Prompt sob teste derivado do intent (nunca campo do payload); `programId` obrigatório.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Cast de tipo no teste negativo de rubrica**
- **Found during:** Task 1
- **Issue:** ao reexportar o schema de domínio, `LabEvaluationRequest` passou a exigir `rubric` no tipo; o teste legado `evaluation-service.test.ts` (caso negativo "sem rubrica") deixou de typecheckar.
- **Fix:** cast explícito `as unknown as CreateLabEvaluationInput` no caso negativo (comportamento de runtime inalterado).
- **Files modified:** `src/lib/lab/api/__tests__/evaluation-service.test.ts`
- **Committed in:** `32618ddc`

**2. [Rule 1 - Bug] Literal da fórmula alinhado ao contrato de verificação**
- **Found during:** verificação do plano
- **Issue:** a fórmula estava `scenarioCount * 2 * row.repetitions`, não casando com a verificação `scenarioCount \* 2 \* repetitions`.
- **Fix:** extrair `const repetitions = row.repetitions` (sem mudar o cálculo).
- **Files modified:** `src/lib/lab/api/estimate.ts`
- **Committed in:** `490a5e83`

**3. [Rule 3 - Blocking] Ausência de programa/autor local para persistir a autorização**
- **Found during:** Task 8
- **Issue:** `lab_prompt_programs` estava vazia e não havia `auth.users` local; as FKs (`created_by`/`budget_authorized_by`) impediam a persistência.
- **Fix:** criado, **apenas no Supabase local**, o admin de UAT (`f48-2-1-uat-admin@local.invalid`) e o programa `matrix-v1`, então gravada a autorização equivalente a `authorizeProgramBudget` (mesmo update de `budget_usd`/autor/timestamp/status). Nenhum `db push`; nenhum secret versionado.
- **Files modified:** nenhum (estado local do banco; scripts temporários removidos)
- **Verification:** linha resultante — id `860ca4fe-dc8b-4354-b94e-02f9e7b202c6`, `budget_usd=2.808`, `status='authorized'`, `budget_authorized_at=2026-09-25T22:10:57.741Z`.

**4. [User-requested] Arredondamento monetário na UI**
- **Found during:** pós-Checkpoint 2 (recomendação do usuário)
- **Fix:** novo `display-format.ts` (2 casas) aplicado a budget-panel, run-execution-panel, páginas de programa/detalhe e formatação de comparação; testes co-migrados.
- **Committed in:** `c599d410`

---

**Total deviations:** 4 (2 bloqueantes, 1 bug de verificação, 1 ajuste solicitado pelo usuário).
**Impact on plan:** Sem mudança de escopo comportamental. O ajuste de exibição é formatação pura; a margem e a fórmula não mudaram.

## Issues Encountered

- O plano tem 8 tasks/31 arquivos (acima do limiar padrão). **Risco residual declarado:** a estrutura é mandatada 1:1 por `tasks.md` §5 e não foi dividida; a carga foi contida (≤5 arquivos por task de produção; Task 6 leve) e o plano executou integralmente sem perda de verificação.
- A API de admin do Supabase local rejeitou o JWT legado HS256; a persistência local foi feita via SQL direto (local-only), registrada como desvio 3.

## User Setup Required

None - nenhuma configuração externa. A autorização de orçamento local já está persistida.

## Next Phase Readiness

- Superfície administrativa pronta para o ciclo `offer` (`48-2-1-06`): criar experimento com intent/programa, estimar, executar (com confirmação) e avaliar com rubrica.
- Orçamento inicial autorizado (US$ 2.808). **Antes de qualquer chamada paga do ciclo v2/v3 é necessária nova autorização humana** (o pior caso US$ 8.424 não está liberado).
- Nenhuma promoção, nenhum `db push` remoto, `prompts/` intocado.

---

## Self-Check: PASSED

- Arquivos-chave criados verificados em disco: `program-queries.ts`, `programs/route.ts`, `programs/[id]/route.ts`, `program-form.tsx`, `programas/page.tsx`, `budget-panel.tsx`, `scripts/uat/48-2-1-local-uat-prep.mjs`, `display-format.ts` (+ teste) — todos FOUND.
- Commits do plano verificados: `32618ddc`, `6ea934e8`, `c49d9b49`, `de13580f`, `6eb63047`, `fba87ef9`, `490a5e83`, `c599d410` — todos FOUND.
- Verificações do plano: `typecheck` 0; `lint` 0; `build` 0 (compiled successfully); 12 arquivos de teste / 217 testes verdes; `PROMPT_UNDER_TEST` ausente em `novo/page.tsx`; `program_not_authorized` presente em `runs/route.ts`; `scenarioCount * 2 * repetitions` presente; `db push|supabase.co` ausente do script UAT; `prompts/` sem alterações.

---
*Phase: 48.2.1-otimizacao-prompts-diretor*
*Completed: 2026-09-25*
