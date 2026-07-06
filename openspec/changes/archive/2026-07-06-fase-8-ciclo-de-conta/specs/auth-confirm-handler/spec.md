## ADDED Requirements

### Requirement: /auth/confirm route handler exists

The system SHALL have a route handler at `src/app/auth/confirm/route.ts` that processes email confirmation tokens via `verifyOtp()`.

- MUST handle `GET` requests only
- MUST NOT render HTML — returns `NextResponse.redirect()` in all cases
- MUST be placed outside the `(auth)` route group (it is an API route, not a page)
- MUST be classified as `ALWAYS_PASSTHROUGH` in middleware

#### Scenario: Route handler processes GET request

- **WHEN** a GET request arrives at `/auth/confirm?token_hash=xxx&type=signup`
- **THEN** the handler SHALL process the token and return a redirect response

### Requirement: Handler processes token_hash via verifyOtp

The handler SHALL read `token_hash` and `type` query parameters and call `supabase.auth.verifyOtp()`.

- MUST read `token_hash` from search params
- MUST read `type` from search params (`signup` | `recovery`)
- MUST call `verifyOtp({ type, token_hash })` — not `exchangeCodeForSession()`
- SHALL use `createServerClient()` from `@/lib/supabase/server`

#### Scenario: Valid signup confirmation

- **WHEN** `/auth/confirm?token_hash=valid_token&type=signup` is requested
- **THEN** `verifyOtp({ type: 'signup', token_hash })` is called
- **AND** on success, the handler SHALL redirect to `/`

#### Scenario: Valid recovery confirmation

- **WHEN** `/auth/confirm?token_hash=valid_token&type=recovery&next=/update-password` is requested
- **THEN** `verifyOtp({ type: 'recovery', token_hash })` is called
- **AND** on success, the handler SHALL redirect to `/update-password`

#### Scenario: Invalid token

- **WHEN** `/auth/confirm?token_hash=invalid_token&type=signup` is requested
- **THEN** the handler SHALL redirect to `/login?error=confirmation_failed`

#### Scenario: Recovery with invalid token

- **WHEN** `/auth/confirm?token_hash=invalid_token&type=recovery` is requested
- **THEN** the handler SHALL redirect to `/login?error=recovery_failed`

#### Scenario: Missing token_hash

- **WHEN** `/auth/confirm?type=signup` is requested without token_hash
- **THEN** the handler SHALL redirect to `/login?error=confirmation_failed`

### Requirement: Handler validates next parameter against allowlist

The handler SHALL validate the `next` query parameter against a strict allowlist to prevent open redirect.

- MUST define `VALID_NEXT = ["/", "/update-password"] as const`
- MUST fallback to `/` if `next` is not in the allowlist
- MUST NOT accept any dynamic or unlisted path
- MUST NOT accept query strings in `next`

#### Scenario: Valid next parameter

- **WHEN** `/auth/confirm?token_hash=xxx&type=recovery&next=/update-password` is requested
- **THEN** the handler SHALL use `/update-password` as the redirect target on success

#### Scenario: Invalid next parameter falls back

- **WHEN** `/auth/confirm?token_hash=xxx&type=recovery&next=https://evil.com` is requested
- **THEN** the handler SHALL fallback to `/` as the redirect target on success

### Requirement: Handler does not use PKCE/code exchange

The handler SHALL use `verifyOtp()` with `token_hash` instead of `exchangeCodeForSession()`.

- The email templates SHALL use `{{ .TokenHash }}` + `{{ .RedirectTo }}` in the Supabase Dashboard
- This eliminates the ambiguity of competing flows in the same handler
- `emailRedirectTo` in `signUp()` SHALL be `${NEXT_PUBLIC_SITE_URL}/auth/confirm`
- `redirectTo` in `resetPasswordForEmail()` SHALL be `${NEXT_PUBLIC_SITE_URL}/auth/confirm`

#### Scenario: Handler uses verifyOtp not exchangeCodeForSession

- **WHEN** the handler processes any confirmation request
- **THEN** it SHALL call `verifyOtp()`, never `exchangeCodeForSession()`
