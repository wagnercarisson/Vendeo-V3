-- Migration: access_requests + admin_review_access_request RPC
-- Landing pública de beta fechado — visitantes solicitam acesso free.
--
-- Segurança:
--   * Escrita/leitura apenas via API server-side (supabaseAdmin, service_role).
--   * RLS habilitado com policy exclusiva para service_role — anon/authenticated
--     não têm acesso direto (anti-enumeração e anti-tampering da lista).
--   * Índice único parcial lower(email) impede duplicatas pending/approved
--     mesmo com case variado; rejected permite re-solicitação.
--   * RPC admin_review_access_request é SECURITY DEFINER e faz status + audit
--     log na MESMA transação (auditoria atômica — sem mutação sem trilha).

-- =============================================================================
-- 1. Tabela access_requests
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.access_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL,
  name TEXT,
  store_name TEXT,
  segment TEXT,
  whatsapp TEXT,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'rejected')),
  source TEXT NOT NULL DEFAULT 'landing',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  reviewed_at TIMESTAMPTZ,
  reviewed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  notes TEXT
);

ALTER TABLE public.access_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role can manage access requests"
  ON public.access_requests
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

REVOKE ALL ON TABLE public.access_requests FROM anon;
REVOKE ALL ON TABLE public.access_requests FROM authenticated;
REVOKE ALL ON TABLE public.access_requests FROM service_role;

GRANT SELECT, INSERT, UPDATE
ON TABLE public.access_requests
TO service_role;

-- =============================================================================
-- 2. Índices
-- =============================================================================
CREATE INDEX IF NOT EXISTS idx_access_requests_status
  ON public.access_requests (status, created_at DESC);

-- Anti-duplicidade: um email só pode ter 1 solicitação ativa (pending/approved).
-- Blinda inserções manuais/admin com case variado via lower(email).
-- rejected sai do índice → permite re-solicitação após recusa.
CREATE UNIQUE INDEX IF NOT EXISTS uq_access_requests_email_active
  ON public.access_requests (lower(email))
  WHERE status IN ('pending', 'approved');

-- =============================================================================
-- 3. RPC admin_review_access_request
-- Atomic: UPDATE status + INSERT admin_audit_log na mesma transação.
-- SECURITY DEFINER + search_path vazio (padrão F38).
-- =============================================================================
CREATE OR REPLACE FUNCTION public.admin_review_access_request(
  p_request_id UUID,
  p_action TEXT,
  p_actor_id UUID,
  p_notes TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_status TEXT;
  v_email TEXT;
  v_new_status TEXT;
  v_audit_action TEXT;
  v_reason TEXT;
BEGIN
  -- Validação de ação — nunca deriva de input não validado
  IF p_action NOT IN ('approve', 'reject') THEN
    RAISE EXCEPTION 'invalid_action';
  END IF;

  -- Busca a solicitação
  SELECT status, email INTO v_status, v_email
  FROM public.access_requests
  WHERE id = p_request_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'request_not_found';
  END IF;

  -- Guarda de re-revisão — uma solicitação é revisada uma única vez
  IF v_status <> 'pending' THEN
    RAISE EXCEPTION 'already_reviewed';
  END IF;

  IF p_action = 'approve' THEN
    v_new_status := 'approved';
    v_audit_action := 'access_request_approve';
    v_reason := COALESCE(p_notes, 'Aprovado via admin');
  ELSE
    v_new_status := 'rejected';
    v_audit_action := 'access_request_reject';
    v_reason := COALESCE(p_notes, 'Recusado via admin');
  END IF;

  -- Passo 1: muda o status + campos de revisão
  UPDATE public.access_requests
  SET status = v_new_status,
      reviewed_at = now(),
      reviewed_by = p_actor_id,
      notes = COALESCE(p_notes, notes)
  WHERE id = p_request_id;

  -- Passo 2: trilha de auditoria na MESMA transação
  -- Se qualquer um falhar, nada é aplicado (ROLLBACK automático do bloco).
  INSERT INTO public.admin_audit_log (actor_id, action, target_type, target_id, reason, metadata)
  VALUES (
    p_actor_id,
    v_audit_action,
    'access_request',
    p_request_id,
    v_reason,
    jsonb_build_object('email', v_email, 'action', p_action)
  );

  RETURN jsonb_build_object('success', true, 'status', v_new_status, 'email', v_email);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.admin_review_access_request(UUID, TEXT, UUID, TEXT)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_review_access_request(UUID, TEXT, UUID, TEXT)
  TO service_role;

-- =============================================================================
-- 4. Estender CHECKs do admin_audit_log (padrão F33)
-- =============================================================================
ALTER TABLE public.admin_audit_log
  DROP CONSTRAINT IF EXISTS admin_audit_log_action_check;

ALTER TABLE public.admin_audit_log
  ADD CONSTRAINT admin_audit_log_action_check
  CHECK (action IN (
    'credit_grant', 'credit_adjustment', 'store_create_invite', 'manual_refund',
    'approve_verification', 'reject_verification', 'create_test_store',
    'admin_exception', 'reveal_cnpj',
    'access_request_approve', 'access_request_reject'
  ));

ALTER TABLE public.admin_audit_log
  DROP CONSTRAINT IF EXISTS admin_audit_log_target_type_check;

ALTER TABLE public.admin_audit_log
  ADD CONSTRAINT admin_audit_log_target_type_check
  CHECK (target_type IN ('store', 'user', 'campaign', 'access_request'));

-- =============================================================================
-- REVERT (reverse order of creation)
-- =============================================================================
-- ALTER TABLE public.admin_audit_log DROP CONSTRAINT IF EXISTS admin_audit_log_target_type_check;
-- ALTER TABLE public.admin_audit_log ADD CONSTRAINT admin_audit_log_target_type_check
--   CHECK (target_type IN ('store', 'user', 'campaign'));
-- ALTER TABLE public.admin_audit_log DROP CONSTRAINT IF EXISTS admin_audit_log_action_check;
-- ALTER TABLE public.admin_audit_log ADD CONSTRAINT admin_audit_log_action_check
--   CHECK (action IN (
--     'credit_grant', 'credit_adjustment', 'store_create_invite', 'manual_refund',
--     'approve_verification', 'reject_verification', 'create_test_store',
--     'admin_exception', 'reveal_cnpj'
--   ));
-- REVOKE EXECUTE ON FUNCTION public.admin_review_access_request(UUID, TEXT, UUID, TEXT) FROM service_role;
-- DROP FUNCTION IF EXISTS public.admin_review_access_request(UUID, TEXT, UUID, TEXT);
-- DROP INDEX IF EXISTS uq_access_requests_email_active;
-- DROP INDEX IF EXISTS idx_access_requests_status;
-- REVOKE SELECT, INSERT, UPDATE ON TABLE public.access_requests FROM service_role;
-- DROP POLICY IF EXISTS "Service role can manage access requests" ON public.access_requests;
-- ALTER TABLE public.access_requests DISABLE ROW LEVEL SECURITY;
-- DROP TABLE IF EXISTS public.access_requests CASCADE;
