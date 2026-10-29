-- =============================================================================
-- F57.3 — Idioma da interface: pt-BR | es-419 (fatia F57.3)
-- =============================================================================
-- Separa o contrato do idioma da INTERFACE do contrato do idioma de CONTEÚDO.
-- - user_preferences.ui_locale passa a aceitar apenas 'pt-BR' | 'es-419'.
-- - store_market_settings NÃO é alterado: conteúdo/campanha continuam
--   aceitando 'pt-BR' | 'es-PY'.
--
-- A migration deve ser aplicada como UMA transação (unidade atômica do runner).
-- Não há COMMIT intermediário. A ordem é obrigatória:
--   1. remover a constraint antiga;
--   2. converter os registros existentes;
--   3. adicionar a constraint nova;
--   4. atualizar a RPC write_user_locale_preference.
-- Se qualquer passo falhar, a transação inteira é revertida.
--
-- Conversão pontual: somente eventuais registros de teste es-PY de
-- user_preferences são convertidos. A versão é incrementada APENAS nas linhas
-- convertidas para manter o CAS honesto; ui_locale_source permanece 'explicit';
-- created_at é preservado; updated_at é atualizado pelo trigger existente.
-- Nenhum registro é apagado e nenhuma outra tabela é tocada.
-- =============================================================================

-- =============================================================================
-- 1. Remover a constraint antiga (antes da conversão)
-- =============================================================================

ALTER TABLE public.user_preferences
  DROP CONSTRAINT IF EXISTS chk_user_preferences_ui_locale;

-- =============================================================================
-- 2. Conversão pontual es-PY -> es-419 (somente user_preferences)
-- =============================================================================

UPDATE public.user_preferences
   SET ui_locale = 'es-419',
       version = version + 1
 WHERE ui_locale = 'es-PY';

-- =============================================================================
-- 3. Nova constraint (depois da conversão)
-- =============================================================================

ALTER TABLE public.user_preferences
  ADD CONSTRAINT chk_user_preferences_ui_locale
  CHECK (ui_locale IS NULL OR ui_locale IN ('pt-BR', 'es-419'));

COMMENT ON TABLE public.user_preferences IS
  'F57.3: idioma da interface por usuário (pt-BR/es-419). Independente do país/mercado da loja e do idioma do conteúdo. Ausência de linha = legado pt-BR.';
COMMENT ON COLUMN public.user_preferences.ui_locale_source IS
  'explicit = escolha do usuário; legacy_br = ausência/limpeza resolvida como pt-BR.';

-- =============================================================================
-- 4. write_user_locale_preference (mesma assinatura, CAS e segurança)
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

  IF p_ui_locale IS NOT NULL AND p_ui_locale NOT IN ('pt-BR', 'es-419') THEN
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
-- A reversão deve ser uma migration NOVA, aplicada como UMA transação, na mesma
-- ordem atômica, sem apagar registros e sem restaurar o banco inteiro:
--
--   1. ALTER TABLE public.user_preferences
--        DROP CONSTRAINT IF EXISTS chk_user_preferences_ui_locale;
--   2. UPDATE public.user_preferences
--         SET ui_locale = 'es-PY',
--             version = version + 1
--       WHERE ui_locale = 'es-419';
--   3. ALTER TABLE public.user_preferences
--        ADD CONSTRAINT chk_user_preferences_ui_locale
--        CHECK (ui_locale IS NULL OR ui_locale IN ('pt-BR', 'es-PY'));
--   4. Restaurar a definição de write_user_locale_preference da migration
--      20261028145738_f57_2_market_preferences.sql (assinatura e grants iguais).
--
-- Recriar a constraint antiga antes da conversão é inválido: os valores
-- 'es-419' ainda existiriam.
