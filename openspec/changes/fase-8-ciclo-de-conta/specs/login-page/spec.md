> Delta spec from `fase-7-sessao-login-vertical` (MODIFIED).

## MODIFIED Requirements

### Requirement: Login form client component

The system SHALL provide a `LoginForm` client component (`src/app/(auth)/login/login-form.tsx`) with email and password fields.

- **FROM (Fase 7):** SHALL NOT include a link to signup (signup does not exist yet)
- **TO (Fase 8):** SHALL include a "Criar conta" link to `/signup` below the submit button
- **TO (Fase 8):** SHALL include an "Esqueci minha senha" link to `/forgot-password` below the password field
- MUST be a `"use client"` component
- MUST render email input, password input, and submit button
- MUST call `supabase.auth.signInWithPassword({ email, password })` on submit
- MUST show a loading state during submission
- MUST show a generic error message on failure (no "user not found" vs "wrong password")
- MUST redirect to the sanitized `redirect` path (or `/`) on success using `router.replace()`
- SHALL use the existing dark theme styling (`#020617` background, `#F8FAFC` text)
- SHALL use `lucide-react` for icons

#### Scenario: Login form shows link to /signup

- **WHEN** the login form is displayed
- **THEN** a "Criar conta" link pointing to `/signup` SHALL be visible below the submit button

#### Scenario: Login form shows link to /forgot-password

- **WHEN** the login form is displayed
- **THEN** an "Esqueci minha senha" link pointing to `/forgot-password` SHALL be visible below the password field

#### Scenario: User navigates to signup from login

- **WHEN** the user clicks "Criar conta" on the login form
- **THEN** the browser navigates to `/signup`

#### Scenario: User navigates to forgot-password from login

- **WHEN** the user clicks "Esqueci minha senha" on the login form
- **THEN** the browser navigates to `/forgot-password`
