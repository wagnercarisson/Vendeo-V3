---
phase: 38-1-ai-cost-accounting
plan: 01
subsystem: database
tags: [supabase, sql, migration, generation_events, ai_model_pricing, rpc, views, db-push]
requires:
  - phase: 38-credit-operation-costs
    provides: F38 padrão de migration (table+trigger+RLS+RPC+seeds+REVERT), índice parcial único, idempotência
  - phase: 28-observabilidade-operacao-launch-controls
    provides: generation_events original, chk_generation_events_type (6 valores), admin_get_metrics (F28)
  - phase: 24-creditos-schema-saldo-transacoes
    provides: credit_transactions (reconciliação por leitura)
  - phase: 29-1-1-creditos-assinatura-visual
    provides: store_visual_signatures + metadata.credit_tx_id
provides:
  - Migration única 20260808000001 aplicada no remoto: generation_events +9 colunas (D2), CHECK cost_source 5 valores (D4), CHECK generation_type 12 valores (D5), 5 índices
  - campaigns.operation_run_id + idx_campaigns_operation_run_id (preparo reuso F37 — D1/D2)
  - ai_model_pricing (D8): tabela versionada + CHECK at_least_one_price + índice parcial único uq_ai_model_pricing_vigente + trigger scoped + RLS service_role-only + 7 seeds vigentes
  - RPC admin_set_ai_model_price aplicada no remoto (SECURITY DEFINER, SET search_path='', p_reason antes dos DEFAULTs, transacional)
  - 6 views admin_ai_* + admin_cost_vs_credits (apuração call-level + reconciliação USD × créditos) + RPC admin_get_ai_costs (8 filtros)
affects: [38-1-02, 38-1-03, 38-1-04, 38-1-07, 38-1-08, 38-1-09, 38-1-10, F37, F39]
tech-stack:
  added: []
  patterns:
    - "Índice parcial único para versionamento (provider, model) WHERE effective_until IS NULL — no-analog #5 resolvido"
    - "Primeiras CREATE VIEW do repositório (NO ANALOG #1) — SELECT no estilo CTE/COUNT FILTER de admin_get_metrics"
    - "REVOKE de views: usa ON TABLE (ON VIEW é inválido em PostgreSQL)"
    - "Views sem GROUP BY de colunas UUID (MAX(uuid) não existe em Postgres) — agrupar pela coluna"
key-files:
  created:
    - supabase/migrations/20260808000001_f38_1_create_ai_cost_accounting.sql
  modified: []
key-decisions:
  - "Fixes Rule 1 no push: REVOKE ALL ON VIEW → ON TABLE (sintaxe PostgreSQL) e MAX(uuid) → GROUP BY nas CTEs de admin_cost_vs_credits"
  - "Views sem GRANT direto ao cliente (404 no REST confirma T-38.1-03) — acesso apenas via RPC definer"
  - "db push transacional: 2 falhas intermediárias reverteram 100% (sem estado parcial no remoto)"
requirements-completed: [F38.1-07, F38.1-08, F38.1-09, F38.1-12, F38.1-13, F38.1-14, F38.1-15, F38.1-16, F38.1-17, F38.1-19]
duration: 45min
completed: 2026-08-08
---

# Phase 38.1 Plan 01: Migration — Apuração de Custos de IA por Entrega Summary

**Migration única `20260808000001_f38_1_create_ai_cost_accounting.sql` criada e aplicada no remoto via `supabase db push`: schema granular de custo de IA (9 colunas + 2 CHECKs + 5 índices em generation_events, campaigns.operation_run_id, ai_model_pricing + 7 seeds + RPC admin_set_ai_model_price, 6 views de apuração/reconciliação + RPC admin_get_ai_costs) — fundação de dados de toda a F38.1**

## Performance

- **Duration:** 45 min
- **Started:** 2026-08-08T18:38:57Z
- **Completed:** 2026-08-08T19:24:00Z
- **Tasks:** 3
- **Files modified:** 1 (criado)

## Accomplishments

