## 1. Migration SQL — generation_events + ai_model_pricing + Views + RPCs

- [x] 1.1 Criar `supabase/migrations/20260808000001_f38_1_create_ai_cost_accounting.sql` com ALTER de `generation_events`: `operation_run_id UUID`, `operation_run_type TEXT`, `visual_signature_id UUID REFERENCES store_visual_signatures(id)`, `theme_id UUID`, `cached_input_tokens INTEGER`, `image_tokens INTEGER`, `provider_reported_cost_usd REAL`, `cost_source TEXT`, `pricing_version TEXT` (todas `IF NOT EXISTS`) — D2; **ALTER de `campaigns` com `operation_run_id UUID` (`IF NOT EXISTS`) — preparo reuso F37 (D1/D2)**
- [x] 1.2 Adicionar CHECK `chk_generation_events_cost_source` (5 valores: provider_reported/pricing_table/fallback_static/manual_unknown/not_available) e substituir CHECK `chk_generation_events_type` expandido (inclui campaign_input_validation, campaign_image_review, visual_signature_image, visual_signature_validation, brand_profile_vision, brand_profile_text) — D2/D4/D5
- [x] 1.3 Índices novos em `generation_events`: `(operation_run_id)`, `(visual_signature_id)`, `(operation_run_type)`, `(cost_source)`, `(provider, model)`; **índice `idx_campaigns_operation_run_id` em `campaigns(operation_run_id)`** — D2
- [x] 1.4 Criar `ai_model_pricing` (preços nullable + CHECK `chk_ai_model_pricing_at_least_one_price`) com RLS service_role (sem GRANT para `authenticated`) e trigger scoped de `updated_at` — D8
- [x] 1.5 Seeds de `ai_model_pricing` com `source_url`/`source_note`/`effective_from` (gpt-4o, gpt-4o-mini, gpt-5.5 + cached, gpt-image-2 + image_unit, dall-e-3, gemini-2.0-flash, gemini-3.1-flash-lite) `ON CONFLICT DO NOTHING`, `effective_until` NULL — D8 (valores conferidos contra fonte antes de fixar)
- [x] 1.6 RPC `admin_set_ai_model_price` (SECURITY DEFINER, SET search_path='', `p_reason` ANTES dos opcionais, transacional: fecha vigente + abre nova, reason obrigatório, retorna JSONB {id, provider, model, effective_from, previous_id}) — D8
- [x] 1.7 Views `admin_ai_operation_costs`, `admin_campaign_delivery_costs`, `admin_ai_cost_by_provider_model`, `admin_ai_cost_by_stage`, `admin_ai_cost_by_store` — somam apenas call-level (excluem delivery markers), valor contábil `COALESCE(provider_reported_cost_usd, estimated_cost_usd)` — D10/D3
- [x] 1.8 View `admin_cost_vs_credits` (reconciliação USD × créditos): por campanha via `credit_transactions` (type='deduction', campaign_id, metadata.feature='campaign_pipeline'), por VS via `store_visual_signatures.metadata->>'credit_tx_id'`; saída com custo_usd_total, creditos_debitados, margem_estimada, etapas_mais_caras, regeneracoes — D10
- [x] 1.9 RPC `admin_get_ai_costs` (SECURITY DEFINER, filtros store/user/provider/model/generation_type/hours/operation_run_id) — D10
- [x] 1.10 Comentários de revert commands por objeto criado; verificação: migration aplica em banco real (I1) incl. coluna/índice de `campaigns.operation_run_id`, RLS authenticated sem acesso (I3)

## 2. Core Library — Tipos + AiCostTracker + Estimador

