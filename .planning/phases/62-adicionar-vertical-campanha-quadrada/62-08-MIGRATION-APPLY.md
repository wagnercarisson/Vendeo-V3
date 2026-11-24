# 62-08 — Aplicação limitada da migration F62 em homologação local

**Status:** **APLICADA E CONFERIDA NA HOMOLOGAÇÃO LOCAL.**
**Data/UTC da aplicação:** 2026-11-23 (janela 19:20Z–21:00Z)
**Produção:** não acessada. **Provider pago, geração, flags, Storage, merge, push e deploy:** não executados.
**`62-08` NÃO está concluído no momento desta evidência.** Esta evidência cobre somente a migration F62.
> **Atualização 2026-11-24:** o `62-08` foi consolidado e aceito localmente em `62-ACCEPTANCE.md`/`62-08-SUMMARY.md`; a migration continua aplicada **somente** na homologação local.

## Alvo e identidade

| Campo | Valor |
|---|---|
| Container | `supabase_db_vendeo-homolog` (running) |
| Host/porta publicados | `127.0.0.1:57782` → container `5432` |
| Banco | `postgres` |
| Branch | `feat/campaign-add-vertical` |
| HEAD de partida | `411cc5ba08196fec4b0e210ed3200a2e8ddebef0` |
| Migration | `supabase/migrations/20261123130252_campaign_format_addition.sql` |
| SHA-256 da migration | `61c727198f8ad7519e6cb3b9c79dba6fd1d9bbb9f948b9600d37bc43c7f5b878` |

## Preflight read-only

- Ledger antes: **157** migrations; última `20261118002139`.
- F62 (`20261123130252`) ausente; migration legal `20261030185658` ausente do ledger e fora da execução.
- Tabela/funções/trigger/constraint de reuso ausentes; flag dedicada ausente/desligada.
- Contagens antes: `campaigns=140`, `credit_operations=100`, `artifacts=44`, `stores=39`, `feature_flags=10`.
- Função compartilhada antes: assinatura `p_campaign_id uuid`, owner `postgres`, `SECURITY DEFINER`,
  ACL `postgres=X/postgres,service_role=X/postgres`, hash `a4503380c9d612fea97fa68d7dc3eb4a`.
- Definições/contagens prévias preservadas fora do Git em
  `C:\Users\wagne\AppData\Local\Temp\f62-pre-migration-20261123.sql`
  (SHA-256 `9B4F4411A157A9A3856DD4C39DF7488DAA324B997626A0EF37B416D5E1D1381F`).

## Procedimento exato

1. Conteúdo da migration + wrapper transacional:
   `BEGIN; SET LOCAL lock_timeout='10s'; SET LOCAL statement_timeout='120s'; <migration>; INSERT INTO supabase_migrations.schema_migrations(version,name) VALUES ('20261123130252','f62_campaign_format_addition'); COMMIT;`
2. SQL temporário fora do Git:
   `C:\Users\wagne\AppData\Local\Temp\f62-apply-20261123.sql`
   (SHA-256 `99D7A31E0CE679B27E080AEFB464838D3C6477CFCC7F566D6DE6BBB538D9C12E`).
3. Execução:
   `docker exec -i supabase_db_vendeo-homolog psql -U postgres -d postgres -X -v ON_ERROR_STOP=1 -q -f -`
4. Exit do psql: **0**.
5. Notices esperados: trigger/policy/`ck_cca_reuse_role` ainda inexistentes no `DROP IF EXISTS`.
6. Nenhuma função financeira foi executada; nenhuma outra migration foi aplicada; nenhum `db push`, reset ou repair.

## Ledger depois

- Ledger: **158** (`157 + 1`).
- `20261123130252` presente **1×**, nome `f62_campaign_format_addition`.
- `20261030185658` continua **ausente** (não executada).

## Schema e permissões

- Tabela `public.campaign_format_additions`: presente.
- Índices: `campaign_format_additions_pkey`, `idx_cfa_operation`, `idx_cfa_source_registration`,
  `idx_cfa_status_created`, `uq_cfa_active_per_campaign_target`, `uq_cfa_identity`, `uq_cfa_request`.
- 6 FKs; 9 CHECKs; trigger `trg_cfa_guard` presente (1).
- RLS habilitada; 1 policy; ACL da tabela `postgres=arwdDxtm/postgres,service_role=r/postgres`
  (sem `anon`/`authenticated`).
- Funções: `campaign_format_add_open`, `campaign_format_add_deliver`,
  `campaign_format_add_refund`, `trg_cfa_guard_fn`.
- ACLs das RPCs: `postgres=X/postgres,service_role=X/postgres`.
- `ck_cca_origin` inclui `delivered_campaign_reuse`; `ck_cca_reuse_role` exige
  `role='square_original'` para essa origem.
- Flag `campaign_format_addition_enabled = false` (permanece desligada; não removida/ativada).

## Preservação

- `campaigns=140`, `credit_operations=100`, `artifacts=44`, `stores=39` — iguais ao preflight.
- `feature_flags=10 → 11` apenas pela seed da flag dedicada (esperado).
- Função compartilhada:
  - assinatura `p_campaign_id uuid` preservada;
  - owner `postgres`, `SECURITY DEFINER` e ACL preservados;
  - hash mudou de `a4503380c9d612fea97fa68d7dc3eb4a` para
    `01763f8b90925b1437bf5b6088df6fc7` por redefinição intencional que exclui a
    adição da operação primária; a definição menciona `campaign_format_additions`.
- Nenhuma projeção em `campaigns.storage_path`, crédito ou artefato preexistente.

## Divergências e limitações

- **Nenhum erro de aplicação.** Notices de `DROP IF EXISTS` são esperados.
- **Backup/restore completo:** não executado por autorização limitada; o gate de
  backup do 62-08 permanece **não satisfeito**.
- **Provas reais:** nenhuma escrita financeira, Storage, provider, concorrência
  real ou validação visual foi executada.
- **Produção:** não acessada e não aprovada.
- **F62:** não concluída; flag permanece desligada.

## Próxima matriz (não executada — exige autorização separada)

1. PostgreSQL real: abertura/replay, concorrência, uma reserva, unknown, estorno único,
   operação original intacta, pendência excluída.
2. Storage real: vertical 1080×1920, download por formato, integridade e assinatura.
3. Provider pago: uma chamada dentro do teto, sem retry/fallback, com custo/uso.
4. Validação visual/funcional: detalhe, modal, lista, dashboard, download, pt-BR/es-419.
5. Release: versão/hash/ledger/schema definitivos, backup/restore e autorização de publicação.

**Review Stop:** aplicação e conferência encerradas. Não iniciar automaticamente nenhum
teste da matriz acima nem o restante do `62-08`.
