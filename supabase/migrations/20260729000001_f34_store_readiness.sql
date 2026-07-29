-- Store Readiness (F34)
-- Cria tabela store_billing_info e RPC check_store_readiness
--
-- Blocos:
--   1. CREATE TABLE store_billing_info + índices
--   2. RLS policies
--   3. Trigger updated_at
--   4. RPC check_store_readiness
--   5. REVERT

-- =============================================================================
-- 1. Tabela store_billing_info + índices
-- =============================================================================
CREATE TABLE public.store_billing_info (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID UNIQUE NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  billing_email TEXT,
  billing_phone TEXT,
  billing_address_country TEXT DEFAULT 'BR',
  billing_address_street TEXT,
  billing_address_number TEXT,
  billing_address_complement TEXT,
  billing_address_neighborhood TEXT,
  billing_address_city TEXT,
  billing_address_state TEXT,
  billing_address_zipcode TEXT,
  billing_city_ibge_code TEXT,
  billing_data_source TEXT CHECK (billing_data_source IN ('brasilapi', 'cnpja', 'manual')),
  billing_data_last_prefilled_from TEXT CHECK (billing_data_last_prefilled_from IN ('brasilapi', 'cnpja')),
  billing_data_confirmed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.store_billing_info IS 'Dados de faturamento da loja (1:1 com stores). Não bloqueia geração de campanhas.';
COMMENT ON COLUMN public.store_billing_info.billing_data_source IS 'Origem dos dados: brasilapi, cnpja (pré-preenchimento automático) ou manual (edição do usuário).';
COMMENT ON COLUMN public.store_billing_info.billing_data_last_prefilled_from IS 'Provider usado no último pré-preenchimento automático.';
COMMENT ON COLUMN public.store_billing_info.billing_data_confirmed_at IS 'Timestamp da confirmação explícita pelo usuário. NULL se não confirmado.';

CREATE UNIQUE INDEX idx_store_billing_info_store_id ON public.store_billing_info(store_id);

-- =============================================================================
-- 2. RLS policies
-- =============================================================================
ALTER TABLE public.store_billing_info ENABLE ROW LEVEL SECURITY;

CREATE POLICY "owner_select"
  ON public.store_billing_info
  FOR SELECT
  TO authenticated
  USING (
    store_id IN (SELECT id FROM public.stores WHERE user_id = auth.uid())
  );

CREATE POLICY "service_role_manage"
  ON public.store_billing_info
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- =============================================================================
-- 3. Trigger updated_at
-- =============================================================================
CREATE OR REPLACE FUNCTION public.update_store_billing_info_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_store_billing_info_updated_at
  BEFORE UPDATE ON public.store_billing_info
  FOR EACH ROW
  EXECUTE FUNCTION public.update_store_billing_info_updated_at();

-- =============================================================================
-- 4. RPC check_store_readiness
-- =============================================================================
CREATE OR REPLACE FUNCTION public.check_store_readiness(p_store_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SET search_path = ''
AS $$
DECLARE
  v_cadastro_ok BOOLEAN;
  v_brand_ok BOOLEAN;
  v_missing JSONB;
BEGIN
  -- Verifica cadastro fiscal mínimo
  SELECT
    (s.cnpj_normalized IS NOT NULL AND s.cnpj_normalized != ''
     AND s.razao_social IS NOT NULL AND s.razao_social != ''
     AND s.nome_fantasia IS NOT NULL AND s.nome_fantasia != '')
  INTO v_cadastro_ok
  FROM public.stores s
  WHERE s.id = p_store_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'ready', false,
      'missing', jsonb_build_array(
        jsonb_build_object('item', 'cadastro_fiscal', 'reason', 'Loja não encontrada')
      )
    );
  END IF;

  -- Verifica brand profile synced
  SELECT EXISTS (
    SELECT 1 FROM public.store_brand_profiles bp
    WHERE bp.store_id = p_store_id AND bp.status = 'synced'
  ) INTO v_brand_ok;

  -- Monta array de pendências na ordem correta
  v_missing := '[]'::jsonb;

  IF NOT v_cadastro_ok THEN
    v_missing := v_missing || jsonb_build_object(
      'item', 'cadastro_fiscal',
      'reason', 'CNPJ, razão social e nome fantasia são obrigatórios'
    );
  END IF;

  IF NOT v_brand_ok THEN
    v_missing := v_missing || jsonb_build_object(
      'item', 'brand_profile',
      'reason', 'Direção visual da loja não configurada'
    );
  END IF;

  RETURN jsonb_build_object(
    'ready', (v_cadastro_ok AND v_brand_ok),
    'missing', v_missing
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.check_store_readiness FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.check_store_readiness TO authenticated, service_role;

-- =============================================================================
-- 5. REVERT
-- =============================================================================
-- DROP FUNCTION IF EXISTS public.check_store_readiness;
-- DROP TRIGGER IF EXISTS trg_store_billing_info_updated_at ON public.store_billing_info;
-- DROP FUNCTION IF EXISTS public.update_store_billing_info_updated_at;
-- DROP TABLE IF EXISTS public.store_billing_info;
