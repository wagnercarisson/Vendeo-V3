-- Verificação CNPJ Freemium (F33)
-- Adiciona verificação cadastral de CNPJ via consulta a APIs externas
-- (BrasilAPI com fallback CNPJá). Implementa motor de decisão determinístico
-- que define elegibilidade do freemium: approve/review/reject/defer.
--
-- Blocos:
--   1. Colunas de verificação em stores + índices
--   2. Tabela cnpj_lookup_cache + índices + RLS
--   3. RPC update_store_verification
--   4. RPC admin_approve_store_verification
--   5. RPC admin_reject_store_verification
--   6. RPC admin_create_test_store
--   7. RPC admin_exception_store_verification
--   8. ALTER FUNCTION create_store_with_cnpj (verificacao-aware)
--   9. ALTER FUNCTION admin_get_users_summary (incluir verification_status)

-- =============================================================================
-- 1. Colunas de verificação em stores + índices
-- =============================================================================
ALTER TABLE public.stores ADD COLUMN IF NOT EXISTS verification_status TEXT NOT NULL DEFAULT 'unverified'
  CHECK (verification_status IN ('unverified','pending','approved','review','rejected','defer'));
ALTER TABLE public.stores ADD COLUMN IF NOT EXISTS verification_data JSONB;
ALTER TABLE public.stores ADD COLUMN IF NOT EXISTS cnpj_official_data JSONB;
ALTER TABLE public.stores ADD COLUMN IF NOT EXISTS cnpj_lookup_hash TEXT;
ALTER TABLE public.stores ADD COLUMN IF NOT EXISTS verification_requested_at TIMESTAMPTZ;
ALTER TABLE public.stores ADD COLUMN IF NOT EXISTS verification_decided_at TIMESTAMPTZ;
ALTER TABLE public.stores ADD COLUMN IF NOT EXISTS verification_reasons TEXT[];
ALTER TABLE public.stores ADD COLUMN IF NOT EXISTS is_test_store BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN public.stores.verification_status IS 'Estado da verificação cadastral: unverified | pending | approved | review | rejected | defer';
COMMENT ON COLUMN public.stores.verification_data IS 'Dados completos da verificação (inclui sinais de avaliação)';
COMMENT ON COLUMN public.stores.cnpj_official_data IS 'Dados oficiais retornados pela consulta CNPJ (BrasilAPI/CNPJá)';
COMMENT ON COLUMN public.stores.cnpj_lookup_hash IS 'Hash do resultado do lookup para detecção de reconsultas';
COMMENT ON COLUMN public.stores.verification_requested_at IS 'Timestamp da solicitação de verificação';
COMMENT ON COLUMN public.stores.verification_decided_at IS 'Timestamp da decisão de verificação (automática ou manual)';
COMMENT ON COLUMN public.stores.verification_reasons IS 'Motivos da decisão de verificação (ex: nome_divergente, situacao_suspensa)';
COMMENT ON COLUMN public.stores.is_test_store IS 'Se true, loja é de teste (criada por admin). Excluída de métricas.';

CREATE INDEX IF NOT EXISTS idx_stores_verification_status
  ON public.stores (verification_status)
  WHERE verification_status != 'unverified';

CREATE INDEX IF NOT EXISTS idx_stores_is_test_store
  ON public.stores (is_test_store)
  WHERE is_test_store = true;

-- =============================================================================
-- 2. Tabela cnpj_lookup_cache + índices + RLS
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.cnpj_lookup_cache (
  cnpj_normalized TEXT PRIMARY KEY,
  outcome TEXT NOT NULL CHECK (outcome IN ('resolved', 'not_found')),
  result_data JSONB,
  provider TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL
);

COMMENT ON TABLE public.cnpj_lookup_cache IS 'Cache de consultas CNPJ para evitar reconsultas desnecessárias a APIs externas.';
COMMENT ON COLUMN public.cnpj_lookup_cache.cnpj_normalized IS 'CNPJ normalizado (14 dígitos) — chave primária.';
COMMENT ON COLUMN public.cnpj_lookup_cache.outcome IS 'Resultado da consulta: resolved (encontrado) ou not_found (não encontrado).';
COMMENT ON COLUMN public.cnpj_lookup_cache.result_data IS 'Dados oficiais do CNPJ (JSONB). NULL se outcome = not_found.';
COMMENT ON COLUMN public.cnpj_lookup_cache.provider IS 'Provedor que retornou os dados (brasilapi ou cnpja).';
COMMENT ON COLUMN public.cnpj_lookup_cache.expires_at IS 'Data de expiração do cache. TTL 24h.';

