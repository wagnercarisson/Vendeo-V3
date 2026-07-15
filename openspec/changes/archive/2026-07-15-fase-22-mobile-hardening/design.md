## Context

O Vendeo pós-F21 tem histórico com busca, filtros, paginação, URL state compartilhável e 691 testes passando. O app funciona em mobile graças ao drawer implementado na F18 e ao empilhamento responsivo básico das fases seguintes, mas há gaps críticos: drawer sem focus trap, sem `role="dialog"`, touch targets abaixo do mínimo recomendado de 44×44px em múltiplos elementos, e apenas 1 teste de responsividade em todo o código.

Dependências: F18 (app shell, sidebar, topbar, drawer, componentes base — Button, Input, Card, Badge, EmptyState, Skeleton, PageHeader), F19 (empty states, microcopy), F20 (dashboard, metric cards), F21 (campanhas list, busca, filtros, pagination).

## Goals / Non-Goals

**Goals:**
- `sidebar-drawer.tsx` com focus trap manual, `role="dialog"`, `aria-modal`, botão X interno, restauro de foco ao fechar, body scroll lock com save/restore, `prefers-reduced-motion`
- `topbar.tsx`: hamburger `min-h-[44px]` + `min-w-[44px]`, CTA "Nova Campanha" `min-h-[44px]`, account menu trigger `min-h-[44px]`
- `account-menu.tsx`: `aria-haspopup="true"`, `aria-expanded` dinâmico, fechamento ao Escape, `prefers-reduced-motion`
- `app-shell.tsx`: main padding `px-4 py-6 sm:px-6` (preserva respiro vertical de `p-6`)
- `input.tsx`: `min-h-[44px]` adicionado ao componente base
- Touch targets consistentes (≥44px) em campanhas list/detail, dashboard, formulário de criação, loja, conta, logout
- `pagination.tsx`: `flex-wrap` para viewports estreitas
- 15+ novos testes (drawer acessibilidade, touch targets, responsividade, reduced motion, account menu, regressão)

**Non-Goals:**
- Refatorar `store-identity-form.tsx` (1771 linhas) — apenas patches pontuais de touch target e acessibilidade
- Adicionar Playwright/Cypress — manter Vitest/jsdom + UAT manual
- PWA / install prompt — fora da v1.4
- App shell nativo — fora do escopo
- `prefers-reduced-motion` em skeletons ou transições globais — escopo restrito ao drawer e componentes tocados pela F22
- Navegação por setas (arrow keys) no account menu — postergado
- `role="menu"` completo no account menu — postergado
- Índice GIN trigram para busca, i18n, billing, múltiplas lojas — fora da v1.4
- Nenhuma migration de banco, alteração em API routes, middleware, next.config, metrics.ts

## Decisions

### D1 — Escopo: hardening controlado, não refatoração ampla

`CONFIRMADO`

A F22 é uma fase de **hardening controlado**: tocar em touch targets, acessibilidade do drawer e testes. Não refatorar componentes grandes, não adicionar nova infraestrutura de teste. `store-identity-form.tsx` (1771 linhas) recebe apenas patches pontuais de `min-h-[44px]` e `aria-label`.

### D2 — Drawer acessível: focus trap manual

`CONFIRMADO`

Implementar focus trap **manual e local** ao `sidebar-drawer.tsx`, sem dependência externa (`focus-trap-react` ou similar). O caso é simples (lista de links de navegação + botão fechar) e não justifica dependência nova.

**Requisitos:**
- `role="dialog"` e `aria-modal="true"` no painel do drawer
- Botão fechar (X) visível no canto superior direito do drawer
- Foco move-se para o primeiro elemento focável ao abrir
- Tab循环 dentro do drawer (não vaza para o fundo)
- Escape fecha o drawer e restaura foco ao toggle
- Foco retorna ao hamburger ao fechar
- Overlay vira `<button>` com `aria-label="Fechar menu"` e `tabIndex={-1}` (não entra no focus trap — foco restrito ao painel/dialog)
- `prefers-reduced-motion`: se ativo, transição `duration-0` em vez de `duration-300`
- Body scroll lock salva/restaura valor original do `overflow` (não assume `""`)

### D3 — Componente Input ganha min-height

`CONFIRMADO`

Adicionar `min-height: 44px` ao componente `Input` em `src/components/ui/input.tsx`. O `Button` já tem 44px como padrão (desde F18). `campaign-input-form.tsx` e `store-identity-form.tsx` usam `<input>`, `<select>` e `<textarea>` crus — esses formulários legados precisarão de patches pontuais nas próprias classes.

### D4 — Touch targets: prioridade por severidade

`CONFIRMADO`

