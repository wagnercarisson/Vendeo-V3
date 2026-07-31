## MODIFIED Requirements

### Requirement: Sidebar with navigation links and active state

The system SHALL provide a `Sidebar` component (`src/components/shell/sidebar.tsx`) with:
- Links: Dashboard (`/dashboard`), Campanhas (`/campanhas`), Loja (`/loja`), Conta (`/conta`), **Novidades (`/novidades`)**
- Each link SHALL use a Lucide icon (LayoutDashboard, Megaphone, Store, UserCircle, **Sparkles/Newspaper para Novidades**)
- Active route SHALL be visually highlighted using `usePathname()`
- Styled with design tokens (`bg-bg-surface`, `text-text-primary`, `text-text-muted` for inactive, `bg-accent-green/10` + `text-accent-green` for active)
- **Accept a prop `latestEntryId?: string | null`** (opcional, recebido do server via AppShell) — usado apenas para o indicador
- The "Novidades" item SHALL include a `SidebarBadge` indicator (client component) that shows a visual dot/badge when `hasUnseen(latestEntryId)` returns `true`
- **O `Sidebar` SHALL NÃO importar `get-changelog`/`getAllEntries`/qualquer módulo `server-only`** — recebe `latestEntryId` por prop; nunca busca dados do filesystem

#### Scenario: Sidebar contains all 5 navigation links

- **WHEN** the sidebar is rendered
- **THEN** links "Dashboard", "Campanhas", "Loja", "Conta", and "Novidades" SHALL be present
- **AND** each SHALL link to its respective route

#### Scenario: Sidebar highlights active route

- **WHEN** the current path is `/campanhas`
- **THEN** the "Campanhas" link SHALL have an active/highlighted style (`bg-accent-green/10`)
- **AND** other links SHALL have inactive style

#### Scenario: Sidebar highlights Novidades active route

- **WHEN** the current path is `/novidades`
- **THEN** the "Novidades" link SHALL have the active/highlighted style (`bg-accent-green/10`)

#### Scenario: Sidebar shows indicator when there is new content

- **WHEN** `hasUnseen(latestEntryId)` returns `true`
- **THEN** a `SidebarBadge` indicator SHALL be visible next to the "Novidades" item

#### Scenario: Sidebar indicator disappears after visiting /novidades

- **WHEN** `lastSeenId` equals `latestEntryId` after visiting `/novidades`
- **THEN** the `SidebarBadge` indicator SHALL not be rendered

#### Scenario: Sidebar badge funciona sem latestEntryId

- **WHEN** `latestEntryId` é `null`/`undefined` (ex: sem entries)
- **THEN** o `SidebarBadge` não exibe indicador e o sidebar não quebra

### Requirement: AccountMenu with dropdown

The system SHALL provide an `AccountMenu` component (`src/components/shell/account-menu.tsx`) with:
- User identifier display (email from `claims.email`, fallback `claims.sub?.slice(0, 8)`)
- Dropdown with "Configurações" link → `/conta` (Lucide Settings icon)
- **"Novidades" link → `/novidades` (Lucide Sparkles/Newspaper icon) positioned between "Configurações" and "Sair"**
- "Sair" button that renders `LogoutButton` (Lucide LogOut icon)
- Click-outside-to-close behavior via `useEffect` + `mousedown` listener
- **Trigger has `aria-haspopup="true"`**
- **`aria-expanded` dinâmico (true/false) conforme menu abre/fecha**
- **Escape fecha o menu via keydown listener**
- **`prefers-reduced-motion`: quando ativo, transições existentes (chevron, dropdown se houver) usam `duration-0`. Não criar transição artificial.**
- Styled with design tokens

#### Scenario: Account menu shows Configurações, Novidades and Sair

- **WHEN** the account menu dropdown is opened
- **THEN** "Configurações" (link to `/conta`), "Novidades" (link to `/novidades`), and "Sair" (logout trigger via LogoutButton) SHALL be visible

#### Scenario: Account menu has aria-haspopup

- **WHEN** the account menu trigger is rendered
- **THEN** it SHALL have `aria-haspopup="true"`

#### Scenario: Account menu Escape closes

- **WHEN** the account menu dropdown is open
- **AND** Escape is pressed
- **THEN** the menu SHALL close

## ADDED Requirements

### Requirement: Fluxo de latestEntryId — layout server → AppShell → Sidebar/SidebarDrawer

O sistema SHALL prover o fluxo de `latestEntryId` (id da entry mais recente, derivado do filesystem) do server para os componentes client do shell SEM importar módulos `server-only` em componentes client:

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
