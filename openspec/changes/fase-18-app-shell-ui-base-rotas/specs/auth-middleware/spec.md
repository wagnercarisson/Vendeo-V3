## MODIFIED Requirements

### Requirement: Matcher uses positive pattern

The system SHALL update the `config.matcher` in `src/middleware.ts` to use new route set:
- `"/dashboard"`, `"/campanhas/:path*"`, `"/loja"`, `"/conta"` SHALL be added
- `"/"`, `"/store/:path*"`, `"/campaign/:path*"` SHALL be removed (handled by next.config.ts redirects)
- Existing auth routes SHALL be retained: `"/login"`, `"/signup"`, `"/check-email"`, `"/forgot-password"`, `"/update-password"`, `"/auth/confirm"`, `"/api/:path*"`

#### Scenario: New protected routes match

- **WHEN** a request arrives for `/dashboard` or `/campanhas/nova` or `/loja` or `/conta`
- **THEN** the middleware SHALL process the request

#### Scenario: Removed routes no longer match

- **WHEN** a request arrives for `/store/settings` or `/campanha/abc-123`
- **THEN** the middleware SHALL NOT process the request (handled by next.config.ts 301)

### Requirement: Unauthenticated page requests redirect to login

The middleware SHALL redirect unauthenticated requests to protected pages to `/login?redirect=/dashboard` when the original request is to `/dashboard`, `/campanhas/:path*`, `/loja`, or `/conta`.

#### Scenario: Anonymous user hits /dashboard

- **WHEN** an unauthenticated user requests `/dashboard`
- **THEN** middleware SHALL redirect to `/login?redirect=/dashboard`

### Requirement: Public routes redirect to /dashboard when authenticated

The middleware SHALL redirect authenticated users accessing public routes (`/login`, `/signup`, `/check-email`, `/forgot-password`) to `/dashboard` (instead of `/`).

#### Scenario: Authenticated user hits /login

- **WHEN** an authenticated user requests `/login`
- **THEN** middleware SHALL redirect to `/dashboard`

#### Scenario: Authenticated user hits /signup

- **WHEN** an authenticated user requests `/signup`
- **THEN** middleware SHALL redirect to `/dashboard`

#### Scenario: Authenticated user hits /check-email

- **WHEN** an authenticated user requests `/check-email`
- **THEN** middleware SHALL redirect to `/dashboard`

#### Scenario: Authenticated user hits /forgot-password

- **WHEN** an authenticated user requests `/forgot-password`
- **THEN** middleware SHALL redirect to `/dashboard`
