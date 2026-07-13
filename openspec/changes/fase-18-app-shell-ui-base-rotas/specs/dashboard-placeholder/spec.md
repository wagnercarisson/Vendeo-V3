## ADDED Requirements

### Requirement: Dashboard placeholder page

The system SHALL provide a dashboard page at `src/app/(app)/dashboard/page.tsx` inside the `(app)` route group with:
- `<PageHeader title="Dashboard" />`
- `<EmptyState>` component with generic "Em breve" message
- No metrics, no data fetching specific to dashboard content
- Styled with design tokens
- Content evolves in F20

#### Scenario: Dashboard renders PageHeader and EmptyState

- **WHEN** an authenticated user visits `/dashboard`
- **THEN** a PageHeader with title "Dashboard" SHALL be rendered
- **AND** an EmptyState SHALL be rendered below
