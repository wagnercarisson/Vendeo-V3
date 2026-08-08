# Roadmap: Vendeo V3

## Milestone v1.5 — Lançamento Externo Controlado ◆

**18 phases** | **177 requirements mapped** | All covered ✓

**Phase numbering:** Continues from v1.4 (Phase 22). Starts at Phase 23. F35 = Changelog/Novidades, F36 = Onboarding — Navegação por Abas, F37 = Revisão e Aprovação da Arte (v1.5), F38 = Tabela de Custos por Operação (v1.5), F39 = Stripe/Monetização Pública (v1.7) (renumeração alinhada nos documentos de alinhamento F36/F38). **38.1 = Apuração de Custos de IA por Entrega** (desdobramento da F38, mesmo milestone v1.5).

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
| 29 | ✅ Refinamento + UAT + Launch Readiness | Produto polido e pronto para beta externo | LAUNCH-01, LAUNCH-02, LAUNCH-03, LAUNCH-04, LAUNCH-05, LAUNCH-06, SEC-01, SEC-02, SEC-03, SEC-05 | 10 ✅ |
| 29.1.1 | ✅ Créditos na Assinatura Visual | VS passa a consumir créditos, remove cota fixa de 3 tentativas | CRED-03, CRED-04, CRED-05, OPS-05 | 4 ✅ |
| 29.1.2 | ✅ Histórico Curto + Assinatura Visual | HistoryModal reescrito com paginação, filtro client-side, ações condicionais e ponte ApprovalModal | — | 3 ✅ |
| 29.3 | ✅ Créditos Mensais Automáticos | Buckets bônus/compra, concessão automática via Vercel Cron, fallback admin | MONTHLY-01–10 | 10 ✅ |
| 30 | ✅ Fundação Legal | Documentos legais, ciência/aceite contratual, clearance no pipeline, re-aceite, consentimento LGPD, admin badges | LEGAL-* | 43 ✅ |
| 31.1 | ✅ Modelo Comercial — Formulário | CampaignIntent type, seletor de intent no formulário, inferência automática, badge por intent, pipeline guard | INTENT-01–12 | 12 ✅ |
| 31.2 | ✅ Diretores por Intenção | Schemas tolerantes, desbloqueio de intents, 6 prompts por intent, roteamento de diretores, conteúdo adaptado | — | 9 ✅ |
| 31.3 | ✅ Quality Gate por Intenção Comercial | Revisor intent-aware, prompt reestruturado, commercial_tone_mismatch, variáveis contextuais | — | 11 ✅ |
| 32 | ✅ Freemium Anti-Abuso CNPJ | CNPJ obrigatório no cadastro, entitlement por raiz de CNPJ, admin freemium status | CNPJ-01–06, FREEMIUM-01–04 | 10 ✅ |
| 33 | ✅ Verificação CNPJ Freemium | Consulta BrasilAPI/CNPJá, cross-check, motor de decisão, admin review, test stores | CNPJ-07–12 | 6 ✅ |
| 34 | ✅ Store Readiness | Readiness RPC + guarda dupla + direção visual obrigatória + dashboard banner + billing info | F34-READINESS, F34-BILLING, F34-STORE-TYPE, F34-GUARD, F34-LEGACY, F34-UI, F34-DASHBOARD, F34-BRANDPROFILE | 8 ✅ |
| 35 | ✅ Changelog/Novidades | 5/5 | Complete    | 2026-07-31 |
| 36 | ✅ Onboarding — Navegação por Abas | 6/6 | Complete    | 2026-08-05 |
| 37 | ○ Revisão e Aprovação da Arte | — | Pending    | — |
| 38 | ✅ Tabela de Custos por Operação | 8/8 | ✅ Complete | 2026-08-07 |
| 38.1 | 🔄 Apuração de Custos de IA por Entrega | 4/11 | In Progress | — |
| 39 | ○ Stripe / Monetização Pública (v1.7) | — | Pending    | — |

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

### Phase 29 — Refinamento Visual + UAT + Launch Readiness ✅

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

### Phase 29.1.1 — Créditos na Assinatura Visual ✅

**Goal:** VS passa a consumir créditos como o resto do produto, removendo cota fixa de 3 tentativas.

**Requirements:** CRED-03, CRED-04, CRED-05, OPS-05

**Success criteria:**

1. ✅ VS generation deducts 1 credit via reserveCredit before IA
2. ✅ Zero balance returns 402 `{ code: "insufficient_credits" }` before any IA call
3. ✅ Technical failure refunds the reserved credit
4. ✅ Launch config flags (generationPaused, v15Enabled, creditsChargingEnabled) respected
5. ✅ "Tentativa X/3" badge and exhausted-limit UX completely removed
6. ✅ VisualSignatureApprovalModal shows insufficient_credits state with CTA to /conta
7. ✅ GET /api/store/[id]/visual-signature supports limit/offset pagination
8. ✅ Review modal loads max 6 signatures with total count indicator
9. ✅ No migration — `visual_signature_attempts` column maintained but unused

**Dependencies:** Phase 24 (CreditService), Phase 25 (generate pipeline baseline), Phase 28 (launch config)

**Tests:** 917 passing (117 files, 8 novos) — credit integration, removed limit, regression

