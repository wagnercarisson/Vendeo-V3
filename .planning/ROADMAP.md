# Roadmap: Vendeo V3

## Milestone v1.5 — Lançamento Externo Controlado

**7 phases** | **42 requirements mapped** | All covered ✓

**Phase numbering:** Continues from v1.4 (Phase 22). Starts at Phase 23.

---

## Overview

| # | Phase | Goal | Requirements | Success Criteria |
|---|---|---|---|---|
| 23 | TextProvider + Copy Director | Fundação de IA de texto — Copy Director funcional e testável | COPY-01, COPY-02, COPY-03, COPY-04 | 4 |
| 24 | Credit Tables + CreditService | Sistema de créditos funcional e testável, sem UI | CRED-01, CRED-02, CRED-03, CRED-04, CRED-05 | 5 |
| 25 | Pipeline de Geração v1.5 | Copy Director + créditos integrados no generate-image | PIPE-01, PIPE-02, PIPE-03, PIPE-04, PIPE-05, PIPE-06 | 6 |
| 26 | ✅ Admin Operacional + Convites + Créditos Manuais | Console de suporte para operar o beta controlado | ADMIN-01, ADMIN-02, ADMIN-03, ADMIN-04, ADMIN-05, ADMIN-06, SEC-04, SEC-06 | 8 ✅ |
| 27 | ✅ Conta + Saldo Visível + Extrato | UI de créditos no app shell e /conta (sem Stripe) | UI-01, UI-02, UI-03, UI-04, UI-05, UI-06 | 6 ✅ |
| 28 | Observabilidade + Operação + Launch Controls | Pipeline instrumentado, launch config centralizado, dashboard operacional, docs de deploy/suporte | OPS-01, OPS-02, OPS-03, OPS-04, OPS-05, OPS-06, OPS-07, OPS-08, OPS-09 | 9 |
| 29 | Refinamento + UAT + Launch Readiness | Produto polido e pronto para beta externo | LAUNCH-01, LAUNCH-02, LAUNCH-03, LAUNCH-04, LAUNCH-05, LAUNCH-06, SEC-01, SEC-02, SEC-03, SEC-05 | 10 |

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

### Phase 26 — Admin Operacional + Convites + Créditos Manuais

**Goal:** Time consegue operar o beta controlado sem depender de SQL manual ou Supabase Dashboard.

**Requirements:** ADMIN-01, ADMIN-02, ADMIN-03, ADMIN-04, ADMIN-05, ADMIN-06, SEC-04, SEC-06

**Success criteria:**
1. Admin access gate via `admin_users` table (not auth.users flag)
2. Admin can list/search beta users/stores with support data
3. Admin can manually grant credits with mandatory reason (idempotent + audited)
4. Admin can view balance and full transaction history of any store
5. Admin can view errored campaigns with error details for triage
6. Every admin action recorded in append-only audit log (grant without audit = failure)

**Dependencies:** Phase 24 (CreditService.grantCredits, getBalance, getHistory) + Phase 25 (campaigns with error status)

---

### Phase 27 — Conta + Saldo Visível + Extrato ✅

**Goal:** Usuário vê saldo e acompanha gastos. Sem Stripe durante beta — CTA é "Solicitar créditos / Fale com o time".

**Requirements:** UI-01, UI-02, UI-03, UI-04, UI-05, UI-06

**Success criteria:**
1. ✅ Balance visible in dashboard metrics grid (contextual, not global — D1)
2. ✅ /conta shows BalanceCard + TransactionHistory with pagination (D3)
3. ✅ Zero-credit CTA shows "Solicitar créditos / Fale com o time" (CreditCta modal/mailto, D4)
4. ✅ Transaction history shows all types except adjustment (D6 — countCreditTransactions neq adjustment)
5. ✅ New store creation grants 5 credits automatically (already implemented in F25)
6. ✅ Zero-credit user sees tooltips, disabled button, and CTA — but can browse dashboard/history (D8)

**Dependencies:** Phase 24 ✅
**Tests:** 852 passing (108 files, 20 novos)
**Commits:** `b7db26c`, `0d61e9a`, `aa136e0`

---

### Phase 28 — Observabilidade + Operação + Launch Controls

**Goal:** Operação pronta para lançamento externo controlado. Pipeline instrumentado com logs estruturados, telemetria de IA persistida, feature flags centralizadas, dashboard operacional, documentação de deploy/suporte e testes de concorrência.

**Requirements:** OPS-01, OPS-02, OPS-03, OPS-04, OPS-05, OPS-06, OPS-07, OPS-08, OPS-09

