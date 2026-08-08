## 1. Migration SQL — generation_events + ai_model_pricing + Views + RPCs

- [ ] 1.1 Criar `supabase/migrations/20260808000001_f38_1_create_ai_cost_accounting.sql` com ALTER de `generation_events`: `operation_run_id UUID`, `operation_run_type TEXT`, `visual_signature_id UUID REFERENCES store_visual_signatures(id)`, `theme_id UUID`, `cached_input_tokens INTEGER`, `image_tokens INTEGER`, `provider_reported_cost_usd REAL`, `cost_source TEXT`, `pricing_version TEXT` (todas `IF NOT EXISTS`) — D2; **ALTER de `campaigns` com `operation_run_id UUID` (`IF NOT EXISTS`) — preparo reuso F37 (D1/D2)**
- [ ] 1.2 Adicionar CHECK `chk_generation_events_cost_source` (5 valores: provider_reported/pricing_table/fallback_static/manual_unknown/not_available) e substituir CHECK `chk_generation_events_type` expandido (inclui campaign_input_validation, campaign_image_review, visual_signature_image, visual_signature_validation, brand_profile_vision, brand_profile_text) — D2/D4/D5
- [ ] 1.3 Índices novos em `generation_events`: `(operation_run_id)`, `(visual_signature_id)`, `(operation_run_type)`, `(cost_source)`, `(provider, model)`; **índice `idx_campaigns_operation_run_id` em `campaigns(operation_run_id)`** — D2
- [ ] 1.4 Criar `ai_model_pricing` (preços nullable + CHECK `chk_ai_model_pricing_at_least_one_price`) com RLS service_role (sem GRANT para `authenticated`) e trigger scoped de `updated_at` — D8
- [ ] 1.5 Seeds de `ai_model_pricing` com `source_url`/`source_note`/`effective_from` (gpt-4o, gpt-4o-mini, gpt-5.5 + cached, gpt-image-2 + image_unit, dall-e-3, gemini-2.0-flash, gemini-3.1-flash-lite) `ON CONFLICT DO NOTHING`, `effective_until` NULL — D8 (valores conferidos contra fonte antes de fixar)
- [ ] 1.6 RPC `admin_set_ai_model_price` (SECURITY DEFINER, SET search_path='', `p_reason` ANTES dos opcionais, transacional: fecha vigente + abre nova, reason obrigatório, retorna JSONB {id, provider, model, effective_from, previous_id}) — D8
- [ ] 1.7 Views `admin_ai_operation_costs`, `admin_campaign_delivery_costs`, `admin_ai_cost_by_provider_model`, `admin_ai_cost_by_stage`, `admin_ai_cost_by_store` — somam apenas call-level (excluem delivery markers), valor contábil `COALESCE(provider_reported_cost_usd, estimated_cost_usd)` — D10/D3
- [ ] 1.8 View `admin_cost_vs_credits` (reconciliação USD × créditos): por campanha via `credit_transactions` (type='deduction', campaign_id, metadata.feature='campaign_pipeline'), por VS via `store_visual_signatures.metadata->>'credit_tx_id'`; saída com custo_usd_total, creditos_debitados, margem_estimada, etapas_mais_caras, regeneracoes — D10
- [ ] 1.9 RPC `admin_get_ai_costs` (SECURITY DEFINER, filtros store/user/provider/model/generation_type/hours/operation_run_id) — D10
- [ ] 1.10 Comentários de revert commands por objeto criado; verificação: migration aplica em banco real (I1) incl. coluna/índice de `campaigns.operation_run_id`, RLS authenticated sem acesso (I3)

## 2. Core Library — Tipos + AiCostTracker + Estimador