**Commits:**

- `d735d01` — 29-1-1-01: Backend Foundation
- `291f605` — 29-1-1-02: Frontend
- `6ff32ee`, `b6c8a8c` — 29-1-1-03: Tests & Verification

---

### Phase 29.1.2 — Histórico Curto + Assinatura Visual ✅

**Goal:** Histórico de VS reescrito com paginação, filtro client-side de aplicabilidade, ações condicionais ao identity_state, e ponte ApprovalModal → HistoryModal.

**Requirements:** _(Not assigned to specific REQ-IDs — refines LAUNCH-01, LAUNCH-02 user-facing states)_

**Success criteria:**

1. HistoryModal substituído — grid 3 colunas, max 12 itens, paginação "Ver versões anteriores"
2. VS com critical_drift ou missing_metadata ocultas da lista (filtro client-side)
3. Apenas `identity_state = text_only` permite "Aplicar" — demais estados bloqueiam com tooltip
4. Draft incluído na listagem com revalidação de drift no backend
5. ApprovalModal → HistoryModal bridge via prop `onOpenGallery` (em ambos os parents)
6. Backend: condição de drift validation alterada de `status === 'archived'` para `status !== 'active'`
7. Spec `visual-signature-restore` atualizada: `identity_state = visual_signature` é BLOQUEADO
8. Sem consumo de crédito para visualizar ou reativar VS
9. 22+ testes novos + regressão completa

**Dependencies:** Phase 29.1.1 (VS consome créditos), Phase 29 (approval modal, drift system)

**Source of truth:** `openspec/changes/fase-29-1-2-historico-curto-assinatura-visual/`

---

### Phase 29.3 — Créditos Mensais Automáticos ✅

**Goal:** Créditos mensais recorrentes com buckets bônus/compra, concessão automática via Vercel Cron, e fallback admin.

**Requirements:** MONTHLY-01, MONTHLY-02, MONTHLY-03, MONTHLY-04, MONTHLY-05, MONTHLY-06, MONTHLY-07, MONTHLY-08, MONTHLY-09, MONTHLY-10

**Success criteria:**

1. ✅ credit_balances com bonus_balance + purchased_balance, balance sincronizado por trigger
2. ✅ grant_credits bucket-aware com p_type (bonus_onboarding, bonus_monthly, admin_grant, purchase)
3. ✅ reserve_credit bucket-aware: bônus primeiro, comprado por último
4. ✅ refund_credit bucket-aware: lê metadata da deduction, fallback legacy
5. ✅ credit_transactions com 7 tipos válidos + CHECK constraints
6. ✅ grant_monthly_credits RPC: elegibilidade por idade, teto, grant parcial, SKIP LOCKED, idempotência
7. ✅ Launch Config com 4 flags mensais (monthlyCreditsEnabled, amount, cap, minStoreAgeDays)
8. ✅ GET /api/cron/monthly-credits com CRON_SECRET, schedule 0 6 * * *
9. ✅ POST /api/admin/monthly-credits/grant com apiHandler + requireAdmin + botão no admin
10. ✅ 986 testes passando (119 files), typecheck/lint limpo

**Dependencies:** Phase 24 (credit_balances, credit_transactions, SQL functions), F25 (pipeline), F26 (admin), F27 (balance display), F28 (launch config)

**Tests:** 987 passing (119 files, +48 novos)
**TypeScript:** Clean | **Lint:** Clean | **Build:** Clean

**Commits:**

- `d557fda` — feat(29-3-01): modelo contábil — buckets bônus/compra
- `06adb28` — feat(29-3-02): grant_monthly_credits RPC + Launch Config
- `d834d68` — feat(29-3-03): Vercel Cron + Fallback Admin
- `0329f9b` — test(29-3-04): testes e verificação
- `41e9156` — fix: libera rota cron no middleware

---

### Phase 31.1 — Modelo Comercial — Formulário ✅

**Goal:** Preparar o formulário de campanha para múltiplas intenções comerciais (Oferta, Destaque, Exclusivo), com schemas, inferência automática e bloqueio de submissão para intents não implementadas.

**Requirements:** INTENT-01, INTENT-02, INTENT-03, INTENT-04, INTENT-05, INTENT-06, INTENT-07, INTENT-08, INTENT-09, INTENT-10, INTENT-11, INTENT-12

**Success criteria:**

1. CampaignIntent type (`"offer" | "spotlight" | "exclusive"`) definido e exportado
2. Inferência automática de intent a partir dos campos de preço (DE+POR → offer, só preço → spotlight, nenhum → exclusive)
3. Seletor de intent (radio group) no formulário entre badge e botão "Criar", com opções filtradas
4. Spotlight/Exclusive exibem "Em breve" e bloqueiam submit
5. BADGE_OPTIONS_BY_INTENT com badges separados por intent; badge opcional para spotlight/exclusive
6. preserveImageContext checkbox (invisível em offer, visível em spotlight/exclusive)
7. discountedPriceCents opcional no form (number | undefined), required nos schemas do pipeline
8. Pipeline guard rejeita intents não-offer no pré-stream com HTTP 400
9. inputSnapshot transporta campaignIntent e preserveImageContext (normalizado para false em offer)
10. 12+ testes de inferência, validação condicional, badge e preserveImageContext
11. Nenhuma migration de banco — campos transportados apenas no JSONB inputSnapshot
12. Regressão completa (1018+ testes existentes continuam passando)