| Prioridade | Elementos | Abordagem |
|------------|-----------|-----------|
| 🔴 Alta | Hamburger, CTA "Nova Campanha", menu de conta (topbar) | `min-h-[44px]` + `min-w-[44px]` |
| 🔴 Alta | "Abrir"/"Baixar" em cards de campanha | `min-h-[44px]` (sem criar `LinkButton`) |
| 🔴 Alta | Chips de status (campanhas list) | `min-h-[44px]` |
| 🟠 Média | Input fields em loja, criação | Patches pontuais nas classes próprias |
| 🟠 Média | Botões de conflito (campanha nova) | `min-h-[44px]` |
| 🟠 Média | Submit de formulários (loja, criação) | `min-h-[44px]` |
| 🟡 Normal | "Remover" links (loja) | `min-h-[44px]` + padding |
| 🟡 Normal | "Alterar senha" (conta) | `min-h-[44px]` |
| 🟡 Normal | LogoutButton | `min-h-[44px]` |
| 🟡 Normal | Select filters (campanhas) | `min-h-[44px]` |
| 🟢 Leve | Pagination overflow | `flex-wrap` em viewports estreitas |
| 🟢 Leve | Breadcrumb truncation | Opcional |

### D5 — Account menu: acessibilidade mínima

`CONFIRMADO`

- `aria-haspopup="true"` no trigger
- `aria-expanded` dinâmico (true/false)
- Fechamento ao pressionar Escape
- Navegação básica por foco (Tab entre itens)
- `prefers-reduced-motion`: se ativo, transição `duration-0`

**O que NÃO fazer:** arrow keys, `role="menu"` completo. Postergado para fase futura.

### D6 — Testes: Vitest/jsdom + UAT manual

`CONFIRMADO`

Manter Vitest + jsdom. Playwright/Cypress não são adicionados na F22.

**Testes a criar (15+):**

| Grupo | Testes | O que valida |
|-------|--------|-------------|
| Drawer | 4+ | `role="dialog"`, `aria-modal`, focus trap, Escape fecha, foco restaurado |
| Touch targets | 5+ | Hamburger ≥44px, CTA ≥44px, "Abrir" ≥44px, Input min-height, chips ≥44px |
| Responsividade | 3+ | Main padding responsivo, pagination wrap, filter stacking |
| Reduced motion | 2+ | Drawer e account menu sem transição com `prefers-reduced-motion: reduce` |
| Account menu | 2+ | `aria-haspopup`, Escape fecha |
| Regressão | 2+ | Dashboard metrics grid intacto, F19 empty states intactos |

### D7 — Três planos de execução

`CONFIRMADO`

| Plano | O quê | Arquivos |
|-------|-------|----------|
| **22-01** | Shell Acessível | `sidebar-drawer.tsx` (focus trap, role="dialog", aria-modal, botão X, reduced motion, scroll restore), `topbar.tsx` (hamburger 44px, CTA 44px, trigger 44px), `account-menu.tsx` (aria-haspopup, aria-expanded, Escape), `app-shell.tsx` (padding responsivo), testes drawer + topbar + account menu (6+) |
| **22-02** | Touch Targets & Componentes | `input.tsx` (min-height), `campanhas/client.tsx` (Abrir, Baixar, chips, selects 44px), `campanhas/[id]/client.tsx` (Download 44px, edit flex-wrap), `campaign-input-form.tsx` (conflitos, submit 44px), `dashboard/page.tsx` (Abrir, CTAs 44px), `conta/page.tsx` (Alterar senha 44px), `logout-button.tsx` (min-height), `store-identity-form.tsx` (patches pontuais), `pagination.tsx` (flex-wrap mobile), testes (7+) |
| **22-03** | Revisão Mobile + Testes | Revisão manual 320/375/768px em todas as telas, testes de responsividade (3+), regressão (2+), reduced motion (2+), typecheck/lint/build |

## Risks / Trade-offs

| Risco | Mitigação |
|-------|-----------|
| `store-identity-form.tsx` (1771 linhas) — patches pontuais podem quebrar layout existente | Patches visam só `min-h-[44px]` e `aria-label`. Sem mudança de estrutura, layout ou lógica. Validar visualmente cada alteração |
| Focus trap manual pode ter bugs em edge cases (múltiplos drawers, iframes, contenteditable) | Caso de uso é simples: `<nav>` com links + botão X. Testar com screen reader e teclado. `focus-trap-react` como fallback se necessário |
| `min-h-[44px]` em inputs pode quebrar altura em contextos inline com ícones | Testar visualmente em formulário de login, loja e campanha. Ajustar padding se necessário |
| `overflow: hidden` no body com save/restore falha se outro componente também controlar overflow | Salvar valor antes de setar e restaurar exatamente o valor salvo, não `""` |
