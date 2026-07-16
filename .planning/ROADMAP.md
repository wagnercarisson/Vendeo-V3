# Roadmap: Vendeo V3

## Milestone v1.5 — Lançamento Externo Controlado

**7 phases** | **42 requirements mapped** | All covered ✓

**Phase numbering:** Continues from v1.4 (Phase 22). Starts at Phase 23.

---

## Overview

| # | Phase | Goal | Requirements | Success Criteria |
|---|-------|------|--------------|------------------|
| 23 | TextProvider + Copy Director | Fundação de IA de texto — Copy Director funcional e testável | COPY-01, COPY-02, COPY-03, COPY-04 | 4 |
| 24 | Credit Tables + CreditService | Sistema de créditos funcional e testável, sem UI | CRED-01, CRED-02, CRED-03, CRED-04, CRED-05 | 5 |
| 25 | Pipeline de Geração v1.5 | Copy Director + créditos integrados no generate-image | PIPE-01, PIPE-02, PIPE-03, PIPE-04, PIPE-05, PIPE-06 | 6 |
| 26 | Pagamento (Stripe) | Compra de créditos via Stripe Checkout + Webhook | PAY-01, PAY-02, PAY-03, PAY-04 | 4 |
| 27 | Conta + Saldo Visível | UI de créditos no app shell e /conta | UI-01, UI-02, UI-03, UI-04, UI-05, UI-06 | 6 |
| 28 | Observabilidade + Deploy + Operação | Operação pronta para lançamento controlado | OPS-01, OPS-02, OPS-03, OPS-04, OPS-05, SEC-06 | 6 |
| 29 | Refinamento + Launch Readiness | Produto polido e pronto para público externo | LAUNCH-01, LAUNCH-02, LAUNCH-03, LAUNCH-04, LAUNCH-05, LAUNCH-06, SEC-01, SEC-02, SEC-03, SEC-04, SEC-05 | 11 |

---

## Phase Details

### Phase 23 — TextProvider + Copy Director

**Goal:** Copy Director funcional e testável. TextProvider intercambiável OpenAI/Anthropic.

**Requirements:** COPY-01, COPY-02, COPY-03, COPY-04

**Success criteria:**
1. User can call CopyDirectorService.generateCopy(brief) and receive title, caption, hashtags, cta_post
2. TextProvider switches between OpenAI and Anthropic via config without code changes
3. Prompt template at `prompts/campaign-copy-director.md` produces segment-aware copy
4. Copy Director is callable standalone (no image generation required)

**Dependencies:** Provider abstraction layer exists (OpenAI/Anthropic config already in place)

---

### Phase 24 — Credit Tables + CreditService

**Goal:** Sistema de créditos funcional e testável, sem UI. Créditos podem ser concedidos e consumidos programaticamente.

**Requirements:** CRED-01, CRED-02, CRED-03, CRED-04, CRED-05

**Success criteria:**
1. User can receive credits via grant (onboarding, admin)
2. Credit reserve deducts balance atomically; refund restores it
3. Balance never goes negative — reserve fails if insufficient
4. Transaction history is append-only; refund creates new entry
5. Multiple simultaneous requests don't cause race conditions on balance

**Dependencies:** None (new tables, no dependency on prior phases)

---

### Phase 25 — Pipeline de Geração v1.5

**Goal:** Pipeline completo com copy inteligente, controle de custos e proteção financeira.

**Requirements:** PIPE-01, PIPE-02, PIPE-03, PIPE-04, PIPE-05, PIPE-06

**Success criteria:**
1. Copy Director runs in parallel with Image Director during generation
2. Rate limit blocks >10 generations/hour and >30/day per user
3. Insufficient balance returns 402 before any IA call
4. Credit is reserved before IA; refunded on failure; confirmed on success
5. publication_copy_snapshot contains Copy Director result, not deterministic fallback
6. Pipeline aborts at 120s total timeout; abort triggers full refund

**Dependencies:** Phase 23 (Copy Director) + Phase 24 (CreditService)

---

### Phase 26 — Pagamento (Stripe Checkout + Webhook)

**Goal:** Usuário pode comprar créditos via Stripe Checkout. Compra refletida no saldo em segundos.

**Requirements:** PAY-01, PAY-02, PAY-03, PAY-04

**Success criteria:**
1. User selects credit pack (10/25/50) and is redirected to Stripe Checkout
2. checkout.session.completed webhook credits balance within seconds
3. Stripe webhook signature is verified (invalid signatures rejected)
4. Same webhook event processed at most once (idempotency)

**Dependencies:** Phase 24 (CreditService.grant)

---

### Phase 27 — Conta + Saldo Visível

**Goal:** Usuário vê saldo, compra créditos e acompanha gastos. Experiência completa de autoatendimento.

**Requirements:** UI-01, UI-02, UI-03, UI-04, UI-05, UI-06

