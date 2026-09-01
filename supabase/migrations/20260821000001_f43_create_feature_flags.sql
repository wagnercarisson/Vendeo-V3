-- Migration F43: feature_flags + admin_update_feature_flag RPC + CHECKs de auditoria
-- Revisão do Brief Pré-Geração (D5) — flag administrativa mínima de reativação da
-- validação IA produto×imagem (InputValidationService) mesmo com a revisão humana
-- confirmada. Persistência na tabela feature_flags (NÃO env var).
--
-- Segurança:
--   * Escrita/leitura apenas via API server-side (supabaseAdmin, service_role) —
--     sem RLS policy exposta a anon/authenticated (leitura via serviço dedicado,
--     precedente OperationCostService).
--   * RPC admin_update_feature_flag é SECURITY DEFINER e faz update + audit log na
--     MESMA transação (auditoria atômica — sem mutação sem trilha, precedente
--     admin_review_access_request).
--   * motivo obrigatório (p_reason não vazio) — nunca deriva de input não validado.
--   * CHECKs de admin_audit_log estendidos via DROP/ADD preservando valores
--     existentes (precedente 20260810010000_create_access_requests.sql).

-- =============================================================================
-- 1. Tabela feature_flags (greenfield)
--    id UUID PK obrigatório — admin_audit_log.target_id é UUID NOT NULL; a
--    auditoria referencia feature_flags.id, não a key.
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.feature_flags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT UNIQUE NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT false,
  description TEXT,
  updated_by UUID NULL REFERENCES auth.users(id),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.feature_flags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role can manage feature flags"
  ON public.feature_flags
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

REVOKE ALL ON TABLE public.feature_flags FROM anon;
REVOKE ALL ON TABLE public.feature_flags FROM authenticated;
REVOKE ALL ON TABLE public.feature_flags FROM service_role;

GRANT SELECT, INSERT, UPDATE
ON TABLE public.feature_flags
TO service_role;

-- =============================================================================
-- 2. Seed da flag force_brief_vision_check (enabled=false, padrão recomendado)
--    Idempotente — ON CONFLICT (key) DO NOTHING.
-- =============================================================================
INSERT INTO public.feature_flags (key, enabled, description)
VALUES (
  'force_brief_vision_check',
  false,
  'Quando ligada, o Vendeo executa novamente a validacao por IA das imagens mesmo depois da revisao humana do brief. Use apenas para diagnostico, auditoria ou se houver suspeita de que campanhas problematicas estao passando pela revisao humana.'
)
ON CONFLICT (key) DO NOTHING;

