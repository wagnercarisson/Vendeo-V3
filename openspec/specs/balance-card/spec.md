> **Propósito**: Componente `BalanceCard` — Client Component (embute modal interativo) que exibe um card de saldo completo para a página `/conta`, com valor formatado, descrição, CTA condicional e tratamento de estados (loading, erro, sem loja).
>
> > Added by `fase-27-conta-saldo-extrato` (ADDED).
> > Modified by `fase-38-credit-operation-costs` (MODIFIED). Description shows dynamic cost via `useOperationCosts` with correct plural; no presumed "1 crédito" on 503.

## Requirements

### Requirement: BalanceCard component

> **Delta F38 (D11):** A descrição do card SHALL deixar de ser "Cada geração consome 1 crédito" e passar a exibir o custo **dinâmico** de `campaign_generation` via hook `useOperationCosts()` (client), com plural correto (`1 crédito` / `N créditos`). Se o custo estiver indisponível (`503 operation_cost_unavailable`), o card NÃO mostra "1 crédito" presumido.

O sistema SHALL implementar `BalanceCard` em `src/components/credit/balance-card.tsx` como Client Component que exibe um card de saldo completo para a página `/conta`.

O card SHALL conter:
- Valor do saldo formatado em destaque (ex.: "42 créditos")
- Descrição dinâmica "Cada geração consome {cost} crédito(s)." (custo de `campaign_generation` via `useOperationCosts`)
- CTA "Solicitar créditos" condicional quando saldo é zero ou baixo
- Link para CTA quando não há loja ("Criar loja" → `/loja`)

#### Scenario: BalanceCard renders with balance value

- **WHEN** `BalanceCard` é renderizado com `balance: 42`
- **THEN** exibe o valor "42 créditos" em destaque

#### Scenario: BalanceCard shows dynamic cost in description

- **WHEN** `BalanceCard` é renderizado e o custo de `campaign_generation` é 2
- **THEN** exibe "Cada geração consome 2 créditos."

#### Scenario: BalanceCard shows plural correctly for cost 1

- **WHEN** o custo de `campaign_generation` é 1
- **THEN** exibe "Cada geração consome 1 crédito." (singular)

#### Scenario: BalanceCard does not show presumed cost when unavailable

- **WHEN** `GET /api/operation-costs` responde `503 operation_cost_unavailable`
- **THEN** o card NÃO exibe "Cada geração consome 1 crédito" presumido
- **AND** exibe indisponibilidade/estado neutro

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
