# Product 1:1 Campaign Credit Billing — Atomic Foundation

## ADDED Requirements

### Requirement: Reserva temporária e cobrança final

Reserva de crédito e criação do estado durável SHALL ser atômicas no Postgres, identificadas por `campaignId + operation_id`. `reserve_credit` reduz temporariamente o saldo disponível ao entrar em `reserved`; isso não é consumo definitivo. Somente a transição para `delivered` finaliza um crédito. `refunded` devolve integralmente a reserva. Qualquer falha na transação reverte reserva e estado juntos.

#### Scenario: Reserva reduz saldo temporariamente
- **WHEN** uma operação confirma a reserva e entra em `reserved`
- **THEN** o saldo disponível diminui em um crédito reservado
- **AND** o estado registra que o consumo ainda não é definitivo

#### Scenario: Entrega finaliza o crédito
- **WHEN** a operação transita validamente para `delivered`
- **THEN** exatamente um crédito reservado torna-se consumo definitivo
- **AND** reenvios idempotentes não repetem a cobrança

#### Scenario: Estorno devolve a reserva
- **WHEN** uma operação `reserved` ou `art_uploaded` transita para `refunded`
- **THEN** o crédito reservado é devolvido ao saldo disponível uma única vez

#### Scenario: Falha reverte reserva e estado
- **WHEN** reserva ou criação do estado falha antes do commit
- **THEN** a transação Postgres reverte ambas
- **AND** não resta dedução órfã

### Requirement: Concorrência e transições CAS

Estados `reserved → art_uploaded → delivered | refunded` SHALL usar CAS/idempotência. `delivered` é terminal; `refunded` só pode originar de `reserved`/`art_uploaded`. Chamadas concorrentes por identidade produzem um único efeito de ledger.

#### Scenario: Chamadas concorrentes
- **WHEN** chamadas concorrentes usam o mesmo `campaignId + operation_id`
- **THEN** há um estado e no máximo um crédito reservado/finalizado

#### Scenario: Entrega não pode ser estornada
- **WHEN** reconciliação encontra estado `delivered`
- **THEN** mantém o consumo final e recusa estorno

### Requirement: Testes Postgres reais

Testes da atomicidade e concorrência SHALL executar em instância Postgres/Supabase descartável isolada após gate verificável; fakes não substituem a prova transacional.

#### Scenario: Falhas nas fronteiras
- **WHEN** testes interrompem transação reserva/estado, após reserva ou após upload
- **THEN** ledger, estado e saldo seguem as regras de rollback/reserva/estorno
