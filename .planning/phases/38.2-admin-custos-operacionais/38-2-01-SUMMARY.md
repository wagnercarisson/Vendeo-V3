---
phase: 38.2-admin-custos-operacionais
plan: 01
subsystem: database
tags: [supabase, migrations, sql, rpc, plpgsql, rls, economic-parameters, operation-runs, generation_events]

# Dependency graph
requires:
  - phase: 38-1-ai-cost-accounting
    provides: "generation_events call-level + operation_run_id, views admin_ai_*, view admin_cost_vs_credits, RPC admin_get_ai_costs, ai_model_pricing"
  - phase: 38-credit-operation-costs
    provides: "padrão F38: tabela + audit append-only + UNIQUE parcial operation_id + RPC SECURITY DEFINER + RLS service_role"
  - phase: 24-creditos-schema-saldo-transacoes
    provides: "credit_transactions (ledger) — leitura para evidências de segmento (D9)"
  - phase: 29-3-creditos-mensais-automaticos
    provides: "metadata de deduction com purchased_amount/bonus_amount (buckets)"
provides:
  - "economic_parameters + economic_parameter_audit (append-only, idempotência operation_id) + seeds 1.00/1.00 + RPC admin_set_economic_parameter (SECURITY DEFINER, transacional) + RLS service_role-only"
  - "generation_events com 4 colunas de confiança (cost_formula_version, cost_estimation_note, text_component_usd, image_tool_component_usd) — D5"
  - "RPCs admin_get_ai_operation_runs (lista com filtros/paginação/summary/P95/evidências de segmento/insumos de badge) e admin_get_ai_operation_run_events (detalhe call-level) — D4"
  - "Schema aplicado no banco remoto (supabase db push) — pré-requisito BLOCKING de toda a fase"
affects: [38-2-02 economic-parameters-service, 38-2-04 economic-parameters-api, 38-2-05 operation-runs-service, 38-2-06 ai-operation-runs-api, 38-2-08 ai-cost-tracker, 38-2-09 admin-metrics-correcao, 38-2-10 verificacao]

# Tech tracking
tech-stack:
  added: [supabase db push, plpgsql SECURITY DEFINER, percentile_cont, trigger append-only, UNIQUE partial index]
  patterns:
    - "Padrão F38 de idempotência: UNIQUE INDEX parcial em operation_id nas tabelas de auditoria"
    - "RPC definer com SET search_path = '' (anti-hijack ASVS 4.1.1) + REVOKE PUBLIC/anon/authenticated + GRANT service_role"
    - "Views de reconciliação reutilizadas via SQL interno do RPC (creditos_debitados via admin_cost_vs_credits) — sem duplicar lógica"
    - "Correção de UUID no PostgreSQL: sem MIN/MAX em UUID — subqueries correlacionadas com ORDER BY + LIMIT 1"

key-files:
  created:
    - "supabase/migrations/20260810000001_f38_2_economic_parameters.sql"
    - "supabase/migrations/20260810000002_f38_2_confidence_columns.sql"
    - "supabase/migrations/20260810000003_f38_2_operation_run_rpcs.sql"
    - "supabase/migrations/20260810000004_f38_2_fix_operation_run_rpcs.sql"
  modified: []

key-decisions:
  - "Migration 4 de fix criada (padrão F38.1 20260809000002/03) para corrigir MIN(uuid) no RPC de runs após o push — PostgreSQL não tem agregado MIN/MAX para UUID"
  - "Evidências de segmento (D9) no RPC: store_is_test via JOIN stores, deduction_purchased_amount/deduction_bonus_amount via credit_transactions metadata (buckets F29.3), admin_grant_evidence via admin_audit_log (grant_type='admin_grant') — RPC expõe evidência bruta, não classifica"
  - "creditos_debitados reutiliza public.admin_cost_vs_credits via SQL interno (FROM/JOIN) do RPC SECURITY DEFINER — a proibição de .from() vale para a camada de app/service, não para SQL de migration"

patterns-established:
  - "Pattern 1: evidências de deduction agregadas por run SEM multiplicação — DISTINCT por campaign_id/visual_signature_id no run antes do JOIN com credit_transactions"
  - "Pattern 2: paginação com LIMIT/OFFSET em subquery interna + jsonb_agg na externa (ORDER BY/LIMIT após agregação quebraria o OFFSET)"
  - "Pattern 3: provider/model/cost_source principal por run via subqueries correlacionadas com ORDER BY COUNT(*) DESC"

