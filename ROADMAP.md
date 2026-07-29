# Vendeo — Roadmap

> Milestones: **Contas e Propriedade** (v1.2 ✓) | **Persistência e Entrega da Campanha** (v1.3 ✓) | **Experiência SaaS** (v1.4 ✓) | **Lançamento Externo Controlado** (v1.5 ◆)

## Milestones

- ✅ **v1.4 Experiência SaaS** — F18-F22 (shipped 2026-07-15)
- ✅ **v1.3 Persistência e Entrega da Campanha** — F12-F17 (shipped 2026-07-10)
- ✅ **v1.2 Contas e Propriedade** — F7-F11 (shipped 2026-07-08)
- ✅ **v1.1 Motor de Campanhas** — shipped 2026-07-03
- ✅ **v1.0 Core de Geração** — shipped 2026-07-03

## Phases

<details>
<summary>✅ v1.4 Experiência SaaS (F18-F22) — SHIPPED 2026-07-15</summary>

O Vendeo passou a parecer e funcionar como um produto SaaS coerente — app shell profissional, navegação PT-BR, dashboard, onboarding, busca e mobile.

- [x] Phase 18: App Shell + UI Base + Rotas (3/3 plans) — 2026-07-13
- [x] Phase 19: Onboarding & Estados Vazios (3/3 plans) — 2026-07-13
- [x] Phase 20: Dashboard (3/3 plans) — 2026-07-13
- [x] Phase 21: Histórico e Busca (3/3 plans) — 2026-07-14
- [x] Phase 22: Mobile Hardening (3/3 plans) — 2026-07-15

</details>

<details>
<summary>✅ v1.3 Persistência e Entrega da Campanha (F12-F17) — SHIPPED 2026-07-10</summary>

O usuário gera uma campanha, sai do sistema, volta depois e consegue encontrá-la e baixá-la.

- [x] Phase 12: Fundação DB/Storage (5/5 plans) — 2026-07-09
- [x] Phase 13: Serviço de Persistência e Download (3/3 plans) — 2026-07-09
- [x] Phase 14: Integração no Fluxo de Geração (3/3 plans) — 2026-07-10
- [x] Phase 15: Página de Campanha (3/3 plans) — 2026-07-10
- [x] Phase 16: Minhas Campanhas (3/3 plans) — 2026-07-10
- [x] Phase 17: Edição de Publication Copy (2/2 plans) — 2026-07-10

</details>

<details>
<summary>✅ v1.2 Contas e Propriedade (F7-F11) — SHIPPED 2026-07-08</summary>

Autenticação completa, vínculo user→store, isolamento multi-tenant, beta.vendeo.tech operacional.

- [x] Phase 7: Sessão e Login Vertical (5/5 plans) — 2026-07-04
- [x] Phase 8: Ciclo de Conta (4/4 plans) — 2026-07-06
- [x] Phase 9: Cutover de Ownership e Onboarding (4/4 plans) — 2026-07-06
- [x] Phase 10: Perímetro Multi-tenant (6/6 plans) — 2026-07-07
- [x] Phase 11: Verificação e Hardening (1/1 plan) — 2026-07-08

</details>

### 📋 v1.5 — Lançamento Externo Controlado ◆

Copy Director com IA, pipeline de geração paralelo, sistema de créditos, admin operacional para suporte beta, UI de saldo e extrato, créditos mensais automáticos, observabilidade, launch readiness, UAT externo, fundação legal, modelo comercial, freemium anti-abuso CNPJ e Stripe.

<details open>
<summary>◆ v1.5 Lançamento Externo Controlado (F23-F35) — Em andamento</summary>

Copy Director com IA, pipeline de geração paralelo, sistema de créditos, admin operacional para suporte beta, UI de saldo e extrato, créditos mensais automáticos, observabilidade, launch readiness, fundação legal, modelo comercial e store readiness.

- [x] Phase 23: Text Provider + Copy Director (2/2 plans ✅)
- [x] Phase 24: Créditos — Schema, Saldo e Transações (2/2 plans ✅)
- [x] Phase 25: Pipeline de Geração v1.5 (3 plans ✅)
- [x] Phase 26: Admin Operacional + Convites + Créditos Manuais (3 plans ✅)
- [x] Phase 27: Conta + Saldo Visível + Extrato (3 plans ✅)
- [x] Phase 28: Observabilidade + Operação + Launch Controls (4 plans ✅)
- [x] Phase 29: Refinamento Visual + UAT + Launch Readiness (4/4 plans ✅)
- [x] Phase 29.1.1: Créditos na Assinatura Visual (3 plans ✅)
- [x] Phase 29.1.2: Histórico Curto + Assinatura Visual (3 plans ✅)
- [x] Phase 29.3: Créditos Mensais Automáticos (4/4 plans ✅)
- [x] Phase 30: Fundação Legal (6/6 plans ✅)
- [x] Phase 31.1: Modelo Comercial — Formulário (5/5 plans ✅)
  - CampaignIntent type (`"offer" | "spotlight" | "exclusive"`)
  - Inferência automática de intent a partir dos campos de preço
  - Seletor de intent no formulário com "Em breve" para spotlight/exclusive
  - Badge options separados por intent
  - preserveImageContext checkbox (visível apenas em spotlight/exclusive)
  - Pipeline guard para rejeitar intents não-offer

