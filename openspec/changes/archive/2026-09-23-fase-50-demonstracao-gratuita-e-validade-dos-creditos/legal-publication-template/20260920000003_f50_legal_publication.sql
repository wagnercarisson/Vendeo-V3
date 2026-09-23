-- Publicação legal F50 (D13) — Termos v1.5, Privacidade v1.4, Uso Aceitável v1.2.
-- Migration SEPARADA da migration estrutural (20260920000001). NÃO publica docs legais
-- na estrutural; esta migration é APLICADA APENAS NO CORTE (50-14), após a identificação
-- da PJ e a validação jurídica formal das três minutas (gate de corte).
--
-- Conteúdo (delta consolidado em public/docs/legal/):
--   - terms_of_service v1.5: substitui o freemium contínuo por Demonstração Gratuita
--     (10 créditos, 168h, irrepetível por raiz de CNPJ); sem bônus mensais automáticos;
--     sem cobrança/cartão; ordem de consumo demo→bônus→comprado; expiração; graça de 24h;
--     reaceite obrigatório da v1.5 sem bloquear histórico; identificação do fornecedor (12.4).
--   - privacy_policy v1.4: identificação da PJ (Controlador e Contato); email operacional
--     distinto de marketing; eventos de produto sem nomes internos; WhatsApp opcional;
--     papéis controlador/operador; inventário de fornecedores (Gemini condicional/lab);
--     retenção com janela de 30 dias no encerramento.
--   - acceptable_use v1.2: terminologia "Demonstração Gratuita"; proibição de conteúdo
--     ilegal/abusivo/exploratório e imagens de menores sem autorização; reaceite substancial.
--
-- Reaceite: terms v1.5 + acceptable_use v1.2 são CONTRATUAIS (requireLegalClearance,
-- CAPABILITY_DOCUMENTS.content_generation, getAcceptanceStatus = outdated → gate 403 →
-- /legal/reaccept, grava em legal_acceptances). privacy_policy v1.4 é CIÊNCIA por usuário
-- (PrivacyGate/privacy_acknowledgements). Nenhum gate bloqueia histórico/campanhas/downloads.
--
-- Idempotente: ON CONFLICT (document_type, version) DO UPDATE (padrão
-- 20260731000004 / 20260817000001). Sem DDL/DROP/ALTER.

INSERT INTO public.legal_document_versions (document_type, version, summary, effective_at)
VALUES
  (
    'terms_of_service',
    'v1.5',
    'Demonstracao Gratuita no lugar do freemium continuo: 10 creditos validos por 168h (7 dias), irrepetivel por raiz de CNPJ; fim dos creditos mensais automaticos; sem compra, assinatura ou cobranca automatica; ordem de consumo demonstracao→bonus→comprado; expiracao e janela de graca de 24h; reaceite obrigatorio da v1.5 sem bloquear historico/campanhas/downloads; identificacao do fornecedor (12.4).',
    now()
  ),
  (
    'privacy_policy',
    'v1.4',
    'Identificacao da PJ (Controlador e Contato); comunicacoes operacionais por email distintas de marketing; eventos de produto descritos sem nomes internos; WhatsApp opcional na solicitacao de acesso com descarte; papeis de controlador/operador; inventario de fornecedores (Gemini condicional/restrito ao laboratorio); retencao com janela de 30 dias no encerramento.',
    now()
  ),
  (
    'acceptable_use',
    'v1.2',
    'Terminologia Demonstracao Gratuita; proibicao de conteudo ilegal/abusivo/exploratorio e imagens de pessoas/menores sem autorizacao; reaceite substancial.',
    now()
  )
ON CONFLICT (document_type, version)
DO UPDATE SET
  summary = EXCLUDED.summary,
  effective_at = EXCLUDED.effective_at;

-- REVERT
-- DELETE FROM public.legal_document_versions WHERE document_type = 'terms_of_service' AND version = 'v1.5';
-- DELETE FROM public.legal_document_versions WHERE document_type = 'privacy_policy' AND version = 'v1.4';
-- DELETE FROM public.legal_document_versions WHERE document_type = 'acceptable_use' AND version = 'v1.2';