- [x] 2.1 Criar `src/lib/ai-cost/types.ts` (sem server-only): `COST_SOURCES`, `CostSource`, `OPERATION_RUN_TYPES`, `OperationRunType`, `TokenUsage`, `CostResolution`, `AiCostEvent`, `AiCallInfo` — D1/D4/D7/D12
- [x] 2.2 Criar `src/lib/ai-cost/tracker.ts` (server-only): classe `AiCostTracker` com `startRun(type)` (gera `operationRunId` UUID + `traceId` distintos) e `record(event)` best-effort (nunca lança; falha logada) — D7
- [x] 2.3 `record` grava todas as colunas novas (operation_run_id/type, cost_source, pricing_version, cached/image tokens, visual_signature_id, provider_reported_cost_usd); delivery marker com custo/tokens NULL + `metadata.duration_is_pipeline: true` (anti-dupla-contagem D1/D6)
- [x] 2.4 Refatorar `src/lib/ai-cost/cost-estimator.ts`: `estimateAiCost` → `resolveAiCost` por fonte (`provider_reported → pricing_table → fallback_static → not_available`); `CostResolution` com `costSource`/`pricingVersion`; corrige gemini-3.1-flash-lite, gpt-image-2, cached/image tokens — D9
- [x] 2.5 Criar `src/lib/ai-cost/ai-model-pricing.ts`: `DEFAULT_AI_MODEL_PRICING` (bootstrap em código, fail-open) + fonte de leitura da tabela (linha vigente por provider+model) — D8
- [x] 2.6 Atualizar `src/lib/ai-cost/index.ts` com exports do resolvedor + tracker; `insertGenerationEvent` em `generation-events.ts` passa a delegar ao tracker (mantém API externa p/ compat) — D7/D11
- [x] 2.7 Adaptar testes existentes de `cost-estimator.test.ts` ao novo contrato (`resolveAiCost`) — D9

## 3. Serviços — Callback onCall (usage/custo)

- [x] 3.1 `src/lib/copy/copy-director-service.ts`: `generateCopy(input, opts?)` aceita `onCall` invocado com `AiCallInfo` (usage/provider/model do `TextProviderResult`, durationMs) — furo 1, D7/D11
- [x] 3.2 `src/lib/image-generation/services/input-validation-service.ts`: `validate` aceita `onCall` com usage do `chat.completions` — furo 4, D11
- [x] 3.3 `src/lib/image-generation/services/image-review-service.ts`: `review` aceita `onCall` com usage da chamada vision — furo 4, D11
- [x] 3.4 `src/lib/image-generation/services/image-generation-service.ts`: ampliar `onMetricsEvent` com `usage`/`attempt_number` real do `generateWithRetry` e `durationMs` por chamada — furos 6/7, D11
- [x] 3.5 `src/lib/visual-signature/ai-image-generator.ts`: expõe usage (Responses API) para `visual_signature_image`; validator expõe usage para `visual_signature_validation`; `provider_reported_cost_usd` quando provider trouxer — furo 5, D11
- [x] 3.6 `src/lib/visual-signature/brand-profiler.ts`: callback `onCall` em `callVision`/`callVisionFull` — D11
- [x] 3.7 `src/lib/brand-assets/brand-director.ts` e `text-only-inference-service.ts`: callback `onCall` com usage — D11

## 4. Rotas — Instrumentação via AiCostTracker

- [x] 4.1 `src/app/api/campaign/generate-image/route.ts`: `tracker.startRun("campaign_delivery")` no início; remove os 4 inserts inline; registra via callbacks `campaign_copy` (usage real), `campaign_input_validation`, `campaign_image`, `campaign_image_review` (attempt 1..n); delivery `campaign_pipeline` sem custo/tokens; `metadata.totalCost` = soma real (furo 2); `duration_ms` por chamada (furo 7) — D7/D11
- [x] 4.2 Propagar `operation_run_id`/`trace_id` até copy/validação/imagem/review via `opts.telemetry` (mesmo run em tentativas/regenerações — D1); **persistir `operation_run_id` em `campaigns.operation_run_id` na criação da campanha (preparo reuso F37 — D1/D2)**
- [x] 4.3 `src/app/api/store/[id]/visual-signature/generate-without-logo/route.ts`: `tracker.startRun("visual_signature")`; eventos `visual_signature_image`/`visual_signature_validation` com custo/tokens e `visual_signature_id`; delivery `visual_signature` sem custo/tokens; nova tentativa pós-falha técnica = novo run — furo 5, D1/D11
- [x] 4.4 Rotas `/api/store/[id]/brand-profile/*`: registram delivery (`brand_profile_without_logo`/`_with_logo`) + call (`brand_profile_vision`/`brand_profile_text`) via tracker — hoje sem nenhum evento, D11
- [x] 4.5 Typographic fallback da VS: NÃO gera evento call-level (não inventar chamada) — D5