requirements-completed: [F38.2-02, F38.2-03, F38.2-08, F38.2-09, F38.2-17]

# Metrics
duration: 16min
completed: 2026-08-10
---

# Phase 38.2 Plan 01: Migrations 3 + db push [BLOCKING] Summary

**Schema da F38.2 aplicado no remoto: parâmetros econômicos com auditoria e RPC definer, 4 colunas de confiança em generation_events, e os RPCs de apuração por entrega (lista + detalhe call-level) com filtros, paginação, P95, evidências de segmento e insumos de badge**

## Performance

- **Duration:** 16 min
- **Started:** 2026-08-10T23:46:27Z
- **Completed:** 2026-08-11T00:02:34Z
- **Tasks:** 4 (3 migrations + push validação)
- **Files modified:** 4 (4 migrations SQL criadas)

## Accomplishments
- `economic_parameters` (key PK, value NUMERIC CHECK > 0, updated_by) + `economic_parameter_audit` append-only (trigger imutável, reason NOT NULL, UNIQUE parcial operation_id) + seeds idempotentes `usd_brl_rate`/`credit_value_brl` = 1.00 + RLS service_role-only (sem GRANT authenticated) — D2
- RPC `admin_set_economic_parameter` (SECURITY DEFINER, `SET search_path=''`, transacional: captura old → UPDATE → INSERT audit; reason obrigatório; value > 0; idempotência por operation_id; `id = gen_random_uuid()` sempre, `operation_id = p_operation_id` tal qual)
- `generation_events` + 4 colunas de confiança (D5): `cost_formula_version`, `cost_estimation_note`, `text_component_usd`, `image_tool_component_usd` — IF NOT EXISTS, sem CHECK, retrocompatível
- RPC `admin_get_ai_operation_runs` (11 params): filtros p_*, evidências brutas de segmento (D9), insumos de badge (D5), summary antes de paginar, P95 via `percentile_cont(0.95)`, paginação OFFSET/LIMIT + total, janela max 365d (`window_exceeded_365d`)
- RPC `admin_get_ai_operation_run_events`: eventos call-level completos + P95 por chamada; `run` NULL + `events` [] quando id não existe
- `creditos_debitados` reutiliza `public.admin_cost_vs_credits` via SQL do RPC (sem duplicar reconciliação); `admin_get_ai_costs` (F38.1) e views `admin_ai_*` intactos
- Push aplicado no remoto (exit 0): migration list mostra `20260810000001/02/03_f38_2_*` + fix `20260810000004`; RPCs validados via REST (runs total=10 + summary + paginação; eventos run real delivery_status=success; `window_exceeded_365d`; `economic_parameter_value_positive`; `economic_parameter_reason_required`); seeds 1.00/1.00 lidos; 4 colunas novas selecionáveis

## Task Commits

Each task was committed atomically:

1. **Task 1: Migration 1 — economic_parameters + audit + seeds + RPC + RLS** - `5030aa6` (feat)
2. **Task 2: Migration 2 — colunas de confiança em generation_events (D5)** - `4bf11c8` (feat)
3. **Task 3: Migration 3 — RPCs admin_get_ai_operation_runs/_events (D4)** - `5c44983` (feat)
4. **Task 4: [BLOCKING] Schema push — supabase db push + validação** - `0464872` (fix — migration 4 de correção pós-push; o push em si não gera commit próprio)

**Plan metadata:** pendente (docs commit)

## Files Created/Modified
- `supabase/migrations/20260810000001_f38_2_economic_parameters.sql` - Tabela economic_parameters + audit append-only + seeds 1.00/1.00 + RPC admin_set_economic_parameter + RLS service_role (D2)
- `supabase/migrations/20260810000002_f38_2_confidence_columns.sql` - 4 colunas de confiança em generation_events (D5), IF NOT EXISTS, sem CHECK
- `supabase/migrations/20260810000003_f38_2_operation_run_rpcs.sql` - RPCs admin_get_ai_operation_runs + admin_get_ai_operation_run_events (D4)
- `supabase/migrations/20260810000004_f38_2_fix_operation_run_rpcs.sql` - Fix pós-push: MIN(uuid) → subqueries correlacionadas no RPC de runs