CREATE INDEX IF NOT EXISTS idx_cnpj_lookup_cache_expires
  ON public.cnpj_lookup_cache (expires_at);

ALTER TABLE public.cnpj_lookup_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY IF NOT EXISTS "Service role manages cnpj lookup cache"
  ON public.cnpj_lookup_cache
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- =============================================================================
-- 3. RPC update_store_verification
-- =============================================================================
CREATE OR REPLACE FUNCTION public.update_store_verification(
  p_store_id UUID,
  p_status TEXT,
  p_data JSONB DEFAULT NULL,
  p_official_data JSONB DEFAULT NULL,
  p_reasons TEXT[] DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_store_data JSONB;
BEGIN
  IF p_status NOT IN ('pending','approved','review','rejected','defer') THEN
    RAISE EXCEPTION 'invalid_status' USING HINT = 'Status inválido: ' || p_status;
  END IF;

  UPDATE public.stores SET
    verification_status = p_status,
    verification_data = COALESCE(p_data, verification_data),
    cnpj_official_data = COALESCE(p_official_data, cnpj_official_data),
    verification_reasons = COALESCE(p_reasons, verification_reasons),
    verification_decided_at = CASE
      WHEN p_status IN ('approved','rejected','defer') THEN now()
      ELSE NULL
    END,
    verification_requested_at = CASE
      WHEN verification_requested_at IS NULL AND p_status = 'pending' THEN now()
      ELSE verification_requested_at
    END
  WHERE id = p_store_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'store_not_found' USING HINT = 'Loja não encontrada';
  END IF;

  SELECT jsonb_agg(row_to_json(s)) INTO v_store_data
  FROM (SELECT id, verification_status, verification_data, cnpj_official_data, verification_reasons,
               verification_decided_at, verification_requested_at
        FROM public.stores WHERE id = p_store_id) s;

  RETURN jsonb_build_object('success', true, 'store', v_store_data);
END;
$$;

-- =============================================================================
-- 4. RPC admin_approve_store_verification
-- =============================================================================
CREATE OR REPLACE FUNCTION public.admin_approve_store_verification(
  p_store_id UUID,
  p_admin_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_root_hash TEXT;
  v_entitlement_id UUID;
  v_grant_tx_id UUID;
  v_store_data JSONB;
BEGIN
  SELECT cnpj_root_hash INTO v_root_hash
  FROM public.stores WHERE id = p_store_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'store_not_found' USING HINT = 'Loja não encontrada';
  END IF;

  UPDATE public.stores SET
    verification_status = 'approved',
    verification_decided_at = now()
  WHERE id = p_store_id;

  IF v_root_hash IS NOT NULL AND v_root_hash != '' THEN
    v_entitlement_id := public.try_grant_onboarding_entitlement(p_store_id, v_root_hash);

    IF v_entitlement_id IS NOT NULL THEN
      SELECT public.grant_credits(
        p_store_id, 10, 'onboarding',
        'onboarding_' || p_store_id,
        jsonb_build_object('source', 'admin_approve_verification'),
        'bonus_onboarding'
      ) INTO v_grant_tx_id;

      UPDATE public.freemium_entitlements SET grant_transaction_id = v_grant_tx_id
      WHERE id = v_entitlement_id;
    END IF;
  END IF;

  INSERT INTO public.admin_audit_log (action, target_type, target_id, actor_id, metadata)
  VALUES ('approve_verification', 'store', p_store_id, p_admin_id,
    jsonb_build_object(
      'entitlement_id', v_entitlement_id,
      'grant_transaction_id', v_grant_tx_id
    ));

  SELECT jsonb_agg(row_to_json(s)) INTO v_store_data
  FROM (SELECT id, verification_status, verification_decided_at FROM public.stores WHERE id = p_store_id) s;

  RETURN jsonb_build_object(
    'success', true,
    'onboardingGranted', v_entitlement_id IS NOT NULL,
    'store', v_store_data
  );
END;
$$;

-- =============================================================================
-- 5. RPC admin_reject_store_verification
-- =============================================================================
CREATE OR REPLACE FUNCTION public.admin_reject_store_verification(
  p_store_id UUID,
  p_admin_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_store_data JSONB;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.stores WHERE id = p_store_id) THEN
    RAISE EXCEPTION 'store_not_found' USING HINT = 'Loja não encontrada';
  END IF;

  UPDATE public.stores SET
    verification_status = 'rejected',
    verification_decided_at = now()
  WHERE id = p_store_id;

  INSERT INTO public.admin_audit_log (action, target_type, target_id, actor_id)
  VALUES ('reject_verification', 'store', p_store_id, p_admin_id);

  SELECT jsonb_agg(row_to_json(s)) INTO v_store_data
  FROM (SELECT id, verification_status, verification_decided_at FROM public.stores WHERE id = p_store_id) s;

  RETURN jsonb_build_object('success', true, 'store', v_store_data);
END;
$$;

-- =============================================================================
-- 6. RPC admin_create_test_store
-- =============================================================================
CREATE OR REPLACE FUNCTION public.admin_create_test_store(
  p_user_id UUID,
  p_name TEXT,
  p_segment TEXT,
  p_cnpj_normalized TEXT,
  p_razao_social TEXT DEFAULT NULL,
  p_nome_fantasia TEXT DEFAULT NULL,
  p_city TEXT DEFAULT NULL,
  p_state TEXT DEFAULT NULL,
  p_granted_by UUID DEFAULT NULL
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
    name, segment, user_id, city, state,
    cnpj_normalized, razao_social, nome_fantasia,
    is_test_store, verification_status
  ) VALUES (
    p_name, p_segment, p_user_id, p_city, p_state,
    p_cnpj_normalized, p_razao_social, p_nome_fantasia,
    true, 'approved'
  )
  RETURNING id INTO v_store_id;

  INSERT INTO public.admin_audit_log (action, target_type, target_id, actor_id, reason, metadata)
  VALUES ('create_test_store', 'store', v_store_id, p_granted_by, 'Store de teste criada por admin',
    jsonb_build_object('user_id', p_user_id, 'name', p_name));

  SELECT jsonb_agg(row_to_json(s)) INTO v_store_data
  FROM (SELECT * FROM public.stores WHERE id = v_store_id) s;

  RETURN jsonb_build_object('success', true, 'store', v_store_data);
END;
$$;

-- =============================================================================
-- 7. RPC admin_exception_store_verification
-- =============================================================================
CREATE OR REPLACE FUNCTION public.admin_exception_store_verification(
  p_store_id UUID,
  p_admin_id UUID,
  p_reason TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_root_hash TEXT;
  v_entitlement_id UUID;
  v_grant_tx_id UUID;
  v_store_data JSONB;
BEGIN
  SELECT cnpj_root_hash INTO v_root_hash FROM public.stores WHERE id = p_store_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'store_not_found' USING HINT = 'Loja não encontrada';
  END IF;

  IF v_root_hash IS NULL OR v_root_hash = '' THEN
    v_root_hash := 'admin_exception_no_cnpj';
  END IF;

  UPDATE public.stores SET
    verification_status = 'approved',
    verification_decided_at = now()
  WHERE id = p_store_id;

  INSERT INTO public.freemium_entitlements (store_id, root_hash, benefit_type, reason, granted_by)
  VALUES (p_store_id, v_root_hash, 'admin_exception', p_reason, p_admin_id)
  RETURNING id INTO v_entitlement_id;

  SELECT public.grant_credits(
    p_store_id, 10, p_reason,
    'admin_exception_' || v_entitlement_id,
    jsonb_build_object('source', 'admin_exception', 'entitlement_id', v_entitlement_id),
    'admin_grant'
  ) INTO v_grant_tx_id;

  UPDATE public.freemium_entitlements SET grant_transaction_id = v_grant_tx_id
  WHERE id = v_entitlement_id;

  INSERT INTO public.admin_audit_log (action, target_type, target_id, actor_id, reason, metadata)
  VALUES ('admin_exception', 'store', p_store_id, p_admin_id, p_reason,
    jsonb_build_object(
      'grant_type', 'freemium_exception',
      'entitlement_id', v_entitlement_id,
      'grant_transaction_id', v_grant_tx_id
    ));

  SELECT jsonb_agg(row_to_json(s)) INTO v_store_data
  FROM (SELECT id, verification_status, verification_decided_at FROM public.stores WHERE id = p_store_id) s;

  RETURN jsonb_build_object(
    'success', true,
    'onboardingGranted', true,
    'store', v_store_data
  );
END;
$$;

-- =============================================================================
-- 8. ALTER FUNCTION create_store_with_cnpj — verificacao-aware
-- =============================================================================

DROP FUNCTION IF EXISTS public.create_store_with_cnpj(
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
  p_city TEXT,
  p_state TEXT,
  p_brand_color TEXT,
  p_logo_url TEXT,
  p_subsegment TEXT,
  p_tone_of_voice TEXT,
  p_positioning TEXT,
  p_short_description TEXT,
  p_slogan TEXT,
  p_cnpj_validation_score JSONB,
  p_razao_social TEXT,
  p_nome_fantasia TEXT
);

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
  p_verification_reasons TEXT[] DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_store_id UUID;
  v_entitlement_id UUID;
  v_grant_tx_id UUID;
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

  INSERT INTO public.legal_acceptances (store_id, accepted_by_user_id, document_type, document_version, ip_address, user_agent, acceptance_source)
  VALUES
    (v_store_id, p_accepted_by_user_id, 'terms_of_service', p_terms_version, p_ip_address, p_user_agent, 'onboarding'),
    (v_store_id, p_accepted_by_user_id, 'acceptable_use', p_acceptable_use_version, p_ip_address, p_user_agent, 'onboarding');

  -- Grant condicional: apenas se verification_status = 'approved'
  IF p_verification_status = 'approved' THEN
    v_entitlement_id := public.try_grant_onboarding_entitlement(v_store_id, p_cnpj_root_hash);

    IF v_entitlement_id IS NOT NULL THEN
      SELECT public.grant_credits(
        v_store_id, 10, 'onboarding',
        'onboarding_' || v_store_id,
        jsonb_build_object('source', 'freemium_cnpj'),
        'bonus_onboarding'
      ) INTO v_grant_tx_id;

      UPDATE public.freemium_entitlements SET grant_transaction_id = v_grant_tx_id
      WHERE id = v_entitlement_id;
    END IF;
  END IF;

  SELECT jsonb_agg(row_to_json(s)) INTO v_store_data
  FROM (SELECT * FROM public.stores WHERE id = v_store_id) s;

  RETURN jsonb_build_object(
    'store', v_store_data,
    'onboardingGranted', v_entitlement_id IS NOT NULL,
    'verificationStatus', p_verification_status
  );
END;
$$;

-- =============================================================================
-- 9. ALTER FUNCTION admin_get_users_summary — incluir verification_status
-- =============================================================================

DROP FUNCTION IF EXISTS public.admin_get_users_summary(
  p_search TEXT,
  p_page INTEGER,
  p_page_size INTEGER
);

CREATE OR REPLACE FUNCTION public.admin_get_users_summary(
  p_search TEXT DEFAULT NULL,
  p_page INTEGER DEFAULT 1,
  p_page_size INTEGER DEFAULT 20,
  p_verification_status TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_offset INTEGER;
  v_data JSONB;
  v_total BIGINT;
BEGIN
  v_offset := (p_page - 1) * p_page_size;

  SELECT COUNT(*) INTO v_total
  FROM auth.users au
  LEFT JOIN public.stores s ON s.user_id = au.id
  WHERE (p_search IS NULL
    OR au.email ILIKE '%' || p_search || '%'
    OR s.name ILIKE '%' || p_search || '%'
    OR s.segment ILIKE '%' || p_search || '%')
  AND (p_verification_status IS NULL
    OR s.verification_status = p_verification_status);

  SELECT COALESCE(jsonb_agg(user_data ORDER BY user_data->>'createdAt' DESC), '[]'::jsonb) INTO v_data
  FROM (
    SELECT jsonb_build_object(
      'userId', u.id,
      'email', u.email,
      'storeId', st.id,
      'storeName', st.name,
      'segment', st.segment,
      'balance', COALESCE(cb.balance, 0),
      'bonusBalance', COALESCE(cb.bonus_balance, 0),
      'purchasedBalance', COALESCE(cb.purchased_balance, 0),
      'totalCampaigns', COALESCE(c.cnt, 0),
      'errorCampaigns', COALESCE(ec.cnt, 0),
      'lastCampaignAt', cl.last_at,
      'createdAt', u.created_at,
      'verificationStatus', st.verification_status,
      'isTestStore', st.is_test_store
    ) AS user_data
    FROM auth.users u
    LEFT JOIN public.stores st ON st.user_id = u.id
    LEFT JOIN public.credit_balances cb ON cb.store_id = st.id
    LEFT JOIN (SELECT store_id, COUNT(*) AS cnt FROM public.campaigns GROUP BY store_id) c ON c.store_id = st.id
    LEFT JOIN (SELECT store_id, COUNT(*) AS cnt FROM public.campaigns WHERE status = 'error' GROUP BY store_id) ec ON ec.store_id = st.id
    LEFT JOIN (SELECT store_id, MAX(created_at) AS last_at FROM public.campaigns GROUP BY store_id) cl ON cl.store_id = st.id
    WHERE (p_search IS NULL
      OR u.email ILIKE '%' || p_search || '%'
      OR st.name ILIKE '%' || p_search || '%'
      OR st.segment ILIKE '%' || p_search || '%')
    AND (p_verification_status IS NULL
      OR st.verification_status = p_verification_status)
    ORDER BY u.created_at DESC
    LIMIT p_page_size
    OFFSET v_offset
  ) sub;

  RETURN jsonb_build_object('data', v_data, 'total', v_total);
END;
$$;

-- =============================================================================
-- REVERT
-- =============================================================================
-- DROP INDEX IF EXISTS public.idx_stores_verification_status;
-- DROP INDEX IF EXISTS public.idx_stores_is_test_store;
-- DROP INDEX IF EXISTS public.idx_cnpj_lookup_cache_expires;
-- ALTER TABLE public.stores DROP COLUMN IF EXISTS is_test_store;
-- ALTER TABLE public.stores DROP COLUMN IF EXISTS verification_reasons;
-- ALTER TABLE public.stores DROP COLUMN IF EXISTS verification_decided_at;
-- ALTER TABLE public.stores DROP COLUMN IF EXISTS verification_requested_at;
-- ALTER TABLE public.stores DROP COLUMN IF EXISTS cnpj_lookup_hash;
-- ALTER TABLE public.stores DROP COLUMN IF EXISTS cnpj_official_data;
-- ALTER TABLE public.stores DROP COLUMN IF EXISTS verification_data;
-- ALTER TABLE public.stores DROP COLUMN IF EXISTS verification_status;
-- DROP TABLE IF EXISTS public.cnpj_lookup_cache CASCADE;
-- DROP FUNCTION IF EXISTS public.update_store_verification CASCADE;
-- DROP FUNCTION IF EXISTS public.admin_approve_store_verification CASCADE;
-- DROP FUNCTION IF EXISTS public.admin_reject_store_verification CASCADE;
-- DROP FUNCTION IF EXISTS public.admin_create_test_store CASCADE;
-- DROP FUNCTION IF EXISTS public.admin_exception_store_verification CASCADE;

-- Restaurar create_store_with_cnpj anterior (sem parâmetros de verificação):
-- CREATE OR REPLACE FUNCTION public.create_store_with_cnpj(...)
-- (ver migration 20260727000001_freemium_anti_abuso_cnpj.sql para signature anterior)

-- Restaurar admin_get_users_summary anterior (sem p_verification_status):
-- CREATE OR REPLACE FUNCTION public.admin_get_users_summary(...)
-- (ver migration 20260727000001_freemium_anti_abuso_cnpj.sql para signature anterior)
