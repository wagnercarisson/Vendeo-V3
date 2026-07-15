## 1. Plano 22-01 — Shell Acessível

### Drawer

- [ ] 1.1 Em `src/components/shell/sidebar-drawer.tsx`: adicionar `role="dialog"` e `aria-modal="true"` no painel do drawer
- [ ] 1.2 Implementar focus trap manual: ao abrir, foco vai ao primeiro elemento focável; Tab循环 dentro do drawer (não vaza)
- [ ] 1.3 Adicionar botão X (Lucide `X`) visível no canto superior direito com `aria-label="Fechar menu"`
- [ ] 1.4 Implementar overlay como `<button>` com `aria-label="Fechar menu"` e `tabIndex={-1}` (fora do focus trap)
- [ ] 1.5 Implementar fechamento ao Escape com restauro de foco ao hamburger toggle
- [ ] 1.6 Implementar body scroll lock: salvar `document.body.style.overflow` antes, restaurar valor original ao fechar
- [ ] 1.7 Implementar `prefers-reduced-motion`: se ativo, transição `duration-0` em vez de `duration-300`

### Topbar

- [ ] 1.8 Em `src/components/shell/app-shell.tsx`: adicionar `toggleButtonRef` via `useRef`, passar como prop para `Topbar` e `SidebarDrawer` — necessário para restauro de foco ao hamburger quando drawer fecha
- [ ] 1.9 Em `src/components/shell/topbar.tsx`: hamburger button ganha `min-h-[44px]` + `min-w-[44px]`
- [ ] 1.10 CTA "Nova Campanha" ganha `min-h-[44px]`
- [ ] 1.11 Account menu trigger ganha `min-h-[44px]`

### Account Menu

- [ ] 1.12 Em `src/components/shell/account-menu.tsx`: adicionar `aria-haspopup="true"` no trigger
- [ ] 1.13 Adicionar `aria-expanded` dinâmico (true/false) conforme menu abre/fecha
- [ ] 1.14 Adicionar handler keydown Escape para fechar o menu
- [ ] 1.15 Implementar `prefers-reduced-motion`: se ativo, transições existentes (incluindo rotação do chevron se houver) usam `duration-0`

### App Shell

- [ ] 1.16 Em `src/components/shell/app-shell.tsx`: main padding muda de `p-6` fixo para `px-4 py-6 sm:px-6` (preserva respiro vertical)

### Testes 22-01

- [ ] 1.17 Expandir `src/__tests__/components/shell/sidebar-drawer.test.tsx` (4+ testes novos): `role="dialog"` e `aria-modal`, focus trap, Escape fecha e restaura foco, botão X fecha, reduced motion remove transição, body scroll lock salva/restaura
- [ ] 1.18 Expandir `src/__tests__/components/shell/topbar.test.tsx` (3+ asserts): hamburger `min-h-[44px]` + `min-w-[44px]`, CTA `min-h-[44px]`, trigger `min-h-[44px]`
- [ ] 1.19 Expandir `src/__tests__/components/shell/account-menu.test.tsx` (3+ asserts): `aria-haspopup="true"`, `aria-expanded` alterna, Escape fecha
- [ ] 1.20 Rodar `npm run typecheck`, `npm run lint` — zero erros

## 2. Plano 22-02 — Touch Targets & Componentes

### Input Component

- [ ] 2.1 Em `src/components/ui/input.tsx`: adicionar `min-h-[44px]` ao className do componente

### Campanhas List

- [ ] 2.2 Em `src/app/(app)/campanhas/client.tsx`: botão "Abrir" em cards ganha `min-h-[44px]`
- [ ] 2.3 Botão "Baixar" em cards ganha `min-h-[44px]`
- [ ] 2.4 Status chips (Todas/Prontas/Erro) ganham `min-h-[44px]`
- [ ] 2.5 Select filters ganham `min-h-[44px]`

### Campanha Detail

- [ ] 2.6 Em `src/app/(app)/campanhas/[id]/client.tsx`: link de Download ganha `min-h-[44px]`
- [ ] 2.7 Container de edit actions (3 botões) ganha `flex-wrap gap-2`

### Campaign Input Form

- [ ] 2.8 Em `src/components/flow/campaign-input-form.tsx`: botões de conflito ganham `min-h-[44px]`
- [ ] 2.9 Botão de submit ganha `min-h-[44px]`
- [ ] 2.10 Inputs crus (`<input>`, `<select>`, `<textarea>`) no formulário de campanha ganham `min-h-[44px]` nas classes próprias

### Dashboard

- [ ] 2.11 Em `src/app/(app)/dashboard/page.tsx`: link "Abrir" em campanhas recentes ganha `min-h-[44px]`
- [ ] 2.12 CTA buttons no próximo passo ganham `min-h-[44px]`

### Conta

- [ ] 2.13 Em `src/app/(app)/conta/page.tsx`: link "Alterar senha" ganha `min-h-[44px]`

### LogoutButton

- [ ] 2.14 Em `src/components/auth/logout-button.tsx`: adicionar `min-h-[44px]`

### Store Identity Form (patches pontuais — NÃO refatorar)

