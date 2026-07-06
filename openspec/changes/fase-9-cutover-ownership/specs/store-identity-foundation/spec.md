## MODIFIED Requirements

### Requirement: Store data schema

The system SHALL have a `stores` table in the public Supabase schema created via a versioned migration file.

**MODIFIED**: The `stores` table gains a new `user_id` column. The schema SHALL be updated via a migration that:

1. DELETEs data from dependent tables first (no CASCADE):
   - `DELETE FROM generation_events`
   - `DELETE FROM store_brand_profiles` (antes de brand_assets e visual_signatures — FK references ambos)
   - `DELETE FROM store_brand_assets`
   - `DELETE FROM store_visual_signatures`
2. DELETEs all rows from `stores`
3. Adds `user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id)`
4. Enables RLS on `stores`
5. Creates policy `"users_select_own_store"` FOR SELECT TO authenticated USING (user_id = (SELECT auth.uid()))

The new migration file SHALL be `supabase/migrations/<timestamp>_add_user_id_to_stores.sql`.

#### Scenario: user_id column exists

- **WHEN** the migration is inspected
- **THEN** the `stores` table SHALL have a `user_id` column of type `UUID`
- **AND** it SHALL be `NOT NULL` and `UNIQUE`
- **AND** it SHALL have a foreign key to `auth.users(id)`

#### Scenario: RLS is enabled

- **WHEN** the migration is inspected
- **THEN** `stores` SHALL have RLS enabled
- **AND** a SELECT policy SHALL exist for `authenticated` role filtering by `user_id = auth.uid()`

#### Scenario: Data is reset

- **WHEN** the migration runs
- **THEN** all existing rows in dependent tables and stores are deleted
- **AND** the migration succeeds with the new schema

### Requirement: Create store API

The system SHALL expose a `POST /api/store` endpoint that creates a new store record.

**MODIFIED**: The endpoint SHALL now:

- Call `requireUser()` before any database operation
- Use `claims.sub` as `user_id` — any `user_id` in the body SHALL be ignored
- Use `supabaseAdmin` for INSERT (service_role privilege)
- On UNIQUE violation (error code `23505`): return 409

#### Scenario: Store created with authenticated user

- **WHEN** a POST request is sent to `/api/store`
- **AND** the user is authenticated
- **THEN** the store is created with `user_id = claims.sub`
- **AND** response is 201

#### Scenario: Duplicate store returns 409

- **WHEN** a POST request is sent for a user who already has a store
- **THEN** response is 409 `{ error: "Usuário já possui uma loja" }`

#### Scenario: Unauthenticated POST returns 401

- **WHEN** a POST request is sent without authentication
- **THEN** response is 401 `{ error: "Unauthorized" }`

### Requirement: Read store API

The system SHALL expose a `GET /api/store/[id]` endpoint that returns a single store record enriched with `StoreIdentitySnapshot`.

**MODIFIED**: The endpoint SHALL now validate ownership:

- Call `requireUser()` to authenticate
- Call `requireOwnership(id, user.userId)` to validate store belongs to user
- If store not found or not owner: return 404 (same signal)
- Use `buildStoreResponse(store)` for response shape

#### Scenario: Owner reads own store

- **WHEN** a GET request is sent to `/api/store/{own-id}`
- **THEN** response is 200 with enriched store data

#### Scenario: Non-owner reads store returns 404

- **WHEN** a GET request is sent to `/api/store/{other-user-id}`
- **THEN** response is 404 `{ error: "Store not found" }`

### Requirement: Update store API

The system SHALL expose a `PATCH /api/store/[id]` endpoint.

**MODIFIED**: The endpoint SHALL now validate ownership:

- Call `requireUser()` to authenticate
- Call `requireOwnership(id, user.userId)` to validate ownership
- If store not found or not owner: return 404

#### Scenario: Owner patches own store

- **WHEN** a PATCH request is sent to `/api/store/{own-id}`
- **THEN** response is 200 with updated store

#### Scenario: Non-owner patches store returns 404

- **WHEN** a PATCH request is sent to `/api/store/{other-user-id}`
- **THEN** response is 404

## ADDED Requirements

### Requirement: GET /api/store (atalho)

The system SHALL expose a `GET /api/store` endpoint (without `:id`) that returns the current user's store.

- MUST call `requireApiUser()` for authentication
- MUST call `getCurrentStore(user.userId)` to resolve the store
- MUST use `buildStoreResponse(store)` for response shape
- If store found: return 200 with enriched store data
- If store null: return 404 `{ error: "Store not found" }`

#### Scenario: GET /api/store returns current store

- **WHEN** a GET request is sent to `/api/store`
- **AND** the user has a store
- **THEN** response is 200 with store + identity payload

#### Scenario: GET /api/store returns 404 for no store

- **WHEN** a GET request is sent to `/api/store`
- **AND** the user has no store
- **THEN** response is 404

### Requirement: buildStoreResponse for consistent shape

The system SHALL provide `buildStoreResponse(store)` in `src/lib/store-response.ts` (arquivo separado de `src/lib/store.ts` para evitar ciclo de import com `@/lib/actions/store`).

- Returns `{ ...store, identity, visual_signature_url, logo_url, has_archived_signatures }`
- Used by both `GET /api/store` and `GET /api/store/:id`

#### Scenario: Shape is consistent across endpoints

- **WHEN** both `GET /api/store` and `GET /api/store/:id` are called
- **THEN** both responses have the same top-level shape