- [x] Phase 31.2: Diretores por Intenção (6 plans ✅)
  - Schemas tolerantes: discountedPriceCents opcional, CampaignSpecSchema nullable
  - Desbloqueio de spotlight/exclusive na UI, form e pipeline
  - 6 prompts separados por intent (3 image + 3 copy)
  - Roteamento de prompt por campaignIntent nos diretores de imagem e copy
  - commercialFrame substituindo offer no Copy Director
  - Conteúdo adaptado por intent (repertoire, guidance, fallback determinístico)
  - Normalização de exclusive com preço indevido
  - 15 testes, regressão zero para offer, 1051 testes totais

- [x] Phase 31.3: Quality Gate por Intenção Comercial (6 plans ✅)
  - ImageReviewInput com campaignIntent, preserveImageContext; badgeText/discountedPrice opcionais
  - ReviewIssueType union nomeada (17 valores); failureType string | null explícito
  - commercial_tone_mismatch como novo issue type
  - Prompt campaign-image-reviewer.md reestruturado com variáveis contextuais (expectedPriceBehavior, expectedBadgeBehavior, expectedImageTreatment, expectedCommercialTone, campaignIntentLabel)
  - review() monta variáveis em 2 etapas; expectedBadgeBehavior com 3 variantes por intent
  - callVisionModel trata empty_review como resultado estruturado
  - validatePrompts intent-aware com verificação de placeholders antigos
  - applyValidationContextToReviewResult reconhece commercial_tone_mismatch como non-removable
  - InputValidationService verificado (sem alteração)
  - 5 cenários E2E com IA real

- [x] Phase 32: Freemium Anti-Abuso CNPJ (5/5 plans ✅)
  - CNPJ obrigatório na criação da loja com validação de dígitos verificadores + formato
  - `stores.cnpj_normalized` + `stores.cnpj_root_hash` — CNPJ normalizado, hash HMAC-SHA256 da raiz com pepper server-side
  - `freemium_entitlements` — tabela de controle com idempotência (INSERT ... ON CONFLICT)
  - Onboarding grant (10 créditos) uma única vez por raiz de CNPJ
  - Créditos mensais (5 créditos) uma única vez por raiz de CNPJ por ciclo
  - Admin: CNPJ mascarado, badge de status freemium, exceção manual auditável
  - Termos de Uso v1.2 e Política de Privacidade v1.1
  - Lojas legadas: atualização cadastral sem novo grant de créditos
  - Pipeline guard de reaceite v1.2

- [ ] Phase 33: Verificação CNPJ Freemium (planned ◆)
  - Consulta cadastral externa de CNPJ — BrasilAPI como provedor primário, CNPJá como fallback, tratamento de timeout/erro/rate limit
  - Preenchimento automático de dados oficiais no formulário de criação de loja (razão social/nome fantasia bloqueados, endereço editável)
  - Cross-check de verossimilhança — nome da loja vs razão social/nome fantasia oficiais, cidade/UF informada vs oficial
  - Motor de decisão determinístico de elegibilidade: approve / review / reject / defer
  - Liberação condicional do freemium — concede onboarding grant apenas se decisão = approve
  - Cache de consulta CNPJ com TTL 24h (tabela `cnpj_lookup_cache`)
  - Fila de revisão admin (`/admin/reviews`) com abas Pendentes/Adiados/Recusados/Aprovados, ações Aprovar/Recusar/Exceção com audit trail
  - Criação de store de teste pelo admin com CNPJ fictício (`is_test_store`)
  - Revelação de CNPJ auditada no admin com registro em admin_audit_log
  - Mensagens ao usuário por estado (lookup, approve, review, reject, defer)
  - **Dependências:** F32 (cnpj validation, freemium entitlements, store route, admin), F30 (legal clearance, admin_audit_log), F24 (credit_transactions)
  - **Plans:**
    - [ ] 33-01-PLAN.md — Migration + Core Libraries (Lookup, Verification, Risk Service)
    - [ ] 33-02-PLAN.md — Store Route + Grant Conditional
    - [ ] 33-03-PLAN.md — Store Identity Form + Dashboard Banners
    - [ ] 33-04-PLAN.md — Admin Reviews + Test Stores + Privacy
    - [ ] 33-05-PLAN.md — Tests + Verification

