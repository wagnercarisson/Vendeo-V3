---
phase: 56.1-contrato-produtivo-modelos-e-fallback
plan: 02
subsystem: database
tags: [supabase, migration, postgres, rls, rpc, security-definer, audit, ai-model-catalog, campaign_product_image, local-only]

# Dependency graph
requires:
  - phase: F47
    provides: ai_model_catalog (unique capability/provider/model/protocol), admin_audit_log CHECK-extension idiom, audited RPC shape (SECURITY DEFINER + operation_id)
  - phase: F38.1
    provides: padrão de RPC auditada admin_set_ai_model_price e CHECKs de auditoria
provides:
  - "Tabela global de linha vigente image_model_pair_config (par principal/fallback com qualidade, config_version_id, autor/motivo/timestamps)"
  - "RPC auditada idempotente admin_set_image_model_pair_config (SECURITY DEFINER, motivo + operation_id obrigatórios, validação contra catálogo elegível, auditoria na mesma transação)"
  - "CHECKs de auditoria estendidos (image_model_pair_config_update / image_model_pair_config)"
  - "Registro idempotente dos três modelos elegíveis (gpt-image-2, gpt-image-2.5-flare, gpt-image-2.5-sunburst) sob a capacidade campaign_product_image"
affects: [56.1-03, 56.1-04, 56.1-07, 56.1-08, 56.1-10, 56.1-11, F56.2]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Tabela singleton por escopo (scope TEXT PRIMARY KEY DEFAULT 'new_flow' + CHECK) para linha vigente global"
    - "RPC SECURITY DEFINER com SET search_path = '' / motivo e operation_id obrigatórios / idempotência por admin_audit_log / auditoria na mesma transação"
    - "Registro idempotente no catálogo por capacidade própria do novo fluxo (ON CONFLICT ... DO NOTHING), preservando a linha legada de campaign_image_edit"
    - "Extensão de CHECK de auditoria preservando TODOS os valores anteriores e REVERT comentado em ordem reversa"
    - "Migration aditiva LOCAL-ONLY sem db push remoto antes de aprovação humana"

key-files:
  created:
    - supabase/migrations/20261005000001_f56_1_model_pair_config.sql
  modified: []

key-decisions:
  - "A configuração do par é uma linha vigente singleton (scope='new_flow') separada de ai_model_selection (que não tem dimensão de qualidade) — D-01."
  - "A gravação ocorre por RPC SECURITY DEFINER auditada, com motivo obrigatório, idempotência por operation_id, validação contra campaign_product_image ativo/images e auditoria na mesma transação — D-04."
  - "Os três modelos elegíveis são registrados no ai_model_catalog sob a capacidade própria campaign_product_image (idempotente); a linha legada de gpt-image-2 em campaign_image_edit (F47) permanece intacta e não é duplicada — D-11."

patterns-established:
  - "Migration local-only da F56.1: nenhuma aplicação remota antes de aprovação humana explícita"
  - "Validação do reset/lint exclusivamente em instância Supabase descartável e comprovadamente isolada"

requirements-completed: [REQ-56.1-01, REQ-56.1-02, REQ-56.1-04, REQ-56.1-07, REQ-56.1-24]

# Metrics
duration: 2 min
completed: 2026-10-06
---

# Phase 56.1 Plan 02: Contrato produtivo, modelos e fallback Summary

**Migration local-only cria a tabela global do par principal/fallback com RPC auditada idempotente (SECURITY DEFINER) e registra os três modelos elegíveis sob a capacidade `campaign_product_image`, preservando intacta a linha legada de `gpt-image-2` em `campaign_image_edit`**

## Performance

- **Duration:** 2 min
- **Started:** 2026-10-06T16:00:44Z
- **Completed:** 2026-10-06T16:03:00Z
- **Tasks:** 2
- **Files modified:** 1 (1 criado, 0 modificados)

## Aplicação no banco (isolamento comprovado)

O reset/lint rodaram **exclusivamente** na instância Supabase descartável e comprovadamente isolada do F56.1 — nunca na stack compartilhada `Vendeo_V3`.

**Identidade da instância (verificada ANTES do reset):**
- Workdir: `C:\Users\wagne\AppData\Local\Temp\opencode\vendeo-f561-isolated`
- `project_id`: `vendeo-f561-isolated`
- Container DB: `supabase_db_vendeo-f561-isolated` — imagem `public.ecr.aws/supabase/postgres:17.6.1.075`
- Volume: `supabase_db_vendeo-f561-isolated`
- DB URL local: `postgresql://postgres:postgres@127.0.0.1:55322/postgres`
- Junction: `<isolated>/supabase/migrations` -> `C:\Projetos\Vendeo V3\supabase\migrations` (apenas um ponteiro; a junção NÃO impõe permissão de leitura nem torna os arquivos somente-leitura — o isolamento comprovado é o de projeto/container/volume/portas. Não editar nem remover arquivos pela rota da junção.)

**`supabase status --workdir ...` (saída):** DB URL `postgresql://postgres:postgres@127.0.0.1:55322/postgres`; serviços parados com sufixo `vendeo-f561-isolated`; "supabase local development setup is running".

