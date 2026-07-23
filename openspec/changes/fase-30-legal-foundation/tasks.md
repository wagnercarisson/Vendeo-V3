## 1. Migrations — Legal Tables + Helpers + Seed

- [ ] 1.1 Criar `supabase/migrations/20260723000001_create_legal_document_versions.sql`: tabela com document_type, version, published_at, effective_at, summary; UNIQUE(document_type, version); CHECK document_type IN ('terms_of_service', 'privacy_policy', 'acceptable_use'); NÃO criar funções auxiliares aqui (as tabelas que elas consultam ainda não existem)
- [ ] 1.2 Criar `supabase/migrations/20260723000002_create_privacy_acknowledgements.sql`: tabela com PK user_id, privacy_policy_version, acknowledged_at, ip_address, user_agent; RLS habilitado; policy INSERT/UPDATE service role, SELECT own
- [ ] 1.3 Criar `supabase/migrations/20260723000003_create_legal_acceptances.sql`: tabela com id, store_id FK, accepted_by_user_id FK, document_type CHECK, document_version, accepted_at, ip_address, user_agent, acceptance_source CHECK; UNIQUE(store_id, accepted_by_user_id, document_type, document_version); RLS habilitado; RPC `create_store_with_legal_acceptance` com REVOKE/GRANT EXECUTE TO service_role
- [ ] 1.4 Criar `supabase/migrations/20260723000004_create_user_consent_events.sql`: tabela append-only com id, user_id, consent_type CHECK, action CHECK (granted/revoked), occurred_at, policy_version, ip_address, user_agent, source CHECK; RLS habilitado; CREATE INDEX idx_user_consent_events_user
- [ ] 1.5 Criar `supabase/migrations/20260723000005_create_legal_helpers.sql`: funções SQL `has_valid_acceptance(store_id, document_type)` e `has_valid_privacy_acknowledgement(user_id)` — migration separada APÓS todas as tabelas (00001-00004) porque ambas consultam tabelas que só existem após as migrations anteriores
- [ ] 1.6 Criar `supabase/migrations/20260723000006_seed_legal_document_versions_v1.sql`: INSERT v1.0 de terms_of_service, privacy_policy, acceptable_use com summaries (após helpers)
- [ ] 1.7 Executar migrations localmente e verificar schema: tabelas existem, constraints, RLS ativo, funções compilam, seed populado

## 2. Legal Document Drafts — docs/legal/

- [ ] 2.1 Criar `docs/legal/terms-of-service-v1.md`: draft de Termos de Uso v1.0 (inclui Uso Aceitável por referência) com ressalva de revisão jurídica
- [ ] 2.2 Criar `docs/legal/privacy-policy-v1.md`: draft de Política de Privacidade v1.0 com bases legais LGPD mapeadas por finalidade, direitos do titular, retenção
- [ ] 2.3 Criar `docs/legal/acceptable-use-v1.md`: draft de Uso Aceitável v1.0 com restrições de conteúdo, conduta proibida, sansões

## 3. Core Library — Types e Services

- [ ] 3.1 Criar `src/lib/legal/types.ts`: tipos `LegalCapability` ('content_generation'), `DocumentType` ('terms_of_service', 'privacy_policy', 'acceptable_use'), `AcceptanceSource` ('onboarding', 'login_reacceptance', 'admin_invite'), `ConsentType` ('commercial_communications'), interfaces para PrivacyAcknowledgement, AcceptanceRecord, ConsentEvent, ClearanceParams, ClearanceResult
- [ ] 3.2 Criar `src/lib/legal/document-versions.ts`: funções `getCurrentVersion(documentType)`, `getVersionHistory(documentType)`, `isVersionCurrent(documentType, version)` — consultam legal_document_versions via supabaseAdmin
- [ ] 3.3 Criar `src/lib/legal/privacy.ts`: funções `registerPrivacyAcknowledgement(params)` com upsert, `hasValidPrivacyAcknowledgement(userId)` com comparação de versão vigente
- [ ] 3.4 Criar `src/lib/legal/consent.ts`: funções `recordConsentEvent(params)` append-only, `getEffectiveConsent(userId, consentType)` consulta último evento, `revokeConsent(userId, consentType)` insere revoked
- [ ] 3.5 Criar `src/lib/legal/acceptance-service.ts`: funções `registerAcceptance(params)` com resolução de versão e idempotência, `registerAllContractAcceptances(params)` para ambos documentos, `getAcceptanceStatus(storeId, documentType)`, `getStoreAcceptanceHistory(storeId)`
- [ ] 3.6 Criar `src/lib/legal/clearance.ts`: função `requireLegalClearance({ storeId, userId, capability })` com mapa CAPABILITY_DOCUMENTS, verificação por documento, retorno padronizado; `hasValidAcceptance(storeId, docType)` interna; CAPABILITY_TREE para sub-capabilities futuras

