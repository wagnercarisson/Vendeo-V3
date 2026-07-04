## ADDED Requirements

### Requirement: /forgot-password page exists

The system SHALL have a `/forgot-password` page at `src/app/(auth)/forgot-password/page.tsx` with a password reset request form within the `(auth)` route group.

- MUST be a server component that renders `<ForgotPasswordForm />`
- MUST NOT use `requirePageUser()` — authentication check is handled by middleware
- MUST inherit the `(auth)` layout

#### Scenario: Anonymous user accesses /forgot-password

- **WHEN** an unauthenticated user requests `/forgot-password`
- **THEN** the forgot password form SHALL be rendered

#### Scenario: Authenticated user accesses /forgot-password

- **WHEN** an authenticated user requests `/forgot-password`
- **THEN** middleware SHALL redirect to `/`

### Requirement: NEXT_PUBLIC_SITE_URL is required

`NEXT_PUBLIC_SITE_URL` SHALL be a required environment variable validated at module load / build time, before any auth operation.

- MUST validate the variable is present and non-empty at the point where `redirectTo` URLs are constructed
- MUST fail immediately (throw) at build/load time if absent — this is a **developer-facing** error, not a user-facing runtime message
- SHALL prevent `supabase.auth.resetPasswordForEmail()` from being called when absent
- This requirement is independent of anti-enumeration: configuration failure is visible to the developer; anti-enumeration governs what the *user* sees from auth API responses

#### Scenario: Missing NEXT_PUBLIC_SITE_URL prevents password reset

- **WHEN** `NEXT_PUBLIC_SITE_URL` is not set at build/load time
- **THEN** an error SHALL be thrown indicating the missing variable
- **AND** `supabase.auth.resetPasswordForEmail()` SHALL NOT be called

### Requirement: Forgot password form sends reset email

The forgot password form SHALL be a client component with an email field and submit button.

- MUST call `supabase.auth.resetPasswordForEmail(email, { redirectTo: "${NEXT_PUBLIC_SITE_URL}/auth/confirm" })`
- MUST always redirect to `/check-email?type=recovery` regardless of success or error (anti-enumeration)
- MUST NOT display any error or success message
- SHALL display a loading state during submission

#### Scenario: Forgot password submits successfully

- **WHEN** a user submits a valid email in the forgot password form
- **THEN** `resetPasswordForEmail()` is called
- **AND** the user is redirected to `/check-email?type=recovery`

#### Scenario: Forgot password with non-existent email

- **WHEN** a user submits a non-existent email in the forgot password form
- **THEN** the user is redirected to `/check-email?type=recovery` (same as valid, anti-enumeration)

#### Scenario: Forgot password shows loading during submission

- **WHEN** a user submits the forgot password form
- **THEN** the submit button SHALL show a loading state and inputs SHALL be disabled
