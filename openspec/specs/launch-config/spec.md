# Launch Config

> Synced from `fase-28-observabilidade-operacao-launch-controls` (ADDED), then `fase-29-3-creditos-mensais-automaticos` (ADDED). Added 4 monthly credit flags (`monthlyCreditsEnabled`, `monthlyCreditsAmount`, `monthlyBonusCap`, `monthlyCreditsMinStoreAgeDays`).
> Modified by `fase-38-credit-operation-costs` (MODIFIED). `creditsChargingEnabled=false`/`v15Enabled=false` skip balance/reserve but do NOT ignore operation disabled (`503 operation_disabled`) or cost read errors (`503 operation_cost_unavailable`); cost resolved via `OperationCostService` before the charging gate (D4/D12).

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

> **Delta F38 (D4):** O guard `generationPaused` (503 "Geração temporariamente indisponível") SHALL permanecer como está — precedente de vocabulário de indisponibilidade seguido por `operation_disabled`/`operation_cost_unavailable`.

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

> **Delta F38 (D4/D12):** A rota `generate-without-logo` SHALL continuar pulando saldo/reserva quando `creditsChargingEnabled=false`, **mas NÃO ignora** operação desabilitada nem erro de leitura de custo. O custo SHALL passar a ser resolvido dinamicamente (`OperationCostService.getCost("visual_signature_generation")`) **antes** do gate de cobrança: se `enabled=false` → `503 operation_disabled` (sempre); se erro real de leitura → `503 operation_cost_unavailable` (sempre). `v15Enabled=false` continua sendo o master switch (compat v1.4 sem verificação de crédito), mas a resolução de custo/guards de habilitação permanecem.

When `getLaunchConfig().creditsChargingEnabled` is `false`, the `POST /api/store/[id]/visual-signature/generate-without-logo` handler SHALL skip balance check and credit reservation **for enabled operations**.

The generation SHALL proceed without consuming credits, but the VS SHALL still be persisted normally. `enabled=false` SHALL still block com `503 operation_disabled`, e erro real de leitura de custo SHALL ainda bloquear com `503 operation_cost_unavailable`.

#### Scenario: creditsChargingEnabled=false skips credit check

- **WHEN** `POST /generate-without-logo` é chamado
- **AND** `getLaunchConfig().creditsChargingEnabled` é `false`
- **AND** a operação `visual_signature_generation` está habilitada (`enabled=true`)
- **THEN** o handler NÃO verifica saldo
- **AND** NÃO chama `reserveCredit()`
- **AND** a VS é gerada e persistida normalmente

#### Scenario: creditsChargingEnabled=false does not ignore operation disabled

- **WHEN** `POST /generate-without-logo` é chamado
- **AND** `getLaunchConfig().creditsChargingEnabled` é `false`
- **AND** a operação `visual_signature_generation` está desabilitada (`enabled=false`)
- **THEN** o handler retorna `503 operation_disabled` (guard de habilitação incondicional — D4)

#### Scenario: creditsChargingEnabled=false does not ignore cost read error

- **WHEN** `POST /generate-without-logo` é chamado
- **AND** `getLaunchConfig().creditsChargingEnabled` é `false`
- **AND** `OperationCostService.getCost` lança `OperationCostUnavailableError`
- **THEN** o handler retorna `503 operation_cost_unavailable` (fail-closed independe da cobrança — D5)

### Requirement: Visual signature generation respects v15Enabled flag

> **Delta F38 (D4/D12):** `v15Enabled=false` (compat v1.4) SHALL continuar pulando saldo/reserva, mas a resolução de custo via `OperationCostService` e os guards de habilitação/disponibilidade permanecem — `enabled=false` ainda retorna `503 operation_disabled` e erro real de leitura ainda retorna `503 operation_cost_unavailable`.

When `getLaunchConfig().v15Enabled` is `false`, the `POST /api/store/[id]/visual-signature/generate-without-logo` handler SHALL operate in v1.4 compatibility mode: generation proceeds without any credit verification.

This is the master switch — if `v15Enabled=false`, credit verification is skipped regardless of `creditsChargingEnabled`.

#### Scenario: v15Enabled=false bypasses all credit logic

- **WHEN** `POST /generate-without-logo` é chamado
- **AND** `getLaunchConfig().v15Enabled` é `false`
- **THEN** o handler NÃO verifica saldo
- **AND** NÃO chama `reserveCredit()`
- **AND** a VS é gerada sem consumo de crédito

#### Scenario: v15Enabled=false skips balance check and reserve, but still honors availability/cost read failure

- **WHEN** `POST /generate-without-logo` é chamado
- **AND** `getLaunchConfig().v15Enabled` é `false`
- **THEN** o handler NÃO verifica saldo
- **AND** NÃO chama `reserveCredit()`
- **AND** a VS é gerada sem consumo de crédito
- **AND** a resolução de custo via `OperationCostService` permanece — `enabled=false` ainda retorna `503 operation_disabled` e erro real de leitura ainda retorna `503 operation_cost_unavailable` (D4/D5)

#### Scenario: v15Enabled=false still honors operation disabled

- **WHEN** `POST /generate-without-logo` é chamado
- **AND** `getLaunchConfig().v15Enabled` é `false`
- **AND** a operação `visual_signature_generation` está desabilitada (`enabled=false`)
- **THEN** o handler retorna `503 operation_disabled`

#### Scenario: v15Enabled=false still honors cost read failure

- **WHEN** `POST /generate-without-logo` é chamado
- **AND** `getLaunchConfig().v15Enabled` é `false`
- **AND** `OperationCostService.getCost` lança `OperationCostUnavailableError`
- **THEN** o handler retorna `503 operation_cost_unavailable`
