# Alinhamento Fase 22 — Mobile Hardening (v1.4)

## Contexto

```
v1.4 — Experiência SaaS (milestone)
  ├── Phase 18 — App Shell + UI Base + Rotas                               ✓ concluída
  ├── Phase 19 — Onboarding leve + Estados vazios fundacionais             ✓ concluída
  ├── Phase 20 — Dashboard                                                 ✓ concluída
  ├── Phase 21 — Histórico & Busca                                         ✓ concluída
  └── Phase 22 — Mobile hardening + validação                              ← esta fase
```

A Fase 18 entregou app shell funcional com sidebar + topbar + drawer mobile, 7 componentes base de UI, roteamento PT-BR, redirects 301, middleware atualizado — 600 testes.

A Fase 19 entregou helper centralizado de onboarding com 3 estados, dashboard inteligente com estados vazios contextuais, substituição de redirect por orientação visual, microcopy centralizada — 628 testes.

A Fase 20 entregou dashboard real com saudação, métricas (total, prontas, taxa de sucesso), campanhas recentes e card de próximo passo adaptativo — 651 testes.

A Fase 21 entregou histórico com busca textual, filtros por status/data, ordenação, paginação page-based, URL state compartilhável e componente Pagination — 691 testes.

**Problema:** O app funciona em mobile graças ao drawer implementado na F18 e ao empilhamento responsivo básico das fases seguintes, mas há gaps críticos de acessibilidade (drawer sem focus trap, sem `role="dialog"`), touch targets abaixo do mínimo recomendado de 44×44px em múltiplos elementos, e apenas 1 teste de responsividade em todo o código. A experiência mobile é funcional, não refinada.

**Dependências:** F18 (app shell, sidebar, topbar, drawer, componentes base — `Button`, `Input`, `Card`, `Badge`, `EmptyState`, `Skeleton`, `PageHeader`), F19 (empty states, microcopy), F20 (dashboard, metric cards), F21 (campanhas list, busca, filtros, pagination).

---

## Propósito

1. **Shell acessível primeiro** — Drawer com focus trap, `role="dialog"`, `aria-modal`, botão fechar interno, restauro de foco. Topbar com touch targets de 44px (hamburger, CTA "Nova Campanha", menu de conta).
2. **Touch targets consistentes** — Componente `Input` ganha `min-height: 44px`. Elementos interativos em campanhas, dashboard, formulários e loja que usam classes avulsas (`py-1.5`, `py-2`) são elevados para 44px com classes equivalentes ao `Button`, sem criar abstração nova.
3. **Revisão mobile + testes** — Revisão manual em viewports 320/375/768px nas telas principais, testes de classe responsiva, semântica de drawer e regressão.

**Entrega verificável:**
- Drawer mobile tem focus trap, `role="dialog"`, `aria-modal`, botão X interno, foco restaurado ao fechar
- Topbar: hamburger, CTA "Nova Campanha" e menu de conta com touch target ≥ 44×44px
- Componente `Input` com `min-height: 44px`
- Botões "Abrir"/"Baixar" em cards de campanha com touch target ≥ 44px
- Chips de status (Todas/Prontas/Erro) com touch target ≥ 44px
- Formulário de criação: botões de conflito com touch target ≥ 44px
- Dashboard: links "Abrir" em campanhas recentes com touch target ≥ 44px
- Conta: link "Alterar senha" e LogoutButton com touch target ≥ 44px
- Loja: submit, "Remover logotipo", "Remover assinatura visual" com touch target ≥ 44px
- Menu de conta com `aria-haspopup`, `aria-expanded`, fechamento ao Escape
- `prefers-reduced-motion` respeitado no drawer e novos componentes
- Padding do `main` responsivo (`px-4 sm:px-6`)
- Pagination com wrapping para viewports estreitas
- 15+ testes (drawer acessibilidade, touch targets, classes responsivas, semântica)

---

## Estado Atual (pós-F21)

