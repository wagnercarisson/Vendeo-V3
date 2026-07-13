## MODIFIED Requirements

### Requirement: LogoutButton design token cleanup

The `LogoutButton` component SHALL use design tokens instead of raw Tailwind color classes:
- Text SHALL use `text-text-*` tokens (not `slate-*` or `blue-*`)
- Hover/danger states SHALL use `accent-*` tokens
- Backgrounds SHALL use `bg-bg-*` tokens
- Alternatively, the component SHALL accept a `variant` or `className` prop for flexible styling in both the App Shell (topbar menu) and standalone (`/conta` page) contexts

#### Scenario: LogoutButton uses tokens in shell

- **WHEN** `LogoutButton` renders in the App Shell topbar menu
- **THEN** it SHALL use design tokens (`text-text-secondary`, `hover:bg-bg-elevated`, etc.)

#### Scenario: LogoutButton uses tokens on /conta

- **WHEN** `LogoutButton` renders on the `/conta` page
- **THEN** it SHALL use design tokens consistent with the page styling
