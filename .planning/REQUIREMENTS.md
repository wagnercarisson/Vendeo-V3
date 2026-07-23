# Requirements: Vendeo V3

**Defined:** 2026-07-15
**Core Value:** Gerar uma campanha profissional de Produto + Oferta que o lojista tenha confiança de publicar e que ajude a vender mais.

## v1 Requirements — Lançamento Externo Controlado

### Copy Director (COPY)

- [x] **COPY-01**: TextProvider abstraction layer (createTextProvider, OpenAI implementation)
- [x] **COPY-02**: CopyDirectorService generates title, caption, hashtags, CTA from CopyDirectorInput
- [x] **COPY-03**: Prompt template in `prompts/campaign-copy-director.md` with segment-aware copywriting
- [x] **COPY-04**: Copy Director callable standalone (without image generation)

### Sistema de Créditos (CRED)

- [x] **CRED-01**: credit_balances table with RLS (user can SELECT own balance)
- [x] **CRED-02**: credit_transactions table (append-only, types: grant/purchase/deduction/refund/adjustment)
- [x] **CRED-03**: CreditService with reserveCredit, confirmCredit, refundCredit, grantCredits, getBalance, getHistory
- [x] **CRED-04**: Balance never negative — every deduction checks balance before executing
- [x] **CRED-05**: Atomic reserve/refund via SQL transactions (SELECT FOR UPDATE or SQL function)

### Pipeline de Geração (PIPE)

- [x] **PIPE-01**: Parallel execution of Copy Director || Image Director in generate-image pipeline
- [x] **PIPE-02**: Rate limit guard (10/h per user, 30/dia) before any paid operation
- [x] **PIPE-03**: Saldo check before pipeline starts; 402 Payment Required if insufficient
- [x] **PIPE-04**: Credit reserve before IA calls; refund on failure; confirm on success
- [x] **PIPE-05**: publication_copy_snapshot populated by Copy Director (replaces deterministic buildCaption/hashtags)
- [x] **PIPE-06**: Timeout abort (120s total) treated as failure with refund

### Admin Operacional (ADMIN)

- [x] **ADMIN-01**: Admin access control — only explicitly authorized users (admin_users table) access admin routes/pages
- [x] **ADMIN-02**: Admin user/store directory — list and search beta users/stores with support data
- [x] **ADMIN-03**: Admin credit grant — manual credit grant with mandatory reason, via RPC admin_grant_credits (encapsula grant_credits + audit log)
- [x] **ADMIN-04**: Admin credit ledger view — view balance and full transaction history of any store/user
- [x] **ADMIN-05**: Admin campaign error review — view errored campaigns with error_message, status, dates
- [x] **ADMIN-06**: Admin audit log — every sensitive admin action recorded with actor, target, action, reason, timestamp

### Conta e Saldo Visível (UI-CREDIT)

- [x] **UI-01**: Credit balance visible in dashboard metrics grid (contextual, not global — D1)
- [x] **UI-02**: Credits section in `/conta` — balance card, transaction history
- [x] **UI-03**: Zero-credit CTA during beta — "Solicitar créditos" / "Fale com o time" (não Stripe)
- [x] **UI-04**: Extrato paginado (credit_transactions history with all types except adjustment)
- [x] **UI-05**: Onboarding grant: 5 free credits on store creation (POST /api/store integration)
- [x] **UI-06**: Zero-credit states: tooltip, disabled button, CTA to request credits — product never blocks entirely

### Créditos Mensais Automáticos (MONTHLY)

