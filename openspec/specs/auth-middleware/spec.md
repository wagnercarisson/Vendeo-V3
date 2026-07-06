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

- Matcher MUST include: `"/"`, `"/login"`, `"/signup"`, `"/check-email"`, `"/forgot-password"`, `"/update-password"`, `"/auth/confirm"`, `"/store/:path*"`, `"/campaign/:path*"`, `"/api/:path*"`
- Routes NOT in the matcher SHALL bypass middleware entirely
- `/auth/:path*` MUST NOT be used as a prefix — each `/auth/*` route is listed individually

#### Scenario: Protected route matches

- **WHEN** a request arrives for `/` or `/campaign/preview` or `/api/store/123`
- **THEN** the middleware SHALL process the request

#### Scenario: Public asset bypasses

- **WHEN** a request arrives for `/_next/static/chunk.js`
- **THEN** the middleware SHALL not process the request

#### Scenario: New auth routes match

- **WHEN** a request arrives for `/signup` or `/check-email` or `/forgot-password` or `/update-password` or `/auth/confirm`
- **THEN** the middleware SHALL process the request

### Requirement: Unauthenticated page requests redirect to login

The middleware SHALL redirect unauthenticated requests to protected pages to `/login` preserving the original path as `?redirect=` parameter.

- Uses `getClaims()` to detect authentication
- If claims are absent or invalid and path is a protected page (not `/api/*`, not `/login`):
  - Compute redirect path from `request.nextUrl.pathname + request.nextUrl.search`
  - Redirect to `/login?redirect=<sanitized-path>`
- `/login`, `/signup`, `/check-email`, `/forgot-password` SHALL remain publicly accessible without authentication

#### Scenario: Anonymous user hits root

- **WHEN** an unauthenticated user requests `/`
- **THEN** middleware redirects to `/login?redirect=/`

#### Scenario: Anonymous user hits campaign preview

- **WHEN** an unauthenticated user requests `/campaign/preview`
- **THEN** middleware redirects to `/login?redirect=/campaign/preview`

#### Scenario: Anonymous user hits /login

- **WHEN** an unauthenticated user requests `/login`
- **THEN** middleware SHALL allow pass-through (no redirect)

#### Scenario: Anonymous user hits /update-password

- **WHEN** an unauthenticated user requests `/update-password`
- **THEN** middleware SHALL redirect to `/login`

### Requirement: Public routes redirect to / when authenticated

The middleware SHALL redirect authenticated users accessing public routes (`/login`, `/signup`, `/check-email`, `/forgot-password`) to `/`.

- MUST treat these routes the same when authenticated
- MUST redirect to `/` using `NextResponse.redirect(new URL("/", request.url))`

#### Scenario: Authenticated user hits /login

- **WHEN** an authenticated user requests `/login`
- **THEN** middleware redirects to `/`

#### Scenario: Authenticated user hits /signup

- **WHEN** an authenticated user requests `/signup`
- **THEN** middleware redirects to `/`

#### Scenario: Authenticated user hits /check-email

- **WHEN** an authenticated user requests `/check-email`
- **THEN** middleware redirects to `/`

#### Scenario: Authenticated user hits /forgot-password

- **WHEN** an authenticated user requests `/forgot-password`
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

### Requirement: /auth/confirm is always passthrough

The middleware SHALL allow `/auth/confirm` to pass through regardless of authentication state.

- `/auth/confirm` MUST NOT redirect, even if user is not authenticated
- `/auth/confirm` MUST NOT redirect to `/` even if user IS authenticated
- This is necessary for recovery links clicked in an already-logged-in browser

#### Scenario: Anonymous user hits /auth/confirm

- **WHEN** an unauthenticated user requests `/auth/confirm`
- **THEN** middleware SHALL pass through (no redirect)

#### Scenario: Authenticated user hits /auth/confirm

- **WHEN** an authenticated user requests `/auth/confirm`
- **THEN** middleware SHALL pass through (no redirect to `/`)

### Requirement: Middleware classifies routes by authentication state

The middleware SHALL implement a route classification system:

- `PUBLIC_ROUTES`: `Set(["/login", "/signup", "/check-email", "/forgot-password"])` — anonymous passes, authenticated redirects to `/`
- `ALWAYS_PASSTHROUGH`: `Set(["/auth/confirm"])` — always passes regardless of auth state
- Other matched routes: require authentication

#### Scenario: Route classification logic is correct

- **WHEN** middleware processes any request
- **THEN** the following rules apply:
  - If pathname is in `ALWAYS_PASSTHROUGH`: return response immediately
  - If not authenticated and is `PUBLIC_ROUTES`: pass through
  - If not authenticated and not public: redirect to login
  - If authenticated and is `PUBLIC_ROUTES`: redirect to `/`
  - If authenticated and not public: pass through
