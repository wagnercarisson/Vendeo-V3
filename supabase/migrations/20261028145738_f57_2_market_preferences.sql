-- =============================================================================
-- F57.2 — Persistência de preferências multimercado (fatia 01)
-- =============================================================================
-- Escopo: tabelas aditivas `public.user_preferences` e
-- `public.store_market_settings`, triggers de updated_at, RLS somente leitura,
-- grants mínimos e três RPCs de base:
--   - ensure_store_market_settings
--   - write_store_market_settings
--   - write_user_locale_preference
--
-- NÃO recria RPCs de onboarding nesta fatia (plano 04).
-- Nenhum ALTER em tabela existente, nenhum backfill, nenhum INSERT ... SELECT.
--
-- `store_market_settings.country_code` é o país CADASTRAL/FISCAL da loja.
-- Ele NÃO é derivado de `store_billing_info.billing_address_country`, endereço,
-- cidade, IP, navegador ou idioma do aplicativo. A fonte de verdade é a
-- confirmação fiscal ou a inicialização assumidamente padrão.
--
-- Paraguai é aceito pelos CHECKs do modelo, mas permanece INERTE: nenhum caminho
-- desta migration cria loja PY nem habilita operação no país.
--
-- Migration autorada, NÃO aplicada por este plano. Aplicação exige checkpoint.
-- =============================================================================

-- =============================================================================
-- 1. user_preferences (1:1 usuário; idioma do aplicativo)
-- =============================================================================

CREATE TABLE public.user_preferences (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  ui_locale TEXT NULL,
  ui_locale_source TEXT NOT NULL DEFAULT 'legacy_br',
  version BIGINT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT chk_user_preferences_ui_locale
    CHECK (ui_locale IS NULL OR ui_locale IN ('pt-BR', 'es-PY')),
  CONSTRAINT chk_user_preferences_source
    CHECK (ui_locale_source IN ('explicit', 'legacy_br')),
  CONSTRAINT chk_user_preferences_version
    CHECK (version >= 0),
  CONSTRAINT chk_user_preferences_coherence
    CHECK (
      (ui_locale IS NULL AND ui_locale_source = 'legacy_br')
      OR (ui_locale IS NOT NULL AND ui_locale_source = 'explicit')
    )
);

COMMENT ON TABLE public.user_preferences IS
  'F57.2: idioma do aplicativo por usuário. Independente do país/mercado da loja. Ausência de linha = legado pt-BR.';
COMMENT ON COLUMN public.user_preferences.ui_locale_source IS
  'explicit = escolha do usuário; legacy_br = ausência/limpeza resolvida como pt-BR.';

-- =============================================================================
-- 2. store_market_settings (1:1 loja; configurações de mercado)
-- =============================================================================

CREATE TABLE public.store_market_settings (
  store_id UUID PRIMARY KEY REFERENCES public.stores(id) ON DELETE CASCADE,
  country_code TEXT NOT NULL DEFAULT 'BR',
  country_source TEXT NOT NULL DEFAULT 'assumed_default',
  default_campaign_market TEXT NOT NULL,
  default_campaign_market_source TEXT NOT NULL,
  default_content_locale TEXT NOT NULL,
  default_content_locale_source TEXT NOT NULL,
  default_currency TEXT NOT NULL,
  default_currency_source TEXT NOT NULL,
  time_zone TEXT NOT NULL,
  time_zone_source TEXT NOT NULL,
  context_version INTEGER NOT NULL DEFAULT 1,
  settings_version BIGINT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT chk_store_market_settings_country
    CHECK (country_code IN ('BR', 'PY')),
  CONSTRAINT chk_store_market_settings_country_source
    CHECK (country_source IN ('assumed_default', 'fiscal_confirmation', 'legacy_br')),
  CONSTRAINT chk_store_market_settings_market
    CHECK (default_campaign_market IN ('BR', 'PY')),
  CONSTRAINT chk_store_market_settings_market_source
    CHECK (default_campaign_market_source IN ('explicit', 'default', 'legacy_br')),
  CONSTRAINT chk_store_market_settings_locale
    CHECK (default_content_locale IN ('pt-BR', 'es-PY')),
  CONSTRAINT chk_store_market_settings_locale_source
    CHECK (default_content_locale_source IN ('explicit', 'default', 'legacy_br')),
  CONSTRAINT chk_store_market_settings_currency
    CHECK (default_currency IN ('BRL', 'PYG')),
  CONSTRAINT chk_store_market_settings_currency_source
    CHECK (default_currency_source IN ('explicit', 'default', 'legacy_br')),
  CONSTRAINT chk_store_market_settings_time_zone
    CHECK (time_zone IN ('America/Sao_Paulo', 'America/Asuncion')),
  CONSTRAINT chk_store_market_settings_time_zone_source
    CHECK (time_zone_source IN ('explicit', 'default', 'legacy_br')),
  CONSTRAINT chk_store_market_settings_context_version
    CHECK (context_version = 1),
  CONSTRAINT chk_store_market_settings_version
    CHECK (settings_version >= 0)
);

