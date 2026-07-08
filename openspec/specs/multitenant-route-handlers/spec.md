# Multi-Tenant Route Handlers

> Synced from `fase-10-perimetro-multitenant` (ADDED).

## Purpose

Multi-tenant guards applied to all store-scoped route handlers: `requireAuthorizedStore()` for ownership and `requireSameOrigin()` (CSRF) for mutations.

## Requirements

### Requirement: requireAuthorizedStore in logo route handlers

The system SHALL apply `requireAuthorizedStore(storeId)` and `requireSameOrigin()` (for mutations) in all `/api/store/[id]/logo` route handlers.

Routes affected:
- `GET /api/store/[id]/logo` — `requireAuthorizedStore(id)` (no CSRF)
- `POST /api/store/[id]/logo` — `requireSameOrigin(request)` + `requireAuthorizedStore(id)`
- `DELETE /api/store/[id]/logo` — `requireSameOrigin(request)` + `requireAuthorizedStore(id)`
- `POST /api/store/[id]/logo/retry-brand-director` — `requireSameOrigin(request)` + `requireAuthorizedStore(id)`

Precedência: `requireSameOrigin()` roda antes de `requireAuthorizedStore()`.

#### Scenario: GET logo for own store returns 200

- **WHEN** `GET /api/store/:id/logo` is called
- **AND** user owns the store
- **THEN** status is 200 with logo data

#### Scenario: GET logo for alien store returns 404

- **WHEN** `GET /api/store/:id/logo` is called
- **AND** store belongs to another user
- **THEN** status is 404 JSON

#### Scenario: POST logo cross-origin returns 403

- **WHEN** `POST /api/store/:id/logo` is called
- **AND** Origin differs from Host
- **THEN** status is 403 JSON (CSRF has precedence)

#### Scenario: POST logo without session returns 401

- **WHEN** `POST /api/store/:id/logo` is called
- **AND** same origin
- **AND** no valid session
- **THEN** status is 401 JSON

### Requirement: requireAuthorizedStore in brand-profile route handlers

The system SHALL apply `requireAuthorizedStore(storeId)` and `requireSameOrigin()` (for mutations) in all `/api/store/[id]/brand-profile` route handlers.

Routes affected:
- `GET /api/store/[id]/brand-profile` — `requireAuthorizedStore(id)` (no CSRF)
- `POST /api/store/[id]/brand-profile` — `requireSameOrigin(request)` + `requireAuthorizedStore(id)`
- `PATCH /api/store/[id]/brand-profile` — `requireSameOrigin(request)` + `requireAuthorizedStore(id)`
- `POST /api/store/[id]/brand-profile/infer` — `requireSameOrigin(request)` + `requireAuthorizedStore(id)`
- `POST /api/store/[id]/brand-profile/realign` — `requireSameOrigin(request)` + `requireAuthorizedStore(id)`
- `PATCH /api/store/[id]/brand-profile/metadata` — `requireSameOrigin(request)` + `requireAuthorizedStore(id)`
- `POST /api/store/[id]/brand-profile/generate-without-logo` — `requireSameOrigin(request)` + `requireAuthorizedStore(id)`

#### Scenario: GET brand-profile for own store returns 200

- **WHEN** `GET /api/store/:id/brand-profile` is called
- **AND** user owns the store
- **THEN** status is 200

#### Scenario: GET brand-profile for alien store returns 404

- **WHEN** `GET /api/store/:id/brand-profile` is called
- **AND** store belongs to another user
- **THEN** status is 404 JSON

#### Scenario: POST brand-profile/infer for alien store returns 404

- **WHEN** `POST /api/store/:id/brand-profile/infer` is called
- **AND** same origin
- **AND** store belongs to another user
- **THEN** status is 404 JSON

### Requirement: requireAuthorizedStore in visual-signature route handlers

The system SHALL apply `requireAuthorizedStore(storeId)` and `requireSameOrigin()` (for mutations) in all `/api/store/[id]/visual-signature` route handlers.

Routes affected:
- `GET /api/store/[id]/visual-signature` — `requireAuthorizedStore(id)` (no CSRF)
- `DELETE /api/store/[id]/visual-signature` — `requireSameOrigin(request)` + `requireAuthorizedStore(id)`
- `POST /api/store/[id]/visual-signature/approve` — `requireSameOrigin(request)` + `requireAuthorizedStore(id)`
- `POST /api/store/[id]/visual-signature/reject` — `requireSameOrigin(request)` + `requireAuthorizedStore(id)`
- `POST /api/store/[id]/visual-signature/restore` — `requireSameOrigin(request)` + `requireAuthorizedStore(id)`
- `POST /api/store/[id]/visual-signature/dismiss-critical-drift` — `requireSameOrigin(request)` + `requireAuthorizedStore(id)`
- `DELETE /api/store/[id]/visual-signature/dismiss-critical-drift` — `requireSameOrigin(request)` + `requireAuthorizedStore(id)`
- `POST /api/store/[id]/visual-signature/generate-without-logo` — `requireSameOrigin(request)` + `requireAuthorizedStore(id)`

#### Scenario: GET visual-signature for own store returns 200

- **WHEN** `GET /api/store/:id/visual-signature` is called
- **AND** user owns the store
- **THEN** status is 200

#### Scenario: GET visual-signature for alien store returns 404

- **WHEN** `GET /api/store/:id/visual-signature` is called
- **AND** store belongs to another user
- **THEN** status is 404 JSON

#### Scenario: POST approve for own store returns 200

- **WHEN** `POST /api/store/:id/visual-signature/approve` is called
- **AND** same origin
- **AND** user owns the store
- **THEN** status is 200

#### Scenario: POST reject for alien store returns 404

- **WHEN** `POST /api/store/:id/visual-signature/reject` is called
- **AND** same origin
- **AND** store belongs to another user
- **THEN** status is 404 JSON

### Requirement: requireSameOrigin in POST /api/store

The system SHALL apply `requireSameOrigin(request)` before `requireUser()` in `POST /api/store`.

- POST /api/store is a mutation authenticated by cookie (session)
- MUST call `requireSameOrigin(request)` before `requireUser()`
- Cross-origin without session: MUST return 403 JSON (CSRF has precedence)
- Same-origin without session: MUST return 401 JSON (auth)
- Cross-origin with valid session: MUST return 403 JSON (CSRF)

#### Scenario: POST /api/store cross-origin returns 403

- **WHEN** `POST /api/store` is called cross-origin
- **AND** there is a valid session
- **THEN** status is 403 JSON

#### Scenario: POST /api/store same-origin without session returns 401

- **WHEN** `POST /api/store` is called same-origin
- **AND** no valid session
- **THEN** status is 401 JSON

### Requirement: GET and HEAD routes skip CSRF

The system SHALL NOT apply `requireSameOrigin()` to GET and HEAD requests.

- GET, HEAD route handlers only call `requireAuthorizedStore()` (or the appropriate auth guard)
- All POST, PATCH, PUT, DELETE mutations SHALL call `requireSameOrigin()` before auth

#### Scenario: GET without origin passes

- **WHEN** a GET request is made to any store-scoped route
- **AND** the user owns the store
- **THEN** the request succeeds without CSRF validation

### Requirement: Cross-origin mutation without session returns 403

The system SHALL return 403 (CSRF) for cross-origin mutations even when there is no valid session, because `requireSameOrigin()` runs before `requireAuthorizedStore()`.

#### Scenario: Cross-origin POST without session

- **WHEN** a POST mutation is made cross-origin
- **AND** there is no valid session
- **THEN** status is 403 JSON (CSRF has precedence over auth)
