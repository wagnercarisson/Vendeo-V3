> **Propósito**: Esta spec define o App Shell do Vendeo — layout de navegação global com sidebar, topbar, drawer mobile e menu de conta. Substitui o AuthHeader como estrutura de navegação principal. Estabelece o route group `(app)/` com layout protegido.
>
> > Synced from `fase-18-app-shell-ui-base-rotas` (ADDED).

## Requirements

### Requirement: App Shell layout with sidebar + topbar + content

The system SHALL provide an App Shell layout (`src/app/(app)/layout.tsx`) that:
- Calls `requirePageUser()` to protect all routes in the `(app)/` group
- Does NOT call `getCurrentStore()` — the shell SHALL NOT depend on store existence
- Renders three areas: sidebar (left), topbar (top), children (center)
- **Main content area: padding `px-4 py-6 sm:px-6` (responsive horizontal, vertical `py-6` preservado)**
- Passes `user` data to shell components

The AppShell component (`src/components/shell/app-shell.tsx`) SHALL be a Client Component (pragmatic — needs `useState` for drawer management). The layout remains a Server Component.

#### Scenario: App Shell renders sidebar + topbar + children

- **WHEN** a user accesses any route under `(app)/`
- **THEN** the layout SHALL render the sidebar on the left, topbar at the top, and page content in the center

#### Scenario: Shell does not depend on store

- **WHEN** a user accesses any route under `(app)/`
- **THEN** the layout SHALL NOT call `getCurrentStore()`
- **AND** the shell SHALL render without any store dependency

#### Scenario: Main content has responsive padding with vertical preservation

- **WHEN** the app shell is rendered
- **THEN** the main content area SHALL have `px-4 py-6` for mobile
- **AND** `sm:px-6` with `py-6` preserved for desktop viewports

### Requirement: Sidebar with navigation links and active state

The system SHALL provide a `Sidebar` component (`src/components/shell/sidebar.tsx`) with:
- Links: Dashboard (`/dashboard`), Campanhas (`/campanhas`), Loja (`/loja`), Conta (`/conta`)
- Each link SHALL use a Lucide icon (LayoutDashboard, Megaphone, Store, UserCircle)
- Active route SHALL be visually highlighted using `usePathname()`
- Styled with design tokens (`bg-bg-surface`, `text-text-primary`, `text-text-muted` for inactive, `bg-accent-green/10` + `text-accent-green` for active)

#### Scenario: Sidebar contains all 4 navigation links

- **WHEN** the sidebar is rendered
- **THEN** links "Dashboard", "Campanhas", "Loja", and "Conta" SHALL be present
- **AND** each SHALL link to its respective route

#### Scenario: Sidebar highlights active route

- **WHEN** the current path is `/campanhas`
- **THEN** the "Campanhas" link SHALL have an active/highlighted style (`bg-accent-green/10`)
- **AND** other links SHALL have inactive style

### Requirement: Topbar with logo, CTA, and account menu

The system SHALL provide a `Topbar` component (`src/components/shell/topbar.tsx`) with:
- Logo/app name on the left ("Vendeo")
- CTA button "Nova Campanha" linking to `/campanhas/nova`
- `AccountMenu` component on the right
- Hamburger button (visible only on mobile, `<768px` via `md:hidden`) to toggle the drawer
- **Hamburger button: `min-h-[44px]` + `min-w-[44px]`**
- **CTA "Nova Campanha": `min-h-[44px]`**
- **Account menu trigger: `min-h-[44px]`**
- Styled with design tokens

#### Scenario: Topbar displays CTA "Nova Campanha"

- **WHEN** the topbar is rendered
- **THEN** a CTA button/link "Nova Campanha" SHALL be present
- **AND** it SHALL link to `/campanhas/nova`

#### Scenario: Topbar touch targets are 44px

- **WHEN** the topbar is rendered
- **THEN** hamburger SHALL have `min-h-[44px]` and `min-w-[44px]`
- **AND** CTA "Nova Campanha" SHALL have `min-h-[44px]`
- **AND** account menu trigger SHALL have `min-h-[44px]`

### Requirement: AccountMenu with dropdown

