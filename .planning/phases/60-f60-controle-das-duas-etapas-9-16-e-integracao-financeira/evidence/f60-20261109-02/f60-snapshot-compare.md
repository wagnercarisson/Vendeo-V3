# F60 — Comparação S0 / delta esperado

- Run: `f60-20261109-02`
- Integridade preexistente: **PASS**
- Delta esperado: **PASS**
- Ledger: **PASS**
- Linhas preexistentes removidas: 0
- Linhas preexistentes alteradas: 0
- Adições não manifestadas: 0
- Adições esperadas ausentes: 0
- Tabelas esperadas sem snapshot: 0
- Tabelas do snapshot sem expectativa: 0

| Tabela | Esperadas | Adicionadas | Extras | Ausentes |
|---|---:|---:|---:|---:|
| `auth.users` | 18 | 18 | 0 | 0 |
| `public.stores` | 18 | 18 | 0 | 0 |
| `public.credit_balances` | 18 | 18 | 0 | 0 |
| `public.credit_transactions` | 41 | 41 | 0 | 0 |
| `public.campaigns` | 18 | 18 | 0 | 0 |
| `public.product_1_1_campaign_credit_operations` | 19 | 19 | 0 | 0 |
| `public.product_1_1_generation_attempt_claims` | 2 | 2 | 0 | 0 |
| `public.product_1_1_generation_outcomes` | 2 | 2 | 0 | 0 |
| `public.admin_audit_log` | 2 | 2 | 0 | 0 |
| `public.product_9_16_two_stage_operations` | 14 | 14 | 0 | 0 |
| `public.product_9_16_two_stage_steps` | 28 | 28 | 0 | 0 |
| `public.product_9_16_two_stage_attempt_claims` | 24 | 24 | 0 | 0 |
| `public.product_9_16_two_stage_outcomes` | 3 | 3 | 0 | 0 |

> Adições fora do manifesto reprovam a prova. O ledger é comparado por contagem/SHA excluindo F60.
