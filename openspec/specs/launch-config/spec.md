# Launch Config

> Synced from `fase-28-observabilidade-operacao-launch-controls` (ADDED).

## Purpose

Módulo centralizado de feature flags lidas de environment variables, com 5 flags explícitas e defaults seguros, eliminando `process.env` espalhado pelo código.

## Requirements

### Requirement: LaunchConfig type com 5 flags explícitas

O sistema SHALL definir um tipo `LaunchConfig` em `src/lib/launch-config/config.ts` com 5 flags booleanas:

```typescript
export type LaunchConfig = {
  v15Enabled: boolean;
  creditsChargingEnabled: boolean;
  copyDirectorEnabled: boolean;
  rateLimitEnabled: boolean;
  generationPaused: boolean;
};
```

#### Scenario: Tipo LaunchConfig existe com 5 propriedades

- **WHEN** `LaunchConfig` é importado de `@/lib/launch-config/config`
- **THEN** o tipo tem exatamente as 5 propriedades `v15Enabled`, `creditsChargingEnabled`, `copyDirectorEnabled`, `rateLimitEnabled`, `generationPaused`
- **AND** todas são do tipo `boolean`

### Requirement: getLaunchConfig() com defaults seguros

O sistema SHALL prover uma função `getLaunchConfig(): LaunchConfig` que lê de environment variables e aplica defaults:

```typescript
export function getLaunchConfig(): LaunchConfig {
  return {
    v15Enabled: process.env.VENDEO_V15_ENABLED !== "false",
    creditsChargingEnabled: process.env.VENDEO_CREDITS_CHARGING_ENABLED !== "false",
    copyDirectorEnabled: process.env.VENDEO_COPY_DIRECTOR_ENABLED !== "false",
    rateLimitEnabled: process.env.VENDEO_RATE_LIMIT_ENABLED !== "false",
    generationPaused: process.env.VENDEO_GENERATION_PAUSED === "true",
  };
}
```

#### Scenario: Default sem env vars

- **WHEN** `getLaunchConfig()` é chamado sem nenhuma env var configurada
- **THEN** retorna `{ v15Enabled: true, creditsChargingEnabled: true, copyDirectorEnabled: true, rateLimitEnabled: true, generationPaused: false }`

#### Scenario: VENDEO_V15_ENABLED=false desliga master switch

- **WHEN** `VENDEO_V15_ENABLED=false` está configurado
- **THEN** `getLaunchConfig().v15Enabled` é `false`

#### Scenario: VENDEO_GENERATION_PAUSED=true ativa emergency brake

- **WHEN** `VENDEO_GENERATION_PAUSED=true` está configurado
- **THEN** `getLaunchConfig().generationPaused` é `true`

#### Scenario: Env var mal formatada usa fallback

- **WHEN** `VENDEO_V15_ENABLED=invalid` está configurado
- **THEN** `getLaunchConfig().v15Enabled` é `true` (fallback para default porque `"invalid" !== "false"`)

#### Scenario: VENDEO_CREDITS_CHARGING_ENABLED=false

- **WHEN** `VENDEO_CREDITS_CHARGING_ENABLED=false` está configurado
- **THEN** `getLaunchConfig().creditsChargingEnabled` é `false`

#### Scenario: VENDEO_COPY_DIRECTOR_ENABLED=false

- **WHEN** `VENDEO_COPY_DIRECTOR_ENABLED=false` está configurado
- **THEN** `getLaunchConfig().copyDirectorEnabled` é `false`

#### Scenario: VENDEO_RATE_LIMIT_ENABLED=false

- **WHEN** `VENDEO_RATE_LIMIT_ENABLED=false` está configurado
- **THEN** `getLaunchConfig().rateLimitEnabled` é `false`

### Requirement: getLaunchConfig() nunca lança exceção

A função `getLaunchConfig()` SHALL nunca lançar exceção — qualquer valor de env var é aceito com fallback para default.

#### Scenario: Env var com valor vazio

- **WHEN** `VENDEO_V15_ENABLED=` (string vazia) está configurado
- **THEN** `getLaunchConfig()` executa sem erro
- **AND** retorna o default para a flag

### Requirement: Visual signature generation respects generationPaused flag

O `POST /api/store/[id]/visual-signature/generate-without-logo` handler SHALL check `getLaunchConfig().generationPaused` before any other operation.

If `generationPaused` is `true`, the handler SHALL return HTTP 503 with message "Geração temporariamente indisponível." before:
- Checking locks
- Checking balance
- Reserving credits
- Calling any AI service

#### Scenario: generationPaused=true blocks VS generation

- **WHEN** `POST /generate-without-logo` é chamado
- **AND** `getLaunchConfig().generationPaused` é `true`
- **THEN** retorna HTTP 503
- **AND** Nenhuma chamada de IA é feita
- **AND** Nenhum crédito é reservado

### Requirement: Visual signature generation respects creditsChargingEnabled flag

When `getLaunchConfig().creditsChargingEnabled` is `false`, the `POST /api/store/[id]/visual-signature/generate-without-logo` handler SHALL skip balance check and credit reservation.

The generation SHALL proceed without consuming credits, but the VS SHALL still be persisted normally.

#### Scenario: creditsChargingEnabled=false skips credit check

- **WHEN** `POST /generate-without-logo` é chamado
- **AND** `getLaunchConfig().creditsChargingEnabled` é `false`
- **THEN** o handler NÃO verifica saldo
- **AND** NÃO chama `reserveCredit()`
- **AND** a VS é gerada e persistida normalmente

### Requirement: Visual signature generation respects v15Enabled flag

When `getLaunchConfig().v15Enabled` is `false`, the `POST /api/store/[id]/visual-signature/generate-without-logo` handler SHALL operate in v1.4 compatibility mode: generation proceeds without any credit verification.

This is the master switch — if `v15Enabled=false`, credit verification is skipped regardless of `creditsChargingEnabled`.

#### Scenario: v15Enabled=false bypasses all credit logic

- **WHEN** `POST /generate-without-logo` é chamado
- **AND** `getLaunchConfig().v15Enabled` é `false`
- **THEN** o handler NÃO verifica saldo
- **AND** NÃO chama `reserveCredit()`
- **AND** a VS é gerada sem consumo de crédito
