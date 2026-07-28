-- Freemium Anti-Abuso CNPJ (F32)
-- Torna CNPJ obrigatório na criação da loja, troca unidade econômica do freemium
-- de store_id para raiz de CNPJ (8 primeiros dígitos).
--
-- Blocos:
--   1. Colunas CNPJ em stores + índices
--   2. Tabela freemium_entitlements + índices + RLS
--   3. RPCs auxiliares (try_grant_onboarding_entitlement, try_grant_monthly_entitlement, admin_grant_freemium_exception)
--   4. RPC create_store_with_cnpj (substitui create_store_with_legal_acceptance)
--   5. RPC update_store_cnpj
--   6. ALTER FUNCTION grant_monthly_credits (entitlement-aware)
--   7. INSERT legal_document_versions (v1.2, v1.1)

-- =============================================================================
-- 1. Colunas CNPJ em stores + índices
-- =============================================================================
ALTER TABLE public.stores ADD COLUMN cnpj_normalized TEXT;
ALTER TABLE public.stores ADD COLUMN cnpj_root_hash TEXT NOT NULL DEFAULT '';
ALTER TABLE public.stores ADD COLUMN razao_social TEXT;
ALTER TABLE public.stores ADD COLUMN nome_fantasia TEXT;
ALTER TABLE public.stores ADD COLUMN cnpj_validation_score JSONB;

COMMENT ON COLUMN public.stores.cnpj_normalized IS 'CNPJ normalizado (14 dígitos). UNIQUE via índice parcial.';
COMMENT ON COLUMN public.stores.cnpj_root_hash IS 'HMAC-SHA256 dos 8 primeiros dígitos (raiz) com pepper server-side. O hash é calculado na rota (Next.js), não no banco.';
COMMENT ON COLUMN public.stores.razao_social IS 'Razão social da loja (opcional, para validação cadastral futura).';
COMMENT ON COLUMN public.stores.nome_fantasia IS 'Nome fantasia da loja (opcional).';
COMMENT ON COLUMN public.stores.cnpj_validation_score IS 'Score de similaridade textual entre nome informado e razão social/nome fantasia. JSONB. Não bloqueante.';

CREATE UNIQUE INDEX idx_stores_cnpj_normalized ON public.stores (cnpj_normalized) WHERE cnpj_normalized IS NOT NULL;
CREATE INDEX idx_stores_cnpj_root_hash ON public.stores (cnpj_root_hash);

-- =============================================================================
-- 2. Tabela freemium_entitlements + índices + RLS
-- =============================================================================
CREATE TABLE public.freemium_entitlements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID REFERENCES public.stores(id) ON DELETE SET NULL,
  root_hash TEXT NOT NULL,
  benefit_type TEXT NOT NULL CHECK (benefit_type IN ('onboarding', 'monthly', 'admin_exception')),
  cycle TEXT,
  grant_transaction_id UUID REFERENCES public.credit_transactions(id) ON DELETE SET NULL,
  granted_by UUID REFERENCES auth.users(id),
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.freemium_entitlements IS 'Controle de benefícios freemium por raiz de CNPJ. store_id usa ON DELETE SET NULL para manter histórico antifraude.';
COMMENT ON COLUMN public.freemium_entitlements.store_id IS 'ON DELETE SET NULL — se loja for deletada, o entitlement permanece como registro histórico.';
COMMENT ON COLUMN public.freemium_entitlements.root_hash IS 'HMAC-SHA256 da raiz do CNPJ (8 primeiros dígitos).';
COMMENT ON COLUMN public.freemium_entitlements.benefit_type IS 'Tipo do benefício: onboarding (10 créditos), monthly (5 créditos/mês), admin_exception (exceção manual).';
COMMENT ON COLUMN public.freemium_entitlements.cycle IS 'Ciclo mensal no formato YYYY-MM. NULL para onboarding e admin_exception.';
COMMENT ON COLUMN public.freemium_entitlements.grant_transaction_id IS 'ID da transação de créditos associada. NULL se não houve concessão (legacy).';

CREATE UNIQUE INDEX idx_freemium_entitlements_key
  ON public.freemium_entitlements (root_hash, benefit_type, COALESCE(cycle, '_nostring_'));
