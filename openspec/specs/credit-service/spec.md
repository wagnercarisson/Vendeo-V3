# Credit Service

> Synced from `fase-24-wallet-ledger-idempotencia` (ADDED).

## Purpose

`CreditService` — classe TypeScript com 6 métodos públicos para operações de crédito: consulta de saldo, reserva, confirmação (no-op v1.5), estorno, concessão e histórico paginado. Usa `supabaseAdmin.rpc()` para mutações e queries diretas para leituras.

## Requirements

### Requirement: CreditTransactionTypeSchema

O sistema SHALL definir `CreditTransactionTypeSchema` como `z.enum(['grant', 'purchase', 'deduction', 'refund', 'adjustment'])`.

#### Scenario: CreditTransactionTypeSchema accepts valid types

- **WHEN** validado com `'grant'`, `'purchase'`, `'deduction'`, `'refund'`, `'adjustment'`
- **THEN** a validação passa

#### Scenario: CreditTransactionTypeSchema rejects invalid type

- **WHEN** validado com tipo diferente dos 5 permitidos
- **THEN** a validação rejeita

### Requirement: CreditTransactionSchema

O sistema SHALL definir `CreditTransactionSchema` (Zod) com campos: `id (uuid)`, `storeId (uuid)`, `type (CreditTransactionTypeSchema)`, `amount (int)`, `balanceBefore (int)`, `balanceAfter (int)`, `campaignId (uuid, nullable)`, `reason (string, nullable)`, `reference (string, nullable)`, `idempotencyKey (string, nullable)`, `metadata (record, nullable)`, `createdAt (string)`.

#### Scenario: CreditTransactionSchema accepts valid transaction

- **WHEN** validado com objeto contendo todos os campos no formato correto
- **THEN** a validação passa

### Requirement: CreditOperationOptions interface

O sistema SHALL definir `CreditOperationOptions` com campos opcionais: `campaignId? (string)`, `idempotencyKey? (string)`, `metadata? (Record<string, unknown>)`.

#### Scenario: CreditOperationOptions all fields are optional

- **WHEN** `CreditOperationOptions` é usado sem nenhum campo
- **THEN** é válido (todos os campos são opcionais)

### Requirement: CreditBalance interface

O sistema SHALL definir `CreditBalance` com campos: `storeId (string)`, `balance (number)`, `updatedAt (string)`.

#### Scenario: CreditBalance exposes wallet fields

- **WHEN** `CreditBalance` é usado
- **THEN** contém `storeId`, `balance`, `updatedAt`

### Requirement: CreditService class

O sistema SHALL implementar `CreditService` com constructor que aceita `adminClient` opcional (default `supabaseAdmin`) e 6 métodos públicos.

#### Scenario: CreditService is constructable with default client

- **WHEN** `new CreditService()` é chamado sem argumentos
- **THEN** a construção é bem-sucedida
- **AND** usa `supabaseAdmin` como cliente padrão

#### Scenario: CreditService is constructable with custom client

- **WHEN** `new CreditService(customClient)` é chamado com cliente personalizado
- **THEN** a construção é bem-sucedida
- **AND** usa o cliente fornecido

### Requirement: getBalance returns current balance

O sistema SHALL implementar `getBalance(storeId: string): Promise<number>` que retorna o saldo atual da loja lendo de `credit_balances`.

#### Scenario: getBalance returns balance for store with record

- **WHEN** `getBalance(storeId)` é chamado para store com registro em `credit_balances`
- **THEN** retorna o valor de `balance` da tabela

#### Scenario: getBalance returns 0 for store without record

- **WHEN** `getBalance(storeId)` é chamado para store sem registro em `credit_balances`
- **THEN** retorna 0

### Requirement: reserveCredit calls SQL function

O sistema SHALL implementar `reserveCredit(storeId: string, amount: number, opts?: CreditOperationOptions): Promise<string>` que chama `supabaseAdmin.rpc('reserve_credit', ...)`.

#### Scenario: reserveCredit calls RPC with correct parameters

- **WHEN** `reserveCredit(storeId, 3)` é chamado
- **THEN** `supabaseAdmin.rpc('reserve_credit', { p_store_id: storeId, p_amount: 3, ... })` é chamado
- **AND** retorna o UUID resultante

#### Scenario: reserveCredit passes campaignId to RPC

