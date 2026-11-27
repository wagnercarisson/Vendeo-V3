# F63 / 63-03 — Migration B aplicada no homolog (seed v1 + vigência + NOT NULL)

**Fase:** 63 — base versionada de ofertas (subfatia 2A)
**Plano:** 63-03 (wave 3)
**Estágio:** `post-b`
**Modo:** aplicação transacional única no homolog local existente

## 1. Identidade do alvo (read-only)

| Campo | Valor |
|---|---|
| Workdir | `G:\Vendeo-Homolog` |
| Container | `supabase_db_vendeo-homolog` |
| Imagem | `public.ecr.aws/supabase/postgres:17.6.1.132` |
| Publicação real | `0.0.0.0:57782,[::]:57782` |
| Porta interna | 5432 |
| Banco | `postgres` |
| Versão do servidor | 17.6 |

Invariante confirmada antes da escrita: host 57782 -> container 5432, banco `postgres`,
alvo SQL lógico `127.0.0.1:57782/postgres`. Acesso SQL exclusivamente dentro do container
(`docker exec psql`). Nenhum banco criado, nenhum reset, nenhum backup, nenhum comando
remoto, nenhum `db push`, nenhum `supabase link`.

## 2. Migration e timestamp

| Campo | Valor |
|---|---|
| Arquivo | `supabase/migrations/20261126230735_offer_catalog_seed_v1.sql` |
| `version` | `20261126230735` |
| `name` | `offer_catalog_seed_v1` |
| Timestamp | instante real de criação (UTC, 14 dígitos) — 2026-11-26 23:07:35 UTC |
| `version` > Migration A (`20261126223854`) | sim |
| Unicidade no worktree | 0 arquivos com o prefixo |
| Unicidade em `git log --all` (migrations) | 0 ocorrências de `supabase/migrations/20261126230735_` |
| Branches conferidas | `feat/onboarding-responsavel-cnpj-opcional`, `main`, `feature/fase-44-temas-de-campanha-v2`, `backup/antes-reversao-f47-20261025-114407` (+ refs remotas `origin/main`, `origin/feature/fase-44-temas-de-campanha-v2`) |
| `file_sha256` | `e511295e7b7419431f05b9a112258afd3c3651de23ecd85d384ee9d26115c4b7` |
| `wrapper_sha256` | `8d675c1be832acb809157da2498300e77ed7b2fc8f4d39e4987e44087f85b06b` |
| Encoding | UTF-8 sem BOM |
| Linhas | 484 |

## 3. Aplicação

| Campo | Valor |
|---|---|
| Executado em (UTC) | `2026-11-26T23:09:30.692Z` |
| `--stage` | `post-b` |
| `exit_code` | 0 |
| `duration_ms` | 185 |
| Transação | `BEGIN; SET LOCAL lock_timeout='10s'; SET LOCAL statement_timeout='180s'; <migration>; INSERT ledger; COMMIT;` |
| Erros / SQLSTATE | nenhum (aplicação bem-sucedida; nenhum erro emitido) |

A linha do ledger foi inserida na MESMA transação da migration. Não houve falha; portanto
não houve rollback nem efeito parcial. O log UTF-8 está em `63-03-migration-b.log` e a
evidência pinada em `63-03-migration-b.json`.

## 4. Ledger

| Momento | Contagem | SHA-256 |
|---|---|---|
| Antes | 159 | `08760c54f307275a0dfeca30ad1ea0de25650f7b77272649eb9ff8ba4a23b123` |
| Depois | 160 | `b7b441c792d570d2155576faf028e7c0db04db723c8d4ff5db246726cc6246fa` |

Delta = +1 (baseline 158 -> 159 -> 160). Últimas linhas:

| Versão | Nome |
|---|---|
| `20261126230735` | `offer_catalog_seed_v1` |
| `20261126223854` | `offer_catalog_versions` |
| `20261123130252` | `f62_campaign_format_addition` |

## 5. Seed v1 (leitura read-only pós-aplicação)

| Campo | Valor |
|---|---|
| `id` | `426783dc-5918-447e-8cae-bb9ee917df25` |
| `offer_key` | `trial_28d_v1` |
| `version_label` | `v1` |
| `public_name` | `Teste gratuito de 28 dias` |
| `duration_days` | 28 |
| `max_total_credits` | 20 |
| `release_frequency` | `weekly` |
| `credits_per_release` | 5 |
| `published_at` | `2026-11-26T23:09:30.486856+00:00` (não nulo) |
| `publication_reason` | `publicação inicial da oferta vigente` |
| `published_by` | `NULL` |
| `created_by` | `NULL` |

Exatamente 1 linha em `public.trial_offer_versions` (total = 1, publicadas = 1, rascunhos = 0).

## 6. Vigência e NOT NULL

| Campo | Valor |
|---|---|
| `current_version_id` | `426783dc-5918-447e-8cae-bb9ee917df25` (id da v1) |
| `is_nullable` | `NO` (`attnotnull = true`) |
| Linhas de `trial_offer_settings` sem vigência | 0 (exigido antes de `SET NOT NULL`) |
| Linha singleton | 1 (`offer_key = 'trial_28d_v1'`) |

Os oito campos pré-existentes permanecem idênticos ao baseline (`settings_guard.equal = true`):

