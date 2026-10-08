-- F56.2b1a — Autorização independente de estágio do Produto 1:1 (append-only)
-- Local-first: aplicar e validar apenas na instância Supabase descartável isolada
-- aprovada (`vendeo-f562a-isolated`, API 127.0.0.1:56321, DB 56322).
-- Esta migration é ADITIVA e LOCAL-ONLY: NÃO executar `supabase db push` remoto
-- sem aprovação humana explícita.
--
-- Escopo (design A2 / tasks 2.1-2.3):
--   1. Tabela dedicada `product_flow_stage_authorizations` com estágio/escopo/
--      identidade da instância/concessor/timestamps/expiração/motivo/operation_id.
--   2. Histórico APPEND-ONLY (somente INSERT; UPDATE/DELETE recusados por trigger).
--   3. RPCs `SECURITY DEFINER` de privilégios mínimos com actor derivado server-side
--      (requireAdmin) e motivo/operation_id obrigatórios.
--   4. Nesta change o estágio operacional permanece SEMPRE `off`: a concessão de
--      estágio habilitador é RECUSADA de forma explícita e auditada (evento
--      `refused` registrado no histórico). Nenhum caminho operacional habilita o
--      fluxo nesta fatia.
--
-- Isolamento: esta migration NÃO altera `feature_flags`, `ai_model_selection`,
-- `admin_audit_log` nem qualquer estrutura legada.

-- =============================================================================
-- 1. Tabela dedicada append-only
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.product_flow_stage_authorizations (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type         TEXT NOT NULL CHECK (event_type IN ('granted', 'revoked', 'refused')),
  stage              TEXT NOT NULL CHECK (stage IN ('off', 'isolated_pilot', 'test_stores', 'all_stores')),
  scope              TEXT NOT NULL CHECK (scope IN ('test_stores', 'all_stores')),
  instance_identity  TEXT NOT NULL,
  granted_by         UUID REFERENCES auth.users(id),
  reason             TEXT NOT NULL,
  operation_id       UUID NOT NULL,
  expires_at         TIMESTAMPTZ,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT chk_product_flow_stage_authorizations_instance_identity
    CHECK (btrim(instance_identity) <> ''),
  CONSTRAINT chk_product_flow_stage_authorizations_reason
    CHECK (btrim(reason) <> ''),
  CONSTRAINT uq_product_flow_stage_authorizations_operation
    UNIQUE (operation_id)
);

CREATE INDEX IF NOT EXISTS idx_product_flow_stage_authorizations_scope_instance
  ON public.product_flow_stage_authorizations (scope, instance_identity, created_at);

-- =============================================================================
-- 2. RLS service_role only (sem escrita direta do app)
-- =============================================================================
ALTER TABLE public.product_flow_stage_authorizations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role can read/insert product flow stage authorizations"
  ON public.product_flow_stage_authorizations;
CREATE POLICY "Service role can read/insert product flow stage authorizations"
  ON public.product_flow_stage_authorizations FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- Append-only: somente SELECT/INSERT; UPDATE/DELETE revogados da própria service_role.
REVOKE ALL ON TABLE public.product_flow_stage_authorizations FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.product_flow_stage_authorizations FROM service_role;
GRANT SELECT, INSERT ON TABLE public.product_flow_stage_authorizations TO service_role;

-- =============================================================================
-- 3. Trigger de imutabilidade (append-only)
-- =============================================================================
CREATE OR REPLACE FUNCTION public.trg_product_flow_stage_authorizations_immutable_fn()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  RAISE EXCEPTION 'product_flow_stage_authorizations_immutable';
END;
$$;

DROP TRIGGER IF EXISTS trg_product_flow_stage_authorizations_immutable
  ON public.product_flow_stage_authorizations;
CREATE TRIGGER trg_product_flow_stage_authorizations_immutable
BEFORE UPDATE OR DELETE ON public.product_flow_stage_authorizations
FOR EACH ROW
EXECUTE FUNCTION public.trg_product_flow_stage_authorizations_immutable_fn();