## 4. Public Legal Pages — /termos, /privacidade, /uso-aceitavel

- [ ] 4.1 Criar `src/app/(marketing)/termos/page.tsx`: server component, renderiza conteúdo dos Termos de Uso, mostra versão vigente e data de efetivação, link para markdown
- [ ] 4.2 Criar `src/app/(marketing)/privacidade/page.tsx`: server component, renderiza Política de Privacidade com bases legais mapeadas
- [ ] 4.3 Criar `src/app/(marketing)/uso-aceitavel/page.tsx`: server component, renderiza Política de Uso Aceitável

## 5. API Routes — Legal Endpoints

- [ ] 5.1 Criar `src/app/api/legal/acknowledge-privacy/route.ts`: POST /api/legal/acknowledge-privacy, recebe `{ communicationsOptIn: boolean }` do client, resolve versão vigente server-side via `getCurrentVersion("privacy_policy")` (NÃO aceita version vindo do client), resolve IP/UA do request, chama `registerPrivacyAcknowledgement()` + opcional `recordConsentEvent()` se communicationsOptIn, retorna 200
- [ ] 5.2 Criar `src/app/api/legal/communications-consent/route.ts`: POST /api/legal/communications-consent, recebe action (granted/revoked) e source ('signup' | 'account_settings'), chama recordConsentEvent(), retorna 200
- [ ] 5.3 Criar `src/app/api/legal/accept/route.ts`: POST /api/legal/accept, recebe storeId, documentTypes, source, resolve versão, chama registerAcceptance(), retorna 200
- [ ] 5.4 Criar `src/app/api/legal/status/route.ts`: GET /api/legal/status, retorna { privacyAcknowledged, effectiveConsent, acceptanceStatus } para o usuário/loja autenticado

## 6. RPC Atômica — create_store_with_legal_acceptance

- [ ] 6.1 Criar RPC `create_store_with_legal_acceptance()` na migration 1.3 ou migration separada: encapsula INSERT store (incluindo logo_url) + 2x INSERT legal_acceptances + PERFORM `grant_credits(v_store_id, p_initial_grant_amount, 'onboarding', 'onboarding_' || v_store_id, '{}'::jsonb, 'bonus_onboarding')` (6 args: store_id, amount, reason, idempotency_key, metadata, type) em transação única
- [ ] 6.2 Substituir chamada em `src/app/api/store/route.ts`: handler POST passa a chamar a nova RPC com parâmetros de versão (resolvidos server-side via `getCurrentVersion()`), IP, UA e `logo_url`; aceitar campo `acceptedTerms: boolean` no body; validar aceite antes de chamar RPC

## 7. Signup Form — Privacy + Communications Consent

- [ ] 7.1 Modificar `src/app/(auth)/signup/signup-form.tsx`: adicionar checkbox obrigatório "Declaro ciência da Política de Privacidade" com link para /privacidade; validar no submit; bloquear se não marcado
- [ ] 7.2 Adicionar checkbox opcional "Aceito receber comunicações comerciais do Vendeo" com link; separado visualmente; não bloqueante
- [ ] 7.3 Após signup bem-sucedido: salvar `{ privacyAcknowledged: true, communicationsOptIn: boolean }` em `sessionStorage` — NÃO chamar POST /api/legal/acknowledge-privacy agora (não há sessão JWT)
- [ ] 7.4 Criar `src/components/legal/privacy-recovery.tsx`: client component que renderiza no layout autenticado, verifica sessionStorage no primeiro acesso, chama POST /api/legal/acknowledge-privacy COM sessão JWT (requireUser extrai userId de claims.sub)
- [ ] 7.5 O endpoint POST /api/legal/acknowledge-privacy resolve a versão vigente, exige requireUser(), userId de claims.sub (nunca do body), registra privacy_acknowledgements + opcionalmente user_consent_events

