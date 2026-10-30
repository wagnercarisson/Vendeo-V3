-- Publicação legal F50 (D13) — Termos v1.5, Privacidade v1.4, Uso Aceitável v1.2.
-- Migration SEPARADA da migration estrutural (20260920000001). NÃO publica docs legais
-- na estrutural; esta migration é APLICADA APENAS NA PUBLICAÇÃO, após a revisão do
-- responsável e a revisão jurídica, com as condições de publicação atendidas.
--
-- Conteúdo (delta consolidado em public/docs/legal/):
--   - terms_of_service v1.5: teste gratuito de 28 dias desde a conclusão do onboarding;
--     quatro parcelas de 5 créditos nos dias 0, 7, 14 e 21; máximo de 20 créditos;
--     vencimento comum ao final; elegibilidade individual por CNPJ completo; sem
--     renovação ou cobrança automática; política de ofertas prospectiva, com preservação
--     dos ciclos iniciados e sem prazo fixo de 30 dias; acesso após expiração sem
--     encerramento automático da conta; janela de 24h para estorno após vencimento;
--     identificação da PJ (14.7).
--   - privacy_policy v1.4: identificação da PJ; CNPJ completo, elegibilidade e registros
--     da oferta; eventos do teste e parcelas; papéis controlador/operador; inventário de
--     fornecedores (Gemini condicional/lab); retenção com janela de 30 dias; remissão ao
--     Anexo de Transferências Internacionais; petição à ANPD e reclamação consumerista;
--     nova ciência distinta de consentimento de marketing.
--   - acceptable_use v1.2: terminologia do Teste Gratuito de 28 Dias; critérios por CNPJ
--     completo; salvaguarda de filiais legitimamente elegíveis; reaceite substancial;
--     ofertas observam a cláusula 6.1 dos Termos.
--
-- Reaceite: terms v1.5 + acceptable_use v1.2 são CONTRATUAIS (requireLegalClearance,
-- CAPABILITY_DOCUMENTS.content_generation, getAcceptanceStatus = outdated → gate 403 →
-- /legal/reaccept, grava em legal_acceptances) e alcançam todos os usuários abrangidos,
-- inclusive beta testers. privacy_policy v1.4 é CIÊNCIA por usuário
-- (PrivacyGate/privacy_acknowledgements), distinta de consentimento de marketing.
-- A obrigação de reaceite da versão vigente permanece. O gate técnico de aceite antes
-- de iniciar a oferta será tratado em etapa separada e não é bloqueio documental
-- automático desta publicação. Nenhum gate bloqueia histórico/campanhas/downloads.
--
-- Idempotente: ON CONFLICT (document_type, version) DO UPDATE (padrão
-- 20260731000004 / 20260817000001). Sem DDL/DROP/ALTER.

INSERT INTO public.legal_document_versions (document_type, version, summary, effective_at)
VALUES
  (
    'terms_of_service',
    'v1.5',
    'Teste Gratuito de 28 dias desde a conclusao do onboarding: quatro parcelas de 5 creditos nos dias 0, 7, 14 e 21, que podem acumular dentro do ciclo, maximo de 20 creditos e vencimento comum, sem transferencia para novo ciclo; elegibilidade individual por CNPJ completo, com salvaguarda de filiais legitimamente elegiveis; sem renovacao ou cobranca automatica; politica de ofertas prospectiva, com preservacao dos creditos concedidos e dos ciclos iniciados, sem prazo fixo de 30 dias e sem renovacao futura; comunicacao previa com antecedencia razoavel; excecoes imediatas por fraude, abuso, erro material, obrigacao legal, seguranca ou impossibilidade tecnica/operacional relevante justificada, sem tratar conveniencia comercial como impossibilidade; acesso apos expiracao sem encerramento automatico da conta; janela de 24h para estorno apos vencimento; reaceite obrigatorio da v1.5 inclusive por beta testers; identificacao da PJ (14.7).',
    now()
  ),
  (
    'privacy_policy',
    'v1.4',
    'Identificacao da PJ (Controlador e Contato); CNPJ completo, elegibilidade e registros do Teste Gratuito de 28 dias, inclusive parcelas e vencimento; comunicacoes operacionais por email distintas de marketing; eventos de produto descritos sem nomes internos; papeis de controlador/operador; inventario de fornecedores (Gemini condicional/restrito ao laboratorio); retencao com janela de 30 dias no encerramento; remissao ao Anexo de Transferencias Internacionais, que integra a Politica; direito de peticao a ANPD e reclamacao aos orgaos de defesa do consumidor; nova ciencia da v1.4 inclusive por beta testers, distinta de consentimento de marketing.',
    now()
  ),
  (
    'acceptable_use',
    'v1.2',
    'Terminologia do Teste Gratuito de 28 dias; criterios de elegibilidade, validade, parcelas, vencimento e controle de creditos por CNPJ completo; proibicao de multiplicar beneficios com salvaguarda de filiais legitimamente elegiveis; reaceite substancial inclusive por beta testers; ofertas e beneficios gratuitos observam a clausula 6.1 dos Termos, com preservacao dos ciclos iniciados.',
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
