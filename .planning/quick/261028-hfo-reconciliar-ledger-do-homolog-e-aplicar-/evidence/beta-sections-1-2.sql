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
  ADD COLUMN IF NOT EXISTS invite_attempt_token UUID,
  ADD COLUMN IF NOT EXISTS invited_user_id UUID,
  ADD COLUMN IF NOT EXISTS password_set_at TIMESTAMPTZ;

COMMENT ON COLUMN public.access_requests.invite_status IS
  'Estado do envio do convite: not_sent | sending | sent | failed | unconfirmed | account_active.';
COMMENT ON COLUMN public.access_requests.invite_sent_at IS
  'Instante em que o provedor de e-mail aceitou a mensagem. Não significa entrega.';
COMMENT ON COLUMN public.access_requests.invite_provider_message_id IS
  'Id da mensagem no provedor (Resend). Nunca contém token/hash.';
COMMENT ON COLUMN public.access_requests.invite_locked_until IS
  'Lease atômico contra envios concorrentes; expira sozinho.';
COMMENT ON COLUMN public.access_requests.invite_attempt_token IS
  'Token da tentativa que detém o lease. Finalização só aplica se o token ainda for o atual.';
COMMENT ON COLUMN public.access_requests.invited_user_id IS
  'Usuário criado pelo convite (auth.users.id), quando aplicável.';
COMMENT ON COLUMN public.access_requests.password_set_at IS
  'Instante em que o usuário concluiu a definição de senha. NULL após aceitar o convite = cadastro incompleto (retomável).';

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
