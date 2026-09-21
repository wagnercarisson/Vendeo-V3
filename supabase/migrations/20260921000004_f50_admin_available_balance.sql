-- F50: admin user summaries must expose available balance, not raw ledger total.
DROP FUNCTION IF EXISTS public.admin_get_users_summary(TEXT, INTEGER, INTEGER, TEXT, TEXT);

CREATE OR REPLACE FUNCTION public.admin_get_users_summary(
  p_search TEXT DEFAULT NULL,
  p_page INTEGER DEFAULT 1,
  p_page_size INTEGER DEFAULT 20,
  p_verification_status TEXT DEFAULT NULL,
  p_store_kind TEXT DEFAULT 'production'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_offset INTEGER := (p_page - 1) * p_page_size;
  v_data JSONB;
  v_total BIGINT;
BEGIN
  SELECT COUNT(*) INTO v_total
  FROM auth.users au
  LEFT JOIN public.stores s ON s.user_id = au.id
  WHERE (p_search IS NULL OR au.email ILIKE '%' || p_search || '%' OR s.name ILIKE '%' || p_search || '%' OR s.segment ILIKE '%' || p_search || '%')
    AND (p_verification_status IS NULL OR s.verification_status = p_verification_status)
    AND CASE WHEN p_store_kind = 'production' THEN (s.is_test_store IS NULL OR s.is_test_store = FALSE)
             WHEN p_store_kind = 'test' THEN s.is_test_store = TRUE ELSE TRUE END;

  SELECT COALESCE(jsonb_agg(user_data ORDER BY user_data->>'createdAt' DESC), '[]'::jsonb) INTO v_data
  FROM (
    SELECT jsonb_build_object(
      'userId', u.id, 'email', u.email, 'storeId', st.id, 'storeName', st.name,
      'segment', st.segment,
      'balance', COALESCE(CASE WHEN cb.demo_expires_at > now() THEN cb.demo_balance ELSE 0 END, 0)
        + COALESCE(cb.bonus_balance, 0) + COALESCE(cb.purchased_balance, 0),
      'bonusBalance', COALESCE(cb.bonus_balance, 0),
      'purchasedBalance', COALESCE(cb.purchased_balance, 0),
      'totalCampaigns', COALESCE(c.cnt, 0), 'errorCampaigns', COALESCE(ec.cnt, 0),
      'lastCampaignAt', cl.last_at, 'createdAt', u.created_at,
      'verificationStatus', st.verification_status, 'isTestStore', st.is_test_store
    ) AS user_data
    FROM auth.users u
    LEFT JOIN public.stores st ON st.user_id = u.id
    LEFT JOIN public.credit_balances cb ON cb.store_id = st.id
    LEFT JOIN (SELECT store_id, COUNT(*) AS cnt FROM public.campaigns GROUP BY store_id) c ON c.store_id = st.id
    LEFT JOIN (SELECT store_id, COUNT(*) AS cnt FROM public.campaigns WHERE status = 'error' GROUP BY store_id) ec ON ec.store_id = st.id
    LEFT JOIN (SELECT store_id, MAX(created_at) AS last_at FROM public.campaigns GROUP BY store_id) cl ON cl.store_id = st.id
    WHERE (p_search IS NULL OR u.email ILIKE '%' || p_search || '%' OR st.name ILIKE '%' || p_search || '%' OR st.segment ILIKE '%' || p_search || '%')
      AND (p_verification_status IS NULL OR st.verification_status = p_verification_status)
      AND CASE WHEN p_store_kind = 'production' THEN (st.is_test_store IS NULL OR st.is_test_store = FALSE)
               WHEN p_store_kind = 'test' THEN st.is_test_store = TRUE ELSE TRUE END
    ORDER BY u.created_at DESC LIMIT p_page_size OFFSET v_offset
  ) sub;

  RETURN jsonb_build_object('data', v_data, 'total', v_total);
END;
$$;

REVOKE ALL ON FUNCTION public.admin_get_users_summary(TEXT, INTEGER, INTEGER, TEXT, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_get_users_summary(TEXT, INTEGER, INTEGER, TEXT, TEXT) TO service_role;
