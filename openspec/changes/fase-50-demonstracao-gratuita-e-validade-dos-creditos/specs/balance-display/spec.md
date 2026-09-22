# Balance Display

> Delta spec para `fase-50-demonstracao-gratuita-e-validade-dos-creditos` (D11). O badge/card de saldo passa a refletir saldo disponível e status da demonstração.

## MODIFIED Requirements

### Requirement: BalanceDisplay component

O sistema SHALL computar os estados de `BalanceDisplay` a partir do **saldo disponível** (demo ativo + bônus + comprado) e refletir o status da demonstração quando relevante.

#### Scenario: Estado derivado do saldo disponível

- **WHEN** a demo venceu mas há bônus
- **THEN** o estado (`normal`/`low`/`zero`) considera apenas o saldo disponível

#### Scenario: Zero com demo expirada

- **WHEN** a demo venceu e não há outro saldo
- **THEN** o estado é `zero` (solicitar créditos)
