## Purpose

Fornecer os clientes Supabase SSR para browser, servidor e middleware — substituindo o singleton `createClient` por factories SSR compatíveis com Next.js App Router. Três módulos independentes evitam contaminação browser/server e permitem cookie-based session management.

> Synced from `fase-7-sessao-login-vertical` (ADDED).

## Requirements

### Requirement: Supabase SSR client factory for browser

The system SHALL provide a `createBrowserClient()` factory function in `src/lib/supabase/client.ts` that creates a Supabase client configured for browser environments using `@supabase/ssr`.

- MUST use `createBrowserClient` from `@supabase/ssr`
- MUST read `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` from environment
- MUST throw on missing environment variables at import time
- MUST export a factory function (not a singleton instance)
- SHALL be importable only from client components

#### Scenario: Browser client created successfully

- **WHEN** `createBrowserClient()` is called with valid environment variables
- **THEN** it returns a functioning Supabase client instance

#### Scenario: Missing environment variable throws

- **WHEN** `NEXT_PUBLIC_SUPABASE_URL` or `NEXT_PUBLIC_SUPABASE_ANON_KEY` is missing
- **THEN** the module throws an error at import time

### Requirement: Supabase SSR client factory for server

The system SHALL provide a `createServerClient()` factory function in `src/lib/supabase/server.ts` that creates a Supabase client configured for server-side rendering with cookie-based session management.

- MUST use `createServerClient` from `@supabase/ssr`
- MUST accept `cookies()` from `next/headers`
- MUST read `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- MUST export a factory function
- SHALL be importable only in server-side contexts (Server Components, Route Handlers, Server Actions) via `server-only`
- SHALL read cookies in all server-side contexts
- SHALL tolerate setAll being a no-op in Server Components (where cookies cannot be written); writes work in Route Handlers and middleware

#### Scenario: Server client created with cookies

- **WHEN** `createServerClient()` is called with valid cookies
- **THEN** it returns a Supabase client that can read session cookies

#### Scenario: Server client tolerates no-op setAll in Server Components

- **WHEN** `createServerClient()` is used in a Server Component context
- **THEN** cookie writes are silently ignored (no error), reads continue to work

### Requirement: Service role admin client preserved

The system SHALL preserve `supabaseAdmin` in `src/lib/supabase/server.ts` as a named export created with `createClient` from `@supabase/supabase-js` and the service role key.

- MUST read `SUPABASE_SERVICE_ROLE_KEY` from environment
- MUST use `server-only` import to prevent browser bundling
- MUST coexist alongside `createServerClient()` in the same module

#### Scenario: Admin client created

- **WHEN** `supabaseAdmin` is imported
- **THEN** it returns a Supabase client with service role privileges

### Requirement: Middleware Supabase client with updateSession

The system SHALL provide an `updateSession(request)` function in `src/lib/supabase/middleware.ts` for use in Next.js middleware.

- MUST use `createServerClient` from `@supabase/ssr` with `NextRequest` cookies
- MUST call `getClaims()` internally to extract JWT claims
- MUST return `{ response: NextResponse; claims: JwtPayload | null }`
  - `response`: NextResponse with potentially refreshed cookies
  - `claims`: parsed JWT payload from `getClaims()`, or `null` if not authenticated/error
- SHALL be importable from `src/middleware.ts`

#### Scenario: updateSession returns response and claims

- **WHEN** `updateSession(request)` is called with a valid request from an authenticated user
- **THEN** it returns an object with both `response` (cookies refreshed) and `claims` (JwtPayload with sub)

#### Scenario: updateSession returns null claims for anonymous

- **WHEN** `updateSession(request)` is called without a session
- **THEN** it returns an object with `response` and `claims: null`

### Requirement: Barrel file removed

The system SHALL remove `src/lib/supabase.ts` (the barrel re-export file) to prevent browser/server import contamination.

- MUST verify no file imports from `@/lib/supabase` (barrel) anymore
- All consumers MUST migrate to direct imports from `@/lib/supabase/client`, `@/lib/supabase/server`, or `@/lib/supabase/middleware`

#### Scenario: Barrel import fails

- **WHEN** any file attempts to import from `@/lib/supabase`
- **THEN** the import MUST fail with module not found
