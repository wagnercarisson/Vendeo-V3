## Purpose

Página `/login` com formulário de email + senha, layout isolado via `(auth)` route group. Middleware já redireciona usuários autenticados — a página server component confia nisso e não chama `requirePageUser()`.

> Synced from `fase-7-sessao-login-vertical` (ADDED), then `fase-42-signup-controlado-elegibilidade-freemium` (MODIFIED). "Continuar com Google" sempre visível em `/login`; flag NÃO controla o `/login`; login por senha envia `captchaToken`.

## Requirements

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

### Requirement: Login form client component — Google + email/senha conforme a flag

The login form (`src/app/(auth)/login/login-form.tsx`) SHALL provide the sign-in experience with **"Continuar com Google"** and the email/password path — D2/D5/D15.

- MUST be a `"use client"` component
- MUST render email input, password input, and submit button
- MUST call `supabase.auth.signInWithPassword({ email, password })` on submit
- MUST show a loading state during submission
- MUST show a generic error message on failure (no "user not found" vs "wrong password")
- MUST redirect to the sanitized `redirect` path (or `/`) on success using `router.replace()`
- SHALL use the existing dark theme styling (`#020617` background, `#F8FAFC` text)
- SHALL include an "Esqueci minha senha" link to `/forgot-password` below the password field
- SHALL use `lucide-react` for icons
- **"Continuar com Google"** SHALL always be visible on `/login`, **including when the flag `VENDEO_PUBLIC_SIGNUP_ENABLED` is off** — the flag never removes access for existing users (D5).
- When the flag is **on**, the form SHALL also show a "criar conta com email" link (→ `/signup`) and SHALL **not** show "Solicitar acesso free".
- When the flag is **off**, `/login` SHALL still show "Continuar com Google" (access of existing OAuth users preserved) — the signup is hidden only on landing and `/signup`.
- Password login SHALL send `captchaToken` (Turnstile, D3).

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

#### Scenario: Google button always visible on /login

- **WHEN** an unauthenticated user accesses `/login`
- **AND** the flag `VENDEO_PUBLIC_SIGNUP_ENABLED` is OFF
- **THEN** "Continuar com Google" is still rendered (existing users can access)
- **AND** the flag does not remove OAuth access for existing identities

#### Scenario: Flag on shows create-account link and hides access request

- **WHEN** an unauthenticated user accesses `/login`
- **AND** the flag is ON
- **THEN** the form shows "Continuar com Google" + link "criar conta com email" (→ `/signup`)
- **AND** "Solicitar acesso free" is not shown

#### Scenario: Password login sends captchaToken

- **WHEN** the user submits email/senha on `/login`
- **THEN** the password login operation sends `captchaToken` (Turnstile)
- **AND** a missing/invalid token blocks the attempt with the generic message

#### Scenario: Login form shows link to /forgot-password

- **WHEN** the login form is displayed
- **THEN** an "Esqueci minha senha" link pointing to `/forgot-password` SHALL be visible below the password field

#### Scenario: User navigates to forgot-password from login

- **WHEN** the user clicks "Esqueci minha senha" on the login form
- **THEN** the browser navigates to `/forgot-password`

### Requirement: /login NÃO é controlado pela flag (escopo da flag D5)

O controle da flag `VENDEO_PUBLIC_SIGNUP_ENABLED` SHALL aplicar-se apenas à landing e ao `/signup` — o `/login` NÃO é controlado pela flag — D5.

- O bloqueio efetivo de novas contas é server-side ("Allow new users to sign up" / `enable_signup`), sem prender usuários existentes na porta.
- `enable_signup=false` impede novas contas (email/senha e OAuth) mantendo login de existentes.

#### Scenario: Flag off não esconde o acesso de existentes

- **WHEN** a flag está OFF
- **AND** um usuário Google existente acessa `/login`
- **THEN** "Continuar com Google" continua visível e funcional
- **AND** `signInWithOAuth` continua funcionando para identidades existentes mesmo com `enable_signup=false`

### Requirement: Auth layout

The system SHALL provide a layout at `src/app/(auth)/layout.tsx` with a simplified structure.

- MUST render a centered container with the Vendeo logo/brand
- MUST apply the existing dark theme
- SHALL NOT include the main site navigation or complex footer
- SHALL be minimal — the form content belongs to the page, not the layout

#### Scenario: Auth layout renders

- **WHEN** any auth page is rendered
- **THEN** the layout shows the logo and a container, without main navigation