COMMENT ON TABLE public.store_market_settings IS
  'F57.2: configurações de mercado por loja, com proveniência por campo, context_version e settings_version (CAS).';
COMMENT ON COLUMN public.store_market_settings.country_code IS
  'País CADASTRAL/FISCAL da loja. NÃO derivado de billing/endereço/cidade/IP/navegador/idioma do app. Fonte: confirmação fiscal ou inicialização assumida.';
COMMENT ON COLUMN public.store_market_settings.country_source IS
  'assumed_default = país assumido na criação; fiscal_confirmation = confirmado pelo fluxo fiscal; legacy_br = loja legada.';
COMMENT ON COLUMN public.store_market_settings.settings_version IS
  'Versão de concorrência (CAS). 0 = ainda não materializado; primeira escrita grava 1.';
COMMENT ON COLUMN public.store_market_settings.context_version IS
  'Versão do contrato de contexto (1 nesta fase).';

-- =============================================================================
-- 3. Triggers de updated_at (funções dedicadas, search_path seguro)
-- =============================================================================

CREATE OR REPLACE FUNCTION public.update_user_preferences_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.update_store_market_settings_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.update_user_preferences_updated_at() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.update_store_market_settings_updated_at() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_user_preferences_updated_at ON public.user_preferences;
CREATE TRIGGER trg_user_preferences_updated_at
  BEFORE UPDATE ON public.user_preferences
  FOR EACH ROW
  EXECUTE FUNCTION public.update_user_preferences_updated_at();

DROP TRIGGER IF EXISTS trg_store_market_settings_updated_at ON public.store_market_settings;
CREATE TRIGGER trg_store_market_settings_updated_at
  BEFORE UPDATE ON public.store_market_settings
  FOR EACH ROW
  EXECUTE FUNCTION public.update_store_market_settings_updated_at();

-- =============================================================================
-- 4. RLS: somente leitura para o dono; service_role gerencia
-- =============================================================================

ALTER TABLE public.user_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.store_market_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS user_preferences_owner_select ON public.user_preferences;
CREATE POLICY user_preferences_owner_select
  ON public.user_preferences
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS user_preferences_service_role_all ON public.user_preferences;
CREATE POLICY user_preferences_service_role_all
  ON public.user_preferences
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS store_market_settings_owner_select ON public.store_market_settings;
CREATE POLICY store_market_settings_owner_select
  ON public.store_market_settings
  FOR SELECT
  TO authenticated
  USING (
    store_id IN (SELECT id FROM public.stores WHERE user_id = auth.uid())
  );

DROP POLICY IF EXISTS store_market_settings_service_role_all ON public.store_market_settings;
CREATE POLICY store_market_settings_service_role_all
  ON public.store_market_settings
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- RLS não concede privilégio: grants explícitos de tabela.
REVOKE ALL ON TABLE public.user_preferences, public.store_market_settings
  FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.user_preferences, public.store_market_settings TO authenticated;
GRANT ALL ON TABLE public.user_preferences, public.store_market_settings TO service_role;

