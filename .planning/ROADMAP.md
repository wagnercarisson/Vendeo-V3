# Roadmap: Vendeo V3 — v1.4 Experiência SaaS

**Milestone:** v1.4 — Experiência SaaS
**Started:** 2026-07-10
**Status:** Planning (documentation only — details via OpenSpec)
**Phase numbering:** Continuing from v1.3 (Phase 18+)

## Phase Overview

| Phase | Name | Goal | Requirements | Success Criteria |
|-------|------|------|--------------|------------------|
| 18 | App Shell & Navegação | Estrutura de navegação definitiva | SHELL-01, SHELL-02, SHELL-03 | 3 |
| 19 | Onboarding & Estados Vazios | Experiência do novo usuário e consistência visual | ONBRD-01, ONBRD-02, ONBRD-03, UX-01, UX-02 | 5 |
| 20 | Dashboard | Visão geral com métricas básicas e acesso rápido | DASH-01, DASH-02, DASH-03 | 3 |
| 21 | Histórico & Busca | Organização e descoberta de campanhas | HIST-01, HIST-02, HIST-03, SEARCH-01, SEARCH-02, SEARCH-03 | 6 |
| 22 | Mobile | Fluxo completo responsivo | MOBILE-01, MOBILE-02, MOBILE-03, MOBILE-04 | 4 |

**Total:** 5 phases | 21 requirements mapped | All covered ✓

## Phase Details

### Phase 18 — App Shell & Navegação

**Goal:** Estabelecer a estrutura de navegação definitiva do Vendeo como produto SaaS coerente. Substituir navegação ad-hoc por app shell com sidebar/topbar e menus consistentes.

**Requirements:** SHELL-01, SHELL-02, SHELL-03

**Success criteria:**
1. Sidebar/topbar com links para todas as seções principais do produto
2. Navegação consistente entre páginas (destaque na seção ativa)
3. Transições suaves entre seções sem perda de estado

**Depends on:** Nenhuma (fundação da milestone)

---

### Phase 19 — Onboarding & Estados Vazios

**Goal:** Guiar novos usuários na primeira experiência e garantir estados vazios consistentes em toda a aplicação, antes de apresentar o dashboard.

**Requirements:** ONBRD-01, ONBRD-02, ONBRD-03, UX-01, UX-02

**Success criteria:**
1. Novo usuário é guiado por onboarding pós-signup
2. Onboarding orienta a criar a primeira campanha
3. Configuração inicial da loja é integrada ao onboarding
4. Todas as listas e seções têm estados vazios com CTAs claros
5. Estados vazios seguem padrão consistente de design

**Depends on:** Phase 18

---

### Phase 20 — Dashboard

**Goal:** Prover uma visão geral do estado da loja com métricas básicas e acesso rápido às ações principais.

**Requirements:** DASH-01, DASH-02, DASH-03

**Success criteria:**
1. Dashboard mostra campanhas recentes com métricas básicas (total, sucesso)
2. Acesso rápido à última campanha e ao formulário de nova campanha
3. Dashboard é a landing page pós-login

**Depends on:** Phase 18, Phase 19

---

### Phase 21 — Histórico & Busca

**Goal:** Melhorar a organização e descoberta de campanhas com ordenação, paginação, busca textual e filtros essenciais.

**Requirements:** HIST-01, HIST-02, HIST-03, SEARCH-01, SEARCH-02, SEARCH-03

**Success criteria:**
1. Lista de campanhas com ordenação (data, nome, status)
2. Paginação funcional na lista de campanhas
3. Campo de busca textual com resultados relevantes
4. Filtros por data, status e produto
5. URL state reflete busca/filtros (compartilhável)
6. Transição suave entre listar, visualizar e criar nova campanha

**Depends on:** Phase 18, Phase 20

---

### Phase 22 — Mobile

**Goal:** Garantir que o fluxo completo do Vendeo seja utilizável em dispositivos mobile.

**Requirements:** MOBILE-01, MOBILE-02, MOBILE-03, MOBILE-04

**Success criteria:**
1. Fluxo de campanha (criar → gerar → visualizar → baixar) funcional em mobile
2. App shell adaptado para telas pequenas (menu collapsible/hamburger)
3. Onboarding, histórico e busca utilizáveis em mobile
4. Estados vazios responsivos em todas as resoluções

**Depends on:** Phase 18, Phase 19, Phase 20, Phase 21

---

## Notes

- **Detalhamento via OpenSpec:** Cada fase será desdobrada em requisitos atômicos, fluxos, estados e critérios de aceitação durante o ciclo de especificação via OpenSpec.
- **Ordem sugerida:** As fases 18-21 podem ser executadas em paralelo parcial (18 primeiro, 19-21 em sequência). A fase 22 (Mobile) depende de todas as anteriores.
- **Estimativa:** Escopo preliminar — ajustes ocorrerão durante o detalhamento OpenSpec de cada fase.

---
*Roadmap created: 2026-07-10*
*Last updated: 2026-07-10 after milestone v1.4 opened*
