## MODIFIED Requirements

### Requirement: Signup form validates email and password (MODIFIED)

The signup form SHALL be a client component with three fields: email, password, and confirm password.

- MUST validate password minimum length of 6 characters client-side
- MUST validate confirm password matches password client-side
- SHALL display inline error messages in Portuguese
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
- MUST call a **server-side endpoint** (`POST /api/legal/acknowledge-privacy`) after `supabase.auth.signUp()` returns, passing only `communicationsOptIn: boolean` — the privacy version SHALL be resolved server-side by the endpoint
- The endpoint SHALL run on the server after `signUp` completes, resolving the current privacy version via `getCurrentVersion("privacy_policy")` and using the server-side Supabase admin client to:
  1. Verify the user session exists (user was created)
  2. Register `privacy_acknowledgements` via `registerPrivacyAcknowledgement()` with the resolved version
  3. Register `user_consent_events` via `recordConsentEvent()` if communications opt-in
- The endpoint SHALL be called after `signUp` but before the redirect — the client MUST await the server call; if it fails, the redirect still happens (anti-enumeration preserved) but the error SHALL be logged server-side
- The legal registration is best-effort after signup (the auth user was already created by Supabase Auth, and legal audit trail is critical). If the server call fails, the account exists but without legal trail — this is a monitored error, not a blocker
- **Recovery rule:** On next access after login, if the user has no valid `privacy_acknowledgements`, the system SHALL show a pending notification requiring acknowledgement before proceeding to onboarding/store creation

#### Scenario: Signup without privacy acknowledgement is blocked

- **WHEN** user submits the signup form without checking the privacy acknowledgement checkbox
- **THEN** the form SHALL display an error and NOT submit

#### Scenario: Signup with privacy acknowledgement calls server endpoint

- **WHEN** user submits the signup form with the privacy acknowledgement checkbox checked
- **THEN** the form SHALL submit to Supabase Auth
- **AND** after `signUp` completes, `POST /api/legal/acknowledge-privacy` SHALL be called from the client with `{ communicationsOptIn: boolean }` (version resolved server-side)
- **AND** the redirect to `/check-email` SHALL occur regardless of the server call result (anti-enumeration preserved)

#### Scenario: Communications consent does not block signup

- **WHEN** user submits the signup form without checking communications consent
- **THEN** the form SHALL submit successfully (no error for this checkbox)
- **AND** `POST /api/legal/acknowledge-privacy` SHALL NOT register a communications consent event