-- =============================================================================
-- 5. ensure_store_market_settings (idempotente; define país/proveniência)
-- =============================================================================

CREATE OR REPLACE FUNCTION public.ensure_store_market_settings(
  p_store_id UUID,
  p_country_code TEXT,
  p_country_source TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_locale TEXT;
  v_currency TEXT;
  v_time_zone TEXT;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.stores WHERE id = p_store_id) THEN
    RAISE EXCEPTION 'store_not_found' USING HINT = 'Loja não encontrada';
  END IF;

  IF p_country_code IS NULL OR p_country_code NOT IN ('BR', 'PY') THEN
    RAISE EXCEPTION 'invalid_country' USING HINT = 'País deve ser BR ou PY';
  END IF;

  IF p_country_source IS NULL
     OR p_country_source NOT IN ('assumed_default', 'fiscal_confirmation', 'legacy_br')
  THEN
    RAISE EXCEPTION 'invalid_country_source'
      USING HINT = 'Fonte de país inválida';
  END IF;

  v_locale := CASE WHEN p_country_code = 'PY' THEN 'es-PY' ELSE 'pt-BR' END;
  v_currency := CASE WHEN p_country_code = 'PY' THEN 'PYG' ELSE 'BRL' END;
  v_time_zone := CASE
    WHEN p_country_code = 'PY' THEN 'America/Asuncion'
    ELSE 'America/Sao_Paulo'
  END;

  INSERT INTO public.store_market_settings (
    store_id,
    country_code,
    country_source,
    default_campaign_market,
    default_campaign_market_source,
    default_content_locale,
    default_content_locale_source,
    default_currency,
    default_currency_source,
    time_zone,
    time_zone_source,
    context_version,
    settings_version
  ) VALUES (
    p_store_id,
    p_country_code,
    p_country_source,
    p_country_code,
    'default',
    v_locale,
    'default',
    v_currency,
    'default',
    v_time_zone,
    'default',
    1,
    1
  )
  ON CONFLICT (store_id) DO NOTHING;
END;
$$;

REVOKE ALL ON FUNCTION public.ensure_store_market_settings(UUID, TEXT, TEXT)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ensure_store_market_settings(UUID, TEXT, TEXT)
  TO service_role;

-- =============================================================================
-- 6. write_store_market_settings (CAS, linha ausente, país imutável)
-- =============================================================================

