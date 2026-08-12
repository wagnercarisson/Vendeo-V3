-- =============================================================================
-- F38.1 fechamento — pricing provisório da tool image_generation (Responses API)
-- =============================================================================
-- Modelagem preferida (D8): o valor da FERRAMENTA não se mistura com o modelo
-- textual/orquestrador (gpt-5.5) nem com o Image API (gpt-image-2/dall-e-3).
--   provider = "openai"
--   model    = "responses:image_generation"
--   image_unit_usd = 0.065  (componente estimado por imagem gerada via tool)
--
-- Valor PROVISÓRIO calibrado a partir dos UATs de 2026-08-09 (dashboard/Costs CSV
-- da OpenAI) — NÃO é custo financeiro real. Versionável via PUT /api/admin/ai-model-pricing.
-- Providers futuros entram pelo mesmo contrato: provider = "<provider>", model =
-- "image_generation:<caminho-ou-nome>", image_unit_usd (sem lógica OpenAI hardcoded).
--
-- A estimativa da tool (fórmula responses_image_generation_v2) é aplicada apenas
-- quando generation_type = campaign_image E imageGenerationTool = true — nunca em
-- visual_signature/brand_profile (evita dupla cobrança). provider_reported_cost_usd
-- permanece reservado para custo informado pelo provider / reconciliação futura.
-- =============================================================================
INSERT INTO public.ai_model_pricing (
  provider, model,
  input_token_usd_per_1m, output_token_usd_per_1m,
  cached_input_token_usd_per_1m, image_unit_usd, image_token_usd_per_1m,
  effective_from, effective_until, source_url, source_note, updated_by
) VALUES (
  'openai', 'responses:image_generation', NULL, NULL, NULL, 0.065, NULL,
  '2026-08-09T00:00:00Z', NULL, 'https://platform.openai.com/docs/pricing',
  'F38.1 beta estimate calibrated from OpenAI dashboard/Costs CSV; provisional until provider cost reconciliation', NULL
)
ON CONFLICT (provider, model) WHERE effective_until IS NULL DO NOTHING;

-- REVERT:
-- UPDATE public.ai_model_pricing
--   SET effective_until = now()
-- WHERE provider = 'openai'
--   AND model = 'responses:image_generation'
--   AND effective_until IS NULL;
