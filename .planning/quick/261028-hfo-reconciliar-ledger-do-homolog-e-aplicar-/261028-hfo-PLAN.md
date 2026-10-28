# Quick 261028-hfo — Reconciliar ledger do homolog e aplicar duas migrations antigas

**Status:** AUTORIZADO (opção A) — 2026-10-28, com dois ajustes de revisão incorporados
**Data:** 2026-10-28
**Alvo:** ambiente `vendeo-homolog` (somente ele)

---

## 1. Identidade confirmada (preflight somente leitura)

| Item | Confirmado |
|------|-----------|
| Repositório | `C:\Projetos\Vendeo V3` |
| Branch | `feature/fase-57-2-preferencias-multimercado` |
| HEAD | `d3f7e91318c1fde590e6c608d8c3a8c466bb739d` |
| Worktree | única: `C:/Projetos/Vendeo V3` (sem worktrees paralelas) |
| `git status` | limpo (nenhuma alteração alheia a preservar) |
| Workdir do homolog | `G:\Vendeo-Homolog` (NÃO é repositório git) |
| Container DB | `supabase_db_vendeo-homolog` (`postgres:17.6.1.132`) |
| Porta | `0.0.0.0:57782->5432` |
| `current_database()` / `current_user` | `postgres` / `postgres` |
| Versão PG | PostgreSQL 17.6 |
| API/Studio do ambiente | Kong `57781`, Studio `57783` (não serão tocados) |

Produção não é acessível por este procedimento: não há `--linked`, não há URL remota e todos os comandos usam `docker exec` no container acima.

---

## 2. Estado real do ledger (baseline)

`supabase_migrations.schema_migrations`:

```
version          text NOT NULL   (PK)
statements       text[]          (nullable; 99 de 147 linhas estão NULL)
name             text
```

- Total: **147** linhas, **147** versões distintas (sem duplicatas).
- `20261021000001` → `name = f47_1_visual_signature_model_config`, `statements` com **21** statements.
- `20261024141422`: **ausente**.
- `20261020000005`: **ausente**.
- `20261028145738` (F57.2): **ausente** — não será aplicada.

Evidência preservada em `.planning/quick/261028-hfo-.../evidence/`:
- `ledger-before.txt` (147 linhas: version | name | qtd statements | md5 do array)
- `f47_1-ledger-row-before.json` (linha completa, incluindo os 21 statements)
- `admin_audit_log_action_check-before.txt`
- `chk_stores_cnpj_atomic-before.txt`
- `counts-before.txt`
- `file-hashes-before.txt`

### Hashes SHA-256 dos arquivos envolvidos

```
5dba88abccc7ee5bde640c64fb4509aabe90fc93d587b755c1e735bf860b8559  5934   supabase/migrations/20261020000005_beta_access_invite.sql
6d8097635686963a7c5df6c44381b7c63d9f9584db10d1e700856002b17cd240  6435   supabase/migrations/20261021000001_f50_3_cnpj_alfanumerico.sql
03ebfb1783f79af99a89828324f0c2be9f9053feb499e21b10ef3fc3bff983d9 18467   supabase/migrations/20261024141422_f47_1_visual_signature_model_config.sql
b352f93efa1b2f829e5d97ffaa79f7972cf3d7696c6b7ceb40ebfc517a26aa90 18067   G:\Vendeo-Homolog\supabase\migrations\20261021000001_f47_1_visual_signature_model_config.sql
```

F47.1: conteúdo **idêntico** entre repo (`20261024141422`, 18.467 bytes) e homolog (`20261021000001`, 18.067 bytes) após normalizar CRLF→LF; `equals_norm=True`. A diferença de bytes é apenas fim de linha.

### Unicidade de versões

- Repo: 150 arquivos, **0 prefixos duplicados**.
- Homolog: 147 arquivos, **0 prefixos duplicados**.
- `20261020000005`, `20261021000001`, `20261024141422` ocorrem **uma única vez** em cada árvore.

---

## 3. Estrutura atual (ausências confirmadas)

