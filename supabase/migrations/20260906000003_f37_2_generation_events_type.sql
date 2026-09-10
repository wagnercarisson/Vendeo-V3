-- Migration F37.2 M4: evolução do CHECK chk_generation_events_type
-- Correção Única por Não Conformidade (achado 4) — adiciona o novo generation_type
-- 'campaign_correction_analysis' (análise textual do relato) preservando TODOS os
-- valores vigentes (incl. theme_direction/theme_generation da F44.1).
--
-- Idempotente e aditivo/retrocompatível: DROP CONSTRAINT IF EXISTS + ADD CONSTRAINT
-- (padrão F38.1 20260808000001 / F44.1 20260825000001). Nenhum evento existente é
-- alterado/reclassificado. Sem alteração da coluna generation_type.

-- =============================================================================
-- 1. Evolução do CHECK chk_generation_events_type (14 -> 15 valores)
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
    'campaign_correction_analysis'
  ));

-- =============================================================================
-- REVERT (reverse order of creation) — retorno ao CHECK sem o novo literal
-- =============================================================================
-- ALTER TABLE public.generation_events DROP CONSTRAINT IF EXISTS chk_generation_events_type;
-- ALTER TABLE public.generation_events ADD CONSTRAINT chk_generation_events_type
--   CHECK (generation_type IN (
--     'campaign_pipeline','campaign_copy','campaign_input_validation',
--     'campaign_image','campaign_image_review',
--     'visual_signature','visual_signature_image','visual_signature_validation',
--     'brand_profile_without_logo','brand_profile_with_logo',
--     'brand_profile_vision','brand_profile_text',
--     'theme_direction','theme_generation'
--   ));
