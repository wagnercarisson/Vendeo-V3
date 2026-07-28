# Store Ownership API

> Synced from `fase-9-cutover-ownership` (ADDED).

## Purpose

Ownership validation on the 4 CRUD store API routes: POST, GET (atalho), GET by id, PATCH by id. Requires authentication on all routes, validates store belongs to user on GET/PATCH by id, creates with `claims.sub` on POST.

## Requirements

### Requirement: POST /api/store uses requireUser + claims.sub (MODIFICADO F32)

The system SHALL update `POST /api/store` to require CNPJ on the request body, validate it, and condition the onboarding grant on root_hash eligibility.

- MUST call `requireUser()` before any database operation
- MUST set `user_id` to `claims.sub` — any `user_id` in the request body SHALL be ignored
- MUST use `supabaseAdmin` for the INSERT (service_role)
- MUST validate required fields (`name`, `segment`) before calling the RPC
- MUST accept `cnpj: string` as **required** field — format `XX.XXX.XXX/YYYY-ZZ` or `XXXXXXXXXXXXXX`
- MUST accept `razaoSocial?: string` and `nomeFantasia?: string` as optional fields
- MUST validate CNPJ via `validateCnpj()` before calling the RPC — if invalid, return 400
- MUST check if `cnpj_normalized` already exists for another user — if yes, return 409
- MUST accept `acceptedTerms: boolean` from the request body — this is the only client-sent legal field
- MUST resolve CURRENT document versions server-side via `getCurrentVersion()` — the client does NOT send version strings
- MUST call `create_store_with_cnpj(cnpj_normalized, cnpj_root_hash, ..., razao_social, nome_fantasia)` RPC instead of `create_store_with_legal_acceptance()` — the route calculates `cnpj_root_hash = HMAC-SHA256(cnpj_normalized[:8], process.env.CNPJ_PEPPER)` server-side, then the RPC creates store + registers legal acceptances + saves razao_social/nome_fantasia + tries entitlement-first + grants credits IF entitlement succeeds
- MUST NOT expose `cnpj_root_hash` to the client — the hash is calculated in the Next.js server route (not in the browser), eliminating the hash forgery attack vector; the RPC (service_role) receives the already-computed hash from the route
- MUST pass `p_ip_address` (from request) and `p_user_agent` (from headers)
- On success: MUST return 201 with the created store including `cnpjMasked` and `onboardingGranted`
- On UNIQUE violation for `stores.user_id`: MUST return 409 `{ error: "Usuário já possui uma loja" }`
- On UNIQUE violation for `stores.cnpj_normalized`: MUST return 409 `{ error: "Este CNPJ já está cadastrado em outra conta" }`
- On invalid CNPJ: MUST return 400 `{ error: "CNPJ inválido" }`
- On missing CNPJ: MUST return 400 `{ error: "CNPJ é obrigatório" }`
- On `UnauthorizedError`: MUST return 401 JSON (not redirect)

#### Scenario: Store created with CNPJ and onboarding grant

- **WHEN** a POST request is sent to `/api/store` with valid body including `cnpj`
- **AND** the CNPJ root_hash is new (never used freemium)
- **THEN** the store is created with `user_id = claims.sub`
- **AND** `cnpj_normalized` and `cnpj_root_hash` are stored
- **AND** `legal_acceptances` are registered
- **AND** `razao_social` and `nome_fantasia` are persisted
- **AND** 10 onboarding credits are granted
- **AND** response includes `onboardingGranted: true`

#### Scenario: Store created as branch (same root, different CNPJ)

- **WHEN** a POST request is sent with CNPJ having different suffix but same root_hash
- **AND** the root_hash already has `onboarding` entitlement
- **THEN** the store is created normally
- **AND** `onboardingGranted: false`
- **AND** response includes informative message about branch

#### Scenario: Duplicate CNPJ returns 409

- **WHEN** a POST request is sent with an already registered `cnpj_normalized`
- **THEN** the response is 409 `{ error: "Este CNPJ já está cadastrado em outra conta" }`

#### Scenario: Invalid CNPJ returns 400

- **WHEN** a POST request is sent with invalid CNPJ format or digits
- **THEN** the response is 400 `{ error: "CNPJ inválido" }`

#### Scenario: Missing CNPJ returns 400

- **WHEN** a POST request is sent without `cnpj` field
- **THEN** the response is 400 `{ error: "CNPJ é obrigatório" }`

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