## 8. Store Identity Form — Acceptance Checkbox

- [ ] 8.1 Modificar `src/components/flow/store-identity-form.tsx`: adicionar checkbox obrigatório "Li e aceito os Termos de Uso e a Política de Uso Aceitável" com links; visível apenas em modo criação (não edição)
- [ ] 8.2 Validar checkbox antes do submit de criação: bloquear se não marcado com mensagem "Você precisa aceitar os Termos de Uso e a Política de Uso Aceitável."
- [ ] 8.3 Client envia apenas `acceptedTerms: true`; o handler server-side resolve as versões vigentes via `getCurrentVersion()` antes de chamar a RPC (evita version spoofing)

## 9. Pipeline Guard — requireLegalClearance no generate-image

- [ ] 9.1 Modificar `src/app/api/campaign/generate-image/route.ts`: adicionar `requireLegalClearance({ storeId, userId, capability: "content_generation" })` no início do pré-stream, ANTES do rate limit e saldo check
- [ ] 9.2 Se clearance falhar: retornar HTTP 403 com JSON padronizado (message, reason, requiredDocuments, acceptUrl: "/legal/reaccept")

## 10. Visual Signature Guard — requireLegalClearance no VS

**Nota:** `visual-signature-approval-modal.tsx` é `"use client"` — não pode chamar `requireLegalClearance` diretamente (usa supabaseAdmin/service role). O guard é aplicado em duas camadas:

- [ ] 10.1 **Camada autoritativa (API route):** Modificar `src/app/api/store/[id]/visual-signature/generate-without-logo/route.ts` — adicionar `requireLegalClearance({ storeId, userId, capability: "content_generation" })` ANTES de qualquer operação de geração. Se clearance falhar, retornar HTTP 403 com JSON padronizado (message, reason, requiredDocuments, acceptUrl)
- [ ] 10.2 **Camada UX (client):** Modificar `src/components/flow/visual-signature-approval-modal.tsx` — consultar `GET /api/legal/status` ANTES de iniciar o fluxo de geração. Se `acceptanceStatus !== "current"`, exibir estado de bloqueio com mensagem e link para `/legal/reaccept`; não prosseguir com geração
- [ ] 10.3 Se clearance falhar na API (camada 1): retornar 403 antes de qualquer operação paga
- [ ] 10.4 Se clearance falhar no client (camada 2): exibir estado de bloqueio com link para /legal/reaccept; não chamar API de geração

## 11. Re-aceite Flow — /legal/reaccept

- [ ] 11.1 Criar `src/app/(app)/legal/reaccept/page.tsx`: server component que detecta pending documents, exibe sumário de mudanças, botão "Aceitar nova versão" e "Revisar documento"
- [ ] 11.2 Criar `src/app/(app)/legal/reaccept/reaccept-form.tsx`: client component com botão de aceite, chama POST /api/legal/accept com source='login_reacceptance', redireciona após sucesso
- [ ] 11.3 Implementar detecção de documentos pendentes: consulta acceptance status por store, compara com versão vigente

## 12. Conta Page — Legal Status Section

- [ ] 12.1 Modificar `src/app/(app)/conta/page.tsx`: adicionar seção "Privacidade e Termos" com status de ciência de privacidade, consentimento comercial (com toggle), aceite contratual (com link para re-aceite se pendente)
- [ ] 12.2 Implementar toggle de consentimento comercial: chamar POST /api/legal/communications-consent com action grant/revoke, atualizar UI otimisticamente

## 13. Admin — Legal Status Badges

