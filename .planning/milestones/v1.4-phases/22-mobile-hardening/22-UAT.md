---
status: complete
phase: 22-mobile-hardening
source:
  - 22-01-SUMMARY.md
  - 22-02-SUMMARY.md
  - 22-03-SUMMARY.md
started: "2026-07-15T15:51:00.000Z"
updated: "2026-07-15T15:55:00.000Z"
---

## Current Test

[testing complete]

## Tests

### 1. Drawer com role="dialog" e aria-modal
expected: Drawer panel tem `role="dialog"`, `aria-modal="true"`, `aria-label="Menu de navegação"`. Overlay é `<button>` com `aria-label` e `tabIndex={-1}`.
result: pass

### 2. Focus trap no drawer
expected: Ao abrir drawer, foco vai ao primeiro elemento focável. Tab循环 dentro do drawer (não vaza). Shift+Tab no primeiro vai ao último.
result: pass

### 3. Drawer: fechar via X, Escape, overlay
expected: Botão X (canto superior direito) fecha drawer. Escape fecha drawer. Overlay fecha drawer. Ao fechar, foco restaurado ao hamburger.
result: pass

### 4. Body scroll lock no drawer
expected: Abrir drawer trava scroll do body (overflow hidden). Fechar restaura valor original do overflow.
result: pass

### 5. prefers-reduced-motion no drawer e account menu
expected: `prefers-reduced-motion: reduce` ativo → drawer usa `duration-0`, account menu chevron sem animação.
result: pass

### 6. Topbar touch targets ≥44px
expected: Hamburger `min-h-[44px]` + `min-w-[44px]`. CTA "Nova Campanha" `min-h-[44px]`. Account menu trigger `min-h-[44px]`.
result: pass

### 7. Account menu acessibilidade
expected: Trigger tem `aria-haspopup="true"` e `aria-expanded` dinâmico. Escape fecha o menu.
result: pass

### 8. Main padding responsivo
expected: App shell main padding: `px-4 py-6` em mobile, `sm:px-6` em desktop (respiro vertical preservado).
result: pass

### 9. Input component min-h-[44px]
expected: Componente Input renderiza `<input>` com `min-h-[44px]`.
result: pass

### 10. Touch targets campanhas list/detail
expected: "Abrir" e "Baixar" em cards com `min-h-[44px]`. Status chips `min-h-[44px]`. Select filters `min-h-[44px]`. Edit actions com `flex-wrap`.
result: pass

### 11. Touch targets dashboard, conta, logout, loja
expected: Dashboard CTAs/Abrir ≥44px. "Alterar senha" ≥44px. LogoutButton ≥44px. Store-identity-form: submit, remover, modal, back arrow, color chips, inputs crus ≥44px.
result: pass

### 12. Campaign input form touch targets
expected: Botões de conflito com `min-h-[44px]`. Submit `min-h-[44px]`. Inputs crus (`<input>`, `<select>`, `<textarea>`) com `min-h-[44px]`.
result: pass

### 13. Pagination com flex-wrap
expected: Container do Pagination tem `flex-wrap`. Em viewport estreita não transborda horizontalmente.
result: pass

### 14. Dashboard responsivo 320px
expected: Dashboard 320px legível, cards de métricas empilhados, sem overflow horizontal, saudação visível.
result: pass

### 15. Campanhas list responsivo 320px
expected: Filtros empilhados, cards largura total, pagination sem transbordo horizontal.
result: pass

### 16. Campanha detail responsivo 320px
expected: Imagem responsiva, edit actions com wrap (não transbordam), texto legível.
result: pass

### 17. Campanha nova responsivo 320px
expected: Formulário sem corte horizontal, inputs ≥44px, botões visíveis sem overflow.
result: pass

### 18. Loja step 1+2 responsivo 320px
expected: Formulário sem quebra, patches 44px sem quebrar layout, color chips tocáveis.
result: pass

### 19. Conta responsivo 320px
expected: Cards legíveis, "Alterar senha" ≥44px, sem overflow horizontal.
result: pass

### 20. Todas as telas responsivo 375px
expected: Repetir verificação 14-19 em 375px (iPhone SE). Telas legíveis, touch targets ≥44px.
result: pass

### 21. Todas as telas responsivo 768px
expected: Drawer oculto, hamburger oculto (`md:hidden`), sidebar desktop visível. Layout tablet coerente, sem overflow.
result: pass

## Summary

total: 21
passed: 21
issues: 0
pending: 0
skipped: 0
blocked: 0

## Gaps

[none yet]
