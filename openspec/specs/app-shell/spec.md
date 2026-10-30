## Purpose

> **Propósito**: Esta spec define o App Shell do Vendeo — layout de navegação global com sidebar, topbar, drawer mobile e menu de conta. Substitui o AuthHeader como estrutura de navegação principal. Estabelece o route group `(app)/` com layout protegido.
>
> > Synced from `fase-18-app-shell-ui-base-rotas` (ADDED).
> > Modified by `fase-35-changelog-novidades` (MODIFIED + ADDED): Sidebar 5º item "Novidades" com indicador, AccountMenu link "Novidades", fluxo `latestEntryId` server → client por prop.

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

### Requirement: Fluxo de latestEntryId — layout server → AppShell → Sidebar/SidebarDrawer

O sistema SHALL prover o fluxo de `latestEntryId` (id da entry mais recente, derivado do filesystem) do server para os componentes client do shell SEM importar módulos `server-only` em componentes client:

> Added by `fase-35-changelog-novidades`.

- **`src/app/(app)/layout.tsx`** (server component) SHALL buscar a entry mais recente via `getAllEntries()` (módulo `server-only`), derivar `latestEntryId = entries[0]?.frontmatter.id ?? null` e passar como prop `latestChangelogEntryId` para `<AppShell>`
- **`src/components/shell/app-shell.tsx`** (client) SHALL aceitar a prop `latestChangelogEntryId?: string | null` e repassá-la como `latestEntryId` para `<Sidebar>` e `<SidebarDrawer>` — o AppShell SHALL NÃO importar `get-changelog`/`getAllEntries`/qualquer módulo `server-only`
- **`src/components/shell/sidebar-drawer.tsx`** (client) SHALL aceitar a prop `latestEntryId?: string | null` e repassá-la para `<Sidebar isDrawer onNavigate latestEntryId={...}>`
- **`src/components/shell/sidebar.tsx`** (client) SHALL aceitar `latestEntryId?: string | null` e passá-la para `<SidebarBadge latestEntryId={latestEntryId} />`

O valor SHALL ser opcional (`string | null`) e o shell SHALL renderizar normalmente quando `null` (sem entries) sem quebrar.

#### Scenario: Layout busca e injeta latestEntryId

- **WHEN** `layout.tsx` é renderizado no server
- **THEN** chama `getAllEntries()` (server-only) e passa `latestChangelogEntryId={entries[0]?.frontmatter.id ?? null}` para `<AppShell>`

#### Scenario: AppShell repassa para Sidebar e SidebarDrawer

- **WHEN** `AppShell` recebe `latestChangelogEntryId`
- **THEN** repassa como `latestEntryId` para `<Sidebar>` e para `<SidebarDrawer>`
- **AND** não importa nenhum módulo `server-only`

#### Scenario: SidebarDrawer repassa para o Sidebar interno

- **WHEN** `SidebarDrawer` recebe `latestEntryId`
- **THEN** repassa para `<Sidebar isDrawer onNavigate latestEntryId={...}>`

#### Scenario: Shell funciona sem entries

- **WHEN** `latestChangelogEntryId` é `null` (sem entries de changelog)
- **THEN** AppShell, Sidebar, SidebarDrawer e SidebarBadge renderizam normalmente sem quebrar e sem exibir indicador

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
