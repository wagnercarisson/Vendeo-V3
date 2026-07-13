> **Propósito**: Esta spec define os 7 componentes base de UI do Vendeo em `src/components/ui/`. São componentes enxutos, sem dependências externas além de Tailwind tokens e Lucide icons. Seguem o design system definido em `tailwind.config.ts`.
>
> > Synced from `fase-18-app-shell-ui-base-rotas` (ADDED).

## Requirements

### Requirement: Button component with variants

The system SHALL provide a `Button` component at `src/components/ui/button.tsx` (Client Component) with three variants:

- `primary`: filled accent-green background (`bg-accent-green`, `text-white`)
- `secondary`: outline style (`border border-border`, `text-text-primary`, `bg-transparent`)
- `ghost`: transparent background (`bg-transparent`, `text-text-secondary`, hover `bg-bg-elevated`)

The component SHALL support:
- `size` prop: `"sm"`, `"md"`, `"lg"` with corresponding padding/font-size
- `disabled` attribute and `opacity-50` styling when disabled
- `loading` state: Lucide `Loader2` with `animate-spin` + disabled behavior
- MUST NOT implement `asChild` pattern or Slot — for links, use `<Link>` directly with the same variant classes
- SHALL forward `className` for additional styling

#### Scenario: Primary variant renders with correct classes

- **WHEN** `<Button variant="primary">Criar Campanha</Button>` is rendered
- **THEN** it SHALL have `bg-accent-green` and `text-white` classes
- **AND** SHALL render the text "Criar Campanha"

#### Scenario: Button disabled has disabled attr and reduced opacity

- **WHEN** `<Button disabled>Salvar</Button>` is rendered
- **THEN** the `<button>` SHALL have `disabled` attribute
- **AND** SHALL have `opacity-50` or equivalent reduced opacity class

#### Scenario: Button loading shows spinner

- **WHEN** `<Button loading>Salvando...</Button>` is rendered
- **THEN** the button SHALL render a spinner icon (Lucide `Loader2` with `animate-spin`)
- **AND** SHALL be disabled

### Requirement: Card component

The system SHALL provide a `Card` component at `src/components/ui/card.tsx` as a Server Component container with:
- `bg-bg-surface` background
- `border` and `rounded-xl` border styling
- `className` prop for extension
- `children` prop for content

#### Scenario: Card renders with base classes

- **WHEN** `<Card><p>Conteúdo</p></Card>` is rendered
- **THEN** it SHALL have `bg-bg-surface`, `border`, `rounded-xl` classes
- **AND** SHALL render the children `<p>Conteúdo</p>`

### Requirement: Input component with label and error

The system SHALL provide an `Input` component at `src/components/ui/input.tsx` as a Client Component with:
- `label` prop rendered as `<label>` above the input (associated via `useId()`)
- `error` prop for inline validation message (red text below input using `text-accent-red`)
- `...input` spread for native `<input>` attributes (placeholder, type, onChange, value, etc.)
- Styled with design tokens (`bg-bg-surface`, `text-text-primary`, `border-border`, focus `ring-accent-green`, error `border-accent-red`)

#### Scenario: Input renders label and placeholder

- **WHEN** `<Input label="Nome do Produto" placeholder="Ex: Tênis Runner Pro" />` is rendered
- **THEN** a `<label>` with text "Nome do Produto" SHALL be present
- **AND** an `<input>` with placeholder "Ex: Tênis Runner Pro" SHALL be present

#### Scenario: Input shows inline error

- **WHEN** `<Input label="Nome" error="Campo obrigatório" />` is rendered
- **THEN** an error message "Campo obrigatório" SHALL appear below the input
- **AND** the error text SHALL use `text-accent-red`

### Requirement: Badge component with status variants

The system SHALL provide a `Badge` component at `src/components/ui/badge.tsx` as a Server Component with:
- `variant` prop: `"ready"` (green), `"error"` (red), `"generating"` (amber/yellow), `"default"` (neutral gray)
- Each variant SHALL have appropriate background and text colors using design tokens
- SHALL use `rounded-full` (pill shape)

#### Scenario: Badge renders ready variant

- **WHEN** `<Badge variant="ready">Pronto</Badge>` is rendered
- **THEN** it SHALL display "Pronto" with `bg-accent-green/10` `text-accent-green` styling

#### Scenario: Badge renders error variant

- **WHEN** `<Badge variant="error">Erro</Badge>` is rendered
- **THEN** it SHALL display "Erro" with `bg-accent-red/10` `text-accent-red` styling

#### Scenario: Badge renders default variant

- **WHEN** `<Badge variant="default">Rascunho</Badge>` is rendered
- **THEN** it SHALL display "Rascunho" with `bg-bg-elevated` `text-text-secondary` styling

### Requirement: EmptyState component

The system SHALL provide an `EmptyState` component at `src/components/ui/empty-state.tsx` as a Server Component with:
- `icon` prop: Lucide icon component to render centered above text
- `title` prop: heading text
- `description` prop: body text
- `action` prop: optional ReactNode (typically a button/Link) displayed below description

#### Scenario: EmptyState renders icon, title, description, and action

- **WHEN** `<EmptyState icon={Inbox} title="Nada aqui" description="Crie sua primeira campanha" action={<Link href="/campanhas/nova">Criar</Link>} />` is rendered
- **THEN** the icon component SHALL be rendered
- **AND** "Nada aqui" SHALL appear as heading
- **AND** "Crie sua primeira campanha" SHALL appear as description
- **AND** the action link SHALL be rendered

### Requirement: Skeleton component

The system SHALL provide a `Skeleton` component at `src/components/ui/skeleton.tsx` as a Server Component with:
- `width` prop: CSS width value (e.g., `"100%"`, `"200px"`)
- `height` prop: CSS height value (e.g., `"20px"`, `"300px"`)
- `rounded` prop: border-radius value (e.g., `"md"`, `"full"`, `"xl"`) — resolved via explicit mapping object to avoid Tailwind JIT dynamic class issue
- Animated shimmer/pulse effect using Tailwind `animate-pulse`

#### Scenario: Skeleton renders with custom dimensions

- **WHEN** `<Skeleton width="200px" height="300px" rounded="xl" />` is rendered
- **THEN** it SHALL have `width: 200px`, `height: 300px`, `rounded-xl` styles
- **AND** SHALL have `animate-pulse` class for loading animation

### Requirement: PageHeader component

The system SHALL provide a `PageHeader` component at `src/components/ui/page-header.tsx` with:
- `title` prop: heading text
- `breadcrumbs` prop: optional array of `{ label: string; href?: string }`
  - If `href` is present, render as `<Link>` — otherwise render as plain text (current page)
- `actions` prop: optional ReactNode slot for action buttons
- Container with bottom border separator using `border-border`

#### Scenario: PageHeader renders title and breadcrumbs

- **WHEN** `<PageHeader title="Tênis Runner Pro" breadcrumbs={[{ label: "Campanhas", href: "/campanhas" }, { label: "Tênis Runner Pro" }]} />` is rendered
- **THEN** "Tênis Runner Pro" SHALL appear as the title
- **AND** "Campanhas" SHALL be rendered as a link to `/campanhas`
- **AND** the second breadcrumb SHALL be rendered as plain text (no link)

#### Scenario: PageHeader renders actions slot

- **WHEN** `<PageHeader title="Campanhas" actions={<Button>Nova</Button>} />` is rendered
- **THEN** the action button SHALL be rendered in the actions area
