## MODIFIED Requirements

### Requirement: requireUser validates JWT claims

The system SHALL provide a `requireUser()` function in `src/lib/auth/require-user.ts` that validates the current user's authentication via JWT claims.

- MUST create a server Supabase client and call `supabase.auth.getClaims()`
- MUST validate that `data?.claims?.sub` is present and non-empty
- MUST return `{ userId: string; claims: JwtPayload }` on success
- MUST throw `UnauthorizedError` (custom error class, imported from `errors.ts`) on failure
- SHALL NOT return `getSession()` data — only claims-validated identity
- SHALL NOT accept `userId` from client input

#### Scenario: Valid claims return user

- **WHEN** `requireUser()` is called with a valid session
- **THEN** it returns `{ userId, claims }` with `claims.sub` as userId

#### Scenario: Missing claims throws UnauthorizedError

- **WHEN** `requireUser()` is called with no session
- **THEN** it throws `UnauthorizedError`

#### Scenario: Invalid claims throws UnauthorizedError

- **WHEN** `requireUser()` is called with corrupted or expired claims
- **THEN** it throws `UnauthorizedError`

#### Scenario: Empty sub throws UnauthorizedError

- **WHEN** `requireUser()` is called and `claims.sub` is empty
- **THEN** it throws `UnauthorizedError`

### Requirement: requirePageUser adapts for server components

The system SHALL provide a `requirePageUser()` function that wraps `requireUser()` for use in Server Components and pages.

- MUST call `requireUser()` internally
- MUST catch `UnauthorizedError` and call `redirect("/login")`
- SHALL NOT return a Response object — uses Next.js `redirect()` function

#### Scenario: Authenticated user in page

- **WHEN** `requirePageUser()` is called with a valid session
- **THEN** it returns `AuthenticatedUser`

#### Scenario: Unauthenticated user in page

- **WHEN** `requirePageUser()` is called without a session
- **THEN** it redirects to `/login`

### Requirement: requireApiUser adapts for route handlers

The system SHALL provide a pattern for route handlers to use `requireUser()` and return 401 JSON on failure.

- Route handlers SHALL catch `UnauthorizedError` and return `Response.json({ error: "Unauthorized" }, { status: 401 })`
- SHALL NOT redirect to HTML pages

#### Scenario: Authenticated request to API

- **WHEN** `requireUser()` succeeds in a route handler
- **THEN** the handler proceeds with `AuthenticatedUser` context

#### Scenario: Unauthenticated request to API

- **WHEN** `requireUser()` throws in a route handler
- **THEN** the handler returns `401 { error: "Unauthorized" }`

### Requirement: UnauthorizedError class (MODIFIED)

The system SHALL define an `UnauthorizedError` class in `src/lib/auth/errors.ts`.

- SHALL extend `Error`
- SHALL have name "UnauthorizedError"
- SHALL have a descriptive default message: "Unauthorized"
- SHALL be reexported from `src/lib/auth/require-user.ts` (class definition moved from that file to `errors.ts`)
- SHALL be catchable by `instanceof` across module boundaries

#### Scenario: Error is catchable

- **WHEN** code catches `UnauthorizedError`
- **THEN** it SHALL be distinguishable from generic `Error`

### Requirement: ForbiddenError class (ADDED)

The system SHALL define a `ForbiddenError` class in `src/lib/auth/errors.ts`.

- SHALL extend `Error`
- SHALL have name "ForbiddenError"
- SHALL have a default message: "Forbidden"
- SHALL be catchable by `instanceof`

#### Scenario: ForbiddenError is catchable

- **WHEN** code catches `ForbiddenError`
- **THEN** it SHALL be distinguishable from `UnauthorizedError` and generic `Error`

### Requirement: requireSameOrigin guard (ADDED)

The system SHALL provide a `requireSameOrigin(request)` function in `src/lib/auth/csrf.ts`.

- MUST read `origin`, `host`, and `x-forwarded-host` headers
- MUST throw `ForbiddenError` if origin is missing
- MUST throw `ForbiddenError` if origin does not match host/x-forwarded-host
- SHALL be used in all POST/PATCH/DELETE route handler mutations before auth guards

#### Scenario: Same origin passes

- **WHEN** `requireSameOrigin(request)` is called
- **AND** Origin matches Host
- **THEN** it passes without error

#### Scenario: Different origin throws

- **WHEN** `requireSameOrigin(request)` is called
- **AND** Origin differs from Host
- **THEN** it throws `ForbiddenError`

### Requirement: JsonErrorResponse helpers (ADDED)

The system SHALL provide three helper functions in `src/lib/api-error-response.ts`.

- `unauthorized(message?)`: 401 JSON response
- `notFound(message?)`: 404 JSON response
- `forbidden(message?)`: 403 JSON response

#### Scenario: Helpers return correct status

- **WHEN** calling `unauthorized()`, `notFound()`, or `forbidden()`
- **THEN** each returns the corresponding HTTP status code with JSON body

### Requirement: CSRF has precedence over auth (ADDED)

The system SHALL enforce that in mutation route handlers, `requireSameOrigin()` runs before `requireAuthorizedStore()`.

- Cross-origin requests even without session SHALL return 403 (CSRF), never 401 (auth)
- Same-origin requests without session SHALL return 401 (auth fails, origin does not block)

#### Scenario: Cross-origin without session returns 403

- **WHEN** a POST mutation is made cross-origin
- **AND** there is no valid session
- **THEN** status is 403 (CSRF has precedence over auth)

#### Scenario: Same origin without session returns 401

- **WHEN** a POST mutation is made same-origin
- **AND** there is no valid session
- **THEN** status is 401 (auth fails, valid origin does not block)
