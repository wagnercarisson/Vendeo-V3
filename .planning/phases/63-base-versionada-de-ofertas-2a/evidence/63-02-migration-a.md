# F63 / 63-02 — Migration A aplicada no homolog (estrutura versionada)

**Fase:** 63 — base versionada de ofertas (subfatia 2A)
**Plano:** 63-02 (wave 2)
**Estágio:** `post-a` (estrutura aplicada; seed/vigência pertencem à Migration B)
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

Invariante confirmada: host 57782 -> container 5432, banco `postgres`, alvo SQL lógico
`127.0.0.1:57782/postgres`. O mapeamento `0.0.0.0:57782,[::]:57782` foi aceito e o acesso
SQL ocorreu exclusivamente dentro do container (`docker exec psql`). Nenhum banco foi
criado, nenhum reset ocorreu, nenhum backup foi exigido e nenhum comando remoto foi usado.

## 2. Migration e timestamp

| Campo | Valor |
|---|---|
| Arquivo | `supabase/migrations/20261126223854_offer_catalog_versions.sql` |
| `version` | `20261126223854` |
| `name` | `offer_catalog_versions` |
| Timestamp | instante real de criação (UTC, 14 dígitos), gerado em 2026-11-26 22:38:54 UTC |
| Unicidade no worktree | 0 arquivos com o prefixo |
| Unicidade em `git log --all` (migrations) | 0 ocorrências de `supabase/migrations/20261126223854_` |
| Arquivos do mesmo dia em `supabase/migrations/` | 0 |
| `file_sha256` | `ed652a26fc9294cdc239a842c2aebb00ccc1a182ff39e9dae13def947f8329bc` |
| `wrapper_sha256` | `a402de570fa49a55fddf47185a74e4296219bdbb70a9581d470bb949f9e4f3a8` |

Nenhum timestamp reservado/importado do 63-01 foi usado. O valor foi conferido
imediatamente antes da escrita (worktree, histórico de todas as branches e mesmo dia).

## 3. Aplicação

| Campo | Valor |
|---|---|
| Executado em (UTC) | `2026-11-26T22:40:19.610Z` |
| `exit_code` | 0 |
| `duration_ms` | 584 |
| Transação | `BEGIN; SET LOCAL lock_timeout='10s'; SET LOCAL statement_timeout='180s'; <migration>; INSERT ledger; COMMIT;` |
| Erros/SQLSTATE | nenhum (aplicação bem-sucedida; nenhum erro emitido) |

A linha do ledger `supabase_migrations.schema_migrations` (`version`, `name`) foi inserida
na MESMA transação do DDL. Não houve falha; portanto não houve rollback nem DDL parcial.
O aplicador nunca imprime connection string, senha, JWT ou variável de ambiente.
O wrapper inclui `\set VERBOSITY verbose` (meta-comando do psql, fora da transação) apenas
para que eventuais falhas tragam SQLSTATE no log; não altera a semântica transacional.
O log UTF-8 está em `63-02-migration-a.log` e a evidência pinada em `63-02-migration-a.json`.

## 4. Ledger

| Momento | Contagem | SHA-256 |
|---|---|---|
| Antes | 158 | `5f9a2c6263982cb144af9d933e71a7a8445d5f1466c745d9f02d63fa71b46365` |
| Depois | 159 | `08760c54f307275a0dfeca30ad1ea0de25650f7b77272649eb9ff8ba4a23b123` |

Delta = +1. A versão `20261126223854` aparece exatamente 1 vez, com nome
`offer_catalog_versions`, e é a maior versão do ledger.

## 5. Inventário de objetos e ACL (SQL read-only)

### 5.1 `public.trial_offer_versions`

- Tabela presente; `relrowsecurity = true`; `count(*) = 0` (nenhuma versão semeada).
- Colunas (13): `id`, `offer_key`, `version_label`, `public_name`, `duration_days`,
  `max_total_credits`, `release_frequency`, `credits_per_release`, `published_at`,
  `published_by`, `publication_reason`, `created_by`, `created_at`.
- Policy: exatamente `trial_offer_versions_service_role_all` (`FOR ALL`, role
  `service_role`, `USING true`, `WITH CHECK true`). Nenhuma policy pública.
- ACL: `anon`/`authenticated` sem SELECT/INSERT/UPDATE/DELETE;
  `service_role` com SELECT/INSERT/UPDATE/DELETE.

Constraints:

