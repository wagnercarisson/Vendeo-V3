## 1. Migration SQL — Parâmetros Econômicos (D2)

- [ ] 1.1 Criar `supabase/migrations/2026XXXXXX_f38_2_economic_parameters.sql` com `CREATE TABLE` de `economic_parameters` (key TEXT PK, value NUMERIC NOT NULL CHECK value > 0, updated_by UUID REFERENCES auth.users(id), updated_at, created_at) — D2
- [ ] 1.2 Criar `economic_parameter_audit` (id UUID PK, key TEXT NOT NULL, old_value NUMERIC, new_value NUMERIC, actor_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE, reason TEXT NOT NULL, operation_id UUID, created_at) + UNIQUE parcial `(operation_id) WHERE operation_id IS NOT NULL` (idempotência) + trigger imutável bloqueando UPDATE/DELETE — D2
- [ ] 1.3 Seeds idempotentes `('usd_brl_rate', 1.00)` e `('credit_value_brl', 1.00)` com `ON CONFLICT (key) DO NOTHING`, `updated_by` NULL — D2
- [ ] 1.4 RPC `admin_set_economic_parameter(p_actor_id, p_key, p_value, p_reason, p_operation_id DEFAULT NULL)` (SECURITY DEFINER, SET search_path='', transacional: captura old → UPDATE → INSERT audit → retorna JSONB { key, value, audit_id, updated_at, idempotent }; reason obrigatório; idempotência por operation_id; value > 0) — D2
- [ ] 1.5 RLS service_role (sem GRANT para `authenticated`) nas duas tabelas; revert commands por objeto; verificação: migration aplica em banco real (I1/I2), RLS authenticated sem acesso

## 2. Migration SQL — Colunas de confiança em generation_events (D5)

- [ ] 2.1 Criar `supabase/migrations/2026XXXXXX_f38_2_confidence_columns.sql` com `ALTER TABLE public.generation_events ADD COLUMN IF NOT EXISTS` de `cost_formula_version TEXT`, `cost_estimation_note TEXT`, `text_component_usd REAL`, `image_tool_component_usd REAL` (sem CHECK) — D5
- [ ] 2.2 Revert commands; verificação: migration aplica em banco real (I4); colunas com `IF NOT EXISTS` (retrocompatível com dados existentes)

## 3. Migration SQL — RPCs de operation runs (D4)

- [ ] 3.1 Criar `supabase/migrations/2026XXXXXX_f38_2_operation_run_rpcs.sql` com RPC `admin_get_ai_operation_runs` (SECURITY DEFINER, SET search_path=''): filtros `p_period_start`/`p_period_end`/`p_store_id`/`p_run_type`/`p_status`/`p_provider`/`p_model`/`p_generation_type`/`p_operation_run_id` + `p_page`/`p_page_size`; resumo por run (só call-level): `created_at`, `delivery_status`, `custo_usd_total`, `creditos_debitados` (reuso `admin_cost_vs_credits`), `duracao_total_ms`, `chamadas`, `chamadas_success`, `regeneracoes`, provider/model principal, `cost_source`, **P95 via `percentile_cont(0.95)`**; **evidências brutas de segmento por run (D9)**: `store_is_test`, `deduction_purchased_amount`, `deduction_bonus_amount`, `admin_grant_evidence` (RPC NÃO classifica segmento — só expõe evidência); **insumos agregados de badge (D5)**: `cost_sources` (array), `cost_estimation_notes` (distinct), flags `has_provider_reported`/`has_provisional_image_estimate`/`has_partial_estimate`/`has_not_available`/`has_estimated`; **`summary` sobre o conjunto filtrado antes de paginar** (`custo_usd_total`, `creditos_debitados`, `duracao_total_ms`, `tempo_medio_ms`, `p95_ms`, `total`, `erros`, `sucessos`); **limite operacional de janela de período** (default ≤ 90 dias, max 365, excedente → 400) para o service paginar o conjunto base de forma viável; retorna `{ runs, summary, page, total }` — D4/D5/D9
- [ ] 3.2 RPC `admin_get_ai_operation_run_events` (SECURITY DEFINER): `p_operation_run_id UUID` → `{ run, events }` com eventos call-level (generation_type, provider, model, status, error_type, attempt_number, duration_ms, prompt/completion/total/cached/image tokens, estimated_cost_usd, provider_reported_cost_usd, **text_component_usd**, **image_tool_component_usd**, cost_source, cost_formula_version, cost_estimation_note, metadata) + P95 de duração por chamada — D4
- [ ] 3.3 Sem leitura direta das views (F38.1 proíbe `.from()` nas views); `admin_get_ai_costs` (F38.1) **inalterado**; revert commands; verificação I5

