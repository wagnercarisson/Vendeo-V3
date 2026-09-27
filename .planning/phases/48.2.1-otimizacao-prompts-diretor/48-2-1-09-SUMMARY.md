---
phase: 48.2.1-otimizacao-prompts-diretor
plan: 48-2-1-09
subsystem: lab
tags: [lab, verification, uat, closure, fail-closed, budget, archive, openspec]

# Dependency graph
requires:
  - phase: 48.2.1-otimizacao-prompts-diretor
    provides: 48-2-1-07 (reserva fail-closed, `closed` terminal) e 48-2-1-08 (orçamento visível, arquivamento seguro)
provides:
  - "48-2-1-VERIFICATION.md: validação automática, isolamento, fronteiras F48.2.2/F48.2.3/F48.6, C10 e tracking para o orquestrador"
  - "48.2.1-UAT.md: roteiro/registro da UAT local sem execução paga + decisão final `aprovar-encerramento`"
  - "Programa `860ca4fe-…` encerrado (`closed`) e experimento `c48e21b5-…` arquivado (`archived`), com recusas confirmadas e histórico preservado"
  - "Arquivamento OpenSpec preparado (não executado)"
affects: [48.2.3, 48.6]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Gate fail-closed da suíte completa: aceita exit 0 ou exclusivamente a exceção preexistente exata (1 arquivo / 1 teste) e recusa qualquer divergência"
    - "Encerramento/arquivamento via capacidades de domínio (closeProgram/archiveExperiment) + probe da guarda RPC `lab_reserve_run` para provar a recusa antes da chamada paga"
    - "Teste determinístico por congelamento de relógio (vi.useFakeTimers + setSystemTime) para eliminar dependência da data real"

key-files:
  created:
    - .planning/phases/48.2.1-otimizacao-prompts-diretor/48-2-1-VERIFICATION.md
    - .planning/phases/48.2.1-otimizacao-prompts-diretor/48.2.1-UAT.md
  modified:
    - .planning/phases/48.2.1-otimizacao-prompts-diretor/deferred-items.md
    - .planning/phases/48.2.1-otimizacao-prompts-diretor/.continue-here.md
    - .planning/HANDOFF.json
    - .planning/STATE.md
    - src/components/flow/__tests__/use-campaign-form-validity.test.ts

key-decisions:
  - "Task 3 = `aprovar-encerramento` (após `adiar`): encerrar o programa e arquivar o experimento, com histórico preservado"
  - "Exceção preexistente F50 (ENOENT) mantida como follow-up externo; teste NÃO corrigido nesta fase"
  - "Correção test-only autorizada do data-bomb preexistente (freeze de relógio), sem alterar código produtivo"
  - "ROADMAP.md e STATE.md não editados pela Task 5; tracking registrado para o orquestrador aplicar"

patterns-established:
  - "Encerramento operacional provado por: transição de status + probe da guarda server-side + comparação antes/depois do histórico"

requirements-completed: [lab-isolation, lab-prompt-optimization, lab-admin-api, lab-admin-ui]

# Metrics
duration: ~14h (inclui pausa humana no checkpoint da Task 3)
completed: 2026-09-27
---

# Phase 48.2.1 Plan 48-2-1-09: Verificação, UAT e Encerramento Operacional Summary

**Validação automática e isolamento verdes, UAT da bancada conduzida sem execução paga, e encerramento operacional efetivo: programa `closed` e experimento `archived` com recusas confirmadas (`program_not_authorized` / `experiment_not_ready`) e histórico integralmente preservado.**

## Performance

- **Duration:** ~14h (inclui pausa humana no checkpoint da Task 3 — `adiar` e depois `aprovar-encerramento`)
- **Started:** 2026-09-27T00:34:30Z
- **Completed:** 2026-09-27T14:37:42Z
- **Tasks:** 5
- **Files modified:** 7 (2 criados, 5 modificados)

## Accomplishments

