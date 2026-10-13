# Product 1:1 Campaign Credit Billing — Delivery Integration

## MODIFIED Requirements

### Requirement: Reserva temporária e cobrança final

Reserva de crédito e criação do estado persistido da operação SHALL ser atômicas no Postgres, identificadas por `campaignId + operation_id`. `reserve_credit` reduz temporariamente o saldo disponível ao entrar em `reserved`; isso não é consumo definitivo. Somente a transição para `delivered` finaliza um crédito. `refunded` devolve integralmente a reserva. Qualquer falha na transação reverte reserva e estado juntos. A b1b SHALL consumir a operação atômica da b1a; tentativas/fallback compartilham a mesma identidade e **não** criam reservas adicionais.

#### Scenario: Reserva reduz saldo temporariamente

- **WHEN** uma operação confirma a reserva e entra em `reserved`
- **THEN** o saldo disponível diminui em um crédito reservado
- **AND** o estado registra que o consumo ainda não é definitivo

#### Scenario: Entrega finaliza o crédito

- **WHEN** a operação transita validamente para `delivered`
- **THEN** exatamente um crédito reservado torna-se consumo definitivo
- **AND** o reenvio (somente consulta) não repete a cobrança

#### Scenario: Estorno devolve a reserva

- **WHEN** uma operação `reserved` ou `art_uploaded` transita para `refunded` com evidência
- **THEN** o crédito reservado é devolvido ao saldo disponível uma única vez

#### Scenario: Falha reverte reserva e estado

- **WHEN** reserva ou criação do estado falha antes do commit
- **THEN** a transação Postgres reverte ambas
- **AND** não resta dedução órfã

## ADDED Requirements

### Requirement: Um crédito por entrega e nenhuma cobrança por tentativa técnica

A b1b SHALL efetivar no máximo **um crédito por entrega** (`delivered`). Tentativas técnicas adicionais (repetição no principal, fallback, reenvio equivalente) SHALL NOT gerar reserva, consumo ou cobrança adicionais ao lojista.

#### Scenario: Fallback não cobra duas vezes

- **WHEN** a entrega ocorre via fallback após falhas no principal
- **THEN** exatamente um crédito é efetivado
- **AND** nenhuma cobrança adicional é criada

#### Scenario: Reenvio equivalente não cobra novamente

- **WHEN** o lojista reenvia o mesmo pedido após uma queda
- **THEN** o crédito permanece um por entrega
- **AND** nenhuma nova reserva é criada

### Requirement: Operação consultável por identidade (reenvio é consulta)

A operação de crédito SHALL ser consultável por `campaignId + operation_id`. O **reenvio do lojista SHALL ser somente consulta**: se houver arte salva, recupera essa arte; se o resultado continuar desconhecido, **não** inicia nova tentativa, geração ou cobrança. A consulta SHALL distinguir reserva temporária de consumo definitivo.

#### Scenario: Reenvio apenas consulta

- **WHEN** o mesmo pedido é reenviado para a mesma `campaignId + operation_id`
- **THEN** a operação existente é retornada
- **AND** nenhuma nova reserva/consumo/tentativa é criada
- **AND** resultado desconhecido não dispara nova chamada ao modelo

### Requirement: Falha confirmada e resultado desconhecido

Falha **confirmada** sem arte utilizável SHALL gerar `refunded` **uma vez**. Resultado **desconhecido** (ex.: timeout) SHALL deixar a operação **pendente/limitada**, sem estorno baseado apenas em timeout e sem nova chamada cega, e **sem retomada** — nem automática, nem por reenvio do lojista. Timeout ou estado `reserved` isolados SHALL NOT autorizar estorno. A resolução SHALL ocorrer por **administrador autorizado**, com **motivo obrigatório** e **registro auditável das evidências e da transição** (sem dois aprovadores nesta versão): entregar arte existente ou estornar uma vez após confirmar ausência e encerramento, **sem re-queue** e **sem nova geração administrativa**. A “fila de atendimento” é **somente lista de pendências, sem execução automática**.

#### Scenario: Falha confirmada estorna uma vez

- **WHEN** a operação encerra por falha confirmada sem arte utilizável
- **THEN** o crédito reservado é devolvido uma única vez
- **AND** nenhuma cobrança final permanece

#### Scenario: Timeout não estorna

- **WHEN** o único sinal é timeout/resultado desconhecido
- **THEN** nenhum estorno é executado com base apenas nesse sinal
- **AND** a operação permanece pendente até resolução por administrador autorizado com evidência

#### Scenario: Suporte entrega arte existente

- **WHEN** o administrador autorizado verifica arte íntegra existente para a operação pendente
- **THEN** registra motivo, evidência e transição
- **AND** entrega a arte existente, sem nova geração

#### Scenario: Suporte estorna após ausência comprovada

- **WHEN** o administrador autorizado confirma ausência de arte e encerramento da execução
- **THEN** registra motivo, evidência e transição
- **AND** estorna uma única vez, sem re-queue
