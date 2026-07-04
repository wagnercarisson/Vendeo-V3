## ADDED Requirements

### Requirement: Route group isolates auth pages
The login page SHALL be placed inside a `(auth)` route group to provide an isolated layout.

- Route: `src/app/(auth)/login/page.tsx`
- URL: `/login` (route group does not affect URL)
- Layout: `src/app/(auth)/layout.tsx`

#### Scenario: Login page accessible at /login
- **WHEN** user navigates to `/login`
- **THEN** the login page is rendered

### Requirement: Login page server component
The login page server component SHALL:
- Read `searchParams.redirect` for redirect preservation
- Render the `LoginForm` client component, passing the validated redirect value
- NOT call `requirePageUser()` — the middleware already handles redirecting authenticated users away from `/login` to `/`

#### Scenario: Authenticated user visits /login
- **WHEN** an authenticated user navigates to `/login`
- **THEN** the middleware redirects them to `/` before reaching the page component

#### Scenario: Unauthenticated user visits /login
- **WHEN** an unauthenticated user navigates to `/login`
- **THEN** the login form is rendered

### Requirement: Login form client component
The system SHALL provide a `LoginForm` client component (`src/app/(auth)/login/login-form.tsx`) with email and password fields.

- MUST be a `"use client"` component
- MUST render email input, password input, and submit button
- MUST call `supabase.auth.signInWithPassword({ email, password })` on submit
- MUST show a loading state during submission
- MUST show a generic error message on failure (no "user not found" vs "wrong password")
- MUST redirect to the sanitized `redirect` path (or `/`) on success using `router.replace()`
- SHALL use the existing dark theme styling (`#020617` background, `#F8FAFC` text)
- SHALL NOT include a link to signup (signup does not exist yet)
- SHALL use `lucide-react` for icons

#### Scenario: Login form renders
- **WHEN** the login form is displayed
- **THEN** it shows email input, password input, and a submit button

#### Scenario: Successful login
- **WHEN** user submits valid email and password
- **THEN** `signInWithPassword` is called, and on success the browser navigates to `/` (or `?redirect=` path)

#### Scenario: Failed login shows error
- **WHEN** user submits invalid email or password
- **THEN** a generic error message is displayed (e.g., "Email ou senha inválidos")

#### Scenario: Loading state during submission
- **WHEN** login form is submitting
- **THEN** the submit button shows a loading indicator and is disabled

### Requirement: Auth layout
The system SHALL provide a layout at `src/app/(auth)/layout.tsx` with a simplified structure.

- MUST render a centered container with the Vendeo logo/brand
- MUST apply the existing dark theme
- SHALL NOT include the main site navigation or complex footer
- SHALL be minimal — the form content belongs to the page, not the layout

#### Scenario: Auth layout renders
- **WHEN** any auth page is rendered
- **THEN** the layout shows the logo and a container, without main navigation
