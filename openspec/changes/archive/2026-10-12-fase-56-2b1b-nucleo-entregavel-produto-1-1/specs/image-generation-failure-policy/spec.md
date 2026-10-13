# Image Generation Failure Policy — Delivery Integration

## MODIFIED Requirements

### Requirement: Falha técnica não é cobrada do lojista

Falhas técnicas SHALL NOT gerar cobrança ao lojista. A operação encerrada por falha técnica (elegível ou não elegível) SHALL NOT consumir crédito do lojista nem gerar nova cobrança adicional. Na b1b, tentativas/fallback/repetição dentro da política **não** geram cobrança adicional; exatamente **um crédito por entrega** é efetivado. Falha confirmada sem arte utilizável → `refunded` uma vez; resultado desconhecido → operação pendente/limitada, sem estorno por timeout e sem nova chamada cega.

#### Scenario: Falha técnica não debita

- **WHEN** a operação termina por falha técnica após esgotar as tentativas
- **THEN** nenhum crédito do lojista é consumido pela tentativa falha
- **AND** nenhuma cobrança adicional é criada

#### Scenario: Fallback não consome cota do lojista

- **WHEN** o fallback é acionado dentro da mesma operação
- **THEN** a tentativa de fallback não é tratada como operação separada do lojista

#### Scenario: Um crédito por entrega

- **WHEN** a operação é entregue
- **THEN** exatamente um crédito é efetivado
- **AND** nenhuma tentativa técnica adicional é cobrada

## ADDED Requirements

### Requirement: Resultado desconhecido sem repetição cega nem estorno por timeout

Uma tentativa cujo resultado é desconhecido (timeout, perda de conexão) SHALL deixar a operação pendente/limitada, **sem** estorno baseado apenas em timeout e **sem** nova chamada cega ao provider. A change SHALL NOT prometer recuperação automática.

#### Scenario: Timeout não é falha definitiva

- **WHEN** a chamada ao provider não retorna resultado definitivo
- **THEN** a operação fica pendente/limitada
- **AND** nenhum estorno por timeout isolado e nenhuma nova chamada cega são executados
