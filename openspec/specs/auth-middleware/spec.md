## Purpose

Proteger rotas do Vendeo via `src/middleware.ts`: renovação de sessão (cookie), redirect de páginas não autenticadas para `/login` e resposta 401 JSON para APIs. Middleware usa `getClaims()` (nunca `getSession()`) e não consulta banco de dados.

> Synced from `fase-7-sessao-login-vertical` (ADDED).

## Requirements

### Requirement: Middleware file exists at project root

The system SHALL have a `src/middleware.ts` file that configures a matcher and processes all matching requests for session management and route protection.

- MUST be placed at `src/middleware.ts` (Next.js 15 convention)
- MUST use `@supabase/ssr` updateSession pattern via `updateSession()`
- MUST use `getClaims()` for identity validation, never `getSession()`

#### Scenario: Middleware processes matched request

- **WHEN** a request hits a route in the matcher
- **THEN** the middleware calls `updateSession()`, extracts claims, and decides redirect or pass-through

### Requirement: Matcher uses positive pattern

The middleware SHALL use a positive matcher that explicitly lists protected routes.

- Matcher MUST include: `"/"`, `"/login"`, `"/store/:path*"`, `"/campaign/:path*"`, `"/api/:path*"`
- Routes NOT in the matcher (e.g., `/_next/*`, `/_vercel/*`, assets, `/_error`) SHALL bypass middleware entirely

#### Scenario: Protected route matches

- **WHEN** a request arrives for `/` or `/campaign/preview` or `/api/store/123`
- **THEN** the middleware SHALL process the request

#### Scenario: Public asset bypasses

- **WHEN** a request arrives for `/_next/static/chunk.js`
- **THEN** the middleware SHALL not process the request

### Requirement: Unauthenticated page requests redirect to login

The middleware SHALL redirect unauthenticated requests to protected pages to `/login` preserving the original path as `?redirect=` parameter.

- Uses `getClaims()` to detect authentication
- If claims are absent or invalid and path is a protected page (not `/api/*`, not `/login`):
  - Compute redirect path from `request.nextUrl.pathname + request.nextUrl.search`
  - Redirect to `/login?redirect=<sanitized-path>`
- `/login` SHALL remain publicly accessible without authentication

#### Scenario: Anonymous user hits root

- **WHEN** an unauthenticated user requests `/`
- **THEN** middleware redirects to `/login?redirect=/`

#### Scenario: Anonymous user hits campaign preview

- **WHEN** an unauthenticated user requests `/campaign/preview`
- **THEN** middleware redirects to `/login?redirect=/campaign/preview`

#### Scenario: Anonymous user hits /login

- **WHEN** an unauthenticated user requests `/login`
- **THEN** middleware SHALL allow pass-through (no redirect)

### Requirement: Authenticated request to /login redirects to /

The middleware SHALL redirect authenticated users requesting `/login` to `/`.

#### Scenario: Authenticated user hits /login

- **WHEN** an authenticated user requests `/login`
- **THEN** middleware redirects to `/`

### Requirement: Unauthenticated API requests return 401 JSON

The middleware SHALL return HTTP 401 with JSON body for unauthenticated requests to `/api/*` routes.

- MUST return `Response.json({ error: "Unauthorized" }, { status: 401 })`
- MUST NOT redirect to HTML pages
- The 401 is a barrier of authentication only, not authorization — handlers still need `requireUser()` for definitive validation

#### Scenario: Anonymous API call

- **WHEN** an unauthenticated user requests `/api/store/123`
- **THEN** middleware returns `401 { error: "Unauthorized" }`

### Requirement: Middleware preserves cookies in all responses

Every response created by the middleware (redirect, 401, next) SHALL preserve the cookies set by `updateSession()`.

- MUST capture response from `updateSession()` before applying redirect/401 logic
- All subsequent response modifications MUST preserve set-cookie headers

#### Scenario: Redirect preserves session cookie

- **WHEN** an unauthenticated user is redirected to `/login`
- **THEN** the redirect response SHALL include the set-cookie header from `updateSession()`

### Requirement: Middleware does not resolve store

The middleware SHALL NOT query the database for store existence or ownership.

- Store resolution is the responsibility of Server Components
- This invariant prevents coupling middleware to data access patterns

#### Scenario: Middleware bypasses database

- **WHEN** middleware processes any request
- **THEN** it SHALL NOT make any database queries