## 5. Admin — APIs (sem página)

- [x] 5.1 `src/app/api/admin/ai-model-pricing/route.ts`: `GET` (lista vigentes + histórico, requireAdmin) e `PUT` (zod: provider/model/reason + ao menos uma dimensão de preço; chama RPC `admin_set_ai_model_price`; 400/403/500) — D8
- [x] 5.2 `src/app/api/admin/ai-costs/route.ts`: `GET` com filtros → RPC `admin_get_ai_costs` (requireAdmin) — D10

## 6. Testes

- [x] 6.1 `resolveAiCost` — 10 testes (usage+linha→pricing_table com uuid; provider_reported; gpt-image-2 sem usage; gemini-3.1-flash-lite; gpt-4o sem usage→fallback_static; modelo desconhecido; code_default; not_available com tokens; cached tokens gpt-5.5; manual_unknown) — D9/D4/D8
- [x] 6.2 `AiCostTracker` — 8 testes (record grava colunas novas; nunca lança; startRun gera run+trace distintos; not_available grava tokens; mesmo run agrupa N chamadas; cost_source inválido TS; insertGenerationEvent delega; duration_ms por chamada) — D1/D2/D7
- [x] 6.3 Pipeline — 11 testes (copy com usage real e custo; campaign_input_validation registrado; campaign_image_review por tentativa attempt 1..n; recomposição mesmo run; metadata.totalCost soma real; delivery campaign_pipeline custo NULL + soma call-level via view; review falha → status failed + custo; duration_ms por chamada; operation_run_id propagado; campaigns.operation_run_id persistido na criação; admin_get_metrics preservado) — furos 1/2/4/6/7, D1/D2/D6/D11
- [x] 6.4 Assinatura visual — 6 testes (visual_signature_image + validation com custo/tokens; delivery custo NULL = soma das duas; nova tentativa pós-falha = novo run; visual_signature_id preenchido; typographic fallback sem evento; insertGenerationEvent VS compat F37) — furo 5, D1/D2/D5
- [x] 6.5 Brand profile — 4 testes (brand_profile_vision; brand_profile_text; delivery without/with_logo; regenerate novo run) — D1/D5/D11
- [x] 6.6 `ai_model_pricing` + API admin — 6 testes (PUT atualiza via RPC; versionamento 2ª linha nova; PUT sem reason → 400; PUT/GET sem admin → 403; authenticated não lê tabela RLS; seeds estrutura vigente) — D8
- [x] 6.7 Views/RPC — 6 testes (admin_ai_operation_costs agrupa por run soma só call-level; admin_campaign_delivery_costs por etapa; by_provider_model/by_stage; admin_cost_vs_credits reconcilia incl. evento só provider_reported; reconciliação VS via credit_tx_id; admin_get_ai_costs filtra) — D10/D3

## 7. Verificação

