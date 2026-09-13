## Purpose

Página `/signup` com formulário de cadastro (email + senha + confirmação), layout `(auth)`, controlada pela flag `publicSignupEnabled` (server-side). Anti-enumeration: sucesso/email existente → `/check-email`; captcha/operacional → mensagem genérica. Validação `NEXT_PUBLIC_SITE_URL` em módulo separado.

> Synced from `fase-8-ciclo-de-conta` (ADDED), then `fase-42-signup-controlado-elegibilidade-freemium` (MODIFIED). Flag on/off no `/signup`, senha mín. 8, captchaToken (Turnstile), PrivacyAcknowledgeModal.

## Requirements

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
- MUST include the reading of **Termos de Uso e Política de Privacidade** in an **informative/read-only modal** (`PrivacyAcknowledgeModal mode="informative"`, one per document) — no checkbox and no submit blocking; the legal terms appear as links with real href (`/termos`, `/privacidade`) whose normal click opens the modal for the corresponding document; the acknowledgement is declared by clicking "Criar conta", preceded by the microcopy "Ao clicar em Criar conta, você concorda com os Termos de Uso e declara ciência da Política de Privacidade do Vendeo.".
- MUST include a **communications consent checkbox** (opcional, LGPD): "Aceito receber comunicações comerciais do Vendeo." — does NOT block signup.
- MUST display links para Privacidade e Termos na tela (D12).
- **FLUXO (D2/D12):** No momento do signup o usuário NÃO tem sessão JWT (redirect para /check-email). Portanto: após `supabase.auth.signUp()` bem-sucedido, o client salva `{ privacyAcknowledged: true, communicationsOptIn: boolean }` em `localStorage` (chave `privacyPending`); o client NÃO chama o endpoint de privacidade agora (não há sessão autenticada). No primeiro acesso autenticado pós-confirmação, `PrivacyRecovery`/`PrivacyGate` processa a pendência e registra a ciência em `privacy_acknowledgements` e o opt-in em `consent_events`, com `userId` extraído via `requireUser()` — NUNCA do client body (previne spoofing).

#### Scenario: Password too short (mín. 8)

- **WHEN** a user submits the signup form with a password shorter than 8 characters
- **THEN** the form SHALL display "A senha deve ter no mínimo 8 caracteres" and NOT submit

#### Scenario: Confirm password does not match

- **WHEN** a user submits the signup form with confirm password different from password
- **THEN** the form SHALL display "As senhas não conferem" and NOT submit

#### Scenario: Signup form shows loading during submission

- **WHEN** a user submits the signup form
- **THEN** the submit button SHALL show a loading state and inputs SHALL be disabled

#### Scenario: Signup without touching any privacy checkbox submits

- **WHEN** user submits the signup form without interacting with any privacy checkbox
- **THEN** the form SHALL submit to Supabase Auth and redirect to `/check-email?type=signup`

#### Scenario: Reading legal documents in the informative modal

- **WHEN** user clicks "Termos de Uso" or "Política de Privacidade"
- **THEN** the informative modal SHALL open with the corresponding document, without checkbox and without confirmation button
- **AND** the links SHALL keep href `/termos` and `/privacidade`

#### Scenario: Signup saves privacyPending to localStorage

- **WHEN** user submits the signup form (no privacy checkbox interaction required)
- **THEN** the form SHALL submit to Supabase Auth
- **AND** after `signUp` completes, `{ privacyAcknowledged: true, communicationsOptIn: boolean }` SHALL be saved to `localStorage` under the `privacyPending` key
- **AND** `POST /api/legal/acknowledge-privacy` SHALL NOT be called (no JWT session exists)
- **AND** the redirect to `/check-email` SHALL occur (existing behavior, unchanged)

#### Scenario: On first authenticated access, pending privacy is processed

- **WHEN** the user accesses the app for the first time after email confirmation
- **AND** `localStorage` contains a pending privacy acknowledgement (`privacyPending`)
- **THEN** `POST /api/legal/acknowledge-privacy` SHALL be called with `{ communicationsOptIn: boolean }`
- **AND** `userId` SHALL be derived from `requireUser()` (not from client body)
- **AND** if the call succeeds, the privacy acknowledgement SHALL be registered

#### Scenario: First authenticated access without pending privacy but no privacy record

- **WHEN** the user accesses the app after email confirmation
- **AND** `localStorage` has no pending privacy acknowledgement
- **AND** `hasValidPrivacyAcknowledgement(userId)` returns false
- **THEN** the system SHALL display a pending notification requiring acknowledgement

#### Scenario: Communications consent does not block signup

- **WHEN** user submits the signup form without checking communications consent
- **THEN** the form SHALL submit successfully (no error for this checkbox)
- **AND** `localStorage` SHALL contain `communicationsOptIn: false`
- **AND** on first authenticated access, `POST /api/legal/acknowledge-privacy` SHALL NOT register a communications consent event

### Requirement: Signup calls signUp with emailRedirectTo and captchaToken

The signup form SHALL call `supabase.auth.signUp({ email, password, options: { emailRedirectTo: `${getSiteUrl()}/auth/confirm`, captchaToken } })` — D2/D3.

- `captchaToken` obtido do componente reutilizável `captcha-field` (D3).
- `getSiteUrl()` continua exigindo `NEXT_PUBLIC_SITE_URL` (contrato formalizado) — `src/lib/supabase/site-url.ts`.
- O consentimento (communicationsOptIn) NÃO é evidência legal em `user_metadata`; é persistido em `localStorage`/`privacyPending` e registrado autenticado em `consent_events`/`privacy_acknowledgements` (D12).
- `minimum_password_length = 8` no Supabase (`supabase/config.toml`) — paridade (D13).

#### Scenario: signUp sends emailRedirectTo and captchaToken

- **WHEN** the user submits the signup form with a valid captcha token
- **THEN** `supabase.auth.signUp` is called with `emailRedirectTo: "${getSiteUrl()}/auth/confirm"` and `captchaToken`
- **AND** `privacyPending`/consent choice is saved to `localStorage`

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

#### Scenario: Signup with valid credentials (auto-confirm)

- **WHEN** signup succeeds in auto-confirm mode (dev)
- **THEN** the user is redirected to `/check-email?type=signup`, then middleware sees session and redirects to `/`

#### Scenario: Signup with existing email

- **WHEN** signup is attempted with an email that already exists
- **THEN** the user is redirected to `/check-email?type=signup` (same as success, anti-enumeration)

#### Scenario: Captcha/operational error shows generic message

- **WHEN** captcha fails / service unavailable / operational error occurs
- **THEN** the form displays "Não foi possível concluir. Tente novamente."
- **AND** the message does not reveal whether the account exists

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
