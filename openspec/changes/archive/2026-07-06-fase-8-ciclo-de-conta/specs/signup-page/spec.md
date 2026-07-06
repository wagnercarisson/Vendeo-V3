## ADDED Requirements

### Requirement: /signup page exists

The system SHALL have a `/signup` page at `src/app/(auth)/signup/page.tsx` with a signup form within the `(auth)` route group.

- MUST be a server component that renders `<SignupForm />`
- MUST NOT use `requirePageUser()` — authentication check is handled by middleware
- MUST inherit the `(auth)` layout (container centralizado, logo, tema dark)

#### Scenario: Anonymous user accesses /signup

- **WHEN** an unauthenticated user requests `/signup`
- **THEN** the signup form SHALL be rendered

#### Scenario: Authenticated user accesses /signup

- **WHEN** an authenticated user requests `/signup`
- **THEN** middleware SHALL redirect to `/`

### Requirement: Signup form validates email and password

The signup form SHALL be a client component with three fields: email, password, and confirm password.

- MUST validate password minimum length of 6 characters client-side
- MUST validate confirm password matches password client-side
- SHALL display inline error messages in Portuguese:
  - "A senha deve ter no mínimo 6 caracteres"
  - "As senhas não conferem"
- SHALL use `useState` for error messages (not `useRef` or external libraries)
- MUST display a loading state during submission

#### Scenario: Password too short

- **WHEN** a user submits the signup form with a password shorter than 6 characters
- **THEN** the form SHALL display "A senha deve ter no mínimo 6 caracteres" and NOT submit

#### Scenario: Confirm password does not match

- **WHEN** a user submits the signup form with confirm password different from password
- **THEN** the form SHALL display "As senhas não conferem" and NOT submit

#### Scenario: Signup form shows loading during submission

- **WHEN** a user submits the signup form
- **THEN** the submit button SHALL show a loading state and inputs SHALL be disabled

### Requirement: NEXT_PUBLIC_SITE_URL is required

`NEXT_PUBLIC_SITE_URL` SHALL be a required environment variable validated at module load / build time, before any auth operation.

- MUST validate the variable is present and non-empty at the point where `emailRedirectTo` / `redirectTo` URLs are constructed
- MUST fail immediately (throw) at build/load time if absent — this is a **developer-facing** error, not a user-facing runtime message
- SHALL prevent `supabase.auth.signUp()` and `supabase.auth.resetPasswordForEmail()` from being called when absent
- This requirement is independent of anti-enumeration: configuration failure is visible to the developer; anti-enumeration governs what the *user* sees from auth API responses

#### Scenario: Missing NEXT_PUBLIC_SITE_URL prevents signup

- **WHEN** `NEXT_PUBLIC_SITE_URL` is not set at build/load time
- **THEN** an error SHALL be thrown indicating the missing variable
- **AND** `supabase.auth.signUp()` SHALL NOT be called

### Requirement: Signup always redirects to /check-email (anti-enumeration)

The signup form SHALL always redirect to `/check-email?type=signup` after calling `supabase.auth.signUp()`, regardless of success or error.

- MUST call `supabase.auth.signUp()` with `emailRedirectTo: "${NEXT_PUBLIC_SITE_URL}/auth/confirm"`
- MUST redirect to `/check-email?type=signup` on both success and error
- MUST NOT display any error message to the user under any circumstance
- In auto-confirm mode (dev), middleware SHALL redirect the now-authenticated user from `/check-email` to `/`

#### Scenario: Signup with valid credentials (no auto-confirm)

- **WHEN** signup succeeds and confirmation is required
- **THEN** the user is redirected to `/check-email?type=signup`

#### Scenario: Signup with valid credentials (auto-confirm)

- **WHEN** signup succeeds in auto-confirm mode (dev)
- **THEN** the user is redirected to `/check-email?type=signup`, then middleware sees session and redirects to `/`

#### Scenario: Signup with existing email

- **WHEN** signup is attempted with an email that already exists
- **THEN** the user is redirected to `/check-email?type=signup` (same as success, anti-enumeration)
