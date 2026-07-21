# Vendeo — Roadmap

> Milestones: **Contas e Propriedade** (v1.2 ✓) | **Persistência e Entrega da Campanha** (v1.3 ✓) | **Experiência SaaS** (v1.4 ✓) | **Lançamento Externo Controlado** (v1.5 ◆) | **Monetização Pública** (v1.6 △)

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

Copy Director com IA, pipeline de geração paralelo, sistema de créditos, admin operacional para suporte beta, UI de saldo e extrato, observabilidade, launch readiness e UAT externo.

- [x] Phase 23: Text Provider + Copy Director (2/2 plans ✅) — 2026-07-16
- [x] Phase 24: Créditos — Schema, Saldo e Transações (2/2 plans ✅) — 2026-07-16

<details>
<summary>✅ v1.5 Lançamento Externo Controlado (F23-F29) — In Progress</summary>

Copy Director com IA, pipeline de geração paralelo, sistema de créditos, admin operacional para suporte beta, UI de saldo e extrato, observabilidade e launch readiness.

- [x] Phase 23: Text Provider + Copy Director (2/2 plans ✅)
- [x] Phase 24: Créditos — Schema, Saldo e Transações (2/2 plans ✅)
  - Wave 1: 24-01 — Migration SQL + CreditService (SQL DDL, 3 functions, types, service)
  -   Wave 2: 24-02 — Tests + SQL Verification (25+ testes, I1–I7)
- [x] Phase 25: Pipeline de Geração v1.5 (3 plans ✅)
- [x] Phase 26: Admin Operacional + Convites + Créditos Manuais (3 plans ✓)
  - Wave 1: 26-01 — Migration + Gate + Middleware + Layout
  - Wave 2: 26-02 — API Routes + Páginas Admin
  - Wave 3: 26-03 — Testes e Verificação (21+)
- [x] Phase 27: Conta + Saldo Visível + Extrato (3 plans ✅)
  - Wave 1: 27-01 — CreditService Session + BalanceDisplay + BalanceCard
  - Wave 2: 27-02 — TransactionHistory + CreditCta + Dashboard + /conta + Geração
  - Wave 3: 27-03 — Testes e Verificação (20 novos testes, 852 total)
- [x] Phase 28: Observabilidade + Operação + Launch Controls (4 plans ✅)
  - Wave 1: 28-01 — Launch Config + AI Cost Estimator + Pipeline Logger (3 módulos, 16 testes)
  - Wave 2: 28-02 — Migrations + Pipeline Integration + Rate Limit (2 SQL, pipeline instrumentado)
  - Wave 3: 28-03 — Pipeline Metrics + Admin Dashboard + Documentação (7 funções, 3 docs)
  - Wave 4: 28-04 — Testes e Verificação — Concorrência, Telemetria, Regressão + UAT (7+28 testes)
- [x] Phase 29: Refinamento Visual + UAT + Launch Readiness (4/4 plans ✅)
  - [x] 29-01 — Componentes Base + Loading States (12) + Error Boundaries (2)
  - [x] 29-02 — Empty States (7) + Error States (4) + Microcopy (7 fluxos) + Admin Visual
  - [x] 29-03 — Mobile Hardening (6 áreas) + Legibilidade + Launch Readiness Docs
  - [x] 29-04 — UAT Externo + Regressão + Validação Visual Final
- [ ] Phase 29.1.1: Créditos na Assinatura Visual (3 plans △)
  - △ 29-1-1-01 — Backend Foundation — Types, CreditService, Routes
  - △ 29-1-1-02 — Frontend — Modal UI + Ocultar Modal Antigo
  - △ 29-1-1-03 — Testes e Verificação — 20+ testes

</details>

### 📋 v1.6 — Monetização Pública △

> Stripe Checkout + Webhook + compra real de créditos. Ativado após validação do beta controlado.

- [ ] Phase 30/v1.6: Stripe / Monetização Pública (planned)

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
| 29.1.1. Créditos na Assinatura Visual | v1.5 | 0/3 | △ | — |

---

_For milestone details, see `.planning/milestones/v1.4-ROADMAP.md` and `.planning/MILESTONES.md`_