## 4. Core Library — Tipos Econômicos + EconomicParameterService (D1/D2)

- [ ] 4.1 Criar `src/lib/economic/types.ts` (sem server-only): `ECONOMIC_PARAMETER_KEYS = ["usd_brl_rate", "credit_value_brl"]`, `EconomicParameterKey`, `EconomicParameterResolution { key, value, source: "table" | "fallback" }` — D1/D2
- [ ] 4.2 Criar `src/lib/economic/economic-parameter-service.ts` (server-only): classe `EconomicParameterService` com `getParameter(key)` (linha existente → table; inexistente → default 1.00 fail-open com log aviso; **erro real de leitura → lança `EconomicParameterUnavailableError` fail-closed**) e `getAll()` (mescla tabela + fallback com `source`) — D2

## 5. API — Configurações Econômicas (D2)

- [ ] 5.1 Adicionar em `src/lib/admin/schemas.ts`: `UpdateEconomicParameterRequestSchema` (key enum `ECONOMIC_PARAMETER_KEYS`, value > 0, reason obrigatório, operationId uuid opcional) — D2
- [ ] 5.2 Criar `src/app/api/admin/economic-parameters/route.ts`: `GET` (lista via `EconomicParameterService.getAll()` → 200 `{ parameters: [...] }`; 403 sem admin; 503 fail-closed) e `PUT` (zod + RPC `admin_set_economic_parameter`; 400/403/500; idempotência por operationId) — D2
- [ ] 5.3 **Sem endpoint público** (parâmetros são dado interno de operação)

## 6. Core Library — Service de Custos de Operação (D1/D4/D5/D9)

- [ ] 6.1 Criar service server-only de custos de operação (ex.: `src/lib/ai-cost/operation-runs-service.ts`) que chama os RPCs `admin_get_ai_operation_runs`/`admin_get_ai_operation_run_events` e deriva no service layer: `custoBrl = custoUsdTotal × usd_brl_rate`, `receitaOpBrl = creditosDebitados × credit_value_brl`, `resultadoOpBrl = receitaOpBrl − custoBrl`, `margemOpPct = receitaOpBrl > 0 ? (resultadoOpBrl/receitaOpBrl) × 100 : null` (via `EconomicParameterService`) — D1/D4
- [ ] 6.2 Derivação de **badges de confiança** (D5): mapa `cost_source` + `cost_estimation_note` → badge (`provider_reported` / `provisional image tool estimate` / `partial` / `estimated` / `not_available` / `estimated` genérico)
- [ ] 6.3 **Segmentação econômica (D9)** no service (nunca no RPC): classificador `classifySegment(store, deduction)` — `test` via `is_test_store`; `freemium/promotional` via `metadata->>'bonus_amount' > 0` e `purchased_amount = 0`; `paid` via `metadata->>'purchased_amount' > 0`; `manual/admin` via evidência `admin_grant` (**confirmar o shape real em `credit_transactions`** — `type`/`metadata.reason`/`metadata.source`; sem evidência confiável → `unknown`, nunca inferir errado); fallback `unknown`; `paid`/`unknown` com indicador de baixa confiança
- [ ] 6.4 Resolver `storeName` e `owner` (dono da loja, via `stores.user_id`) no service para a listagem/agregados — D3/D9

## 7. API — Custos de Operação (lista + detalhe) (D4)

- [ ] 7.1 Adicionar em `src/lib/admin/schemas.ts`: `AiOperationRunsQuerySchema` (period_start, period_end, store_id, operation_run_type, status, provider, model, generation_type, operation_run_id, segment, page, page_size) com **validação de janela de período** (default ≤ 90 dias, max 365 → 400) — D4
- [ ] 7.2 Criar `src/app/api/admin/ai-operation-runs/route.ts`: `GET` com query zod → service → `200 { runs, summary, aggregations, page, total }`; segmento classificado/filtrado no service **antes** de paginar (total reflete conjunto segmento-filtrado); `summary` e `aggregations` sobre o conjunto filtrado inteiro; badges derivados dos insumos agregados; 400 zod; 403 sem admin; 503 fail-closed — D4/D9
- [ ] 7.3 Criar `src/app/api/admin/ai-operation-runs/[operationRunId]/route.ts`: `GET` com `operationRunId` uuid → service → `200 { run, events }` (events com `estimatedCostBrl` derivado no service + badges); 400/403/503 — D4