**Dependencies:** Phase 25 (pipeline route generate-image), Phase 27 (form/balance), Phase 30 (legal clearance no pipeline)

**Source of truth:** `openspec/changes/fase-31-1-modelo-comercial-formulario/`

**Plans:** 5 plans in 4 waves

| Plan | Wave | Objective | Requirements | Files |
|------|------|-----------|--------------|-------|
| 31-1-01 | 1 | Foundation — Types + Schemas + Constants | INTENT-01, INTENT-02, INTENT-03, INTENT-04, INTENT-05 | types.ts, schemas, constants.ts |
| 31-1-02 | 2 | Form Logic — State + Inference + Validation | INTENT-06, INTENT-09, INTENT-11 | use-campaign-form.ts |
| 31-1-03 | 2 | Pipeline — Guard + InputSnapshot | INTENT-02, INTENT-12 | generate-image/route.ts |
| 31-1-04 | 3 | UI — IntentSelector + Badge + Checkbox + Submit | INTENT-07, INTENT-08, INTENT-09, INTENT-10 | campaign-input-form.tsx |
| 31-1-05 | 4 | Tests — Inferência, Validação, Badge, Schema, Pipeline Guard | INTENT-01–12 (verificação) | 4 test files |

---

### Phase 31.2 — Diretores por Intenção ✅

**Goal:** Schemas tolerantes, desbloqueio total de spotlight/exclusive, prompts e roteamento por intent, conteúdo adaptado.

**Requirements:** _(Refinamento de F31.1 — sem novos REQ-IDs)_

**Success criteria:**

1. discountedPriceCents opcional nos schemas; Campos nullable no CampaignSpecSchema
2. Spotlight/exclusive desbloqueados na UI, form e pipeline (sem "Em breve", sem bloqueio de submit, sem HTTP 400)
3. Exclusive normaliza discountedPriceCents para undefined
4. 6 prompts separados por intent (3 image + 3 copy), sem fallback silencioso
5. Roteamento de prompt por campaignIntent em assemblePrompt, validatePrompts e CopyDirectorService
6. commercialFrame substituindo offer no Copy Director
7. Conteúdo adaptado: buildCommercialRepertoire, buildCreativeContextGuidance, buildDeterministicCopy
8. 15 novos testes, 1051 total, regressão zero para offer

**Dependencies:** Phase 31.1 (types, schemas, UI, pipeline guard)

**Source of truth:** `openspec/changes/fase-31-2-diretores-por-intencao/`

**Plans:** 6 plans (2 waves)

| Plan | Wave | Objective |
|------|------|-----------|
| 31-2-01 | 1 | Schema Contracts — discountedPriceCents opcional, CampaignSpecSchema nullable |
| 31-2-02 | 1 | Unblock — UI/Form/Route: remover bloqueios, normalização exclusive, validação offer |
| 31-2-03 | 2 | 6 Prompt Templates — 3 image + 3 copy por intent |
| 31-2-04 | 2 | Image Director Routing — assemblePrompt, buildPromptVariables, validatePrompts por intent |
| 31-2-05 | 2 | Copy Director + Content — commercialFrame, buildDeterministicCopy |
| 31-2-06 | 3 | Tests + Verification — 15 novos testes, regressão 1051, typecheck/lint/build |

---

### Phase 31.3 — Quality Gate por Intenção Comercial ✅

**Goal:** Adaptar o revisor de qualidade (`ImageReviewService`) para ser intent-aware, eliminando falsos negativos para spotlight e exclusive.

**Requirements:** _(Refinamento de F31.2 — sem novos REQ-IDs)_

**Success criteria:**

1. ✅ ImageReviewInput aceita campaignIntent (default "offer"), preserveImageContext; badgeText, discountedPrice, originalPrice opcionais
2. ✅ ReviewIssueType union com 18 valores (17 existentes + commercial_tone_mismatch)
3. ✅ review() monta variáveis contextuais em 2 etapas (resolver placeholders → montar strings finais sem {{...}})
4. ✅ expectedBadgeBehavior com 3 variantes: offer obrigatório / spotlight+exclusive com badge / spotlight+exclusive sem badge
5. ✅ commercial_tone_mismatch como novo tipo de issue — critical se contradiz intent, minor se publicável
6. ✅ Prompt campaign-image-reviewer.md reestruturado — seção "Comportamento Esperado" com 5 variáveis contextuais
7. ✅ callVisionModel() trata empty_review como resultado estruturado (não exceção)
8. ✅ validatePrompts intent-aware — verifica variáveis contextuais e placeholders antigos
9. ✅ buildReviewPromptVariables() público — single source of truth para runtime e preflight
10. ✅ InputValidationService verificado — sem alterações necessárias
11. ✅ UAT structure criada — 5 cenários E2E com micro-runbook

**Dependencies:** Phase 31.2 (schemas tolerantes, desbloqueio de intents, 6 prompts, roteamento)

**Source of truth:** `openspec/changes/fase-31-3-quality-gate-por-intencao-comercial/`

