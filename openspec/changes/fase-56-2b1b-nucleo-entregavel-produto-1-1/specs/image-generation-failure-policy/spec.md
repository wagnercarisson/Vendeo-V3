# Image Generation Failure Policy

## MODIFIED Requirements

### Requirement: Política real e enforcement de saldo

A política SHALL executar retry/fallback no novo fluxo dentro do limite 2+1. Falha técnica sem arte utilizável SHALL levar a `refunded`, devolvendo a reserva temporária; sucesso SHALL levar a `delivered`, finalizando um crédito.

#### Scenario: Falha técnica
- **WHEN** operação termina sem arte utilizável
- **THEN** reserva é estornada e saldo disponível restaurado

#### Scenario: Fallback entrega
- **WHEN** arte é entregue por fallback
- **THEN** a mesma reserva é finalizada uma vez
