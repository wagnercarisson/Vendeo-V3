-- Publish legal document versions for the controlled public signup phase (F42).
-- terms_of_service v1.4 and privacy_policy v1.3 become the current versions as of now().
-- acceptable_use v1.1 is NOT republished (unchanged in F42).
--
-- Content changes (D12):
--   - terms_of_service v1.4: clause 3.1 no longer limited to invited users; public free
--     access with eligibility criteria; third-party (Google OAuth) authentication.
--   - privacy_policy v1.3: no longer "beta, free and closed"; captcha (Cloudflare
--     Turnstile) + email confirmation; third-party auth with data used exclusively
--     for authentication.
--
-- Users who accepted a previous version will see acceptanceStatus: "outdated"
-- and will be prompted to re-accept via /legal/reaccept before using generation
-- features (tolerance: no store loses access on publish — fail-closed only on
-- protected features). The content documents live at public/docs/legal/ and
-- resolve via the document-content.ts catalog.
--
-- NOTE: if the rollout requires re-acceptance before go-live, change `now()` below
-- to a future date BEFORE deploying so the versions become effective at that point.
--
-- Idempotent: ON CONFLICT (document_type, version) DO UPDATE (pattern
-- 20260731000004_publish_legal_beta_freemium_versions.sql). No DDL/DROP/ALTER —
-- legal_acceptances (store-level Terms/AUP) and acceptance-service.ts are untouched.

INSERT INTO public.legal_document_versions (document_type, version, summary, effective_at)
VALUES
  (
    'terms_of_service',
    'v1.4',
    'Acesso publico gratuito com elegibilidade: clausula 3.1 sem limitacao a usuarios convidados; criterios de liberacao (analise cadastral, CNAE x segmento); autenticacao por terceiros (Google OAuth) com finalidade exclusivamente autenticacional.',
    now()
  ),
  (
    'privacy_policy',
    'v1.3',
    'Fim do beta fechado: captcha Cloudflare Turnstile; confirmacao de email no cadastro; autenticacao por terceiros (Google) com dados exclusivamente autenticacionais (identificador, email, nome, avatar), sem permissoes sobre Gmail/Drive.',
    now()
  )
ON CONFLICT (document_type, version)
DO UPDATE SET
  summary = EXCLUDED.summary,
  effective_at = EXCLUDED.effective_at;

-- REVERT
-- DELETE FROM public.legal_document_versions WHERE document_type = 'terms_of_service' AND version = 'v1.4';
-- DELETE FROM public.legal_document_versions WHERE document_type = 'privacy_policy' AND version = 'v1.3';