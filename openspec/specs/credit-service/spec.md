# Credit Service

> Synced from `fase-24-wallet-ledger-idempotencia` (ADDED). Modified by `fase-27-conta-saldo-extrato` (MODIFIED): constructor accepts generic `SupabaseClient` (not just `typeof supabaseAdmin`), added `countCreditTransactions()` method.

## Purpose

`CreditService` — classe TypeScript com 7 métodos públicos para operações de crédito: consulta de saldo, reserva, confirmação (no-op v1.5), estorno, concessão, histórico paginado e contagem de transações. Usa `supabaseAdmin.rpc()` para mutações e queries diretas para leituras. O construtor aceita `SupabaseClient` genérico, suportando tanto `supabaseAdmin` (service role) quanto `createServerClient()` (sessão + RLS).

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

O sistema SHALL definir `CreditOperationOptions` com campos opcionais: `campaignId? (string | null)`, `idempotencyKey? (string)`, `metadata? (Record<string, unknown>)`.

O campo `campaignId` aceita `null` explicitamente para operações que não pertencem a uma campanha (ex.: assinatura visual).

#### Scenario: CreditOperationOptions all fields are optional

- **WHEN** `CreditOperationOptions` é usado sem nenhum campo
- **THEN** é válido (todos os campos são opcionais)

#### Scenario: CreditOperationOptions campaignId aceita null

- **WHEN** `CreditOperationOptions` é usado com `campaignId: null`
- **THEN** é válido
- **AND** o RPC recebe `p_campaign_id: null`

### Requirement: CreditBalance interface

O sistema SHALL definir `CreditBalance` com campos: `storeId (string)`, `balance (number)`, `updatedAt (string)`.

#### Scenario: CreditBalance exposes wallet fields

- **WHEN** `CreditBalance` é usado
- **THEN** contém `storeId`, `balance`, `updatedAt`

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

#### Scenario: reserveCredit passes metadata to RPC

- **WHEN** `reserveCredit(storeId, 1, { campaignId: null, metadata: { feature: "visual_signature" } })` é chamado
- **THEN** a chamada RPC inclui `p_metadata: { feature: "visual_signature" }`

### Requirement: reserveCredit supports campaignId null for VS operations

O sistema SHALL allow `reserveCredit()` to be called with `campaignId: null` for visual signature operations. O `metadata` parameter SHALL be used to identify VS transactions instead.

When `campaignId` is null, the `metadata` SHALL include:
- `feature: "visual_signature"` — identifies the transaction as VS-related
- `mode: "standard" | "substitution"` — generation mode
- `operationId: string` — unique operation identifier

The `idempotencyKey` SHALL follow the pattern: `vs_reserve_${storeId}_${operationId}`.

#### Scenario: reserveCredit accepts campaignId null for VS

- **WHEN** `reserveCredit(storeId, 1, { campaignId: null, idempotencyKey, metadata: { feature: "visual_signature", mode: "standard", operationId } })` é chamado
- **THEN** a chamada RPC inclui `p_campaign_id: null`
- **AND** `p_idempotency_key` é `vs_reserve_${storeId}_${operationId}`
- **AND** a transação é registrada no ledger com `campaign_id: null`

### Requirement: refundCredit compatível com VS metadata

O sistema SHALL support calling `refundCredit()` with the transaction ID returned by `reserveCredit()` for VS operations. O `reason` parameter SHALL describe the technical failure.

#### Scenario: refundCredit with VS tx id restores balance

- **WHEN** `refundCredit(creditTxId, "geração falhou: timeout na IA")` é chamado após uma reserva de VS
- **THEN** o saldo da loja é restaurado
- **AND** a transação de estorno é registrada no ledger

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
