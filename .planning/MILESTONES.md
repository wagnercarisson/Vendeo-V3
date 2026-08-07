# Milestones

## v1.5 — Lançamento Externo Controlado ◆

**Status:** Em andamento
**Phases:** 13 (F23-F31.1) | **Plans:** 39/39 concluídos + F31.1 em planejamento
**Tests:** 1018 passing (125 files)
**TypeScript:** Clean | **Lint:** Clean | **Build:** Clean

### Delivered

Copy Director com IA (F23), pipeline de geração paralelo com créditos (F24-F25), admin operacional (F26), UI de saldo e extrato (F27), observabilidade e launch controls (F28), refinamento visual e UAT externo (F29), créditos mensais automáticos (F29.3), assinatura visual com créditos (F29.1.1-F29.1.2), fundação legal (F30).

### In Progress

**F31.1 — Modelo Comercial — Formulário:** CampaignIntent type (offer/spotlight/exclusive), inferência automática a partir de preços, seletor de intent no formulário com bloqueio de submissão para spotlight/exclusive, badge options por intent, preserveImageContext checkbox, pipeline guard.

### Known Gaps

- Stripe / Monetização Pública diferido para v1.7 (F39)

---

## v1.4 — Experiência SaaS ✅

**Shipped:** 2026-07-15
**Phases:** 5 (F18-F22) | **Plans:** 18/18
**Tests:** 579→713 (+134) | **UAT:** 61/61 ✅
**TypeScript:** Clean | **Lint:** Clean | **Build:** Clean

### Delivered

O Vendeo passou a parecer e funcionar como um produto SaaS coerente — app shell profissional, navegação PT-BR, dashboard, onboarding, busca e mobile.

### Key Accomplishments

1. **App Shell + PT-BR Routes** — 7 UI components, sidebar/topbar/drawer, 5 redirects 301, navegação SaaS profissional
2. **Onboarding & Empty States** — Helper 3 estados, dashboard inteligente, redirects substituídos por orientação contextual
3. **Dashboard Real** — Saudação com 3 períodos, 3 cards de métricas, campanhas recentes, card de próximo passo adaptativo
4. **Histórico e Busca** — Busca ILIKE, filtros status/data, ordenação, paginação page-based, URL state compartilhável
5. **Mobile Hardening** — Drawer com focus trap + a11y, touch targets ≥44px, responsivo 320/375/768px, 21/21 UAT

### Known Gaps

- 4 orphaned exports (non-critical dead code accepted as tech debt)

---

## v1.3 — Persistência e Entrega da Campanha ✅

**Shipped:** 2026-07-10
**Phases:** 6 (F12-F17) | **Plans:** 20/20
**Tests:** 579 passing

### Delivered

O usuário gera uma campanha, sai do sistema, volta depois e consegue encontrá-la e baixá-la.

---

## v1.2 — Contas e Propriedade ✅

**Shipped:** 2026-07-08
**Phases:** 5 (F7-F11) | **Plans:** 20/20
**Tests:** 457 passing

### Delivered

Autenticação completa, vínculo user→store, isolamento multi-tenant, beta.vendeo.tech operacional.

---

## v1.1 — Motor de Campanhas ✅

**Shipped:** 2026-07-03
**Phases:** (F3-F6)

### Delivered

IA Campaign Intelligence, Visual Rendering, Store Identity, Campaign Briefing.

---

## v1.0 — Core de Geração ✅

**Shipped:** 2026-07-03
**Phases:** (F1-F2)

### Delivered

Formulário guiado, upload de imagem, store identity, rotas iniciais.