- **Bloco 1-4:** ALTER generation_events com 9 colunas novas (D2) via `ADD COLUMN IF NOT EXISTS` — operation_run_id, operation_run_type, visual_signature_id (FK store_visual_signatures), theme_id, cached_input_tokens, image_tokens, provider_reported_cost_usd, cost_source, pricing_version; CHECK `chk_generation_events_cost_source` (5 valores D4); substituição do CHECK `chk_generation_events_type` (6 → 12 valores D5); 5 índices novos; `campaigns.operation_run_id` + `idx_campaigns_operation_run_id` (D1/D2)
- **Bloco 5-7:** `ai_model_pricing` (D8) com CHECK `chk_ai_model_pricing_at_least_one_price`, índice parcial único `uq_ai_model_pricing_vigente (provider, model) WHERE effective_until IS NULL` (no-analog #5: versão UUID-PK + histórico livre), trigger scoped `update_ai_model_pricing_updated_at`, RLS service_role-only; 7 seeds vigentes com source_url/effective_from (gpt-4o, gpt-4o-mini, gpt-5.5, gpt-image-2, dall-e-3, gemini-2.0-flash, **gemini-3.1-flash-lite** — furo 3 sanado) com `ON CONFLICT (provider, model) WHERE effective_until IS NULL DO NOTHING`; RPC `admin_set_ai_model_price` (assinatura exata 11 params, p_reason antes dos DEFAULTs, SECURITY DEFINER, SET search_path='', transacional fecha vigente + abre nova, retorna previous_id)
- **Bloco 8-10:** 6 views de apuração/reconciliação (NO ANALOG #1 — primeiras CREATE VIEW do repo): admin_ai_operation_costs, admin_campaign_delivery_costs, admin_ai_cost_by_provider_model, admin_ai_cost_by_stage, admin_ai_cost_by_store, admin_cost_vs_credits (reconciliação campanha via credit_transactions deduction/campaign_pipeline + VS via store_visual_signatures.credit_tx_id, etapas_mais_caras via array_agg, regeneracoes via MAX(attempt_number)-1); RPC `admin_get_ai_costs` (8 filtros p_*, SECURITY DEFINER, SET search_path='', p_hours≥1, CTE filtered_ge + jsonb_agg)
- **Bloco 11:** REVERT comentado em ordem reversa (DROP FUNCTION ×2, DROP VIEW ×6, DROP TRIGGER/FUNCTION updated_at, DROP TABLE, DROP INDEX ×7, DROP COLUMN ×9, DROP CONSTRAINT cost_source + restauração do CHECK antigo)
- **db push aplicado no remoto** (exit 0): migration list mostra `20260808000001` no remoto; RPCs validados via REST (admin_get_ai_costs retorna JSONB correto; admin_set_ai_model_price retorna erro custom `ai_model_price_reason_required` — prova existência + validação); views NÃO acessíveis via REST (404) confirmando T-38.1-03

## Task Commits

Cada task foi commitada atomicamente:

1. **Task 1: Migration — Blocos schema (generation_events + campaigns + ai_model_pricing + seeds + RPC pricing)** - `34331a0` (feat)
2. **Task 2: Migration — Views admin_ai_* + admin_cost_vs_credits + RPC admin_get_ai_costs + REVERT** - `fee855c` (feat)
3. **Task 3: [BLOCKING] Schema push — supabase db push + validação das RPCs/views** - `9effc1d` (fix — auto-fixes Rule 1 que permitiram o push concluir; push em si não gera commit próprio)

**Plan metadata:** `9effc1d` (fix incluído no commit da Task 3)

## Files Created/Modified

- `supabase/migrations/20260808000001_f38_1_create_ai_cost_accounting.sql` - Migration única F38.1 (716 linhas): ALTER generation_events (9 colunas + 2 CHECKs + 5 índices), campaigns.operation_run_id + índice, ai_model_pricing + índice parcial único + trigger + RLS + 7 seeds, RPC admin_set_ai_model_price, 6 views admin_ai_*, RPC admin_get_ai_costs, REVERT comentado

## Decisions Made

- **REVOKE de views usa `ON TABLE`**: `REVOKE ALL ON VIEW` é sintaxe inválida em PostgreSQL — corrigido antes do push (Rule 1)
- **Views agrupam por colunas UUID em vez de `MAX(uuid)`**: `max(uuid)` não existe como função agregada no Postgres — CTEs campaign_runs/vs_runs passaram a agrupar por store_id/user_id/campaign_id/visual_signature_id (Rule 1)
- **db push é transacional**: as 2 tentativas que falharam (REVOKE ON VIEW, max(uuid)) reverteram completamente — nenhum estado parcial no remoto (confirmado na 3ª tentativa sem erros de objeto duplicado)
- **Views sem acesso direto**: 404 no REST para as 6 views confirma que `REVOKE ALL` + ausência de GRANT ao cliente funciona (T-38.1-03 mitigado)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] `REVOKE ALL ON VIEW` inválido em PostgreSQL**
- **Found during:** Task 3 (supabase db push — statement 36)
- **Issue:** Postgres não aceita `ON VIEW` em REVOKE (apenas `ON TABLE` cobre views) → `syntax error at or near "public"`
- **Fix:** Substituído `REVOKE ALL ON VIEW` por `REVOKE ALL ON TABLE` (6 ocorrências)
- **Files modified:** supabase/migrations/20260808000001_f38_1_create_ai_cost_accounting.sql
- **Verification:** db push re-executado sem erro de sintaxe
- **Committed in:** 9effc1d

**2. [Rule 1 - Bug] `max(uuid)` não existe em PostgreSQL**
- **Found during:** Task 3 (supabase db push — CREATE VIEW admin_cost_vs_credits)
- **Issue:** As CTEs `campaign_runs`/`vs_runs` usavam `MAX(store_id)`/`MAX(user_id)`/`MAX(campaign_id)`/`MAX(visual_signature_id)` sobre colunas UUID → `function max(uuid) does not exist`
- **Fix:** CTEs passam a agrupar diretamente pelas colunas UUID (`GROUP BY operation_run_id, store_id, user_id, campaign_id`) em vez de agregá-las (valores são constantes por run)
- **Files modified:** supabase/migrations/20260808000001_f38_1_create_ai_cost_accounting.sql
- **Verification:** db push concluído com exit 0; RPC admin_get_ai_costs retorna JSONB com os 5 agregadores
- **Committed in:** 9effc1d

---

**Total deviations:** 2 auto-fixed (2 Rule 1 bugs)
**Impact on plan:** Ambos os fixes eram erros de sintaxe PostgreSQL na migration — sem escopo creep, sem mudança de contrato. O push falhou 2× e foi corrigido até exit 0.

## Issues Encountered

- **2 falhas intermediárias de `supabase db push`** (REVOKE ON VIEW e max(uuid)) — ambas resolvidas como fixes Rule 1 e o push finalizou com exit 0. Confirmou-se que o push é transacional: nenhum objeto ficou parcialmente aplicado no remoto.
- **psql direto indisponível** (senha do banco não acessível no ambiente) — validação funcional das RPCs feita via REST com service_role (chamada real de `admin_get_ai_costs` retornou o JSONB correto; chamada de `admin_set_ai_model_price` com reason nulo retornou o erro custom `ai_model_price_reason_required`, provando existência, grants e validação).

## Authentication Gates

- **Supabase CLI session** — Task 3 exigia sessão autenticada ou `SUPABASE_ACCESS_TOKEN`. O checkpoint do usuário já estava resolvido antes da execução: sessão `supabase login` ativa (verificada com `supabase projects list`). O push rodou direto sem pedir token. Documentado como fluxo normal, não desvio.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- **Schema no remoto:** geração_events evoluído (colunas, CHECKs, índices), campaigns.operation_run_id, ai_model_pricing + seeds, 2 RPCs admin e 6 views aplicados via db push — pré-requisito obrigatório cumprido para toda a fase
- **Pronto para 38-1-02:** AiCostTracker (tipos call-level + escrita best-effort) consumindo o schema já evoluído
- **Verificação SQL completa I1-I6** (versionamento, RLS, views com dados reais, admin_get_metrics compat) fica para o plano 38-1-10, conforme planejado

---
*Phase: 38-1-ai-cost-accounting*
*Completed: 2026-08-08*

## Self-Check: PASSED

- `supabase/migrations/20260808000001_f38_1_create_ai_cost_accounting.sql` — FOUND on disk
- `38-1-01-SUMMARY.md` — FOUND on disk
- Commits: `34331a0`, `fee855c`, `9effc1d` — all present in git log
- db push: exit 0; `supabase migration list` shows `20260808000001` applied on remote; RPCs `admin_get_ai_costs` + `admin_set_ai_model_price` validated via REST (service_role)
