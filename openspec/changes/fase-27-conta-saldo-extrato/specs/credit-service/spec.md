## MODIFIED Requirements

### Requirement: CreditService class

O sistema SHALL implementar `CreditService` com constructor que aceita `adminClient` opcional (default `supabaseAdmin`), com tipagem relaxada para aceitar tanto `supabaseAdmin` (service role) quanto `createServerClient()` (sessão), e 7 métodos públicos.

#### Scenario: CreditService is constructable with default client

- **WHEN** `new CreditService()` é chamado sem argumentos
- **THEN** a construção é bem-sucedida
- **AND** usa `supabaseAdmin` como cliente padrão

#### Scenario: CreditService is constructable with session client

- **WHEN** `new CreditService(sessionClient)` é chamado com `createServerClient()`
- **THEN** a construção é bem-sucedida
- **AND** usa o cliente de sessão fornecido

#### Scenario: CreditService with session client queries via RLS

- **WHEN** `getBalance(storeId)` é chamado com cliente de sessão
- **THEN** a query respeita RLS (apenas dados da própria loja)

## ADDED Requirements

### Requirement: countCreditTransactions returns total count

O sistema SHALL implementar `countCreditTransactions(storeId: string): Promise<number>` que retorna o total de transações de uma loja (excluindo `adjustment`), usando `{ count: "exact", head: true }` para eficiência.

#### Scenario: countCreditTransactions returns total for store with transactions

- **WHEN** `countCreditTransactions(storeId)` é chamado para loja com transações
- **THEN** retorna o total de transações

#### Scenario: countCreditTransactions filters out adjustment type

- **WHEN** `countCreditTransactions(storeId)` é chamado
- **THEN** a query inclui `.neq("type", "adjustment")`

#### Scenario: countCreditTransactions returns 0 for store without transactions

- **WHEN** `countCreditTransactions(storeId)` é chamado para loja sem transações
- **THEN** retorna 0

#### Scenario: countCreditTransactions uses head: true

- **WHEN** `countCreditTransactions(storeId)` é chamado
- **THEN** a query usa `{ count: "exact", head: true }` sem carregar linhas
