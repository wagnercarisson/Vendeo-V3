## Purpose

Página `/signup` com formulário de cadastro (email + senha + confirmação), layout `(auth)`. Anti-enumeration: sempre redireciona para `/check-email` independente de sucesso ou erro. Validação `NEXT_PUBLIC_SITE_URL` em módulo separado.

> Synced from `fase-8-ciclo-de-conta` (ADDED).

## Requirements

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
- MUST include a **privacy acknowledgement checkbox** (obrigatório):
  - Label: "Declaro ciência da Política de Privacidade."
  - "Política de Privacidade" is a link to `/privacidade` (opens in new tab)
  - Submit is blocked if unchecked: "Você precisa declarar ciência da Política de Privacidade."
  - This is a declaration of awareness (ciência), not contractual acceptance
- MUST include a **communications consent checkbox** (opcional, LGPD):
  - Label: "Aceito receber comunicações comerciais do Vendeo."
  - Separate and visually distinct from the privacy checkbox
  - Does NOT block signup if unchecked
  - Backed by LGPD consent (art. 7º, I)
- **FLUXO ATUALIZADO (pós-revisão):** No momento do signup o usuário NÃO tem sessão JWT (redirect para /check-email). Portanto:
  - Após `supabase.auth.signUp()` bem-sucedido, o client salva `{ privacyAcknowledged: true, communicationsOptIn: boolean }` em `sessionStorage`
  - O client NÃO chama o endpoint agora — não há sessão autenticada
  - Redireciona para `/check-email` (comportamento existente, inalterado)
- No primeiro acesso autenticado pós-confirmação de email:
  - O componente `src/components/legal/privacy-recovery.tsx` verifica `sessionStorage`
  - Se existir pendência, chama `POST /api/legal/acknowledge-privacy` com `{ communicationsOptIn: boolean }`
  - `userId` é extraído do JWT via `requireUser()` no servidor — NUNCA aceito do client body (previne spoofing)
  - Se o endpoint falhar, exibe notificação "Pendência de privacidade" com link para re-tentar
- **O endpoint (`POST /api/legal/acknowledge-privacy`):**
  - Exige `requireUser()` — userId de `claims.sub`
  - Resolve a versão vigente server-side via `getCurrentVersion("privacy_policy")`
  - Registra `privacy_acknowledgements` via `registerPrivacyAcknowledgement()` com versão resolvida
  - Se `communicationsOptIn`, registra `user_consent_events` via `recordConsentEvent()`
  - Usa `supabaseAdmin` (service role)
- **Recovery rule:** Se o usuário chegar sem sessionStorage mas `hasValidPrivacyAcknowledgement(userId)` retornar false, o sistema exibe notificação de pendência de privacidade antes de permitir onboarding

#### Scenario: Password too short

- **WHEN** a user submits the signup form with a password shorter than 6 characters
- **THEN** the form SHALL display "A senha deve ter no mínimo 6 caracteres" and NOT submit

#### Scenario: Confirm password does not match

- **WHEN** a user submits the signup form with confirm password different from password
- **THEN** the form SHALL display "As senhas não conferem" and NOT submit

#### Scenario: Signup form shows loading during submission

- **WHEN** a user submits the signup form
- **THEN** the submit button SHALL show a loading state and inputs SHALL be disabled

#### Scenario: Signup without privacy acknowledgement is blocked

- **WHEN** user submits the signup form without checking the privacy acknowledgement checkbox
- **THEN** the form SHALL display an error and NOT submit

#### Scenario: Signup with privacy acknowledgement saves to sessionStorage

- **WHEN** user submits the signup form with the privacy acknowledgement checkbox checked
- **THEN** the form SHALL submit to Supabase Auth
- **AND** after `signUp` completes, `{ privacyAcknowledged: true, communicationsOptIn: boolean }` SHALL be saved to `sessionStorage`
- **AND** `POST /api/legal/acknowledge-privacy` SHALL NOT be called (no JWT session exists)
- **AND** the redirect to `/check-email` SHALL occur (existing behavior, unchanged)

#### Scenario: On first authenticated access, pending privacy is processed

- **WHEN** the user accesses the app for the first time after email confirmation
- **AND** `sessionStorage` contains a pending privacy acknowledgement
- **THEN** `POST /api/legal/acknowledge-privacy` SHALL be called with `{ communicationsOptIn: boolean }`
- **AND** `userId` SHALL be derived from `requireUser()` (not from client body)
- **AND** if the call succeeds, the privacy acknowledgement SHALL be registered

#### Scenario: First authenticated access without sessionStorage but no privacy record

- **WHEN** the user accesses the app after email confirmation
- **AND** `sessionStorage` has no pending privacy acknowledgement
- **AND** `hasValidPrivacyAcknowledgement(userId)` returns false
- **THEN** the system SHALL display a pending notification requiring acknowledgement

#### Scenario: Communications consent does not block signup

- **WHEN** user submits the signup form without checking communications consent
- **THEN** the form SHALL submit successfully (no error for this checkbox)
- **AND** `sessionStorage` SHALL contain `communicationsOptIn: false`
- **AND** on first authenticated access, `POST /api/legal/acknowledge-privacy` SHALL NOT register a communications consent event

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
