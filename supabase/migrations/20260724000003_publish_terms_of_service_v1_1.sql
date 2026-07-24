-- Publish Terms of Service v1.1
-- Only affects terms_of_service — acceptable_use and privacy_policy remain at v1.0.
--
-- Users who accepted v1.0 will see acceptanceStatus: "outdated" for terms_of_service
-- and will be prompted to re-accept via /legal/reaccept before using generation features.
--
-- The content document lives at docs/legal/terms-of-service-v1-1.md.
-- Public page /termos resolves the correct reference file via document-content.ts catalog.

INSERT INTO public.legal_document_versions (document_type, version, summary, effective_at)
VALUES (
  'terms_of_service',
  'v1.1',
  'Revisão editorial e organizacional dos Termos de Uso — clareza, estrutura e referências atualizadas.',
  now()
)
ON CONFLICT (document_type, version)
DO UPDATE SET
  summary = EXCLUDED.summary,
  effective_at = EXCLUDED.effective_at;

-- REVERT
-- DELETE FROM public.legal_document_versions WHERE document_type = 'terms_of_service' AND version = 'v1.1';
