## MODIFIED Requirements

### Requirement: Route migration from /campanha/[id] to /campanhas/[id]

The campaign page SHALL be moved from `src/app/campanha/[id]/` to `src/app/(app)/campanhas/[id]/page.tsx`. The old route `/campanha/:id` SHALL redirect to `/campanhas/:id` via next.config.ts 301.

#### Scenario: Campaign page moved to /campanhas/[id]

- **WHEN** a user visits `/campanhas/abc-123`
- **THEN** the campaign page SHALL render
- **WHEN** a user visits `/campanha/abc-123`
- **THEN** the system SHALL respond with HTTP 301 to `/campanhas/abc-123`

### Requirement: Server Component with auth and ownership

When `getCurrentStore()` returns `null`, the server component SHALL redirect to `/loja` (instead of `/store`).

#### Scenario: Usuário autenticado sem loja

- **WHEN** um usuário autenticado mas sem loja associada acessa `/campanhas/{id}`
- **THEN** o sistema SHALL redirecionar para `/loja`

### Requirement: Emoji icons replaced by Lucide

The Client Component at `src/app/(app)/campanhas/[id]/client.tsx` SHALL replace all emoji icons with Lucide equivalents:
- Botão "Editar" SHALL use `Pencil` (or `FileEdit`) icon
- Botão "Salvar" SHALL use `Save` icon
- Botão "Restaurar original" SHALL use `RotateCcw` icon
- Botão "Cancelar" SHALL use `X` (or `Ban`) icon
- Badge "Editado" SHALL use `CheckCheck` icon

#### Scenario: Emoji replaced by Lucide icons

- **WHEN** the Client Component renders with `displayStatus === "ready"`
- **THEN** all icons in the publication copy section SHALL be Lucide components, not emoji characters

### Requirement: Kit de Publicação section uses Card + heading + Badge

The Kit de Publicação section SHALL use `<Card>`, a local heading, and `<Badge>` from the UI base instead of inline styled elements or `<PageHeader>` (PageHeader is reserved for page-level headers).

#### Scenario: Kit de Publicação uses UI components

- **WHEN** the Kit de Publicação section renders
- **THEN** the badge "Editado" SHALL use the `<Badge>` component
- **AND** the section SHALL use `<Card>` as container
- **AND** the title SHALL use a local `<h2>` or heading element, not `<PageHeader>`

### Requirement: Design tokens applied

All inline `slate-*`, `blue-*`, `red-*`, `gray-*`, `green-*` classes in the migrated campaign page SHALL be replaced with design tokens (`bg-bg-*`, `text-text-*`, `accent-*`, `border-*`).

#### Scenario: Tokens replace raw Tailwind colors

- **WHEN** the page renders any UI element
- **THEN** it SHALL use design tokens instead of raw Tailwind color classes

### Requirement: Navigation links updated

The navigation links in the campaign page SHALL be updated:
- Link "← Campanhas" SHALL point to `/campanhas` (instead of `/minhas-campanhas`)

#### Scenario: Link "← Campanhas" presente na página individual

- **WHEN** um usuário acessa `/campanhas/[id]`
- **THEN** o topo da página exibe um link "← Campanhas" apontando para `/campanhas`
