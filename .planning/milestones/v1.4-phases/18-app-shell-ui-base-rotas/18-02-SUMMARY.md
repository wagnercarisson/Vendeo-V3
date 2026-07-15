# 18-02: App Shell

**Status:** ✓ Complete
**Date:** 2026-07-13
**Commit:** e24016d

## Deliverables

### Shell Components (src/components/shell/)
- `sidebar.tsx` — Client, 4 nav links (Dashboard, Campanhas, Loja, Conta) com Lucide icons, active route highlight via `usePathname()`, `isDrawer` prop for mobile variant, `onNavigate` callback, design tokens
- `topbar.tsx` — Client, logo "Vendeo", CTA "Nova Campanha" → `/campanhas/nova`, `AccountMenu` on right, hamburger (Menu icon) visível mobile / oculto md+, `onToggleMenu` callback, aria attributes
- `account-menu.tsx` — Client, trigger com user identifier (email/sub), dropdown com "Configurações" → `/conta` (Settings icon) e "Sair" (LogOut icon + LogoutButton), fecha em outside click
- `sidebar-drawer.tsx` — Client, slide-in left (w-72, z-50), overlay backdrop (bg-black/50, z-40), controlled via `isOpen`/`onClose`, Escape fecha, overlay click fecha, body scroll lock, transição smooth
- `app-shell.tsx` — Client, compõe Topbar + Sidebar (desktop) + children + SidebarDrawer (mobile), gerencia drawer state, responsivo (sidebar md+, drawer <md), `user` prop sem dependência de store

### Layout Protegido (src/app/(app)/layout.tsx)
- Substitui skeleton de 18-01
- Chama `requirePageUser()` — não autenticado redireciona para `/login`
- Não chama `getCurrentStore()` — tolerante a store=null
- Renderiza `<AppShell user={user}>{children}</AppShell>`

### Tests (9 cenários, 5 arquivos)
- `sidebar.test.tsx` — renders 4 links, highlights active route
- `topbar.test.tsx` — renders CTA "Nova Campanha", hamburger on mobile
- `account-menu.test.tsx` — shows Configurações and Sair in dropdown
- `sidebar-drawer.test.tsx` — opens/closes with overlay, closes on escape
- `app-shell.test.tsx` — renders all parts, tolerates store=null
- TypeScript: clean | Lint: clean

## Verification
- [x] Sidebar com 4 links e destaque de rota ativa
- [x] Topbar com logo, CTA "Nova Campanha", AccountMenu
- [x] AccountMenu com Configurações e Sair
- [x] Drawer mobile abre/fecha, overlay, escape, scroll lock
- [x] AppShell compõe todos os componentes
- [x] (app)/layout protegido com requirePageUser, não depende de store
- [x] 9 testes do shell passando
- [x] typecheck e lint limpos
