-- =============================================================================
-- Quick 261020-n20 — Fluxo de convite do beta
-- Migration: estado do convite em access_requests + auditoria do envio.
--
-- Escopo:
--   1. Colunas de acompanhamento do convite em public.access_requests.
--   2. CHECK de invite_status (enviado ao provedor ≠ entregue).
--   3. Extensão do CHECK de action em admin_audit_log:
--      nova action 'access_request_invite' (preserva TODOS os valores anteriores).
--
-- Segurança:
--   * Nenhum token/hash é persistido — apenas o id da mensagem no provedor.
--   * Nenhuma alteração em RLS/GRANTs: acesso continua exclusivo de service_role.
--   * Nenhuma migration destrutiva; colunas aditivas.
-- =============================================================================

-- =============================================================================
-- 1. Colunas de acompanhamento do convite
-- =============================================================================
ALTER TABLE public.access_requests
  ADD COLUMN IF NOT EXISTS invite_status TEXT NOT NULL DEFAULT 'not_sent',
  ADD COLUMN IF NOT EXISTS invite_sent_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS invite_last_attempt_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS invite_attempts INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS invite_error TEXT,
  ADD COLUMN IF NOT EXISTS invite_provider_message_id TEXT,
  ADD COLUMN IF NOT EXISTS invite_locked_until TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS invited_user_id UUID;

COMMENT ON COLUMN public.access_requests.invite_status IS
  'Estado do envio do convite: not_sent | sending | sent | failed | unconfirmed | account_active.';
COMMENT ON COLUMN public.access_requests.invite_sent_at IS
  'Instante em que o provedor de e-mail aceitou a mensagem. Não significa entrega.';
COMMENT ON COLUMN public.access_requests.invite_provider_message_id IS
  'Id da mensagem no provedor (Resend). Nunca contém token/hash.';
COMMENT ON COLUMN public.access_requests.invite_locked_until IS
  'Lease atômico contra envios concorrentes; expira sozinho.';
COMMENT ON COLUMN public.access_requests.invited_user_id IS
  'Usuário criado pelo convite (auth.users.id), quando aplicável.';

-- =============================================================================
-- 2. CHECK de invite_status
-- =============================================================================
ALTER TABLE public.access_requests
  DROP CONSTRAINT IF EXISTS chk_access_requests_invite_status;

ALTER TABLE public.access_requests
  ADD CONSTRAINT chk_access_requests_invite_status
  CHECK (invite_status IN (
    'not_sent', 'sending', 'sent', 'failed', 'unconfirmed', 'account_active'
  ));

-- =============================================================================
-- 3. Auditoria: estende o CHECK de action (preserva todos os valores anteriores)
-- =============================================================================
ALTER TABLE public.admin_audit_log
  DROP CONSTRAINT IF EXISTS admin_audit_log_action_check;

ALTER TABLE public.admin_audit_log
  ADD CONSTRAINT admin_audit_log_action_check
  CHECK (action IN (
    'credit_grant', 'credit_adjustment', 'store_create_invite', 'manual_refund',
    'approve_verification', 'reject_verification', 'create_test_store', 'admin_exception',
    'reveal_cnpj', 'access_request_approve', 'access_request_reject', 'feature_flag_update',
    'ai_model_selection_update', 'ai_model_selection_reset', 'support_credit_request_update',
    'data_subject_request_received', 'data_subject_request_in_progress',
    'data_subject_request_completed', 'data_subject_request_cancelled',
    'data_subject_request_cancel_rejected',
    'image_model_pair_config_update',
    'product_1_1_pending_resolution',
    'access_request_invite'
  ));

-- =============================================================================
-- REVERT (ordem inversa)
-- =============================================================================
-- ALTER TABLE public.admin_audit_log DROP CONSTRAINT IF EXISTS admin_audit_log_action_check;
-- ALTER TABLE public.admin_audit_log ADD CONSTRAINT admin_audit_log_action_check
--   CHECK (action IN (
--     'credit_grant', 'credit_adjustment', 'store_create_invite', 'manual_refund',
--     'approve_verification', 'reject_verification', 'create_test_store', 'admin_exception',
--     'reveal_cnpj', 'access_request_approve', 'access_request_reject', 'feature_flag_update',
--     'ai_model_selection_update', 'ai_model_selection_reset', 'support_credit_request_update',
--     'data_subject_request_received', 'data_subject_request_in_progress',
--     'data_subject_request_completed', 'data_subject_request_cancelled',
--     'data_subject_request_cancel_rejected',
--     'image_model_pair_config_update',
--     'product_1_1_pending_resolution'
--   ));
-- ALTER TABLE public.access_requests DROP CONSTRAINT IF EXISTS chk_access_requests_invite_status;
-- ALTER TABLE public.access_requests
--   DROP COLUMN IF EXISTS invited_user_id,
--   DROP COLUMN IF EXISTS invite_locked_until,
--   DROP COLUMN IF EXISTS invite_provider_message_id,
--   DROP COLUMN IF EXISTS invite_error,
--   DROP COLUMN IF EXISTS invite_attempts,
--   DROP COLUMN IF EXISTS invite_last_attempt_at,
--   DROP COLUMN IF EXISTS invite_sent_at,
--   DROP COLUMN IF EXISTS invite_status;
