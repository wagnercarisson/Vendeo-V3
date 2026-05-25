> **Propósito**: Delta spec para Store Identity UI — movendo o formulário para `/store` e adicionando navegação entre as rotas.

## ADDED Requirements

### Requirement: Navigation between `/` and `/store`

The `/store` page SHALL include a link/button to return to `/` (campaign input page). The `/` page blocking state SHALL include a link/button to navigate to `/store`.

#### Scenario: Store page has link to campaign page

- **WHEN** a user is on `/store`
- **THEN** a link or button SHALL be present to navigate to `/`

#### Scenario: Blocking state has link to store page

- **WHEN** a user is on `/` without a valid `store_id`
- **THEN** a link or button SHALL be present to navigate to `/store`


## MODIFIED Requirements

### Requirement: Store identity form UI

The system SHALL render a store identity form at `src/app/store/page.tsx` (`/store`). The form SHALL be the primary content of the page. A secondary navigation link/button to return to `/` MAY be displayed.

The page SHALL be a composition of a form component (`src/components/flow/store-identity-form.tsx`), a preview component (`src/components/flow/store-preview.tsx`), and a custom hook (`src/components/flow/use-store-form.ts`) that manages state and API calls.

The page SHALL follow the visual and UX rules defined in `openspec/design-system/MASTER.md` and `openspec/design-system/pages/store-identity.md`.

#### Scenario: Landing page renders store identity form

- **WHEN** a user visits `/store`
- **THEN** the page SHALL render the store identity form
- **AND** no unrelated content SHALL appear on the page

#### Scenario: Form follows design system

- **WHEN** inspecting the page
- **THEN** all elements SHALL use colors, typography, and spacing tokens from MASTER.md
- **AND** the layout SHALL match the store-identity page override specification