- [ ] 2.1 Criar `src/lib/ai-cost/types.ts` (sem server-only): `COST_SOURCES`, `CostSource`, `OPERATION_RUN_TYPES`, `OperationRunType`, `TokenUsage`, `CostResolution`, `AiCostEvent`, `AiCallInfo` — D1/D4/D7/D12
- [ ] 2.2 Criar `src/lib/ai-cost/tracker.ts` (server-only): classe `AiCostTracker` com `startRun(type)` (gera `operationRunId` UUID + `traceId` distintos) e `record(event)` best-effort (nunca lança; falha logada) — D7
- [ ] 2.3 `record` grava todas as colunas novas (operation_run_id/type, cost_source, pricing_version, cached/image tokens, visual_signature_id, provider_reported_cost_usd); delivery marker com custo/tokens NULL + `metadata.duration_is_pipeline: true` (anti-dupla-contagem D1/D6)
- [ ] 2.4 Refatorar `src/lib/ai-cost/cost-estimator.ts`: `estimateAiCost` → `resolveAiCost` por fonte (`provider_reported → pricing_table → fallback_static → not_available`); `CostResolution` com `costSource`/`pricingVersion`; corrige gemini-3.1-flash-lite, gpt-image-2, cached/image tokens — D9
- [ ] 2.5 Criar `src/lib/ai-cost/ai-model-pricing.ts`: `DEFAULT_AI_MODEL_PRICING` (bootstrap em código, fail-open) + fonte de leitura da tabela (linha vigente por provider+model) — D8
- [ ] 2.6 Atualizar `src/lib/ai-cost/index.ts` com exports do resolvedor + tracker; `insertGenerationEvent` em `generation-events.ts` passa a delegar ao tracker (mantém API externa p/ compat) — D7/D11
- [ ] 2.7 Adaptar testes existentes de `cost-estimator.test.ts` ao novo contrato (`resolveAiCost`) — D9

## 3. Serviços — Callback onCall (usage/custo)

- [ ] 3.1 `src/lib/copy/copy-director-service.ts`: `generateCopy(input, opts?)` aceita `onCall` invocado com `AiCallInfo` (usage/provider/model do `TextProviderResult`, durationMs) — furo 1, D7/D11
- [ ] 3.2 `src/lib/image-generation/services/input-validation-service.ts`: `validate` aceita `onCall` com usage do `chat.completions` — furo 4, D11
- [ ] 3.3 `src/lib/image-generation/services/image-review-service.ts`: `review` aceita `onCall` com usage da chamada vision — furo 4, D11
- [ ] 3.4 `src/lib/image-generation/services/image-generation-service.ts`: ampliar `onMetricsEvent` com `usage`/`attempt_number` real do `generateWithRetry` e `durationMs` por chamada — furos 6/7, D11
- [ ] 3.5 `src/lib/visual-signature/ai-image-generator.ts`: expõe usage (Responses API) para `visual_signature_image`; validator expõe usage para `visual_signature_validation`; `provider_reported_cost_usd` quando provider trouxer — furo 5, D11
- [ ] 3.6 `src/lib/visual-signature/brand-profiler.ts`: callback `onCall` em `callVision`/`callVisionFull` — D11
- [ ] 3.7 `src/lib/brand-assets/brand-director.ts` e `text-only-inference-service.ts`: callback `onCall` com usage — D11

## 4. Rotas — Instrumentação via AiCostTracker

- [ ] 4.1 `src/app/api/campaign/generate-image/route.ts`: `tracker.startRun("campaign_delivery")` no início; remove os 4 inserts inline; registra via callbacks `campaign_copy` (usage real), `campaign_input_validation`, `campaign_image`, `campaign_image_review` (attempt 1..n); delivery `campaign_pipeline` sem custo/tokens; `metadata.totalCost` = soma real (furo 2); `duration_ms` por chamada (furo 7) — D7/D11
- [ ] 4.2 Propagar `operation_run_id`/`trace_id` até copy/validação/imagem/review via `opts.telemetry` (mesmo run em tentativas/regenerações — D1); **persistir `operation_run_id` em `campaigns.operation_run_id` na criação da campanha (preparo reuso F37 — D1/D2)**
- [ ] 4.3 `src/app/api/store/[id]/visual-signature/generate-without-logo/route.ts`: `tracker.startRun("visual_signature")`; eventos `visual_signature_image`/`visual_signature_validation` com custo/tokens e `visual_signature_id`; delivery `visual_signature` sem custo/tokens; nova tentativa pós-falha técnica = novo run — furo 5, D1/D11
- [ ] 4.4 Rotas `/api/store/[id]/brand-profile/*`: registram delivery (`brand_profile_without_logo`/`_with_logo`) + call (`brand_profile_vision`/`brand_profile_text`) via tracker — hoje sem nenhum evento, D11
- [ ] 4.5 Typographic fallback da VS: NÃO gera evento call-level (não inventar chamada) — D5

## 5. Admin — APIs (sem página)

- [ ] 5.1 `src/app/api/admin/ai-model-pricing/route.ts`: `GET` (lista vigentes + histórico, requireAdmin) e `PUT` (zod: provider/model/reason + ao menos uma dimensão de preço; chama RPC `admin_set_ai_model_price`; 400/403/500) — D8
- [ ] 5.2 `src/app/api/admin/ai-costs/route.ts`: `GET` com filtros → RPC `admin_get_ai_costs` (requireAdmin) — D10