- [x] 7.1 Verificação SQL/integrada I1–I6: migration em banco real (colunas + CHECKs + índices incl. `campaigns.operation_run_id`), RPC pricing versiona (fecha + abre, p_reason antes dos opcionais), RLS authenticated sem acesso, resolveAiCost com seeds → pricing_table com uuid + seed só imagem persiste, views com dados reais sem duplicar delivery markers, admin_get_metrics segue respondendo
- [x] 7.2 Rodar `npx vitest run`, `npm run typecheck`, `npm run lint` e `npm run build` — sem regressões (pipeline 402/409/estorno, VS F29.1.1, gates F32/F33/F34/F36, legal F30, créditos F24/F38)
- [x] 7.3 Regressão manual UAT local: gerar campanha → eventos call-level com tokens/custo no mesmo operation_run_id + delivery custo NULL; rejeitar/recompor no mesmo run; gerar VS → eventos com custo + falha técnica novo run; gerar brand profile → brand_profile_*; query admin_cost_vs_credits; PUT pricing altera preço → novo pricing_version; regressão métricas admin/saldo/extrato/freemium/VS/legal

## 8. Runbook — Trackings (F38.1 como desdobramento da F38)

- [x] 8.1 `.planning/STATE.md`: seção "Phase 38.1 — Apuração de Custos de IA por Entrega" após a Fase 38; atualizar "Current Position" (linha ~429-431); frontmatter "Last updated"
- [x] 8.2 `.planning/ROADMAP.md`: linha na tabela Progress `38.1` + seção de detalhes "Phase 38.1" (goal/success criteria/dependencies, fonte `openspec/changes/fase-38-1-ai-cost-accounting/`); contagem da milestone v1.5; rodapé "Last updated"
- [x] 8.3 `.planning/REQUIREMENTS.md`: requisitos F38.1 na seção v1.5 (após aprovação dos specs OpenSpec)
- [x] 8.4 `.planning/PROJECT.md`: F38.1 na lista de target features do v1.5
- [x] 8.5 `ROADMAP.md` (raiz): nota de numbering/linha 38 mencionando "38.1 = Apuração de Custos de IA por Entrega" como desdobramento da F38

## 9. Fechamento — Estimativa operacional granular + ajuste provisório versionável da tool (2026-08-09)

- [x] 9.1 Migration `20260809000003_f38_1_provisional_image_tool_pricing.sql`: seed `('openai', 'responses:image_generation')` com `image_unit_usd = 0.065`, `effective_from`/`source_note` ("F38.1 beta estimate calibrated from OpenAI dashboard/Costs CSV; provisional until provider cost reconciliation"), `effective_until NULL`, `ON CONFLICT DO NOTHING` — linha da tool separada do orquestrador (gpt-5.5) e do Image API (gpt-image-2/dall-e-3)
- [x] 9.2 `DEFAULT_AI_MODEL_PRICING` ganha `responses:image_generation: { imageUnitCostUsd: 0.065 }` (bootstrap fail-open; fonte preferida é a linha na tabela) — sem hardcode oculto no estimator
- [x] 9.3 `CostResolution` ganha `textComponentUsd`, `imageToolComponentUsd`, `imageToolPricingProvider`, `imageToolPricingModel`, `imageToolPricingVersion` (metadata da fórmula v2)
- [x] 9.4 `resolveAiCost` fórmula v2 (`responses_image_generation_v2`): `estimated_cost_usd = text_component_usd + image_tool_component_usd` aplicada APENAS quando `generationType === "campaign_image"` E `imageGenerationTool === true`; tool pricing vinda de `ai_model_pricing` (linha `responses:image_generation`) ou bootstrap; sem pricing da tool → só componente textual + nota parcial `responses_image_generation_tool_without_unit_pricing`; `provider_reported_cost_usd` nunca recebe o ajuste (reservado p/ reconciliação futura); anti-dupla-cobrança em visual_signature/brand_profile/fallback gpt-image-2; mapeamento provider→tool via `IMAGE_GENERATION_TOOL_MODELS` (adapter p/ providers futuros)
- [x] 9.5 Rota `generate-image`: repassa `generationType` ao resolvedor; `buildCallMetadata` merge dos componentes da fórmula (cost_formula_version, text_component_usd, image_tool_component_usd, image_tool_pricing_*, cost_estimation_note) mantendo `provider_usage_raw`
- [x] 9.6 Testes: cost-estimator +4 (tool presente → 0.0092+0.065=0.0742; tool ausente → parcial; false → atual; visual_signature → sem componente); ai-model-pricing admin +2 (GET inclui tool line, PUT versiona tool); bootstrap espelha 8 entradas (7 + tool) — 1713 testes verdes
- [x] 9.7 Docs de fechamento: design.md (seção Closing — estimativa operacional granular, decisões, metadata v2, providers futuros), specs ai-cost-estimator/ai-model-pricing (ADDED requirements), VERIFICATION.md (seção de fechamento + UAT manual concluído)
- [x] 9.8 Aplicar migration `20260809000003` no banco (local + remoto) — confirmada aplicada (linha vigente `openai`/`responses:image_generation` com 0.065 consultada no remoto)
- [x] 9.9 Gates finais: `npm run lint`, `npm run build` — verificados EXIT=0 (lint limpo; build 53 páginas)

