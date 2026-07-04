## ADDED Requirements

### Requirement: requireUser validates JWT claims
The system SHALL provide a `requireUser()` function in `src/lib/auth/require-user.ts` that validates the current user's authentication via JWT claims.

- MUST create a server Supabase client and call `supabase.auth.getClaims()`
- MUST validate that `data?.claims?.sub` is present and non-empty
- MUST return `{ userId: string; claims: JwtPayload }` on success
- MUST throw `UnauthorizedError` (custom error class) on failure
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

### Requirement: UnauthorizedError class
The system SHALL define an `UnauthorizedError` class extending `Error`.

- SHALL be exported from `src/lib/auth/require-user.ts`
- SHALL be catchable by type-checked handlers
- SHALL have a descriptive default message

#### Scenario: Error is catchable
- **WHEN** code catches `UnauthorizedError`
- **THEN** it SHALL be distinguishable from generic `Error`
