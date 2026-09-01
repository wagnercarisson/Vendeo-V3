# Turnstile Captcha

## ADDED Requirements

### Requirement: Componente reutilizável captcha-field

O sistema SHALL prover um componente reutilizável `src/components/auth/captcha-field.tsx` que renderiza o widget Cloudflare Turnstile e coleta o token — D3.

- O componente expõe um método/retorno para obter o token do captcha (`captchaField.getToken()` ou equivalente).
- O token é enviado como `captchaToken` nas operações de auth do Supabase.
- O componente é aplicado às telas de **signup email/senha, login por senha e recuperação de senha**.
- **Não** é aplicado ao Google OAuth (D3/D15).

#### Scenario: Captcha-field fornece token válido

- **WHEN** o widget Turnstile completa a verificação
- **THEN** o componente disponibiliza o token
- **AND** o token é enviado como `captchaToken` na operação de auth

#### Scenario: Token ausente bloqueia a operação

- **WHEN** o usuário tenta submeter signup/login/recuperação
- **AND** o token do captcha está ausente (widget não completou)
- **THEN** a operação de auth NÃO é chamada
- **AND** é exibida a mensagem genérica "Não foi possível concluir. Tente novamente."

### Requirement: Integração nativa do Supabase Auth — validação server-side

O sistema SHALL usar a integração nativa do Supabase Auth para captcha: o frontend envia `captchaToken` e o Supabase valida server-side com a secret configurada no projeto — **sem rota própria de captcha** (evita manipulação de credenciais no backend) — D3.

- A secret key fica no Supabase Dashboard (**nunca** no cliente).
- A site key pública fica no frontend/Vercel.
- Chaves de teste oficiais da Cloudflare no ambiente local; chaves reais em preview/produção (D13).
- `supabase/config.toml` ganha `[auth.captcha]` habilitado com provider `turnstile` (paridade, D13).

#### Scenario: Signup email/senha envia captchaToken

- **WHEN** o formulário de signup email/senha submete com token válido
- **THEN** `supabase.auth.signUp` é chamado com `options.captchaToken` preenchido
- **AND** o Supabase valida o token server-side

#### Scenario: Login por senha envia captchaToken

- **WHEN** o usuário faz login por senha com token válido
- **THEN** a operação de login envia `captchaToken`
- **AND** o Supabase valida o token server-side

#### Scenario: Recuperação de senha envia captchaToken

- **WHEN** o usuário solicita recuperação de senha com token válido
- **THEN** `resetPasswordForEmail` envia `captchaToken`
- **AND** o Supabase valida o token server-side

#### Scenario: Secret nunca exposta no cliente

- **WHEN** o código do frontend é inspecionado
- **THEN** nenhuma secret key do Turnstile aparece no bundle/ambiente do cliente

### Requirement: Escopo — NÃO aplicar Turnstile ao Google OAuth

O sistema SHALL **não** enviar `captchaToken` no `signInWithOAuth` — não há contrato documentado de `captchaToken` nessa operação; a proteção do OAuth é do provedor (Google) + controles server-side de criação (D5) + feature flag — D3.

#### Scenario: OAuth não envia captchaToken

- **WHEN** o usuário inicia "Continuar com Google"
- **THEN** a chamada `signInWithOAuth` NÃO inclui `captchaToken`
- **AND** nenhuma verificação Turnstile é exigida no fluxo OAuth

### Requirement: Falha do captcha bloqueia apenas a operação com mensagem genérica

Quando o captcha falha, está indisponível ou o token é inválido/expirado/reutilizado, o sistema SHALL bloquear **apenas a tentativa de cadastro/login/recuperação** com a mensagem genérica "Não foi possível concluir. Tente novamente." — sem revelar existência de conta e sem degradar o restante do produto — D2/D3.

#### Scenario: Token inválido/expirado/reutilizado bloqueia com mensagem genérica

- **WHEN** o Supabase rejeita um `captchaToken` inválido/expirado/reutilizado
- **THEN** a operação é bloqueada
- **AND** o usuário vê "Não foi possível concluir. Tente novamente."
- **AND** a mensagem não revela se a conta existe

#### Scenario: Captcha indisponível não degrada o restante do produto

- **WHEN** o serviço Turnstile está indisponível
- **THEN** apenas a tentativa de cadastro/login/recuperação é bloqueada com a mensagem genérica
- **AND** as demais funcionalidades do produto seguem operando normalmente