```
                                   ANTES (F21)                           DEPOIS (F22)
═══════════════════════════════════════════════════════════════════════════════════════════

Sidebar Drawer:
  Focus trap                     inexistente                              focus trap local (manual)
  role/aria-modal                inexistente                              role="dialog" + aria-modal
  Botão fechar interno           inexistente                              botão X visível
  Restauro de foco               inexistente                              foco retorna ao toggle
  Body scroll restore            document.body.style.overflow = ""        salva/restaura valor original

Topbar:
  Hamburger                      p-2 (~32×32px)                          min-h-[44px] + min-w-[44px]
  CTA "Nova Campanha"            py-1.5 (~28px)                           min-h-[44px]
  Account menu trigger           py-1.5 (~28px)                           min-h-[44px]

Account Menu:
  aria-haspopup                  inexistente                              aria-haspopup="true"
  aria-expanded                  inexistente                              aria-expanded dinâmico
  Fechamento Escape              inexistente                              handler keydown Escape

Componentes:
  Input min-height               py-2 (~32px, sem min-height)             min-h-[44px] no componente
  Pagination overflow            sem wrapping em 320px                    flex-wrap + gap responsivo

Campanhas List (client.tsx):
  "Abrir" button                 py-1.5 (~28px)                           min-h-[44px]
  "Baixar" button                py-1.5 (~28px)                           min-h-[44px]
  Status chips                   py-1.5 (~28px)                           min-h-[44px]
  Select filtros                 py-2 (~32px)                             min-h-[44px]

Campanha Detail ([id]/client.tsx):
  Download link                  py-2.5 (~36px, raw <a>)                  min-h-[44px]
  Edit actions (3 buttons)       flex gap-2 (sem wrap)                    flex-wrap gap-2

Campanha Nova (campaign-input-form.tsx):
  Conflict buttons               py-1.5 text-xs (~24px)                   min-h-[44px]
  Submit button                  py-2.5 (~36px, raw <button>)             min-h-[44px]

Dashboard (page.tsx):
  "Abrir" link (recentes)        py-1.5 (~28px)                           min-h-[44px]
  CTA buttons (próximo passo)    py-2 (~32px)                             min-h-[44px]

Conta (page.tsx):
  "Alterar senha" link           py-2 (~32px)                             min-h-[44px]

Loja (store-identity-form.tsx):
  Submit button                  py-2.5 (~36px)                           min-h-[44px]
  "Remover logotipo"             py-1.5 text-xs (~24px)                   min-h-[44px]
  "Remover assinatura visual"    py-1.5 text-xs (~24px)                   min-h-[44px]
  "Tentar novamente" links       text-xs (muito pequeno)                  min-h-[44px]
  Modal cancel/confirm           py-2 (~32px)                             min-h-[44px]
  Back arrow (step 2)            icon-only w-5 h-5 sem label              min-w-[44px] + aria-label
  Color chips "P"/"S"            text-[10px] px-1.5 py-0.5               min-h-[44px] + min-w-[44px]
  Input fields                   py-2.5 (~36px)                           min-h-[44px] via patches pontuais nas classes próprias

LogoutButton                     py-2 (~32px)                             min-h-[44px]

App Shell main padding           p-6 fixo                                 px-4 sm:px-6

Reduced Motion:
  Drawer transition              duração fixa, sem prefers-reduced-motion  respeita prefers-reduced-motion

Testes de responsividade         1 teste (dashboard grid classes)          15+ testes

Store Identity Form refatoração  —                                        NÃO FAZER na F22
```

---

## Decisões de Arquitetura

### D1 — Escopo: hardening controlado, não refatoração ampla

`CONFIRMADO`

A F22 é uma fase de **hardening controlado**: tocar em touch targets, acessibilidade do drawer e testes. Não refatorar componentes grandes, não adicionar nova infraestrutura de teste, não criar PWA ou app shell nativo.

**O que NÃO fazer na F22:**
- Refatorar `store-identity-form.tsx` (1771 linhas) — merece fase própria. Fazer apenas patches pontuais de touch target e acessibilidade
- Adicionar Playwright/Cypress — manter Vitest/jsdom + UAT manual documentado
- PWA / install prompt — fora do escopo da v1.4
- App shell nativo — fora do escopo
- Caçar `prefers-reduced-motion` em skeletons ou transições globais — escopo restrito ao drawer e componentes tocados pela F22

---

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
- Overlay com `aria-hidden="true"` é substituído por `<button>` com `aria-label="Fechar menu"` e `tabIndex={-1}` (não entra no focus trap — foco restrito ao painel/dialog)
- `prefers-reduced-motion`: se ativo, transição `duration-0` em vez de `duration-300`

