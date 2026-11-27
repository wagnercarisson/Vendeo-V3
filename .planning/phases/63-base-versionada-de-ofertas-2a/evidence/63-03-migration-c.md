# F63 / 63-03 — Migration C aplicada no homolog (correção forward-only do publisher)

**Fase:** 63 — base versionada de ofertas (subfatia 2A)
**Plano:** 63-03 (wave 3)
**Estágio:** `post-c`
**Modo:** aplicação transacional única no homolog local existente

## 1. Imutabilidade da Migration A

| Momento | Arquivo | SHA-256 |
|---|---|---|
| Antes de criar C | `supabase/migrations/20261126223854_offer_catalog_versions.sql` | `ED652A26FC9294CDC239A842C2AEBB00CCC1A182FF39E9DAE13DEF947F8329BC` |
| Depois de aplicar C | `supabase/migrations/20261126223854_offer_catalog_versions.sql` | `ED652A26FC9294CDC239A842C2AEBB00CCC1A182FF39E9DAE13DEF947F8329BC` |

A Migration A **não foi editada, renomeada nem reaplicada**. O hash permanece byte-idêntico
ao registrado no 63-02. Toda a correção é forward-only pela Migration C.

## 2. Migration C e timestamp

| Campo | Valor |
|---|---|
| Arquivo | `supabase/migrations/20261126231022_offer_catalog_published_by_fix.sql` |
| `version` | `20261126231022` |
| `name` | `offer_catalog_published_by_fix` |
| Timestamp | instante real de criação (UTC, 14 dígitos) — 2026-11-26 23:10:22 UTC |
| `version` > Migration B (`20261126230735`) | sim |
| Unicidade no worktree | 0 arquivos com o prefixo |
| Unicidade em `git log --all` (migrations) | 0 ocorrências de `supabase/migrations/20261126231022_` |
| `file_sha256` | `817cbd8a946ac3ee4f1d3e8080cdba175866d9be44bdde6b83f03eb1cd1d549c` |
| `wrapper_sha256` | `92b02ae801dde1452e5fdae8710f0e68db051218f2218438a85f918055074bfc` |
| Encoding | UTF-8 sem BOM |
| Linhas | 255 |

Conteúdo: apenas `CREATE OR REPLACE FUNCTION public.trial_offer_versions_guard()`,
`REVOKE ALL ... FROM PUBLIC, anon, authenticated` + `GRANT EXECUTE ... TO service_role` e
bloco `-- REVERT` comentado. Nenhuma tabela, coluna, constraint, dado, outra função ou
grant de tabela foi alterado. A linha do ledger foi inserida pelo wrapper transacional do
aplicador na mesma transação.

## 3. Aplicação

| Campo | Valor |
|---|---|
| Executado em (UTC) | `2026-11-26T23:11:05.199Z` |
| `--stage` | `post-c` |
| `exit_code` | 0 |
| `duration_ms` | 134 |
| Erros / SQLSTATE | nenhum (aplicação bem-sucedida; nenhum erro emitido) |

## 4. Ledger

| Momento | Contagem | SHA-256 |
|---|---|---|
| Antes | 160 | `b7b441c792d570d2155576faf028e7c0db04db723c8d4ff5db246726cc6246fa` |
| Depois | 161 | `d95abc29958780f9021c8c9e9f5b5b2db33a8d4924cbbb2700cfc468c8dd0b0e` |

Delta = +1 (baseline 158 -> 159 -> 160 -> 161). Últimas linhas:

| Versão | Nome |
|---|---|
| `20261126231022` | `offer_catalog_published_by_fix` |
| `20261126230735` | `offer_catalog_seed_v1` |
| `20261126223854` | `offer_catalog_versions` |

## 5. Inventário da função substituída

`public.trial_offer_versions_guard()` (leitura read-only pós-aplicação):

| Atributo | Valor |
|---|---|
| `provolatile` | `v` (VOLATILE; padrão de função PL/pgSQL de trigger) |
| `prosecdef` | `false` (SECURITY INVOKER) |
| `proconfig` | `search_path=""` |
| `md5(pg_get_functiondef(...))` | `b34efa4421273ae70338ebdd4c2c6544` |
| `EXECUTE` para `anon` | `false` |
| `EXECUTE` para `authenticated` | `false` |
| `EXECUTE` para `service_role` | `true` |
| Comentário da função | preservado da Migration A (não alterado por C; ver §8) |

Nenhum `ALTER TABLE`, `CREATE TABLE`, `DROP TABLE`, `INSERT`/`DELETE` em
`public.trial_offer_versions` ou `UPDATE public.trial_offer_*` no corpo executável.

## 6. Smoke comportamental do publisher (transação com ROLLBACK)

Executado em UMA transação (`BEGIN; ... ROLLBACK;`), com dois usuários fixture em
`auth.users` criados na própria transação. Log completo em `63-03-publisher-smoke.log`.