| Campo | Valor |
|---|---|
| `id` | `dcb1b4d5-98ea-4011-8212-e2603c2e4f60` |
| `enabled` | `true` (inalterado) |
| `launch_at` | `2026-10-28T21:22:16.361965+00:00` (inalterado) |
| `individual_launch_at` | `NULL` (inalterado) |
| `updated_by` | `1273d07b-c2d1-48c9-88ca-9acfe6c0ac14` (inalterado) |
| `updated_at` | `2026-10-28T21:22:16.361965+00:00` (inalterado) |
| `created_at` | `2026-10-26T20:48:15.88138+00:00` (inalterado) |
| `offer_key` | `trial_28d_v1` (inalterado) |

A única alteração em `trial_offer_settings` é `current_version_id` (valor + `NOT NULL`).

## 7. Calendário real (função `trial_offer_release_schedule`)

`trial_offer_release_schedule('426783dc-…', '2026-03-10 09:30:00+00')`:

| `seq` | `amount` | `due_at` |
|---|---|---|
| 0 | 5 | `2026-03-10T09:30:00+00:00` |
| 1 | 5 | `2026-03-17T09:30:00+00:00` |
| 2 | 5 | `2026-03-24T09:30:00+00:00` |
| 3 | 5 | `2026-03-31T09:30:00+00:00` |

`total = 20`; `expires_at = 2026-04-07T09:30:00+00:00`.

`trial_offer_release_schedule('426783dc-…', '2026-12-28 23:00:00+00')`:

| `seq` | `amount` | `due_at` |
|---|---|---|
| 0 | 5 | `2026-12-28T23:00:00+00:00` |
| 1 | 5 | `2027-01-04T23:00:00+00:00` |
| 2 | 5 | `2027-01-11T23:00:00+00:00` |
| 3 | 5 | `2027-01-18T23:00:00+00:00` |

`total = 20`; `expires_at = 2027-01-25T23:00:00+00:00`. O resultado não depende da data de
início: sempre 4 liberações de 5 nos dias 0, 7, 14 e 21, total 20.

## 8. Contratos de leitura

`trial_offer_conditions()` (sem id, resolve a vigente) retorna exatamente nove chaves:

```json
{"offer_key":"trial_28d_v1","version_id":"426783dc-5918-447e-8cae-bb9ee917df25","version_label":"v1","public_name":"Teste gratuito de 28 dias","duration_days":28,"max_total_credits":20,"release_frequency":"weekly","credits_per_release":5,"published_at":"2026-11-26T23:09:30.486856+00:00"}
```

`trial_offer_conditions('426783dc-…')` retorna as mesmas nove chaves e valores.

`trial_offer_public_offer()` retorna exatamente seis chaves, sem `id`/`offer_key`/`version_id`/
`published_by`/`created_by`/`publication_reason`/`release_count`/`releases`:

```json
{"version_label":"v1","public_name":"Teste gratuito de 28 dias","duration_days":28,"max_total_credits":20,"release_frequency":"weekly","credits_per_release":5}
```

`trial_offer_conditions('00000000-0000-4000-8000-0000000000ff')` falha fechado com
`ERROR: trial_offer_version_not_found` (P0001), sem retorno parcial.

## 9. Preservação (baseline 63-01)

| Tabela | Count | MD5 | Igual ao baseline |
|---|---|---|---|
| `trial_offer_enrollments` | 1 | `3ffb438ba5d04e0252746c02d81d15d8` | sim |
| `credit_balances` | 41 | `3469aa81fd61f6e3ac708466d1f40a07` | sim |
| `credit_transactions` | 265 | `79910afd9ef6895d8f8bb6a23986cdbb` | sim |
| `freemium_entitlements` | 1 | `3a7efe44c372747b2956205aee867ed2` | sim |

`preservation-report.mjs --stage post-b` exit 0: `preserved_equal = true`,
`settings_equal = true`, `ledger_delta_ok = true` (delta 2), `ledger.count = 160`,
`ledger.sha256` presente, `versions_ok = true`, `test_rows_inert = true`.
`functions_md5_match = true` (cinco RPCs existentes intactas); `enrollments_columns_equal = true`;
`trial_offer_settings_columns.added = ["current_version_id"]`, `removed = []`.

O snapshot de preservação da própria migration (temporário, na mesma transação) comparou as
quatro tabelas antes e depois e abriu caminho sem divergência (`F63_PRESERVED_TABLE_CHANGED`
não foi disparado). A guarda dos oito campos de `trial_offer_settings` também não divergiu
(`F63_SETTINGS_GUARD_CHANGED` não foi disparado).

Efeitos esperados da Migration B, e somente eles: linha v1 publicada, `current_version_id`
preenchido + `NOT NULL`, ledger +1. `enabled` e `individual_launch_at` não mudaram.

## 10. F57.2 e escopo não executado

- O F57.2 NÃO foi executado nesta entrega. Seu fingerprint filtra nomes `f57_2_`; com o
  ledger em 160 (baseline 158) o fingerprint armazenado do F57.2 passa a divergir (+2 linhas
  nesta etapa; +3 após a Migration C). O re-baseline do F57.2 está explicitamente FORA de
  escopo.
- Nenhuma tabela preservada foi alterada; nenhuma concessão, crédito, transação ou
  entitlement foi tocado. Nenhum backfill.
- Nenhum consumidor (`constants.ts`, `status.ts`, `completion.ts`, copy, Admin, flags, RPCs)
  foi alterado ou religado.
- Produção e bancos remotos não foram acessados. A validação é salvaguarda de homolog e não
  equivale a aprovação de produção.
- Nada foi commitado, enviado (push) ou implantado (deploy).