- **WHEN** `reserveCredit(storeId, 3, { campaignId })` é chamado
- **THEN** a chamada RPC inclui `p_campaign_id: campaignId`

#### Scenario: reserveCredit passes idempotencyKey to RPC

- **WHEN** `reserveCredit(storeId, 3, { idempotencyKey })` é chamado
- **THEN** a chamada RPC inclui `p_idempotency_key: idempotencyKey`

#### Scenario: reserveCredit propagates saldo_insuficiente as error

- **WHEN** RPC retorna `saldo_insuficiente`
- **THEN** o erro é propagado (para handler HTTP tratar como 402)

### Requirement: confirmCredit is no-op

O sistema SHALL implementar `confirmCredit(txId: string): Promise<void>` que é no-op na v1.5.

#### Scenario: confirmCredit does nothing

- **WHEN** `confirmCredit(txId)` é chamado
- **THEN** nenhuma operação é executada
- **AND** retorna `void`

### Requirement: refundCredit calls SQL function

O sistema SHALL implementar `refundCredit(txId: string, reason: string, opts?: CreditOperationOptions): Promise<string>` que chama `supabaseAdmin.rpc('refund_credit', ...)`.

#### Scenario: refundCredit calls RPC with correct parameters

- **WHEN** `refundCredit(txId, 'falha')` é chamado
- **THEN** `supabaseAdmin.rpc('refund_credit', { p_tx_id: txId, p_reason: 'falha', ... })` é chamado
- **AND** retorna o UUID resultante

#### Scenario: refundCredit passes idempotencyKey to RPC

- **WHEN** `refundCredit(txId, 'falha', { idempotencyKey })` é chamado
- **THEN** a chamada RPC inclui `p_idempotency_key: idempotencyKey`

### Requirement: grantCredits calls SQL function

O sistema SHALL implementar `grantCredits(storeId: string, amount: number, reason: string, opts?: CreditOperationOptions): Promise<string>` que chama `supabaseAdmin.rpc('grant_credits', ...)`.

#### Scenario: grantCredits calls RPC with correct parameters

- **WHEN** `grantCredits(storeId, 10, 'onboarding')` é chamado
- **THEN** `supabaseAdmin.rpc('grant_credits', { p_store_id: storeId, p_amount: 10, p_reason: 'onboarding', ... })` é chamado
- **AND** retorna o UUID resultante

#### Scenario: grantCredits passes idempotencyKey to RPC

- **WHEN** `grantCredits(storeId, 10, 'onboarding', { idempotencyKey })` é chamado
- **THEN** a chamada RPC inclui `p_idempotency_key: idempotencyKey`

### Requirement: getHistory returns paginated transactions

O sistema SHALL implementar `getHistory(storeId: string, limit?: number, offset?: number): Promise<CreditTransaction[]>` que retorna transações paginadas da loja, filtrando `type != 'adjustment'`, ordenadas por `created_at DESC`.

#### Scenario: getHistory returns transactions without adjustment

- **WHEN** `getHistory(storeId)` é chamado
- **THEN** faz SELECT em `credit_transactions` com `type != 'adjustment'`
- **AND** ordena por `created_at DESC`

#### Scenario: getHistory respects limit parameter

- **WHEN** `getHistory(storeId, 10)` é chamado
- **THEN** o SELECT tem `LIMIT 10`

#### Scenario: getHistory default limit is 50

- **WHEN** `getHistory(storeId)` é chamado sem limit explícito
- **THEN** o SELECT tem `LIMIT 50` (default)

#### Scenario: getHistory respects offset parameter

- **WHEN** `getHistory(storeId, 10, 5)` é chamado
- **THEN** o SELECT tem `LIMIT 10 OFFSET 5`

#### Scenario: getHistory returns empty array for store without transactions

- **WHEN** `getHistory(storeId)` é chamado para loja sem transações
- **THEN** retorna array vazio

#### Scenario: getHistory maps snake_case to camelCase

- **WHEN** `getHistory(storeId)` é chamado
- **THEN** as colunas `store_id`, `balance_before`, `balance_after`, `campaign_id`, `idempotency_key`, `created_at` são mapeadas para `storeId`, `balanceBefore`, `balanceAfter`, `campaignId`, `idempotencyKey`, `createdAt`
