-- Grant service_role permissions on legal-related tables.
-- These tables were created in Phase 30 with RLS policies for service_role
-- but were missing explicit table-level GRANT statements.
-- Without these GRANTs, service_role queries return "permission denied"
-- which is silently caught by getCurrentVersion() returning null,
-- causing requireLegalClearance() to short-circuit and allow all generations.

-- legal_document_versions
REVOKE ALL ON TABLE public.legal_document_versions FROM anon;
REVOKE ALL ON TABLE public.legal_document_versions FROM authenticated;
REVOKE ALL ON TABLE public.legal_document_versions FROM service_role;

GRANT USAGE ON SCHEMA public TO service_role;

GRANT SELECT, INSERT
ON TABLE public.legal_document_versions
TO service_role;

-- legal_acceptances
REVOKE ALL ON TABLE public.legal_acceptances FROM anon;
REVOKE ALL ON TABLE public.legal_acceptances FROM authenticated;
REVOKE ALL ON TABLE public.legal_acceptances FROM service_role;

GRANT SELECT, INSERT
ON TABLE public.legal_acceptances
TO service_role;

-- privacy_acknowledgements
REVOKE ALL ON TABLE public.privacy_acknowledgements FROM anon;
REVOKE ALL ON TABLE public.privacy_acknowledgements FROM authenticated;
REVOKE ALL ON TABLE public.privacy_acknowledgements FROM service_role;

GRANT SELECT, INSERT
ON TABLE public.privacy_acknowledgements
TO service_role;

-- user_consent_events
REVOKE ALL ON TABLE public.user_consent_events FROM anon;
REVOKE ALL ON TABLE public.user_consent_events FROM authenticated;
REVOKE ALL ON TABLE public.user_consent_events FROM service_role;

GRANT SELECT, INSERT
ON TABLE public.user_consent_events
TO service_role;

-- REVERT (combined):
-- REVOKE SELECT, INSERT ON TABLE public.user_consent_events FROM service_role;
-- REVOKE SELECT, INSERT ON TABLE public.privacy_acknowledgements FROM service_role;
-- REVOKE SELECT, INSERT ON TABLE public.legal_acceptances FROM service_role;
-- REVOKE SELECT, INSERT ON TABLE public.legal_document_versions FROM service_role;
