-- F56.2b2d (B2.4) — Via operacional estreita `test_stores` + `test_stores`.
-- LOCAL-ONLY: esta migration é apenas AUTORADA aqui. NÃO executar `supabase db push`
-- (nem qualquer mutação remota / `--linked` / reset / `migration up` / `migration repair`).
-- Autorar aqui != aplicar. A aplicação remota é ETAPA SEPARADA com checkpoint humano
-- (ver runbooks de backup/deploy e o conjunto definitivo de migrations com SHA-256).
--
-- Sucessora ADITIVA de `supabase/migrations/20261017000001_f56_2b2c_narrow_authorization.sql`
-- (decisão D1 do design). Escopo:
--   * reconhecer DUAS vias estreitas habilitadoras:
--       (i)  `isolated_pilot` + `test_stores`   (via inalterada, validação local);
--       (ii) `test_stores`    + `test_stores`   (novo piloto hospedado operacional);
--   * MANTER `all_stores` (estágio) e QUALQUER `p_scope = 'all_stores'` no ramo `refused`
--     com `operational_activation_blocked_in_b1a` (barreira global PRESERVADA);
--   * preservar identidade de instância, tabela/RPCs append-only, auditoria, revogação,
--     idempotência, `ON CONFLICT (operation_id) DO NOTHING` e `expires_at = NULL`;
--   * assinatura de 6 parâmetros PRESERVADA (sem novo parâmetro/overload).
-- Sem allowlist por loja e sem novo subsistema.

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
  v_narrow_isolated   BOOLEAN;
  v_narrow_operational BOOLEAN;
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

  -- DUAS vias estreitas habilitadoras (e SOMENTE elas).
  v_narrow_isolated := (p_stage = 'isolated_pilot' AND p_scope = 'test_stores');
  v_narrow_operational := (p_stage = 'test_stores' AND p_scope = 'test_stores');
  v_narrow := v_narrow_isolated OR v_narrow_operational;
  -- Todo o restante habilitador permanece RECUSADO (barreira global preservada),
  -- INCLUSIVE `all_stores` e qualquer `p_scope = 'all_stores'`.
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
      IF v_existing_scope = 'test_stores'
         AND v_existing_stage IN ('isolated_pilot', 'test_stores') THEN
        RETURN jsonb_build_object(
          'success', true, 'idempotent', true, 'granted', true, 'refused', false,
          'stage', v_existing_stage, 'scope', 'test_stores'
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
      IF v_existing_scope = 'test_stores'
         AND v_existing_stage IN ('isolated_pilot', 'test_stores') THEN
        RETURN jsonb_build_object(
          'success', true, 'idempotent', true, 'granted', true, 'refused', false,
          'stage', v_existing_stage, 'scope', 'test_stores'
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

  -- Concessão de uma das vias estreitas: devolve o ESTÁGIO solicitado (persistido).
  IF v_narrow THEN
    RETURN jsonb_build_object(
      'success', true, 'granted', true, 'refused', false,
      'stage', p_stage, 'scope', 'test_stores'
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
-- INALTERADA — a revogação continua encerrando o recorte operacional.

-- =============================================================================
-- REVERT (restaura a definição de `20261017000001` — via estreita única
-- `isolated_pilot` + `test_stores`; executar manualmente apenas na instância
-- local, se autorizado)
-- =============================================================================
-- Restaurar a versão anterior de `admin_grant_product_flow_stage_authorization`
-- (a definição de `supabase/migrations/20261017000001_f56_2b2c_narrow_authorization.sql`,
-- que concede SOMENTE `isolated_pilot` + `test_stores` e recusa os demais estágios
-- habilitadores com `operational_activation_blocked_in_b1a`):
--   v_narrow := (p_stage = 'isolated_pilot' AND p_scope = 'test_stores');
--   v_enabling := (p_stage <> 'off') AND NOT v_narrow;
--   ... (idempotência devolvendo `'isolated_pilot'` fixo e ramo `off`).
-- Reexecutar o corpo integral de `20261017000001` para reverter esta sucessora.