- [ ] **MONTHLY-01**: Modelo contábil com buckets — `bonus_balance` + `purchased_balance` em `credit_balances`, `balance` como soma automática via trigger
- [ ] **MONTHLY-02**: Categorias de transação expandidas — `bonus_onboarding`, `bonus_monthly`, `admin_grant`, `purchase` substituem `grant` genérico
- [ ] **MONTHLY-03**: `grant_credits()` bucket-aware com parâmetro `p_type` — direciona ao bucket correto conforme o tipo
- [ ] **MONTHLY-04**: `reserve_credit()` com consumo prioritário — deduz de `bonus_balance` primeiro, `purchased_balance` por último
- [ ] **MONTHLY-05**: `refund_credit()` bucket-aware — restaura `bonus_balance` e `purchased_balance` exatos via metadata; fallback legacy para deductions sem metadata
- [ ] **MONTHLY-06**: `grant_monthly_credits()` RPC — elegibilidade por idade da loja (>= 30 dias), teto de bônus configurável, grant parcial, idempotência por ciclo efetivo de 30 dias, FOR UPDATE SKIP LOCKED
- [ ] **MONTHLY-07**: Launch Config expandido — 4 novas flags: `monthlyCreditsEnabled`, `monthlyCreditsAmount`, `monthlyBonusCap`, `monthlyCreditsMinStoreAgeDays`
- [ ] **MONTHLY-08**: Vercel Cron `GET /api/cron/monthly-credits` — schedule `0 6 * * *`, proteção CRON_SECRET, leitura de Launch Config, execução RPC, logging via `logPipelineEvent()`
- [ ] **MONTHLY-09**: Admin fallback — botão "Executar concessão mensal" + rota `POST /api/admin/monthly-credits/grant` protegida por `requireAdmin`
- [ ] **MONTHLY-10**: Backfill de transações existentes — `grant + onboarding` → `bonus_onboarding`; `grant + outros` → `admin_grant`; `bonus_balance` populado com saldo atual

### Observabilidade e Operação (OPS)

- [x] **OPS-01**: Structured logging in pipeline (traceId, campaignId, phase, duration_ms, status)
- [x] **OPS-02**: IA telemetry (tokens, cost, model, provider) in generation_events
- [x] **OPS-03**: Deploy checklist, rollback process, environment variables documented
- [x] **OPS-04**: Support runbook (manual grant via admin, refund, balance check)
- [x] **OPS-05**: Launch config centralizado — 9 flags (5 originais + 4 mensais) lidas via helper único, zero process.env espalhado
- [x] **OPS-06**: Admin metrics dashboard — /admin/metrics com cards (sucesso, erro, custo, tempo, créditos, estorno, users) + health state banner
- [x] **OPS-07**: AI cost estimator — estimateAiCost() com tabela de preços OpenAI + Gemini
- [x] **OPS-08**: Data retention cleanup (90d) — função SQL versionada + runbook manual; auto-job planejado para D+30
- [x] **OPS-09**: Concurrency test — 2 requests simultâneos, saldo=1, apenas um vence

### Refinamento Visual e Launch Readiness (LAUNCH)

- [/] **LAUNCH-01**: Loading, empty, error states for all new screens/components
  - Refinado por F29.1.2: HistoryModal reescrito com loading/error/empty states + paginação
- [/] **LAUNCH-02**: Insufficient-credit UX across the app (disabled states, tooltips, microcopy)
  - Refinado por F29.1.2: Ações condicionais ao identity_state com tooltips contextuais
- [/] **LAUNCH-03**: Mobile hardening for credit flows (viewport 320–768px, touch targets >=44px)
- [/] **LAUNCH-04**: UAT externo com 3–5 lojistas reais (convite manual, grant admin, geração, saldo, extrato)
- [/] **LAUNCH-05**: Canal de feedback, métricas de saúde, critérios de expansão/pausa documentados
- [/] **LAUNCH-06**: Feature flag active and verified in UAT before milestone close

### Segurança (SEC)