**Plans:** 6 plans (3 waves)

| Plan | Wave | Objective |
|------|------|-----------|
| 31-3-01 | 1 | Schema + Foundation — ImageReviewInput, ReviewIssueType union, failureType null |
| 31-3-02 | 1 | Intent-Aware Review Service — 2-stage vars, expectedBadgeBehavior, empty_review |
| 31-3-03 | 2 | Prompt Restructuring — campaign-image-reviewer.md com variáveis contextuais |
| 31-3-04 | 2 | Pipeline Integration — buildReviewInput, validatePrompts intent-aware |
| 31-3-05 | 3 | Automated Tests — contract/drift tests, regressão |
| 31-3-06 | 3 | UAT Real — 5 cenários E2E com IA real |

---

### Phase 35 — Changelog/Novidades ✅

**Goal:** Dar voz ao produto — comunicar entregas dentro do app via changelog editorial em `content/changelog/*.md`, página `/novidades`, indicador na sidebar e anúncio contextual na dashboard, sem Supabase e sem dependências novas.

**Requirements:** F35-CONTENT-01 a F35-CONTENT-06, F35-STATE-01 a F35-STATE-06, F35-UI-01 a F35-UI-07, F35-APP-SHELL-01 a F35-APP-SHELL-03, F35-DASHBOARD-01 a F35-DASHBOARD-03

**Success criteria:**

1. Fonte de dados `content/changelog/*.md` com frontmatter YAML versionado (3 entries seed: F30, F32, F34)
2. Página `/novidades` com listagem cronológica DESC, badges de categoria e indicador de importância
3. "Novidades" como 5º item da sidebar com indicador de conteúdo novo; link secundário no AccountMenu
4. Card/modal de anúncio na dashboard controlado por `announcement: none|card|modal`; apenas o mais recente
5. Indicador via localStorage com dois controles independentes (visita × dispensa) — SSR-safe
6. Parser próprio de frontmatter + renderer controlado — zero dependências novas; Zod fail-fast no build
7. 14+ testes novos; typecheck, lint e build limpos
8. `docs/changelog-update.md` ajustado cirurgicamente se necessário (sem recriar)

**Dependencies:** Phase 30 (terminologia legal no seed), Phase 32 (Freemium CNPJ no seed), Phase 34 (Store Readiness no seed), design system, zod ^3.24.4, lucide-react

**Source of truth:** `openspec/changes/fase-35-changelog-novidades/`

**Renumeração (documentada nos alinhamentos F36/F38):** F35 = Changelog/Novidades; F36 = Onboarding — Navegação por Abas (nova, v1.5); F37 = Revisão e Aprovação da Arte (v1.5); F38 = Tabela de Custos por Operação (v1.5); Stripe/Monetização Pública deslocada para F39 (v1.7, pós-beta).

**Plans:** 5/5 plans complete

**Status:** 5/5 plans completos ✅
**Tests:** 1345 passing (170 files, 42 novos F35) — typecheck/lint/build limpos

**Wave 1** *(Foundation + Core Library — 35-02 depends on 35-01; roda após 35-01 na mesma wave)*

| Plan | Wave | Objective |
|------|------|-----------|
| 35-01 | 1 ✅ | Foundation — Seed content/changelog + Core Library (types, parser, renderer, schema) |
| 35-02 | 1 ✅ | Core Library — get-changelog.ts + Hook use-changelog-state |

**Wave 2** *(bloqueada na Wave 1 — 35-03 depende de 35-02; 35-04 depende de 35-03, roda após 35-03 na mesma wave)*

| Plan | Wave | Objective |
|------|------|-----------|
| 35-03 | 2 ✅ | Página /novidades + Componentes Changelog (card, list, announcement, sidebar-badge) |
| 35-04 | 2 ✅ | App Shell + Dashboard — fluxo latestEntryId, sidebar 5º item, AccountMenu, anúncio dashboard |

**Wave 3** *(bloqueada nas Waves 1–2 — 35-05 depende de todos os planos)*

| Plan | Wave | Objective |
|------|------|-----------|
| 35-05 | 3 ✅ | Testes + Verificação + Tracking — 14+ testes, typecheck/lint/build, renumeração STATE/ROADMAP |

**Cross-cutting constraints:**

- Zero dependências novas (D8) — parser próprio de frontmatter + renderer controlado; `zod` e `lucide-react` já presentes (todos os planos)
- Sem Supabase, sem requisição extra, sem estado global (D3/D7) — 35-02, 35-03, 35-04
- Datas exibidas como `dd/mm/aaaa` via `formatChangelogDate`, sem `new Date(ISO)` (fuso UTC-3) — 35-01, 35-03, 35-05
- XSS: `dangerouslySetInnerHTML` recebe exclusivamente saída de `renderMarkdown` (sanitizada) — 35-01, 35-03, 35-04
- Componentes client NUNCA importam `get-changelog`/`server-only` (fluxo por prop) — 35-02, 35-03, 35-04
- Chaves de estado `vendeo:last_seen_changelog_id` e `vendeo:dismissed_changelog_announcement_id` — 35-02, 35-03, 35-04

---

### Phase 36 — Onboarding: Navegação por Abas

