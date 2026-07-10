# Campaign Preview Page

> Part of `fase-16-minhas-campanhas` (MODIFIED).
> Delta spec — modifies requirements from main `openspec/specs/campaign-preview-page/spec.md`.

## Purpose

The `/campaign/preview` page redirects authenticated users with a store to `/minhas-campanhas` (Fase 16 list page), since sessionStorage is no longer the source of truth for generated campaigns. Unauthenticated users and users without a store continue with existing behavior.

## MODIFIED Requirements

### Requirement: Server wrapper with auth + store resolution

The `/campaign/preview` page SHALL redirect authenticated users with a store to `/minhas-campanhas` instead of rendering `CampaignPreviewClient`.

**Note:** This requirement modifies the existing `Requirement: Server wrapper with auth + store resolution` in `openspec/specs/campaign-preview-page/spec.md`.

The page SHALL be a server component with the following logic:

- `await requirePageUser()` — redirects to `/login` if not authenticated
- `const store = await getCurrentStore(user.userId)` — resolves store
- If `!store`: `redirect("/store")` — user must have a store
- If store exists: `redirect("/minhas-campanhas")` — campaigns are now listed in the Fase 16 list page; preview via sessionStorage is deprecated
- The `CampaignPreviewClient` component SHALL NOT be rendered for any user who reaches the redirect condition

#### Scenario: Usuário autenticado com loja é redirecionado para minhas-campanhas

- **WHEN** an authenticated user with a store visits `/campaign/preview`
- **THEN** the server wrapper redirects (302) to `/minhas-campanhas`
- **AND** no `CampaignPreviewClient` component is rendered

#### Scenario: Usuário autenticado sem loja é redirecionado para /store

- **WHEN** an authenticated user visits `/campaign/preview`
- **AND** the user has no store
- **THEN** the server wrapper redirects to `/store`
- **AND** no `CampaignPreviewClient` component is rendered

#### Scenario: Usuário não autenticado é redirecionado para /login

- **WHEN** an unauthenticated user visits `/campaign/preview`
- **THEN** `requirePageUser()` redirects to `/login`
- **AND** no `CampaignPreviewClient` component is rendered
