# Product 1:1 Campaign Credit Billing — Delivery Integration

## MODIFIED Requirements

### Requirement: Reserva temporária, cobrança final e estorno

B1b SHALL consumir a operação atômica Postgres da b1a. Entrada em `reserved` deduz temporariamente do saldo disponível; não é consumo definitivo. Somente transição válida para `delivered` finaliza um crédito. `refunded` devolve a reserva uma única vez. Tentativas/fallback compartilham a identidade e não criam reservas adicionais.

#### Scenario: Sucesso entregue
- **WHEN** campanha fica `delivered`
- **THEN** uma reserva torna-se um crédito definitivamente consumido

#### Scenario: Falha sem arte utilizável
- **WHEN** operação é estornada para `refunded`
- **THEN** saldo reservado é devolvido e nenhuma cobrança final permanece

#### Scenario: Retry/fallback
- **WHEN** a mesma campanha executa múltiplas tentativas
- **THEN** mantém uma única reserva pela identidade `campaignId + operation_id`