CREATE INDEX idx_freemium_entitlements_root ON public.freemium_entitlements (root_hash);
CREATE INDEX idx_freemium_entitlements_store ON public.freemium_entitlements (store_id);

ALTER TABLE public.freemium_entitlements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role manages freemium entitlements"
  ON public.freemium_entitlements
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Users can view own store entitlements"
  ON public.freemium_entitlements
  FOR SELECT
  TO authenticated
  USING (
    store_id IN (SELECT id FROM public.stores WHERE user_id = auth.uid())
  );

CREATE POLICY "Admins can view all entitlements"
  ON public.freemium_entitlements
  FOR SELECT
  TO authenticated
  USING (auth.jwt() ->> 'role' = 'admin');

-- =============================================================================
-- 3. RPCs auxiliares (INSERT ... ON CONFLICT via SQL puro)
-- =============================================================================
-- NOTA: O root_hash é calculado na rota server-side (Next.js) com
-- process.env.CNPJ_PEPPER + hashCnpjRoot(). As RPCs recebem p_root_hash
-- já calculado — NÃO calculam hash internamente.

CREATE OR REPLACE FUNCTION public.try_grant_onboarding_entitlement(
  p_store_id UUID,
  p_root_hash TEXT,
  p_grant_transaction_id UUID DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_id UUID;
BEGIN
  INSERT INTO public.freemium_entitlements (store_id, root_hash, benefit_type, grant_transaction_id)
  VALUES (p_store_id, p_root_hash, 'onboarding', p_grant_transaction_id)
  ON CONFLICT (root_hash, benefit_type, (COALESCE(cycle, '_nostring_')))
  DO NOTHING
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.try_grant_monthly_entitlement(
  p_store_id UUID,
  p_root_hash TEXT,
  p_cycle TEXT,
  p_grant_transaction_id UUID DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_id UUID;
BEGIN
  INSERT INTO public.freemium_entitlements (store_id, root_hash, benefit_type, cycle, grant_transaction_id)
  VALUES (p_store_id, p_root_hash, 'monthly', p_cycle, p_grant_transaction_id)
  ON CONFLICT (root_hash, benefit_type, (COALESCE(cycle, '_nostring_')))
  DO NOTHING
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_grant_freemium_exception(
  p_store_id UUID,
  p_reason TEXT,
  p_granted_by UUID
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
BEGIN
  SELECT cnpj_root_hash INTO v_root_hash FROM public.stores WHERE id = p_store_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'store_not_found' USING HINT = 'Loja não encontrada';
  END IF;

  IF v_root_hash IS NULL OR v_root_hash = '' THEN
    v_root_hash := 'admin_exception_no_cnpj';
  END IF;

  INSERT INTO public.freemium_entitlements (store_id, root_hash, benefit_type, reason, granted_by)
  VALUES (p_store_id, v_root_hash, 'admin_exception', p_reason, p_granted_by)
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
  VALUES ('credit_grant', 'store', p_store_id, p_granted_by, p_reason,
    jsonb_build_object(
      'grant_type', 'freemium_exception',
      'entitlement_id', v_entitlement_id,
      'grant_transaction_id', v_grant_tx_id
    ));

  RETURN jsonb_build_object(
    'success', true,
    'entitlement_id', v_entitlement_id,
    'grant_transaction_id', v_grant_tx_id
  );
END;
$$;

-- =============================================================================
-- 4. RPC create_store_with_cnpj (substitui create_store_with_legal_acceptance)
-- =============================================================================

-- Drop old function first to avoid overload ambiguity
DROP FUNCTION IF EXISTS public.create_store_with_legal_acceptance(
  p_user_id UUID, p_name TEXT, p_segment TEXT, p_city TEXT,
  p_state TEXT, p_accepted_by_user_id UUID, p_terms_version TEXT,
  p_acceptable_use_version TEXT, p_ip_address TEXT, p_user_agent TEXT,
  p_brand_color TEXT, p_logo_url TEXT, p_subsegment TEXT,
  p_tone_of_voice TEXT, p_positioning TEXT, p_short_description TEXT,
  p_slogan TEXT, p_initial_grant_amount INTEGER
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
  p_cnpj_validation_score JSONB DEFAULT NULL
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
    cnpj_normalized, cnpj_root_hash, cnpj_validation_score
  ) VALUES (
    p_name, p_segment, p_user_id, p_city, p_state, p_brand_color, p_logo_url,
    p_subsegment, p_tone_of_voice, p_positioning, p_short_description, p_slogan,
    p_cnpj_normalized, p_cnpj_root_hash, p_cnpj_validation_score
  )
  RETURNING id INTO v_store_id;

  INSERT INTO public.legal_acceptances (store_id, accepted_by_user_id, document_type, document_version, ip_address, user_agent, acceptance_source)
  VALUES
    (v_store_id, p_accepted_by_user_id, 'terms_of_service', p_terms_version, p_ip_address, p_user_agent, 'onboarding'),
    (v_store_id, p_accepted_by_user_id, 'acceptable_use', p_acceptable_use_version, p_ip_address, p_user_agent, 'onboarding');

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

  SELECT jsonb_agg(row_to_json(s)) INTO v_store_data
  FROM (SELECT * FROM public.stores WHERE id = v_store_id) s;

  RETURN jsonb_build_object(
    'store', v_store_data,
    'onboardingGranted', v_entitlement_id IS NOT NULL
  );
END;
$$;

-- =============================================================================
-- 5. RPC update_store_cnpj (lojas legacy)
-- =============================================================================
CREATE OR REPLACE FUNCTION public.update_store_cnpj(
  p_store_id UUID,
  p_cnpj_normalized TEXT,
  p_cnpj_root_hash TEXT,
  p_razao_social TEXT DEFAULT NULL,
  p_nome_fantasia TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_store_data JSONB;
  v_existing_hash TEXT;
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
    nome_fantasia = p_nome_fantasia
  WHERE id = p_store_id;

  INSERT INTO public.freemium_entitlements (store_id, root_hash, benefit_type, reason)
  VALUES (p_store_id, p_cnpj_root_hash, 'onboarding', 'legacy_pre_f32_onboarding_consumed')
  ON CONFLICT (root_hash, benefit_type, (COALESCE(cycle, '_nostring_')))
  DO NOTHING;

  SELECT jsonb_agg(row_to_json(s)) INTO v_store_data
  FROM (SELECT * FROM public.stores WHERE id = p_store_id) s;

  RETURN jsonb_build_object('store', v_store_data);
END;
$$;

-- =============================================================================
-- 6. ALTER FUNCTION grant_monthly_credits — entitlement-aware
-- =============================================================================
-- NOTA: Esta alteração assume que grant_monthly_credits existe (F29.3).
-- O arquivo original: supabase/migrations/20260722000002_creditos_mensais_automaticos.sql
-- A função original itera sobre stores elegíveis e concede créditos mensais.
-- A modificação adiciona verificação de entitlement por raiz.

CREATE OR REPLACE FUNCTION public.grant_monthly_credits(
  p_amount INTEGER,
  p_bonus_cap INTEGER,
  p_min_store_age_days INTEGER
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_store RECORD;
  v_granted INTEGER := 0;
  v_skipped_no_cnpj INTEGER := 0;
  v_skipped_already_granted INTEGER := 0;
  v_insufficient_bonus_cap INTEGER := 0;
  v_entitlement_id UUID;
  v_grant_tx_id UUID;
  v_cycle TEXT;
  v_new_balance INTEGER;
  v_results JSONB[];
BEGIN
  v_cycle := TO_CHAR(NOW(), 'YYYY-MM');

  FOR v_store IN
    SELECT s.id, s.user_id, s.created_at, cb.bonus_balance, s.cnpj_root_hash
    FROM public.stores s
    JOIN public.credit_balances cb ON cb.store_id = s.id
    WHERE (s.cnpj_root_hash IS NOT NULL AND s.cnpj_root_hash != '')
      AND cb.bonus_balance < p_bonus_cap
      AND s.created_at <= (NOW() - (p_min_store_age_days || ' days')::INTERVAL)
      AND EXISTS (
        SELECT 1 FROM public.credit_transactions ct
        WHERE ct.store_id = s.id AND ct.type IN ('bonus_onboarding', 'bonus_monthly')
        HAVING COUNT(*) > 0
      )
    FOR UPDATE OF cb SKIP LOCKED
  LOOP
    v_entitlement_id := public.try_grant_monthly_entitlement(v_store.id, v_store.cnpj_root_hash, v_cycle);

    IF v_entitlement_id IS NULL THEN
      v_skipped_already_granted := v_skipped_already_granted + 1;
      CONTINUE;
    END IF;

    v_grant_tx_id := public.grant_credits(
      v_store.id, p_amount, 'credito_mensal',
      'mensal_' || v_cycle || '_' || v_store.id,
      jsonb_build_object('cycle', v_cycle, 'source', 'monthly_cron'),
      'bonus_monthly'
    );

    UPDATE public.freemium_entitlements SET grant_transaction_id = v_grant_tx_id
    WHERE id = v_entitlement_id;

    v_granted := v_granted + 1;
  END LOOP;

  SELECT COALESCE(bonus_balance, 0) INTO v_new_balance
  FROM public.credit_balances WHERE store_id = v_store.id;

  RETURN jsonb_build_object(
    'granted', v_granted,
    'skipped_no_cnpj', v_skipped_no_cnpj,
    'skipped_already_granted', v_skipped_already_granted,
    'insufficient_bonus_cap', v_insufficient_bonus_cap
  );
END;
$$;

-- =============================================================================
-- 7. INSERT legal_document_versions (v1.2, v1.1)
-- =============================================================================
INSERT INTO public.legal_document_versions (document_type, version, published_at, effective_at, summary)
VALUES
  ('terms_of_service', 'v1.2', now(), now(), 'CNPJ obrigatório, freemium por raiz, sanções, compra de créditos'),
  ('privacy_policy', 'v1.1', now(), now(), 'Finalidades do tratamento do CNPJ, base legal LGPD')
ON CONFLICT (document_type, version) DO NOTHING;

-- =============================================================================
-- 8. ALTER FUNCTION admin_get_users_summary - incluir bonus_balance
-- =============================================================================

CREATE OR REPLACE FUNCTION public.admin_get_users_summary(
  p_search TEXT DEFAULT NULL,
  p_page INTEGER DEFAULT 1,
  p_page_size INTEGER DEFAULT 20
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
    OR s.segment ILIKE '%' || p_search || '%');

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
      'createdAt', u.created_at
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
    ORDER BY u.created_at DESC
    LIMIT p_page_size
    OFFSET v_offset
  ) sub;

  RETURN jsonb_build_object('data', v_data, 'total', v_total);
END;
$$;

-- DROP INDEX IF EXISTS public.idx_stores_cnpj_normalized;
-- DROP INDEX IF EXISTS public.idx_stores_cnpj_root_hash;
-- ALTER TABLE public.stores DROP COLUMN IF EXISTS cnpj_validation_score;
-- ALTER TABLE public.stores DROP COLUMN IF EXISTS nome_fantasia;
-- ALTER TABLE public.stores DROP COLUMN IF EXISTS razao_social;
-- ALTER TABLE public.stores DROP COLUMN IF EXISTS cnpj_root_hash;
-- ALTER TABLE public.stores DROP COLUMN IF EXISTS cnpj_normalized;
-- DROP TABLE IF EXISTS public.freemium_entitlements CASCADE;
-- DROP FUNCTION IF EXISTS public.try_grant_onboarding_entitlement CASCADE;
-- DROP FUNCTION IF EXISTS public.try_grant_monthly_entitlement CASCADE;
-- DROP FUNCTION IF EXISTS public.admin_grant_freemium_exception CASCADE;
-- DROP FUNCTION IF EXISTS public.create_store_with_cnpj CASCADE;

-- Restaurar função anterior:
-- CREATE OR REPLACE FUNCTION public.create_store_with_legal_acceptance(...) RETURNS JSONB ...
-- (conteúdo completo no migration original 20260723000003_create_legal_acceptances.sql)
