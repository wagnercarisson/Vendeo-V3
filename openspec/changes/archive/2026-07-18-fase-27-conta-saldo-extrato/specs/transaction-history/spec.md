## ADDED Requirements

### Requirement: TransactionHistory component

O sistema SHALL implementar `TransactionHistory` em `src/components/credit/transaction-history.tsx` como Client Component (`"use client"`) que recebe dados por props (buscados via SSR) e gerencia navegação de página via `useRouter` + `useSearchParams`.

Props:
- `transactions: CreditTransaction[]` — lista de transações da página atual
- `totalPages: number` — total de páginas para navegação
- `currentPage: number` — página atual

#### Scenario: TransactionHistory renders with data

- **WHEN** `TransactionHistory` é renderizado com transações
- **THEN** exibe a tabela de transações

### Requirement: TransactionHistory renders transaction table

A tabela SHALL exibir as colunas: Tipo (tipo da transação), Valor, Saldo (após transação), Motivo, Data.

#### Scenario: TransactionHistory renders with transactions

- **WHEN** `TransactionHistory` é renderizado com lista de transações
- **THEN** exibe tabela com colunas Tipo, Valor, Saldo, Motivo, Data

#### Scenario: TransactionHistory renders empty state

- **WHEN** `TransactionHistory` é renderizado com lista vazia
- **THEN** exibe mensagem "Nenhuma transação encontrada"

### Requirement: TransactionHistory uses Pagination component from F21

O sistema SHALL reutilizar o componente `Pagination` da F21 para navegação entre páginas. `TransactionHistory` SHALL passar `onPageChange` que usa `useRouter` para atualizar `searchParams.page` e recarregar os dados via SSR.

#### Scenario: TransactionHistory renders pagination controls

- **WHEN** `TransactionHistory` é renderizado com `totalPages > 1`
- **THEN** exibe controles de paginação com navegação "Anterior" / "Próximo"
- **AND** `onPageChange` atualiza a URL com `?page=N`

#### Scenario: TransactionHistory single page hides pagination

- **WHEN** `TransactionHistory` é renderizado com `totalPages === 1`
- **THEN** não exibe controles de paginação

### Requirement: TransactionHistory maps transaction types to labels

O sistema SHALL mapear os tipos de transação do banco para labels legíveis:

| type | Label |
|------|-------|
| grant | Concessão |
| purchase | Compra |
| deduction | Geração |
| refund | Estorno |

#### Scenario: TransactionHistory shows mapped type labels

- **WHEN** `TransactionHistory` renderiza transação com `type: "deduction"`
- **THEN** exibe "Geração" como label do tipo
