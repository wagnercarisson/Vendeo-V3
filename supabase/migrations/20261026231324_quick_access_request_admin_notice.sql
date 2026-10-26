-- =============================================================================
-- Quick 261026 — aviso interno de nova solicitação de acesso
-- Migration: 20261026231324_quick_access_request_admin_notice.sql
--
-- APLICAÇÃO PENDENTE DE AUTORIZAÇÃO. Preparada para homolog e produção.
--
-- Escopo mínimo (sem nova tabela/RPC/cron):
--   * estado durável do aviso em access_requests.admin_notice_*;
--   * mesmo padrão de lease/attempt_token do convite existente;
--   * histórico permanece NULL (nenhum backfill/notificação retroativa).
--
-- Segurança:
--   * nenhum token/credencial/conteúdo de e-mail é persistido;
--   * provider_message_id é o id da mensagem no Resend (não é token);
--   * RLS/GRANTs existentes continuam valendo (service_role only).
-- =============================================================================

ALTER TABLE public.access_requests
  ADD COLUMN IF NOT EXISTS admin_notice_status TEXT,
  ADD COLUMN IF NOT EXISTS admin_notice_sent_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS admin_notice_last_attempt_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS admin_notice_attempts INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS admin_notice_error TEXT,
  ADD COLUMN IF NOT EXISTS admin_notice_provider_message_id TEXT,
  ADD COLUMN IF NOT EXISTS admin_notice_locked_until TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS admin_notice_attempt_token UUID;

COMMENT ON COLUMN public.access_requests.admin_notice_status IS
  'Aviso interno ao administrador: NULL (histórico/não agendado) | pending | sending | sent | failed | unconfirmed | suppressed.';
COMMENT ON COLUMN public.access_requests.admin_notice_sent_at IS
  'Instante em que o Resend ACEITOU a mensagem. Não significa entrega confirmada.';
COMMENT ON COLUMN public.access_requests.admin_notice_last_attempt_at IS
  'Início da última tentativa de aviso.';
COMMENT ON COLUMN public.access_requests.admin_notice_attempts IS
  'Tentativas FINALIZADAS (máximo 3).';
COMMENT ON COLUMN public.access_requests.admin_notice_error IS
  'Código seguro da última falha (ex.: timeout, provider_http_500, email_disabled). Nunca corpo bruto do provider.';
COMMENT ON COLUMN public.access_requests.admin_notice_provider_message_id IS
  'Id da mensagem no Resend. Não contém token/credencial.';
COMMENT ON COLUMN public.access_requests.admin_notice_locked_until IS
  'Lease atômico contra envios concorrentes; expira sozinho.';
COMMENT ON COLUMN public.access_requests.admin_notice_attempt_token IS
  'Token da tentativa que detém o lease; finalização só aplica se ainda for o atual.';

ALTER TABLE public.access_requests
  DROP CONSTRAINT IF EXISTS chk_access_requests_admin_notice_status;

ALTER TABLE public.access_requests
  ADD CONSTRAINT chk_access_requests_admin_notice_status
  CHECK (
    admin_notice_status IS NULL
    OR admin_notice_status IN (
      'pending', 'sending', 'sent', 'failed', 'unconfirmed', 'suppressed'
    )
  );

ALTER TABLE public.access_requests
  DROP CONSTRAINT IF EXISTS chk_access_requests_admin_notice_attempts;

ALTER TABLE public.access_requests
  ADD CONSTRAINT chk_access_requests_admin_notice_attempts
  CHECK (admin_notice_attempts >= 0);

ALTER TABLE public.access_requests
  DROP CONSTRAINT IF EXISTS chk_access_requests_admin_notice_error_length;

ALTER TABLE public.access_requests
  ADD CONSTRAINT chk_access_requests_admin_notice_error_length
  CHECK (admin_notice_error IS NULL OR char_length(admin_notice_error) <= 300);

-- =============================================================================
-- Recuperação (forward-only; manual)
-- =============================================================================
-- REVERT manual (opcional; NÃO é critério automático de qualidade):
--   ALTER TABLE public.access_requests
--     DROP CONSTRAINT IF EXISTS chk_access_requests_admin_notice_error_length,
--     DROP CONSTRAINT IF EXISTS chk_access_requests_admin_notice_attempts,
--     DROP CONSTRAINT IF EXISTS chk_access_requests_admin_notice_status,
--     DROP COLUMN IF EXISTS admin_notice_attempt_token,
--     DROP COLUMN IF EXISTS admin_notice_locked_until,
--     DROP COLUMN IF EXISTS admin_notice_provider_message_id,
--     DROP COLUMN IF EXISTS admin_notice_error,
--     DROP COLUMN IF EXISTS admin_notice_attempts,
--     DROP COLUMN IF EXISTS admin_notice_last_attempt_at,
--     DROP COLUMN IF EXISTS admin_notice_sent_at,
--     DROP COLUMN IF EXISTS admin_notice_status;
