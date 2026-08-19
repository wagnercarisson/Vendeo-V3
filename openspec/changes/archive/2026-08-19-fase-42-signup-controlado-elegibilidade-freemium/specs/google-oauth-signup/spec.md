# Google OAuth Signup

## ADDED Requirements

### Requirement: Botão "Continuar com Google" — entrada principal de autenticação

O sistema SHALL prover um botão "Continuar com Google" (`src/components/auth/google-button.tsx`) que inicia o fluxo OAuth do Google via `supabase.auth.signInWithOAuth({ provider: "google", options: { redirectTo: `${getSiteUrl()}/auth/callback` } })` — D15.

- O mesmo fluxo serve para **entrar** e **criar conta** (semântica do botão: "Continuar com Google").
- **Visibilidade do botão conforme a flag (D5):** em **`/login` o botão é SEMPRE visível** (inclusive com a flag off — acesso de usuários existentes preservado); em **`/signup` o botão só aparece com `publicSignupEnabled = true`** (com a flag off o `/signup` exibe "Beta fechado", sem botão); na **landing o botão só aparece com a flag ligada** (D4/D5).
- O botão NÃO deve enviar `captchaToken` — OAuth não passa por Turnstile (D3).
- O `redirectTo` SHALL apontar para `getSiteUrl()/auth/callback` (rota PKCE, D16).
- O Google OAuth NÃO deve exigir segundo email de confirmação — a identidade é validada pelo provedor (D15).

#### Scenario: Clique no botão chama signInWithOAuth com provider google

- **WHEN** o usuário clica em "Continuar com Google"
- **THEN** `supabase.auth.signInWithOAuth({ provider: "google", options: { redirectTo: `${getSiteUrl()}/auth/callback` } })` é chamado
- **AND** nenhum `captchaToken` é enviado

#### Scenario: Botão sempre visível em /login

- **WHEN** o usuário acessa `/login`
- **THEN** o botão "Continuar com Google" é renderizado
- **AND** isso vale inclusive com a flag `VENDEO_PUBLIC_SIGNUP_ENABLED` desligada (acesso de existentes não é removido pela flag — D5)

#### Scenario: Botão em /signup apenas com a flag ligada

- **WHEN** o usuário acessa `/signup`
- **AND** `publicSignupEnabled` é `true`
- **THEN** o botão "Continuar com Google" é renderizado junto ao formulário email/senha

#### Scenario: Botão ausente em /signup com a flag desligada

- **WHEN** o usuário acessa `/signup`
- **AND** `publicSignupEnabled` é `false`
- **THEN** o botão "Continuar com Google" NÃO é renderizado
- **AND** o `/signup` exibe a página "Beta fechado" (comportamento preservado — D4/D5)

#### Scenario: Botão visível na landing com flag ligada

- **WHEN** a flag `VENDEO_PUBLIC_SIGNUP_ENABLED` está ligada
- **THEN** a landing renderiza "Continuar com Google" como CTA principal

### Requirement: Escopos mínimos — nenhuma permissão adicional

O fluxo OAuth SHALL solicitar apenas os escopos mínimos `openid email profile`, sem nenhuma permissão adicional sobre Gmail/Drive/outros produtos do Google — D15.

- Escopos definidos na configuração do provider (Supabase/Dashboard e `supabase/config.toml`).
- A Política de Privacidade v1.3 (D12) documenta que os dados recebidos do Google (identificador, email, nome e eventualmente avatar) têm finalidade **exclusivamente autenticacional**.

#### Scenario: Escopos mínimos configurados

- **WHEN** o provider Google é configurado no Supabase
- **THEN** os escopos solicitados são `openid email profile`
- **AND** nenhuma permissão de Gmail/Drive/outros produtos é solicitada

### Requirement: OAuth sem confirmação de email adicional e sem Turnstile

O caminho OAuth SHALL **não** exigir segunda confirmação de email (a identidade é validada pelo provedor) e **não** passar por Turnstile — D3/D15.

- A confirmação de email permanece obrigatória **apenas** no caminho email/senha (D2).
- A proteção do OAuth é do provedor (Google) somada aos controles server-side de criação (`enable_signup`, D5) e à feature flag.

#### Scenario: OAuth não envia captchaToken

- **WHEN** o botão "Continuar com Google" é acionado
- **THEN** a chamada `signInWithOAuth` não inclui `captchaToken`
- **AND** o usuário não passa por nenhuma verificação Turnstile para completar a autenticação

#### Scenario: OAuth não exige segundo email

- **WHEN** o usuário autentica via Google
- **THEN** nenhum email de confirmação adicional é enviado nem exigido