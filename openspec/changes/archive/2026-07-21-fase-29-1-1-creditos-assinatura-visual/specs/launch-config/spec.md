## ADDED Requirements

### Requirement: Visual signature generation respects generationPaused flag

The `POST /api/store/[id]/visual-signature/generate-without-logo` handler SHALL check `getLaunchConfig().generationPaused` before any other operation.

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
