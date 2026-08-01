## MODIFIED Requirements

### Requirement: POST /api/store uses requireUser + claims.sub (MODIFICADO F32)

> **Delta F36 (D15):** O `POST /api/store` SHALL suportar **dois modos de criação**. `cnpj` SHALL deixar de ser obrigatório — quando ausente, o sistema SHALL criar a loja em **modo draft** via nova RPC `create_store_draft` (sem concessão de crédito freemium, readiness fiscal pendente); quando presente, SHALL manter o fluxo verified/fiscal atual via `create_store_with_cnpj`. A regra do OpenSpec permanece: *Loja draft não é loja pronta. Ela não libera campanha nem freemium até cadastro fiscal válido, exceto `is_test_store`.*

The system SHALL update `POST /api/store` to support two creation modes, keeping ownership/security requirements unchanged.

- MUST call `requireUser()` before any database operation
- MUST set `user_id` to `claims.sub` — any `user_id` in the request body SHALL be ignored
- MUST use `supabaseAdmin` for the INSERT/RPC call (service_role)
- MUST validate required fields (`name`, `segment`, `acceptedTerms`) before calling either RPC
- MUST accept `cnpj?: string` as an **optional** field — format `XX.XXX.XXX/YYYY-ZZ` or `XXXXXXXXXXXXXX`
- MUST accept `razaoSocial?: string` and `nomeFantasia?: string` as optional fields (used only in verified mode)
- MUST accept `acceptedTerms: boolean` from the request body — this is the only client-sent legal field
- MUST resolve CURRENT document versions server-side via `getCurrentVersion()` — the client does NOT send version strings
- **If `cnpj` is absent/empty** — MUST call `create_store_draft(...)` (name, segment, optional fields, accepted terms + IP + UA). SHALL NOT call `try_grant_onboarding_entitlement` nor grant credits. On success: MUST return 201 with the created store including `onboardingGranted: false`. No `cnpj_normalized`/`cnpj_root_hash` stored (null)
- **If `cnpj` is present** — MUST validate CNPJ via `validateCnpj()` (400 `{ error: "CNPJ inválido" }` if invalid); MUST check if `cnpj_normalized` already exists for another user (409 if yes); MUST call `create_store_with_cnpj(...)` (route computes `cnpj_root_hash = HMAC-SHA256(cnpj_normalized[:8], process.env.CNPJ_PEPPER)` server-side); MUST NOT expose `cnpj_root_hash` to the client; MUST pass `p_ip_address` and `p_user_agent`; on success MUST return 201 with the created store including `cnpjMasked` and `onboardingGranted`
- On UNIQUE violation for `stores.user_id`: MUST return 409 `{ error: "Usuário já possui uma loja" }`
- On UNIQUE violation for `stores.cnpj_normalized`: MUST return 409 `{ error: "Este CNPJ já está cadastrado em outra conta" }`
- On `UnauthorizedError`: MUST return 401 JSON (not redirect)

#### Scenario: POST sem CNPJ cria loja draft sem crédito

- **WHEN** a POST request is sent to `/api/store` with `name` + `segment` + `acceptedTerms: true` and **no** `cnpj`
- **THEN** the store is created via `create_store_draft`
- **AND** `cnpj_normalized`/`cnpj_root_hash` remain null
- **AND** `legal_acceptances` are registered
- **AND** no onboarding credits are granted
- **AND** response is 201 with `onboardingGranted: false`

#### Scenario: POST com CNPJ válido segue fluxo verified/fiscal

- **WHEN** a POST request is sent with valid body including `cnpj`
- **THEN** the store is created via `create_store_with_cnpj`
- **AND** `cnpj_normalized` and `cnpj_root_hash` are stored
- **AND** `razao_social` and `nome_fantasia` are persisted
- **AND** 10 onboarding credits are granted when the root is eligible
- **AND** response includes `onboardingGranted`

#### Scenario: Duplicate CNPJ returns 409

- **WHEN** a POST request is sent with an already registered `cnpj_normalized`
- **THEN** the response is 409 `{ error: "Este CNPJ já está cadastrado em outra conta" }`

#### Scenario: Invalid CNPJ returns 400

- **WHEN** a POST request is sent with invalid CNPJ format or digits
- **THEN** the response is 400 `{ error: "CNPJ inválido" }`

#### Scenario: Store creation without acceptance returns 400

- **WHEN** a POST request is sent to `/api/store` without `acceptedTerms: true`
- **THEN** the response is 400 with legal acceptance error message

#### Scenario: Unauthenticated POST returns 401

- **WHEN** a POST request is sent without authentication
- **THEN** the response is 401 `{ error: "Unauthorized" }`
