---
status: complete
implementation_status: applied_homolog
gate_status: validated
acceptance: pending_user_review
date: 2026-10-28
quick_id: 261028-hfo
initiative: homolog-migration-reconciliation
branch: feature/fase-57-2-preferencias-multimercado
head_before: d3f7e91318c1fde590e6c608d8c3a8c466bb739d
target: vendeo-homolog
container: supabase_db_vendeo-homolog
workspace: G:\Vendeo-Homolog
---

# Quick 261028-hfo — Reconciliação do ledger do homolog + duas migrations antigas

**Escopo:** exclusivamente o ambiente `vendeo-homolog`. Quick independente da F57.2. F57.2 não foi iniciada, executada nem registrada.

## Autorização

1. **Checkpoint inicial (opção A):** usuário autorizou reconciliar o ledger, aplicar `beta_access_invite`, restaurar a constraint de auditoria e aplicar F50.3 em uma única transação, com asserções antes do commit e recuperação sem REVERTs históricos.
2. **Segundo checkpoint (opção A1):** após o rollback da tentativa 1, o usuário autorizou executar **apenas as seções 1–2** do beta, omitindo a seção 3, preservando a constraint de 27 ações, com o mesmo regime transacional e registro da falha na cronologia.

## Identidade do alvo

| Item | Valor |
|---|---|
| Repositório | `C:\Projetos\Vendeo V3` |
| Branch / HEAD | `feature/fase-57-2-preferencias-multimercado` / `d3f7e91` |
| `git status` inicial | limpo |
| Container | `supabase_db_vendeo-homolog` (PostgreSQL 17.6) |
| Porta | `57782->5432` |
| Workdir | `G:\Vendeo-Homolog` (não é repositório git) |
| Produção | não acessada; nenhum comando `--linked`/remoto |

## Estado anterior do ledger

- 147 linhas, 147 versões distintas.
- `20261021000001` = `f47_1_visual_signature_model_config` (21 statements, md5 `098359fbf381d952cd938ad33a134ccf`).
- `20261024141422`, `20261020000005`, `20261028145738`: ausentes.
- Estrutura: 0/10 colunas de convite; `chk_stores_cnpj_atomic` com `^\d{14}$`; F57.2 ausente.
- Baseline: `stores=2`, `auth_users=2`, `campaigns=70`, `storage_objects=149` (91/42/16), `access_requests=2`, `admin_audit_log=76`.

## Estado posterior do ledger

- **149 linhas, 149 versões distintas.**
- `20261024141422` = `f47_1_visual_signature_model_config` — **21 statements preservados**, md5 idêntico (`098359fbf381d952cd938ad33a134ccf`). SQL da F47.1 **não reexecutado**.
- `20261020000005` = `beta_access_invite` (`statements` NULL).
- `20261021000001` = `f50_3_cnpj_alfanumerico` (`statements` NULL).
- `20261028145738` continua ausente.
- Diff do ledger: apenas 1 linha removida (versão antiga da F47.1) e 3 adicionadas; nenhuma outra linha alterada.

## Hashes dos arquivos

```
5dba88abccc7ee5bde640c64fb4509aabe90fc93d587b755c1e735bf860b8559  5934  20261020000005_beta_access_invite.sql
6d8097635686963a7c5df6c44381b7c63d9f9584db10d1e700856002b17cd240  6435  20261021000001_f50_3_cnpj_alfanumerico.sql
03ebfb1783f79af99a89828324f0c2be9f9053feb499e21b10ef3fc3bff983d9 18467  20261024141422_f47_1_visual_signature_model_config.sql
b352f93efa1b2f829e5d97ffaa79f7972cf3d7696c6b7ceb40ebfc517a26aa90 18067  homolog 20261021000001_f47_1_visual_signature_model_config.sql
```

F47.1 repo × homolog: idênticos após normalizar CRLF→LF (`equals_norm=True`).

Scripts efetivamente usados (em `evidence/`):
- `apply.sql` (tentativa 1): `0a0ad77118b0b176c450ee6459d0fb47a64f94edf397912863435084f42c9307`
- `apply-a1.sql` (executado): `b99c527e56cc60ae79cf250278e3d6c5dd914c0e5401a4d3220945c89d3991c4`
- `beta-sections-1-2.sql` (fatia verbatim, linhas 17–57): `12c9142831bfe69d9143161e38a9fafa34f677c7318029ac9b521bb43edb8c82`

## Cronologia da execução

### Tentativa 1 — arquivo beta integral + compensação (rollback)

`psql -1 -v ON_ERROR_STOP=1 -f /tmp/quick-hfo-apply.sql` → exit 3:

```
UPDATE 1
DO
ALTER TABLE (colunas/comentários/CHECK de convite)
ERROR:  check constraint "admin_audit_log_action_check" of relation "admin_audit_log" is violated by some row
```

