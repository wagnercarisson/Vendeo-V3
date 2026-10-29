# S0 — preservação de dados preexistentes

- antes: before-f57.3 (2026-10-29T18:27:34.466Z)
- depois: after-f57.3 (2026-10-29T18:28:11.440Z)
- alvo: 127.0.0.1:57782/postgres
- baseline do ledger: 149 (sha acc1ce62227e…)

| Tabela | Antes (count) | Depois (count) | MD5 igual? |
|---|---|---|---|
| stores | 4 | 4 | sim |
| store_billing_info | 0 | 0 | sim |
| credit_transactions | 99 | 99 | sim |
| credit_balances | 3 | 3 | sim |
| freemium_entitlements | 1 | 1 | sim |
| legal_acceptances | 13 | 13 | sim |
| campaigns | 70 | 70 | sim |
| admin_audit_log | 78 | 78 | sim |

Resultado: **1 drift(s)**.
- ledger baseline: acc1ce62227e54b8cf0f2f9178e3b2e77f77b89d4582b904a7c1b11972c1e9a9 != faf8d309f267a93d95a26d70358b877e6b28147207f3a8183c5f186197fd02fd
