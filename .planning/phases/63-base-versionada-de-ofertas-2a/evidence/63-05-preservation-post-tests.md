# F63 — Relatório de preservação (post-tests)

**Fase:** 63
**Estágio:** `post-tests`
**Capturado (UTC):** 2026-11-26T23:37:13.407Z
**Modo:** somente leitura (`read_only: true`)

## Alvo

- Container: `supabase_db_vendeo-homolog`
- Publicação: `0.0.0.0:57782,[::]:57782`
- Banco: `postgres`
- Versão do servidor: 17.6

## Ledger

| Campo | Valor |
|---|---|
| Contagem | 161 |
| Maior versão | `20261126231022` |
| SHA-256 | `d95abc29958780f9021c8c9e9f5b5b2db33a8d4924cbbb2700cfc468c8dd0b0e` |

## Tabelas preservadas

| Tabela | Contagem atual | Contagem baseline | Igual | MD5 atual |
|---|---|---|---|---|
| trial_offer_enrollments | 1 | 1 | sim | `3ffb438ba5d04e0252746c02d81d15d8` |
| credit_balances | 41 | 41 | sim | `3469aa81fd61f6e3ac708466d1f40a07` |
| credit_transactions | 265 | 265 | sim | `79910afd9ef6895d8f8bb6a23986cdbb` |
| freemium_entitlements | 1 | 1 | sim | `3a7efe44c372747b2956205aee867ed2` |

## Vigência

- `current_version_id`: 426783dc-5918-447e-8cae-bb9ee917df25
- Rótulo esperado: v1
- Igual ao esperado: true

## Guardas de schema

- Hashes das cinco funções iguais: true
- Colunas de `trial_offer_enrollments` iguais: true
- Colunas de `trial_offer_settings` adicionadas: ["current_version_id"]
- Colunas de `trial_offer_settings` removidas: []
- Adição esperada: true

## Fixtures de teste (`f63test-`)

- Publicadas (inertes): ["f63test-conc-1795736131892-p1v7b3-edit-pub","f63test-conc-1795736131892-p1v7b3-pub-edit","f63test-conc-1795736131892-p1v7b3-pub-race","f63test-conc-1795736131892-p1v7b3-vig-x","f63test-conc-1795736131892-p1v7b3-vig-y","f63test-conc-1795736146589-glm0l4-edit-pub","f63test-conc-1795736146589-glm0l4-pub-edit","f63test-conc-1795736146589-glm0l4-pub-race","f63test-conc-1795736146589-glm0l4-vig-x","f63test-conc-1795736146589-glm0l4-vig-y","f63test-conc-1795736230870-am59ru-edit-pub","f63test-conc-1795736230870-am59ru-pub-edit","f63test-conc-1795736230870-am59ru-pub-race","f63test-conc-1795736230870-am59ru-vig-x","f63test-conc-1795736230870-am59ru-vig-y"]
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
