-- Migration QCW (quick 260821-qcw): seeds de flags operacionais
-- Ajustes de controles operacionais — flag de captcha + controles de geração
-- movidos para Controles operacionais (feature_flags).
--
-- APENAS seeds idempotentes na tabela feature_flags existente (migration F43,
-- 20260821000001) — sem mudança de schema nem de RPC. O RPC
-- admin_update_feature_flag já é genérico por key (flag_not_found se key
-- ausente) e audita atomically com action=feature_flag_update.
--
-- Segurança:
--   * Seeds ON CONFLICT (key) DO NOTHING — reaplicar a migration não altera
--     estado já gerenciado pelo admin.
--   * captcha_enabled seed `true`: captcha ON por padrão — aplicar a migration
--     NUNCA desliga o envio de captchaToken por acidente (paridade do
--     comportamento de produção; login/signup/recuperação seguem exigindo
--     token quando o Supabase Auth está com CAPTCHA habilitado).
--   * campaign_generation_enabled / visual_signature_generation_enabled seed
--     `true`: geração ON por padrão (F38 D5 fail-open — falha de leitura
--     também nunca desliga geração).

-- =============================================================================
-- 1. Seeds idempotentes
-- =============================================================================
INSERT INTO public.feature_flags (key, enabled, description)
VALUES (
  'captcha_enabled',
  true,
  'Controla se o Vendeo exibe o Turnstile e envia captchaToken nos fluxos de login, cadastro e recuperacao de senha. Nao altera a configuracao de CAPTCHA do Supabase Auth; se ela estiver ligada no Supabase, o Auth continuara exigindo token valido.'
)
ON CONFLICT (key) DO NOTHING;

INSERT INTO public.feature_flags (key, enabled, description)
VALUES (
  'campaign_generation_enabled',
  true,
  'Habilita a geracao de campanhas (POST /api/campaign/generate-image). Quando desligada, a operacao fica indisponivel (503).'
)
ON CONFLICT (key) DO NOTHING;

INSERT INTO public.feature_flags (key, enabled, description)
VALUES (
  'visual_signature_generation_enabled',
  true,
  'Habilita a geracao de assinatura visual (generate-without-logo). Quando desligada, a operacao fica indisponivel (503).'
)
ON CONFLICT (key) DO NOTHING;

-- =============================================================================
-- REVERT (reverse order of creation)
-- =============================================================================
-- DELETE FROM public.feature_flags WHERE key IN (
--   'captcha_enabled',
--   'campaign_generation_enabled',
--   'visual_signature_generation_enabled'
-- );