| Nome | Tipo | Definição |
|---|---|---|
| `chk_tov_duration_days` | CHECK | `duration_days > 0` |
| `chk_tov_max_total_credits` | CHECK | `max_total_credits > 0` |
| `chk_tov_release_frequency` | CHECK | `release_frequency IN ('once','daily','weekly','monthly')` |
| `chk_tov_credits_per_release` | CHECK | `once` -> `credits_per_release IS NULL`; recorrente -> não nulo, `> 0` e `<= max_total_credits` |
| `chk_tov_version_label_not_blank` | CHECK | `btrim(version_label) <> ''` |
| `chk_tov_public_name_not_blank` | CHECK | `btrim(public_name) <> ''` |
| `uq_tov_offer_key_version_label` | UNIQUE | `(offer_key, version_label)` |
| `uq_tov_id_offer_key` | UNIQUE | `(id, offer_key)` (alvo da FK composta) |
| `fk_tov_offer_key` | FK | `offer_key -> trial_offer_settings(offer_key)`, `confdeltype = r` |
| `fk_tov_created_by` | FK | `created_by -> auth.users(id)`, `confdeltype = n` |
| `fk_tov_published_by` | FK | `published_by -> auth.users(id)`, `confdeltype = n` |

Triggers:

| Trigger | Tabela | Evento |
|---|---|---|
| `trg_trial_offer_versions_guard` | `trial_offer_versions` | `BEFORE INSERT OR UPDATE` |
| `trg_trial_offer_versions_guard_delete` | `trial_offer_versions` | `BEFORE DELETE` |
| `trg_trial_offer_settings_guard_current_version` | `trial_offer_settings` | `BEFORE INSERT OR UPDATE` |

### 5.2 `trial_offer_settings.current_version_id`

- Coluna `uuid`, sem default, `is_nullable = YES`, valor atual `NULL`.
- FK composta `fk_trial_offer_settings_current_version`
  (`(current_version_id, offer_key) -> trial_offer_versions(id, offer_key)`),
  `confdeltype = r` (RESTRICT).
- Colunas após a migration: `id`, `offer_key`, `enabled`, `launch_at`, `updated_by`,
  `updated_at`, `created_at`, `individual_launch_at`, `current_version_id` (bare names).

### 5.3 Funções

| Assinatura | `provolatile` | `prosecdef` | `proconfig` | anon/authenticated | service_role |
|---|---|---|---|---|---|
| `trial_offer_calendar_reaches_total(text,integer,integer,integer)` | `i` (IMMUTABLE) | `false` (INVOKER) | `search_path=""` | EXECUTE false | EXECUTE true |
| `trial_offer_conditions(uuid)` | `s` (STABLE) | `true` (DEFINER) | `search_path=""` | EXECUTE false | EXECUTE true |
| `trial_offer_public_offer()` | `s` (STABLE) | `true` (DEFINER) | `search_path=""` | EXECUTE false | EXECUTE true |
| `trial_offer_release_schedule(uuid,timestamptz)` | `s` (STABLE) | `true` (DEFINER) | `search_path=""`, `TimeZone=UTC` | EXECUTE false | EXECUTE true |

## 6. Preservação (baseline 63-01)

| Tabela | Count | MD5 | Igual ao baseline |
|---|---|---|---|
| `trial_offer_enrollments` | 1 | `3ffb438ba5d04e0252746c02d81d15d8` | sim |
| `credit_balances` | 41 | `3469aa81fd61f6e3ac708466d1f40a07` | sim |
| `credit_transactions` | 265 | `79910afd9ef6895d8f8bb6a23986cdbb` | sim |
| `freemium_entitlements` | 1 | `3a7efe44c372747b2956205aee867ed2` | sim |

- `settings_guard` (oito campos pré-existentes, incluindo `individual_launch_at`) idêntico
  ao baseline (`equal: true`); `current_version_id` nulo e nullable como esperado.
- Hashes das cinco RPCs existentes inalterados (`functions_md5_match: true`).
- Colunas de `trial_offer_enrollments` inalteradas (`enrollments_columns_equal: true`).
- Colunas de `trial_offer_settings`: `added = ["current_version_id"]`, `removed = []`.
- `checks` do relatório: todos `true`, incluindo `versions_ok` (zero linhas) e
  `test_rows_inert`. Nenhuma linha de teste foi criada nesta etapa.

Efeitos esperados da Migration A, e somente eles: tabela/funções/triggers/coluna e
ledger +1. Nenhuma linha de `trial_offer_versions`; nenhum valor em `current_version_id`.

## 7. F57.2 e escopo não executado

- O F57.2 NÃO foi executado nesta entrega. Seu fingerprint filtra nomes `f57_2_`; como o
  ledger ganhou +1 linha, o fingerprint armazenado do F57.2 passa a divergir. O
  re-baseline do F57.2 está explicitamente FORA de escopo.
- A Migration B (seed da v1, `current_version_id` = v1 e `NOT NULL`) NÃO foi criada nem
  aplicada. `current_version_id` permanece nullable e `NULL`; `trial_offer_versions`
  permanece vazia.
- Produção e bancos remotos não foram acessados. A validação é salvaguarda de homolog e
  não equivale a aprovação de produção.
- Nada foi commitado, enviado (push) ou implantado (deploy).
