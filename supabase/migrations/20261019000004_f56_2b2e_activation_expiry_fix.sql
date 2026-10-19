-- F56.2b2e (56.2.7) - Corrige a leitura de autorizacao EXPIRADA na RPC coordenadora.
-- Aplicacao SOMENTE na instancia isolada de testes (`vendeo-f562a-isolated`);
-- NUNCA `db push`, `--linked`, reset, `migration repair` ou producao.
--
-- A RPC executa TODAS as mutacoes em UMA transacao, com trava de serializacao,
-- registro duravel por operation_id e verificacao final. Qualquer falha reverte
-- tudo. Ela nao le documentos/checkpoints: a confirmacao administrativa
-- autenticada e o comando de ativacao.

-- Tabela ja criada pela migration 20261019000003; IF NOT EXISTS preserva idempotencia.
CREATE TABLE IF NOT EXISTS public.product_1_1_activation_actions (
  operation_id      UUID PRIMARY KEY,
  actor_id          UUID NOT NULL,
  mode              TEXT NOT NULL CHECK (mode IN ('off', 'test_stores', 'all_stores')),
  reason            TEXT NOT NULL,
  instance_identity TEXT NOT NULL,
  result            JSONB NOT NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.product_1_1_activation_actions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.product_1_1_activation_actions FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT ON TABLE public.product_1_1_activation_actions TO service_role;

CREATE OR REPLACE FUNCTION public.admin_set_product_1_1_activation(
  p_actor_id          UUID,
  p_mode              TEXT,
  p_instance_identity TEXT,
  p_reason            TEXT,
  p_operation_id      UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_existing          public.product_1_1_activation_actions%ROWTYPE;
  v_test_enabled      BOOLEAN;
  v_all_enabled       BOOLEAN;
  v_test_stage        TEXT;
  v_all_stage         TEXT;
  v_step              UUID;
  v_rpc               JSONB;
  v_result            JSONB;
  v_already           BOOLEAN := false;
BEGIN
  IF p_actor_id IS NULL THEN RAISE EXCEPTION 'missing_actor_id'; END IF;
  IF p_operation_id IS NULL THEN RAISE EXCEPTION 'missing_operation_id'; END IF;
  IF p_reason IS NULL OR btrim(p_reason) = '' THEN RAISE EXCEPTION 'missing_reason'; END IF;
  IF p_instance_identity IS NULL OR btrim(p_instance_identity) = '' THEN RAISE EXCEPTION 'missing_instance_identity'; END IF;
  IF p_mode IS NULL OR p_mode NOT IN ('off', 'test_stores', 'all_stores') THEN RAISE EXCEPTION 'invalid_mode'; END IF;

  PERFORM pg_advisory_xact_lock(hashtext('product_1_1_activation'));

  SELECT * INTO v_existing
    FROM public.product_1_1_activation_actions
   WHERE operation_id = p_operation_id;
  IF FOUND THEN
    IF v_existing.actor_id = p_actor_id
       AND v_existing.mode = p_mode
       AND v_existing.reason = btrim(p_reason)
       AND v_existing.instance_identity = btrim(p_instance_identity) THEN
      RETURN jsonb_build_object(
        'success', true, 'idempotent', true, 'operation_id', p_operation_id,
        'mode', v_existing.mode, 'result', v_existing.result
      );
    END IF;
    RETURN jsonb_build_object(
      'success', false, 'conflict', true, 'reason', 'operation_id_conflict',
      'operation_id', p_operation_id
    );
  END IF;

  SELECT enabled INTO v_test_enabled FROM public.feature_flags
   WHERE key = 'product_1_1_test_stores_enabled';
  SELECT enabled INTO v_all_enabled FROM public.feature_flags
   WHERE key = 'product_1_1_all_stores_enabled';
  IF v_test_enabled IS NULL OR v_all_enabled IS NULL THEN RAISE EXCEPTION 'flags_unavailable'; END IF;

  SELECT COALESCE((
    SELECT CASE WHEN stage <> 'off' AND expires_at IS NOT NULL AND expires_at <= now() THEN 'off' ELSE stage END AS stage FROM public.product_flow_stage_authorizations
     WHERE scope = 'test_stores'
       AND instance_identity = btrim(p_instance_identity)
       AND event_type <> 'refused'
     ORDER BY created_at DESC, seq DESC LIMIT 1
  ), 'off') INTO v_test_stage;
  SELECT COALESCE((
    SELECT CASE WHEN stage <> 'off' AND expires_at IS NOT NULL AND expires_at <= now() THEN 'off' ELSE stage END AS stage FROM public.product_flow_stage_authorizations
     WHERE scope = 'all_stores'
       AND instance_identity = btrim(p_instance_identity)
       AND event_type <> 'refused'
     ORDER BY created_at DESC, seq DESC LIMIT 1
  ), 'off') INTO v_all_stage;

  IF p_mode = 'off' AND v_test_enabled = false AND v_all_enabled = false
     AND v_test_stage = 'off' AND v_all_stage = 'off' THEN
    v_already := true;
  ELSIF p_mode = 'test_stores' AND v_test_enabled = true AND v_all_enabled = false
     AND v_test_stage = 'test_stores' AND v_all_stage = 'off' THEN
    v_already := true;
  ELSIF p_mode = 'all_stores' AND v_all_enabled = true AND v_test_enabled = false
     AND v_all_stage = 'all_stores' AND v_test_stage = 'test_stores' THEN
    v_already := true;
  END IF;

  IF NOT v_already THEN
    IF p_mode = 'off' THEN
      v_step := gen_random_uuid();
      v_rpc := public.admin_update_feature_flag('product_1_1_all_stores_enabled', false, btrim(p_reason), p_actor_id, v_step);
      IF v_rpc->>'success' <> 'true' THEN RAISE EXCEPTION 'activation_flag_update_failed'; END IF;
      v_step := gen_random_uuid();
      v_rpc := public.admin_update_feature_flag('product_1_1_test_stores_enabled', false, btrim(p_reason), p_actor_id, v_step);
      IF v_rpc->>'success' <> 'true' THEN RAISE EXCEPTION 'activation_flag_update_failed'; END IF;
      v_step := gen_random_uuid();
      v_rpc := public.admin_revoke_product_flow_stage_authorization(p_actor_id, 'all_stores', btrim(p_instance_identity), btrim(p_reason), v_step);
      IF v_rpc->>'success' <> 'true' THEN RAISE EXCEPTION 'activation_revoke_failed'; END IF;
      v_step := gen_random_uuid();
      v_rpc := public.admin_revoke_product_flow_stage_authorization(p_actor_id, 'test_stores', btrim(p_instance_identity), btrim(p_reason), v_step);
      IF v_rpc->>'success' <> 'true' THEN RAISE EXCEPTION 'activation_revoke_failed'; END IF;

    ELSIF p_mode = 'test_stores' THEN
      v_step := gen_random_uuid();
      v_rpc := public.admin_update_feature_flag('product_1_1_all_stores_enabled', false, btrim(p_reason), p_actor_id, v_step);
      IF v_rpc->>'success' <> 'true' THEN RAISE EXCEPTION 'activation_flag_update_failed'; END IF;
      v_step := gen_random_uuid();
      v_rpc := public.admin_grant_product_flow_stage_authorization(p_actor_id, 'test_stores', 'test_stores', btrim(p_instance_identity), btrim(p_reason), v_step);
      IF v_rpc->>'granted' <> 'true' THEN RAISE EXCEPTION 'activation_grant_failed'; END IF;
      v_step := gen_random_uuid();
      v_rpc := public.admin_update_feature_flag('product_1_1_test_stores_enabled', true, btrim(p_reason), p_actor_id, v_step);
      IF v_rpc->>'success' <> 'true' THEN RAISE EXCEPTION 'activation_flag_update_failed'; END IF;
      v_step := gen_random_uuid();
      v_rpc := public.admin_revoke_product_flow_stage_authorization(p_actor_id, 'all_stores', btrim(p_instance_identity), btrim(p_reason), v_step);
      IF v_rpc->>'success' <> 'true' THEN RAISE EXCEPTION 'activation_revoke_failed'; END IF;

    ELSIF p_mode = 'all_stores' THEN
      v_step := gen_random_uuid();
      v_rpc := public.admin_grant_product_flow_stage_authorization(p_actor_id, 'all_stores', 'all_stores', btrim(p_instance_identity), btrim(p_reason), v_step);
      IF v_rpc->>'granted' <> 'true' THEN RAISE EXCEPTION 'activation_grant_failed'; END IF;
      v_step := gen_random_uuid();
      v_rpc := public.admin_grant_product_flow_stage_authorization(p_actor_id, 'test_stores', 'test_stores', btrim(p_instance_identity), btrim(p_reason), v_step);
      IF v_rpc->>'granted' <> 'true' THEN RAISE EXCEPTION 'activation_grant_failed'; END IF;
      v_step := gen_random_uuid();
      v_rpc := public.admin_update_feature_flag('product_1_1_all_stores_enabled', true, btrim(p_reason), p_actor_id, v_step);
      IF v_rpc->>'success' <> 'true' THEN RAISE EXCEPTION 'activation_flag_update_failed'; END IF;
      v_step := gen_random_uuid();
      v_rpc := public.admin_update_feature_flag('product_1_1_test_stores_enabled', false, btrim(p_reason), p_actor_id, v_step);
      IF v_rpc->>'success' <> 'true' THEN RAISE EXCEPTION 'activation_flag_update_failed'; END IF;
    END IF;
  END IF;

  SELECT enabled INTO v_test_enabled FROM public.feature_flags
   WHERE key = 'product_1_1_test_stores_enabled';
  SELECT enabled INTO v_all_enabled FROM public.feature_flags
   WHERE key = 'product_1_1_all_stores_enabled';
  SELECT COALESCE((
    SELECT CASE WHEN stage <> 'off' AND expires_at IS NOT NULL AND expires_at <= now() THEN 'off' ELSE stage END AS stage FROM public.product_flow_stage_authorizations
     WHERE scope = 'test_stores'
       AND instance_identity = btrim(p_instance_identity)
       AND event_type <> 'refused'
     ORDER BY created_at DESC, seq DESC LIMIT 1
  ), 'off') INTO v_test_stage;
  SELECT COALESCE((
    SELECT CASE WHEN stage <> 'off' AND expires_at IS NOT NULL AND expires_at <= now() THEN 'off' ELSE stage END AS stage FROM public.product_flow_stage_authorizations
     WHERE scope = 'all_stores'
       AND instance_identity = btrim(p_instance_identity)
       AND event_type <> 'refused'
     ORDER BY created_at DESC, seq DESC LIMIT 1
  ), 'off') INTO v_all_stage;

  IF p_mode = 'off' THEN
    IF v_test_enabled IS DISTINCT FROM false OR v_all_enabled IS DISTINCT FROM false
       OR v_test_stage <> 'off' OR v_all_stage <> 'off' THEN
      RAISE EXCEPTION 'activation_verification_failed';
    END IF;
  ELSIF p_mode = 'test_stores' THEN
    IF v_test_enabled IS DISTINCT FROM true OR v_all_enabled IS DISTINCT FROM false
       OR v_test_stage <> 'test_stores' OR v_all_stage <> 'off' THEN
      RAISE EXCEPTION 'activation_verification_failed';
    END IF;
  ELSIF p_mode = 'all_stores' THEN
    IF v_all_enabled IS DISTINCT FROM true OR v_test_enabled IS DISTINCT FROM false
       OR v_all_stage <> 'all_stores' OR v_test_stage <> 'test_stores' THEN
      RAISE EXCEPTION 'activation_verification_failed';
    END IF;
  END IF;

  v_result := jsonb_build_object(
    'success', true, 'idempotent', false, 'alreadyInMode', v_already,
    'operation_id', p_operation_id, 'mode', p_mode, 'verified', true,
    'flags', jsonb_build_object(
      'test_stores', v_test_enabled, 'all_stores', v_all_enabled
    ),
    'authorizations', jsonb_build_object(
      'test_stores', v_test_stage, 'all_stores', v_all_stage
    )
  );

  INSERT INTO public.product_1_1_activation_actions (
    operation_id, actor_id, mode, reason, instance_identity, result
  ) VALUES (
    p_operation_id, p_actor_id, p_mode, btrim(p_reason), btrim(p_instance_identity), v_result
  );

  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_set_product_1_1_activation(UUID, TEXT, TEXT, TEXT, UUID)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_set_product_1_1_activation(UUID, TEXT, TEXT, TEXT, UUID)
  TO service_role;

-- REVERT (manual, somente na instancia isolada)
-- DROP FUNCTION IF EXISTS public.admin_set_product_1_1_activation(UUID, TEXT, TEXT, TEXT, UUID);
-- DROP TABLE IF EXISTS public.product_1_1_activation_actions;

