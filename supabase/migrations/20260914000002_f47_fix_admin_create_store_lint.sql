-- F47-01 forward fix: resolve the stale named-call lint error in the existing
-- admin_create_store_for_user RPC without editing its historical migration.
-- The current create_store_with_initial_grant signature has optional parameters,
-- but the schema linter requires the complete signature at this call site.

-- The historical legal-acceptance migration removed the old overload while
-- retaining callers of it. Re-establish the exact service-role function as a
-- forward repair, with qualified variables to keep plpgsql lint deterministic.
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
  v_balance INTEGER;
BEGIN
  INSERT INTO public.stores (
    name, segment, user_id, city, state, brand_color, logo_url,
    subsegment, tone_of_voice, positioning, short_description, slogan
  ) VALUES (
    p_name, p_segment, p_user_id, p_city, p_state, p_brand_color, p_logo_url,
    p_subsegment, p_tone_of_voice, p_positioning, p_short_description, p_slogan
  )
  RETURNING id INTO v_store_id;

  PERFORM public.grant_credits(
    v_store_id,
    p_initial_grant_amount,
    'onboarding',
    'onboarding_' || v_store_id,
    '{}'::jsonb
  );

  SELECT COALESCE(cb.balance, 0) INTO v_balance
  FROM public.credit_balances cb
  WHERE cb.store_id = v_store_id;

  v_store_data := jsonb_build_object(
    'id', v_store_id,
    'name', p_name,
    'segment', p_segment,
    'balance', v_balance
  );
  RETURN v_store_data;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.create_store_with_initial_grant(TEXT, TEXT, UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, INTEGER) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_store_with_initial_grant(TEXT, TEXT, UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, INTEGER) TO service_role;

CREATE OR REPLACE FUNCTION public.admin_create_store_for_user(
  p_admin_id UUID,
  p_user_id UUID,
  p_name TEXT,
  p_segment TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_store_data JSONB;
BEGIN
  IF EXISTS (SELECT 1 FROM public.stores WHERE user_id = p_user_id) THEN
    RAISE EXCEPTION 'usuario_ja_possui_loja';
  END IF;

  v_store_data := public.create_store_with_initial_grant(
    p_name,
    p_segment,
    p_user_id,
    NULL::TEXT,
    NULL::TEXT,
    NULL::TEXT,
    NULL::TEXT,
    NULL::TEXT,
    NULL::TEXT,
    NULL::TEXT,
    NULL::TEXT,
    NULL::TEXT,
    10
  );

  INSERT INTO public.admin_audit_log (actor_id, action, target_type, target_id, reason, metadata)
  VALUES (
    p_admin_id, 'store_create_invite', 'user', p_user_id,
    'Criação de loja via admin (convite beta)',
    jsonb_build_object('storeId', v_store_data ->> 'id', 'storeName', p_name)
  );

  RETURN v_store_data;
END;
$$;

-- REVERT: restore the historical function definition from
-- 20260718000001_create_admin_tables.sql if this forward fix is rolled back.
