-- Grant UPDATE on privacy_acknowledgements to service_role.
-- Migration 00008 granted SELECT, INSERT but registerPrivacyAcknowledgement
-- uses supabaseAdmin.from("privacy_acknowledgements").upsert() which
-- requires UPDATE permission when the row already exists (onConflict: "user_id").
-- Without this, the Privacy Gate post-login flow fails with "permission denied".

GRANT UPDATE
ON TABLE public.privacy_acknowledgements
TO service_role;

-- REVERT
-- REVOKE UPDATE ON TABLE public.privacy_acknowledgements FROM service_role;
