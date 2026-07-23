## MODIFIED Requirements

### Requirement: POST /api/store uses requireUser + claims.sub (MODIFIED)

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
- On validation failure (missing acceptance): MUST return 400 with `{ error: "Você precisa aceitar os Termos de Uso e a Política de Uso Aceitável." }`
- On `UnauthorizedError`: MUST return 401 JSON (not redirect)

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
