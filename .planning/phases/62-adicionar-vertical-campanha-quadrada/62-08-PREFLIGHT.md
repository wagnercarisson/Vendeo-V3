# 62-08 — Preflight de aplicação limitada (homologação local)

**Status:** **AUTORIZAÇÃO LIMITADA CONCEDIDA — APENAS MIGRATION F62 NA HOMOLOGAÇÃO LOCAL.**
**Data/UTC:** 2026-11-23T19:27:12Z
**Janela:** 2026-11-23T19:20:00Z → 2026-11-23T21:00:00Z

> Esta autorização cobre **somente** a aplicação da migration F62 no container
> `supabase_db_vendeo-homolog` e a conferência imediata. Não cobre produção,
> provider pago, geração de campanhas, ativação de flags, merge, push, deploy,
> testes com escrita financeira, Storage, prova visual ou publicação.

## Alvo

| Campo | Valor |
|---|---|
| Container | `supabase_db_vendeo-homolog` |
| Host publicado | `127.0.0.1` |
| Porta publicada | `57782` → container `5432` |
| Banco | `postgres` |
| Branch | `feat/campaign-add-vertical` |
| HEAD de partida | `411cc5ba08196fec4b0e210ed3200a2e8ddebef0` |
| Migration | `supabase/migrations/20261123130252_campaign_format_addition.sql` |
| SHA-256 | `61c727198f8ad7519e6cb3b9c79dba6fd1d9bbb9f948b9600d37bc43c7f5b878` |
| Tamanho | 43.009 bytes |

## Estado read-only capturado

- `current_database()` = `postgres`; container running; mapeamento `5432/tcp -> 0.0.0.0:57782`.
- Ledger: **157 migrations**; última `20261118002139`.
- `20261123130252` (F62): **ausente**.
- `20261030185658` (migration legal): **ausente do ledger**, permanece fora desta execução.
- Tabela `campaign_format_additions`: **ausente**.
- Funções `campaign_format_add_open`, `campaign_format_add_deliver`,
  `campaign_format_add_refund`, `trg_cfa_guard_fn`: **ausentes**.
- `ck_cca_reuse_role`: **ausente**; `ck_cca_origin` **sem**
  `delivered_campaign_reuse`.
- Flag `campaign_format_addition_enabled`: **ausente/desligada**.
- Contagens de referência: `campaigns=140`, `product_1_1_campaign_credit_operations=100`,
  `campaign_composition_artifacts=44`, `stores=39`, `feature_flags=10`.
- Função compartilhada `product_1_1_get_campaign_operation_by_campaign`:
  existe 1 assinatura; ACL `postgres=X/postgres,service_role=X/postgres`;
  hash da definição `a4503380c9d612fea97fa68d7dc3eb4a`.
- Definição completa prévia, ACL, constraints e contagens salvas **fora do Git**:
  `C:\Users\wagne\AppData\Local\Temp\f62-pre-migration-20261123.sql`
  (SHA-256 `9B4F4411A157A9A3856DD4C39DF7488DAA324B997626A0EF37B416D5E1D1381F`).

## Preparação proporcional

- A definição prévia da função compartilhada, suas permissões e as constraints
  de `campaign_composition_artifacts` foram preservadas no arquivo temporário
  acima.
- Não será iniciada rotina de backup completo de banco/Storage nesta
  autorização. O gate de backup/restore do 62-08 permanece **não satisfeito**.
- Nenhum dado único foi identificado como exigindo proteção adicional nesta
  etapa; qualquer descoberta durante a aplicação exige parada.

## Método de aplicação autorizado

- `psql` dentro do container alvo, `ON_ERROR_STOP=1`.
- Uma única transação; `lock_timeout` e `statement_timeout` explícitos.
- Aplicar somente o arquivo F62; inserir a versão no ledger na mesma transação.
- Nenhum `db push`, reset, reparo de ledger ou outra migration.
- Nenhuma função financeira será executada durante a aplicação.
- Qualquer erro ⇒ rollback integral e parada.

## Rollback

- Reverter a transação em caso de erro.
- Se aplicada e for necessário reverter, usar o bloco REVERT da migration apenas
  com autorização específica; restaurar a definição anterior da função
  compartilhada a partir do arquivo temporário.
- Não renumera migration aplicada nem reescreve ledger silenciosamente.

## Limites explícitos

- Migration aplicada em homologação **não** aprova produção.
- Flag dedicada permanece desligada; não remover nem ativar.
- Testes com escrita financeira, Storage, provider e validação visual exigem
  autorização separada.
- `62-08` não é declarado concluído por esta aplicação.