| Verificação | Resultado |
|-------------|-----------|
| 10 colunas de convite em `public.access_requests` | **0 de 10 presentes** |
| `chk_access_requests_invite_status` | ausente |
| `chk_stores_cnpj_atomic` | `^\d{14}$` (formato numérico antigo) |
| `public.cnpj_lookup_cache` | existe, com `cnpj_normalized` |
| `public.user_preferences` / `public.store_market_settings` (F57.2) | **ambas ausentes** |
| F47.1 aplicada sob `20261021000001` | confirmada |

### Pré-condições de `20261020000005_beta_access_invite.sql`

- `access_requests` existe (2 linhas), sem nenhuma coluna de convite → `ADD COLUMN IF NOT EXISTS` é aditivo e seguro.
- `admin_audit_log` existe (76 linhas).
- **(ver seção 5 — divergência que exige autorização)**.

### Pré-condições de `20261021000001_f50_3_cnpj_alfanumerico.sql`

| Preflight interno | Resultado no homolog |
|---|---|
| 1.1 `cnpj_normalized` fora de `^[A-Z0-9]{12}[0-9]{2}$` | **0** |
| 1.2 `cnpj_normalized` sem `cnpj_root_hash` | **0** |
| 1.3 razão/fantasia sem `cnpj_normalized` | **0** |
| 1.4 informativo alfanuméricos existentes | 0 (será NOTICE) |

As 2 lojas: `06923561000220` e `37055825000113`, ambas com `cnpj_root_hash` preenchido.

### Baseline de dados (para comparação pós-execução)

```
stores=2
auth_users=2
campaigns=70
storage_objects=149        (campaign-images=91, store-brand-assets=42, visual-signatures=16)
access_requests=2
admin_audit_log=76
```

---

## 4. Reconciliação proposta do ledger

```
UPDATE supabase_migrations.schema_migrations
   SET version = '20261024141422'
 WHERE version = '20261021000001'
   AND name = 'f47_1_visual_signature_model_config';
```

- `name` **não muda**: já corresponde ao arquivo atual `20261024141422_f47_1_visual_signature_model_config.sql`.
- `statements` preservados integralmente (21 statements originais).
- Nenhum SQL da F47.1 é reexecutado.
- Depois: `INSERT` de `20261020000005` (`beta_access_invite`) e `20261021000001` (`f50_3_cnpj_alfanumerico`), com `statements = NULL` (formato já usado em 99 das 147 linhas existentes).

Resultado esperado: **149 versões, 149 distintas**; `20261021000001` passa a identificar F50.3.

---

## 5. DIVERGÊNCIA ENCONTRADA — precisa de decisão

O arquivo `20261020000005_beta_access_invite.sql` recria `admin_audit_log_action_check` com a lista de **23** valores que existia na época. O homolog atual já está em **27** valores (F47.1 + F47.2 + F47.3 aplicadas depois):

Valores que seriam **perdidos** se o arquivo fosse aplicado isoladamente:
- `visual_signature_model_config_update`
- `visual_signature_model_config_reset`
- `visual_signature_model_config_publish`
- `visual_signature_model_config_activation`

Isso quebraria auditorias futuras de F47.x. Não é um erro de aplicação: é consequência de aplicar uma migration antiga fora da ordem histórica.

**Correção do preflight:** a afirmação inicial de que "nenhuma linha existente violaria a constraint menor" estava **incorreta**. Na execução real, a constraint de 23 valores foi rejeitada por **7 linhas** com `action = visual_signature_model_config_update`. O erro e o rollback estão registrados na seção 11.

**Nenhuma divergência nos demais pontos do diagnóstico.**

### Opções

**A — Recomendada: aplicar o arquivo como está + restauração compensatória na MESMA transação.**
Após o `\i` do arquivo beta, recriar `admin_audit_log_action_check` com os **27** valores atuais (definição idêntica à capturada no preflight). Efeito líquido em `admin_audit_log`: zero (drop/add duas vezes dentro da transação). Não reexecuta F47.1 como migration; é um comando compensatório explícito e documentado.

**B — Bloquear.**
Não aplicar `20261020000005` e aplicar somente F50.3 + reconciliação do ledger. Deixaria o convite beta estruturalmente ausente.

