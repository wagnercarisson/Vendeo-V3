> Delta spec from `fase-7-sessao-login-vertical` (MODIFIED + ADDED).

## MODIFIED Requirements

### Requirement: Matcher uses positive pattern

The middleware SHALL use a positive matcher that explicitly lists protected routes.

- **FROM (Fase 7):** Matcher MUST include: `"/"`, `"/login"`, `"/store/:path*"`, `"/campaign/:path*"`, `"/api/:path*"`
- **TO (Fase 8):** Matcher MUST include: `"/"`, `"/login"`, `"/signup"`, `"/check-email"`, `"/forgot-password"`, `"/update-password"`, `"/auth/confirm"`, `"/store/:path*"`, `"/campaign/:path*"`, `"/api/:path*"`
- Routes NOT in the matcher SHALL bypass middleware entirely
- `/auth/:path*` MUST NOT be used as a prefix — each `/auth/*` route is listed individually

#### Scenario: New auth routes match (modified)

- **WHEN** a request arrives for `/signup` or `/check-email` or `/forgot-password` or `/update-password` or `/auth/confirm`
- **THEN** the middleware SHALL process the request

### Requirement: Unauthenticated page requests redirect to login

- **FROM (Fase 7):** `/login` SHALL remain publicly accessible without authentication
- **TO (Fase 8):** `/login`, `/signup`, `/check-email`, `/forgot-password` SHALL remain publicly accessible without authentication

#### Scenario: Anonymous user hits new public routes (modified)

- **WHEN** an unauthenticated user requests `/signup` or `/check-email` or `/forgot-password`
- **THEN** middleware SHALL allow pass-through (no redirect)

#### Scenario: Anonymous user hits /update-password (new)

- **WHEN** an unauthenticated user requests `/update-password`
- **THEN** middleware SHALL redirect to `/login`

## ADDED Requirements

### Requirement: Public routes redirect to / when authenticated

The middleware SHALL redirect authenticated users accessing public routes (`/signup`, `/check-email`, `/forgot-password`) to `/`.

- MUST treat these routes the same as `/login` when authenticated
- MUST redirect to `/` using `NextResponse.redirect(new URL("/", request.url))`

#### Scenario: Authenticated user hits /signup

- **WHEN** an authenticated user requests `/signup`
- **THEN** middleware redirects to `/`

#### Scenario: Authenticated user hits /check-email

- **WHEN** an authenticated user requests `/check-email`
- **THEN** middleware redirects to `/`

#### Scenario: Authenticated user hits /forgot-password

- **WHEN** an authenticated user requests `/forgot-password`
- **THEN** middleware redirects to `/`

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
