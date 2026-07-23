# Launch Config

> Synced from `fase-28-observabilidade-operacao-launch-controls` (ADDED), then `fase-29-3-creditos-mensais-automaticos` (ADDED). Added 4 monthly credit flags (`monthlyCreditsEnabled`, `monthlyCreditsAmount`, `monthlyBonusCap`, `monthlyCreditsMinStoreAgeDays`).

## Purpose

Módulo centralizado de feature flags lidas de environment variables, com 9 flags explícitas (5 booleanas + 4 numéricas mensais) e defaults seguros, eliminando `process.env` espalhado pelo código.

## Requirements

### Requirement: LaunchConfig type com 9 flags (5 booleanas + 4 mensais)

O sistema SHALL definir um tipo `LaunchConfig` em `src/lib/launch-config/config.ts` com 5 flags booleanas (F28) e 4 flags mensais (F29.3):

```typescript
export type LaunchConfig = {
  // Flags existentes (F28)
  v15Enabled: boolean;
  creditsChargingEnabled: boolean;
  copyDirectorEnabled: boolean;
  rateLimitEnabled: boolean;
  generationPaused: boolean;

  // Novas flags (F29.3)
  monthlyCreditsEnabled: boolean;
  monthlyCreditsAmount: number;
  monthlyBonusCap: number;
  monthlyCreditsMinStoreAgeDays: number;
};
```

#### Scenario: Tipo LaunchConfig inclui flags existentes e novas

- **WHEN** `LaunchConfig` é importado de `@/lib/launch-config/config`
- **THEN** o tipo inclui as 5 flags existentes (F28) + as 4 novas flags mensais (F29.3)

#### Scenario: Novas flags são do tipo correto

- **WHEN** `LaunchConfig` é verificado
- **THEN** `monthlyCreditsEnabled` é `boolean`
- **AND** `monthlyCreditsAmount` é `number`
- **AND** `monthlyBonusCap` é `number`
- **AND** `monthlyCreditsMinStoreAgeDays` é `number`

### Requirement: getLaunchConfig() com defaults seguros expandido

O sistema SHALL prover uma função `getLaunchConfig(): LaunchConfig` que lê de environment variables e aplica defaults, incluindo as 4 novas env vars mensais:

```typescript
export function getLaunchConfig(): LaunchConfig {
  return {
    // Existentes
    v15Enabled: process.env.VENDEO_V15_ENABLED !== "false",
    creditsChargingEnabled: process.env.VENDEO_CREDITS_CHARGING_ENABLED !== "false",
    copyDirectorEnabled: process.env.VENDEO_COPY_DIRECTOR_ENABLED !== "false",
    rateLimitEnabled: process.env.VENDEO_RATE_LIMIT_ENABLED !== "false",
    generationPaused: process.env.VENDEO_GENERATION_PAUSED === "true",

    // Novas
    monthlyCreditsEnabled: process.env.VENDEO_MONTHLY_CREDITS_ENABLED !== "false",
    monthlyCreditsAmount: Number(process.env.VENDEO_MONTHLY_CREDITS_AMOUNT) || 5,
    monthlyBonusCap: Number(process.env.VENDEO_MONTHLY_BONUS_CAP) || 10,
    monthlyCreditsMinStoreAgeDays: Number(process.env.VENDEO_MONTHLY_CREDITS_MIN_STORE_AGE_DAYS) || 30,
  };
}
```

#### Scenario: Default sem env vars

- **WHEN** `getLaunchConfig()` é chamado sem nenhuma env var configurada
- **THEN** retorna `{ v15Enabled: true, creditsChargingEnabled: true, copyDirectorEnabled: true, rateLimitEnabled: true, generationPaused: false, monthlyCreditsEnabled: true, monthlyCreditsAmount: 5, monthlyBonusCap: 10, monthlyCreditsMinStoreAgeDays: 30 }`

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

#### Scenario: VENDEO_MONTHLY_CREDITS_ENABLED=false desliga concessão

- **WHEN** `VENDEO_MONTHLY_CREDITS_ENABLED=false` está configurado
- **THEN** `getLaunchConfig().monthlyCreditsEnabled` é `false`

#### Scenario: VENDEO_MONTHLY_CREDITS_AMOUNT customiza quantidade

- **WHEN** `VENDEO_MONTHLY_CREDITS_AMOUNT=10` está configurado
- **THEN** `getLaunchConfig().monthlyCreditsAmount` é `10`

#### Scenario: VENDEO_MONTHLY_BONUS_CAP customiza teto

- **WHEN** `VENDEO_MONTHLY_BONUS_CAP=20` está configurado
- **THEN** `getLaunchConfig().monthlyBonusCap` é `20`

#### Scenario: VENDEO_MONTHLY_CREDITS_MIN_STORE_AGE_DAYS customiza idade mínima

- **WHEN** `VENDEO_MONTHLY_CREDITS_MIN_STORE_AGE_DAYS=15` está configurado
- **THEN** `getLaunchConfig().monthlyCreditsMinStoreAgeDays` é `15`

#### Scenario: Env var inválida usa fallback

- **WHEN** `VENDEO_MONTHLY_CREDITS_AMOUNT=invalid` está configurado
- **THEN** `getLaunchConfig().monthlyCreditsAmount` é `5` (fallback porque `Number('invalid')` é `NaN`, e `NaN || 5` = 5)

### Requirement: getLaunchConfig() nunca lança exceção (estendido)

A função `getLaunchConfig()` SHALL nunca lançar exceção — qualquer valor de env var é aceito com fallback para default, incluindo as novas flags mensais.

#### Scenario: Env var com valor vazio

- **WHEN** `VENDEO_V15_ENABLED=` (string vazia) está configurado
- **THEN** `getLaunchConfig()` executa sem erro
- **AND** retorna o default para a flag

#### Scenario: Env var numérica vazia usa fallback

- **WHEN** `VENDEO_MONTHLY_CREDITS_AMOUNT=` (string vazia) está configurado
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