**Success criteria:**
1. Credit balance visible in topbar across all authenticated pages
2. /conta shows balance card, purchase dialog, and paginated transaction history
3. Purchase dialog offers 3 packs; selection triggers Stripe Checkout redirect
4. Transaction history shows all types except adjustment (admin-only)
5. New store creation grants 5 credits automatically
6. Zero-credit user sees tooltips, disabled button, and CTA — but can browse dashboard/history

**Dependencies:** Phase 26 (payment functional) — UI can be built in parallel mocking data

---

### Phase 28 — Observabilidade + Deploy + Operação

**Goal:** Operação pronta para lançamento externo controlado.

**Requirements:** OPS-01, OPS-02, OPS-03, OPS-04, OPS-05, SEC-06

**Success criteria:**
1. Every pipeline stage logs campaignId, phase, duration_ms, status
2. IA telemetry (tokens, cost, model, provider) persisted in generation_events
3. Deploy checklist and rollback process documented and tested
4. Support runbook covers manual grant, refund, balance check
5. Feature flag v1.5-credits-enabled controls rollout
6. Data retention cleanup (90d) documented as manual runbook; auto-job planned for D+30

**Dependencies:** Phase 27

---

### Phase 29 — Refinamento Visual + Experiência Publicável + Launch Readiness

**Goal:** Produto com acabamento visual de lançamento externo. Time confiante para abrir para usuários reais.

**Requirements:** LAUNCH-01, LAUNCH-02, LAUNCH-03, LAUNCH-04, LAUNCH-05, LAUNCH-06, SEC-01, SEC-02, SEC-03, SEC-04, SEC-05

**Success criteria:**
1. Loading, empty, and error states exist for all new screens
2. Insufficient-credit UX is consistent across the entire app
3. Credit flows work on mobile (320–768px) with >=44px touch targets
4. UAT completed with 3–5 external lojistas
5. Feedback channel active and health metrics visible
6. Expansion/pause criteria documented and agreed by team
7. RLS policies verified on credit_balances and credit_transactions
8. Ownership validated on all /api/credits/* routes
9. Copy Director inputs sanitized (no sensitive data in prompts)
10. Stripe webhook HMAC verification active and tested
11. Service role usage reviewed and compliant with security standards

**Dependencies:** Phase 28

---

## Dependency Graph

```
Phase 23 (TextProvider + Copy Director) ──┐
                                           ├──▶ Phase 25 (Pipeline v1.5)
Phase 24 (Credit Tables + CreditService) ──┘
                                              │
                                              ▼
                                       Phase 26 (Payment Stripe)
                                              │
                                              ▼
                                       Phase 27 (Conta + Saldo)
                                              │
                                              ▼
                                       Phase 28 (Observability + Ops)
                                              │
                                              ▼
                                       Phase 29 (Refinement + Launch)
```

## Coverage Validation

| Requirement | Phase | Status |
|-------------|-------|--------|
| COPY-01 | Phase 23 | Planned |
| COPY-02 | Phase 23 | Planned |
| COPY-03 | Phase 23 | Planned |
| COPY-04 | Phase 23 | Planned |
| CRED-01 | Phase 24 | Done ✓ |
| CRED-02 | Phase 24 | Done ✓ |
| CRED-03 | Phase 24 | Done ✓ |
| CRED-04 | Phase 24 | Done ✓ |
| CRED-05 | Phase 24 | Done ✓ |
| PIPE-01 | Phase 25 | Planned |
| PIPE-02 | Phase 25 | Planned |
| PIPE-03 | Phase 25 | Planned |
| PIPE-04 | Phase 25 | Planned |
| PIPE-05 | Phase 25 | Planned |
| PIPE-06 | Phase 25 | Planned |
| PAY-01 | Phase 26 | Planned |
| PAY-02 | Phase 26 | Planned |
| PAY-03 | Phase 26 | Planned |
| PAY-04 | Phase 26 | Planned |
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
| SEC-06 | Phase 28 | Planned |
| LAUNCH-01 | Phase 29 | Planned |
| LAUNCH-02 | Phase 29 | Planned |
| LAUNCH-03 | Phase 29 | Planned |
| LAUNCH-04 | Phase 29 | Planned |
| LAUNCH-05 | Phase 29 | Planned |
| LAUNCH-06 | Phase 29 | Planned |
| SEC-01 | Phase 29 | Planned |
| SEC-02 | Phase 29 | Planned |
| SEC-03 | Phase 29 | Planned |
| SEC-04 | Phase 29 | Planned |
| SEC-05 | Phase 29 | Planned |

**Coverage:**
- v1 requirements: 42 total
- Mapped to phases: 42
- Unmapped: 0 ✓

---
*Roadmap created: 2026-07-15*
*Milestone: v1.5 — Lançamento Externo Controlado*
