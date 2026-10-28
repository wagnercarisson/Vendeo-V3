-- =============================================================================
-- F57.2 — Segmento 2: inicialização de configurações nos caminhos de onboarding
-- =============================================================================
-- Migration NOVA e aditiva, aplicada DEPOIS de 20261028145738_f57_2_market_preferences.sql
-- (que já está aplicada no homolog e não pode ser reescrita).
--
-- Recria LITERALMENTE o corpo vigente de:
--   - public.create_store_draft
--   - public.create_store_with_cnpj
--   - public.create_store_with_initial_grant
--   - public.update_store_cnpj
-- acrescentando APENAS a inicialização/atualização de public.store_market_settings.
--
-- public.admin_create_store_for_user NÃO é recriada: delega a
-- create_store_with_initial_grant e passa a inicializar por consequência.
--
-- Nenhum ramo de crédito/benefício/legal/auditoria/readiness é alterado.
-- Nenhum caminho cria loja PY; Paraguai permanece inerte.
-- =============================================================================

-- =============================================================================
-- 1. create_store_draft (corpo vigente F36 + ensure)
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

  PERFORM public.ensure_store_market_settings(v_store_id, 'BR', 'assumed_default');

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
-- 2. create_store_with_cnpj (corpo vigente F50 + ensure)
-- =============================================================================

DROP FUNCTION IF EXISTS public.create_store_with_cnpj(TEXT, TEXT, UUID, TEXT, TEXT, UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, JSONB, TEXT, TEXT, TEXT, JSONB, JSONB, TEXT[]);

