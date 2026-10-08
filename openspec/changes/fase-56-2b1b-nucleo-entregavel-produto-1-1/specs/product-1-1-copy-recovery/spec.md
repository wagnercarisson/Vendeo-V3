# Product 1:1 Copy Recovery

## ADDED Requirements

### Requirement: Falha de copy não bloqueia arte entregue

Falha apenas da copy SHALL ser persistida sem bloquear download da arte entregue; não SHALL gerar crédito adicional. Nesta change SHALL NOT existir botão ou endpoint de retry; retry pertence à b2.

#### Scenario: Copy falha
- **WHEN** arte é íntegra e operação `delivered`, mas copy falha
- **THEN** arte permanece baixável, estado de falha persiste e reserva é finalizada uma vez

#### Scenario: Sem retry
- **WHEN** copy está pendente/falha
- **THEN** nenhuma ação de retry é exposta nesta change
