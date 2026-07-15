# Roadmap: Vendeo V3 — v1.4 Experiência SaaS

**Milestone:** v1.4 — Experiência SaaS
**Started:** 2026-07-10
**Status:** Planning (documentation only — details via OpenSpec)
**Phase numbering:** Continuing from v1.3 (Phase 18+)

## Phase Overview

| Phase | Name | Goal | Requirements | Success Criteria |
|-------|------|------|--------------|------------------|
| 18 | App Shell & Navegação | ✅ Estrutura de navegação definitiva | SHELL-01, SHELL-02, SHELL-03 | 6 ✅ |
| 19 | Onboarding & Estados Vazios | ✅ Experiência do novo usuário e consistência visual | ONBRD-01, ONBRD-02, ONBRD-03, UX-01, UX-02 | 5 ✅ |
| 20 | Dashboard | ✅ Visão geral com métricas básicas e acesso rápido | DASH-01, DASH-02, DASH-03 | 3 ✅ |
| 21 | Histórico & Busca | Organização e descoberta de campanhas | HIST-01, HIST-02, HIST-03, SEARCH-01, SEARCH-02, SEARCH-03 | 6 |
| 22 | Mobile Hardening | Acessibilidade e touch targets móveis | MOBILE-01, MOBILE-02, MOBILE-03, MOBILE-04 | 8 |

**Total:** 5 phases | 21 requirements mapped | All covered ✓

## Phase Details

### Phase 18 — App Shell & Navegação

**Status:** `Complete ✓`
**Slug:** `18-app-shell-ui-base-rotas`
**Change:** `openspec/changes/fase-18-app-shell-ui-base-rotas/`
**Plans:** `.planning/phases/18-app-shell-ui-base-rotas/18-01-PLAN.md` — `18-03-PLAN.md`
**Context:** `.planning/phases/18-app-shell-ui-base-rotas/18-CONTEXT.md`

**Goal:** Estabelecer a estrutura de navegação definitiva do Vendeo como produto SaaS coerente. Substituir navegação ad-hoc por app shell com sidebar/topbar, UI base profissional (7 componentes), reorganização de rotas para PT-BR, e migração de todas as páginas existentes.

**Requirements:** SHELL-01, SHELL-02, SHELL-03

**Success criteria:**
1. 7 componentes base de UI (Button, Card, Input, Badge, EmptyState, Skeleton, PageHeader) em `src/components/ui/`
2. App Shell com sidebar + topbar + drawer mobile + menu de conta, responsivo, tolerante a `store = null`
3. Route group `(app)/` com layout protegido (requirePageUser) e todas as rotas filhas
4. 5 redirects 301 em `next.config.ts` — rotas antigas → novo padrão PT-BR
5. `/dashboard` placeholder + `/conta` mínima útil (email + sair)
6. AuthHeader removido, design token cleanup, emoji → Lucide
7. 25+ testes (componentes, shell, redirects, middleware)

**Dependencies:** Phases 7–17 (fundação completa)

**Plans:**
| Plan | Wave | Objective |
|------|------|-----------|
| 18-01 | 1 | UI Base (7 componentes) + estrutura diretórios + root layout cleanup + next.config.ts redirects + testes UI |
| 18-02 | 2 | App Shell: sidebar, topbar, account-menu, sidebar-drawer, (app)/layout + testes shell |
| 18-03 | 2 | Migrar rotas campanhas/nova, campanhas, campanhas/[id], loja; criar dashboard + conta; middleware matcher; remover AuthHeader; token cleanup; testes redirects + middleware |

**Depends on:** Nenhuma (fundação da milestone)

---

### Phase 19 — Onboarding & Estados Vazios

**Status:** `Complete ✓`
**Slug:** `19-onboarding-estados-vazios`
**Change:** `openspec/changes/fase-19-onboarding-estados-vazios/`
**Plans:** `.planning/phases/19-onboarding-estados-vazios/19-01-PLAN.md` — `19-03-PLAN.md`
**Context:** `.planning/phases/19-onboarding-estados-vazios/19-CONTEXT.md`

**Goal:** Guiar novos usuários na primeira experiência e garantir estados vazios consistentes em toda a aplicação, antes de apresentar o dashboard.

**Requirements:** ONBRD-01, ONBRD-02, ONBRD-03, UX-01, UX-02

**Success criteria:**
1. ✅ Helper `getUserOnboardingState(userId)` centralizado com 3 estados
2. ✅ Dashboard como server component async com 3 estados
3. ✅ `/campanhas` sem loja mostra empty state contextual com CTA (não redireciona)
4. ✅ `/campanhas/[id]` sem loja retorna 404 (não redireciona)
5. ✅ Microcopy de todos os estados vazios centralizada em `src/lib/onboarding/microcopy.ts`

**Depends on:** Phase 18

**Plans:**
| Plan | Wave | Objective | Status |
|------|------|-----------|--------|
| 19-01 | 1 | Fundação do Onboarding Helper — types, count, state, microcopy + testes | ✅ |
| 19-02 | 2 | Dashboard Inteligente — async server component com 3 estados + testes | ✅ |
| 19-03 | 2 | Campanhas + Detalhe sem Loja — empty states, 404, microcopy + testes | ✅ |