## 10. Migrations pós-UAT (nascidas no plano 38-1-10 durante a verificação I5/UAT)

> Rastreamento das 2 migrations adicionais criadas no plano 38-1-10 (verificação em banco real), já implementadas e aplicadas. Não correspondem a novas funcionalidades — são correções de apuração identificadas na verificação I5/UAT.

- [x] 10.1 Migration `20260809000001_f38_1_fix_regeneracoes_never_negative.sql`: corrige `regeneracoes` para **nunca negativo** (`GREATEST(..., 0)`) e restrito às **etapas de arte** (`campaign_image`, `campaign_image_review`, `visual_signature_image`, `visual_signature_validation`) — antes `MAX(attempt_number) - 1` sobre todos os call-level retornava `-1` em runs só com `campaign_input_validation`/`campaign_copy`; aplicada em `admin_ai_operation_costs`, `admin_cost_vs_credits` e `admin_get_ai_costs` (plano 38-1-10, task I5.1)
- [x] 10.2 Migration `20260809000002_f38_1_apuracao_janela_margem.sql`: (B) reconciliação do RPC passa a respeitar a **janela temporal** de `filtered_ge` (runs fora de `p_hours` só aparecem com `p_operation_run_id` explícito); (C) `admin_cost_vs_credits` passa a expor **dados brutos** e o RPC ganha o 9º parâmetro `p_credit_unit_usd_value` — `receita_estimada_usd = creditos_debitados * p_credit_unit_usd_value` e `margem_estimada = receita_estimada_usd - custo_usd_total` **somente quando configurado** (`VENDEO_AI_CREDIT_UNIT_USD_VALUE`, default NULL → ambos NULL; sem assumir 1 crédito = USD 1); spec `ai-cost-accounting` alinhado (9 params + margem condicional)

## Notas de rastreamento (sem mudança de código — alinhamento OpenSpec pré-archive)

- **`provider_reported_cost_usd` em `ai-image-generator.ts` é não-aplicável hoje** (task 3.5): a OpenAI Responses API não retorna custo financeiro direto por chamada, então o `onCall` emite apenas `provider/model/usage/durationMs`. O contrato `AiCallInfo.providerReportedCostUsd` permanece opcional no tipo; quando um provider expuser custo, o campo é preenchido. Sem mudança de runtime.
- **D7 `opts.telemetry` implementado via closure do `recordCall`**: em vez de um objeto de contexto de telemetria passado por parâmetro, as rotas capturam `operationRunId`/`traceId` por closure no helper local `recordCall` (plano 38-1-07). Coerência funcional idêntica à decisão D7 — sem alteração.
- **`admin_set_ai_model_price` usa erro genérico `ai_model_price_reason_required` para `p_provider`/`p_model` vazios** (migration `20260808000001`, validações de provider/model): aceito como cleanup futuro não-bloqueador (sugerido código distinto, ex.: `ai_model_price_provider_required`). Sem mudança de runtime nesta rodada.