**Goal:** Transformar o onboarding de loja em um painel de **3 abas** (Dados / Posicionamento / Direção Visual) em `/loja` com navegação por `?tab=`, desbloqueio progressivo com soft-block, aceite legal como coluna lateral global, auto-save confiável e rascunho `localStorage` com TTL 24h — e backend de criação de loja em **modo draft** sem CNPJ (loja draft não é loja pronta: não gera campanha nem recebe freemium até cadastro fiscal válido, exceto `is_test_store`).

**Requirements:** F36-TABS-01 a F36-TABS-05, F36-DRAFT-01 a F36-DRAFT-04, F36-AUTOSAVE-01 a F36-AUTOSAVE-04, F36-DRAFT-CREATE-01 a F36-DRAFT-CREATE-04, F36-IDENTITY-UI-01 a F36-IDENTITY-UI-07, F36-LEGAL-01 a F36-LEGAL-02, F36-READINESS-01 a F36-READINESS-04, F36-OWNERSHIP-01 a F36-OWNERSHIP-01

**Success criteria:**

1. `/loja` com 3 abas navegáveis por `?tab=` (back/forward funcionam); abas mobile compactas (Dados/Perfil/Visual)
2. Desbloqueio progressivo com `computeTabUnlock` (D1/D9): dados sempre aberta; posicionamento = nome+segmento+aceite legal+storeId; direção visual = storeId+tom de voz; CNPJ nunca bloqueia navegação
3. Aceite legal como coluna lateral global (`LegalAcceptancePanel`) bloqueia Posicionamento quando pendente/reaceite
4. Auto-save em troca de aba + navegação interna; abandono mobile protegido por localStorage TTL 24h (pagehide/visibilitychange síncronos)
5. Rascunho `localStorage` escopado por usuário, chaves `:new`/`:${storeId}`, limpo após 1º save e logout
6. Backend: `POST /api/store` em dois modos (draft × verified/fiscal) via RPC `create_store_draft` (sem grant freemium, `onboardingGranted: false`)
7. Loja draft não gera campanha nem recebe crédito; readiness reporta `cadastro_fiscal` pendente; `is_test_store` contorna fiscal só com entitlement de teste (F33)
8. Redirects/banners migrados para `?tab=` (guard `/campanhas/nova`, `/cadastro/cnpj`, ReadinessBanner); compat `required=` mantido
9. Drift detection integrada à navegação por abas (D13) — intercepta troca de aba, navegação interna, back/forward e saída da página; ordem e endpoints preservados
10. ARIA tabs completo (D11); touch targets ≥ 44px (F22); 34+ testes novos; typecheck/lint/build limpos

**Dependencies:** Phase 30 (legalClearance, ContractAcceptanceModal, getAcceptanceStatus), Phase 32/33 (CNPJ obrigatório na geração/crédito, update_store_cnpj, is_test_store), Phase 34 (check_store_readiness, getStoreReadiness, MissingItem), Phase 22 (touch targets ≥ 44px), design system (`openspec/design-system/MASTER.md` + `pages/store-identity.md`)

**Source of truth:** `openspec/changes/fase-36-onboarding-navegacao-por-abas/`

**Renumeração (D14 + F38):** F36 = Onboarding — Navegação por Abas (nova, v1.5); F37 = Revisão e Aprovação da Arte (v1.5, experimento beta); F38 = Tabela de Custos por Operação (v1.5); F39 = Stripe / Monetização Pública (v1.7, pós-beta).

**Plans:** 6/6 plans complete

**Wave 1** *(Backend + Core Library — 36-02 depende de 36-01; roda após 36-01 na mesma wave; 36-01 autonomous: no — requer supabase db push)*

| Plan | Wave | Objective |
|------|------|-----------|
| 36-01 | 1 | Backend — RPC create_store_draft + POST /api/store em dois modos + `[BLOCKING] supabase db push` |
| 36-02 | 1 | Core Library — tabs.ts, tab-state.ts, draft-store.ts + testes unitários |

**Wave 2** *(bloqueada na Wave 1 — auto-save/drift dependem da máquina de abas)*

| Plan | Wave | Objective |
|------|------|-----------|
| 36-03 | 2 | Auto-save, rascunho e drift — useOnboardingTabs (popstate back/forward), autoSave, drift estendido, cleanup logout |

**Wave 3** *(bloqueada nas Waves 1–2 — UI depende de tabs + auto-save)*

| Plan | Wave | Objective |
|------|------|-----------|
| 36-04 | 3 | UI — StoreTabs ARIA, LegalAcceptancePanel, form refactor, parsing `?tab=` |

**Wave 4** *(bloqueada na Wave 3 — migração de redirects para a nova navegação)*

| Plan | Wave | Objective |
|------|------|-----------|
| 36-05 | 4 | Migração de redirects/banners para `?tab=` + compat `required=` |

**Wave 5** *(bloqueada nas Waves 1–4 — testes/verificação completos + checkpoint humano; autonomous: no)*

| Plan | Wave | Objective |
|------|------|-----------|
| 36-06 | 5 | Testes endpoint/gates/draft→fiscal + regressão + verificação + tracking |

**Cross-cutting constraints:**