CREATE OR REPLACE FUNCTION public.create_store_with_cnpj(
  p_cnpj_normalized TEXT,
  p_cnpj_root_hash TEXT,
  p_user_id UUID,
  p_name TEXT,
  p_segment TEXT,
  p_accepted_by_user_id UUID,
  p_terms_version TEXT,
  p_acceptable_use_version TEXT,
  p_ip_address TEXT,
  p_user_agent TEXT,
  p_city TEXT DEFAULT NULL,
  p_state TEXT DEFAULT NULL,
  p_brand_color TEXT DEFAULT NULL,
  p_logo_url TEXT DEFAULT NULL,
  p_subsegment TEXT DEFAULT NULL,
  p_tone_of_voice TEXT DEFAULT NULL,
  p_positioning TEXT DEFAULT NULL,
  p_short_description TEXT DEFAULT NULL,
  p_slogan TEXT DEFAULT NULL,
  p_cnpj_validation_score JSONB DEFAULT NULL,
  p_razao_social TEXT DEFAULT NULL,
  p_nome_fantasia TEXT DEFAULT NULL,
  p_verification_status TEXT DEFAULT 'unverified',
  p_verification_data JSONB DEFAULT NULL,
  p_cnpj_official_data JSONB DEFAULT NULL,
  p_verification_reasons TEXT[] DEFAULT NULL,
  p_demo_grant_enabled BOOLEAN DEFAULT false
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_store_id UUID;
  v_demo_grant JSONB;
  v_store_data JSONB;
BEGIN
  INSERT INTO public.stores (
    name, segment, user_id, city, state, brand_color, logo_url,
    subsegment, tone_of_voice, positioning, short_description, slogan,
    cnpj_normalized, cnpj_root_hash, cnpj_validation_score,
    razao_social, nome_fantasia,
    verification_status, verification_data, cnpj_official_data,
    verification_reasons, verification_requested_at
  ) VALUES (
    p_name, p_segment, p_user_id, p_city, p_state, p_brand_color, p_logo_url,
    p_subsegment, p_tone_of_voice, p_positioning, p_short_description, p_slogan,
    p_cnpj_normalized, p_cnpj_root_hash, p_cnpj_validation_score,
    p_razao_social, p_nome_fantasia,
    p_verification_status, p_verification_data, p_cnpj_official_data,
    p_verification_reasons,
    CASE WHEN p_verification_status != 'unverified' THEN now() ELSE NULL END
  )
  RETURNING id INTO v_store_id;

  PERFORM public.ensure_store_market_settings(v_store_id, 'BR', 'fiscal_confirmation');

  INSERT INTO public.legal_acceptances (store_id, accepted_by_user_id, document_type, document_version, ip_address, user_agent, acceptance_source)
  VALUES
    (v_store_id, p_accepted_by_user_id, 'terms_of_service', p_terms_version, p_ip_address, p_user_agent, 'onboarding'),
    (v_store_id, p_accepted_by_user_id, 'acceptable_use', p_acceptable_use_version, p_ip_address, p_user_agent, 'onboarding');

  v_demo_grant := jsonb_build_object('granted', false);
  IF p_verification_status = 'approved' THEN
    v_demo_grant := public.grant_demo_credits(v_store_id, p_cnpj_root_hash, 10, p_demo_grant_enabled, 168, NULL, NULL);
  END IF;

  SELECT jsonb_agg(row_to_json(s)) INTO v_store_data
  FROM (SELECT * FROM public.stores WHERE id = v_store_id) s;

  RETURN jsonb_build_object(
    'store', v_store_data,
    'onboardingGranted', COALESCE((v_demo_grant->>'granted')::boolean, false),
    'verificationStatus', p_verification_status
  );
END;
$$;

REVOKE ALL ON FUNCTION public.create_store_with_cnpj(TEXT, TEXT, UUID, TEXT, TEXT, UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, JSONB, TEXT, TEXT, TEXT, JSONB, JSONB, TEXT[], BOOLEAN) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_store_with_cnpj(TEXT, TEXT, UUID, TEXT, TEXT, UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, JSONB, TEXT, TEXT, TEXT, JSONB, JSONB, TEXT[], BOOLEAN) TO service_role;

-- =============================================================================
-- 3. create_store_with_initial_grant (corpo vigente F50, sem grant + ensure)
-- =============================================================================

CREATE OR REPLACE FUNCTION public.create_store_with_initial_grant(
  p_name TEXT,
  p_segment TEXT,
  p_user_id UUID,
  p_city TEXT DEFAULT NULL,
  p_state TEXT DEFAULT NULL,
  p_brand_color TEXT DEFAULT NULL,
  p_logo_url TEXT DEFAULT NULL,
  p_subsegment TEXT DEFAULT NULL,
  p_tone_of_voice TEXT DEFAULT NULL,
  p_positioning TEXT DEFAULT NULL,
  p_short_description TEXT DEFAULT NULL,
  p_slogan TEXT DEFAULT NULL,
  p_initial_grant_amount INTEGER DEFAULT 10
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
  ) VALUES (
    p_name, p_segment, p_user_id, p_city, p_state, p_brand_color, p_logo_url,
    p_subsegment, p_tone_of_voice, p_positioning, p_short_description, p_slogan
  )
  RETURNING id INTO v_store_id;

  PERFORM public.ensure_store_market_settings(v_store_id, 'BR', 'assumed_default');

  v_store_data := jsonb_build_object(
    'id', v_store_id,
    'name', p_name,
    'segment', p_segment,
    'balance', 0
  );
  RETURN v_store_data;
END;
$$;

REVOKE ALL ON FUNCTION public.create_store_with_initial_grant(TEXT, TEXT, UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, INTEGER) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_store_with_initial_grant(TEXT, TEXT, UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, INTEGER) TO service_role;

-- =============================================================================
-- 4. update_store_cnpj (corpo vigente F50 + bloco de configurações sob lock)
-- =============================================================================

DROP FUNCTION IF EXISTS public.update_store_cnpj(UUID, TEXT, TEXT, TEXT, TEXT, JSONB, TEXT, JSONB, JSONB, TEXT[]);

CREATE OR REPLACE FUNCTION public.update_store_cnpj(
  p_store_id UUID,
  p_cnpj_normalized TEXT,
  p_cnpj_root_hash TEXT,
  p_razao_social TEXT DEFAULT NULL,
  p_nome_fantasia TEXT DEFAULT NULL,
  p_cnpj_official_data JSONB DEFAULT NULL,
  p_verification_status TEXT DEFAULT 'unverified',
  p_verification_data JSONB DEFAULT NULL,
  p_cnpj_validation_score JSONB DEFAULT NULL,
  p_verification_reasons TEXT[] DEFAULT NULL,
  p_demo_grant_enabled BOOLEAN DEFAULT false
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_store_data JSONB;
  v_existing_hash TEXT;
  v_demo_grant JSONB;
  v_has_prior_benefit BOOLEAN;
  v_settings public.store_market_settings%ROWTYPE;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.stores WHERE id = p_store_id) THEN
    RAISE EXCEPTION 'store_not_found' USING HINT = 'Loja não encontrada';
  END IF;

  SELECT cnpj_root_hash INTO v_existing_hash FROM public.stores WHERE id = p_store_id;
  IF v_existing_hash IS NOT NULL AND v_existing_hash != '' THEN
    RAISE EXCEPTION 'cnpj_already_set' USING HINT = 'Esta loja já possui CNPJ cadastrado';
  END IF;

  UPDATE public.stores SET
    cnpj_normalized = p_cnpj_normalized,
    cnpj_root_hash = p_cnpj_root_hash,
    razao_social = p_razao_social,
    nome_fantasia = p_nome_fantasia,
    cnpj_official_data = COALESCE(p_cnpj_official_data, cnpj_official_data),
    verification_status = p_verification_status,
    verification_data = COALESCE(p_verification_data, verification_data),
    cnpj_validation_score = COALESCE(p_cnpj_validation_score, cnpj_validation_score),
    verification_reasons = COALESCE(p_verification_reasons, verification_reasons),
    verification_requested_at = CASE
      WHEN p_verification_status != 'unverified' AND stores.verification_requested_at IS NULL
      THEN now()
      ELSE stores.verification_requested_at
    END
  WHERE id = p_store_id;

  -- Evidência real de benefício anterior (loja com bonus_onboarding OU raiz com onboarding)
  SELECT EXISTS (
    SELECT 1 FROM public.credit_transactions
    WHERE store_id = p_store_id AND type = 'bonus_onboarding'
  ) OR EXISTS (
    SELECT 1 FROM public.freemium_entitlements
    WHERE root_hash = p_cnpj_root_hash AND benefit_type = 'onboarding'
  ) INTO v_has_prior_benefit;

  v_demo_grant := jsonb_build_object('granted', false);
  IF v_has_prior_benefit THEN
    -- Marcador legado: bloqueia demo futura, sem grant
    INSERT INTO public.freemium_entitlements (store_id, root_hash, benefit_type, reason)
    VALUES (p_store_id, p_cnpj_root_hash, 'onboarding', 'legacy_pre_f32_onboarding_consumed')
    ON CONFLICT (root_hash, benefit_type, (COALESCE(cycle, '_nostring_')))
    DO NOTHING;
  ELSIF p_verification_status = 'approved' THEN
    -- Loja draft elegível: concede a demonstração
    v_demo_grant := public.grant_demo_credits(p_store_id, p_cnpj_root_hash, 10, p_demo_grant_enabled, 168, NULL, NULL);
  END IF;

  -- Ordem obrigatória: ensure (idempotente) ANTES do lock.
  PERFORM public.ensure_store_market_settings(p_store_id, 'BR', 'fiscal_confirmation');

  SELECT * INTO v_settings
    FROM public.store_market_settings
    WHERE store_id = p_store_id
    FOR UPDATE;

  IF v_settings.country_code <> 'BR' THEN
    RAISE EXCEPTION 'country_not_mutable'
      USING HINT = 'País fiscal divergente do país cadastral registrado';
  END IF;

  -- Idioma/moeda derivam do MERCADO padrão; fuso deriva do país BR.
  -- Campos explicit nunca são recomputados.
  UPDATE public.store_market_settings SET
    country_code = 'BR',
    country_source = 'fiscal_confirmation',
    default_content_locale = CASE
      WHEN default_content_locale_source IN ('default', 'legacy_br')
        THEN (CASE WHEN default_campaign_market = 'PY' THEN 'es-PY' ELSE 'pt-BR' END)
      ELSE default_content_locale
    END,
    default_content_locale_source = CASE
      WHEN default_content_locale_source IN ('default', 'legacy_br') THEN 'default'
      ELSE default_content_locale_source
    END,
    default_currency = CASE
      WHEN default_currency_source IN ('default', 'legacy_br')
        THEN (CASE WHEN default_campaign_market = 'PY' THEN 'PYG' ELSE 'BRL' END)
      ELSE default_currency
    END,
    default_currency_source = CASE
      WHEN default_currency_source IN ('default', 'legacy_br') THEN 'default'
      ELSE default_currency_source
    END,
    time_zone = CASE
      WHEN time_zone_source IN ('default', 'legacy_br') THEN 'America/Sao_Paulo'
      ELSE time_zone
    END,
    time_zone_source = CASE
      WHEN time_zone_source IN ('default', 'legacy_br') THEN 'default'
      ELSE time_zone_source
    END,
    settings_version = settings_version + 1
  WHERE store_id = p_store_id;

  SELECT jsonb_agg(row_to_json(s)) INTO v_store_data
  FROM (SELECT * FROM public.stores WHERE id = p_store_id) s;

  RETURN jsonb_build_object(
    'store', v_store_data,
    'onboardingGranted', COALESCE((v_demo_grant->>'granted')::boolean, false)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.update_store_cnpj(UUID, TEXT, TEXT, TEXT, TEXT, JSONB, TEXT, JSONB, JSONB, TEXT[], BOOLEAN) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.update_store_cnpj(UUID, TEXT, TEXT, TEXT, TEXT, JSONB, TEXT, JSONB, JSONB, TEXT[], BOOLEAN) TO service_role;

-- =============================================================================
-- REVERT (comentado; NÃO executa nada)
-- =============================================================================
-- A reversão exige AUTORIZAÇÃO explícita e NÃO presume perda de preferências
-- como aceitável. Há DUAS reversões distintas; não confunda os escopos.
--
-- A) REVERT SOMENTE DO PLANO 57.2-04 (mantém tabelas/funções do plano 01):
--    1) Restaurar as definições anteriores das QUATRO RPCs recriadas:
--       - create_store_draft: 20260801000001_f36_create_store_draft.sql
--       - create_store_with_cnpj: 20260920000001_f50_demo_credits.sql
--       - create_store_with_initial_grant: 20260920000001_f50_demo_credits.sql
--       - update_store_cnpj: 20260920000001_f50_demo_credits.sql
--       (admin_create_store_for_user NÃO é restaurada: nunca foi recriada.)
--    2) PARE AQUI. NÃO dropar ensure/write, triggers, policies, tabelas ou
--       linhas de configurações: eles pertencem ao plano 01 e continuam válidos.
--
-- B) REVERT COMPLETO DA F57.2 (somente após A e com autorização separada):
--    3) Dropar as funções de escrita da F57.2 (write_* / ensure).
--    4) Dropar triggers e policies da F57.2.
--    5) Dropar as tabelas user_preferences e store_market_settings, com
--       backup/export explícito se houver dados que devam ser preservados.
--    Executar B para desfazer apenas o plano 04 apagaria entregas do plano 01.
