## ADDED Requirements

### Requirement: Dashboard shows credit balance in metrics section

O sistema SHALL exibir um indicador de saldo de créditos no dashboard quando o usuário tem loja (`has_store_with_campaigns` ou `has_store_no_campaigns`). O indicador SHALL usar o componente `BalanceDisplay` na variante `"badge"`, posicionado no grid de métricas.

O saldo é obtido via `CreditService.getBalance(store.id)` usando cliente de sessão + RLS. Se o carregamento do saldo falhar, o dashboard SHALL exibir fallback "—" sem quebrar a página.

#### Scenario: Dashboard shows balance badge with campaigns

- **WHEN** dashboard renderiza `has_store_with_campaigns`
- **THEN** exibe `BalanceDisplay` com saldo da loja no grid de métricas

#### Scenario: Dashboard shows balance badge without campaigns

- **WHEN** dashboard renderiza `has_store_no_campaigns`
- **THEN** exibe `BalanceDisplay` com saldo da loja no empty state

#### Scenario: Dashboard does not show balance badge without store

- **WHEN** dashboard renderiza `no_store`
- **THEN** não exibe badge de saldo

### Requirement: Dashboard handles balance states

O sistema SHALL tratar os estados de carregamento e erro do saldo sem quebrar a página.

#### Scenario: Dashboard handles credit loading state

- **WHEN** dashboard está carregando o saldo
- **THEN** exibe skeleton/shimmer no espaço do badge

#### Scenario: Dashboard handles credit error state

- **WHEN** carregamento do saldo falha
- **THEN** exibe fallback "—" no lugar do badge sem quebrar a página
