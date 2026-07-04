## Purpose

Função `sanitizeRedirectPath()` com allowlist para redirect pós-login com dupla validação: middleware produz o parâmetro `?redirect=`, página de login valida antes de `router.replace()`. Previne open redirect.

> Synced from `fase-7-sessao-login-vertical` (ADDED).

## Requirements

### Requirement: sanitizeRedirectPath function

The system SHALL provide a `sanitizeRedirectPath(path: string): string` function in `src/lib/auth/redirect.ts` that validates and sanitizes redirect URLs.

- MUST parse the input as a URL path
- MUST validate the **pathname** against an allowlist
- Allowlist SHALL use exact match (not startsWith):
  - `pathname === "/"`
  - `pathname === "/store"`
  - `pathname.startsWith("/campaign/")`
- `/campaign` (exact) is NOT in the allowlist — only `/campaign/...` paths
- MUST rejeitar (return fallback):
  - URLs absolutas (`https://`, `http://`)
  - Protocol-relative (`//evil.com`)
  - Backslashes (`\`)
  - Caminhos de autenticação (`/login`, `/signup`, `/auth/*`)
- MUST preserve query string as opaque data after parsing with URL constructor
- MUST discard fragments (`#`)
- MUST return `"/"` as fallback when validation fails

#### Scenario: Valid path is allowed

- **WHEN** `sanitizeRedirectPath("/campaign/preview")` is called
- **THEN** it returns `"/campaign/preview"`

#### Scenario: Valid path with query string is preserved

- **WHEN** `sanitizeRedirectPath("/campaign/preview?foo=bar")` is called
- **THEN** it returns `"/campaign/preview?foo=bar"`

#### Scenario: Absolute URL is rejected

- **WHEN** `sanitizeRedirectPath("https://evil.com")` is called
- **THEN** it returns `"/"`

#### Scenario: Protocol-relative URL is rejected

- **WHEN** `sanitizeRedirectPath("//evil.com")` is called
- **THEN** it returns `"/"`

#### Scenario: Auth path is rejected

- **WHEN** `sanitizeRedirectPath("/login")` is called
- **THEN** it returns `"/"`

#### Scenario: Fragment is discarded

- **WHEN** `sanitizeRedirectPath("/campaign/preview#section")` is called
- **THEN** it returns `"/campaign/preview"` (fragment removed)

#### Scenario: Empty path returns fallback

- **WHEN** `sanitizeRedirectPath("")` is called
- **THEN** it returns `"/"`

### Requirement: Middleware produces redirect parameter

The middleware SHALL append `?redirect=<sanitized-path>` when redirecting unauthenticated users to `/login`.

- The redirect value SHALL be `request.nextUrl.pathname + request.nextUrl.search` (URI-encoded)
- The full URL SHALL be sanitized via `sanitizeRedirectPath` on the receiving end

#### Scenario: Middleware creates redirect param

- **WHEN** an anonymous user requests `/campaign/preview`
- **THEN** middleware redirects to `/login?redirect=%2Fcampaign%2Fpreview`

### Requirement: Login page validates redirect parameter

The login page SHALL read the `redirect` search parameter and validate it with `sanitizeRedirectPath()` before using it for post-login navigation.

- MUST read `searchParams.redirect` from the URL
- MUST pass through `sanitizeRedirectPath()`
- MUST use the sanitized result for `router.replace()` after successful login

#### Scenario: Valid redirect on login

- **WHEN** user logs in with `?redirect=/campaign/preview`
- **THEN** user is redirected to `/campaign/preview` after successful login

#### Scenario: Invalid redirect on login

- **WHEN** user logs in with `?redirect=https://evil.com`
- **THEN** user is redirected to `/` after successful login
