-- F56.2b2c (B2.3) — Ajuste MÍNIMO da barreira: via estreita `isolated_pilot` + `test_stores`.
-- LOCAL-ONLY: esta migration é apenas AUTORADA aqui. NÃO executar `supabase db push`
-- (nem qualquer mutação remota / reset / `migration up` remoto). Aplicar exclusivamente
-- na homologação permanente `vendeo-homolog` (workdir `G:\Vendeo-Homolog`) via:
--   npx --no-install supabase --workdir <ISO> migration up --local
-- Autorar aqui != aplicar.
--
-- Escopo (B2C-D1/D2/D6/D8): a RPC administrativa passa a CONCEDER somente
-- `stage='isolated_pilot'` com `scope='test_stores'`; continua RECUSANDO
-- `test_stores` (estágio), `all_stores` (estágio) e qualquer escopo `all_stores`
-- (barreira global preservada). Reaproveita identidade de instância, tabela/RPCs
-- append-only, auditoria, revogação e idempotência — SEM novo subsistema,
-- SEM `store_id`/allowlist/NOVA expiração. A assinatura (6 parâmetros) é PRESERVADA
-- (adicionar parâmetro criaria OUTRA assinatura/overload). `expires_at` = NULL.

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
  v_narrow            BOOLEAN;
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

  -- Via estreita (única habilitadora): `isolated_pilot` + `test_stores`.
  v_narrow := (p_stage = 'isolated_pilot' AND p_scope = 'test_stores');
  -- Todo o restante habilitador permanece RECUSADO (barreira global preservada).
  v_enabling := (p_stage <> 'off') AND NOT v_narrow;
  v_expected_event := CASE WHEN v_narrow THEN 'granted'
                           WHEN v_enabling THEN 'refused'
                           ELSE 'granted' END;
  v_stored_stage := CASE WHEN p_stage = 'off' THEN 'off' ELSE p_stage END;

  -- Idempotência VINCULADA à identidade da solicitação (ação + actor + estágio +
  -- escopo + instância + motivo). Replay equivalente preserva o resultado;
  -- conteúdo diferente é CONFLITO (sem nova escrita e sem sucesso enganoso).
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
      IF v_existing_stage = 'isolated_pilot' AND v_existing_scope = 'test_stores' THEN
        RETURN jsonb_build_object(
          'success', true, 'idempotent', true, 'granted', true, 'refused', false,
          'stage', 'isolated_pilot', 'scope', 'test_stores'
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

  -- Concorrência: insere com ON CONFLICT; quem perde a corrida aguarda o commit e
  -- relê. Equivalentes devolvem o MESMO resultado; conteúdo divergente devolve
  -- CONFLITO — sem suprimir silenciosamente a colisão de unicidade.
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
      IF v_existing_stage = 'isolated_pilot' AND v_existing_scope = 'test_stores' THEN
        RETURN jsonb_build_object(
          'success', true, 'idempotent', true, 'granted', true, 'refused', false,
          'stage', 'isolated_pilot', 'scope', 'test_stores'
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

  -- Concessão da via estreita (única habilitadora permitida).
  IF v_narrow THEN
    RETURN jsonb_build_object(
      'success', true, 'granted', true, 'refused', false,
      'stage', 'isolated_pilot', 'scope', 'test_stores'
    );
  END IF;

  -- Qualquer outro estágio habilitador permanece recusado (barreira global).
  IF v_enabling THEN
    RETURN jsonb_build_object(
      'success', true, 'granted', false, 'refused', true,
      'reason', 'operational_activation_blocked_in_b1a', 'stage', p_stage, 'scope', p_scope
    );
  END IF;

  RETURN jsonb_build_object('success', true, 'granted', true, 'refused', false, 'stage', 'off', 'scope', p_scope);
END;
$$;

-- Privilégios RPC-only (A2): nenhuma escrita direta; execução só por service_role.
REVOKE ALL ON FUNCTION public.admin_grant_product_flow_stage_authorization(UUID, TEXT, TEXT, TEXT, TEXT, UUID)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_grant_product_flow_stage_authorization(UUID, TEXT, TEXT, TEXT, TEXT, UUID)
  TO service_role;

-- A RPC de revogação (`admin_revoke_product_flow_stage_authorization`) permanece
-- INALTERADA — a revogação continua encerrando o recorte.

-- =============================================================================
-- REVERT (restaura a definição que RECUSA todo estágio habilitador; executar
-- manualmente apenas na instância local, se autorizado)
-- =============================================================================
-- Restaurar a versão anterior de `admin_grant_product_flow_stage_authorization`
-- (a definição de `supabase/migrations/20261008000004_f56_2b1a_authorization_rpc_concurrency_and_order.sql`,
-- que recusa qualquer `p_stage <> 'off'` com `operational_activation_blocked_in_b1a`).
