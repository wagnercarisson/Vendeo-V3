## ADDED Requirements

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