**C — Alterar o arquivo da migration** para incluir os 4 valores.
Rejeitada por contrariar o escopo ("não alterar migrations existentes").

---

## 6. Comandos exatos (após autorização)

Nenhum comando usa Supabase CLI, `--linked`, `reset`, `repair` ou atualização ampla.

### 6.1 Preparar artefatos dentro do container

```powershell
cd "C:\Projetos\Vendeo V3"
$Q = ".planning\quick\261028-hfo-reconciliar-ledger-do-homolog-e-aplicar-"
docker cp "$Q\evidence\apply.sql" supabase_db_vendeo-homolog:/tmp/quick-hfo-apply.sql
docker cp "supabase\migrations\20261020000005_beta_access_invite.sql" supabase_db_vendeo-homolog:/tmp/20261020000005.sql
docker cp "supabase\migrations\20261021000001_f50_3_cnpj_alfanumerico.sql" supabase_db_vendeo-homolog:/tmp/20261021000001.sql
docker exec supabase_db_vendeo-homolog sha256sum /tmp/quick-hfo-apply.sql /tmp/20261020000005.sql /tmp/20261021000001.sql
```

### 6.2 Conteúdo de `evidence/apply.sql` (uma única transação)

```sql
\set ON_ERROR_STOP on

-- 1. Reconciliação LOCAL da F47.1 (sem reexecutar SQL)
UPDATE supabase_migrations.schema_migrations
   SET version = '20261024141422'
 WHERE version = '20261021000001'
   AND name = 'f47_1_visual_signature_model_config';

DO $recon$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM supabase_migrations.schema_migrations
                  WHERE version = '20261024141422'
                    AND name = 'f47_1_visual_signature_model_config') THEN
    RAISE EXCEPTION 'reconciliation_failed';
  END IF;
  IF EXISTS (SELECT 1 FROM supabase_migrations.schema_migrations WHERE version = '20261021000001') THEN
    RAISE EXCEPTION 'reconciliation_left_old_version';
  END IF;
END;
$recon$;

-- 2. beta_access_invite (arquivo integral, sem edição)
\i /tmp/20261020000005.sql

-- 3. Compensação: restaura a lista de 27 actions vigente antes desta quick
ALTER TABLE public.admin_audit_log DROP CONSTRAINT IF EXISTS admin_audit_log_action_check;
ALTER TABLE public.admin_audit_log ADD CONSTRAINT admin_audit_log_action_check CHECK (action IN (
  'credit_grant', 'credit_adjustment', 'store_create_invite', 'manual_refund',
  'approve_verification', 'reject_verification', 'create_test_store', 'admin_exception',
  'reveal_cnpj', 'access_request_approve', 'access_request_reject', 'feature_flag_update',
  'ai_model_selection_update', 'ai_model_selection_reset', 'support_credit_request_update',
  'data_subject_request_received', 'data_subject_request_in_progress',
  'data_subject_request_completed', 'data_subject_request_cancelled',
  'data_subject_request_cancel_rejected',
  'image_model_pair_config_update',
  'product_1_1_pending_resolution',
  'access_request_invite',
  'visual_signature_model_config_update',
  'visual_signature_model_config_reset',
  'visual_signature_model_config_publish',
  'visual_signature_model_config_activation'
));

-- 4. f50_3 (arquivo integral, sem edição)
\i /tmp/20261021000001.sql

-- 5. Registro no ledger
INSERT INTO supabase_migrations.schema_migrations (version, name) VALUES
  ('20261020000005', 'beta_access_invite'),
  ('20261021000001', 'f50_3_cnpj_alfanumerico');

-- 6. Asserções estruturais DENTRO da transação (antes do commit)
--    Qualquer divergência => RAISE EXCEPTION => rollback total.
DO $final$
DECLARE
  v_total INT;
  v_distinct INT;
  v_cols INT;
  v_audit_def TEXT;
  v_audit_expected TEXT := $expected$CHECK ((action = ANY (ARRAY['credit_grant'::text, 'credit_adjustment'::text, 'store_create_invite'::text, 'manual_refund'::text, 'approve_verification'::text, 'reject_verification'::text, 'create_test_store'::text, 'admin_exception'::text, 'reveal_cnpj'::text, 'access_request_approve'::text, 'access_request_reject'::text, 'feature_flag_update'::text, 'ai_model_selection_update'::text, 'ai_model_selection_reset'::text, 'support_credit_request_update'::text, 'data_subject_request_received'::text, 'data_subject_request_in_progress'::text, 'data_subject_request_completed'::text, 'data_subject_request_cancelled'::text, 'data_subject_request_cancel_rejected'::text, 'image_model_pair_config_update'::text, 'product_1_1_pending_resolution'::text, 'access_request_invite'::text, 'visual_signature_model_config_update'::text, 'visual_signature_model_config_reset'::text, 'visual_signature_model_config_publish'::text, 'visual_signature_model_config_activation'::text])))$expected$;
  v_cnpj_def TEXT;
  v_cnpj_validated BOOLEAN;
BEGIN
  -- 6.1 Ledger: 149 versões, todas distintas
  SELECT count(*), count(DISTINCT version) INTO v_total, v_distinct
    FROM supabase_migrations.schema_migrations;
  IF v_total <> 149 OR v_distinct <> 149 THEN
    RAISE EXCEPTION 'ledger_final_invalid total=% distinct=%', v_total, v_distinct;
  END IF;

  -- 6.2 Versões esperadas
  IF NOT EXISTS (SELECT 1 FROM supabase_migrations.schema_migrations
                  WHERE version='20261024141422' AND name='f47_1_visual_signature_model_config') THEN
    RAISE EXCEPTION 'f47_1_version_missing';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM supabase_migrations.schema_migrations
                  WHERE version='20261020000005' AND name='beta_access_invite') THEN
    RAISE EXCEPTION 'beta_access_invite_ledger_missing';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM supabase_migrations.schema_migrations
                  WHERE version='20261021000001' AND name='f50_3_cnpj_alfanumerico') THEN
    RAISE EXCEPTION 'f50_3_ledger_missing';
  END IF;

  -- 6.3 F57.2 deve continuar ausente e não registrada
  IF EXISTS (SELECT 1 FROM supabase_migrations.schema_migrations WHERE version='20261028145738') THEN
    RAISE EXCEPTION 'f57_2_must_not_be_registered';
  END IF;
  IF to_regclass('public.user_preferences') IS NOT NULL
     OR to_regclass('public.store_market_settings') IS NOT NULL THEN
    RAISE EXCEPTION 'f57_2_tables_must_not_exist';
  END IF;

  -- 6.4 Dez colunas de convite presentes
  SELECT count(*) INTO v_cols
    FROM information_schema.columns
   WHERE table_schema='public' AND table_name='access_requests'
     AND column_name IN ('invite_status','invite_sent_at','invite_last_attempt_at','invite_attempts',
                         'invite_error','invite_provider_message_id','invite_locked_until',
                         'invite_attempt_token','invited_user_id','password_set_at');
  IF v_cols <> 10 THEN
    RAISE EXCEPTION 'invite_columns_missing found=%', v_cols;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint
                  WHERE conrelid='public.access_requests'::regclass
                    AND conname='chk_access_requests_invite_status'
                    AND convalidated) THEN
    RAISE EXCEPTION 'invite_status_constraint_invalid';
  END IF;

  -- 6.5 Constraint de auditoria IDÊNTICA à capturada no preflight (27 ações)
  SELECT pg_get_constraintdef(oid) INTO v_audit_def
    FROM pg_constraint
   WHERE conrelid='public.admin_audit_log'::regclass
     AND conname='admin_audit_log_action_check';
  IF v_audit_def IS DISTINCT FROM v_audit_expected THEN
    RAISE EXCEPTION 'audit_action_check_diverged: %', v_audit_def;
  END IF;

  -- 6.6 CNPJ alfanumérico aceito e constraint validada
  SELECT pg_get_constraintdef(oid), convalidated INTO v_cnpj_def, v_cnpj_validated
    FROM pg_constraint
   WHERE conrelid='public.stores'::regclass
     AND conname='chk_stores_cnpj_atomic';
  IF v_cnpj_def IS NULL OR v_cnpj_def NOT LIKE '%[A-Z0-9]{12}[0-9]{2}%' THEN
    RAISE EXCEPTION 'cnpj_constraint_not_alphanumeric: %', v_cnpj_def;
  END IF;
  IF v_cnpj_validated IS NOT TRUE THEN
    RAISE EXCEPTION 'cnpj_constraint_not_validated';
  END IF;
  IF 'ABC12345678901' !~ '^[A-Z0-9]{12}[0-9]{2}$' THEN
    RAISE EXCEPTION 'cnpj_alphanumeric_regex_rejected';
  END IF;
END;
$final$;
```