## Decisions Made
- **Migration 4 de fix separada** (não editar a migration 3 já aplicada): a validação funcional via REST da Task 4 detectou `function min(uuid) does not exist`. PostgreSQL não tem agregado MIN/MAX para UUID. A correção segue o padrão F38.1 (`20260809000002`/`20260809000003` = migrations de ajuste pós-UAT). store_id/campaign_id/visual_signature_id agora resolvidos por subquery correlacionada (primeiro valor não-null do run, ORDER BY created_at ASC LIMIT 1).
- **Evidências de segmento (D9) como dados brutos no RPC**: `store_is_test` (JOIN stores.is_test_store), `deduction_purchased_amount`/`deduction_bonus_amount` (SUM de metadata->>'purchased_amount'/'bonus_amount' das deductions do run), `admin_grant_evidence` (contagem de `admin_audit_log` action='credit_grant' com grant_type='admin_grant' por store). O RPC NÃO classifica — o service layer (38-2-05) faz a classificação `test`/`freemium`/`paid`/`manual`/`unknown`.
- **Reuso de `admin_cost_vs_credits` via SQL interno**: `creditos_debitados` por run vem da view de reconciliação F38.1 (LEFT JOIN por operation_run_id) — evita duplicar a lógica de reconciliação. A proibição F38.1 de `.from()` nas views vale para a camada de app/service (cliente Supabase), não para SQL da migration.
- **Paginação e agregações**: `summary` calculado sobre o conjunto filtrado antes do LIMIT/OFFSET (KPIs da UI nunca sobre a página); paginação com subquery interna + `jsonb_agg` externa; P95 via `percentile_cont(0.95)`.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] `min(uuid)` não existe no PostgreSQL — RPC de runs quebrava**
- **Found during:** Task 4 (validação funcional via REST após o push)
- **Issue:** A CTE `runs` usava `MIN(cl.store_id)`, `MIN(cl.campaign_id)`, `MIN(cl.visual_signature_id)` — PostgreSQL não possui agregado MIN/MAX para tipo UUID → `function min(uuid) does not exist` (P0001). O RPC falhava com 404/PGRST202 na chamada REST.
- **Fix:** Migration 4 (`20260810000004_f38_2_fix_operation_run_rpcs.sql`) com CREATE OR REPLACE do RPC usando subqueries correlacionadas (primeiro valor não-null por run, ORDER BY created_at ASC LIMIT 1). `MIN(operation_run_type)`/`MIN(created_at)` (TEXT/TIMESTAMPTZ) mantidos.
- **Files modified:** supabase/migrations/20260810000004_f38_2_fix_operation_run_rpcs.sql (novo)
- **Verification:** `supabase db push --include-all` exit 0; REST: `admin_get_ai_operation_runs` retorna total=10, summary, paginação; `window_exceeded_365d` OK.
- **Committed in:** 0464872

**2. [Rule 1 - Bug] Paginação aplicada após o `jsonb_agg` — OFFSET/LIMIT inoperante**
- **Found during:** Task 3 (revisão do SQL antes do commit da migration 3)
- **Issue:** A subquery de `runs` tinha `ORDER BY ... LIMIT ... OFFSET` fora do `jsonb_agg` (sem GROUP BY, agregação em query única) — em PostgreSQL, o LIMIT/OFFSET se aplica ao resultado agregado (1 linha), não às linhas da página; a paginação nunca paginaria.
- **Fix:** Subquery interna `SELECT fr.* ... ORDER BY ... LIMIT/OFFSET` + `jsonb_agg(...)` na externa.
- **Files modified:** supabase/migrations/20260810000003_f38_2_operation_run_rpcs.sql
- **Verification:** grep de estrutura; push aplicado sem erro; REST com page=1/page_size=5 retorna 5 runs de total=10.
- **Committed in:** 5c44983 (parte do commit da Task 3)

