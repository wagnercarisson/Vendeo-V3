# Support Protocol

## Purpose

Definir confirmação durável, protocolo auditável e reconsideração manual para solicitações de créditos durante o beta.

## Requirements

### Requirement: Protocolo e timestamps

`support_credit_requests` SHALL possuir protocolo legível, `received_at`, `acknowledged_at`, `response_due_at`, `responded_at`, `closed_at` e status. `response_due_at` permanece NULL até validação jurídica da regra de cinco dias.

#### Scenario: Protocolo e timestamps

- **WHEN** uma solicitação é registrada
- **THEN** protocolo, `received_at` e `acknowledged_at` são gravados; os demais timestamps acompanham o fluxo e `response_due_at` permanece NULL até aprovação jurídica

### Requirement: Confirmação durável no próprio canal

`POST /api/support/credit-request` SHALL retornar `protocol` e `receivedAt`; email é confirmação adicional.

#### Scenario: Resposta do POST traz protocolo

- **WHEN** solicitação é criada com sucesso
- **THEN** resposta inclui protocolo e timestamp, sem depender do email

### Requirement: Idempotência e atomicidade

O sistema SHALL manter idempotência por `operationId` e atomicidade da solicitação, `support_ack` e `support_notice`.

#### Scenario: Repetição não duplica

- **WHEN** mesmo `operationId` é reenviado
- **THEN** solicitação, ack e aviso não duplicam

### Requirement: Reconsideração manual

O suporte SHALL poder reconsiderar manualmente elegibilidade sem sistema formal de recurso nem revelar regras antifraude.

#### Scenario: Reconsideração não revela antifraude

- **WHEN** suporte reconsidera elegibilidade recusada
- **THEN** decisão é manual e regras antifraude não são expostas

### Requirement: Meta submetida ao advogado

O sistema SHALL registrar meta operacional de primeira resposta útil em até 5 dias, sem codificar dias úteis/corridos, e submeter a regra ao advogado.

#### Scenario: Meta não codificada

- **WHEN** prazo de resposta é definido
- **THEN** meta de 5 dias é registrada e submetida ao advogado sem interpretação técnica
