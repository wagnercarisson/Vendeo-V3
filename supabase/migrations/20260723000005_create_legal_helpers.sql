-- Migration: Create legal helper functions
-- Runs after all legal tables exist (00001-00004) and before seed (00006)

-- Returns true if user has acknowledged the current privacy_policy version
CREATE OR REPLACE FUNCTION public.has_valid_privacy_acknowledgement(p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.privacy_acknowledgements pa
    WHERE pa.user_id = p_user_id
      AND pa.privacy_policy_version = (
        SELECT version FROM public.legal_document_versions
        WHERE document_type = 'privacy_policy'
          AND effective_at <= now()
        ORDER BY effective_at DESC
        LIMIT 1
      )
  );
$$;

REVOKE EXECUTE ON FUNCTION public.has_valid_privacy_acknowledgement(UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.has_valid_privacy_acknowledgement(UUID) TO service_role;

-- Returns true if store has accepted the current version of the specified document type
CREATE OR REPLACE FUNCTION public.has_valid_acceptance(p_store_id UUID, p_document_type TEXT)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.legal_acceptances la
    WHERE la.store_id = p_store_id
      AND la.document_type = p_document_type
      AND la.document_version = (
        SELECT version FROM public.legal_document_versions
        WHERE document_type = p_document_type
          AND effective_at <= now()
        ORDER BY effective_at DESC
        LIMIT 1
      )
  );
$$;

REVOKE EXECUTE ON FUNCTION public.has_valid_acceptance(UUID, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.has_valid_acceptance(UUID, TEXT) TO service_role;

-- REVERT
-- DROP FUNCTION IF EXISTS public.has_valid_privacy_acknowledgement(UUID) CASCADE;
-- DROP FUNCTION IF EXISTS public.has_valid_acceptance(UUID, TEXT) CASCADE;
