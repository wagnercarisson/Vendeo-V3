# OAuth Auth Callback

## ADDED Requirements

### Requirement: Rota `/auth/callback` processa code OAuth via exchangeCodeForSession (PKCE)

O sistema SHALL prover uma rota `src/app/auth/callback/route.ts` que lê o parâmetro `code` do OAuth e chama `supabase.auth.exchangeCodeForSession(code)` (PKCE) — D16.

- A rota SHALL ser **separada** do `/auth/confirm` (email/OTP com `verifyOtp`), que permanece intacto para confirmação de email e recuperação (`src/app/auth/confirm/route.ts:8-23`).
- A rota SHALL usar `createServerClient()` de `@/lib/supabase/server`.
- Em sucesso → sessão criada → redireciona para uma rota **protegida** que atravessa o layout autenticado `(app)`.
- Em erro (`code` inválido/expirado) → redireciona para `/login?error=oauth_failed` (erro genérico, anti-enumeração — sem revelar estado da conta).

#### Scenario: Callback com code válido cria sessão

- **WHEN** uma GET request chega em `/auth/callback?code=valid_code`
- **THEN** `exchangeCodeForSession(valid_code)` é chamado
- **AND** em sucesso, o handler redireciona para a rota protegida padrão (`/loja`)
- **AND** a sessão é criada antes do redirect

#### Scenario: Callback com code inválido/expirado

- **WHEN** uma GET request chega em `/auth/callback?code=invalid_or_expired`
- **THEN** o handler redireciona para `/login?error=oauth_failed`
- **AND** nenhuma sessão é criada

#### Scenario: /auth/confirm permanece intacto para email/OTP

- **WHEN** uma GET request chega em `/auth/confirm?token_hash=xxx&type=signup`
- **THEN** o handler `/auth/confirm` continua processando via `verifyOtp`
- **AND** o novo `/auth/callback` não interfere no fluxo email/OTP

### Requirement: Allowlist de next para prevenir open redirect

O handler `/auth/callback` SHALL validar o parâmetro `next` contra uma allowlist estrita antes de redirecionar — mesmo padrão do `VALID_NEXT` do `/auth/confirm`.

- `VALID_NEXT = ["/loja", "/dashboard"]` (mesmo padrão do confirm route).
- Se `next` não estiver na allowlist → fallback para `/loja` (rota protegida padrão).
- `"/"` (landing pública) e `/onboarding` (não existe) **nunca** são destinos válidos — não passam pelo layout protegido.
- Redirecionamento externo SHALL ser bloqueado.

#### Scenario: next válido é respeitado

- **WHEN** `/auth/callback?code=valid&next=/dashboard` é solicitado
- **THEN** em sucesso, o handler redireciona para `/dashboard`

#### Scenario: next externo é bloqueado com fallback

- **WHEN** `/auth/callback?code=valid&next=https://evil.com` é solicitado
- **THEN** o handler redireciona para `/loja` (padrão seguro)

#### Scenario: next vazio usa padrão seguro

- **WHEN** `/auth/callback?code=valid` é solicitado sem `next`
- **THEN** o handler redireciona para `/loja`

### Requirement: Pós-callback cai no layout autenticado com PrivacyGate reusado

Após o redirect para a rota protegida, o fluxo SHALL atravessar o layout `(app)` (`src/app/(app)/layout.tsx:35`), onde o **PrivacyGate existente** (`src/components/legal/privacy-gate.tsx:18`) já é montado — **sem criar novo componente** em `components/auth/` — D12/D16.

- Usuário **sem acknowledgment vigente** (`hasValidPrivacyAcknowledgement` false) passa **obrigatoriamente** pelo PrivacyGate antes do onboarding.
- O gate registra ciência da Política de Privacidade + opt-in comercial opcional em `privacy_acknowledgements`/`consent_events` (fonte da verdade — nunca `user_metadata`).
- Os aceites contratuais (Termos/AUP) permanecem na criação do draft da loja (F36), inalterados.

#### Scenario: Usuário sem acknowledgment passa pelo PrivacyGate

- **WHEN** o usuário OAuth recém-autenticado cai no layout `(app)`
- **AND** não tem ciência de privacidade vigente
- **THEN** o PrivacyGate é renderizado obrigatoriamente
- **AND** a ciência da Privacidade e o opt-in comercial (se concedido) são registrados autenticados em `privacy_acknowledgements`/`consent_events`

#### Scenario: Usuário com acknowledgment segue direto ao onboarding

- **WHEN** o usuário OAuth já tem ciência de privacidade vigente
- **THEN** o PrivacyGate não é renderizado
- **AND** o fluxo segue para onboarding (F36)

### Requirement: Identity linking automático por email verificado

O sistema SHALL preservar a vinculação automática do Supabase entre identidades com **mesmo email verificado** — D16.

- Conta email confirmada + Google mesmo email → **mesmo usuário** (sem duplicar `public.users`, lojas ou acknowledgments).
- Conta email não confirmada + Google → comportamento do Supabase validado em teste.
- `enable_manual_linking = false` permanece — **vinculação manual fora do escopo** (D14).
- Identity linking e `enable_signup=false` SHALL ser validados como **testes integrados/UAT com Supabase real**, não apenas mocks Vitest.

#### Scenario: Email confirmado + Google mesmo email não duplica

- **WHEN** um usuário com conta email confirmada autentica via Google com o mesmo email
- **THEN** o Supabase vincula a identidade ao mesmo usuário
- **AND** nenhuma duplicação de `public.users`, lojas ou acknowledgments ocorre

#### Scenario: Novo usuário Google sem crédito

- **WHEN** um usuário novo autentica via Google e cria uma loja
- **THEN** a conta/loja draft **não** recebe crédito (invariante D6)
- **AND** apenas `verification_status='approved'` pode conceder os 10 créditos de onboarding

#### Scenario: Google existente com enable_signup off continua logando

- **WHEN** "Allow new users to sign up" (`enable_signup`) está desligado
- **AND** um usuário Google existente autentica
- **THEN** o login SHALL funcionar normalmente (nova identidade é bloqueada pelo Supabase, identidade existente não)