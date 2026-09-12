-- Migration F46 M1: evolução do CHECK chk_generation_events_type
-- Gateway Único de IA e Registry de Modelos (D6) — adiciona o novo generation_type
-- 'campaign_spec' (chamada legada do módulo campaign-intelligence, roteada pelo
-- gateway com default gpt-4o-mini), preservando TODOS os 15 valores vigentes.
--
-- Idempotente e aditivo/retrocompatível: DROP CONSTRAINT IF EXISTS + ADD CONSTRAINT
-- (padrão F37.2 20260906000003 / F38.1 / F44.1). Nenhum evento existente é
-- alterado/reclassificado. Sem alteração da coluna generation_type.
--
-- Rollback de código (D6): o CHECK permanece ADITIVO — o literal 'campaign_spec'
-- não é removido após eventos passarem a existir. O bloco REVERT abaixo só se
-- aplica ANTES de existir qualquer evento com generation_type = 'campaign_spec';
-- depois disso, removê-lo faria eventos históricos violarem o CHECK.

-- =============================================================================
-- 1. Evolução do CHECK chk_generation_events_type (15 -> 16 valores)
-- =============================================================================
ALTER TABLE public.generation_events
  DROP CONSTRAINT IF EXISTS chk_generation_events_type;

ALTER TABLE public.generation_events
  ADD CONSTRAINT chk_generation_events_type
  CHECK (generation_type IN (
    'campaign_pipeline','campaign_copy','campaign_input_validation',
    'campaign_image','campaign_image_review',
    'visual_signature','visual_signature_image','visual_signature_validation',
    'brand_profile_without_logo','brand_profile_with_logo',
    'brand_profile_vision','brand_profile_text',
    'theme_direction','theme_generation',
    'campaign_correction_analysis',
    'campaign_spec'
  ));

-- =============================================================================
-- REVERT (reverse order of creation) — retorno ao CHECK sem o novo literal
-- SÓ se aplica ANTES de existir qualquer evento 'campaign_spec' (D6).
-- =============================================================================
-- ALTER TABLE public.generation_events DROP CONSTRAINT IF EXISTS chk_generation_events_type;
-- ALTER TABLE public.generation_events ADD CONSTRAINT chk_generation_events_type
--   CHECK (generation_type IN (
--     'campaign_pipeline','campaign_copy','campaign_input_validation',
--     'campaign_image','campaign_image_review',
--     'visual_signature','visual_signature_image','visual_signature_validation',
--     'brand_profile_without_logo','brand_profile_with_logo',
--     'brand_profile_vision','brand_profile_text',
--     'theme_direction','theme_generation',
--     'campaign_correction_analysis'
--   ));