- CNPJ não bloqueia navegação no onboarding (D8); bloqueia apenas geração/crédito (gates F34/F32/F33)
- Loja draft não é loja pronta — `create_store_draft` NÃO chama `try_grant_onboarding_entitlement`/`grant_credits`; `onboardingGranted` hardcoded `false` (D15) — 36-01, 36-06
- Rascunho `localStorage` com TTL 24h, chaves `vendeo:store_draft:${userId}:new` / `:${storeId}`, limpo após 1º save e logout (D5)
- Escrita síncrona no abandono via pagehide/visibilitychange (D4/D5); PATCH no unload best-effort
- Drift: intercepta qualquer saída de contexto; ordem/endpoints preservados (D13) — 36-03
- `?tab=` sync back/forward via popstate (D6) — 36-03, 36-04, 36-05
- `?required=` legado aceito como compat (D6/D12)
- ARIA tabs + touch targets ≥ 44px (D11/F22)

---

### Phase 38 — Tabela de Custos por Operação

**Goal:** Criar a fonte única de custo por operação (`credit_operation_costs`) e substituir o hardcoded (`COST_PER_GENERATION = 1`, literal `1` na rota de VS, "1 crédito" na UI) por custo dinâmico resolvido em runtime — com admin sem deploy, auditoria old/new e ledger auto-descritivo via metadata snapshot.

**Requirements:** F38-DB-01 a F38-DB-04, F38-SERVICE-01 a F38-SERVICE-04, F38-API-01 a F38-API-03, F38-ADMIN-01 a F38-ADMIN-04, F38-ROUTES-01 a F38-ROUTES-04, F38-UI-01 a F38-UI-05, F38-VS-01, F38-CONFIG-01 a F38-CONFIG-02

**Success criteria:**

1. Tabela `credit_operation_costs` + seeds (`campaign_generation=1`, `visual_signature_generation=1`) + RLS service_role (D2)
2. Tabela `credit_operation_cost_audit` append-only + RPC `admin_update_operation_cost` transacional e idempotente (D8)
3. `OperationCostService.getCost(operationKey)` server-only: `source: 'table' | 'fallback'` (linha inexistente) e `OperationCostUnavailableError` em erro de leitura (fail-closed, D5)
4. Rotas de geração (campanha e VS) resolvem custo uma vez: guard `enabled=false` → 503, balance dinâmico, reserva com metadata snapshot (D12)
5. `GET /api/operation-costs` (autenticado) + `useOperationCosts()` para client; server components leem o service (D11)
6. `GET`/`PUT /api/admin/operation-costs` (requireAdmin) + página `/admin/operation-costs` (D9/D10)
7. UI dinâmica: `campaign-input-form`, `balance-card`, `drift-critical-modal`, `visual-signature-approval-modal` — sem "1 crédito" hardcoded (D11)
8. Remoção de `COST_PER_GENERATION` de `src/lib/image-generation/config.ts` (D12)
9. `npx vitest run`, `npm run typecheck`, `npm run lint`, `npm run build` — zero erros

**Dependencies:** Phase 24 (CreditService, reserve_credit, credit_balances), Phase 25 (generate-image route), Phase 28 (launch config, generationPaused), Phase 29.1.1 (generate-without-logo + credit_tx_id), Phase 34 (readiness guards), Phase 36 (form/UI flow), Phase 35 (navegação admin)

**Source of truth:** `openspec/changes/fase-38-credit-operation-costs/`

**Plans:** 7/8 plans executed

| Plan | Wave | Objective | Requirements | Files |
|------|------|-----------|--------------|-------|
| 38-01 | 1 | Migration SQL (tabelas + RPC + seeds) + [BLOCKING] schema push | F38-DB-01 a 04 | `20260807000001_f38_create_credit_operation_costs.sql` |
| 38-02 | 1 | Core Library — OPERATION_KEYS + OperationCostService + testes | F38-SERVICE-01 a 04 | types.ts, operation-cost-service.ts |
| 38-03 | 2 | generate-image — custo dinâmico + guards + snapshot + remoção COST_PER_GENERATION | F38-ROUTES-01/02/04, F38-CONFIG-01/02 | generate-image route, config.ts, 4 testes |
| 38-04 | 2 | generate-without-logo — custo dinâmico + guards + metadata snapshot VS | F38-ROUTES-01/03, F38-VS-01, F38-CONFIG-01/02 | VS route, 3 testes |
| 38-05 | 3 | Admin — UpdateOperationCostRequestSchema + getAllCosts + API GET/PUT + página | F38-ADMIN-01 a 04 | schemas.ts, service, admin route/page, layout |
| 38-06 | 3 | Dados client — GET /api/operation-costs + formatCredits + useOperationCosts | F38-API-01 a 03, F38-UI-02/05 | operation-costs route, format.ts, hook, balance-card |
| 38-07 | 4 | UI dinâmica — campaign-input-form + modais + testes | F38-UI-01/03/04 | 3 componentes + 4 testes |
| 38-08 | 5 | Testes e Verificação — I1–I6 SQL/integrado (banco real) + build gate + UAT | F38-DB-04, F38-SERVICE-02/03, F38-CONFIG-01/02 | verify script, integration test/config, 38-UAT.md |