- [ ] 13.1 Modificar `src/app/(app)/admin/users/[id]/page.tsx`: adicionar card "Situação Legal" com badges de privacidade ("✅ Ciente"/"❌ Não registrado"), aceite contratual ("✅ Vigente"/"⏳ Pendente"/"❌ Nunca aceitou"), consentimento comercial ("✅ Ativo"/"⏳ Revogado"/"❌ Nunca definido")
- [ ] 13.2 Adicionar detalhamento por documento com versão, data, usuário, IP, UA
- [ ] 13.3 Adicionar histórico de aceites ordenado por accepted_at DESC
- [ ] 13.4 Estender `AdminUserSummary` com campos legais: privacyAcknowledged, legalAcceptanceStatus, communicationsConsent

## 14. Middleware — Free Routes for Legal Pages

- [ ] 14.1 Modificar `src/middleware.ts`: adicionar `/termos`, `/privacidade`, `/uso-aceitavel` como rotas livres de auth (públicas, sem sessão); `/legal/reaccept` requer auth mas middleware permite a rota passar; `/api/legal/acknowledge-privacy` e `/api/legal/accept` requerem auth (protegidas por middleware ou pelo handler); `/api/legal/status` requer auth e não é livre

## 15. Testes — Privacy Acknowledgement

- [ ] 15.1 Criar `src/lib/legal/__tests__/privacy.test.ts`: 3+ testes — register com dados válidos, upsert idempotente mesma versão, hasValid sem registro → false

## 16. Testes — Communications Consent

- [ ] 16.1 Criar `src/lib/legal/__tests__/consent.test.ts`: 3+ testes — opt-in não bloqueia signup, recusa não bloqueia signup, revoga via /conta insere revoked + getEffectiveConsent retorna revoked

## 17. Testes — Clearance Guard

- [ ] 17.1 Criar `src/lib/legal/__tests__/clearance.test.ts`: 6+ testes — todos aceitos → ok true, termo pendente → ok false com doc específico, todos pendentes → ok false, capability desconhecida → ok true, store sem aceite → ok false, após re-aceite → ok true

## 18. Testes — Acceptance Service

- [ ] 18.1 Criar `src/lib/legal/__tests__/acceptance-service.test.ts`: 5+ testes — register válido, mesma versão idempotente, sem versão publicada → erro, getAcceptanceStatus current, getAcceptanceStatus outdated

## 19. Testes — Document Versions

- [ ] 19.1 Criar `src/lib/legal/__tests__/document-versions.test.ts`: 3+ testes — getCurrentVersion com versão publicada, sem versão → null, isVersionCurrent true/false

## 20. Testes — Signup + Onboarding Integration

- [ ] 20.1 Criar testes de integração: signup sem ciência bloqueado, signup com ciência salva pendência em sessionStorage (não chama POST sem sessão), signup com opt-in salva communicationsOptIn em sessionStorage, primeiro acesso autenticado com pendência → POST /api/legal/acknowledge-privacy registra privacy_acknowledgements + consentimento, onboarding sem aceite bloqueado, onboarding com aceite → RPC atômica completa, legal_acceptances com source='onboarding'

## 21. Testes — Re-aceite

- [ ] 21.1 Criar testes: versão desatualizada → false, re-aceite → true, histórico anterior preservado

## 22. Testes — Admin Legal Status

- [ ] 22.1 Criar testes: admin vê badge de privacidade, admin vê badge de consentimento, admin vê badge de aceite, admin vê histórico ordenado

## 23. Testes — Regressão

- [ ] 23.1 Criar testes: geração com clearance ok → pipeline prossegue, geração sem clearance → 403 antes de qualquer operação

## 24. Verificação Final

- [ ] 24.1 Executar `npx vitest run` — 35+ novos + ~987 existentes passando
- [ ] 24.2 Executar `npm run typecheck` — zero erros
- [ ] 24.3 Executar `npm run lint` — zero erros
- [ ] 24.4 Executar `npm run build` — build bem-sucedido
- [ ] 24.5 UAT local: signup com e sem checkboxes (privacidade obriga, comunicações opcional)
- [ ] 24.6 UAT local: criação de loja com e sem aceite
- [ ] 24.7 UAT local: geração bloqueada sem aceite → 403 com link para /legal/reaccept
- [ ] 24.8 UAT local: re-aceite desbloqueia geração
- [ ] 24.9 UAT local: /termos, /privacidade, /uso-aceitavel acessíveis sem auth
- [ ] 24.10 UAT local: admin vê badges legais em /admin/users/[id]