- **Task 1 (C8/C9):** gates verdes — `typecheck`, `lint`, `build` (incl. `check:cnae`) e os testes direcionados da F48.2.1/laboratório + Planos 07/08 (`52 files / 1014 passed`, exit 0). A suíte completa retornou **exclusivamente** a exceção preexistente da F50 (1 arquivo / 1 teste, `ENOENT`, caminho antigo). Isolamento confirmado: `prompts/` intocado; allowlist do Revisor = exatamente os 3 arquivos preexistentes; sem novas estruturas do Revisor; sem escrita em tabelas produtivas.
- **Task 2 (C10/D3):** `48-2-1-VERIFICATION.md` (fronteira local, ausência do Revisor, F48.2.3 × F48.6, isolamento, primeira operação paga FUTURA com novo programa + nova autorização) e `48.2.1-UAT.md` (roteiro/registro sem execução paga).
- **Task 3 (decisão):** registrada em `48.2.1-UAT.md` — primeiro `adiar` (pendente da UAT visual), depois **`aprovar-encerramento`** com **10 passos visuais confirmados pelo humano + passo 11 (regra de vitória consultiva) validado automaticamente** por contratos/testes.
- **Task 4 (D1/D2):** programa `860ca4fe-dc8b-4354-b94e-02f9e7b202c6` → **`closed`** e experimento `c48e21b5-c7a8-4456-a0d6-a2b4040fc1e3` → **`archived`**, via `closeProgram`/`archiveExperiment`. Recusas confirmadas pelo probe da guarda `lab_reserve_run`: `program_not_authorized` (programa encerrado) e `experiment_not_ready` (experimento arquivado), antes de qualquer chamada paga. Histórico preservado.
- **Task 5 (D3/D4):** verificação finalizada com o resumo do encerramento, a seção **"Para o orquestrador aplicar (tracking)"** (status da fase e dos planos 01..09 + nota de realinhamento do ROADMAP) e a **preparação** (não execução) do arquivamento OpenSpec.

## Task Commits

Each task was committed atomically:

1. **Task 1: validação automática e confirmação de isolamento (C8/C9)** - `092e3717` (docs)
2. **Task 2: verificação final + UAT sem execução paga (D3)** - `3514db5c` (docs)
3. **Task 3: decisão `adiar` e pausa** - `33c47f7e` (docs)
4. **Task 4: encerrar programa e arquivar experimento (D1/D2)** - `9c5fcf6d` (docs; inclui a decisão final `aprovar-encerramento` da Task 3)
5. **Task 5: finalizar verificação, tracking e preparação do OpenSpec (D3/D4)** - `de290675` (docs)

**Support commits:** `1c937a85` (registro do achado preexistente), `df8ea40f` (fix test-only autorizado do data-bomb).

## Files Created/Modified

- `.planning/phases/48.2.1-otimizacao-prompts-diretor/48-2-1-VERIFICATION.md` — validação, isolamento, fronteiras, C10, encerramento (D1/D2), tracking e preparação OpenSpec.
- `.planning/phases/48.2.1-otimizacao-prompts-diretor/48.2.1-UAT.md` — roteiro/registro da UAT (**10 passos visuais PASS + 1 validação automatizada**) e decisão final `aprovar-encerramento`.
- `.planning/phases/48.2.1-otimizacao-prompts-diretor/deferred-items.md` — F50 (follow-up externo) + registro do data-bomb corrigido.
- `.planning/phases/48.2.1-otimizacao-prompts-diretor/.continue-here.md` — continuidade (reescrito na pausa).
- `.planning/HANDOFF.json` — pausa (reescrito) — depois superado pelo encerramento.
- `.planning/STATE.md` — registro mínimo de pausa/continuidade.
- `src/components/flow/__tests__/use-campaign-form-validity.test.ts` — fix test-only (freeze de relógio no bloco `D2/D5`).

## Decisions Made

