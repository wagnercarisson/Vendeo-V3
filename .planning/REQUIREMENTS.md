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

- [ ] **ADMIN-01**: Admin access control — only explicitly authorized users (admin_users table) access admin routes/pages
- [ ] **ADMIN-02**: Admin user/store directory — list and search beta users/stores with support data
- [ ] **ADMIN-03**: Admin credit grant — manual credit grant with mandatory reason, using CreditService.grantCredits
- [ ] **ADMIN-04**: Admin credit ledger view — view balance and full transaction history of any store/user
- [ ] **ADMIN-05**: Admin campaign error review — view errored campaigns with error_message, status, dates
- [ ] **ADMIN-06**: Admin audit log — every sensitive admin action recorded with actor, target, action, reason, timestamp

### Conta e Saldo Visível (UI-CREDIT)

- [ ] **UI-01**: Credit balance visible in topbar (app shell) — server-side lookup
- [ ] **UI-02**: Credits section in `/conta` — balance card, transaction history
- [ ] **UI-03**: Zero-credit CTA during beta — "Solicitar créditos" / "Fale com o time" (não Stripe)
- [ ] **UI-04**: Extrato paginado (credit_transactions history with all types except adjustment)
- [ ] **UI-05**: Onboarding grant: 5 free credits on store creation (POST /api/store integration)
- [ ] **UI-06**: Zero-credit states: tooltip, disabled button, CTA to request credits — product never blocks entirely

### Observabilidade e Operação (OPS)

- [ ] **OPS-01**: Structured logging in pipeline (campaignId, phase, duration_ms, status)
- [ ] **OPS-02**: IA telemetry (tokens, cost, model, provider) in generation_events
- [ ] **OPS-03**: Deploy checklist, rollback process, environment variables documented
- [ ] **OPS-04**: Support runbook (manual grant via admin, refund, balance check)
- [ ] **OPS-05**: Feature flag v1.5-credits-enabled for safe rollout

### Refinamento Visual e Launch Readiness (LAUNCH)

- [ ] **LAUNCH-01**: Loading, empty, error states for all new screens/components
- [ ] **LAUNCH-02**: Insufficient-credit UX across the app (disabled states, tooltips, microcopy)
- [ ] **LAUNCH-03**: Mobile hardening for credit flows (viewport 320–768px, touch targets >=44px)
- [ ] **LAUNCH-04**: UAT externo com 3–5 lojistas reais (convite manual, grant admin, geração, saldo, extrato)
- [ ] **LAUNCH-05**: Canal de feedback, métricas de saúde, critérios de expansão/pausa documentados
- [ ] **LAUNCH-06**: Feature flag active and verified in UAT before milestone close

### Segurança (SEC)

- [ ] **SEC-01**: RLS policies for credit_balances and credit_transactions
- [ ] **SEC-02**: Ownership validation on all /api/credits/* and /api/admin/* routes
- [ ] **SEC-03**: Sanitized inputs to Copy Director (no sensitive data in prompts)
- [ ] **SEC-04**: Admin routes protected by requireAdmin gate — admin_users table, no auth.users flag
- [ ] **SEC-05**: Service role usage reviewed — credit operations use service role only after identity validation
- [ ] **SEC-06**: Admin audit log is append-only; grant without audit trail is treated as failure

## v1.6 Requirements (Stripe / Monetização Pública)

Deferred from v1.5 critical path. Stripe será implementada como F30/v1.6 após validação do beta controlado.

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
| ADMIN-01 | Phase 26 | Planned |
| ADMIN-02 | Phase 26 | Planned |
| ADMIN-03 | Phase 26 | Planned |
| ADMIN-04 | Phase 26 | Planned |
| ADMIN-05 | Phase 26 | Planned |
| ADMIN-06 | Phase 26 | Planned |
| UI-01 | Phase 27 | Planned |
| UI-02 | Phase 27 | Planned |
| UI-03 | Phase 27 | Planned |
| UI-04 | Phase 27 | Planned |
| UI-05 | Phase 27 | Planned |
| UI-06 | Phase 27 | Planned |
| OPS-01 | Phase 28 | Planned |
| OPS-02 | Phase 28 | Planned |
| OPS-03 | Phase 28 | Planned |
| OPS-04 | Phase 28 | Planned |
| OPS-05 | Phase 28 | Planned |
| SEC-04 | Phase 26 | Planned |
| SEC-06 | Phase 26 | Planned |
| LAUNCH-01 | Phase 29 | Planned |
| LAUNCH-02 | Phase 29 | Planned |
| LAUNCH-03 | Phase 29 | Planned |
| LAUNCH-04 | Phase 29 | Planned |
| LAUNCH-05 | Phase 29 | Planned |
| LAUNCH-06 | Phase 29 | Planned |
| SEC-01 | Phase 29 | Planned |
| SEC-02 | Phase 29 | Planned |
| SEC-03 | Phase 29 | Planned |
| SEC-05 | Phase 29 | Planned |

**Coverage:**
- v1 requirements: 44 total
- Mapped to phases: 44
- Unmapped: 0 ✓
- Deferred to v1.6: PAY-01, PAY-02, PAY-03, PAY-04, PAY-05, PAY-06

---
*Requirements defined: 2026-07-15*
*Last updated: 2026-07-15 after milestone v1.5 start*
