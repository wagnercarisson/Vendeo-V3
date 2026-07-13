## ADDED Requirements

### Requirement: App Shell layout with sidebar + topbar + content

The system SHALL provide an App Shell layout (`src/app/(app)/layout.tsx`) that:
- Calls `requirePageUser()` to protect all routes in the `(app)/` group
- Does NOT call `getCurrentStore()` — the shell SHALL NOT depend on store existence
- Renders three areas: sidebar (left), topbar (top), children (center)
- Passes `user` data to shell components

#### Scenario: App Shell renders sidebar + topbar + children

- **WHEN** a user accesses any route under `(app)/`
- **THEN** the layout SHALL render the sidebar on the left, topbar at the top, and page content in the center

#### Scenario: Shell does not depend on store

- **WHEN** a user accesses any route under `(app)/`
- **THEN** the layout SHALL NOT call `getCurrentStore()`
- **AND** the shell SHALL render without any store dependency

### Requirement: Sidebar with navigation links and active state

The system SHALL provide a `Sidebar` component (`src/components/shell/sidebar.tsx`) with:
- Links: Dashboard (`/dashboard`), Campanhas (`/campanhas`), Loja (`/loja`), Conta (`/conta`)
- Each link SHALL use a Lucide icon
- Active route SHALL be visually highlighted using the current pathname
- Styled with design tokens (`bg-bg-surface`, `text-text-primary`, `text-text-muted` for inactive)

#### Scenario: Sidebar contains all 4 navigation links

- **WHEN** the sidebar is rendered
- **THEN** links "Dashboard", "Campanhas", "Loja", and "Conta" SHALL be present
- **AND** each SHALL link to its respective route

#### Scenario: Sidebar highlights active route

- **WHEN** the current path is `/campanhas`
- **THEN** the "Campanhas" link SHALL have an active/highlighted style
- **AND** other links SHALL have inactive style

### Requirement: Topbar with logo, CTA, and account menu

The system SHALL provide a `Topbar` component (`src/components/shell/topbar.tsx`) with:
- Logo/app name on the left
- CTA button "Nova Campanha" linking to `/campanhas/nova`
- `AccountMenu` component on the right
- Hamburger button (visible only on mobile, `<768px`) to toggle the drawer
- Styled with design tokens

#### Scenario: Topbar displays CTA "Nova Campanha"

- **WHEN** the topbar is rendered
- **THEN** a CTA button/link "Nova Campanha" SHALL be present
- **AND** it SHALL link to `/campanhas/nova`

### Requirement: AccountMenu with dropdown

The system SHALL provide an `AccountMenu` component (`src/components/shell/account-menu.tsx`) with:
- User identifier display (name if available, otherwise email, otherwise userId short)
- Dropdown with "Configurações" link → `/conta`
- "Sair" button that triggers the logout flow
- Lucide icons for each option
- Styled with design tokens

#### Scenario: Account menu shows Configurações and Sair

- **WHEN** the account menu dropdown is opened
- **THEN** "Configurações" (link to `/conta`) and "Sair" (logout trigger) SHALL be visible

### Requirement: SidebarDrawer for mobile

The system SHALL provide a `SidebarDrawer` component (`src/components/shell/sidebar-drawer.tsx`) for mobile viewports:
- Hamburger button in the topbar opens the drawer
- Drawer slides in from the left with an overlay backdrop
- Overlay click closes the drawer
- Escape key closes the drawer
- Clicking a navigation link closes the drawer
- `aria-controls`, `aria-expanded`, `aria-label` attributes on the hamburger button
- Body scroll lock when drawer is open
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
