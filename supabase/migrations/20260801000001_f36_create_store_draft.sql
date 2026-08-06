-- F36 — Criação de loja em modo draft (onboarding por abas)
-- =============================================================================
-- Cria a RPC create_store_draft: cria a loja SEM CNPJ (dados fiscais NULL,
-- colunas já nullable — sem ALTER), registra os 2 aceites legais do onboarding
-- (terms_of_service + acceptable_use, acceptance_source = 'onboarding') e NÃO
-- concede crédito freemium.
--
-- Regra (D15): loja draft não é loja pronta. Ela existe para permitir
-- onboarding, posicionamento e direção visual. Não libera campanha nem
-- freemium até cadastro fiscal válido (fluxo POST /api/store/update-cnpj),
-- exceto is_test_store.
--
-- Blocos:
--   1. RPC create_store_draft (17 parâmetros)
--   2. REVOKE/GRANT de execução

-- =============================================================================
-- 1. RPC create_store_draft
-- =============================================================================
CREATE OR REPLACE FUNCTION public.create_store_draft(
  p_user_id UUID,
  p_name TEXT,
  p_segment TEXT,
  p_city TEXT,
  p_state TEXT,
  p_accepted_by_user_id UUID,
  p_terms_version TEXT,
  p_acceptable_use_version TEXT,
  p_ip_address TEXT,
  p_user_agent TEXT,
  p_brand_color TEXT,
  p_logo_url TEXT,
  p_subsegment TEXT,
  p_tone_of_voice TEXT,
  p_positioning TEXT,
  p_short_description TEXT,
  p_slogan TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_store_id UUID;
  v_store_data JSONB;
BEGIN
  INSERT INTO public.stores (
    name, segment, user_id, city, state, brand_color, logo_url,
    subsegment, tone_of_voice, positioning, short_description, slogan
    -- cnpj_normalized/cnpj_root_hash/razao_social/nome_fantasia ficam NULL
    -- (colunas já nullable — sem ALTER nesta migration)
  ) VALUES (
    p_name, p_segment, p_user_id, p_city, p_state, p_brand_color, p_logo_url,
    p_subsegment, p_tone_of_voice, p_positioning, p_short_description, p_slogan
  )
  RETURNING id INTO v_store_id;

  INSERT INTO public.legal_acceptances (store_id, accepted_by_user_id, document_type, document_version, ip_address, user_agent, acceptance_source)
  VALUES
    (v_store_id, p_accepted_by_user_id, 'terms_of_service', p_terms_version, p_ip_address, p_user_agent, 'onboarding'),
    (v_store_id, p_accepted_by_user_id, 'acceptable_use', p_acceptable_use_version, p_ip_address, p_user_agent, 'onboarding');

  -- Sem concessão de crédito na criação draft (D15): loja draft não recebe
  -- crédito até cadastro fiscal válido via fluxo update-cnpj.

  SELECT jsonb_agg(row_to_json(s)) INTO v_store_data
  FROM (SELECT * FROM public.stores WHERE id = v_store_id) s;

  RETURN jsonb_build_object('store', v_store_data, 'onboardingGranted', false);
END;
$$;

-- =============================================================================
-- 2. Grants — service_role only (padrão F30/F32)
-- =============================================================================
REVOKE EXECUTE ON FUNCTION public.create_store_draft(
  p_user_id UUID, p_name TEXT, p_segment TEXT, p_city TEXT, p_state TEXT,
  p_accepted_by_user_id UUID, p_terms_version TEXT, p_acceptable_use_version TEXT,
  p_ip_address TEXT, p_user_agent TEXT, p_brand_color TEXT, p_logo_url TEXT,
  p_subsegment TEXT, p_tone_of_voice TEXT, p_positioning TEXT,
  p_short_description TEXT, p_slogan TEXT
) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.create_store_draft(
  p_user_id UUID, p_name TEXT, p_segment TEXT, p_city TEXT, p_state TEXT,
  p_accepted_by_user_id UUID, p_terms_version TEXT, p_acceptable_use_version TEXT,
  p_ip_address TEXT, p_user_agent TEXT, p_brand_color TEXT, p_logo_url TEXT,
  p_subsegment TEXT, p_tone_of_voice TEXT, p_positioning TEXT,
  p_short_description TEXT, p_slogan TEXT
) TO service_role;

-- =============================================================================
-- REVERT
-- =============================================================================
-- DROP FUNCTION IF EXISTS public.create_store_draft(
--   p_user_id UUID, p_name TEXT, p_segment TEXT, p_city TEXT, p_state TEXT,
--   p_accepted_by_user_id UUID, p_terms_version TEXT, p_acceptable_use_version TEXT,
--   p_ip_address TEXT, p_user_agent TEXT, p_brand_color TEXT, p_logo_url TEXT,
--   p_subsegment TEXT, p_tone_of_voice TEXT, p_positioning TEXT,
--   p_short_description TEXT, p_slogan TEXT
-- ) CASCADE;
