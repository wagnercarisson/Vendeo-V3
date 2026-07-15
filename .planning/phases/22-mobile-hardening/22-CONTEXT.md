# Phase 22 — Mobile Hardening — Context

**Gathered:** 2026-07-15
**Status:** Ready for planning
**Source:** `openspec/changes/fase-22-mobile-hardening/` (design.md, proposal.md, specs/, tasks.md)

<domain>
## Phase Boundary

Hardening controlado da experiência mobile do Vendeo. O app funciona em mobile graças ao drawer (F18) e empilhamento responsivo básico, mas há gaps críticos de acessibilidade — drawer sem focus trap, sem `role="dialog"`, touch targets abaixo de 44×44px, e apenas 1 teste de responsividade em todo o código.

**O que faz:**
- `sidebar-drawer.tsx` acessível: focus trap manual, `role="dialog"`, `aria-modal`, botão X, restauro de foco, body scroll lock, `prefers-reduced-motion`
- Touch targets ≥ 44×44px (WCAG 2.5.8/2.5.5) em topbar, campanhas list/detail, dashboard, formulários, loja, conta, logout
- Componente `Input` com `min-h-[44px]`
- Account menu com `aria-haspopup`, `aria-expanded`, Escape, `prefers-reduced-motion`
- Main padding responsivo: `px-4 py-6 sm:px-6`
- `Pagination` com `flex-wrap` para mobile
- 15+ novos testes (acessibilidade, touch targets, responsividade, reduced motion, regressão)

**O que NÃO faz:**
- Refatorar `store-identity-form.tsx` (1771 linhas) — apenas patches pontuais
- Adicionar Playwright/Cypress — manter Vitest/jsdom + UAT manual
- PWA / install prompt — fora da v1.4
- App shell nativo — fora do escopo
- `prefers-reduced-motion` em skeletons ou transições globais — escopo restrito
- Navegação por setas (arrow keys) no account menu — postergado
- `role="menu"` completo no account menu — postergado
- Índice GIN trigram, i18n, billing, múltiplas lojas — fora da v1.4
- Nenhuma migration de banco, API routes, middleware, next.config, metrics.ts
</domain>

<decisions>
## Implementation Decisions

### D1 — Escopo: hardening controlado, não refatoração ampla
`CONFIRMADO`. Touch targets, acessibilidade do drawer, testes. `store-identity-form.tsx` (1771 linhas) recebe apenas patches pontuais de `min-h-[44px]` e `aria-label`.

### D2 — Drawer acessível: focus trap manual
`CONFIRMADO`. Implementação manual e local em `sidebar-drawer.tsx`, sem dependência externa:
- `role="dialog"` e `aria-modal="true"` no painel
- Botão X (Lucide) visível, canto superior direito, `aria-label="Fechar menu"`
- Foco ao primeiro elemento focável ao abrir
- Tab循环 dentro do drawer (não vaza)
- Escape fecha + restaura foco ao hamburger
- Overlay como `<button>` com `aria-label="Fechar menu"` e `tabIndex={-1}`
- `prefers-reduced-motion`: `duration-0` em vez de `duration-300`
- Body scroll lock salva/restaura valor original do `overflow`

### D3 — Componente Input ganha min-height
`CONFIRMADO`. Adicionar `min-h-[44px]` ao componente `Input` em `src/components/ui/input.tsx`.

### D4 — Touch targets: prioridade por severidade
`CONFIRMADO`. Tabela de prioridade:
| Prioridade | Elementos | Abordagem |
|------------|-----------|-----------|
| 🔴 Alta | Hamburger, CTA, trigger (topbar) | `min-h-[44px]` + `min-w-[44px]` |
| 🔴 Alta | Abrir/Baixar (cards campanha) | `min-h-[44px]` |
| 🔴 Alta | Status chips (campanhas list) | `min-h-[44px]` |
| 🟠 Média | Input fields (loja, criação) | Patches nas classes próprias |
| 🟠 Média | Botões conflito/submit | `min-h-[44px]` |
| 🟡 Normal | Remover/Alterar senha/Logout/Selects | `min-h-[44px]` |
| 🟢 Leve | Pagination overflow | `flex-wrap` |

### D5 — Account menu: acessibilidade mínima
`CONFIRMADO`. `aria-haspopup="true"`, `aria-expanded` dinâmico, Escape fecha, `prefers-reduced-motion`. Sem arrow keys ou `role="menu"` completo.

### D6 — Testes: Vitest/jsdom + UAT manual
`CONFIRMADO`. Manter Vitest + jsdom. Playwright/Cypress não adicionados.

