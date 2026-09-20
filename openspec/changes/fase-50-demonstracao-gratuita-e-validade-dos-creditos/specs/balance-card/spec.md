# Balance Card

> Delta spec para `fase-50-demonstracao-gratuita-e-validade-dos-creditos` (D11/D12). O card passa a exibir o status/prazo da demonstração.

## MODIFIED Requirements

### Requirement: BalanceCard component

O sistema SHALL exibir no `BalanceCard` o status da demonstração (`active`/`expiring_soon`/`exhausted`/`expired`/`none`) e o prazo (data/hora local + texto relativo), além do saldo disponível. O card SHALL distinguir saldo insuficiente de bônus/comprado pós-demo.

#### Scenario: Card mostra prazo da demonstração

- **WHEN** a demo está ativa
- **THEN** o card exibe a expiração local + relativa

#### Scenario: Card mostra demo expirada vs saldo insuficiente

- **WHEN** a demo expirou mas há bônus disponível
- **THEN** o card distingue o estado "demonstração encerrada" do "saldo total insuficiente"

#### Scenario: Card usa saldo disponível

- **WHEN** o card é renderizado com demo vencido
- **THEN** o valor exibido é o saldo disponível (excluindo demo vencido)