---

### D3 — Componente Input ganha min-height

`CONFIRMADO`

Adicionar `min-height: 44px` ao componente `Input` em `src/components/ui/input.tsx`. O `Button` já tem 44px como padrão (desde F18). O `Input` é o único componente base que não segue o padrão.

```tsx
// input.tsx — adicionar:
className += " min-h-[44px]";
```

Isso padroniza o componente `Input` para touch target consistente em todas as telas que o utilizam. **Atenção:** `campaign-input-form.tsx` e `store-identity-form.tsx` usam `<input>`, `<select>` e `<textarea>` crus (não o componente `Input`). Esses formulários legados precisarão de patches pontuais nas próprias classes (`min-h-[44px]`) — não herdarão automaticamente do componente.

---

### D4 — Touch targets: prioridade por severidade

`CONFIRMADO`

A correção de touch targets segue prioridade:

| Prioridade | Elementos | Abordagem |
|------------|-----------|-----------|
| 🔴 Alta | Hamburger, CTA "Nova Campanha", menu de conta (topbar) | `min-h-[44px]` + `min-w-[44px]` |
| 🔴 Alta | "Abrir"/"Baixar" em cards de campanha | Aplicar classes equivalentes ao `Button` / `min-h-[44px]` (sem abstrair `LinkButton` — F22 não cria componente novo) |
| 🔴 Alta | Chips de status (campanhas list) | Adicionar `min-h-[44px]` |
| 🟠 Média | Input fields em loja, criação | Patches pontuais nas classes próprias — usam `<input>` cru, não o componente `Input` |
| 🟠 Média | Botões de conflito (campanha nova) | Aplicar classes equivalentes a `Button` / `min-h-[44px]` |
| 🟠 Média | Submit de formulários (loja, criação) | Aplicar classes equivalentes a `Button` / `min-h-[44px]` |
| 🟡 Normal | "Remover" links (loja) | Adicionar `min-h-[44px]` + padding |
| 🟡 Normal | "Alterar senha" (conta) | Aplicar classes equivalentes a `Button` / `min-h-[44px]` |
| 🟡 Normal | LogoutButton | Adicionar `min-h-[44px]` |
| 🟡 Normal | Select filters (campanhas) | Adicionar `min-h-[44px]` |
| 🟢 Leve | Pagination overflow | Adicionar `flex-wrap` em viewports estreitas |
| 🟢 Leve | Breadcrumb truncation | Opcional — se houver tempo |

---

### D5 — Account menu: acessibilidade mínima

`CONFIRMADO`

Incluir na F22, mas escopo mínimo:
- `aria-haspopup="true"` no trigger
- `aria-expanded` dinâmico (true/false)
- Fechamento ao pressionar Escape
- Navegação básica por foco (Tab entre itens)
- `prefers-reduced-motion`: se ativo, transição `duration-0`

**O que NÃO fazer:** navegação por setas (arrow keys), `role="menu"` completo. Pode ser adicionado em fase futura sem quebrar interface.

---

### D6 — Testes: Vitest/jsdom + UAT manual

`CONFIRMADO`

Manter a pilha de testes existente (Vitest + jsdom). Playwright/Cypress não são adicionados na F22. A decisão de adicionar teste de layout real fica para discussão consciente posterior.

**Testes a criar (15+):**

| Grupo | Testes | O que valida |
|-------|--------|-------------|
| Drawer | 4+ | `role="dialog"` presente, `aria-modal` true, focus trap prende tab, Escape fecha, foco restaurado ao fechar |
| Touch targets | 5+ | Hamburger ≥ 44px, CTA ≥ 44px, "Abrir" ≥ 44px, Input min-height, status chips ≥ 44px |
| Responsividade | 3+ | Main padding responsivo, pagination wrap, filter stacking |
| Reduced motion | 2+ | Drawer com `prefers-reduced-motion: reduce` não tem transição |
| Account menu | 2+ | `aria-haspopup` presente, Escape fecha menu |
| Regressão | 2+ | Dashboard metrics grid intacto, F19 empty states intactos |

---

### D7 — Três planos de execução

`CONFIRMADO`