## 8. UI — /admin/operation-costs "Configurações Econômicas" (D2)

- [ ] 8.1 `src/app/(app)/admin/operation-costs/page.tsx`: título visual "Configurações Econômicas" (rota mantida); busca parâmetros via `EconomicParameterService.getAll()` (estado 503 fail-closed padrão F38) — D2
- [ ] 8.2 `operation-costs-form.tsx` (+ `ParamsForm`): inputs `usd_brl_rate` ("Taxa de conversão USD→BRL") e `credit_value_brl` ("Valor operacional do crédito em BRL") com **motivo obrigatório**, badge `source` (`tabela`/`fallback`) e feedback `audit_id` após `PUT /api/admin/economic-parameters` — D2
- [ ] 8.3 Tabela de créditos por operação (F38) inalterada em schema; seção "Parâmetros Econômicos" adicionada à página

## 9. UI — /admin/ai-operation-costs "Custos de Operação" (D3/D9)

- [ ] 9.1 Criar `src/app/(app)/admin/ai-operation-costs/page.tsx` (Server Component, `force-dynamic`, `requireAdmin`, leitura via service layer server-only; estado 503 → "Serviço indisponível no momento" fail-closed; estado vazio → "aguardando dados de geração") — D3
- [ ] 9.2 Componentes: KPIs (custo USD/BRL, créditos, receita/resultado/margem BRL, tempo médio/P95, total de entregas, erros/sucessos), tabela por entrega (data, tipo, loja, status, custo USD/BRL, créditos, tempo, chamadas, regenerações, provider/model principal, badge confiança), filtros (período com **presets 7/30/90 dias** e limite de janela, loja, tipo, status, provider, model, gen_type, run_id, **segmento econômico**) — D3
- [ ] 9.3 **Drilldown** call-level por `operation_run_id` (via `GET /api/admin/ai-operation-runs/[id]`) com `estimated_cost_brl`, badges e **componentes de custo por chamada** (`text_component_usd`/`image_tool_component_usd`) — D3/D4/D5
- [ ] 9.4 **Agregados por segmento econômico (D9)**: custo por segmento, resultado operacional estimado por segmento, margem operacional estimada % por segmento, taxa de erro por segmento; gerações por hora, por owner (`stores.user_id`), por loja, por tipo de entrega, por status, por segmento — D3/D9
- [ ] 9.5 Badge de confiança + legend "estimativas operacionais, não custo financeiro reconciliado"; **placeholder F38.3**: "Custo estimado Vendeo" / "Custo reconciliado provider: ainda indisponível" / "Diferença: pendente" — D5/D7
- [ ] 9.6 `src/app/(app)/admin/layout.tsx`: link "Custos de Operação" → `/admin/ai-operation-costs` na navegação admin — D3

## 10. Correção do /admin/metrics (D6)

- [ ] 10.1 `src/lib/metrics/pipeline-metrics.ts`: `getAvgCost` deixa de ler `campaign_pipeline.estimated_cost_usd` e passa a apurar **custo médio de IA por entrega** via apuração call-level (`admin_get_ai_costs` `by_operation_run` → média de `custo_usd_total`; ou RPC de resumo novo `admin_get_ai_operation_runs`) — D6
- [ ] 10.2 `src/app/(app)/admin/metrics/page.tsx`: card renomeado para "**Custo Médio IA**"; conversão USD→BRL passa a usar `economic_parameters.usd_brl_rate` (fonte única D2) via `EconomicParameterService` — **`VENDEO_USD_BRL_RATE` deixa de ser a fonte ativa** (default 1.00 do parâmetro) — D6
- [ ] 10.3 `admin_get_metrics` (F28) **inalterado**; demais cards de métricas sem mudança — D6

## 11. AiCostTracker — persistência de confiança (D5)

- [ ] 11.1 `src/lib/ai-cost/types.ts`: `CostResolution` ganha `costFormulaVersion`, `costEstimationNote`, `textComponentUsd`, `imageToolComponentUsd` (já computados pelo `resolveAiCost`) — D5
- [ ] 11.2 `src/lib/ai-cost/tracker.ts`: `record` passa a persistir `cost_formula_version`, `cost_estimation_note`, `text_component_usd`, `image_tool_component_usd` a partir do `CostResolution` — daqui para frente, sem reclassificar histórico (eventos anteriores → NULL → badge genérico) — D5

