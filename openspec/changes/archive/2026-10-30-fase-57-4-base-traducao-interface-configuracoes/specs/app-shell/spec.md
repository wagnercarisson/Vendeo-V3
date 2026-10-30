## MODIFIED Requirements

### Requirement: Sidebar with navigation links and active state

The system SHALL provide a `Sidebar` component (`src/components/shell/sidebar.tsx`) with:
- Links: Dashboard (`/dashboard`), Campanhas (`/campanhas`), Loja (`/loja`), Conta (`/conta`),
  Novidades (`/novidades`)
- Each link SHALL use a Lucide icon (LayoutDashboard, Megaphone, Store, UserCircle,
  Sparkles/Newspaper for Novidades)
- Labels SHALL come from the `shell` catalog in the effective UI locale, with `pt-BR` as the
  required source and `es-419` as the Spanish LATAM catalog
- Active route SHALL be visually highlighted using `usePathname()`
- Styled with design tokens (`bg-bg-surface`, `text-text-primary`, `text-text-muted` for
  inactive, `bg-accent-green/10` + `text-accent-green` for active)
- **Accept a prop `latestEntryId?: string | null`** (optional, received from the server via
  AppShell) — used only for the indicator
- The "Novidades" item SHALL include a `SidebarBadge` indicator (client component) that shows a
  visual dot/badge when `hasUnseen(latestEntryId)` returns `true`
- **`Sidebar` SHALL NOT import `get-changelog`/`getAllEntries`/any `server-only` module** — it
  receives `latestEntryId` by prop and never reads the filesystem
- The sidebar SHALL NOT add a settings item; `/configuracoes` SHALL be reachable only from the
  account menu

#### Scenario: Sidebar contains all 5 navigation links

- **WHEN** the sidebar is rendered
- **THEN** links for Dashboard, Campanhas, Loja, Conta, and Novidades SHALL be present
- **AND** each SHALL link to its respective route
- **AND** no `/configuracoes` link SHALL be present

#### Scenario: Sidebar labels follow the UI locale

- **WHEN** the effective UI locale is `es-419`
- **THEN** the sidebar labels SHALL be the `es-419` catalog values
- **AND** the `href` values SHALL remain unchanged

#### Scenario: Sidebar highlights active route

- **WHEN** the current path is `/campanhas`
- **THEN** the Campanhas link SHALL have an active/highlighted style (`bg-accent-green/10`)
- **AND** other links SHALL have inactive style

#### Scenario: Sidebar highlights Novidades active route

- **WHEN** the current path is `/novidades`
- **THEN** the Novidades link SHALL have the active/highlighted style (`bg-accent-green/10`)

#### Scenario: Sidebar shows indicator when there is new content

- **WHEN** `hasUnseen(latestEntryId)` returns `true`
- **THEN** a `SidebarBadge` indicator SHALL be visible next to the Novidades item

#### Scenario: Sidebar indicator disappears after visiting /novidades

- **WHEN** `lastSeenId` equals `latestEntryId` after visiting `/novidades`
- **THEN** the `SidebarBadge` indicator SHALL not be rendered

#### Scenario: Sidebar badge works without latestEntryId

- **WHEN** `latestEntryId` is `null`/`undefined` (e.g. no entries)
- **THEN** `SidebarBadge` does not show an indicator and the sidebar does not break

### Requirement: Topbar with logo, CTA, and account menu

The system SHALL provide a `Topbar` component (`src/components/shell/topbar.tsx`) with:
- Logo/app name on the left ("Vendeo", not translated)
- CTA button linking to `/campanhas/nova`, with label and `aria-label` from the `shell` catalog
  in the effective UI locale
- `AccountMenu` component on the right
- Hamburger button (visible only on mobile, `<768px` via `md:hidden`) to toggle the drawer,
  with localized `aria-label`
- **Hamburger button: `min-h-[44px]` + `min-w-[44px]`**
- **CTA: `min-h-[44px]`**
- **Account menu trigger: `min-h-[44px]`**
- Styled with design tokens

#### Scenario: Topbar displays localized CTA

- **WHEN** the topbar is rendered in `pt-BR`
- **THEN** the CTA displays “Nova Campanha”
- **WHEN** the topbar is rendered in `es-419`
- **THEN** the CTA displays the `es-419` catalog value
- **AND** it SHALL link to `/campanhas/nova` in both cases

#### Scenario: Topbar touch targets are 44px

- **WHEN** the topbar is rendered
- **THEN** hamburger SHALL have `min-h-[44px]` and `min-w-[44px]`
- **AND** the CTA SHALL have `min-h-[44px]`
- **AND** account menu trigger SHALL have `min-h-[44px]`

#### Scenario: Hamburger aria-label follows locale

- **WHEN** the topbar is rendered in `es-419`
- **THEN** the hamburger `aria-label` SHALL be the `es-419` catalog value

### Requirement: AccountMenu with dropdown