### D7 — Três planos de execução
`CONFIRMADO`. 22-01 (Shell Acessível), 22-02 (Touch Targets), 22-03 (Revisão + Testes).
</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Specs (OpenSpec)
- `openspec/changes/fase-22-mobile-hardening/design.md` — Design decisions, goals, risks
- `openspec/changes/fase-22-mobile-hardening/proposal.md` — Why, What, Capabilities, Impact
- `openspec/changes/fase-22-mobile-hardening/tasks.md` — Task breakdown per plan
- `openspec/changes/fase-22-mobile-hardening/specs/accessible-drawer/spec.md` — Drawer a11y requirements
- `openspec/changes/fase-22-mobile-hardening/specs/account-menu-a11y/spec.md` — Account menu a11y
- `openspec/changes/fase-22-mobile-hardening/specs/app-shell/spec.md` — App shell deltas
- `openspec/changes/fase-22-mobile-hardening/specs/touch-targets-hardening/spec.md` — Touch target requirements
- `openspec/changes/fase-22-mobile-hardening/specs/ui-base-components/spec.md` — Input/Pagination deltas
- `openspec/changes/fase-22-mobile-hardening/specs/mobile-hardening-tests/spec.md` — Test requirements

### Source files to modify
- `src/components/shell/sidebar-drawer.tsx` — Focus trap, dialog, X button, scroll lock, reduced motion
- `src/components/shell/topbar.tsx` — Touch targets hamburger/CTA/trigger
- `src/components/shell/account-menu.tsx` — aria-haspopup, aria-expanded, Escape
- `src/components/shell/app-shell.tsx` — Main padding responsivo, toggleButtonRef
- `src/components/ui/input.tsx` — min-h-[44px]
- `src/components/ui/pagination.tsx` — flex-wrap
- `src/components/flow/campaign-input-form.tsx` — Patches touch target
- `src/components/flow/store-identity-form.tsx` — Patches pontuais
- `src/app/(app)/campanhas/client.tsx` — Abrir/Baixar/chips/selects 44px
- `src/app/(app)/campanhas/[id]/client.tsx` — Download 44px, edit flex-wrap
- `src/app/(app)/dashboard/page.tsx` — Abrir/CTAs 44px
- `src/app/(app)/conta/page.tsx` — Alterar senha 44px
- `src/components/auth/logout-button.tsx` — min-h-[44px]

### Test files to modify
- `src/__tests__/components/shell/sidebar-drawer.test.tsx`
- `src/__tests__/components/shell/topbar.test.tsx`
- `src/__tests__/components/shell/account-menu.test.tsx`
- `src/__tests__/components/ui/input.test.tsx`
- `src/__tests__/components/ui/pagination.test.tsx`
- `src/__tests__/app/campanhas/campanhas-page.test.tsx`
- `src/__tests__/app/dashboard/dashboard-page.test.tsx`
</canonical_refs>

<specifics>
## Specific Ideas

### Focus Trap Implementation
- Usar `useEffect` com keydown listener no drawer aberto
- Coletar `focusableElements` via `querySelectorAll('a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])')`
- Tab: se `shiftKey` e no primeiro → vai ao último; se `!shiftKey` e no último → vai ao primeiro
- Foco inicial no primeiro elemento focável ao abrir (useEffect de abertura)

### Body Scroll Lock
- Salvar `document.body.style.overflow` em uma ref antes de setar `"hidden"`
- Restaurar valor salvo ao fechar (não assumir `""`)
- Usar `useLayoutEffect` para sincronia com o DOM

### Responsive Padding
- Atual: `className="flex-1 p-6 overflow-auto"`
- Novo: `className="flex-1 px-4 py-6 sm:px-6 overflow-auto"`

### toggleButtonRef
- `app-shell.tsx` cria `toggleButtonRef = useRef<HTMLButtonElement>(null)` e passa como prop para `Topbar` (no hamburger) e `SidebarDrawer` (para restauro de foco)

### Account Menu Escape
- Adicionar `onKeyDown` com `e.key === "Escape"` no dropdown container
- Se Escape, chamar `setIsOpen(false)`
</specifics>

<deferred>
## Deferred Ideas

- Arrow keys + `role="menu"` completo no account menu — postergado para fase futura
- `prefers-reduced-motion` global (skeletons, transições) — escopo F22 restrito ao drawer e account menu
- PWA / install prompt — fora da v1.4
- App shell nativo / React Native — fora do escopo
- Índice GIN trigram, i18n, billing, múltiplas lojas — fora da v1.4
- Nenhuma migration de banco, alteração em API routes, middleware, next.config, metrics.ts
</deferred>

---

*Phase: 22-mobile-hardening*
*Context gathered: 2026-07-15 via OpenSpec change synthesis (fase-22-mobile-hardening)*