-- =============================================================================
-- 3. RPC admin_update_feature_flag
--    Atomic: UPDATE feature_flags + INSERT admin_audit_log na mesma transação.
--    SECURITY DEFINER + search_path vazio (padrão F38 / access_requests).
--    Idempotente via operation_id (índice único em admin_audit_log.operation_id).
-- =============================================================================
CREATE OR REPLACE FUNCTION public.admin_update_feature_flag(
  p_key TEXT,
  p_enabled BOOLEAN,
  p_reason TEXT,
  p_actor_id UUID,
  p_operation_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_flag_id UUID;
  v_old_enabled BOOLEAN;
BEGIN
  -- Motivo obrigatório — nunca deriva de input não validado
  IF p_key IS NULL OR btrim(p_key) = '' THEN
    RAISE EXCEPTION 'missing_key';
  END IF;

  IF p_reason IS NULL OR btrim(p_reason) = '' THEN
    RAISE EXCEPTION 'missing_reason';
  END IF;

  IF p_operation_id IS NULL THEN
    RAISE EXCEPTION 'missing_operation_id';
  END IF;

  -- Idempotência: se esta operação já foi auditada, retorna o resultado anterior
  -- sem re-aplicar (precedente operation_id único em admin_audit_log).
  IF EXISTS (
    SELECT 1 FROM public.admin_audit_log
    WHERE operation_id = p_operation_id AND action = 'feature_flag_update'
  ) THEN
    RETURN jsonb_build_object('success', true, 'idempotent', true);
  END IF;

  -- Busca a flag — target_id da auditoria é feature_flags.id (UUID NOT NULL)
  SELECT id, enabled INTO v_flag_id, v_old_enabled
  FROM public.feature_flags
  WHERE key = p_key;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'flag_not_found';
  END IF;

  -- Passo 1: atualiza o estado da flag na mesma transação
  UPDATE public.feature_flags
  SET enabled = p_enabled,
      updated_by = p_actor_id,
      updated_at = now()
  WHERE id = v_flag_id;

  -- Passo 2: trilha de auditoria na MESMA transação
  -- Se qualquer um falhar, nada é aplicado (ROLLBACK automático do bloco).
  INSERT INTO public.admin_audit_log (actor_id, action, target_type, target_id, reason, operation_id, metadata)
  VALUES (
    p_actor_id,
    'feature_flag_update',
    'feature_flag',
    v_flag_id,
    p_reason,
    p_operation_id,
    jsonb_build_object(
      'key', p_key,
      'old_value', v_old_enabled,
      'new_value', p_enabled,
      'reason', p_reason
    )
  );

  RETURN jsonb_build_object('success', true, 'id', v_flag_id, 'key', p_key, 'enabled', p_enabled);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.admin_update_feature_flag(TEXT, BOOLEAN, TEXT, UUID, UUID)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_update_feature_flag(TEXT, BOOLEAN, TEXT, UUID, UUID)
  TO service_role;

-- =============================================================================
-- 4. Estender CHECKs do admin_audit_log (padrão F33/F42 — DROP/ADD preservando
--    valores existentes)
-- =============================================================================
ALTER TABLE public.admin_audit_log
  DROP CONSTRAINT IF EXISTS admin_audit_log_action_check;

ALTER TABLE public.admin_audit_log
  ADD CONSTRAINT admin_audit_log_action_check
  CHECK (action IN (
    'credit_grant', 'credit_adjustment', 'store_create_invite', 'manual_refund',
    'approve_verification', 'reject_verification', 'create_test_store',
    'admin_exception', 'reveal_cnpj',
    'access_request_approve', 'access_request_reject',
    'feature_flag_update'
  ));

ALTER TABLE public.admin_audit_log
  DROP CONSTRAINT IF EXISTS admin_audit_log_target_type_check;

ALTER TABLE public.admin_audit_log
  ADD CONSTRAINT admin_audit_log_target_type_check
  CHECK (target_type IN ('store', 'user', 'campaign', 'access_request', 'feature_flag'));

-- =============================================================================
-- REVERT (reverse order of creation)
-- =============================================================================
-- ALTER TABLE public.admin_audit_log DROP CONSTRAINT IF EXISTS admin_audit_log_target_type_check;
-- ALTER TABLE public.admin_audit_log ADD CONSTRAINT admin_audit_log_target_type_check
--   CHECK (target_type IN ('store', 'user', 'campaign', 'access_request'));
-- ALTER TABLE public.admin_audit_log DROP CONSTRAINT IF EXISTS admin_audit_log_action_check;
-- ALTER TABLE public.admin_audit_log ADD CONSTRAINT admin_audit_log_action_check
--   CHECK (action IN (
--     'credit_grant', 'credit_adjustment', 'store_create_invite', 'manual_refund',
--     'approve_verification', 'reject_verification', 'create_test_store',
--     'admin_exception', 'reveal_cnpj',
--     'access_request_approve', 'access_request_reject'
--   ));
-- REVOKE EXECUTE ON FUNCTION public.admin_update_feature_flag(TEXT, BOOLEAN, TEXT, UUID, UUID) FROM service_role;
-- DROP FUNCTION IF EXISTS public.admin_update_feature_flag(TEXT, BOOLEAN, TEXT, UUID, UUID);
-- DELETE FROM public.feature_flags WHERE key = 'force_brief_vision_check';
-- REVOKE SELECT, INSERT, UPDATE ON TABLE public.feature_flags FROM service_role;
-- DROP POLICY IF EXISTS "Service role can manage feature flags" ON public.feature_flags;
-- ALTER TABLE public.feature_flags DISABLE ROW LEVEL SECURITY;
-- DROP TABLE IF EXISTS public.feature_flags CASCADE;