The system SHALL provide an `AccountMenu` component (`src/components/shell/account-menu.tsx`) with:
- User identifier display (email from `claims.email`, fallback `claims.sub?.slice(0, 8)`;
  fallback “Usuário” from the catalog when neither exists)
- Dropdown entries in this order:
  1. **Conta** → `/conta` (Lucide `UserCircle`)
  2. **Novidades** → `/novidades` (Lucide `Sparkles`/`Newspaper`)
  3. **Configurações** → `/configuracoes` (Lucide `Settings`)
  4. **Sair** button rendered by `LogoutButton` (Lucide `LogOut`)
- Labels SHALL come from the `shell` catalog in the effective UI locale
- The former “Configurações” link that pointed to `/conta` SHALL be renamed to “Conta”
- Click-outside-to-close behavior via `useEffect` + `mousedown` listener
- **Trigger has `aria-haspopup="true"`**
- **`aria-expanded` dynamic (true/false) as the menu opens/closes**
- **Escape closes the menu via keydown listener**
- **`prefers-reduced-motion`: when active, existing transitions (chevron, dropdown if any) use
  `duration-0`. Do not create artificial transitions.**
- Styled with design tokens

In `/admin`, the menu SHALL preserve the legacy Portuguese behavior: “Configurações” points to
`/conta`, followed by “Novidades” and “Sair”, with no `/configuracoes` link.

#### Scenario: Account menu shows the approved order

- **WHEN** the account menu dropdown is opened in the storefront
- **THEN** “Conta” (`/conta`), “Novidades” (`/novidades`), “Configurações”
  (`/configuracoes`), and “Sair” SHALL be visible in this order

#### Scenario: Former Configurações link is now Conta

- **WHEN** the account menu is opened
- **THEN** the `/conta` entry is labeled “Conta”
- **AND** no entry labeled “Configurações” points to `/conta`

#### Scenario: Admin keeps legacy menu

- **WHEN** the current path starts with `/admin`
- **THEN** the menu is rendered in `pt-BR`
- **AND** “Configurações” points to `/conta`
- **AND** no `/configuracoes` link is present

#### Scenario: Account menu labels follow locale

- **WHEN** the effective locale is `es-419`
- **THEN** all menu labels and `aria-label` values SHALL use the `es-419` catalog

#### Scenario: Account menu has aria-haspopup

- **WHEN** the account menu trigger is rendered
- **THEN** it SHALL have `aria-haspopup="true"`

#### Scenario: Account menu Escape closes

- **WHEN** the account menu dropdown is open
- **AND** Escape is pressed
- **THEN** the menu SHALL close

### Requirement: SidebarDrawer for mobile

The system SHALL provide a `SidebarDrawer` component (`src/components/shell/sidebar-drawer.tsx`)
for mobile viewports:
- Hamburger button in the topbar opens the drawer
- Drawer slides in from the left with `-translate-x-full`/`translate-x-0` transition
- **Overlay button (`<button>`) with an `aria-label` from the `shell` catalog (pt-BR “Fechar
  menu”, es-419 equivalent) and `tabIndex={-1}` closes the drawer on click**
- **Drawer panel has `role="dialog"` and `aria-modal="true"`**
- **Focus trap: Tab cycles inside the drawer and does not leak to the background**
- **Focus moves to the first focusable element on open**
- **X button (Lucide `X`) visible in the top-right of the drawer with an `aria-label` from the
  `shell` catalog**
- **Escape closes the drawer via keydown listener AND restores focus to the hamburger**
- **Focus returns to the hamburger toggle when the drawer closes**
- `aria-controls="mobile-drawer"`, `aria-expanded`, and localized `aria-label` on the hamburger
- **Body scroll lock: saves `document.body.style.overflow` before setting `"hidden"`, restores
  the original value on close**
- **`prefers-reduced-motion`: when active, `duration-0` instead of `duration-300`**
- Same navigation links and catalog labels as the desktop sidebar
- Clicking a navigation link closes the drawer (`Sidebar` receives `onNavigate={onClose}`)

#### Scenario: Drawer opens/closes with hamburger

- **WHEN** the hamburger button is clicked on a mobile viewport
- **THEN** the drawer SHALL open with the overlay visible
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
- **AND** focus SHALL be trapped inside the drawer

#### Scenario: Drawer Escape closes and restores focus

- **WHEN** the drawer is open
- **AND** Escape is pressed
- **THEN** the drawer SHALL close
- **AND** focus SHALL return to the hamburger toggle

#### Scenario: Drawer X button closes

- **WHEN** the drawer is open
- **AND** the X button is clicked
- **THEN** the drawer SHALL close

#### Scenario: Drawer labels follow locale

- **WHEN** the drawer is rendered in `es-419`
- **THEN** the dialog, close, and overlay `aria-label` values SHALL use the `es-419` catalog
- **AND** the focus, Escape, and scroll-lock behavior SHALL remain unchanged