### 6.3 Execução (transação única, para no primeiro erro)

```powershell
docker exec supabase_db_vendeo-homolog psql -U postgres -d postgres -v ON_ERROR_STOP=1 -1 -f /tmp/quick-hfo-apply.sql
```

`-1` = `--single-transaction`. Qualquer erro → rollback total (ledger e DDL). Não haverá estado "registrado sem SQL" nem "SQL sem registro".

---

## 7. Validação pós-execução

```sql
-- 149 e sem duplicatas
select count(*) total, count(distinct version) distinct_versions
  from supabase_migrations.schema_migrations;

-- versões e nomes
select version, name from supabase_migrations.schema_migrations
 where version in ('20261020000005','20261021000001','20261024141422','20261028145738')
 order by version;

-- colunas de convite (deve retornar 10)
select count(*) from information_schema.columns
 where table_schema='public' and table_name='access_requests'
   and column_name in ('invite_status','invite_sent_at','invite_last_attempt_at','invite_attempts',
                       'invite_error','invite_provider_message_id','invite_locked_until',
                       'invite_attempt_token','invited_user_id','password_set_at');

-- constraints de convite
select conname, convalidated, pg_get_constraintdef(oid)
  from pg_constraint
 where conrelid='public.access_requests'::regclass
   and conname in ('chk_access_requests_invite_status',
                   'chk_access_requests_admin_notice_status',
                   'chk_access_requests_admin_notice_attempts');

-- CNPJ alfanumérico + validação
select conname, convalidated, pg_get_constraintdef(oid)
  from pg_constraint
 where conrelid='public.stores'::regclass and conname='chk_stores_cnpj_atomic';

-- audit action check deve continuar com 27 valores
select pg_get_constraintdef(oid) from pg_constraint
 where conrelid='public.admin_audit_log'::regclass
   and conname='admin_audit_log_action_check';

-- F57.2 continua ausente
select to_regclass('public.user_preferences'), to_regclass('public.store_market_settings');

-- dados preservados
select (select count(*) from public.stores) stores,
       (select count(*) from auth.users) users,
       (select count(*) from public.campaigns) campaigns,
       (select count(*) from storage.objects) storage_objects;
```

