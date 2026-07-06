## MODIFIED Requirements

### Requirement: Preview payload normalization for legacy format

**MODIFIED**: The `/campaign/preview` page is now a server wrapper with an extracted client component.

- `src/app/campaign/preview/page.tsx` SHALL be a server component (wrapper):
  - `await requirePageUser()` — redirects to `/login` if not authenticated
  - `const store = await getCurrentStore(user.userId)` — resolves store
  - If `!store`: `redirect("/store")` — user must have a store
  - If store exists: renders `<CampaignPreviewClient />`
- `src/app/campaign/preview/preview-client.tsx` SHALL contain all existing client logic (extracted from the original page.tsx)
- The client component SHALL continue to handle sessionStorage payload normalization as before

#### Scenario: Server wrapper validates auth before rendering

- **WHEN** an unauthenticated user visits `/campaign/preview`
- **THEN** the server wrapper redirects to `/login`
- **AND** no client component is rendered

#### Scenario: Server wrapper redirects to /store if no store

- **WHEN** an authenticated user visits `/campaign/preview`
- **AND** the user has no store
- **THEN** the server wrapper redirects to `/store`

#### Scenario: Server wrapper renders client component

- **WHEN** an authenticated user with a store visits `/campaign/preview`
- **THEN** `<CampaignPreviewClient />` is rendered
- **AND** the client handles sessionStorage payload as before