**3. [Rule 1 - Bug] Multiplicação de deductions por eventos do run nas evidências de segmento**
- **Found during:** Task 3 (revisão do SQL antes do commit da migration 3)
- **Issue:** A CTE de evidências de deduction fazia `JOIN generation_events` por campaign_id — um run com N eventos call-level multiplicaria cada deduction por N, inflando `deduction_purchased_amount`/`deduction_bonus_amount` (e o SUM de metadata).
- **Fix:** Subqueries `SELECT DISTINCT campaign_id, operation_run_id`/`SELECT DISTINCT visual_signature_id, operation_run_id` antes do JOIN com credit_transactions — uma linha de deduction por run.
- **Files modified:** supabase/migrations/20260810000003_f38_2_operation_run_rpcs.sql
- **Verification:** estrutura revisada; push sem erro; REST com evidências retornando sem erro.
- **Committed in:** 5c44983 (parte do commit da Task 3)

---

**Total deviations:** 3 auto-fixed (3 bugs — Rule 1)
**Impact on plan:** Todos os fixes necessários para o schema funcionar no remoto (o fix 1 era BLOCKING do push funcional). Sem scope creep. As migrations 1/2 não tiveram desvios além dos ajustes de grep do verify (banner sem repetição de termos — parte do commit original).

## Issues Encountered
- **`supabase db push` requereu `--include-all`**: as 3 migrations F38.2 têm timestamp (20260810000001..03) anterior à última migration remota (`20260810010000_create_access_requests`), então o push pediu a flag para inserir antes da última. Resolvido com `--include-all` (não é confirmação interativa de dados, é o flag padrão de ordenação).
- **Validação funcional via REST em vez de psql direto**: senha do banco não acessível no ambiente (mesmo cenário da F38.1). RPCs validados por chamadas reais via PostgREST com service_role: `admin_get_ai_operation_runs` (total=10, summary, paginação, window_exceeded), `admin_get_ai_operation_run_events` (run real com 4 eventos, P95, delivery_status), `admin_set_economic_parameter` (validações `economic_parameter_value_positive` e `economic_parameter_reason_required` disparadas). Seeds 1.00/1.00 lidos via GET. Colunas novas selecionáveis via GET.
- **pg_proc/prosecdef não consultado diretamente**: sem acesso psql — evidência equivalente via REST (RPCs chamáveis = existem em pg_proc com grants; validações SQL disparando = corpo da função ativo). Validação formal I1–I6 fica para 38-2-10.

## Authentication Gates
- **supabase login (non-TTY):** o comando `supabase login` falha em ambiente não-interativo, MAS a sessão do CLI já estava ativa (token persistido) — `supabase migration list` e `supabase db push` funcionaram sem `SUPABASE_ACCESS_TOKEN` no ambiente. Nenhum gate de autenticação bloqueou a execução.

## User Setup Required
None - no external service configuration required (CLI já autenticado, projeto linkado).

## Next Phase Readiness
- **Schema no remoto:** economic_parameters + audit + seeds 1.00/1.00 + RPC admin_set_economic_parameter com RLS service_role-only; generation_events com 4 colunas de confiança; RPCs admin_get_ai_operation_runs/_events com filtros/paginação/P95/evidências de segmento/insumos de badge — **pré-requisito BLOCKING cumprido para toda a fase**
- **Pronto para:** 38-2-02 (EconomicParameterService fail-open/fail-closed), 38-2-04 (API economic-parameters), 38-2-05 (OperationRunsService + segmentação D9 + badges D5), 38-2-06 (API ai-operation-runs), 38-2-08 (AiCostTracker persiste os 4 campos de confiança — as colunas já existem), 38-2-09 (correção /admin/metrics)
- **Pendência de contrato para 38-2-05:** shape de `credit_transactions.metadata` confirmado em código (buckets `purchased_amount`/`bonus_amount` em deduction; `grant_type='admin_grant'` em admin_audit_log) — a classificação de segmento deve usar essas evidências com fallback `unknown`, nunca inferir errado (D9)

---
*Phase: 38.2-admin-custos-operacionais*
*Completed: 2026-08-10*

## Self-Check: PASSED
- Arquivos: 4 migrations + SUMMARY.md encontrados no disco (5/5 FOUND)
- Commits: 5030aa6, 4bf11c8, 5c44983, 0464872 presentes no git log (4/4 FOUND)
- Push remoto: 20260810000001/02/03_f38_2_* + 20260810000004 no migration list; RPCs validados via REST