## 12. Testes

- [ ] 12.1 `EconomicParameterService` — 5 testes (linha existente → table; inexistente → fallback 1.00 fail-open; erro real → `EconomicParameterUnavailableError` fail-closed; getAll mescla + source; value <= 0 rejeitado) — D2
- [ ] 12.2 API Configurações Econômicas — 5 testes (PUT atualiza via RPC + audit; sem reason → 400; key inválido/value <= 0 → 400; GET/PUT sem admin → 403; idempotência por operation_id) — D2
- [ ] 12.3 Persistência de confiança (tracker) — 4 testes (record persiste 4 campos; evento sem nota → NULL/badge genérico; provider_reported → badge; nota provisional + pricing_table → badge provisional image tool estimate) — D5
- [ ] 12.4 API Custos de Operação (lista + detalhe) — 11 testes (resumo por run; filtros; paginação; `summary`/`aggregations` sobre conjunto filtrado inteiro não da página; segmento filtra antes de paginar com total consistente; janela excedente → 400; detalhe call-level com `textComponentUsd`/`imageToolComponentUsd`; estimated_cost_brl no service; receita/resultado/margem BRL com margem null quando receita 0; badges dos insumos agregados; P95; 403/503) — D1/D3/D4/D5/D9
- [ ] 12.5 Segmentação econômica (classificador D9) — 5 testes (test via is_test_store; freemium/promotional; paid; manual/admin com shape confirmado + unknown quando shape divergente; unknown sem evidência) — D9
- [ ] 12.6 Página `/admin/ai-operation-costs` — 5 testes (KPIs + tabela com badges; drilldown; estado vazio; filtros atualizam; 503 indisponível) — D3
- [ ] 12.7 Página `/admin/operation-costs` (Configurações Econômicas) — 3 testes (título + seção de parâmetros; edição com motivo obrigatório; badge source) — D2
- [ ] 12.8 Correção `/admin/metrics` — 4 testes (getAvgCost NÃO lê campaign_pipeline.estimated_cost_usd; card "Custo Médio IA" exibe média por entrega; USD→BRL usa economic_parameters.usd_brl_rate não env; regressão demais cards) — D6

## 13. Verificação

- [ ] 13.1 Verificação SQL/integrada I1–I6: `economic_parameters` schema/seeds/CHECK/RLS; audit append-only + idempotência + reason obrigatório; RPC `admin_set_economic_parameter` transacional/rollback/retry idempotente; `generation_events` 4 colunas novas + tracker persistindo; RPCs novos com filtros/paginação/P95/evidências de segmento/insumos de badge/text_component_usd sem leitura direta das views; limite de janela (default ≤ 90d, max 365d → 400) validado no zod do GET; `/admin/metrics` corrigido em banco real (custo médio = média da apuração call-level, não NULL) — padrão F38/F38.1
- [ ] 13.2 Rodar `npx vitest run`, `npm run typecheck`, `npm run lint` e `npm run build` — sem regressões (pipeline 402/409/estorno, VS F29.1.1, gates F32/F33/F34/F36, legal F30, créditos F24/F38, F38.1)
- [ ] 13.3 Regressão manual UAT local: configurar `usd_brl_rate`/`credit_value_brl` em Configurações Econômicas com audit; abrir Custos de Operação com filtros/presets de período/KPIs/tabela/drilldown (com componentes de custo)/badges; verificar segmentos econômicos; conferir `/admin/metrics` com "Custo Médio IA" não NULL; placeholder F38.3 visível

## 14. Runbook — Trackings (F38.2 como desdobramento da F38 — D8)

- [ ] 14.1 `ROADMAP.md` (raiz): sub-bullet 38.2 na F38 + linha na tabela Progress (`38.2. Admin de Custos Operacionais + Configurações Econômicas | v1.5 | 0/0 | ○ Pending`)
- [ ] 14.2 `.planning/ROADMAP.md`: nota de "Phase numbering" + linha na tabela de progress + seção "Phase 38.2" (goal/deps/source) + Dependency Graph + rodapé "Last updated"
- [ ] 14.3 `.planning/STATE.md`: "Last updated" + "Current Position" + tabela "Next Phases" (F38.2 ○ Pending)
- [ ] 14.4 `.planning/PROJECT.md`: target features da v1.5 ganham a F38.2
- [ ] 14.5 `.planning/REQUIREMENTS.md`: nota placeholder — requisitos da F38.2 entram quando os specs OpenSpec forem aprovados