The system SHALL provide an `AccountMenu` component (`src/components/shell/account-menu.tsx`) with:
- User identifier display (email from `claims.email`, fallback `claims.sub?.slice(0, 8)`)
- Dropdown with "Configurações" link → `/conta` (Lucide Settings icon)
- "Sair" button that renders `LogoutButton` (Lucide LogOut icon)
- Click-outside-to-close behavior via `useEffect` + `mousedown` listener
- **Trigger has `aria-haspopup="true"`**
- **`aria-expanded` dinâmico (true/false) conforme menu abre/fecha**
- **Escape fecha o menu via keydown listener**
- **`prefers-reduced-motion`: quando ativo, transições existentes (chevron, dropdown se houver) usam `duration-0`. Não criar transição artificial.**
- Styled with design tokens

#### Scenario: Account menu shows Configurações and Sair

- **WHEN** the account menu dropdown is opened
- **THEN** "Configurações" (link to `/conta`) and "Sair" (logout trigger via LogoutButton) SHALL be visible

#### Scenario: Account menu has aria-haspopup

- **WHEN** the account menu trigger is rendered
- **THEN** it SHALL have `aria-haspopup="true"`

#### Scenario: Account menu Escape closes

- **WHEN** the account menu dropdown is open
- **AND** Escape is pressed
- **THEN** the menu SHALL close

### Requirement: SidebarDrawer for mobile

The system SHALL provide a `SidebarDrawer` component (`src/components/shell/sidebar-drawer.tsx`) for mobile viewports:
- Hamburger button in the topbar opens the drawer
- Drawer slides in from the left with `-translate-x-full`/`translate-x-0` transition
- **Overlay button (`<button>`) with `aria-label="Fechar menu"` and `tabIndex={-1}` closes the drawer on click**
- **Drawer panel has `role="dialog"` and `aria-modal="true"`**
- **Focus trap: Tab循环 dentro do drawer, não vaza para o fundo**
- **Focus move-se ao primeiro elemento focável ao abrir**
- **Botão X (Lucide `X`) visível no canto superior direito do drawer com `aria-label="Fechar menu"`**
- **Escape key closes the drawer via keydown listener AND restores focus to hamburger**
- **Focus returns to hamburger toggle when drawer closes**
- `aria-controls="mobile-drawer"`, `aria-expanded`, `aria-label` on the hamburger button
- **Body scroll lock: salva `document.body.style.overflow` antes de setar `"hidden"`, restaura valor original ao fechar**
- **`prefers-reduced-motion`: quando ativo, transição `duration-0` em vez de `duration-300`**
- Same navigation links as the desktop sidebar
- Clicking a navigation link closes the drawer (Sidebar receives `onNavigate={onClose}`)

#### Scenario: Drawer opens/closes with hamburger

- **WHEN** the hamburger button is clicked on mobile viewport
- **THEN** the drawer SHALL open with overlay visible
- **WHEN** the overlay is clicked
- **THEN** the drawer SHALL close

#### Scenario: Drawer closes when navigating

- **WHEN** the drawer is open
- **AND** the user clicks a navigation link
- **THEN** the drawer SHALL close
- **AND** navigation SHALL proceed

#### Scenario: Drawer has role dialog and focus trap

- **WHEN** the drawer is open
- **THEN** the drawer panel SHALL have `role="dialog"` and `aria-modal="true"`
- **AND** focus SHALL be trapped inside the drawer (Tab não vaza)

#### Scenario: Drawer Escape closes and restores focus

- **WHEN** the drawer is open
- **AND** Escape is pressed
- **THEN** the drawer SHALL close
- **AND** focus SHALL return to the hamburger toggle

#### Scenario: Drawer X button closes

- **WHEN** the drawer is open
- **AND** the X button is clicked
- **THEN** the drawer SHALL close

### Requirement: Route group structure

The system SHALL define the following route group structure under `src/app/`:

```
src/app/
├── (auth)/              # Layout centrado (login, signup, forgot-password, etc.)
├── (app)/               # Layout com App Shell
│   ├── layout.tsx       ← App Shell with requirePageUser()
│   ├── dashboard/page.tsx
│   ├── campanhas/page.tsx, nova/page.tsx, [id]/page.tsx, [id]/client.tsx
│   ├── loja/page.tsx
│   └── conta/page.tsx
├── api/                 # API routes
├── auth/                # signout, confirm
├── layout.tsx           # Root: html, body, fonts, globals (sem header)
└── page.tsx             # redirect("/dashboard")
```

#### Scenario: Route group structure matches spec

- **WHEN** inspecting the directory structure
- **THEN** all folders under `(app)/` SHALL exist as specified
- **AND** `(auth)/` and `(app)/` have radically different layouts
- **AND** the root layout has no `<header>` or AuthHeader
- **AND** the root page redirects to `/dashboard`
