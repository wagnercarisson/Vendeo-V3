## Why

O app funciona em mobile graças ao drawer implementado na F18 e ao empilhamento responsivo básico das fases seguintes, mas há gaps críticos de acessibilidade — drawer sem focus trap, sem `role="dialog"`, touch targets abaixo do mínimo recomendado de 44×44px em múltiplos elementos, e apenas 1 teste de responsividade em todo o código. A experiência mobile é funcional, não refinada. Com a milestone v1.4 sendo validada, esses gaps precisam ser endereçados antes que o produto seja apresentado a usuários reais em contextos mobile-first.

## What Changes

- **Drawer acessível** — `sidebar-drawer.tsx` ganha focus trap manual, `role="dialog"`, `aria-modal`, botão X interno, restauro de foco ao fechar, body scroll lock com save/restore, `prefers-reduced-motion`
- **Touch targets consistentes** — Todos os elementos interativos (topbar, cards de campanha, formulários, dashboard, loja, conta) elevados para `min-height: 44px` seguindo a recomendação WCAG
- **Componente `Input` padronizado** — `min-h-[44px]` adicionado ao componente base `input.tsx`
- **Account menu com acessibilidade mínima** — `aria-haspopup`, `aria-expanded`, fechamento ao Escape, `prefers-reduced-motion`
- **Padding responsivo do shell** — `main` muda de `p-6` fixo para `px-4 py-6 sm:px-6` (preserva respiro vertical)
- **Pagination com wrapping** — `flex-wrap` para viewports estreitas
- **15+ novos testes** — Drawer acessibilidade, touch targets, responsividade, reduced motion, account menu, regressão

## Capabilities

### New Capabilities

- `accessible-drawer`: Focus trap manual, `role="dialog"`, `aria-modal`, botão X, restauro de foco, body scroll lock, `prefers-reduced-motion` no `sidebar-drawer.tsx`
- `touch-targets-hardening`: Elevação de todos os elementos interativos identificados para `min-height: 44px` / `min-width: 44px` em topbar, campanhas, dashboard, formulários, loja, conta e logout
- `account-menu-a11y`: `aria-haspopup`, `aria-expanded`, fechamento ao Escape, `prefers-reduced-motion` no `account-menu.tsx`
- `mobile-hardening-tests`: Suite de 15+ testes para validação de acessibilidade, touch targets, responsividade, reduced motion e regressão

### Modified Capabilities

- `ui-base-components`: Componente `Input` ganha `min-h-[44px]`; componente `Pagination` ganha `flex-wrap` para mobile
- `app-shell`: Main padding alterado de `p-6` fixo para `px-4 py-6 sm:px-6` responsivo
- `topbar`: Hamburger, CTA "Nova Campanha" e account menu trigger elevados para touch target ≥ 44px

## Impact

- **Modificados**: `src/components/shell/sidebar-drawer.tsx` (focus trap, role="dialog", aria-modal, botão X, reduced motion, scroll restore), `src/components/shell/topbar.tsx` (hamburger/CTA/trigger 44px), `src/components/shell/account-menu.tsx` (aria-haspopup, aria-expanded, Escape, reduced motion), `src/components/shell/app-shell.tsx` (padding responsivo), `src/components/ui/input.tsx` (min-h-[44px]), `src/components/ui/pagination.tsx` (flex-wrap mobile), `src/components/flow/campaign-input-form.tsx` (conflict + submit 44px), `src/components/flow/store-identity-form.tsx` (patches pontuais 44px sem refatoração), `src/app/(app)/campanhas/client.tsx` (Abrir/Baixar/chips/selects 44px), `src/app/(app)/campanhas/[id]/client.tsx` (Download 44px, edit flex-wrap), `src/app/(app)/dashboard/page.tsx` (Abrir/CTAs 44px), `src/app/(app)/conta/page.tsx` (Alterar senha 44px), `src/components/auth/logout-button.tsx` (min-h-[44px])
- **Modificados (testes)**: `src/__tests__/components/shell/sidebar-drawer.test.tsx`, `src/__tests__/components/shell/topbar.test.tsx`, `src/__tests__/components/shell/account-menu.test.tsx`, `src/__tests__/components/ui/input.test.tsx`, `src/__tests__/components/ui/pagination.test.tsx`, `src/__tests__/app/campanhas/campanhas-page.test.tsx`, `src/__tests__/app/dashboard/dashboard-page.test.tsx`
- **Inalterados**: Middleware, API routes, banco de dados, storage, `sidebar.tsx`, `metrics.ts`, `types.ts`, hooks, lib de onboarding/microcopy, next.config