| Plano | O quê | Arquivos |
|-------|-------|----------|
| **22-01** | Shell Acessível | `sidebar-drawer.tsx` (focus trap, role="dialog", aria-modal, botão X, prefers-reduced-motion, body scroll restore), `topbar.tsx` (hamburger 44px, CTA 44px, account trigger 44px), `account-menu.tsx` (aria-haspopup, aria-expanded, Escape), `app-shell.tsx` (padding responsivo), testes drawer + topbar + account menu (6+) |
| **22-02** | Touch Targets & Componentes | `input.tsx` (min-height 44px), `campanhas/client.tsx` (Abrir, Baixar, chips, selects → 44px), `campanhas/[id]/client.tsx` (Download 44px, edit actions flex-wrap), `campaign-input-form.tsx` (conflitos, submit → 44px), `dashboard/page.tsx` (Abrir, CTAs → 44px), `conta/page.tsx` (Alterar senha → 44px), `logout-button.tsx` (min-height), `store-identity-form.tsx` (patches pontuais: submit, remover, modal, back arrow, color chips), `pagination.tsx` (flex-wrap mobile), testes touch targets + regressão (7+) |
| **22-03** | Revisão Mobile + Testes | Revisão manual 320/375/768px em todas as telas (dashboard, campanhas list, campanha detail, campanha nova, loja, conta), testes de responsividade (3+), testes de regressão de fases anteriores (2+), prefers-reduced-motion tests (2+), typecheck/lint/build |

---

## Estrutura de Código

```
src/
├── components/
│   ├── shell/
│   │   ├── app-shell.tsx                           ← MODIFICADO: padding responsivo px-4 sm:px-6
│   │   ├── sidebar-drawer.tsx                      ← REFATORADO: focus trap, role="dialog",
│   │   │                                                aria-modal, botão X, prefers-reduced-motion,
│   │   │                                                body scroll restore, foco toggle ao fechar
│   │   ├── topbar.tsx                              ← MODIFICADO: hamburger/CTA/trigger 44px
│   │   ├── sidebar.tsx                             ← mantido (inalterado)
│   │   └── account-menu.tsx                        ← MODIFICADO: aria-haspopup, aria-expanded, Escape
│   │
│   ├── ui/
│   │   ├── input.tsx                               ← MODIFICADO: min-h-[44px] adicionado
│   │   ├── pagination.tsx                          ← MODIFICADO: flex-wrap para mobile
│   │   ├── button.tsx                              ← mantido (já tem 44px)
│   │   ├── card.tsx                                ← mantido
│   │   ├── badge.tsx                               ← mantido
│   │   ├── empty-state.tsx                         ← mantido
│   │   ├── page-header.tsx                         ← mantido
│   │   └── skeleton.tsx                            ← mantido
│   │
│   └── flow/
│       ├── campaign-input-form.tsx                 ← MODIFICADO: conflict + submit 44px
│       └── store-identity-form.tsx                 ← PATCHES PONTUAIS: submit/remover/
│                                                        modal/back arrow/color chips 44px.
│                                                        NÃO refatorar.
│
├── app/(app)/
│   ├── campanhas/
│   │   ├── client.tsx                              ← MODIFICADO: Abrir/Baixar/chips/selects 44px
│   │   └── [id]/
│   │       └── client.tsx                          ← MODIFICADO: Download 44px, edit flex-wrap
│   │
│   ├── dashboard/
│   │   └── page.tsx                                ← MODIFICADO: Abrir/CTAs 44px
│   │
│   └── conta/
│       └── page.tsx                                ← MODIFICADO: Alterar senha 44px
│
├── components/
│   └── auth/
│       └── logout-button.tsx                       ← MODIFICADO: min-h-[44px]
│
└── __tests__/
    ├── components/
    │   └── shell/
    │       ├── sidebar-drawer.test.tsx              ← MODIFICADO/EXPANDIDO: 4+ testes novos (dialog, focus, escape)
    │       └── topbar.test.tsx                      ← MODIFICADO: touch target asserts
    │
    ├── app/
    │   ├── campanhas/
    │   │   └── campanhas-page.test.tsx              ← MODIFICADO: touch target asserts
    │   └── dashboard/
    │       └── dashboard-page.test.tsx              ← MODIFICADO: touch target asserts
    │
    └── components/
        └── ui/
            ├── input.test.tsx                       ← MODIFICADO/EXPANDIDO: min-height assert
            └── pagination.test.tsx                  ← MODIFICADO: mobile wrap assert
```

