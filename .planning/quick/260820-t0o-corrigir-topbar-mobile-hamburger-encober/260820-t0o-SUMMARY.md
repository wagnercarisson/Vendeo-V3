---
quick_id: 260820-t0o
status: complete
date: 2026-08-20
---

# Quick Task 260820-t0o: Topbar mobile compacta (hamburger encoberto/ausente)

## Objetivo

Corrigir o defeito de produção onde o menu hamburger da Topbar desaparece ou fica
encoberto pelo botão "Nova Campanha" / menu da conta em telas pequenas, tornando a
Topbar compacta no mobile sem alterar sidebar/drawer/layout e sem `overflow-x-hidden`.

## Tasks executadas (3, commits atômicos)

### Task 1 — `src/components/shell/topbar.tsx` (commit `a4ecf1d1`)
- Hamburger: adicionado `shrink-0` (nunca mais espremido/oculto); mantidos `min-h/min-w 44px` e `md:hidden`.
- CTA "Nova Campanha": compacta e icon-only no mobile (`min-w-[44px]`, `justify-center`, `gap-0 px-2`, restaurado `sm:gap-1.5 sm:px-3`); texto `hidden sm:inline` preservado no DOM; `aria-label="Criar nova campanha"`.
- Container direito (CTA + conta): `shrink-0` + `gap-1 sm:gap-3`.
- Espaçamento responsivo: header `px-3 sm:px-4`, container esquerdo `gap-2 sm:gap-3`.
- Span do nome da loja mantém `truncate` (cede espaço; não ganhou `shrink-0`).

### Task 2 — `src/components/shell/account-menu.tsx` (commit `e797a355`)
- Trigger compacto: `min-w-[44px]`, `justify-center`, `gap-0 px-2` no mobile (`sm:gap-2 sm:px-3`); `aria-label="Menu da conta"`.
- Email/nome oculto no mobile via `hidden sm:inline-block` (permanece no DOM).

### Task 3 — testes de regressão + 4 gates (commit `62caba86`)
- `topbar.test.tsx`: hamburger `shrink-0`; CTA `aria-label` + `min-w-[44px]` + `justify-center` + span `hidden sm:inline`; container direito `shrink-0`.
- `account-menu.test.tsx`: trigger `aria-label="Menu da conta"`; email span `hidden sm:inline-block`.
- Contratos existentes preservados (getByText "Nova Campanha", getByText email, reload/nav do CTA, 44px).

## Verificação

- Testes focados: topbar + account-menu = 19/19 verdes.
- Regressão completa: 245 files / 2277 testes verdes, 0 FAIL.
- `npm run typecheck`: exit 0.
- `npm run lint`: exit 0.
- `npm run build`: exit 0 (Compiled successfully).

## Fora de escopo (intencional)

- Sidebar/drawer, navegação principal, layout global, app-shell: NÃO alterados.
- Sidebar recolhível: NÃO implementado.
- `overflow-x-hidden` global: NÃO usado.

## Pendência

- Checkpoint manual recomendado em 320px e 375px: hamburger visível/não espremido,
  CTA só ícone, conta acessível, sem scroll horizontal, sem sobreposição.
