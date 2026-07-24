# Store Ownership API

> Synced from `fase-9-cutover-ownership` (ADDED).

## Purpose

Ownership validation on the 4 CRUD store API routes: POST, GET (atalho), GET by id, PATCH by id. Requires authentication on all routes, validates store belongs to user on GET/PATCH by id, creates with `claims.sub` on POST.

## Requirements

### Requirement: POST /api/store uses requireUser + claims.sub

The system SHALL update `POST /api/store` to use `requireUser()` and set `user_id` from `claims.sub`.

- MUST call `requireUser()` before any database operation
- MUST set `user_id` to `claims.sub` — any `user_id` in the request body SHALL be ignored
- MUST use `supabaseAdmin` for the INSERT (service_role)
- MUST validate required fields (`name`, `segment`) before calling the RPC
- MUST accept `acceptedTerms: boolean` from the request body — this is the only client-sent legal field
- MUST resolve CURRENT document versions server-side via `getCurrentVersion()` — the client does NOT send version strings (avoids version spoofing and simplifies client code)
- MUST call `create_store_with_legal_acceptance()` RPC instead of direct INSERT — the RPC creates store + registers legal acceptances + grants credits atomically
- MUST pass `p_ip_address` (from request) and `p_user_agent` (from headers)
- On success: MUST return 201 with the created store
- On UNIQUE violation (error code `23505`): MUST return 409 with `{ error: "Usuário já possui uma loja" }`
- On validation failure: MUST return 400 with error details
- On validation failure (missing acceptance): MUST return 400 with `{ error: "Você precisa aceitar os Termos de Uso e a Política de Uso Aceitável." }`
- On `UnauthorizedError`: MUST return 401 JSON (not redirect)

#### Scenario: Store created with claims.sub

- **WHEN** a POST request is sent to `/api/store` with valid body
- **AND** the user is authenticated
- **THEN** the store is created with `user_id = claims.sub`
- **AND** the response status is 201

#### Scenario: user_id in body is ignored

- **WHEN** a POST request includes `user_id` in the body
- **THEN** the `user_id` from `claims.sub` prevails
- **AND** the body field is ignored

#### Scenario: Duplicate store returns 409

- **WHEN** a POST request is sent
- **AND** the user already has a store (UNIQUE constraint violation)
- **THEN** the response is 409 `{ error: "Usuário já possui uma loja" }`

#### Scenario: Store creation with acceptance flows through atomic RPC

- **WHEN** a POST request is sent to `/api/store` with valid body and acceptance fields
- **AND** the user is authenticated
- **THEN** the store is created via `create_store_with_legal_acceptance()`
- **AND** both `terms_of_service` and `acceptable_use` acceptances are registered
- **AND** credits are granted
- **AND** the response status is 201

#### Scenario: Store creation without acceptance returns 400

- **WHEN** a POST request is sent to `/api/store` without `acceptedTerms: true`
- **THEN** the response is 400 with legal acceptance error message

#### Scenario: Unauthenticated POST returns 401

- **WHEN** a POST request is sent without authentication
- **THEN** the response is 401 `{ error: "Unauthorized" }`

### Requirement: GET /api/store (atalho) returns current user's store

The system SHALL provide a `GET /api/store` endpoint (without `:id`) that returns the current user's store.

- MUST call `requireApiUser()` — catches `UnauthorizedError` and returns 401 JSON
- MUST call `getCurrentStore(user.userId)` to resolve the store
- MUST use `buildStoreResponse(store)` for consistent shape (D12)
- If store is found: MUST return 200 with full store + identity payload
- If store is null: MUST return 404 `{ error: "Store not found" }`

#### Scenario: Authenticated user with store

- **WHEN** a GET request is sent to `/api/store`
- **AND** the user has a store
- **THEN** the response is 200 with the store data including identity, visual_signature_url, logo_url, has_archived_signatures

#### Scenario: Authenticated user without store

- **WHEN** a GET request is sent to `/api/store`
- **AND** the user has no store
- **THEN** the response is 404 `{ error: "Store not found" }`

#### Scenario: Unauthenticated GET /api/store

- **WHEN** a GET request is sent to `/api/store` without authentication
- **THEN** the response is 401 `{ error: "Unauthorized" }`