---

## Testes

### 22-01 — Shell Acessível (6+ testes)

#### `components/shell/sidebar-drawer.test.tsx` (modificado/expandido)

| Teste | O que valida |
|-------|-------------|
| Drawer tem `role="dialog"` e `aria-modal="true"` | Semântica correta de modal |
| Drawer prende Tab循环 (focus trap) | Foco não vaza para o fundo |
| Escape fecha drawer e restaura foco ao toggle | Comportamento de teclado |
| Botão X fecha drawer | UX alternativa ao overlay |
| `prefers-reduced-motion: reduce` remove transição | Acessibilidade de movimento |
| Body scroll lock salva/restaura overflow original | Sem efeito colateral |

#### `components/shell/topbar.test.tsx` (modificado — asserts adicionados)

| Teste | O que valida |
|-------|-------------|
| Hamburger tem `min-h-[44px]` e `min-w-[44px]` | Touch target ≥ 44×44px |
| CTA "Nova Campanha" tem `min-h-[44px]` | Touch target ≥ 44px |
| Account menu trigger tem `min-h-[44px]` | Touch target ≥ 44px |

#### `components/shell/account-menu.test.tsx` (modificado — asserts adicionados)

| Teste | O que valida |
|-------|-------------|
| Trigger tem `aria-haspopup="true"` | Semântica correta |
| `aria-expanded` alterna ao abrir/fechar | Estado do menu |
| Escape fecha o menu | Comportamento de teclado |

### 22-02 — Touch Targets & Componentes (7+ testes)

#### `components/ui/input.test.tsx` (modificado/expandido)

| Teste | O que valida |
|-------|-------------|
| Input tem `min-h-[44px]` na classe CSS | Touch target mínimo |

#### `app/campanhas/campanhas-page.test.tsx` (modificado)

| Teste | O que valida |
|-------|-------------|
| Botão "Abrir" tem `min-h-[44px]` | Touch target no card |
| Botão "Baixar" tem `min-h-[44px]` | Touch target no card |
| Chips de status têm `min-h-[44px]` | Touch target nos filtros |
| Select filters têm `min-h-[44px]` | Touch target nos selects |

#### `app/dashboard/dashboard-page.test.tsx` (modificado)

| Teste | O que valida |
|-------|-------------|
| Link "Abrir" em recentes tem `min-h-[44px]` | Touch target no dashboard |
| Grid responsivo mantido (`grid-cols-1 md:grid-cols-3`) | Regressão F20 |

#### `components/ui/pagination.test.tsx` (modificado)

| Teste | O que valida |
|-------|-------------|
| Pagination tem `flex-wrap` em mobile | Não transborda em 320px |

### 22-03 — Revisão Mobile + Testes (5+ testes)

| Teste | O que valida |
|-------|-------------|
| Main padding é `px-4 sm:px-6` | Padding responsivo |
| Dashboard F19 estados vazios intactos | Regressão fases anteriores |
| Campanhas F19 estados vazios intactos | Regressão fases anteriores |
| Drawer com `prefers-reduced-motion` não anima | Teste de media query mockado |
| Account menu com `prefers-reduced-motion` não anima | Consistência de acessibilidade |

---

## Riscos

| Risco | Mitigação |
|-------|-----------|
| `store-identity-form.tsx` (1771 linhas) — patches pontuais podem quebrar layout existente | Patches visam só `min-h-[44px]` e `aria-label`. Sem mudança de estrutura, layout ou lógica. Validar visualmente cada alteração em loja completa (step 1 + step 2 + modal) |
| Focus trap manual pode ter bugs em edge cases (múltiplos drawers, foco em iframes, contenteditable) | Caso de uso é simples: <nav> com links + botão X. Testar com screen reader e teclado. Se bugs surgirem, considerar `focus-trap-react` como fallback |
| `min-h-[44px]` em inputs pode quebrar altura em alguns contextos (ex: inline com ícones) | Testar visualmente em formulário de login, loja e campanha. Ajustar padding se necessário |
| Mudar `py-1.5` para `min-h-[44px]` altera altura de elementos que dependiam do valor exato para alinhamento | `min-h` não força altura mínima se o conteúdo for maior — segura para padding adicional |
| `overflow: hidden` no body com save/restore falha se outro componente também controlar overflow | Salvar valor antes de setar e restaurar exatamente o valor salvo, não `""` |