CREATE OR REPLACE FUNCTION public.write_store_market_settings(
  p_store_id UUID,
  p_default_campaign_market TEXT,
  p_default_campaign_market_source TEXT,
  p_default_content_locale TEXT,
  p_default_content_locale_source TEXT,
  p_default_currency TEXT,
  p_default_currency_source TEXT,
  p_time_zone TEXT,
  p_time_zone_source TEXT,
  p_country_code TEXT,
  p_country_source TEXT,
  p_context_version INTEGER,
  p_expected_version BIGINT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_settings public.store_market_settings%ROWTYPE;
  v_inserted INTEGER := 0;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.stores WHERE id = p_store_id) THEN
    RAISE EXCEPTION 'store_not_found' USING HINT = 'Loja não encontrada';
  END IF;

  IF p_context_version IS DISTINCT FROM 1 THEN
    RAISE EXCEPTION 'unsupported_context_version'
      USING HINT = 'context_version deve ser 1';
  END IF;

  IF p_default_campaign_market IS NULL OR p_default_campaign_market NOT IN ('BR', 'PY')
     OR p_default_content_locale IS NULL OR p_default_content_locale NOT IN ('pt-BR', 'es-PY')
     OR p_default_currency IS NULL OR p_default_currency NOT IN ('BRL', 'PYG')
     OR p_time_zone IS NULL OR p_time_zone NOT IN ('America/Sao_Paulo', 'America/Asuncion')
     OR p_country_code IS NULL OR p_country_code NOT IN ('BR', 'PY')
  THEN
    RAISE EXCEPTION 'invalid_market_settings'
      USING HINT = 'Valor de configuração de mercado inválido';
  END IF;

  IF p_default_campaign_market_source IS NULL
     OR p_default_campaign_market_source NOT IN ('explicit', 'default', 'legacy_br')
     OR p_default_content_locale_source IS NULL
     OR p_default_content_locale_source NOT IN ('explicit', 'default', 'legacy_br')
     OR p_default_currency_source IS NULL
     OR p_default_currency_source NOT IN ('explicit', 'default', 'legacy_br')
     OR p_time_zone_source IS NULL
     OR p_time_zone_source NOT IN ('explicit', 'default', 'legacy_br')
  THEN
    RAISE EXCEPTION 'invalid_field_source'
      USING HINT = 'Fonte de campo inválida';
  END IF;

  IF p_country_source IS NULL
     OR p_country_source NOT IN ('assumed_default', 'fiscal_confirmation', 'legacy_br')
  THEN
    RAISE EXCEPTION 'invalid_country_source'
      USING HINT = 'Fonte de país inválida';
  END IF;

  -- Linha ausente: a RPC genérica só pode materializar proveniência de legado.
  IF p_country_source <> 'legacy_br' THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.store_market_settings WHERE store_id = p_store_id
    ) THEN
      RAISE EXCEPTION 'country_not_mutable'
        USING HINT = 'País cadastral não é alterável por esta escrita';
    END IF;
  END IF;

  INSERT INTO public.store_market_settings (
    store_id,
    country_code,
    country_source,
    default_campaign_market,
    default_campaign_market_source,
    default_content_locale,
    default_content_locale_source,
    default_currency,
    default_currency_source,
    time_zone,
    time_zone_source,
    context_version,
    settings_version
  ) VALUES (
    p_store_id,
    p_country_code,
    p_country_source,
    p_default_campaign_market,
    p_default_campaign_market_source,
    p_default_content_locale,
    p_default_content_locale_source,
    p_default_currency,
    p_default_currency_source,
    p_time_zone,
    p_time_zone_source,
    1,
    1
  )
  ON CONFLICT (store_id) DO NOTHING;

  GET DIAGNOSTICS v_inserted = ROW_COUNT;

  IF v_inserted = 1 THEN
    IF p_expected_version IS DISTINCT FROM 0 THEN
      DELETE FROM public.store_market_settings WHERE store_id = p_store_id;
      -- Não havia linha: a versão real vigente é 0 (não a temporária 1).
      RAISE EXCEPTION 'settings_version_conflict'
        USING HINT = '0', DETAIL = '0';
    END IF;
    SELECT * INTO v_settings
      FROM public.store_market_settings
      WHERE store_id = p_store_id;
    RETURN to_jsonb(v_settings);
  END IF;

  SELECT * INTO v_settings
    FROM public.store_market_settings
    WHERE store_id = p_store_id
    FOR UPDATE;

  IF v_settings.settings_version IS DISTINCT FROM p_expected_version THEN
    RAISE EXCEPTION 'settings_version_conflict'
      USING HINT = v_settings.settings_version::text,
            DETAIL = v_settings.settings_version::text;
  END IF;

  IF v_settings.country_code IS DISTINCT FROM p_country_code THEN
    RAISE EXCEPTION 'country_not_mutable'
      USING HINT = 'País cadastral não é alterável por esta escrita';
  END IF;

  -- country_code/country_source ficam FORA do UPDATE: em linha existente a
  -- proveniência persistida é preservada (só ensure/confirmação fiscal mudam).
  UPDATE public.store_market_settings SET
    default_campaign_market = p_default_campaign_market,
    default_campaign_market_source = p_default_campaign_market_source,
    default_content_locale = p_default_content_locale,
    default_content_locale_source = p_default_content_locale_source,
    default_currency = p_default_currency,
    default_currency_source = p_default_currency_source,
    time_zone = p_time_zone,
    time_zone_source = p_time_zone_source,
    context_version = 1,
    settings_version = v_settings.settings_version + 1
  WHERE store_id = p_store_id
  RETURNING * INTO v_settings;

  RETURN to_jsonb(v_settings);
