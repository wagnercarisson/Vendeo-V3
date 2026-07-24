# Vendeo — Roadmap

> Milestones: **Contas e Propriedade** (v1.2 ✓) | **Persistência e Entrega da Campanha** (v1.3 ✓) | **Experiência SaaS** (v1.4 ✓) | **Lançamento Externo Controlado** (v1.5 ◆) | **Monetização Pública** (v1.7 △)

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

Copy Director com IA, pipeline de geração paralelo, sistema de créditos, admin operacional para suporte beta, UI de saldo e extrato, créditos mensais automáticos, observabilidade, launch readiness, UAT externo, fundação legal e modelo comercial — formulário com intenção comercial.

<details open>
<summary>◆ v1.5 Lançamento Externo Controlado (F23-F31.1) — Em andamento</summary>

Copy Director com IA, pipeline de geração paralelo, sistema de créditos, admin operacional para suporte beta, UI de saldo e extrato, créditos mensais automáticos, observabilidade, launch readiness, fundação legal e modelo comercial.

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

</details>

### 📋 v1.7 — Monetização Pública △

> Stripe Checkout + Webhook + compra real de créditos. Ativado após validação do beta controlado.

- [ ] Phase 32: Stripe / Monetização Pública (planned)

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

---

_For milestone details, see `.planning/milestones/v1.4-ROADMAP.md` and `.planning/MILESTONES.md`_
