---
id: 261016-nst
part: plan-24-migrations
status: executed
date: 2026-10-16
---

> **EXECUTADO (2026-10-16):** autorização única concedida; grupos A→G aplicados com sucesso; ledger **123**, pending **0**. Resultado detalhado em `261016-nst-EXECUTION-24-MIGRATIONS.md`. Este documento permanece como o plano aprovado.

# Plano — aplicação das 24 migrations pendentes em `vendeo-homolog` (NÃO EXECUTADO)

Aplicação **exclusivamente local** (`--local`), em **grupos ordenados**, com verificação
após cada grupo e **parada em falha**. Requer **uma única autorização**; não haverá
aprovação por migration.

## 1. Reverificação (feita)

- **Origem:** `Vendeo-V3` / `gvbzwihwgzujwsviufgy` → 99 aplicadas, última `20260924000003`, **24 pendentes**.
- **Destino:** `project_id = "vendeo-homolog"` (config.toml), API loopback `127.0.0.1:57781`; ledger local = **99**; migrations dir = **99** (baseline); `pending_local = 0`.
- **Lista exata das 24:** `20260925000001 … 20261016000001` (coluna REMOTE de `migration list --linked`).
- **Staging:** `G:\Vendeo-Homolog\pending-24\` (24 arquivos) + `pending-24-migrations.json` (SHA-256). Não ficam no dir de aplicação até o apply → sem risco de aplicação acidental.

## 2. Ponto de recuperação (criado)

- `G:\Vendeo-Homolog\recovery\homolog-pre24mig-20261016-182920.dump` (pg_dump `-Fc`, 946.345 bytes, SHA-256 `360F6EB8EE898EF1C21B0A550DD11671A04363764991F09A02FDAFC73B19FA4C`).
- Snapshot `recovery\pre24-snapshot.json`: `ledger 99 · stores 2 · campaigns 59 · users 2 · policies storage.objects 15 · objects 116`.
- Fora do Git. **Sem** reset/limpeza de volumes.

## 3. As 24 migrations (ordem preservada) + SHA-256 (prefixo)

| # | versão | arquivo | sha256 |
|---|---|---|---|
| 1 | 20260925000001 | f48_2_1_lab_prompt_programs | 129b3937a71b |
| 2 | 20260926000001 | f48_2_1_lab_fail_closed_closure | 7572aa229519 |
| 3 | 20261005000001 | f56_1_model_pair_config | 3e1f17a8c0f9 |
| 4 | 20261005000002 | f56_1_snapshot_pricing_quality | 321fc3196da4 |
| 5 | 20261005000003 | f56_1_failure_diagnosis | 7574145ca735 |
| 6 | 20261006000001 | f56_2a_feature_flags_keys | f8c2ca0cf93c |
| 7 | 20261006000002 | f56_2a_operations_append_only | faebf655c2de |
| 8 | 20261008000001 | f56_2b1a_product_flow_stage_authorizations | de4f052442ff |
| 9 | 20261008000002 | f56_2b1a_product_1_1_campaign_credit | 3fcc462c0ec7 |
| 10 | 20261008000003 | f56_2b1a_authorization_write_path_lock | 2fbf847ec01f |
| 11 | 20261008000004 | f56_2b1a_authorization_rpc_concurrency_and_order | b0a34ff5a789 |
| 12 | 20261008000005 | f56_2b1a_credit_write_path_lock | ec9fdfb3f70e |
| 13 | 20261009000001 | f56_2b1b_atomic_attempt_start | d08b96886bf8 |
| 14 | 20261009000002 | f56_2b1b_pending_resolution | 63fb173dc533 |
| 15 | 20261009000003 | f56_2b1b_frozen_evidence | 9806ca88f900 |
| 16 | 20261009000004 | f56_2b1b_campaign_artifacts | b18b1ec482a8 |
| 17 | 20261009000005 | f56_2b1b_copy_state | 7918de445dfb |
| 18 | 20261013000001 | f56_2b2a_copy_attempt_identity | 74004e848c76 |
| 19 | 20261013000002 | f56_2b2a_copy_acquire_attempt | f0d5a533b8d8 |
| 20 | 20261013000003 | f56_2b2a_copy_state_backfill | 0efdeccf46d1 |
| 21 | 20261015000001 | f56_2b2b_failure_closure | 5f91fc65ed7e |
| 22 | 20261015000002 | f56_2b2b_pending_abandon | d326512bdbf1 |
| 23 | 20261015000003 | f56_2b2b_pending_read | 7bfe9b15f541 |
| 24 | 20261016000001 | f56_2b2b_publication_fence | 2c2d81aed435 |

## 4. Grupos, mecanismo e verificação (após cada grupo)

**Mecanismo (por grupo, em ordem):** copiar os arquivos do grupo de `pending-24\` para
`G:\Vendeo-Homolog\supabase\migrations\`; rodar
`npx --no-install --prefix "C:\Projetos\Vendeo V3" supabase migration up --local --workdir "G:\Vendeo-Homolog"`;
verificar. **Nunca** `--linked`, `db push` ou `reset`.

| Grupo | Versões | Objetos esperados (checagem) |
|---|---|---|
| **A — F48.2.1 (lab)** | #1–2 | tabela `lab_prompt_programs`; ledger 99→101 |
| **B — F56.1** | #3–5 | `image_model_pair_config`, `image_generation_config_snapshots`, coluna `quality` em `ai_model_pricing`, `image_generation_failure_diagnoses`; ledger→104 |
| **C — F56.2a** | #6–7 | flags `product_1_1_test_stores_enabled`/`product_1_1_all_stores_enabled` (default off), `image_generation_operations` append-only; ledger→106 |
| **D — F56.2b1a** | #8–12 | `product_flow_stage_authorizations`, `product_1_1_campaign_credit_operations` + RPCs de autorização/crédito; ledger→111 |
| **E — F56.2b1b** | #13–17 | `product_1_1_generation_attempt_claims/_outcomes`, `_snapshot_frozen_evidence`/`_content_binding`, `_campaign_artifacts`, `_copy_state`; ledger→116 |
| **F — F56.2b2a** | #18–20 | `_copy_state` com identidade por tentativa, RPC de aquisição, backfill; ledger→119 |
| **G — F56.2b2b** | #21–24 | fechamento de falha/abandono/leitura pendente + fence de publicação; ledger→123 |

**Verificações comuns após cada grupo:** `migration list --local` (ledger = 99 + cumulativo, exit 0);
objetos esperados presentes; **dados inalterados** (`stores=2, campaigns=59, users=2`); **storage policies=15**;
sem erro no output do `psql`/CLI.

## 5. Critérios de PARADA

Parar **imediatamente** e não aplicar grupos seguintes se:
- `migration up` retornar exit ≠ 0, ou qualquer `ERROR` SQL;
- ledger local divergir do esperado (contagem/versões);
- objeto esperado ausente;
- dados da aplicação ou policies de storage mudarem de forma inesperada.

Sem **retry automático**. Registrar o erro (sanitizado), o último grupo concluído e o dump de recuperação; decidir com o usuário.

## 6. Recuperação prevista (sem rollback automático)

- **Ponto de recuperação:** dump lógico `-Fc` do estado pré-24 (ver §2) + snapshot.
- O CLI aplica **cada arquivo de migration em uma única transação** (comportamento observado no projeto): um arquivo que falha **não** deve deixar mudanças parciais *daquele arquivo*; os grupos já aplicados permanecem.
- **Não há rollback automático.** Opções, decididas com o usuário:
  1. corrigir a migration que falhou e re-rodar `migration up --local`;
  2. **restaurar o dump em uma instância separada** (não na homolog atual, pois **reset está proibido**) para comparação/rollback;
  3. reversão pontual de objetos usando o dump como referência.
- Um restore **in-place** exigiria drop/recreate (reset) — **fora de escopo** por decisão de escopo.

## 7. Proibições

Sem produção, **sem reset da homologação**, sem limpeza de volumes, sem alterar flags em runtime,
sem provider pago, sem deploy/push. Migrations aplicadas **somente** em `vendeo-homolog`, com `--local`.

## 8. Autorização

Solicito **uma autorização única** para executar os grupos A→G em ordem, com verificação após cada grupo e parada em falha. Sem aprovação por migration.
