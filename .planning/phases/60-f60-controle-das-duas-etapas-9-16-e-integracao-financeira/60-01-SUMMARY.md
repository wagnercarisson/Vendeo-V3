# F60 / Plano 60-01 — Summary de execução

**Status:** 60-01 executado e **APROVADO tecnicamente** em 2026-11-09. Decisão em `60-01-PROOF-DECISION.md`. Libera apenas a revisão do 60-02; não autoriza 60-02..60-04, produção, deploy ou IA.
**Run:** `f60-20261109-02`
**Resultado:** `60-01-PROOF-RESULT.md`
**Matriz:** `60-01-PROOF-MATRIX.md`
**Evidências:** `evidence/f60-20261109-02/`
**Próximo passo:** revisar `60-02-PLAN.md`. Não executar 60-02..60-04 sem autorização separada.

## O que foi executado

- Autorizações A/B/C/D concedidas em 2026-11-09.
- Backup pré-F60: `G:\Vendeo-Homolog\recovery\homolog-pre-f60-20261109T152121Z.dump` (SHA-256 `6C0E15AE...738AC`).
- Status read-only: alvo `127.0.0.1:57782/postgres`, ledger 153 excluindo F60, SHA `3861f7a0...f6d`, F60 ausente.
- Migration `20261109174110_f60_9_16_two_stage_control.sql` aplicada em transação única; ledger atualizado para 154; F60 presente.
- Preflight do `prove`: `f60_applied=true`, ledger autorizado, antes do harness.
- Harness S01–S13: 13/13 PASS.
- Snapshot antes/depois, comparação esperado × observado e ledger: PASS.
- Cleanup conservador: `deleted=0`, `retained=73`, `unclassified=0`.
- Snapshot pós-cleanup e comparação: PASS.
- Execução 01 (falha antes de criar fixtures por segmento inválido) teve 13 usuários de teste órfãos removidos e registrados; nenhuma transação financeira foi criada.
- Conferência final read-only: 13 UUIDs ausentes; integridade preexistente/delta/ledger `PASS`.

## Evidências principais

| Item | Resultado |
|---|---|
| S01 | `delivered`; 1 deduction, 0 refunds, net -1 |
| S02 | `refunded`; 1 deduction, 1 refund, net 0 |
| S03/S05 | `execute` + `query_only` |
| S04 | 1 claim; replay `query_only` |
| S06 | `baseAttempts=1` |
| S07 | `retry_base` primary→fallback; terceira recusada |
| S08 | `reserved`; retry/base e `abandoned/unknown` recusados |
| S09 | `operation_terminal` |
| S10 | admin `refunded`; efeitos tardios recusados |
| S11 | `overlapObserved=true`; `operation_in_progress` |
| S12 | `operation_origin_conflict`; claim legado visível |
| S13 | 1:1/9:16 `delivered`; RPCs legadas `refunded` |

## Verificações estáticas

- `node --check` dos `.mjs`: exit 0.
- Parse do `.ps1`: sem erros.
- `static-guards.mjs`: 14/14 PASS.
- `snapshot-compare.test.mjs`: 12/12 PASS.
- `openspec validate --strict`: válido.
- `git diff --check`: limpo.

## Limites

- O resultado **não é aceitação produtiva**.
- Nenhuma chamada de IA/provider; arte simulada por hash.
- `60-02..60-04` permanecem bloqueados até a decisão formal.
- Nenhum deploy, push, merge, flag ou UI.
