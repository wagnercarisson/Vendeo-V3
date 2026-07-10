# Store Ownership Pages

> Part of `fase-16-minhas-campanhas` (MODIFIED).
> Delta spec — modifies requirements from main `openspec/specs/store-ownership-pages/spec.md`.

## Purpose

The `/campaign/preview` redirect behavior is updated: authenticated users with a store are now redirected to `/minhas-campanhas` instead of rendering `CampaignPreviewClient`.

## MODIFIED Requirements

### Requirement: /campaign/preview with server wrapper

The system SHALL redirect authenticated users with a store to `/minhas-campanhas` instead of rendering `CampaignPreviewClient`.

**Note:** This requirement modifies the existing `Requirement: /campaign/preview with server wrapper` in `openspec/specs/store-ownership-pages/spec.md`.

The server wrapper behavior SHALL be updated as follows:

- `src/app/campaign/preview/page.tsx` SHALL remain a server component
- MUST call `await requirePageUser()` — redirects to `/login` if not authenticated
- MUST call `const store = await getCurrentStore(user.userId)`
- If store is null: MUST call `redirect("/store")`
- If store exists: MUST call `redirect("/minhas-campanhas")` instead of rendering `CampaignPreviewClient`

#### Scenario: Usuário autenticado com loja é redirecionado para minhas-campanhas

- **WHEN** an authenticated user visits `/campaign/preview`
- **AND** the user has a store
- **THEN** the server redirects to `/minhas-campanhas`
- **AND** `CampaignPreviewClient` is NOT rendered

#### Scenario: Usuário autenticado sem loja é redirecionado para /store

- **WHEN** an authenticated user visits `/campaign/preview`
- **AND** the user has no store
- **THEN** the server redirects to `/store`

#### Scenario: Usuário não autenticado é redirecionado para /login

- **WHEN** an unauthenticated user visits `/campaign/preview`
- **THEN** `requirePageUser()` redirects to `/login`
