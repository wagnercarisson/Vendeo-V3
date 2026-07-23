## ADDED Requirements

### Requirement: LaunchConfig type with monthly credit flags

O sistema SHALL expandir o tipo `LaunchConfig` em `src/lib/launch-config/config.ts` para incluir 4 novas flags de política de bônus mensal, totalizando 9 flags:

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

### Requirement: getLaunchConfig() com novas env vars

O sistema SHALL expandir `getLaunchConfig()` para ler 4 novas environment variables com defaults:

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
- **THEN** retorna `{ monthlyCreditsEnabled: true, monthlyCreditsAmount: 5, monthlyBonusCap: 10, monthlyCreditsMinStoreAgeDays: 30 }`

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

A função `getLaunchConfig()` SHALL continuar nunca lançando exceção com as novas flags.

#### Scenario: Env var numérica vazia usa fallback

- **WHEN** `VENDEO_MONTHLY_CREDITS_AMOUNT=` (string vazia) está configurado
- **THEN** `getLaunchConfig()` executa sem erro
- **AND** retorna o default para a flag
