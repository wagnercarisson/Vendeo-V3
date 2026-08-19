# Launch Config

## ADDED Requirements

### Requirement: Nova flag publicSignupEnabled (VENDEO_PUBLIC_SIGNUP_ENABLED)

O sistema SHALL incluir a flag `publicSignupEnabled` no tipo `LaunchConfig` e em `getLaunchConfig()` — D5:

```typescript
publicSignupEnabled: boolean; // envBool("VENDEO_PUBLIC_SIGNUP_ENABLED", false)
```

- **Default `false`** — a abertura do signup público é **explícita** (fail-closed), seguindo o padrão `envBool("VENDEO_*", default)` de `launch-config/config.ts`.
- A flag controla a **exposição** (landing e `/signup`) — a barreira real de criação é server-side ("Allow new users to sign up" / `enable_signup`, configurada no dashboard/projeto, D5/D13).
- **`/login` NÃO é controlado pela flag** — "Continuar com Google" permanece visível para acesso de usuários existentes mesmo com a flag off (D5).
- A flag SHALL ser validada **server-side** nas páginas/rotas que controla (landing e `/signup`), não só no cliente.
- A flag NUNCA altera `enable_signup` a partir do código da app (D5/D13).

#### Scenario: Default sem env var é false

- **WHEN** `getLaunchConfig()` é chamado sem `VENDEO_PUBLIC_SIGNUP_ENABLED` configurada
- **THEN** `publicSignupEnabled` é `false`

#### Scenario: VENDEO_PUBLIC_SIGNUP_ENABLED=true habilita

- **WHEN** `VENDEO_PUBLIC_SIGNUP_ENABLED=true` está configurado
- **THEN** `getLaunchConfig().publicSignupEnabled` é `true`

#### Scenario: VENDEO_PUBLIC_SIGNUP_ENABLED=false desabilita

- **WHEN** `VENDEO_PUBLIC_SIGNUP_ENABLED=false` está configurado
- **THEN** `getLaunchConfig().publicSignupEnabled` é `false`

#### Scenario: Flag off esconde cadastro na landing e /signup

- **WHEN** `publicSignupEnabled` é `false`
- **THEN** a landing exibe "Solicitar acesso free" (comportamento atual)
- **AND** `/signup` exibe "Beta fechado"
- **AND** `/login` continua exibindo "Continuar com Google" (acesso de existentes não é removido pela flag)

#### Scenario: Flag on expõe cadastro

- **WHEN** `publicSignupEnabled` é `true`
- **THEN** a landing exibe "Continuar com Google" + "Continuar com email"
- **AND** `/signup` exibe formulário + "Continuar com Google"