---

### Phase 38.1 — Apuração de Custos de IA por Entrega

**Goal:** Criar a **trilha granular de custo de IA** (evento por chamada real, agregado por entrega via `operation_run_id`) e as **views/RPCs de apuração e reconciliação** (USD × créditos) que transformam telemetria em inteligência econômica — corrigindo os 7 furos verificados em código (copy sem custo, `metadata.totalCost` errado, modelos sem preço, revisão/validação sem evento, VS sem custo/tokens, `attempt_number` sempre 1, `duration_ms` do pipeline inteiro).

**Requirements:** F38.1-01 a F38.1-38 (derivados dos 13 specs OpenSpec)

**Success criteria:**

1. `generation_events` evoluído — colunas `operation_run_id`, `operation_run_type`, `visual_signature_id`, `theme_id`, `cached_input_tokens`, `image_tokens`, `provider_reported_cost_usd`, `cost_source` (CHECK 5 valores), `pricing_version` + CHECK `generation_type` expandido (6 tipos call-level novos) + índices (D2/D4/D5)
2. `campaigns.operation_run_id` persistido na criação da campanha (preparo reuso F37) + índice (D1/D2)
3. `AiCostTracker` como **único caminho de escrita** (best-effort, nunca lança), substituindo os 4 inserts inline da rota de campanha, os inserts de VS e o helper `insertGenerationEvent` (que delega) (D7)
4. `resolveAiCost` por fonte `provider_reported → pricing_table → fallback_static → not_available`, com `cost_source` (5 valores) e `pricing_version`; corrige gemini-3.1-flash-lite, gpt-image-2, cached/image tokens (D9)
5. `ai_model_pricing` versionada (`effective_from`/`effective_until`, CHECK `at_least_one_price`) + seeds verificáveis + RPC `admin_set_ai_model_price` (SECURITY DEFINER, `p_reason` antes dos opcionais) + `GET`/`PUT /api/admin/ai-model-pricing` — **sem página** (D8)
6. Serviços expõem usage via callback opcional `onCall?: (info: AiCallInfo) => void` — copy, input validation, image review, image generation (attempt/duration), VS generator/validator, brand profiler, brand director, text-only (D7/D11)
7. Rotas instrumentadas: `generate-image` (copy/validation/image/review call-level + delivery `campaign_pipeline` sem custo/tokens + `totalCost` soma real), `generate-without-logo` (`visual_signature_image`/`validation` com custo/tokens + delivery sem custo + nova tentativa pós-falha = novo run), rotas `/brand-profile/*` (delivery + call — hoje sem nenhum evento) (D11/D1)
8. Views `admin_ai_operation_costs`, `admin_campaign_delivery_costs`, `admin_ai_cost_by_provider_model`, `admin_ai_cost_by_stage`, `admin_ai_cost_by_store` + `admin_cost_vs_credits` (reconciliação USD × créditos) + RPC `admin_get_ai_costs` — somam **apenas call-level** (anti-dupla-contagem); valor contábil `COALESCE(provider_reported_cost_usd, estimated_cost_usd)` (D10/D3)
9. `admin_get_metrics` (F28) inalterado; `reserve_credit`/`credit_transactions` (F24) intactos; sem tabela `operation_runs`; sem UI admin de pricing/reconciliação (D1/D10)
10. Furos 1–7 corrigidos; `npx vitest run`, `npm run typecheck`, `npm run lint`, `npm run build` — zero erros; 50 testes novos + verificação SQL/integrada I1–I6 + regressão completa

**Dependencies:** Phase 24 (ledger `credit_transactions` — reconciliação por leitura), Phase 25/F28 (pipeline + telemetria, `admin_get_metrics`), Phase 29.1.1 (VS), Phase 37 (aprovação — decisão, não custa IA), Phase 38 (`credit_operation_costs` — eixo créditos), Phase 39 (Stripe — consumirá o custo real)

**Source of truth:** `openspec/changes/fase-38-1-ai-cost-accounting/`

**Plans:** 11 plans (6 waves)

```
Plans:
- [x] 38-1-01-PLAN.md — Migração + db push [BLOCKING: pós-deploy] (Wave 1) ✅ (aplicada no remoto 2026-08-08)
- [x] 38-1-02-PLAN.md — Types + AiCostTracker (Wave 2)
- [x] 38-1-03-PLAN.md — Admin APIs pricing (Wave 2)
- [x] 38-1-04-PLAN.md — Estimador + pricing (Wave 3)
- [x] 38-1-05-PLAN.md — Campaign onCall (Wave 3) ✅ (D11 event contract + onCall copy/validation/review/image-gen — 1657 testes)
- [x] 38-1-06-PLAN.md — VS/brand onCall (Wave 3) ✅ (AiImageGenerator.generate onCall usage Responses API + BrandProfiler onCall visão from-zero — 1661 testes)
- [ ] 38-1-07-PLAN.md — generate-image + 6.3 (Wave 4)
- [ ] 38-1-08-PLAN.md — generate-without-logo + 6.4 (Wave 4)
- [ ] 38-1-09-PLAN.md — brand rotas + 6.5 (Wave 4)
- [ ] 38-1-10-PLAN.md — Views/RPCs + verificação + gates [checkpoint] (Wave 5)
- [ ] 38-1-11-PLAN.md — Runbook trackings (Wave 6)
```