Causa: **7 linhas** de `admin_audit_log` com `action = visual_signature_model_config_update` não pertencem à lista histórica de 23 valores do arquivo. O preflight inicial afirmou incorretamente que nenhuma linha violaria a lista menor; a falha fica registrada aqui.

Rollback confirmado: ledger 147/147, F47.1 em `20261021000001`, 0 colunas de convite, `chk_stores_cnpj_atomic` inalterada, F57.2 ausente. Nenhum estado parcial.

### Tentativa 2 — método A1 (sucesso)

`psql -1 -v ON_ERROR_STOP=1 -f /tmp/quick-hfo-apply-a1.sql` → exit 0:

```
UPDATE 1
DO
ALTER TABLE / COMMENT ...            (seções 1–2 do beta)
NOTICE:  F50_3_ALPHANUMERIC_EXISTING: 0
DO / ALTER TABLE / COMMENT           (F50.3)
INSERT 0 2
DO                                   (asserções antes do commit)
```

Seção 3 do beta **omitida** (não editamos a migration original). Comprovação de que seu objetivo já estava satisfeito: asserção comparou `pg_get_constraintdef` com a captura do preflight e exigiu igualdade byte-a-byte, incluindo `access_request_invite` e as 4 ações `visual_signature_model_config_*`.

## Comandos efetivamente usados (sem segredos)

```powershell
docker cp <apply-a1.sql>              supabase_db_vendeo-homolog:/tmp/quick-hfo-apply-a1.sql
docker cp <beta-sections-1-2.sql>     supabase_db_vendeo-homolog:/tmp/beta-sections-1-2.sql
docker cp <20261021000001_f50_3.sql>  supabase_db_vendeo-homolog:/tmp/20261021000001.sql
docker exec supabase_db_vendeo-homolog sha256sum /tmp/<arquivos>
docker exec supabase_db_vendeo-homolog psql -U postgres -d postgres -v ON_ERROR_STOP=1 -1 -f /tmp/quick-hfo-apply-a1.sql
```

Nenhum comando Supabase CLI, `--linked`, `reset`, `repair`, instalação/atualização de ferramenta, merge, push ou deploy.

## Validação literal

| Verificação | Resultado |
|---|---|
| Ledger | `149 / 149 distintas` |
| F47.1 | `20261024141422`, 21 statements, md5 inalterado |
| F50.3 | `20261021000001 = f50_3_cnpj_alfanumerico` |
| Convites | `20261020000005 = beta_access_invite` |
| Colunas de convite | **10/10** com tipos/defaults corretos |
| `chk_access_requests_invite_status` | presente, `convalidated = t` |
| Constraints `admin_notice_*` | preservadas e validadas |
| `chk_stores_cnpj_atomic` | `^[A-Z0-9]{12}[0-9]{2}$`, `convalidated = t` |
| `admin_audit_log_action_check` | idêntica à captura (27 ações) |
| Dados | `stores=2`, `auth_users=2`, `campaigns=70`, `storage_objects=149`, `access_requests=2`, `admin_audit_log=76` |
| F57.2 | `user_preferences`/`store_market_settings` ausentes; versão não registrada |
| Produção | nenhuma alteração; nenhum comando remoto |

Evidências em `evidence/`: `ledger-before.txt`, `ledger-after.txt`, `counts-before.txt`, `counts-after.txt`, `storage-buckets-after.txt`, `f47_1-ledger-row-before.json`, `admin_audit_log_action_check-before.txt`, `chk_stores_cnpj_atomic-before.txt`, `file-hashes-before.txt`, `apply.sql`, `apply-a1.sql`, `beta-sections-1-2.sql`.

## Limitações e observações

- `statements` das duas novas entradas é NULL, formato já presente em 99/147 linhas legadas.
- A F47.1 está registrada em `20261024141422`, mas o diretório `G:\Vendeo-Homolog\supabase\migrations` ainda contém o arquivo antigo `20261021000001_f47_1_*.sql` (snapshot não versionado). O ledger é a fonte de verdade; nenhum arquivo foi renomeado.
- O arquivo beta não pôde ser aplicado integralmente neste banco por incompatibilidade retroativa da constraint de auditoria; a seção omitida está documentada e sua condição final comprovada.
- F57.2 permanece **não executada e não aceita**.
- Reversão futura exige nova autorização e não pode usar os REVERTs históricos diretamente (reintroduziriam a lista de 23 ações).

## Arquivos documentais desta quick

- `.planning/quick/261028-hfo-reconciliar-ledger-do-homolog-e-aplicar-/261028-hfo-PLAN.md`
- `.planning/quick/261028-hfo-reconciliar-ledger-do-homolog-e-aplicar-/261028-hfo-SUMMARY.md`
- `.planning/quick/261028-hfo-reconciliar-ledger-do-homolog-e-aplicar-/evidence/*`
- `.planning/STATE.md` (linha na tabela Quick Tasks Completed)

**Aceite:** pendente de revisão do usuário/Codex. Não avançar para outro trabalho.