- [ ] Phase 34: Store Readiness (pending)
  - getStoreReadiness() com RPC check_store_readiness — ready: boolean, missing: MissingItem[]
  - Guarda dupla: server component (/campanhas/nova) + API (412 Precondition Required)
  - Step 2 renomeado para "Direção Visual" com badge "Necessário", três caminhos (logo, VS, text-only)
  - Store type com campos CNPJ tipados (eliminar casts as unknown)
  - StoreBillingInfo type + tabela store_billing_info (não bloqueante)
  - Card colapsável de billing no Step 1 com pré-preenchimento via BrasilAPI/CNPJá
  - Dashboard banner de prontidão com checklist de pendências
  - Migration SQL: tabela store_billing_info + RPC check_store_readiness()
  - Dependências: F32 (cnpj_normalized, razao_social, nome_fantasia), F33 (store_brand_profiles, verification_status), F30 (legal clearance)

- [ ] Phase 35: Stripe / Monetização Pública (pending)
</details>

## Progress

| Phase | Milestone | Plans | Status | Completed |
|-------|-----------|-------|--------|-----------|
| 7. Sessão e Login Vertical | v1.2 | 5/5 | ✅ Complete | 2026-07-04 |
| 8. Ciclo de Conta | v1.2 | 4/4 | ✅ Complete | 2026-07-06 |
| 9. Cutover de Ownership | v1.2 | 4/4 | ✅ Complete | 2026-07-06 |
| 10. Perímetro Multi-tenant | v1.2 | 6/6 | ✅ Complete | 2026-07-07 |
| 11. Verificação e Hardening | v1.2 | 1/1 | ✅ Complete | 2026-07-08 |
| 12. Fundação DB/Storage | v1.3 | 5/5 | ✅ Complete | 2026-07-09 |
| 13. Serviço de Persistência | v1.3 | 3/3 | ✅ Complete | 2026-07-09 |
| 14. Integração no Fluxo de Geração | v1.3 | 3/3 | ✅ Complete | 2026-07-10 |
| 15. Página de Campanha | v1.3 | 3/3 | ✅ Complete | 2026-07-10 |
| 16. Minhas Campanhas | v1.3 | 3/3 | ✅ Complete | 2026-07-10 |
| 17. Edição de Publication Copy | v1.3 | 2/2 | ✅ Complete | 2026-07-10 |
| 18. App Shell + UI Base + Rotas | v1.4 | 3/3 | ✅ Complete | 2026-07-13 |
| 19. Onboarding & Estados Vazios | v1.4 | 3/3 | ✅ Complete | 2026-07-13 |
| 20. Dashboard | v1.4 | 3/3 | ✅ Complete | 2026-07-13 |
| 21. Histórico e Busca | v1.4 | 3/3 | ✅ Complete | 2026-07-14 |
| 22. Mobile Hardening | v1.4 | 3/3 | ✅ Complete | 2026-07-15 |
| 23. Text Provider + Copy Director | v1.5 | 2/2 | ✅ Complete | 2026-07-16 |
| 24. Créditos — Schema, Saldo e Transações | v1.5 | 2/2 | ✅ Complete | 2026-07-16 |
| 25. Pipeline de Geração v1.5 | v1.5 | 3/3 | ✅ Complete | 2026-07-17 |
| 26. Admin Operacional + Convites + Créditos Manuais | v1.5 | 3/3 | ✅ Complete | 2026-07-18 |
| 27. Conta e Saldo Visível + Extrato | v1.5 | 3/3 | ✅ Complete | 2026-07-18 |
| 28. Observabilidade + Operação + Launch Controls | v1.5 | 4/4 | ✅ Complete | 2026-07-19 |
| 29. Refinamento Visual + UAT + Launch Readiness | v1.5 | 4/4 | ✅ | 2026-07-20 |
| 29.1.1. Créditos na Assinatura Visual | v1.5 | 3/3 | ✅ Complete | 2026-07-21 |
| 29.1.2. Histórico Curto + Assinatura Visual | v1.5 | 3/3 | ✅ Complete | 2026-07-22 |
| 29.3. Créditos Mensais Automáticos | v1.5 | 4/4 | ✅ Complete | 2026-07-22 |
| 30. Fundação Legal | v1.5 | 6/6 | ✅ Complete | 2026-07-23 |
| 31.1. Modelo Comercial — Formulário | v1.5 | 5/5 | ✅ Complete | 2026-07-24 |
| 31.2. Diretores por Intenção | v1.5 | 6/6 | ✅ Complete | 2026-07-25 |
| 31.3. Quality Gate por Intenção Comercial | v1.5 | 6/6 | ✅ Complete | 2026-07-26 |
| 32. Freemium Anti-Abuso CNPJ | v1.5 | 5/5 | ✅ Complete | 2026-07-27 |
| 33. Verificação CNPJ Freemium | v1.5 | 0/5 | ◆ Planning | — |
| 34. Store Readiness | v1.5 | 0/0 | ○ Pending | — |
| 35. Stripe / Monetização Pública | v1.5 | 0/0 | ○ Pending | — |

---

_For milestone details, see `.planning/milestones/v1.4-ROADMAP.md` and `.planning/MILESTONES.md`_
