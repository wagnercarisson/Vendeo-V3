# Login Page

## MODIFIED Requirements

### Requirement: Login form client component — Google + email/senha conforme a flag

The login form (`src/app/(auth)/login/login-form.tsx`) SHALL provide the sign-in experience with **"Continuar com Google"** and the email/password path — D2/D5/D15.

- **"Continuar com Google"** SHALL always be visible on `/login`, **including when the flag `VENDEO_PUBLIC_SIGNUP_ENABLED` is off** — the flag never removes access for existing users (D5).
- When the flag is **on**, the form SHALL also show a "criar conta com email" link (→ `/signup`) and SHALL **not** show "Solicitar acesso free".
- When the flag is **off**, `/login` SHALL still show "Continuar com Google" (access of existing OAuth users preserved) — the signup is hidden only on landing and `/signup`.
- Password login SHALL send `captchaToken` (Turnstile, D3).

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

### Requirement: /login NÃO é controlado pela flag (escopo da flag D5)

O controle da flag `VENDEO_PUBLIC_SIGNUP_ENABLED` SHALL aplicar-se apenas à landing e ao `/signup` — o `/login` NÃO é controlado pela flag — D5.

- O bloqueio efetivo de novas contas é server-side ("Allow new users to sign up" / `enable_signup`), sem prender usuários existentes na porta.
- `enable_signup=false` impede novas contas (email/senha e OAuth) mantendo login de existentes.

#### Scenario: Flag off não esconde o acesso de existentes

- **WHEN** a flag está OFF
- **AND** um usuário Google existente acessa `/login`
- **THEN** "Continuar com Google" continua visível e funcional
- **AND** `signInWithOAuth` continua funcionando para identidades existentes mesmo com `enable_signup=false`