---

## Fora do Escopo

| Item | Motivo |
|------|--------|
| Refatoração do `store-identity-form.tsx` | 1771 linhas — merece fase própria. F22 faz patches pontuais |
| Playwright / Cypress / teste de layout real | Manter Vitest/jsdom + UAT manual. Decisão consciente postergada |
| PWA / install prompt | Fora da v1.4 |
| App shell nativo | Fora da v1.4 |
| `prefers-reduced-motion` em skeletons, transições globais | Escopo restrito ao drawer e componentes tocados pela F22 |
| Navegação por setas (arrow keys) no account menu | Postergado. F22 faz `aria-haspopup` + Escape apenas |
| `role="menu"` completo no account menu | Postergado. Pode ser adicionado sem quebrar interface |
| Índice GIN trigram para busca | Pós-F21 — monitorar performance |
| i18n | Fora da v1.4 |
| Billing / planos | Fora da v1.4 |
| Múltiplas lojas (1:N) | Fora da v1.4 |
| Campos novos na tabela `campaigns` | Nenhuma migration necessária |
| Alterações em API routes existentes | Nenhuma |
| Alterações no middleware | Rotas não mudam |
| Alterações em `metrics.ts` | Inalterado |

---

## Checklist de Revisão

### Decisões de alinhamento
- [ ] D1 — Escopo: hardening controlado, sem refatoração ampla
- [ ] D2 — Drawer acessível com focus trap manual (sem lib externa)
- [ ] D3 — Componente `Input` ganha `min-h-[44px]`
- [ ] D4 — Touch targets priorizados por severidade
- [ ] D5 — Account menu com acessibilidade mínima (`aria-haspopup`, `aria-expanded`, Escape, `prefers-reduced-motion`)
- [ ] D6 — Testes com Vitest/jsdom + UAT manual (sem Playwright por padrão)
- [ ] D7 — Três planos de execução: 22-01 (shell) | 22-02 (touch targets) | 22-03 (revisão + testes)

### Plano 22-01 — Shell Acessível
- [ ] `sidebar-drawer.tsx`: `role="dialog"` + `aria-modal="true"`
- [ ] `sidebar-drawer.tsx`: focus trap (Tab循环 dentro do drawer)
- [ ] `sidebar-drawer.tsx`: botão fechar (X) visível no drawer
- [ ] `sidebar-drawer.tsx`: Escape fecha drawer e restaura foco ao toggle
- [ ] `sidebar-drawer.tsx`: `prefers-reduced-motion` → transição `duration-0`
- [ ] `sidebar-drawer.tsx`: body scroll lock salva/restaura overflow original
- [ ] `topbar.tsx`: hamburger `min-h-[44px]` + `min-w-[44px]`
- [ ] `topbar.tsx`: CTA "Nova Campanha" `min-h-[44px]`
- [ ] `topbar.tsx`: account menu trigger `min-h-[44px]`
- [ ] `account-menu.tsx`: `aria-haspopup="true"` no trigger
- [ ] `account-menu.tsx`: `aria-expanded` dinâmico
- [ ] `account-menu.tsx`: Escape fecha o menu
- [ ] `app-shell.tsx`: main padding `px-4 sm:px-6`
- [ ] Testes drawer (4+): role, focus trap, escape, X button, reduced motion, scroll restore
- [ ] Testes topbar (3+): hamburger 44px, CTA 44px, trigger 44px
- [ ] Testes account menu (2+): aria-haspopup, aria-expanded, Escape

