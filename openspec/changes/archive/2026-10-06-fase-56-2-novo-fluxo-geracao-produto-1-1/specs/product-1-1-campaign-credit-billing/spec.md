# Product 1:1 Campaign Credit Billing

## ADDED Requirements

### Requirement: Uma campanha entregue custa um crédito

Uma campanha entregue pelo novo fluxo SHALL custar **um** crédito, independentemente do número de tentativas técnicas e do uso de fallback. Arte gerada, persistida e disponível para download SHALL constituir entrega válida e consumir um crédito.

#### Scenario: Tentativas e fallback não somam créditos

- **WHEN** uma campanha é entregue após múltiplas tentativas ou com fallback
- **THEN** exatamente um crédito é consumido
- **AND** as tentativas adicionais não geram cobrança extra

#### Scenario: Arte disponível consome um crédito

- **WHEN** a arte é gerada, persistida e disponibilizada para download
- **THEN** a entrega é considerada válida
- **AND** um crédito é consumido

### Requirement: Falha técnica sem arte utilizável não debita

Falha técnica (elegível ou não elegível) que não produza arte utilizável SHALL NOT debitar o lojista nem gerar cobrança adicional.

#### Scenario: Falha não debita

- **WHEN** a operação termina por falha técnica sem arte utilizável
- **THEN** nenhum crédito do lojista é consumido
- **AND** nenhuma cobrança adicional é criada

### Requirement: Reserva, confirmação/estorno e idempotência transacionais

A cobrança SHALL ser transacional e testável: reserva no início, confirmação idempotente na entrega e estorno idempotente quando não houver arte utilizável. Reenvios com a mesma chave de operação SHALL NOT duplicar reserva nem estorno.

#### Scenario: Reenvio idempotente não duplica

- **WHEN** a mesma operação é reenviada com a mesma chave
- **THEN** a reserva existente é reutilizada
- **AND** nenhum débito ou estorno duplicado é criado

#### Scenario: Estorno restaura o saldo

- **WHEN** a operação falha sem arte utilizável após uma reserva
- **THEN** o crédito reservado é estornado
- **AND** o saldo é restaurado de forma idempotente

### Requirement: Fallback não é operação separada do lojista

A tentativa de fallback SHALL NOT ser tratada como operação separada do lojista.

#### Scenario: Fallback não consome cota do lojista

- **WHEN** o fallback é acionado dentro da mesma operação
- **THEN** ele não consome um crédito adicional
- **AND** a cobrança permanece a de uma campanha entregue
