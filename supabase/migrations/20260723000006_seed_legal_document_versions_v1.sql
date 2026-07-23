-- Migration: Seed v1.0 of legal documents
-- Idempotent: ON CONFLICT DO NOTHING

INSERT INTO public.legal_document_versions (document_type, version, summary)
VALUES
  ('terms_of_service', 'v1.0', 'Versão inicial dos Termos de Uso'),
  ('privacy_policy', 'v1.0', 'Versão inicial da Política de Privacidade'),
  ('acceptable_use', 'v1.0', 'Versão inicial da Política de Uso Aceitável')
ON CONFLICT (document_type, version) DO NOTHING;

-- REVERT
-- DELETE FROM public.legal_document_versions WHERE version = 'v1.0';