**Tests:** 628 passing (86 files, 28 novos)
**Commits:** `8dfc693` `801948a` `bbd3d0e` `ef18659`

---

### Phase 20 — Dashboard

**Status:** `Complete ✓`
**Slug:** `20-dashboard`
**Change:** `openspec/changes/fase-20-dashboard/`
**Plans:** `.planning/phases/20-dashboard/20-01-PLAN.md` — `20-03-PLAN.md`
**Context:** `.planning/phases/20-dashboard/20-CONTEXT.md`

**Goal:** Prover uma visão geral do estado da loja com métricas básicas e acesso rápido às ações principais.

**Requirements:** DASH-01, DASH-02, DASH-03

**Success criteria:**
1. ✅ Dashboard mostra campanhas recentes com métricas básicas (total, sucesso)
2. ✅ Acesso rápido à última campanha e ao formulário de nova campanha
3. ✅ Dashboard é a landing page pós-login

**Depends on:** Phase 18, Phase 19

**Plans:**
| Plan | Wave | Objective | Status |
|------|------|-----------|--------|
| 20-01 | 1 | Métricas e Recentes — metrics.ts, count.ts reexport, 9 testes | ✅ |
| 20-02 | 2 | Dashboard Completo — saudação, 3 cards métricas, campanhas recentes, next-step card | ✅ |
| 20-03 | 2 | Testes e Acabamento Responsivo — 20 testes (11 novos cenários + 9 edge cases) | ✅ |

**Tests:** 651 passing (87 files, 23 novos)
**Commits:** `3a17fe2` `e8b5839`

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

### Phase 22 — Mobile Hardening

**Status:** `Planned`
**Slug:** `22-mobile-hardening`
**Change:** `openspec/changes/fase-22-mobile-hardening/`
**Plans:** `.planning/phases/22-mobile-hardening/22-01-PLAN.md` — `22-03-PLAN.md`
**Context:** `.planning/phases/22-mobile-hardening/22-CONTEXT.md`

**Goal:** Hardening controlado da experiência mobile: drawer acessível (focus trap, `role="dialog"`, `aria-modal`), touch targets ≥44×44px (WCAG 2.5.8) em todo o app, account menu com acessibilidade mínima, padding responsivo, e 15+ novos testes.

**Requirements:** MOBILE-01, MOBILE-02, MOBILE-03, MOBILE-04

**Success criteria:**
1. ✅ Drawer com focus trap manual, `role="dialog"`, `aria-modal`, botão X, restauro de foco, body scroll lock, `prefers-reduced-motion`
2. ✅ Topbar: hamburger 44×44px, CTA e trigger ≥44px
3. ✅ Account menu: `aria-haspopup`, `aria-expanded`, Escape, `prefers-reduced-motion`
4. ✅ Main padding responsivo: `px-4 py-6 sm:px-6`
5. ✅ Componente `Input` com `min-h-[44px]`
6. ✅ Touch targets ≥44px em campanhas list/detail, dashboard, formulários, loja, conta, logout
7. ✅ `Pagination` com `flex-wrap` para mobile
8. ✅ 15+ novos testes (acessibilidade, touch targets, responsividade, reduced motion, regressão)

**Non-goals:** Refatorar `store-identity-form.tsx` (apenas patches pontuais), Playwright/Cypress, PWA, app shell nativo, arrow keys account menu, `role="menu"` completo, GIN trigram, i18n, billing, múltiplas lojas, migrations de banco, API routes, middleware, next.config.

**Depends on:** Phase 18, Phase 19, Phase 20, Phase 21

**Plans:**
| Plan | Wave | Objective | Status |
|------|------|-----------|--------|
| 22-01 | 1 | Shell Acessível — drawer focus trap + a11y, topbar touch targets, account menu a11y, padding responsivo, testes | ○ |
| 22-02 | 1 | Touch Targets & Componentes — input min-height, campanhas, dashboard, formulários, loja, conta, logout, flex-wrap, testes | ○ |
| 22-03 | 2 | Revisão Mobile + Testes — revisão manual 320/375/768px, responsividade, reduced motion, regressão, build final | ○ |

**Tests:** 691 passing (89 files) + ~15 novos = ~706 expected

**Commits (planning):** `5bceebc` `25bdc7e`

---

## Notes

- **Detalhamento via OpenSpec:** Cada fase será desdobrada em requisitos atômicos, fluxos, estados e critérios de aceitação durante o ciclo de especificação via OpenSpec.
- **Ordem sugerida:** As fases 18-21 podem ser executadas em paralelo parcial (18 primeiro, 19-21 em sequência). A fase 22 (Mobile) depende de todas as anteriores.
- **Estimativa:** Escopo preliminar — ajustes ocorrerão durante o detalhamento OpenSpec de cada fase.

---
*Roadmap created: 2026-07-10*
*Last updated: 2026-07-13 after Phase 18 execution*