END;
$$;

REVOKE ALL ON FUNCTION public.write_store_market_settings(
  UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, INTEGER, BIGINT
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.write_store_market_settings(
  UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, INTEGER, BIGINT
) TO service_role;

-- =============================================================================
-- 7. write_user_locale_preference (CAS; fonte derivada no SQL)
-- =============================================================================

CREATE OR REPLACE FUNCTION public.write_user_locale_preference(
  p_user_id UUID,
  p_ui_locale TEXT,
  p_expected_version BIGINT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_pref public.user_preferences%ROWTYPE;
  v_inserted INTEGER := 0;
  v_source TEXT;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = p_user_id) THEN
    RAISE EXCEPTION 'user_not_found' USING HINT = 'Usuário não encontrado';
  END IF;

  IF p_ui_locale IS NOT NULL AND p_ui_locale NOT IN ('pt-BR', 'es-PY') THEN
    RAISE EXCEPTION 'invalid_locale' USING HINT = 'Locale não suportado';
  END IF;

  v_source := CASE WHEN p_ui_locale IS NULL THEN 'legacy_br' ELSE 'explicit' END;

  INSERT INTO public.user_preferences (
    user_id,
    ui_locale,
    ui_locale_source,
    version
  ) VALUES (
    p_user_id,
    p_ui_locale,
    v_source,
    1
  )
  ON CONFLICT (user_id) DO NOTHING;

  GET DIAGNOSTICS v_inserted = ROW_COUNT;

  IF v_inserted = 1 THEN
    IF p_expected_version IS DISTINCT FROM 0 THEN
      DELETE FROM public.user_preferences WHERE user_id = p_user_id;
      -- Não havia linha: a versão real vigente é 0 (não a temporária 1).
      RAISE EXCEPTION 'preferences_version_conflict'
        USING HINT = '0', DETAIL = '0';
    END IF;
    SELECT * INTO v_pref
      FROM public.user_preferences
      WHERE user_id = p_user_id;
    RETURN to_jsonb(v_pref);
  END IF;

  SELECT * INTO v_pref
    FROM public.user_preferences
    WHERE user_id = p_user_id
    FOR UPDATE;

  IF v_pref.version IS DISTINCT FROM p_expected_version THEN
    RAISE EXCEPTION 'preferences_version_conflict'
      USING HINT = v_pref.version::text,
            DETAIL = v_pref.version::text;
  END IF;

  UPDATE public.user_preferences SET
    ui_locale = p_ui_locale,
    ui_locale_source = v_source,
    version = v_pref.version + 1
  WHERE user_id = p_user_id
  RETURNING * INTO v_pref;

  RETURN to_jsonb(v_pref);
END;
$$;

REVOKE ALL ON FUNCTION public.write_user_locale_preference(UUID, TEXT, BIGINT)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.write_user_locale_preference(UUID, TEXT, BIGINT)
  TO service_role;

-- =============================================================================
-- REVERT (comentado; NÃO executa nada)
-- =============================================================================
-- A reversão de banco exige AUTORIZAÇÃO explícita e restauração prévia das RPCs
-- de onboarding recriadas no plano 04. Ordem sugerida:
--
-- DROP TRIGGER IF EXISTS trg_store_market_settings_updated_at ON public.store_market_settings;
-- DROP TRIGGER IF EXISTS trg_user_preferences_updated_at ON public.user_preferences;
-- DROP FUNCTION IF EXISTS public.update_store_market_settings_updated_at();
-- DROP FUNCTION IF EXISTS public.update_user_preferences_updated_at();
-- DROP FUNCTION IF EXISTS public.write_user_locale_preference(UUID, TEXT, BIGINT);
-- DROP FUNCTION IF EXISTS public.write_store_market_settings(
--   UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, INTEGER, BIGINT
-- );
-- DROP FUNCTION IF EXISTS public.ensure_store_market_settings(UUID, TEXT, TEXT);
-- DROP TABLE IF EXISTS public.store_market_settings;
-- DROP TABLE IF EXISTS public.user_preferences;
