# F63 — Relatório de preservação (post-a)

**Fase:** 63
**Estágio:** `post-a`
**Capturado (UTC):** 2026-11-26T22:40:56.787Z
**Modo:** somente leitura (`read_only: true`)

## Alvo

- Container: `supabase_db_vendeo-homolog`
- Publicação: `0.0.0.0:57782,[::]:57782`
- Banco: `postgres`
- Versão do servidor: 17.6

## Ledger

| Campo | Valor |
|---|---|
| Contagem | 159 |
| Maior versão | `20261126223854` |
| SHA-256 | `08760c54f307275a0dfeca30ad1ea0de25650f7b77272649eb9ff8ba4a23b123` |

## Tabelas preservadas

| Tabela | Contagem atual | Contagem baseline | Igual | MD5 atual |
|---|---|---|---|---|
| trial_offer_enrollments | 1 | 1 | sim | `3ffb438ba5d04e0252746c02d81d15d8` |
| credit_balances | 41 | 41 | sim | `3469aa81fd61f6e3ac708466d1f40a07` |
| credit_transactions | 265 | 265 | sim | `79910afd9ef6895d8f8bb6a23986cdbb` |
| freemium_entitlements | 1 | 1 | sim | `3a7efe44c372747b2956205aee867ed2` |

## Vigência

- `current_version_id`: NULL
- Rótulo esperado: NULL
- Igual ao esperado: true

## Guardas de schema

- Hashes das cinco funções iguais: true
- Colunas de `trial_offer_enrollments` iguais: true
- Colunas de `trial_offer_settings` adicionadas: ["current_version_id"]
- Colunas de `trial_offer_settings` removidas: []
- Adição esperada: true

## Fixtures de teste (`f63test-`)

- Publicadas (inertes): []
- Rascunhos: []
- Referenciadas pela vigência: []

## Checks

| Check | Resultado |
|---|---|
| target_identity_ok | ok |
| ledger_delta_ok | ok |
| preserved_equal | ok |
| settings_guard_equal | ok |
| current_version_ok | ok |
| schema_functions_equal | ok |
| enrollments_columns_equal | ok |
| settings_columns_expected | ok |
| versions_ok | ok |
| test_rows_inert | ok |
