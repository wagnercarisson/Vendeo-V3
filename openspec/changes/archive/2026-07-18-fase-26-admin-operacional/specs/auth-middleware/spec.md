## MODIFIED Requirements

### Requirement: Matcher uses positive pattern

The middleware SHALL include `/admin/:path*` in its positive matcher to process admin routes for session validation.

- Matcher MUST include: `"/login"`, `"/signup"`, `"/check-email"`, `"/forgot-password"`, `"/update-password"`, `"/auth/confirm"`, `"/dashboard"`, `"/campanhas/:path*"`, `"/loja"`, `"/conta"`, `"/admin/:path*"`, `"/api/:path*"`
- Routes NOT in the matcher SHALL bypass middleware entirely
- The middleware SHALL NOT consult `admin_users` table for admin routes — it SHALL only verify session existence
- Admin gate (`requireAdmin()`) is the responsibility of Server Components and API routes, not middleware

#### Scenario: Admin routes matched by middleware

- **WHEN** a request arrives for `/admin/users` or `/admin/campaigns/errors`
- **THEN** the middleware SHALL process the request

#### Scenario: Unauthenticated admin route redirects to login

- **WHEN** an unauthenticated user requests `/admin/users`
- **THEN** middleware redirects to `/login?redirect=/admin/users`

### Requirement: Unauthenticated page requests redirect to login

The middleware SHALL treat `/admin/*` routes as protected pages — unauthenticated requests SHALL redirect to `/login`.

#### Scenario: Anonymous user hits /admin/users

- **WHEN** an unauthenticated user requests `/admin/users`
- **THEN** middleware redirects to `/login?redirect=/admin/users`

## ADDED Requirements

### Requirement: Middleware does not resolve admin status

The middleware SHALL NOT query the `admin_users` table. Admin authorization is verified exclusively in Server Components via `requireAdmin()` and in API routes via `requireAdmin()`.

- Middleware SHALL only verify session existence for `/admin/*` routes
- Admin_users lookup is forbidden in middleware context (edge runtime, no service_role)

#### Scenario: Middleware bypasses admin_users query

- **WHEN** middleware processes `/admin/*` route
- **THEN** it SHALL NOT query `admin_users` table
- **AND** it SHALL only verify session exists
