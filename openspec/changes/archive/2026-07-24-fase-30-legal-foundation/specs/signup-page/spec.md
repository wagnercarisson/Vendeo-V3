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
