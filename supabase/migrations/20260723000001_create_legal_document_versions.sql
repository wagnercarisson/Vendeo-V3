-- Migration: Create legal_document_versions table
-- Stores versioned legal documents (terms_of_service, privacy_policy, acceptable_use)

CREATE TABLE public.legal_document_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_type TEXT NOT NULL CHECK (document_type IN ('terms_of_service', 'privacy_policy', 'acceptable_use')),
  version TEXT NOT NULL,
  published_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  effective_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  summary TEXT,
  UNIQUE(document_type, version)
);

ALTER TABLE public.legal_document_versions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role can manage legal document versions"
  ON public.legal_document_versions
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- REVERT
-- DROP TABLE IF EXISTS public.legal_document_versions CASCADE;