| # | Cenário | Resultado esperado | Resultado observado |
|---|---|---|---|
| 1 | INSERT de rascunho com `published_by` preenchido | rejeitado P0001 `trial_offer_publisher_requires_publication` | rejeitado (`SMOKE_CASE1_OK`) |
| 2 | INSERT de rascunho + UPDATE para publicado com `published_by` NULL→UUID | aceito; `published_at`, motivo e condições conforme | aceito (`SMOKE_CASE2_OK`) |
| 3 | UPDATE de versão publicada trocando `published_by` para outro UUID | rejeitado P0001 `trial_offer_version_author_immutable` | rejeitado (`SMOKE_CASE3_OK`) |
| 4 | UPDATE da mesma versão publicada `published_by` UUID→NULL | aceito; condições/`published_at`/motivo/`created_at` inalterados | aceito (`SMOKE_CASE4_OK`) |
| 5 | UPDATE rascunho→rascunho definindo `published_by` | rejeitado P0001 `trial_offer_publisher_requires_publication` | rejeitado (`SMOKE_CASE5_OK`) |
| 6 | `created_by` NOT NULL→NULL aceito; troca para UUID rejeitada | aceito + P0001 `trial_offer_version_author_immutable` | aceito + rejeitado (`SMOKE_CASE6_OK`) |

Dentro da transação, 3 linhas `f63test-smoke-%` existiam como prova de execução
(`SMOKE_IN_TRANSACTION_ROWS=3`). Após o `ROLLBACK`, a verificação read-only confirmou:

| Verificação pós-rollback | Valor |
|---|---|
| `count(*)` em `trial_offer_versions` | 1 (somente a v1) |
| Linhas `version_label LIKE 'f63test-%'` | 0 |
| `count(*)` em `auth.users` | 44 (igual ao pré-smoke) |
| Usuários fixture `f63-smoke-%` | 0 |

Nenhuma linha residual. Nenhuma condição/published_at de negócio foi alterada de forma
persistente.

## 7. Preservação post-c (baseline 63-01)

| Tabela | Count | MD5 | Igual ao baseline |
|---|---|---|---|
| `trial_offer_enrollments` | 1 | `3ffb438ba5d04e0252746c02d81d15d8` | sim |
| `credit_balances` | 41 | `3469aa81fd61f6e3ac708466d1f40a07` | sim |
| `credit_transactions` | 265 | `79910afd9ef6895d8f8bb6a23986cdbb` | sim |
| `freemium_entitlements` | 1 | `3a7efe44c372747b2956205aee867ed2` | sim |

`preservation-report.mjs --stage post-c` exit 0. Checks todos `true`:
`target_identity_ok`, `ledger_delta_ok` (delta 3), `preserved_equal`, `settings_guard_equal`,
`current_version_ok` (v1), `schema_functions_equal`, `enrollments_columns_equal`,
`settings_columns_expected`, `versions_ok`, `test_rows_inert`. Ledger `count = 161`,
`sha256` presente. `test_created_rows` vazio (smoke rodou em rollback).
`trial_offer_settings_columns.added = ["current_version_id"]`, `removed = []`.

Efeitos esperados e somente eles: v1 publicada/vigente, `current_version_id` NOT NULL,
ledger +1 por migration (B e C), substituição do guard de publicação. Nenhuma tabela
preservada alterada; `enabled`/`individual_launch_at` inalterados.

## 8. Observação de documentação (sem impacto funcional)

O `COMMENT ON FUNCTION` da Migration A continua descrevendo a política antiga de autoria
(“Autoria só pode ir para NULL por ação referencial”). A Migration C foi restrita, por
autorização, a `CREATE OR REPLACE FUNCTION` + `REVOKE`/`GRANT` + `REVERT` comentado, sem
`COMMENT ON`. O comentário do catálogo está, portanto, desatualizado em relação ao novo
comportamento (primeira publicação aceita `published_by` NULL→UUID). Isso **não altera
comportamento**; uma futura migration pode atualizar o comentário se desejado. Registrado
como pendência documental, não como efeito da migration.

## 9. Escopo não executado

- Migration A não editada/renomeada/reaplicada.
- Nenhuma tabela, coluna, constraint, índice, política ou grant de tabela alterado por C.
- Nenhum dado de negócio criado/alterado/excluído; nenhum backfill.
- Nenhum consumidor (`constants.ts`, `status.ts`, `completion.ts`, copy, Admin, flags, RPCs)
  alterado ou religado.
- F57.2 não reexecutado; re-baseline fora de escopo (fingerprint `f57_2_` passa a divergir
  com +3 linhas no ledger).
- Produção e bancos remotos não acessados. Nada foi commitado, enviado (push) ou implantado
  (deploy).