- [ ] **SEC-01**: RLS policies for credit_balances and credit_transactions
- [ ] **SEC-02**: Ownership validation on all /api/credits/* and /api/admin/* routes
- [ ] **SEC-03**: Sanitized inputs to Copy Director (no sensitive data in prompts)
- [ ] **SEC-04**: Admin routes protected by requireAdmin gate — admin_users table, no auth.users flag
- [ ] **SEC-05**: Service role usage reviewed — credit operations use service role only after identity validation
- [ ] **SEC-06**: Admin audit log is append-only; grant without audit trail is treated as failure

## v1.5 Requirements — Fundação Legal (F30)

### Documentos Legais (LEGAL-DOC)

- [ ] **LEGAL-DOC-01**: 3 documentos legais draft em `docs/legal/` — Termos de Uso v1.0, Política de Privacidade v1.0 (LGPD), Uso Aceitável v1.0, com ressalva de revisão jurídica
- [ ] **LEGAL-DOC-02**: Páginas públicas `/termos`, `/privacidade`, `/uso-aceitavel` sem auth, renderizadas do conteúdo versionado
- [ ] **LEGAL-DOC-03**: `legal_document_versions` table com document_type, version, published_at, effective_at, summary; UNIQUE(document_type, version)
- [ ] **LEGAL-DOC-04**: `getCurrentVersion()`, `getVersionHistory()`, `isVersionCurrent()` — consultam legal_document_versions via supabaseAdmin

### Ciência de Privacidade (LEGAL-PRIVACY)

- [ ] **LEGAL-PRIVACY-01**: `privacy_acknowledgements` table (PK user_id, upsert) com RLS
- [ ] **LEGAL-PRIVACY-02**: `registerPrivacyAcknowledgement()` — upsert por user_id, server-side apenas via service role
- [ ] **LEGAL-PRIVACY-03**: `hasValidPrivacyAcknowledgement(userId)` — compara versão vigente
- [ ] **LEGAL-PRIVACY-04**: Checkbox obrigatório "Declaro ciência da Política de Privacidade" no signup
- [ ] **LEGAL-PRIVACY-05**: POST /api/legal/acknowledge-privacy — resolve versão server-side, registra ciência + opcionalmente consentimento

### Aceite Contratual (LEGAL-ACCEPT)

- [ ] **LEGAL-ACCEPT-01**: `legal_acceptances` table com UNIQUE(store_id, accepted_by_user_id, document_type, document_version)
- [ ] **LEGAL-ACCEPT-02**: `registerAcceptance()` — resolve versão automaticamente, idempotente na mesma versão
- [ ] **LEGAL-ACCEPT-03**: `registerAllContractAcceptances()` — registra terms_of_service + acceptable_use
- [ ] **LEGAL-ACCEPT-04**: `getAcceptanceStatus(storeId, documentType)` — current/outdated/never
- [ ] **LEGAL-ACCEPT-05**: `getStoreAcceptanceHistory(storeId)` — histórico ordenado

### Consentimento LGPD (LEGAL-CONSENT)

- [ ] **LEGAL-CONSENT-01**: `user_consent_events` table append-only (granted/revoked), auditável
- [ ] **LEGAL-CONSENT-02**: `recordConsentEvent()` — sempre INSERT, nunca UPDATE/DELETE
- [ ] **LEGAL-CONSENT-03**: `getEffectiveConsent(userId, consentType)` — último evento por occurred_at DESC
- [ ] **LEGAL-CONSENT-04**: Checkbox opcional "Aceito receber comunicações comerciais" no signup (LGPD art. 7º, I)
- [ ] **LEGAL-CONSENT-05**: Toggle de consentimento em `/conta` — revoga/reativa via POST /api/legal/communications-consent

### Guardião Legal (LEGAL-CLEARANCE)

- [ ] **LEGAL-CLEARANCE-01**: `requireLegalClearance({ storeId, userId, capability })` — guard central
- [ ] **LEGAL-CLEARANCE-02**: CAPABILITY_DOCUMENTS map — content_generation → [terms_of_service, acceptable_use]
- [ ] **LEGAL-CLEARANCE-03**: CAPABILITY_TREE — content_generation sub-capabilities (campaigns.create, visual_signatures.create, exports.create)
- [ ] **LEGAL-CLEARANCE-04**: Privacy policy NÃO incluída no guard — verificada no signup
- [ ] **LEGAL-CLEARANCE-05**: Guard no generate-image (pré-stream, antes de rate-limit e saldo)
- [ ] **LEGAL-CLEARANCE-06**: Guard no visual-signature-approval-modal
- [ ] **LEGAL-CLEARANCE-07**: 403 padronizado quando clearance falha: message, reason, requiredDocuments, acceptUrl

### Re-aceite (LEGAL-REACCEPT)

- [ ] **LEGAL-REACCEPT-01**: Tela `/legal/reaccept` com sumário de mudanças e botão "Aceitar nova versão"
- [ ] **LEGAL-REACCEPT-02**: Bloqueio operacional (não absoluto) — docs legais, suporte, conta e cancelamento livres
- [ ] **LEGAL-REACCEPT-03**: Banner não-bloqueante para mudança de privacidade
- [ ] **LEGAL-REACCEPT-04**: Histórico de aceites preservado no re-aceite

### RPC Atômica (LEGAL-RPC)

- [ ] **LEGAL-RPC-01**: `create_store_with_legal_acceptance()` — loja + 2 aceites + grant em transação única
- [ ] **LEGAL-RPC-02**: POST /api/store substituído para usar nova RPC com parâmetros de versão, IP e UA
- [ ] **LEGAL-RPC-03**: Checkbox obrigatório "Li e aceito os Termos de Uso e a Política de Uso Aceitável" no onboarding

### Admin Legal (LEGAL-ADMIN)

- [ ] **LEGAL-ADMIN-01**: AdminUserSummary estendido com privacyAcknowledged, legalAcceptanceStatus, communicationsConsent
- [ ] **LEGAL-ADMIN-02**: Badges legais em `/admin/users/[id]` — privacidade, aceite, consentimento
- [ ] **LEGAL-ADMIN-03**: Detalhamento por documento (versão, data, usuário, IP, UA)
- [ ] **LEGAL-ADMIN-04**: Admin NÃO pode aceitar em nome do lojista (sem bulk_migration)

### Middleware (LEGAL-MIDDLEWARE)

- [ ] **LEGAL-MIDDLEWARE-01**: `/termos`, `/privacidade`, `/uso-aceitavel` como rotas livres de auth
- [ ] **LEGAL-MIDDLEWARE-02**: `/legal/reaccept` requer auth mas passa pelo middleware

## v1.7 Requirements (Stripe / Monetização Pública)

Deferred from v1.5 critical path. Stripe será implementada como F31/v1.7 após validação do beta controlado.

### Pagamento (PAY)

- **PAY-01**: POST /api/credits/create-checkout — Stripe Checkout Session creation
- **PAY-02**: POST /api/webhooks/stripe — process checkout.session.completed with HMAC verification
- **PAY-03**: 3 credit packs (10/25/50) with fixed pricing
- **PAY-04**: CreditService.grant on successful purchase (idempotent)
- **PAY-05**: Asaas/Pix como provedor de pagamento secundário para mercado brasileiro
- **PAY-06**: Planos e assinaturas mensais (créditos recorrentes)

## v2 Requirements

Deferred to future release. Tracked but not in current roadmap.

### Geração

- **PIPE-07**: Cache de prompts / otimização de tokens para redução de custo
- **PIPE-08**: Geração de campanhas multi-formato (Stories, Landscape)

### Expansão

- **SOCIAL-01**: Integração com Instagram API para postagem automática
- **PWA-01**: Install prompt e experiência offline

## Out of Scope

| Feature | Reason |
|---------|--------|
| Planos e assinaturas mensais | Uso livre + créditos avulsos é suficiente para lançamento controlado |
| Múltiplas lojas (1:N) | Relação 1:1 user->store mantida |
| Times / permissões multi-usuário | Single-user |
| Integração com Instagram (API de postagem automática) | Milestone futura |
| Analytics avançado (CTR, impressões, conversão) | Fora do core de geração |
| Editor visual livre (Canva-like) | Geração guiada, não livre |
| PWA / install prompt | Não prioritário para lançamento controlado |
| OAuth social / Magic link | Exclusão deliberada desde v1.2 |
| Campanhas multi-formato (Stories, Landscape) | Apenas 1080x1080 feed |
| Cache de prompts / otimização de tokens | Feature futura de redução de custo |
| Dashboard administrativo avançado | Dashboard operacional mínimo (taxa de sucesso, custo médio, erro rate) está dentro do escopo |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| COPY-01 | Phase 23 | ✅ Complete |
| COPY-02 | Phase 23 | ✅ Complete |
| COPY-03 | Phase 23 | ✅ Complete |
| COPY-04 | Phase 23 | ✅ Complete |
| CRED-01 | Phase 24 | ✅ Complete |
| CRED-02 | Phase 24 | ✅ Complete |
| CRED-03 | Phase 24 | ✅ Complete |
| CRED-04 | Phase 24 | ✅ Complete |
| CRED-05 | Phase 24 | ✅ Complete |
| PIPE-01 | Phase 25 | ✅ Complete |
| PIPE-02 | Phase 25 | ✅ Complete |
| PIPE-03 | Phase 25 | ✅ Complete |
| PIPE-04 | Phase 25 | ✅ Complete |
| PIPE-05 | Phase 25 | ✅ Complete |
| PIPE-06 | Phase 25 | ✅ Complete |
| ADMIN-01 | Phase 26 | ✅ Complete |
| ADMIN-02 | Phase 26 | ✅ Complete |
| ADMIN-03 | Phase 26 | ✅ Complete |
| ADMIN-04 | Phase 26 | ✅ Complete |
| ADMIN-05 | Phase 26 | ✅ Complete |
| ADMIN-06 | Phase 26 | ✅ Complete |
| UI-01 | Phase 27 | ✅ Complete |
| UI-02 | Phase 27 | ✅ Complete |
| UI-03 | Phase 27 | ✅ Complete |
| UI-04 | Phase 27 | ✅ Complete |
| UI-05 | Phase 27 | ✅ Complete |
| UI-06 | Phase 27 | ✅ Complete |
| OPS-01 | Phase 28 | ✅ Complete |
| OPS-02 | Phase 28 | ✅ Complete |
| OPS-03 | Phase 28 | ✅ Complete |
| OPS-04 | Phase 28 | ✅ Complete |
| OPS-05 | Phase 28 | ✅ Complete |
| OPS-06 | Phase 28 | ✅ Complete |
| OPS-07 | Phase 28 | ✅ Complete |
| OPS-08 | Phase 28 | ✅ Complete |
| OPS-09 | Phase 28 | ✅ Complete |
| SEC-04 | Phase 26 | ✅ Complete |
| SEC-06 | Phase 26 | ✅ Complete |
| LAUNCH-01 | Phase 29 | Planning |
| LAUNCH-02 | Phase 29 | Planning |
| LAUNCH-03 | Phase 29 | Planning |
| LAUNCH-04 | Phase 29 | Planning |
| LAUNCH-05 | Phase 29 | Planning |
| LAUNCH-06 | Phase 29 | Planning |
| LEGAL-DOC-01 | Phase 30 | △ Planning |
| LEGAL-DOC-02 | Phase 30 | △ Planning |
| LEGAL-DOC-03 | Phase 30 | △ Planning |
| LEGAL-DOC-04 | Phase 30 | △ Planning |
| LEGAL-PRIVACY-01 | Phase 30 | △ Planning |
| LEGAL-PRIVACY-02 | Phase 30 | △ Planning |
| LEGAL-PRIVACY-03 | Phase 30 | △ Planning |
| LEGAL-PRIVACY-04 | Phase 30 | △ Planning |
| LEGAL-PRIVACY-05 | Phase 30 | △ Planning |
| LEGAL-ACCEPT-01 | Phase 30 | △ Planning |
| LEGAL-ACCEPT-02 | Phase 30 | △ Planning |
| LEGAL-ACCEPT-03 | Phase 30 | △ Planning |
| LEGAL-ACCEPT-04 | Phase 30 | △ Planning |
| LEGAL-ACCEPT-05 | Phase 30 | △ Planning |
| LEGAL-CONSENT-01 | Phase 30 | △ Planning |
| LEGAL-CONSENT-02 | Phase 30 | △ Planning |
| LEGAL-CONSENT-03 | Phase 30 | △ Planning |
| LEGAL-CONSENT-04 | Phase 30 | △ Planning |
| LEGAL-CONSENT-05 | Phase 30 | △ Planning |
| LEGAL-CLEARANCE-01 | Phase 30 | △ Planning |
| LEGAL-CLEARANCE-02 | Phase 30 | △ Planning |
| LEGAL-CLEARANCE-03 | Phase 30 | △ Planning |
| LEGAL-CLEARANCE-04 | Phase 30 | △ Planning |
| LEGAL-CLEARANCE-05 | Phase 30 | △ Planning |
| LEGAL-CLEARANCE-06 | Phase 30 | △ Planning |
| LEGAL-CLEARANCE-07 | Phase 30 | △ Planning |
| LEGAL-REACCEPT-01 | Phase 30 | △ Planning |
| LEGAL-REACCEPT-02 | Phase 30 | △ Planning |
| LEGAL-REACCEPT-03 | Phase 30 | △ Planning |
| LEGAL-REACCEPT-04 | Phase 30 | △ Planning |
| LEGAL-RPC-01 | Phase 30 | △ Planning |
| LEGAL-RPC-02 | Phase 30 | △ Planning |
| LEGAL-RPC-03 | Phase 30 | △ Planning |
| LEGAL-ADMIN-01 | Phase 30 | △ Planning |
| LEGAL-ADMIN-02 | Phase 30 | △ Planning |
| LEGAL-ADMIN-03 | Phase 30 | △ Planning |
| LEGAL-ADMIN-04 | Phase 30 | △ Planning |
| LEGAL-MIDDLEWARE-01 | Phase 30 | △ Planning |
| LEGAL-MIDDLEWARE-02 | Phase 30 | △ Planning |
| SEC-01 | Phase 24-26 | ✅ Complete (F24 RLS, F26 admin) |
| SEC-02 | Phase 25-26 | ✅ Complete (F25 pipeline, F26 admin) |
| SEC-03 | Phase 25 | ✅ Complete (F25 sanitized inputs) |
| SEC-05 | Phase 25 | ✅ Complete (F25 service role) |
| MONTHLY-01 | Phase 29.3 | △ Planning |
| MONTHLY-02 | Phase 29.3 | △ Planning |
| MONTHLY-03 | Phase 29.3 | △ Planning |
| MONTHLY-04 | Phase 29.3 | △ Planning |
| MONTHLY-05 | Phase 29.3 | △ Planning |
| MONTHLY-06 | Phase 29.3 | △ Planning |
| MONTHLY-07 | Phase 29.3 | △ Planning |
| MONTHLY-08 | Phase 29.3 | △ Planning |
| MONTHLY-09 | Phase 29.3 | △ Planning |
| MONTHLY-10 | Phase 29.3 | △ Planning |

**Coverage:**
- v1 requirements: 94 total (58 v1.0-v1.4 + 36 LEGAL)
- Mapped to phases: 90
- Unmapped: 0 ✓
- Deferred to v1.7: PAY-01, PAY-02, PAY-03, PAY-04, PAY-05, PAY-06
- F29.1.2: Fase complementar refinando LAUNCH-01 e LAUNCH-02 (sem REQ-IDs próprios)
- F30 (LEGAL-*): Adicionados em 2026-07-23 via alinhamento com OpenSpec

---

*Requirements defined: 2026-07-15*
*Last updated: 2026-07-22 — Added F29.3 (MONTHLY-01 a MONTHLY-10) requirements*
