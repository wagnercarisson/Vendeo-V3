# Credit Service

> Delta spec para `fase-50-demonstracao-gratuita-e-validade-dos-creditos` (D4). O serviço passa a expor saldo disponível e o bucket/status da demonstração.

## MODIFIED Requirements

### Requirement: getBalance returns current balance

O sistema SHALL alterar `getBalance(storeId)` para retornar o **saldo disponível** (demo ativo + bônus + comprado). A leitura SHALL derivar `available` de `demo_expires_at` **sem materializar** (a materialização contábil é responsabilidade de `reserve_credit`/reconciliador) e SHALL usar **leitura RLS de `authenticated`** (não RPC exclusiva de service_role) nas páginas autenticadas. O valor NUNCA inclui demo vencido.

#### Scenario: getBalance exclui demo vencido

- **WHEN** `getBalance(storeId)` é chamado com demo vencido
- **THEN** retorna apenas `bonus_balance + purchased_balance`

#### Scenario: getBalance inclui demo ativo

- **WHEN** `getBalance(storeId)` é chamado com demo ativo
- **THEN** retorna `demo_balance + bonus_balance + purchased_balance`

#### Scenario: Leitura autenticada por RLS sem service_role

- **WHEN** `getBalance` é chamado por um cliente `authenticated` (sessão)
- **THEN** lê o saldo da própria loja via RLS (não chama RPC service_role)
- **AND** acesso cruzado a outra loja é negado

### Requirement: CreditBalance interface

O sistema SHALL estender o breakdown de saldo para incluir `demoBalance`, `demoExpiresAt`, `bonusBalance`, `purchasedBalance`, `balance` (bruto) e `availableBalance` (disponível).

#### Scenario: Breakdown expõe demo e disponível

- **WHEN** `getBalanceBreakdown(storeId)` é chamado
- **THEN** retorna `demoBalance`, `demoExpiresAt`, `bonusBalance`, `purchasedBalance`, `balance`, `availableBalance`

### Requirement: reserveCredit translates insufficient balance

O serviço SHALL traduzir o retorno `NULL` da RPC `reserve_credit` para o erro `saldo_insuficiente`, preservando o contrato HTTP 402 dos consumidores produtivos.

#### Scenario: RPC confirms expiration before insufficient balance

- **WHEN** `reserve_credit` materializa uma expiração e retorna `NULL`
- **THEN** `CreditService.reserveCredit` lança `saldo_insuficiente`
- **AND** as rotas de geração continuam respondendo HTTP 402

### Requirement: CreditTransactionTypeSchema

O sistema SHALL estender `CreditTransactionTypeSchema` com `demo` e `expiration` (além dos 7 existentes), e `labels.ts` com os rótulos "Demonstração" e "Expiração".

#### Scenario: Schema aceita demo e expiration

- **WHEN** validado com `'demo'`/`'expiration'`
- **THEN** a validação passa