Critérios de aceite:
- 149 / 149.
- `20261021000001 = f50_3_cnpj_alfanumerico`, `20261020000005 = beta_access_invite`, `20261024141422 = f47_1_visual_signature_model_config`.
- 10 colunas de convite + `chk_access_requests_invite_status` validada.
- `chk_stores_cnpj_atomic` com `^[A-Z0-9]{12}[0-9]{2}$` e `convalidated = true`.
- `admin_audit_log_action_check` idêntico ao baseline (27 valores).
- `stores=2`, `users=2`, `campaigns=70`, `storage_objects=149`.
- F57.2 e quaisquer outras migrations não aplicadas.

---

## 8. Recuperação

- **Falha durante a execução:** rollback automático da transação (inclui todas as asserções da seção 6.2). Ledger permanece com 147 linhas e F47.1 em `20261021000001`. Nada a desfazer. Remover apenas os arquivos `/tmp` do container.
- **Falha de validação após commit:** **não executar os blocos REVERT históricos diretamente** — eles recriam a lista antiga de 23 actions e removeriam novamente `visual_signature_model_config_update/_reset/_publish/_activation`. Qualquer reversão posterior deve:
  1. ser precedida de nova autorização explícita;
  2. preservar as 27 actions vigentes (nunca restaurar a constraint histórica);
  3. reconciliar o ledger na mesma transação (remover/ajustar as versões registradas nesta quick) para manter estrutura e histórico coerentes;
  4. reverter apenas as colunas/constraints aditivas de convite e a constraint de CNPJ, se estritamente necessário.
