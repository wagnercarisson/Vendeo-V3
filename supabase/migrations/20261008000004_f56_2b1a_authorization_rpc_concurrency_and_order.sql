-- F56.2b1a — Correção pós-revisão (WR-01 / WR-05).
--   WR-01: RPCs de autorização idempotentes sob CORRIDA (ON CONFLICT DO NOTHING +
--          releitura): requisições equivalentes devolvem o MESMO resultado;
--          conteúdo divergente com o mesmo operation_id devolve CONFLITO.
--   WR-05: coluna `seq` (ordem autoritativa de inserção) como desempate
--          determinístico contra empates de timestamp (milissegundo).
-- LOCAL-ONLY; aplicada na instância isolada aprovada. Sem `db push` remoto.

ALTER TABLE public.product_flow_stage_authorizations
  ADD COLUMN IF NOT EXISTS seq BIGINT GENERATED ALWAYS AS IDENTITY;

CREATE OR REPLACE FUNCTION public.admin_grant_product_flow_stage_authorization(
  p_actor_id          UUID,
  p_stage             TEXT,
  p_scope             TEXT,
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
  v_existing_type     TEXT;
  v_existing_stage    TEXT;
  v_existing_scope    TEXT;
  v_existing_instance TEXT;
  v_existing_actor    UUID;
  v_existing_reason   TEXT;
  v_enabling          BOOLEAN;
  v_expected_event    TEXT;
  v_stored_stage      TEXT;
  v_inserted_id       UUID;
BEGIN
  IF p_actor_id IS NULL THEN RAISE EXCEPTION 'missing_actor_id'; END IF;
  IF p_operation_id IS NULL THEN RAISE EXCEPTION 'missing_operation_id'; END IF;
  IF p_reason IS NULL OR btrim(p_reason) = '' THEN RAISE EXCEPTION 'missing_reason'; END IF;
  IF p_instance_identity IS NULL OR btrim(p_instance_identity) = '' THEN RAISE EXCEPTION 'missing_instance_identity'; END IF;
  IF p_scope IS NULL OR p_scope NOT IN ('test_stores', 'all_stores') THEN RAISE EXCEPTION 'invalid_scope'; END IF;
  IF p_stage IS NULL OR p_stage NOT IN ('off', 'isolated_pilot', 'test_stores', 'all_stores') THEN RAISE EXCEPTION 'invalid_stage'; END IF;

  v_enabling := p_stage <> 'off';
  v_expected_event := CASE WHEN v_enabling THEN 'refused' ELSE 'granted' END;
  v_stored_stage := CASE WHEN v_enabling THEN p_stage ELSE 'off' END;

  SELECT event_type, stage, scope, instance_identity, granted_by, reason
    INTO v_existing_type, v_existing_stage, v_existing_scope, v_existing_instance, v_existing_actor, v_existing_reason
  FROM public.product_flow_stage_authorizations
  WHERE operation_id = p_operation_id;
  IF FOUND THEN
    IF v_existing_type = v_expected_event
       AND v_existing_stage = v_stored_stage
       AND v_existing_scope = p_scope
       AND v_existing_instance = btrim(p_instance_identity)
       AND v_existing_actor IS NOT DISTINCT FROM p_actor_id
       AND v_existing_reason = btrim(p_reason) THEN
      IF v_existing_type = 'refused' THEN
        RETURN jsonb_build_object(
          'success', true, 'idempotent', true, 'granted', false, 'refused', true,
          'reason', 'operational_activation_blocked_in_b1a', 'stage', v_existing_stage, 'scope', v_existing_scope
        );
      END IF;
      RETURN jsonb_build_object(
        'success', true, 'idempotent', true, 'granted', true, 'refused', false,
        'stage', 'off', 'scope', v_existing_scope
      );
    END IF;
    RETURN jsonb_build_object(
      'success', false, 'conflict', true, 'reason', 'operation_id_conflict',
      'operation_id', p_operation_id, 'event_type', v_existing_type
    );
  END IF;

  INSERT INTO public.product_flow_stage_authorizations (
    event_type, stage, scope, instance_identity, granted_by, reason, operation_id, expires_at
  ) VALUES (
    v_expected_event, v_stored_stage, p_scope, btrim(p_instance_identity), p_actor_id, btrim(p_reason), p_operation_id, NULL
  )
  ON CONFLICT (operation_id) DO NOTHING
  RETURNING id INTO v_inserted_id;

  IF v_inserted_id IS NULL THEN
    SELECT event_type, stage, scope, instance_identity, granted_by, reason
      INTO v_existing_type, v_existing_stage, v_existing_scope, v_existing_instance, v_existing_actor, v_existing_reason
    FROM public.product_flow_stage_authorizations
    WHERE operation_id = p_operation_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'operation_not_found'; END IF;
    IF v_existing_type = v_expected_event
       AND v_existing_stage = v_stored_stage
       AND v_existing_scope = p_scope
       AND v_existing_instance = btrim(p_instance_identity)
       AND v_existing_actor IS NOT DISTINCT FROM p_actor_id
       AND v_existing_reason = btrim(p_reason) THEN
      IF v_existing_type = 'refused' THEN
        RETURN jsonb_build_object(
          'success', true, 'idempotent', true, 'granted', false, 'refused', true,
          'reason', 'operational_activation_blocked_in_b1a', 'stage', v_existing_stage, 'scope', v_existing_scope
        );
      END IF;
      RETURN jsonb_build_object(
        'success', true, 'idempotent', true, 'granted', true, 'refused', false,
        'stage', 'off', 'scope', v_existing_scope
      );
    END IF;
    RETURN jsonb_build_object(
      'success', false, 'conflict', true, 'reason', 'operation_id_conflict',
      'operation_id', p_operation_id, 'event_type', v_existing_type
    );
  END IF;

  IF v_enabling THEN
    RETURN jsonb_build_object(
      'success', true, 'granted', false, 'refused', true,
      'reason', 'operational_activation_blocked_in_b1a', 'stage', p_stage, 'scope', p_scope
    );
  END IF;

  RETURN jsonb_build_object('success', true, 'granted', true, 'refused', false, 'stage', 'off', 'scope', p_scope);
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_revoke_product_flow_stage_authorization(
  p_actor_id          UUID,
  p_scope             TEXT,
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
  v_existing_type     TEXT;
  v_existing_scope    TEXT;
  v_existing_instance TEXT;
  v_existing_actor    UUID;
  v_existing_reason   TEXT;
  v_inserted_id       UUID;
BEGIN
  IF p_actor_id IS NULL THEN RAISE EXCEPTION 'missing_actor_id'; END IF;
  IF p_operation_id IS NULL THEN RAISE EXCEPTION 'missing_operation_id'; END IF;
  IF p_reason IS NULL OR btrim(p_reason) = '' THEN RAISE EXCEPTION 'missing_reason'; END IF;
  IF p_instance_identity IS NULL OR btrim(p_instance_identity) = '' THEN RAISE EXCEPTION 'missing_instance_identity'; END IF;
  IF p_scope IS NULL OR p_scope NOT IN ('test_stores', 'all_stores') THEN RAISE EXCEPTION 'invalid_scope'; END IF;

  SELECT event_type, scope, instance_identity, granted_by, reason
    INTO v_existing_type, v_existing_scope, v_existing_instance, v_existing_actor, v_existing_reason
  FROM public.product_flow_stage_authorizations
  WHERE operation_id = p_operation_id;
  IF FOUND THEN
    IF v_existing_type = 'revoked'
       AND v_existing_scope = p_scope
       AND v_existing_instance = btrim(p_instance_identity)
       AND v_existing_actor IS NOT DISTINCT FROM p_actor_id
       AND v_existing_reason = btrim(p_reason) THEN
      RETURN jsonb_build_object('success', true, 'idempotent', true, 'revoked', true, 'stage', 'off', 'scope', v_existing_scope);
    END IF;
    RETURN jsonb_build_object(
      'success', false, 'conflict', true, 'reason', 'operation_id_conflict',
      'operation_id', p_operation_id, 'event_type', v_existing_type
    );
  END IF;

  INSERT INTO public.product_flow_stage_authorizations (
    event_type, stage, scope, instance_identity, granted_by, reason, operation_id, expires_at
  ) VALUES (
    'revoked', 'off', p_scope, btrim(p_instance_identity), p_actor_id, btrim(p_reason), p_operation_id, NULL
  )
  ON CONFLICT (operation_id) DO NOTHING
  RETURNING id INTO v_inserted_id;

  IF v_inserted_id IS NULL THEN
    SELECT event_type, scope, instance_identity, granted_by, reason
      INTO v_existing_type, v_existing_scope, v_existing_instance, v_existing_actor, v_existing_reason
    FROM public.product_flow_stage_authorizations
    WHERE operation_id = p_operation_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'operation_not_found'; END IF;
    IF v_existing_type = 'revoked'
       AND v_existing_scope = p_scope
       AND v_existing_instance = btrim(p_instance_identity)
       AND v_existing_actor IS NOT DISTINCT FROM p_actor_id
       AND v_existing_reason = btrim(p_reason) THEN
      RETURN jsonb_build_object('success', true, 'idempotent', true, 'revoked', true, 'stage', 'off', 'scope', v_existing_scope);
    END IF;
    RETURN jsonb_build_object(
      'success', false, 'conflict', true, 'reason', 'operation_id_conflict',
      'operation_id', p_operation_id, 'event_type', v_existing_type
    );
  END IF;

  RETURN jsonb_build_object('success', true, 'revoked', true, 'stage', 'off', 'scope', p_scope);
END;
$$;