---

## Dependency Graph

```
Phase 23 (TextProvider + Copy Director) ──┐
                                            ├──▶ Phase 25 (Pipeline v1.5)
Phase 24 (Credit Tables + CreditService) ──┘
                                                │
                      ┌─────────────────────────┼──────────────────┐
                      ▼                         ▼                  ▼
            Phase 26 (Admin Ops)       Phase 27 (UI Saldo)   Phase 30 (Legal)
                      │                         │                  │
                      └─────────┬───────────────┘                  │
                                ▼                                  │
                      Phase 28 (Observability + Ops)               │
                                │                                  │
                                ▼                                  │
                      Phase 29 (Refinement + Launch)               │
                                │                                  │
                                └──────────┬───────────────────────┘
                                            ▼
                                 Phase 31.1 (Modelo Comercial — Formulário)
                                            │
                                            ▼
                                 Phase 31.2 (Diretores por Intenção)
                                             │
                                             ▼
                                  Phase 31.3 (Quality Gate por Intenção Comercial) ✅
                                             │
                                             ▼
                                  Phase 32 (Freemium Anti-Abuso CNPJ) ✅
                                             │
                                             ▼
                                  Phase 33 (Verificação CNPJ Freemium) ✅
                                             │
                                             ▼
                                  Phase 34 (Store Readiness) ✅
                                             │
                                             ▼
                                    Phase 35 (Changelog/Novidades) ✅
                                               │
                                               ▼
                                     Phase 36 (Onboarding — Navegação por Abas) ✅
                                               │
                                               ▼
                                     Phase 37 (Revisão e Aprovação da Arte — v1.5)
                                               │
                                               ▼
                                     Phase 38 (Tabela de Custos por Operação — v1.5)
                                               │
                                               ▼
                                     Phase 39 (Stripe / Monetização Pública — v1.7 futura)
```

---

## Dependency Graph

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
| INTENT-01 | Phase 31.1 | Done ✓ |
| INTENT-02 | Phase 31.1 | Done ✓ |
| INTENT-03 | Phase 31.1 | Done ✓ |
| INTENT-04 | Phase 31.1 | Done ✓ |
| INTENT-05 | Phase 31.1 | Done ✓ |
| INTENT-06 | Phase 31.1 | Done ✓ |
| INTENT-07 | Phase 31.1 | Done ✓ |
| INTENT-08 | Phase 31.1 | Done ✓ |
| INTENT-09 | Phase 31.1 | Done ✓ |
| INTENT-10 | Phase 31.1 | Done ✓ |
| INTENT-11 | Phase 31.1 | Done ✓ |
| INTENT-12 | Phase 31.1 | Done ✓ |
| PAY-01 | Phase 32/v1.7 | Deferred |
| PAY-02 | Phase 32/v1.7 | Deferred |
| PAY-03 | Phase 32/v1.7 | Deferred |
| PAY-04 | Phase 32/v1.7 | Deferred |
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
| LAUNCH-01 | Phase 29 | Done ✓ |
| LAUNCH-02 | Phase 29 | Done ✓ |
| LAUNCH-03 | Phase 29 | Done ✓ |
| LAUNCH-04 | Phase 29 | Done ✓ |
| LAUNCH-05 | Phase 29 | Done ✓ |
| LAUNCH-06 | Phase 29 | Done ✓ |
| SEC-01 | Phase 29 | Done ✓ |
| SEC-02 | Phase 29 | Done ✓ |
| SEC-03 | Phase 29 | Done ✓ |
| SEC-05 | Phase 29 | Done ✓ |

**Coverage:**

- v1 requirements: 139 total (107 v1.5 + 12 INTENT + 8 F34 + 12 F35-CHANGELOG/UI etc.)
- Mapped to phases: 139
- Completed: 127
- Unmapped: 0 ✓
- Deferred to v1.7: PAY-01, PAY-02, PAY-03, PAY-04, PAY-05, PAY-06

---

*Roadmap created: 2026-07-15*
*Milestone: v1.5 — Lançamento Externo Controlado*
*Last updated: 2026-08-08 — Phase 38 complete (Tabela de Custos por Operação — 8/8 plans, 1597 testes, UAT 4/4); renumeração F37 = Revisão e Aprovação da Arte (v1.5), F38 = Tabela de Custos por Operação (v1.5), F39 = Stripe/Monetização Pública (v1.7); **Phase 38.1 (Apuração de Custos de IA por Entrega — desdobramento da F38, v1.5) em execução — 6/11 plans concluídos (38-1-01 ✅ migration + schema push aplicado no remoto 2026-08-08; 38-1-02 ✅ types + AiCostTracker; 38-1-03 ✅ admin routes ai-model-pricing + ai-costs; 38-1-04 ✅ resolveAiCost + pricing service; 38-1-05 ✅ D11 event contract + onCall copy/validation/review/image-gen, 1657 testes; 38-1-06 ✅ VS generator onCall Responses API + BrandProfiler onCall visão, 1661 testes)** — fonte `openspec/changes/fase-38-1-ai-cost-accounting/`*
