> **Propósito**: Delta spec para os componentes base de UI. As seguintes requirements foram modificadas para a F22 — Mobile Hardening.
>
> Synced from `fase-18-app-shell-ui-base-rotas` (MODIFIED).

## MODIFIED Requirements

### Requirement: Input component with label and error

O sistema SHALL provide an `Input` component at `src/components/ui/input.tsx` as a Client Component with:
- `label` prop rendered as `<label>` above the input (associated via `useId()`)
- `error` prop for inline validation message (red text below input using `text-accent-red`)
- `...input` spread for native `<input>` attributes (placeholder, type, onChange, value, etc.)
- Styled with design tokens (`bg-bg-surface`, `text-text-primary`, `border-border`, focus `ring-accent-green`, error `border-accent-red`)
- **SHALL also apply `min-h-[44px]` class for WCAG touch target compliance**

#### Scenario: Input renders with label and error

- **WHEN** `<Input label="Nome" error="Campo obrigatório" />` is rendered
- **THEN** it SHALL render a `<label>` with text "Nome"
- **AND** SHALL render an error message "Campo obrigatório" in red
- **AND** SHALL have `min-h-[44px]` class

#### Scenario: Input applies min-h-[44px]

- **WHEN** any `<Input>` component is rendered
- **THEN** it SHALL have `min-h-[44px]` in its className

### Requirement: Pagination component (ADDED in F21)

O sistema SHALL provide a `Pagination` component at `src/components/ui/pagination.tsx` with:
- `PaginationProps` with `currentPage`, `totalPages`, `onPageChange`
- Botões numéricos com elipse para muitos pages
- "Anterior" desabilitado na página 1, "Próximo" desabilitado na última página
- **SHALL have `flex-wrap` for narrow viewports to prevent overflow**
- Usa `Button` da F18

#### Scenario: Pagination wraps on mobile

- **WHEN** the Pagination component is rendered in a narrow viewport (e.g. 320px)
- **THEN** it SHALL have `flex-wrap` class to allow wrapping
- **AND** buttons SHALL not overflow horizontally