**Success criteria:**
1. Launch config centralizado com 5 flags (v15Enabled, creditsChargingEnabled, copyDirectorEnabled, rateLimitEnabled, generationPaused) lidas via helper único — zero `process.env` espalhado
2. Every pipeline stage logs via `logPipelineEvent()` com traceId, campaignId, phase, duration_ms, status — JSON estruturado, fire-and-forget, sem dados sensíveis
3. IA telemetry (tokens, cost, model, provider) persisted in generation_events via expansão (CHECK constraint + colunas) — best-effort, nunca bloqueia o pipeline
4. Helper `estimateAiCost()` para custo estimado por provider/modelo (OpenAI + Gemini)
5. Dashboard `/admin/metrics` com cards de métricas (sucesso, erro, custo, tempo, créditos, estorno, users) + health state banner (healthy/attention/pause)
6. Deploy checklist, support runbook e catálogo de environment variables documentados em `docs/operations/`
7. Feature flags verificadas no pipeline: `generationPaused` → 503, `v15Enabled` → v1.4 fallback, `rateLimitEnabled` → bypass, `creditsChargingEnabled` → sem saldo check, `copyDirectorEnabled` → fallback determinístico
8. Função SQL `cleanup_generation_events_90d()` versionada + runbook manual; job automático adiado para D+30
9. Testes de concorrência (2 requests simultâneos, saldo=1, apenas um vence) + telemetria + regressão master switch/emergency brake
10. Nenhuma nova tabela — apenas ALTER CHECK + ADD COLUMNS em generation_events

**Dependencies:** Phase 24 (credit_balances, credit_transactions, CreditService), Phase 25 (generation_rate_events, rate-limit, pipeline route), Phase 26 (admin layout, admin gate)

**Source of truth:** `openspec/changes/fase-28-observabilidade-operacao-launch-controls/`

---

### Phase 29 — Refinamento Visual + UAT + Launch Readiness

**Goal:** Produto com acabamento visual de lançamento externo. Time confiante para abrir para usuários reais.

**Requirements:** LAUNCH-01, LAUNCH-02, LAUNCH-03, LAUNCH-04, LAUNCH-05, LAUNCH-06, SEC-01, SEC-02, SEC-03, SEC-05

**Success criteria:**
1. Loading, empty, and error states exist for all new screens
2. Insufficient-credit UX is consistent across the entire app (CTA "Fale com o time")
3. Credit flows work on mobile (320–768px) with >=44px touch targets
4. UAT completed with 3–5 external lojistas — validates: invite, admin grant, generation, deduction, refund, balance, ledger, error triage
5. Feedback channel active and health metrics visible
6. Expansion/pause criteria documented and agreed by team
7. RLS policies verified on credit_balances and credit_transactions
8. Ownership validated on all /api/credits/* and /api/admin/* routes
9. Copy Director inputs sanitized (no sensitive data in prompts)
10. Admin audit log verified — grant without trail is impossible
11. Service role usage reviewed and compliant with security standards

**Dependencies:** Phase 28

---

## Dependency Graph

```
Phase 23 (TextProvider + Copy Director) ──┐
                                           ├──▶ Phase 25 (Pipeline v1.5)
Phase 24 (Credit Tables + CreditService) ──┘
                                              │
                    ┌─────────────────────────┼──────────────────┐
                    ▼                         ▼                  ▼
          Phase 26 (Admin Ops)       Phase 27 (UI Saldo)   F30/v1.6 (Stripe)
                    │                         │              (futuro)
                    └─────────┬───────────────┘
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
| PIPE-01 | Phase 25 | Done ✓ |
| PIPE-02 | Phase 25 | Done ✓ |
| PIPE-03 | Phase 25 | Done ✓ |
| PIPE-04 | Phase 25 | Done ✓ |
| PIPE-05 | Phase 25 | Done ✓ |
| PIPE-06 | Phase 25 | Done ✓ |
| ADMIN-01 | Phase 26 | Done ✓ |
| ADMIN-02 | Phase 26 | Done ✓ |
| ADMIN-03 | Phase 26 | Done ✓ |
| ADMIN-04 | Phase 26 | Done ✓ |
| ADMIN-05 | Phase 26 | Done ✓ |
| ADMIN-06 | Phase 26 | Done ✓ |
| PAY-01 | Phase 30/v1.6 | Deferred |
| PAY-02 | Phase 30/v1.6 | Deferred |
| PAY-03 | Phase 30/v1.6 | Deferred |
| PAY-04 | Phase 30/v1.6 | Deferred |
| UI-01 | Phase 27 | Done ✓ |
| UI-02 | Phase 27 | Done ✓ |
| UI-03 | Phase 27 | Done ✓ |
| UI-04 | Phase 27 | Done ✓ |
| UI-05 | Phase 27 | Done ✓ |
| UI-06 | Phase 27 | Done ✓ |
| OPS-01 | Phase 28 | Planned |
| OPS-02 | Phase 28 | Planned |
| OPS-03 | Phase 28 | Planned |
| OPS-04 | Phase 28 | Planned |
| OPS-05 | Phase 28 | Planned |
| OPS-06 | Phase 28 | Planned |
| OPS-07 | Phase 28 | Planned |
| OPS-08 | Phase 28 | Planned |
| OPS-09 | Phase 28 | Planned |
| SEC-04 | Phase 26 | Done ✓ |
| SEC-06 | Phase 26 | Done ✓ |
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
- Completed: 26 (CRED-01–05, PIPE-01–06, ADMIN-01–06, SEC-04, SEC-06, UI-01–06)
- Unmapped: 0 ✓
- Deferred to v1.6: PAY-01, PAY-02, PAY-03, PAY-04, PAY-05, PAY-06

---
*Roadmap created: 2026-07-15*
*Milestone: v1.5 — Lançamento Externo Controlado*
