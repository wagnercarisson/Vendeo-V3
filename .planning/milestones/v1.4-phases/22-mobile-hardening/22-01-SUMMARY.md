# 22-01 SUMMARY: Shell Acessível

**Status:** ✅ Complete
**Commit:** `8e471af`
**Tests:** 21 novos (6 drawer a11y, 3+ topbar touch, 3+ account menu a11y)

## Implemented

### sidebar-drawer.tsx
- `role="dialog"`, `aria-modal="true"`, `aria-label="Menu de navegação"` no painel
- Focus trap manual via `useEffect` + `keydown` listener: Tab循环, Shift+Tab, primeiro/último elemento
- Botão X (Lucide) no canto superior direito com `aria-label="Fechar menu"`
- Overlay transformado de `<div>` para `<button>` com `aria-label` e `tabIndex={-1}`
- Escape fecha drawer + restaura foco ao hamburger
- Body scroll lock via `useLayoutEffect` com `originalOverflowRef` (save/restore)
- `prefers-reduced-motion`: `duration-0` quando ativo, monitorado via `matchMedia`

### topbar.tsx
- Hamburger: `min-h-[44px]` + `min-w-[44px]`
- CTA "Nova Campanha": `min-h-[44px]`
- Account menu trigger: `min-h-[44px]`
- Aceita `toggleButtonRef` e atacha ao hamburger

### account-menu.tsx
- `aria-haspopup="true"` no trigger
- `aria-expanded` dinâmico conforme `isOpen`
- Escape fecha o dropdown via `onKeyDown`
- `prefers-reduced-motion`: `duration-200` removido da rotação chevron quando ativo

### app-shell.tsx
- `toggleButtonRef` criado com `useRef<HTMLButtonElement>(null)`
- Passado para `Topbar` e `SidebarDrawer`
- Main padding: `p-6` → `px-4 py-6 sm:px-6`

## Tests
- **sidebar-drawer.test.tsx**: 10 testes (3 existentes + 7 novos: role dialog, focus trap, Escape, X button, overlay, reduced motion, scroll lock)
- **topbar.test.tsx**: 5 testes (2 existentes + 3 novos: hamburger 44×44, CTA 44px, trigger 44px)
- **account-menu.test.tsx**: 6 testes (3 existentes + 3 novos: aria-haspopup, aria-expanded, Escape)
- TypeScript: ✅ | Lint: ✅