### Plano 22-02 — Touch Targets & Componentes
- [ ] `input.tsx`: `min-h-[44px]` adicionado
- [ ] `campanhas/client.tsx`: "Abrir" `min-h-[44px]`
- [ ] `campanhas/client.tsx`: "Baixar" `min-h-[44px]`
- [ ] `campanhas/client.tsx`: status chips `min-h-[44px]`
- [ ] `campanhas/client.tsx`: select filters `min-h-[44px]`
- [ ] `campanhas/[id]/client.tsx`: Download link `min-h-[44px]`
- [ ] `campanhas/[id]/client.tsx`: edit actions `flex-wrap`
- [ ] `campaign-input-form.tsx`: conflict buttons `min-h-[44px]`
- [ ] `campaign-input-form.tsx`: submit button `min-h-[44px]`
- [ ] `dashboard/page.tsx`: "Abrir" em recentes `min-h-[44px]`
- [ ] `dashboard/page.tsx`: CTA buttons `min-h-[44px]`
- [ ] `conta/page.tsx`: "Alterar senha" `min-h-[44px]`
- [ ] `logout-button.tsx`: `min-h-[44px]`
- [ ] `store-identity-form.tsx`: submit `min-h-[44px]`
- [ ] `store-identity-form.tsx`: "Remover logotipo" `min-h-[44px]`
- [ ] `store-identity-form.tsx`: "Remover assinatura visual" `min-h-[44px]`
- [ ] `store-identity-form.tsx`: "Tentar novamente" links `min-h-[44px]`
- [ ] `store-identity-form.tsx`: modal cancel/confirm `min-h-[44px]`
- [ ] `store-identity-form.tsx`: back arrow `min-w-[44px]` + `aria-label`
- [ ] `store-identity-form.tsx`: color chips "P"/"S" `min-h-[44px]` + `min-w-[44px]`
- [ ] `pagination.tsx`: `flex-wrap` para viewports estreitas
- [ ] Testes (7+): Input min-height, Abrir/Baixar 44px, chips 44px, selects 44px, dashboard grid intacto

### Plano 22-03 — Revisão Mobile + Testes
- [ ] Revisão manual 320px: dashboard legível, sem overflow horizontal
- [ ] Revisão manual 320px: campanhas list com filtros empilhados, sem corte
- [ ] Revisão manual 320px: campanha detail com imagem + ações + edição
- [ ] Revisão manual 320px: campanha nova com formulário + upload
- [ ] Revisão manual 320px: loja step 1 e step 2 sem quebra
- [ ] Revisão manual 320px: conta com cards legíveis
- [ ] Revisão manual 375px: mesma sequência
- [ ] Revisão manual 768px: todas as telas (breakpoint do drawer)
- [ ] Testes de responsividade (3+): main padding, pagination wrap, filter stacking
- [ ] Testes reduced motion (2+): drawer, account menu
- [ ] Testes de regressão (2+): dashboard F20 intacto, empty states F19 intactos
- [ ] `npm run typecheck` — zero erros
- [ ] `npm run lint` — zero erros
- [ ] `npx vitest run` — todos os testes passando (~15 novos + 691 existentes)
- [ ] `npm run build` — build bem-sucedido

---

### Verificação final
- [ ] Drawer aberto: focus preso dentro, não vaza para o fundo
- [ ] Drawer: botão X fecha, overlay fecha, Escape fecha
- [ ] Drawer fechado: foco volta ao hamburger
- [ ] Drawer: `prefers-reduced-motion: reduce` remove animação
- [ ] Topbar: hamburger, CTA e trigger têm pelo menos 44×44px de área tocável
- [ ] Input fields em todo o app têm pelo menos 44px de altura
- [ ] Cards de campanha: "Abrir" e "Baixar" com 44px de altura
- [ ] Status chips: 44px de altura
- [ ] Formulário de criação: botões de conflito com 44px
- [ ] Dashboard: links com 44px
- [ ] Loja: submit, remover, modal, back arrow, color chips com 44px
- [ ] Account menu: aria-haspopup, Escape fecha
- [ ] Pagination não transborda em 320px
- [ ] Main padding responsivo (px-4 em mobile, px-6 em desktop)
- [ ] Nenhuma regressão em F18, F19, F20, F21
- [ ] `npm run typecheck` — zero erros
- [ ] `npm run lint` — zero erros
- [ ] `npx vitest run` — todos os testes passando
- [ ] `npm run build` — build bem-sucedido

---

*Documento criado: 2026-07-15*
*Baseado no alinhamento da milestone v1.4, auditoria de responsividade do código pós-F21, discussão exploratória com decisões registradas por dois agentes.*
*Próximo passo: revisão do time, ajustes, então compor change proposal + plano GSD da Phase 22.*
