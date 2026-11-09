# F60 / Plano 60-01 — Matriz dos 13 cenários (resultado)

**Run:** `f60-20261109-02`
**Executado em:** 2026-11-09 (homolog `127.0.0.1:57782/postgres`)
**Resultado:** 13/13 PASS
**Decisão da prova:** `APPROVED` em `60-01-PROOF-DECISION.md` (2026-11-09).

| Cenário | Comando | Evidência esperada | Resultado | Aprovar/Reprovar |
|---|---|---|---|---|
| S01 | `node scripts/f60/two-stage-proof-harness.mjs` (S01) | Abertura atômica reserva+operação+etapas; base `done` mantém `reserved` e não grava `art_uploaded`; entrega vertical consome exatamente 1 crédito | **PASS** — `delivered`; ledger: 1 deduction, 0 refunds, net -1; arte `sha256:f60-simulated-artifact-v1` | **APROVADO** |
| S02 | harness (S02) | Falha definitiva da expansão + `outcome='failed'` ⇒ exatamente 1 estorno; operação `refunded` | **PASS** — `refunded`; ledger: 1 deduction, 1 refund, net 0; retry definitivo recusado | **APROVADO** |
| S03 | harness (S03, dois clientes) | Duas requisições concorrentes distintas ⇒ exatamente uma `authorization='execute'`; a outra `query_only` | **PASS** — `["execute","query_only"]` | **APROVADO** |
| S04 | harness (S04) | Repetição da mesma requisição ⇒ mesmo token, `query_only`, sem nova cobrança nem claim duplicado | **PASS** — 1 claim; replay `query_only` | **APROVADO** |
| S05 | harness (S05, dois clientes) | Mesmo `request_id` simultâneo ⇒ uma `execute`, uma `query_only`; trabalho executado uma única vez | **PASS** — `["execute","query_only"]` | **APROVADO** |
| S06 | harness (S06) | Retomada após base `done` ⇒ `acquire_expansion`, sem regenerar base e sem nova reserva | **PASS** — `baseAttempts=1` | **APROVADO** |
| S07 | harness (S07) | Base transitória: `retry_base` com alvo principal e depois fallback, coerente com a aquisição; expansão: inicial + 1 retry transitório; terceira tentativa recusada com `attempt_limit_reached` | **PASS** — `thirdReason=attempt_limit_reached`; retomada base primary→fallback | **APROVADO** |
| S08 | harness (S08) | Timeout/desconhecido persistido ⇒ sem retry automático e sem estorno cego; operação permanece `reserved`; `abandoned/unknown` não contorna | **PASS** — `reserved`; retry/base recusados; `abandoned/unknown` recusado | **APROVADO** |
| S09 | harness (S09) | Resposta tardia após `delivered` ⇒ recusa `operation_terminal`; sem entrega/cobrança adicional | **PASS** — `lateReason=operation_terminal` | **APROVADO** |
| S10 | harness (S10) | Admin encerra/estorna (autorizado) ⇒ `refunded`; resposta tardia e nova tentativa recusadas pela autoridade financeira | **PASS** — `resolvedStatus=refunded`; efeitos tardios recusados | **APROVADO** |
| S11 | harness (S11, dois clientes com transações sobrepostas) | Encerramento financeiro concorrente com claim `in_progress` segurando a trava C4 ⇒ bloqueado com `operation_in_progress`; sobreposição observada; nenhum estorno indevido | **PASS** — `overlapObserved=true`; `closeError=operation_in_progress`; status `reserved` | **APROVADO** |
| S12 | harness (S12) | Origem canônica sem desfecho duplicado; abertura recusa `operation_origin_conflict` e claims antigos continuam visíveis | **PASS** — `legacyClaimVisible=legacy`; operação antiga não adotada | **APROVADO** |
| S13 | harness (S13) | 1:1 e 9:16 direto entregam com a mesma semântica; as três RPCs compartilhadas (encerramento, leitura e resolução administrativa) preservam o contrato legado; nenhuma linha de controle nova para operações legadas | **PASS** — 1:1/9:16 `delivered`; `close_failed_operation` e `admin_resolve` → `refunded` | **APROVADO** |

## Evidências

Diretório: `evidence/f60-20261109-02/`

| Arquivo | Conteúdo |
|---|---|
| `f60-ledger-precheck.json` | Ledger autorizado e F60 aplicada antes do harness: `ok:true` |
| `f60-snapshot-before.json` / `.md` | S0 antes do harness |
| `f60-snapshot-after.json` / `.md` | S0 depois do harness |
| `f60-snapshot-after-cleanup.json` / `.md` | S0 depois do cleanup |
| `f60-snapshot-compare.json` / `.md` | Antes × depois: integridade `PASS`, delta `PASS`, ledger `PASS` |
| `f60-snapshot-compare-after-cleanup.json` / `.md` | Verificação pós-cleanup: `PASS` |
| `f60-proof-evidence.json` | Evidência por cenário; 13/13 PASS |
| `f60-expected-additions.json` | Manifesto esperado por tabela |
| `cleanup-manifest.json` / `.md` | `deleted: 0`; `retained: 73`; `credit_transactions` preservado |

## Conferência final read-only

`evidence/f60-20261109-final/f60-final-conference.json`:

- 13 UUIDs removidos da run 01 **ausentes**.
- Integridade preexistente `PASS`; delta esperado `PASS`; ledger `PASS`.
- 0 remoções/adições inesperadas; 0 adições esperadas ausentes.
- Ledger: 153 → 154 total; 153 excluindo F60; mesmo SHA; F60 presente.

## Critério de aprovação

- 13/13 cenários `PASS` — **atendido**.
- Integridade preexistente `PASS`; delta esperado `PASS`; ledger `PASS` — **atendido**.
- Nenhum estorno duplo, execução dupla, entrega antecipada ou item não classificado — **atendido**.
- Cleanup conservador: nada apagado; 73 registros retidos com motivo — **atendido**.
- Decisão formal em `60-01-PROOF-DECISION.md` — **PENDENTE**.
- O resultado **não** é aceitação produtiva.