- [ ] 2.15 Em `src/components/flow/store-identity-form.tsx`: submit button ganha `min-h-[44px]`
- [ ] 2.16 "Remover logotipo" ganha `min-h-[44px]`
- [ ] 2.17 "Remover assinatura visual" ganha `min-h-[44px]`
- [ ] 2.18 "Tentar novamente" links ganham `min-h-[44px]`
- [ ] 2.19 Modal cancel/confirm buttons ganham `min-h-[44px]`
- [ ] 2.20 Back arrow (step 2) ganha `min-w-[44px]` + `aria-label`
- [ ] 2.21 Color chips "P"/"S" ganham `min-h-[44px]` + `min-w-[44px]`
- [ ] 2.22 Input fields crus ganham `min-h-[44px]` nas classes próprias (patches pontuais)

### Pagination

- [ ] 2.23 Em `src/components/ui/pagination.tsx`: adicionar `flex-wrap` para viewports estreitas

### Testes 22-02

- [ ] 2.24 Expandir `src/__tests__/components/ui/input.test.tsx`: assert `min-h-[44px]`
- [ ] 2.25 Expandir `src/__tests__/app/campanhas/campanhas-page.test.tsx` (4+ asserts): Abrir `min-h-[44px]`, Baixar `min-h-[44px]`, chips `min-h-[44px]`, selects `min-h-[44px]`
- [ ] 2.26 Expandir `src/__tests__/app/dashboard/dashboard-page.test.tsx` (2+ asserts): Abrir `min-h-[44px]`, grid responsivo intacto (`grid-cols-1 md:grid-cols-3`)
- [ ] 2.27 Expandir `src/__tests__/components/ui/pagination.test.tsx`: assert `flex-wrap`
- [ ] 2.28 Rodar `npm run typecheck`, `npm run lint` — zero erros

## 3. Plano 22-03 — Revisão Mobile + Testes

### Revisão Manual

- [ ] 3.1 Revisão manual 320px: dashboard legível, sem overflow horizontal
- [ ] 3.2 Revisão manual 320px: campanhas list com filtros empilhados, sem corte
- [ ] 3.3 Revisão manual 320px: campanha detail com imagem + ações + edição
- [ ] 3.4 Revisão manual 320px: campanha nova com formulário + upload
- [ ] 3.5 Revisão manual 320px: loja step 1 e step 2 sem quebra
- [ ] 3.6 Revisão manual 320px: conta com cards legíveis
- [ ] 3.7 Revisão manual 375px: mesma sequência de telas
- [ ] 3.8 Revisão manual 768px: todas as telas (breakpoint do drawer)

### Testes de Responsividade

- [ ] 3.9 Teste: main padding `px-4 py-6` em mobile, `sm:px-6` preservando `py-6` em desktop
- [ ] 3.10 Teste: pagination `flex-wrap` em mobile
- [ ] 3.11 Teste: filter stacking em viewports estreitas

### Testes Reduced Motion

- [ ] 3.12 Teste: drawer com `prefers-reduced-motion: reduce` não anima (media query mockada)
- [ ] 3.13 Teste: account menu com `prefers-reduced-motion: reduce` não anima

### Testes de Regressão

- [ ] 3.14 Teste: dashboard F20 metrics grid intacto (`grid-cols-1 md:grid-cols-3`)
- [ ] 3.15 Teste: F19 empty states intactos (dashboard e campanhas)

### Build & Validação Final

- [ ] 3.16 Rodar `npm run typecheck` — zero erros
- [ ] 3.17 Rodar `npm run lint` — zero erros
- [ ] 3.18 Rodar `npx vitest run` — todos os testes passando (~15 novos + 691 existentes)
- [ ] 3.19 Rodar `npm run build` — build bem-sucedido

## 4. Verificação Final

- [ ] 4.1 Drawer aberto: focus preso dentro, não vaza para o fundo
- [ ] 4.2 Drawer: botão X fecha, overlay fecha, Escape fecha
- [ ] 4.3 Drawer fechado: foco volta ao hamburger
- [ ] 4.4 Drawer: `prefers-reduced-motion: reduce` remove animação
- [ ] 4.5 Topbar: hamburger, CTA e trigger têm pelo menos 44×44px de área tocável
- [ ] 4.6 Input fields em todo o app (incluindo campos crus em campaign-input-form e store-identity-form) têm pelo menos 44px de altura
- [ ] 4.7 Cards de campanha: "Abrir" e "Baixar" com 44px de altura
- [ ] 4.8 Status chips: 44px de altura
- [ ] 4.9 Formulário de criação: botões de conflito com 44px
- [ ] 4.10 Dashboard: links com 44px
- [ ] 4.11 Loja: submit, remover, modal, back arrow, color chips com 44px
- [ ] 4.12 Account menu: `aria-haspopup`, Escape fecha
- [ ] 4.13 Pagination não transborda em 320px
- [ ] 4.14 Main padding responsivo (`px-4 py-6` em mobile, `sm:px-6 py-6` em desktop) — respiro vertical preservado
- [ ] 4.15 Nenhuma regressão em F18, F19, F20, F21
- [ ] 4.16 `npm run typecheck` — zero erros
- [ ] 4.17 `npm run lint` — zero erros
- [ ] 4.18 `npx vitest run` — todos os testes passando
- [ ] 4.19 `npm run build` — build bem-sucedido
