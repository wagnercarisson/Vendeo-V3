## Purpose

Logout via `POST /auth/signout` com limpeza de Web Storage no cliente antes da chamada server-side. Limpeza seletiva (4 chaves conhecidas), não `clear()`. Route Handler server-side com `signOut()` + `revalidatePath()` + redirect.

> Synced from `fase-7-sessao-login-vertical` (ADDED), then `fase-9-cutover-ownership` (MODIFIED), then `fase-18-app-shell-ui-base-rotas` (MODIFIED). LogoutButton tokens updated: `text-text-*`/`accent-*` replace `slate-*`/`blue-*`. Component accepts `className` prop.

## Requirements

### Requirement: Client-side storage cleanup before logout

The system SHALL clean up known Web Storage keys on the client BEFORE calling the logout endpoint.

- MUST remove `sessionStorage` keys: `campaign_draft`, `campaign_draft_image`, `campaign_preview`
- SHALL NOT remove `localStorage("store_id")` — store is no longer stored in localStorage
- MUST perform cleanup before native form submission to `/auth/signout`
- SHALL NOT use `clear()` — removal is scoped to known keys only
- SHALL proceed with form submission even if cleanup encounters errors (best-effort)

#### Scenario: Logout cleans sessionStorage keys only

- **WHEN** user clicks "Sair"
- **THEN** `sessionStorage.removeItem("campaign_draft")` is called
- **AND** `sessionStorage.removeItem("campaign_draft_image")` is called
- **AND** `sessionStorage.removeItem("campaign_preview")` is called
- **AND** `localStorage.removeItem("store_id")` is NOT called

#### Scenario: Logout does not clear unknown keys

- **WHEN** user clicks "Sair"
- **THEN** other keys in localStorage and sessionStorage (e.g., third-party values) are preserved

### Requirement: Logout route handler destroys session

The system SHALL provide a `POST /auth/signout` Route Handler that destroys the Supabase session.

- MUST use `createServerClient()` to get session context
- MUST call `supabase.auth.signOut()`
- MUST call `revalidatePath("/")` to clear router cache
- MUST redirect to `/login` on success
- SHALL be a POST-only endpoint

#### Scenario: Logout succeeds

- **WHEN** an authenticated user POSTs to `/auth/signout`
- **THEN** the session is destroyed, layout revalidated, and browser redirected to `/login`

#### Scenario: Logout without session

- **WHEN** an unauthenticated user POSTs to `/auth/signout`
- **THEN** the handler still redirects to `/login` (idempotent)

### Requirement: Client-side component triggers logout flow via form

The system SHALL provide a client component that orchestrates the full logout flow using a native HTML form.

- SHALL render a `<form action="/auth/signout" method="POST">` element
- SHALL execute storage cleanup in `onSubmit` handler **before** form submission
- SHALL use native form submission so that the server's `redirect("/login")` navigates the browser naturally
- SHALL handle errors gracefully (e.g., storage cleanup fails but form still submits)

#### Scenario: Logout button clicked

- **WHEN** user clicks "Sair"
- **THEN** storage is cleaned in onSubmit, form POSTs to /auth/signout, and server redirect navigates browser to `/login`

#### Scenario: Logout without authentication

- **WHEN** unauthenticated user submits the logout form
- **THEN** storage is still cleaned, and the server redirects to `/login` (idempotent)

### Requirement: LogoutButton design token cleanup

The `LogoutButton` component SHALL use design tokens instead of raw Tailwind color classes:
- Text SHALL use `text-text-*` tokens (not `slate-*` or `blue-*`)
- Hover/danger states SHALL use `accent-*` tokens
- Backgrounds SHALL use `bg-bg-*` tokens
- The component SHALL accept a `className` prop for flexible styling in both the App Shell (topbar menu) and standalone (`/conta` page) contexts

#### Scenario: LogoutButton uses tokens in shell

- **WHEN** `LogoutButton` renders in the App Shell topbar menu
- **THEN** it SHALL use design tokens (`text-text-secondary`, `hover:text-text-primary`)

#### Scenario: LogoutButton uses tokens on /conta

- **WHEN** `LogoutButton` renders on the `/conta` page
- **THEN** it SHALL use design tokens consistent with the page styling
