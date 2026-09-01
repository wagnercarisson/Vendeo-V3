# Signup Page

## MODIFIED Requirements

### Requirement: /signup page exists

The system SHALL have a `/signup` page at `src/app/(auth)/signup/page.tsx` that renders the signup experience within the `(auth)` route group — D2/D4/D5.

- MUST be a server component that reads the feature flag `publicSignupEnabled` **server-side** and renders:
  - **flag on:** `<SignupForm />` (email/senha) + "Continuar com Google" (D15);
  - **flag off:** a página "Beta fechado" atual (comportamento preservado) com link para "Solicitar acesso free".
- MUST NOT use `requirePageUser()` — authentication check is handled by middleware.
- MUST inherit the `(auth)` layout (container centralizado, logo, tema dark).
- MUST render links para a Política de Privacidade e os Termos na tela de signup (D12).

#### Scenario: Anonymous user accesses /signup with flag on

- **WHEN** an unauthenticated user requests `/signup`
- **AND** `publicSignupEnabled` is `true`
- **THEN** the signup form SHALL be rendered (email/senha) together with "Continuar com Google"

#### Scenario: Anonymous user accesses /signup with flag off

- **WHEN** an unauthenticated user requests `/signup`
- **AND** `publicSignupEnabled` is `false`
- **THEN** the page SHALL render the current "Beta fechado" behavior (solicitação de acesso), preserved

#### Scenario: Authenticated user accesses /signup

- **WHEN** an authenticated user requests `/signup`
- **THEN** middleware SHALL redirect to `/`

### Requirement: Signup form validates email and password

The signup form (`src/components/auth/signup-form.tsx`, restored/modernized from commit 41986f0/3bf01fc) SHALL be a client component with fields: email, password, and confirm password — D2.

- MUST validate password minimum length of **8** characters client-side (updated from 6).
- MUST validate confirm password matches password client-side.
- SHALL display inline error messages in Portuguese:
  - "A senha deve ter no mínimo 8 caracteres"
  - "As senhas não conferem"
- SHALL display a loading state during submission.
- MUST include a **privacy acknowledgement** (modal `PrivacyAcknowledgeModal`): "Declaro ciência da Política de Privacidade." — submit blocked if not acknowledged.
- MUST include a **communications consent checkbox** (opcional, LGPD): "Aceito receber comunicações comerciais do Vendeo." — does NOT block signup.
- MUST display links para Privacidade e Termos na tela (D12).

#### Scenario: Password too short (mín. 8)

- **WHEN** a user submits the signup form with a password shorter than 8 characters
- **THEN** the form SHALL display "A senha deve ter no mínimo 8 caracteres" and NOT submit

#### Scenario: Confirm password does not match

- **WHEN** a user submits the signup form with confirm password different from password
- **THEN** the form SHALL display "As senhas não conferem" and NOT submit

#### Scenario: Signup without privacy acknowledgement is blocked

- **WHEN** user submits the signup form without acknowledging the Privacy Policy (modal)
- **THEN** the form SHALL display an error and NOT submit

#### Scenario: Communications consent does not block signup

- **WHEN** user submits the signup form without checking communications consent
- **THEN** the form SHALL submit successfully (no error for this checkbox)

### Requirement: Signup calls signUp with emailRedirectTo and captchaToken

The signup form SHALL call `supabase.auth.signUp({ email, password, options: { emailRedirectTo: `${getSiteUrl()}/auth/confirm`, captchaToken } })` — D2/D3.

- `captchaToken` obtido do componente reutilizável `captcha-field` (D3).
- `getSiteUrl()` continua exigindo `NEXT_PUBLIC_SITE_URL` (contrato formalizado) — `src/lib/supabase/site-url.ts`.
- O consentimento (communicationsOptIn) NÃO é evidência legal em `user_metadata`; é persistido em `sessionStorage`/`privacyPending` e registrado autenticado em `consent_events`/`privacy_acknowledgements` (D12).
- `minimum_password_length = 8` no Supabase (`supabase/config.toml`) — paridade (D13).

#### Scenario: signUp sends emailRedirectTo and captchaToken

- **WHEN** the user submits the signup form with a valid captcha token
- **THEN** `supabase.auth.signUp` is called with `emailRedirectTo: "${getSiteUrl()}/auth/confirm"` and `captchaToken`
- **AND** `privacyPending`/consent choice is saved to `sessionStorage`

#### Scenario: Signup without captcha token is blocked

- **WHEN** the user submits the signup form without a captcha token
- **THEN** the auth call is NOT made
- **AND** the generic message "Não foi possível concluir. Tente novamente." is shown

### Requirement: Anti-enumeração — sucesso/email existente → /check-email; captcha/operacional → mensagem genérica

The signup form SHALL apply the anti-enumeration matrix — D2:

- **sucesso** e **email já cadastrado** → **mesma resposta**: redirect para `/check-email?type=signup` (nunca distinguir os dois casos).
- **captcha falhou / indisponibilidade / erro operacional** → **mensagem genérica** "Não foi possível concluir. Tente novamente." (sem chamada bem-sucedida de `signUp` e sem revelar existência de conta).
- Em nenhum cenário SHALL o sistema expor se o email já existe.

#### Scenario: Signup with valid credentials

- **WHEN** signup succeeds and confirmation is required
- **THEN** the user is redirected to `/check-email?type=signup`

#### Scenario: Signup with existing email

- **WHEN** signup is attempted with an email that already exists
- **THEN** the user is redirected to `/check-email?type=signup` (same as success, anti-enumeration)

#### Scenario: Captcha/operational error shows generic message

- **WHEN** captcha fails / service unavailable / operational error occurs
- **THEN** the form displays "Não foi possível concluir. Tente novamente."
- **AND** the message does not reveal whether the account exists