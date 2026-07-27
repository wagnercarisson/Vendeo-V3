## MODIFIED Requirements

### Requirement: POST /api/store uses requireUser + claims.sub

The system SHALL update `POST /api/store` to require CNPJ on the request body, validate it, and condition the onboarding grant on root_hash eligibility.

- MUST call `requireUser()` before any database operation
- MUST set `user_id` to `claims.sub` — any `user_id` in the request body SHALL be ignored
- MUST accept `cnpj: string` as **required** field — format `XX.XXX.XXX/YYYY-ZZ` or `XXXXXXXXXXXXXX`
- MUST accept `razaoSocial?: string` and `nomeFantasia?: string` as optional fields
- MUST validate CNPJ via `validateCnpj()` before calling the RPC — if invalid, return 400
- MUST check if `cnpj_normalized` already exists for another user — if yes, return 409
- MUST call `create_store_with_cnpj(cnpj_normalized, ...)` RPC instead of `create_store_with_legal_acceptance()` — the new RPC receives only `cnpj_normalized` (validated), calculates `cnpj_root_hash` internally via HMAC-SHA256 with server pepper, creates store + registers legal acceptances + tries entitlement-first + grants credits IF entitlement succeeds
- MUST NOT pass `cnpj_root_hash` to the RPC — the hash is calculated server-side within the RPC (service_role), eliminating the hash forgery attack vector
- MUST include `onboardingGranted: boolean` in the response body
- On success: MUST return 201 with the created store including `cnpjMasked` and `onboardingGranted`
- On UNIQUE violation for `stores.user_id`: MUST return 409 `{ error: "Usuário já possui uma loja" }`
- On UNIQUE violation for `stores.cnpj_normalized`: MUST return 409 `{ error: "Este CNPJ já está cadastrado em outra conta" }`
- On invalid CNPJ: MUST return 400 `{ error: "CNPJ inválido" }`

#### Scenario: Store created with CNPJ and onboarding grant

- **WHEN** a POST request is sent to `/api/store` with valid body including `cnpj`
- **AND** the CNPJ root_hash is new (never used freemium)
- **THEN** the store is created with `user_id = claims.sub`
- **AND** `cnpj_normalized` and `cnpj_root_hash` are stored
- **AND** `legal_acceptances` are registered
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