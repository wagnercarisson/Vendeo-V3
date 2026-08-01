-- Publish legal document versions for the beta freemium phase.
-- terms_of_service v1.3, privacy_policy v1.2, acceptable_use v1.1
-- become the current versions as of now().
--
-- Users who accepted a previous version will see acceptanceStatus: "outdated"
-- and will be prompted to re-accept via /legal/reaccept before using generation features.
-- The content documents live at docs/legal/ and resolve via the document-content.ts catalog.

INSERT INTO public.legal_document_versions (document_type, version, summary, effective_at)
VALUES
  (
    'terms_of_service',
    'v1.3',
    'Beta fechado freemium: creditos promocionais, licenca operacional de materiais, IA, responsabilidades, encerramento do beta e funcionalidades pagas futuras.',
    now()
  ),
  (
    'privacy_policy',
    'v1.2',
    'Fornecedores e operadores de dados, provedores de IA, transferencia internacional, bases legais, direitos LGPD, seguranca e retencao.',
    now()
  ),
  (
    'acceptable_use',
    'v1.1',
    'Publicidade enganosa, ofertas sem disponibilidade razoavel, de/por sem preco real, direitos de terceiros, categorias sensiveis e creditos promocionais.',
    now()
  )
ON CONFLICT (document_type, version)
DO UPDATE SET
  summary = EXCLUDED.summary,
  effective_at = EXCLUDED.effective_at;

-- REVERT
-- DELETE FROM public.legal_document_versions WHERE document_type = 'terms_of_service' AND version = 'v1.3';
-- DELETE FROM public.legal_document_versions WHERE document_type = 'privacy_policy' AND version = 'v1.2';
-- DELETE FROM public.legal_document_versions WHERE document_type = 'acceptable_use' AND version = 'v1.1';