-- =============================================================================
-- 4. RPC de concessão auditada (recusa estágio habilitador nesta change)
-- =============================================================================
-- O actor é derivado server-side por `requireAdmin()` e passado como `p_actor_id`;
-- nunca vem do payload do cliente. Motivo e operation_id são obrigatórios.
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
BEGIN
  IF p_actor_id IS NULL THEN RAISE EXCEPTION 'missing_actor_id'; END IF;
  IF p_operation_id IS NULL THEN RAISE EXCEPTION 'missing_operation_id'; END IF;
  IF p_reason IS NULL OR btrim(p_reason) = '' THEN RAISE EXCEPTION 'missing_reason'; END IF;
  IF p_instance_identity IS NULL OR btrim(p_instance_identity) = '' THEN RAISE EXCEPTION 'missing_instance_identity'; END IF;
  IF p_scope IS NULL OR p_scope NOT IN ('test_stores', 'all_stores') THEN RAISE EXCEPTION 'invalid_scope'; END IF;
  IF p_stage IS NULL OR p_stage NOT IN ('off', 'isolated_pilot', 'test_stores', 'all_stores') THEN RAISE EXCEPTION 'invalid_stage'; END IF;

  v_enabling := p_stage <> 'off';
  v_expected_event := CASE WHEN v_enabling THEN 'refused' ELSE 'granted' END;

  -- Idempotência VINCULADA à identidade da solicitação (ação + actor + estágio +
  -- escopo + instância + motivo). Replay equivalente preserva o resultado;
  -- conteúdo diferente é CONFLITO (sem nova escrita e sem sucesso enganoso).
  SELECT event_type, stage, scope, instance_identity, granted_by, reason
    INTO v_existing_type, v_existing_stage, v_existing_scope, v_existing_instance, v_existing_actor, v_existing_reason
  FROM public.product_flow_stage_authorizations
  WHERE operation_id = p_operation_id;
  IF FOUND THEN
    IF v_existing_type = v_expected_event
       AND v_existing_stage = p_stage
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

  -- Nesta change TODO estágio habilitador é recusado de forma explícita e
  -- auditada; o estado operacional permanece `off`.
  IF v_enabling THEN
    INSERT INTO public.product_flow_stage_authorizations (
      event_type, stage, scope, instance_identity, granted_by, reason, operation_id, expires_at
    ) VALUES (
      'refused', p_stage, p_scope, btrim(p_instance_identity), p_actor_id, btrim(p_reason), p_operation_id, NULL
    );
    RETURN jsonb_build_object(
      'success', true,
      'granted', false,
      'refused', true,
      'reason', 'operational_activation_blocked_in_b1a',
      'stage', p_stage,
      'scope', p_scope
    );
  END IF;

  INSERT INTO public.product_flow_stage_authorizations (
    event_type, stage, scope, instance_identity, granted_by, reason, operation_id, expires_at
  ) VALUES (
    'granted', 'off', p_scope, btrim(p_instance_identity), p_actor_id, btrim(p_reason), p_operation_id, NULL
  );

  RETURN jsonb_build_object('success', true, 'granted', true, 'refused', false, 'stage', 'off', 'scope', p_scope);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.admin_grant_product_flow_stage_authorization(UUID, TEXT, TEXT, TEXT, TEXT, UUID)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_grant_product_flow_stage_authorization(UUID, TEXT, TEXT, TEXT, TEXT, UUID)
  TO service_role;

-- =============================================================================
-- 5. RPC de revogação auditada (append-only; retorna o escopo a `off`)
-- =============================================================================
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
BEGIN
  IF p_actor_id IS NULL THEN RAISE EXCEPTION 'missing_actor_id'; END IF;
  IF p_operation_id IS NULL THEN RAISE EXCEPTION 'missing_operation_id'; END IF;
  IF p_reason IS NULL OR btrim(p_reason) = '' THEN RAISE EXCEPTION 'missing_reason'; END IF;
  IF p_instance_identity IS NULL OR btrim(p_instance_identity) = '' THEN RAISE EXCEPTION 'missing_instance_identity'; END IF;
  IF p_scope IS NULL OR p_scope NOT IN ('test_stores', 'all_stores') THEN RAISE EXCEPTION 'invalid_scope'; END IF;

  -- Idempotência vinculada à identidade da solicitação (revogação): replay
  -- equivalente preserva o resultado; conteúdo diferente é CONFLITO.
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
  );

  RETURN jsonb_build_object('success', true, 'revoked', true, 'stage', 'off', 'scope', p_scope);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.admin_revoke_product_flow_stage_authorization(UUID, TEXT, TEXT, TEXT, UUID)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_revoke_product_flow_stage_authorization(UUID, TEXT, TEXT, TEXT, UUID)
  TO service_role;

-- =============================================================================
-- REVERT (ordem reversa; executar manualmente apenas na instância local isolada)
-- =============================================================================
-- REVOKE EXECUTE ON FUNCTION public.admin_revoke_product_flow_stage_authorization(UUID, TEXT, TEXT, TEXT, UUID) FROM service_role;
-- DROP FUNCTION IF EXISTS public.admin_revoke_product_flow_stage_authorization(UUID, TEXT, TEXT, TEXT, UUID);
-- REVOKE EXECUTE ON FUNCTION public.admin_grant_product_flow_stage_authorization(UUID, TEXT, TEXT, TEXT, TEXT, UUID) FROM service_role;
-- DROP FUNCTION IF EXISTS public.admin_grant_product_flow_stage_authorization(UUID, TEXT, TEXT, TEXT, TEXT, UUID);
-- DROP TRIGGER IF EXISTS trg_product_flow_stage_authorizations_immutable ON public.product_flow_stage_authorizations;
-- DROP FUNCTION IF EXISTS public.trg_product_flow_stage_authorizations_immutable_fn();
-- DROP POLICY IF EXISTS "Service role can read/insert product flow stage authorizations" ON public.product_flow_stage_authorizations;
-- DROP TABLE IF EXISTS public.product_flow_stage_authorizations;