- **Encerramento autorizado** (Task 3 = `aprovar-encerramento`) após a confirmação humana de **10 passos visuais** + a validação **automatizada** do passo 11 (regra de vitória consultiva).
- **Exceção F50 preservada como follow-up externo** (não corrigida).
- **Correção test-only** do data-bomb preexistente em `use-campaign-form-validity.test.ts` (autorizada; sem alterar código produtivo).
- **Tracking é do orquestrador**: `ROADMAP.md`/`STATE.md` não editados pela Task 5; o texto pretendido foi registrado em `48-2-1-VERIFICATION.md`.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking / exceção humana autorizada] Suíte completa com falha preexistente extra (data-bomb)**
- **Found during:** Task 1 (validação automática)
- **Issue:** além da exceção F50 esperada, 3 testes de `src/components/flow/__tests__/use-campaign-form-validity.test.ts` falhavam por usarem `2026-09-25` como data futura (agora passada), quebrando o gate fail-closed (2 arquivos / 4 testes).
- **Fix:** por **autorização humana explícita**, ajuste **exclusivamente de teste** (congelamento de relógio `vi.useFakeTimers({ toFake: ["Date"] })` + `setSystemTime("2026-08-20T12:00:00")` no `beforeEach` do bloco `D2/D5` e `vi.useRealTimers()` no `afterEach`, espelhando o bloco `Q-P3U`). Nenhum código produtivo alterado.
- **Files modified:** `src/components/flow/__tests__/use-campaign-form-validity.test.ts`, `deferred-items.md`
- **Verification:** isolado 27/27; suíte completa volta a conter apenas a exceção F50.
- **Committed in:** `df8ea40f`

---

**Total deviations:** 1 (auto-fix test-only sob autorização humana).
**Impact on plan:** necessário para satisfazer o gate fail-closed da Task 1 sem mascarar regressões; sem alteração de comportamento produtivo.

## Issues Encountered

- **Pausa no checkpoint (Task 3):** o humano decidiu primeiro `adiar` (pendente da UAT visual) e depois `aprovar-encerramento`. Registrado em `48.2.1-UAT.md` (§6.1 histórico) e em `.planning/HANDOFF.json`/`.continue-here.md`.
- **Exceção F50** (`legal-document-versions.test.ts`, `ENOENT`) permanece como **follow-up externo** — não corrigida nesta fase.
- **Operacional (Windows):** comandos executados como `npm.cmd`; a invocação das capacidades de domínio usou um script temporário (não commitado) com alias de `server-only` via tsconfig, removido ao final.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- **F48.2.1 concluída** (9 planos). Programa `closed` e experimento `archived`; histórico preservado; zero runs/custo.
- **Próxima ação imediata:** verificar, sincronizar e arquivar a change OpenSpec da F48.2.1 (`openspec-verify-change` → `openspec-sync-specs` → `openspec-archive-change`), pendente de confirmação humana.
- **Depois disso:** as experiências reais com prompts serão **sessões manuais** conduzidas pelo usuário e pelo assistente.
- **F48.2.2:** permanece uma change **separada** e deve ser revisada/realinhada humanamente antes de planejamento ou execução.
- **F48.2.3:** permanece **bloqueada** até existirem prompts efetivamente testados e aprovados para promoção.
- **Follow-ups do orquestrador:** realinhar o bloco F48.2.1 do `.planning/ROADMAP.md` (07/08/09; 07/08 autônomos) — **já aplicado**; preparar (e só então executar, com confirmação) `openspec-verify-change` → `openspec-archive-change`.
- **Não** retomar o Plano `48-2-1-06` (suplantado).

---

## Self-Check: PASSED

- Created files present: `48-2-1-VERIFICATION.md`, `48.2.1-UAT.md`, `48-2-1-09-SUMMARY.md`.
- Task commits present: `092e3717`, `3514db5c`, `33c47f7e`, `9c5fcf6d`, `de290675` (+ `1c937a85`, `df8ea40f`).
- Terminal transitions confirmed: program `closed`, experiment `archived`; refusals `program_not_authorized`/`experiment_not_ready`; history preserved.
- `git status --porcelain prompts/` empty; no paid calls; no `db push`.

---

*Phase: 48.2.1-otimizacao-prompts-diretor*
*Completed: 2026-09-27*
