# F50.2 — Acompanhamento operacional aberto

**Status:** **ABERTO — NÃO COMPROVADO EM PRODUÇÃO.**
**Não marcar a parcela como creditada antes da execução real do cron.**
**Responsável pelo acompanhamento:** **Wagner Carisson** (`wagnercarisson@gmail.com`), aprovador da F50.2.

## Primeira parcela

| Item | Valor |
|---|---|
| Enrollment | `99680463-ca57-4eca-a285-9172173c5250` |
| Loja | `b81d924e-aeee-4e44-837f-25a6b7340ba9` (“Farmácia do Povo”) |
| Conta | `comercial@vendeo.tech` |
| Elegibilidade da parcela | `2026-10-27T21:50:52.269093Z` — **27/10/2026, 18:50:52 BRT** |
| Parcela esperada | `seq=1`, **5 créditos** |
| `due_at` | `2026-10-27T21:50:52.269093Z` |
| Vencimento do teste | `2026-11-17T21:50:52.269093Z` — 17/11/2026, 18:50:52 BRT |
| Idempotency key esperada | `trial28d:99680463-ca57-4eca-a285-9172173c5250:1` |
| Execução esperada | Execução diária seguinte do cron de créditos demo; o horário exato não é prometido |
| Estado atual | `granted_total=5`, `last_granted_seq=0`, saldo `5` |

## Como verificar na data

1. Confirmar que o cron diário executou após `2026-10-27T21:50:52.269093Z`.
2. Verificar a existência de **uma** transação com `idempotency_key=trial28d:99680463-ca57-4eca-a285-9172173c5250:1`, `amount=5`, `metadata.credit_program='trial_28d'` e `installment_seq=1`.
3. Confirmar `granted_total=10` e `last_granted_seq=1` no enrollment.
4. Conferir o saldo exibido na conta (esperado: 10 créditos, se não houve consumo).
5. Registrar a evidência e só então marcar a parcela como comprovada.
6. Se a parcela não ocorrer, diagnosticar antes de qualquer reparo; não conceder crédito manualmente.

## Preservação

- Início, vencimento, saldo atual, chave e marco permanecem os registrados.
- Nenhuma concessão manual é autorizada por este acompanhamento.
- O acompanhamento não bloqueia o archive documental da F50.2.