## 6. Testes

- [ ] 6.1 `resolveAiCost` — 10 testes (usage+linha→pricing_table com uuid; provider_reported; gpt-image-2 sem usage; gemini-3.1-flash-lite; gpt-4o sem usage→fallback_static; modelo desconhecido; code_default; not_available com tokens; cached tokens gpt-5.5; manual_unknown) — D9/D4/D8
- [ ] 6.2 `AiCostTracker` — 8 testes (record grava colunas novas; nunca lança; startRun gera run+trace distintos; not_available grava tokens; mesmo run agrupa N chamadas; cost_source inválido TS; insertGenerationEvent delega; duration_ms por chamada) — D1/D2/D7
- [ ] 6.3 Pipeline — 11 testes (copy com usage real e custo; campaign_input_validation registrado; campaign_image_review por tentativa attempt 1..n; recomposição mesmo run; metadata.totalCost soma real; delivery campaign_pipeline custo NULL + soma call-level via view; review falha → status failed + custo; duration_ms por chamada; operation_run_id propagado; campaigns.operation_run_id persistido na criação; admin_get_metrics preservado) — furos 1/2/4/6/7, D1/D2/D6/D11
- [ ] 6.4 Assinatura visual — 6 testes (visual_signature_image + validation com custo/tokens; delivery custo NULL = soma das duas; nova tentativa pós-falha = novo run; visual_signature_id preenchido; typographic fallback sem evento; insertGenerationEvent VS compat F37) — furo 5, D1/D2/D5
- [ ] 6.5 Brand profile — 4 testes (brand_profile_vision; brand_profile_text; delivery without/with_logo; regenerate novo run) — D1/D5/D11
- [ ] 6.6 `ai_model_pricing` + API admin — 6 testes (PUT atualiza via RPC; versionamento 2ª linha nova; PUT sem reason → 400; PUT/GET sem admin → 403; authenticated não lê tabela RLS; seeds estrutura vigente) — D8
- [ ] 6.7 Views/RPC — 6 testes (admin_ai_operation_costs agrupa por run soma só call-level; admin_campaign_delivery_costs por etapa; by_provider_model/by_stage; admin_cost_vs_credits reconcilia incl. evento só provider_reported; reconciliação VS via credit_tx_id; admin_get_ai_costs filtra) — D10/D3

## 7. Verificação

- [ ] 7.1 Verificação SQL/integrada I1–I6: migration em banco real (colunas + CHECKs + índices incl. `campaigns.operation_run_id`), RPC pricing versiona (fecha + abre, p_reason antes dos opcionais), RLS authenticated sem acesso, resolveAiCost com seeds → pricing_table com uuid + seed só imagem persiste, views com dados reais sem duplicar delivery markers, admin_get_metrics segue respondendo
- [ ] 7.2 Rodar `npx vitest run`, `npm run typecheck`, `npm run lint` e `npm run build` — sem regressões (pipeline 402/409/estorno, VS F29.1.1, gates F32/F33/F34/F36, legal F30, créditos F24/F38)
- [ ] 7.3 Regressão manual UAT local: gerar campanha → eventos call-level com tokens/custo no mesmo operation_run_id + delivery custo NULL; rejeitar/recompor no mesmo run; gerar VS → eventos com custo + falha técnica novo run; gerar brand profile → brand_profile_*; query admin_cost_vs_credits; PUT pricing altera preço → novo pricing_version; regressão métricas admin/saldo/extrato/freemium/VS/legal

## 8. Runbook — Trackings (F38.1 como desdobramento da F38)

- [ ] 8.1 `.planning/STATE.md`: seção "Phase 38.1 — Apuração de Custos de IA por Entrega" após a Fase 38; atualizar "Current Position" (linha ~429-431); frontmatter "Last updated"
- [ ] 8.2 `.planning/ROADMAP.md`: linha na tabela Progress `38.1` + seção de detalhes "Phase 38.1" (goal/success criteria/dependencies, fonte `openspec/changes/fase-38-1-ai-cost-accounting/`); contagem da milestone v1.5; rodapé "Last updated"
- [ ] 8.3 `.planning/REQUIREMENTS.md`: requisitos F38.1 na seção v1.5 (após aprovação dos specs OpenSpec)
- [ ] 8.4 `.planning/PROJECT.md`: F38.1 na lista de target features do v1.5
- [ ] 8.5 `ROADMAP.md` (raiz): nota de numbering/linha 38 mencionando "38.1 = Apuração de Custos de IA por Entrega" como desdobramento da F38