- Não há backup completo nem cópia de Storage; nenhum objeto de Storage é tocado.

---

## 9. Fora do escopo (confirmado)

- F57.2 (`20261028145738_f57_2_market_preferences.sql`): não aplicada e não registrada.
- Produção: nenhum comando remoto.
- Código da aplicação, migrations existentes, dependências, configs, flags, usuários, senhas, Storage e dados de negócio: inalterados.
- Sem merge, push ou deploy.

---

## 10. Entrega prevista

- `261028-hfo-SUMMARY.md` com autorização, estado anterior/posterior do ledger, hashes, comandos, resultados literais e limitações.
- `261028-hfo-VERIFICATION.md` (somente se `--validate`; não solicitado).
- Atualização da tabela "Quick Tasks Completed" em `STATE.md`.
- Commit apenas dos artefatos da quick e tracking.
- Devolução para revisão do usuário/Codex. F57.2 permanece não executada/não aceita.

---

## CHECKPOINT

Nenhum comando de escrita foi executado. Ledger, DDL e dados permanecem intactos.
Aguardando autorização explícita para:
1. reconciliar `20261021000001` → `20261024141422`;
2. aplicar `20261020000005_beta_access_invite.sql` **com a compensação da seção 5 (opção A)**;
3. aplicar `20261021000001_f50_3_cnpj_alfanumerico.sql`;
4. registrar as duas versões no ledger.

---

## 11. Cronologia real de execução

### Autorização 1 (opção A — arquivo beta integral + compensação)
Script: `evidence/apply.sql`
SHA-256: `0a0ad77118b0b176c450ee6459d0fb47a64f94edf397912863435084f42c9307`

Execução com `psql -1 -v ON_ERROR_STOP=1`:
```
UPDATE 1
DO
ALTER TABLE ... (colunas/comentários/CHECK de convite)
ERROR:  check constraint "admin_audit_log_action_check" of relation "admin_audit_log" is violated by some row
EXIT_CODE=3
```
Motivo: 7 linhas em `admin_audit_log` com `visual_signature_model_config_update` não pertencem à lista histórica de 23 valores. A compensação nunca chegou a executar.

**Rollback confirmado:** transação única abortada; ledger 147/147, F47.1 em `20261021000001`, 0 colunas de convite, `chk_stores_cnpj_atomic` inalterada, F57.2 ausente.

### Autorização 2 (método A1 — seções 1–2 do beta, seção 3 omitida)
Script: `evidence/apply-a1.sql`
SHA-256: `b99c527e56cc60ae79cf250278e3d6c5dd914c0e5401a4d3220945c89d3991c4`
Fatia verbatim do beta (linhas 17–57): `evidence/beta-sections-1-2.sql`
SHA-256: `12c9142831bfe69d9143161e38a9fafa34f677c7318029ac9b521bb43edb8c82`

Execução: `EXIT_CODE=0` (commit).
```
UPDATE 1
DO
ALTER TABLE / COMMENT ... (seções 1–2)
NOTICE: F50_3_ALPHANUMERIC_EXISTING: 0
DO / ALTER TABLE / COMMENT (F50.3)
INSERT 0 2
DO  (asserções antes do commit)
```

Seção 3 do beta **não executada**. Comprovação de que seu objetivo já estava satisfeito: a constraint `admin_audit_log_action_check` permaneceu byte-a-byte igual à capturada no preflight, com 27 valores, incluindo `access_request_invite` e as 4 ações `visual_signature_model_config_*`. A migration original não foi editada.

### Evidências finais
`ledger-before.txt`, `ledger-after.txt`, `counts-before.txt`, `counts-after.txt`, `storage-buckets-after.txt`, `file-hashes-before.txt`, `f47_1-ledger-row-before.json`.