### Requirement: GET /api/store/:id uses requireOwnership

The system SHALL update `GET /api/store/:id` to validate ownership before returning data.

- MUST call `requireUser()` to get `AuthenticatedUser`
- MUST call `requireOwnership(id, user.userId)` to validate ownership
- MUST use `buildStoreResponse(store)` for consistent shape
- On `StoreNotFoundError`: MUST return 404 JSON (not 403)
- On `UnauthorizedError`: MUST return 401 JSON

#### Scenario: Owner gets own store

- **WHEN** a GET request is sent to `/api/store/{own-id}`
- **AND** the store belongs to the authenticated user
- **THEN** the response is 200 with store data

#### Scenario: Another user's store returns 404

- **WHEN** a GET request is sent to `/api/store/{other-id}`
- **AND** the store belongs to a different user
- **THEN** the response is 404 (not 403)

#### Scenario: Non-existing store returns 404

- **WHEN** a GET request is sent to `/api/store/{non-existent-id}`
- **THEN** the response is 404

#### Scenario: Unauthenticated GET returns 401

- **WHEN** a GET request is sent to `/api/store/{id}` without authentication
- **THEN** the response is 401

### Requirement: PATCH /api/store/:id uses requireOwnership

The system SHALL update `PATCH /api/store/:id` to validate ownership before updating data.

- MUST call `requireUser()` to get `AuthenticatedUser`
- MUST call `requireOwnership(id, user.userId)` to validate ownership
- On success: MUST return 200 with updated store
- On `StoreNotFoundError`: MUST return 404 JSON
- On `UnauthorizedError`: MUST return 401 JSON

#### Scenario: Owner patches own store

- **WHEN** a PATCH request is sent to `/api/store/{own-id}`
- **AND** the store belongs to the authenticated user
- **THEN** the response is 200 with updated data

#### Scenario: Another user's store returns 404 on PATCH

- **WHEN** a PATCH request is sent to `/api/store/{other-id}`
- **AND** the store belongs to a different user
- **THEN** the response is 404

#### Scenario: Non-existing store returns 404 on PATCH

- **WHEN** a PATCH request is sent to `/api/store/{non-existent-id}`
- **THEN** the response is 404

#### Scenario: Unauthenticated PATCH returns 401

- **WHEN** a PATCH request is sent to `/api/store/{id}` without authentication
- **THEN** the response is 401

### Requirement: buildStoreResponse for consistent shape

The system SHALL provide a shared `buildStoreResponse(store)` function in `src/lib/store-response.ts` that assembles the enriched store response. (Arquivo separado de `src/lib/store.ts` para evitar ciclo de import — `src/lib/actions/store.ts` já importa de `@/lib/store`.)

- MUST include all store fields at the top level
- MUST include `identity: StoreIdentitySnapshot` resolved via `resolveStoreIdentity(store)`
- MUST include `visual_signature_url: string | null`
- MUST include `logo_url: string | null`
- MUST include `has_archived_signatures: boolean`
- Both `GET /api/store` and `GET /api/store/:id` SHALL use this function

#### Scenario: Shape includes identity and visual fields

- **WHEN** `buildStoreResponse(store)` is called
- **THEN** the response includes `store` fields, `identity`, `visual_signature_url`, `logo_url`, `has_archived_signatures`

### Requirement: Route handlers convert exceptions to JSON

Route handlers in `/api/store/*` SHALL catch `UnauthorizedError` and `StoreNotFoundError` and return appropriate JSON responses.

- `UnauthorizedError` → 401 `{ error: "Unauthorized" }`
- `StoreNotFoundError` → 404 `{ error: "Store not found" }`
- Unexpected errors → rethrow (500)
- SHALL NOT redirect to HTML pages

#### Scenario: UnauthorizedError caught in route handler

- **WHEN** a route handler catches `UnauthorizedError`
- **THEN** it returns `NextResponse.json({ error: "Unauthorized" }, { status: 401 })`

#### Scenario: StoreNotFoundError caught in route handler

- **WHEN** a route handler catches `StoreNotFoundError`
- **THEN** it returns `NextResponse.json({ error: "Store not found" }, { status: 404 })`
