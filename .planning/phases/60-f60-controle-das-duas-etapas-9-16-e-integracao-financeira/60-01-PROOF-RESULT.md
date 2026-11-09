# F60 / Plano 60-01 — Resultado da prova

**Status:** `APPROVED` — prova concluída e aprovada tecnicamente.
**Run:** `f60-20261109-02`
**Executado em:** 2026-11-09, homolog `127.0.0.1:57782/postgres`.
**Ambiente:** `supabase_db_vendeo-homolog`, não descartável.
**Janela de exclusividade:** `2026-11-09T15:21:21-03:00` → `2026-11-09T15:31:00-03:00`.

```yaml
status: APPROVED
run_id: f60-20261109-02
migration_applied: true
migration_sha256: 4C50E9741FA1A6F236254CD64CBF54E8EFD7F1B05B6B712BAD5641A9FB3D6A3E
ledger_after: 154
ledger_excluding_f60: 153
ledger_sha256_excluding_f60: 3861f7a0a65717a07a2184554ecd11118e7662fb8c59f7573c2a6d5a78e59f6d
tests: 13/13 PASS
pre_existing_integrity: PASS
expected_delta_matches: PASS
ledger_matches: PASS
cleanup_manifest: present
retained_records: 73
deleted_records: 0
cleanup_executed: true
cleanup_skipped_reason: null
revert_executed: false
restore_executed: false
```

## Resultado por cenário

| ID | Resultado | Evidência principal |
|---|---|---|
| S01 | PASS | `delivered`; 1 deduction, 0 refunds, net -1 |
| S02 | PASS | `refunded`; 1 deduction, 1 refund, net 0; retry definitivo recusado |
| S03 | PASS | `execute` + `query_only` em requisições concorrentes |
| S04 | PASS | replay `query_only`; 1 claim |
| S05 | PASS | mesmo `request_id`: `execute` + `query_only` |
| S06 | PASS | retomada em expansão; `baseAttempts=1` |
| S07 | PASS | `retry_base` primary→fallback; `attempt_limit_reached` na terceira |
| S08 | PASS | `reserved`; retry/base e `abandoned/unknown` recusados |
| S09 | PASS | resposta tardia `operation_terminal` |
| S10 | PASS | admin `refunded`; efeitos tardios recusados |
| S11 | PASS | `overlapObserved=true`; `operation_in_progress`; `reserved` |
| S12 | PASS | origem canônica; `operation_origin_conflict`; claim legado visível |
| S13 | PASS | 1:1/9:16 `delivered`; `close_failed_operation` e `admin_resolve` `refunded` |

## Comparações

- Antes × depois: `pre_existing_integrity=PASS`, `expected_delta_status=PASS`, `ledger_status=PASS`; 0 adições fora do manifesto, 0 esperadas ausentes.
- Pós-cleanup: `pre_existing_integrity=PASS`, `expected_delta_status=PASS`, `ledger_status=PASS`.
- `f60-ledger-precheck.json`: `ok:true`, com `f60_applied=true` antes do harness.

## Cleanup

- `cleanup-manifest.json` da run 02: `deleted=0`, `retained=73`, `unclassified=0`.
- Retenções incluem origem canônica, operações pendentes, ledger, desfechos e auditoria.
- `credit_transactions` não foi apagada nem atualizada.
- A execução 01 (falha antes de criar fixtures por segmento inválido) teve 13 usuários de teste órfãos removidos, registrados em `evidence/f60-20261109-01/cleanup-manifest.json`; nenhuma transação financeira foi criada nessa execução.
- Conferência final read-only em `evidence/f60-20261109-final/f60-final-conference.json`: 13 UUIDs ausentes; integridade preexistente, delta e ledger `PASS`; 0 remoções/adições inesperadas.

## Limitações

- O resultado **não é aceitação produtiva**.
- Nenhuma chamada de IA/provider foi feita; a arte é simulada por hash fixo.
- A decisão formal está em `60-01-PROOF-DECISION.md` com `status: APPROVED`; libera apenas a revisão do 60-02.
- `60-02..60-04` permanecem bloqueados até a decisão.
