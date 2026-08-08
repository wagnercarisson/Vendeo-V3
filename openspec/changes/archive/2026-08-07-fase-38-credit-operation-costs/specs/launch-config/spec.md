## MODIFIED Requirements

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
