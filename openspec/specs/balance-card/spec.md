> **Propósito**: Componente `BalanceCard` — Client Component (embute modal interativo) que exibe um card de saldo completo para a página `/conta`, com valor formatado, descrição, CTA condicional e tratamento de estados (loading, erro, sem loja).
>
> > Added by `fase-27-conta-saldo-extrato` (ADDED).

## Requirements

### Requirement: BalanceCard component

O sistema SHALL implementar `BalanceCard` em `src/components/credit/balance-card.tsx` como Client Component que exibe um card de saldo completo para a página `/conta`.

O card SHALL conter:
- Valor do saldo formatado em destaque (ex.: "42 créditos")
- Descrição "Cada geração consome 1 crédito"
- CTA "Solicitar créditos" condicional quando saldo é zero ou baixo
- Link para CTA quando não há loja ("Criar loja" → `/loja`)

#### Scenario: BalanceCard renders with balance value

- **WHEN** `BalanceCard` é renderizado com `balance: 42`
- **THEN** exibe o valor "42 créditos" em destaque

#### Scenario: BalanceCard shows CTA when balance is zero

- **WHEN** `BalanceCard` é renderizado com `balance: 0`
- **THEN** exibe CTA "Solicitar créditos" visível e clicável

#### Scenario: BalanceCard shows "Criar loja" when no store

- **WHEN** `BalanceCard` é renderizado sem store
- **THEN** exibe mensagem "Você ainda não tem uma loja" e CTA "Criar loja" com link para `/loja`

### Requirement: BalanceCard applies state-based microcopy

O sistema SHALL utilizar o microcopy definido em `CREDIT_MICROCOPY` para os estados: `no_store`, `zero`, `low`, `normal`, `loading`, `error`.

#### Scenario: BalanceCard shows loading skeleton

- **WHEN** `BalanceCard` é renderizado em estado de loading
- **THEN** exibe skeleton/shimmer no lugar do card

#### Scenario: BalanceCard shows error fallback

- **WHEN** `BalanceCard` é renderizado em estado de erro
- **THEN** exibe "Não foi possível carregar o saldo" sem confundir com saldo zero
