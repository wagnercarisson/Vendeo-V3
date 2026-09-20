# Conta Page

> Delta spec para `fase-50-demonstracao-gratuita-e-validade-dos-creditos` (D11/D10). A página `/conta` passa a exibir o status da demonstração e as notificações.

## MODIFIED Requirements

### Requirement: Conta page renders credits section

O sistema SHALL exibir na página `/conta` o status da demonstração (prazo local/relativo) e a lista de notificações da demonstração (`credit_notifications`), além do saldo disponível e do extrato.

#### Scenario: Seção de demonstração presente

- **WHEN** `/conta` é renderizado para uma loja com demonstração
- **THEN** exibe o status/prazo da demonstração

#### Scenario: Notificações visíveis

- **WHEN** existem notificações da demonstração
- **THEN** a página exibe a lista de notificações e o estado de leitura
