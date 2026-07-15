> **Propósito**: Delta spec para o App Shell. As seguintes requirements foram modificadas para a F22 — Mobile Hardening.
>
> Synced from `fase-18-app-shell-ui-base-rotas` (MODIFIED).

## MODIFIED Requirements

### Requirement: SidebarDrawer for mobile

O sistema SHALL provide a `SidebarDrawer` component (`src/components/shell/sidebar-drawer.tsx`) for mobile viewports:
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

### Requirement: Topbar with logo, CTA, and account menu

O sistema SHALL provide a `Topbar` component (`src/components/shell/topbar.tsx`) with:
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

O sistema SHALL provide an `AccountMenu` component (`src/components/shell/account-menu.tsx`) with:
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

### Requirement: App Shell layout with sidebar + topbar + content

O sistema SHALL provide an App Shell layout (`src/app/(app)/layout.tsx`) that:
- Calls `requirePageUser()` to protect all routes in the `(app)/` group
- Does NOT call `getCurrentStore()` — the shell SHALL NOT depend on store existence
- Renders three areas: sidebar (left), topbar (top), children (center)
- **Main content area: padding `px-4 py-6 sm:px-6` (responsive horizontal, vertical `py-6` preservado)**
- Passes `user` data to shell components

#### Scenario: Main content has responsive padding with vertical preservation

- **WHEN** the app shell is rendered
- **THEN** the main content area SHALL have `px-4 py-6` for mobile
- **AND** `sm:px-6` with `py-6` preserved for desktop viewports