**`docker ps` (saída):** apenas `supabase_db_vendeo-f561-isolated` (`public.ecr.aws/supabase/postgres:17.6.1.075`, `0.0.0.0:55322->5432/tcp`, `Up ... (healthy)`). **Nenhum container `Vendeo_V3` em execução.** `docker ps -a` e `docker volume ls` também mostram somente a instância isolada.

## Commands Run (isolated instance)

Executados a partir de qualquer cwd, com o flag global `--workdir` (sem `cd`, sem `--db-url`):

1. `supabase db reset --workdir "<isolated>" --local --no-seed` → **EXIT 0** (aplica a migration `20261005000001_f56_1_model_pair_config.sql`; "Finished supabase db reset on branch main") — executado após Task 1 e novamente após Task 2.
2. `supabase db lint --workdir "<isolated>" --local --fail-on error` → **EXIT 0** (apenas warnings pré-existentes em funções não relacionadas: `begin_campaign_correction_submission`, `materialize_demo_expiration`, `create_store_with_initial_grant`).
3. `openspec validate "fase-56-1-contrato-produtivo-modelos-fallback" --strict` → `Change ... is valid`, **EXIT 0**.
4. `git status --short` → vazio (working tree limpo; nenhum dump/backup gerado no repositório).

## Evidência funcional no banco isolado

Consulta direta (via `docker exec ... psql`, sem `--db-url`):

- `campaign_product_image` (provider `openai`, protocol `images`): **3 linhas `active`** — `gpt-image-2`, `gpt-image-2.5-flare`, `gpt-image-2.5-sunburst`, todas com `source_note = 'F56.1 eligible new-flow pair'` e `validated_at` preenchido.
- Linha legada preservada: `campaign_image_edit` / `gpt-image-2` → **1 linha** `active`, `source_note = 'F46 registry; images.edit fallback path'` (inalterada; sem duplicação sob capacidade legada).
- Tabela `public.image_model_pair_config` com CHECKs: `chk_image_model_pair_config_scope`, `chk_image_model_pair_config_primary_quality`, `chk_image_model_pair_config_fallback_quality` (+ PK e FK `updated_by` -> `auth.users`).
- `admin_audit_log_action_check` contém todos os valores preservados + `image_model_pair_config_update`; `admin_audit_log_target_type_check` contém todos + `image_model_pair_config`.
- `admin_set_image_model_pair_config` com `prosecdef = t` e `proconfig = {"search_path=\"\""}`.

## Task Commits

Cada task foi commitada atomicamente:

1. **Task 1: Tabela global do par + RLS + RPC auditada + CHECK de auditoria** - `3b463a60` (feat)
2. **Task 2: Registro idempotente do catálogo elegível e presença de repositório** - `b5b18450` (feat)

**Plan metadata:** commit final do SUMMARY/STATE/ROADMAP (docs: complete plan).

## Files Created/Modified

- `supabase/migrations/20261005000001_f56_1_model_pair_config.sql` - Migration aditiva local-only: tabela `image_model_pair_config` (singleton, par principal/fallback com qualidade, `config_version_id`, autor/motivo/timestamps), RLS service_role only, RPC `admin_set_image_model_pair_config` (SECURITY DEFINER, idempotência por `operation_id`, validação contra `campaign_product_image`, auditoria na mesma transação), extensão dos CHECKs de auditoria e registro idempotente dos três modelos elegíveis no catálogo. Bloco `REVERT` comentado em ordem reversa.

## Decisions Made

- Configuração como **linha vigente singleton** (`scope='new_flow'`) separada de `ai_model_selection` (D-01).
- Persistência **exclusivamente por RPC auditada** `SECURITY DEFINER` com motivo obrigatório, idempotência por `operation_id` e auditoria transacional (D-04).
- Catálogo elegível sob a **capacidade própria** `campaign_product_image`, sem tocar nem duplicar a linha legada de `gpt-image-2` em `campaign_image_edit` (D-11).
- Migration **local-only**: nenhum `supabase db push` remoto antes de aprovação humana (D-07/proposal §Migração).

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None. Nenhuma chamada a provider, nenhum `db push`, nenhuma ativação e nenhuma modificação de volume/container `Vendeo_V3`.

## User Setup Required

None - nenhuma configuração externa.

## Next Phase Readiness

- Persistência auditável e catálogo elegível prontos para o serviço/API/admin da F56.1 e para a integração transacional da F56.2.
- Instância isolada do F56.1 confirmada e disponível para os planos dependentes (03/04/07/08/10/11).
- Fronteira legada intocada: `ai_model_selection` e o pipeline vigente não foram alterados.

## Self-Check: PASSED

- Arquivo criado verificado em disco: `supabase/migrations/20261005000001_f56_1_model_pair_config.sql` — FOUND.
- Commits verificados em `git log`: `3b463a60`, `b5b18450` — ambos presentes.
- `supabase db reset --local --no-seed` (isolado) EXIT 0; `supabase db lint --local --fail-on error` (isolado) EXIT 0; `openspec validate --strict` EXIT 0.

---
*Phase: 56.1-contrato-produtivo-modelos-e-fallback*
*Completed: 2026-10-06*
