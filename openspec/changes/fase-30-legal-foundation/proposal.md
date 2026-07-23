## Why

V1.5 está completa com 987+ testes passando — o Vendeo está tecnicamente pronto para receber lojistas reais. Porém, não existe fundação jurídica alguma: Termos de Uso, Política de Privacidade, Política de Uso Aceitável ou mecanismo de aceite/ciência documentado. Lojistas podem se cadastrar, criar loja e gerar campanhas sem nunca ter contato com documentos legais, expondo o projeto a riscos de uso indevido, responsabilidade sobre conteúdo gerado, ausência de base legal LGPD, falta de política de suspensão/reembolso e zero trilha de auditoria de ciência/aceite.

## What Changes

- **Documentos legais draft** em `docs/legal/` — Termos de Uso v1.0, Política de Privacidade v1.0 (LGPD), Uso Aceitável v1.0 (com ressalva de revisão jurídica pendente)
- **Páginas públicas** `/termos`, `/privacidade`, `/uso-aceitavel` — renderizadas a partir do conteúdo versionado
- **5 novas migrations**: `legal_document_versions`, `privacy_acknowledgements`, `legal_acceptances`, `user_consent_events`, `seed_legal_document_versions_v1`
- **Seed v1.0** dos documentos legais na tabela `legal_document_versions`
- **Duas camadas jurídicas**: ciência de privacidade no signup (`privacy_acknowledgements`) + aceite contratual no onboarding (`legal_acceptances`)
- **Checkbox obrigatório** "Declaro ciência da Política de Privacidade" no formulário de signup
- **Checkbox opcional** "Aceito receber comunicações comerciais" no signup (consentimento LGPD destacável)
- **Checkbox obrigatório** "Li e aceito os Termos de Uso e a Política de Uso Aceitável" no formulário de criação de loja
- **`requireLegalClearance(capability)`** — guard central que verifica aceite contratual vigente antes de liberar funcionalidades protegidas (content_generation)
- **Re-aceite contratual** quando versão dos documentos mudar — bloqueio operacional (não absoluto) com tela `/legal/reaccept`
- **Acesso mínimo sem aceite**: docs legais, suporte, conta e cancelamento livres; geração, VS e exportações bloqueadas
- **Admin**: badges de status de ciência, consentimento e aceite em `/admin/users/[id]`
- **RPC atômica** `create_store_with_legal_acceptance` — cria loja + registra aceites + concede créditos em uma transação
- **Modelo append-only** para consentimento de comunicações (`user_consent_events`) — auditável, com suporte a grant/revoke
- **Flag `privacy_policy` NÃO incluída** no guard de capabilities — ciência é verificada no signup, não no pipeline

## Capabilities

### New Capabilities

- `legal-documents`: Drafts dos 3 documentos legais + páginas públicas versionadas
- `privacy-acknowledgement`: Registro de ciência da Política de Privacidade no signup (user-level, upsert por user_id)
- `legal-clearance`: `requireLegalClearance({ storeId, userId, capability })` — guard extensível por capability que verifica aceite contratual vigente
- `legal-acceptance-service`: Registro, consulta de status e histórico de aceites contratuais (store-level)
- `consent-management`: Coleta, consulta e revogação de consentimento LGPD para comunicações comerciais (append-only, auditável)
- `legal-document-versions`: Versionamento semântico de documentos legais com funções `getCurrentVersion()`, `getVersionHistory()`, `isVersionCurrent()`
- `re-aceite-flow`: Tela de re-aceite contratual com sumário de mudanças, bloqueio operacional de capabilities até re-aceite
- `admin-legal-status`: Badges e histórico de ciência/aceite/consentimento por lojista em `/admin/users/[id]`
- `atomic-store-creation`: RPC `create_store_with_legal_acceptance` que cria loja + registra aceites + concede créditos em transação única

### Modified Capabilities

- `store-onboarding`: Formulário `store-identity-form.tsx` ganha checkbox de aceite contratual (visível apenas na criação)
- `auth-signup`: Formulário `signup-form.tsx` ganha 2 checkboxes (ciência de privacidade obrigatório + consentimento comunicações opcional)
- `campaign-generate`: Rota `POST /api/campaign/generate-image` passa a verificar `requireLegalClearance({ capability: "content_generation" })` antes de rate limit e saldo check
- `visual-signature`: Modal de aprovação de assinatura visual ganha verificação `requireLegalClearance()` no início
- `admin-operations`: Página `/admin/users/[id]` ganha cards de status de ciência, consentimento e aceite
- `user-account`: Página `/conta` ganha seção de status legal e toggle de consentimento comercial
- `store-api`: Rota `POST /api/store` substitui RPC existente pela nova `create_store_with_legal_acceptance` com parâmetros de versão, IP e UA

## Impact

- **Documentos novos:** 3 drafts legais em `docs/legal/`
- **5 novas migrations** em `supabase/migrations/` (4 tabelas + 1 seed)
- **Módulo `src/lib/legal/`** com 6 arquivos de service + 5 arquivos de teste
- **Arquivos novos:** 7 páginas/rotas (termos, privacidade, uso-aceitavel, re-aceite + 4 API routes)
- **5 formulários modificados** (signup, store-identity, generate-image, VS approval, conta)
- **2 rotas admin modificadas** (user detail page, admin layout)
- **1 RPC existente substituída** (`create_store_with_initial_grant` → `create_store_with_legal_acceptance`)
- **35+ testes novos** — privacy (3), consent (3), clearance (6), acceptance (5), document versions (3), signup+onboarding (6), re-aceite (3), admin (4), regressão (2)
- **Middleware ajustado** — rotas legais adicionadas à lista de free routes
- **Dependências:** F26 (admin layout, admin gate), F8 (signup flow), F19 (onboarding flow), F25 (pipeline route), F4.4 (VS approval)
