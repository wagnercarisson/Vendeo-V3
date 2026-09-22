# Support Protocol

> Capability nova (ADDED) pela `fase-50-demonstracao-gratuita-e-validade-dos-creditos` (D22). Protocolo e timestamps do suporte, confirmação durável no próprio canal, reconsideração manual e meta operacional de resposta submetida ao advogado.

## ADDED Requirements

### Requirement: Protocolo legível e timestamps

O sistema SHALL adicionar a `support_credit_requests` um **identificador de protocolo legível** e timestamps: `received_at`, `acknowledged_at`, `response_due_at`, `responded_at`, `closed_at` (além de `status`). **`response_due_at` permanece `NULL`** até a validação jurídica da regra de cinco dias.

#### Scenario: Protocolo e timestamps registrados

- **WHEN** uma solicitação de créditos é registrada
- **THEN** `protocol`, `received_at` e (no ack) `acknowledged_at` são gravados
- **AND** `response_due_at` permanece `NULL` até a aprovação jurídica; `responded_at`/`closed_at` são preenchidos conforme o fluxo

### Requirement: Confirmação durável no próprio canal

O sistema SHALL fazer `POST /api/support/credit-request` retornar, no próprio canal, `protocol` + `receivedAt` como confirmação durável; o email é confirmação **adicional**.

#### Scenario: Resposta do POST traz protocolo

- **WHEN** a solicitação é criada com sucesso
- **THEN** a resposta inclui `protocol` e `receivedAt`
- **AND** o email (support_ack) é adicional, não a única confirmação

### Requirement: Idempotência e atomicidade preservadas

O sistema SHALL manter idempotência por `operationId` e atomicidade da solicitação + `support_ack` + `support_notice`.

#### Scenario: Repetição não duplica

- **WHEN** o mesmo `operationId` é reenviado
- **THEN** não há duplicação de solicitação, auto-ack ou aviso

### Requirement: Reconsideração manual de elegibilidade

O sistema SHALL permitir **reconsideração manual da elegibilidade via suporte**, sem sistema formal de recurso e sem revelar regras antifraude.

#### Scenario: Reconsideração sem revelar antifraude

- **WHEN** o suporte reconsidera uma elegibilidade recusada
- **THEN** a decisão é manual e nenhuma regra antifraude é exposta ao usuário

### Requirement: Meta de resposta submetida ao advogado

O sistema SHALL **não codificar interpretação de dias úteis/corridos**; SHALL registrar a **meta operacional de primeira resposta útil em até 5 dias** e submetê-la ao advogado (Decreto nº 7.962/2013).

#### Scenario: Meta registrada, não codificada

- **WHEN** o prazo de resposta é definido
- **THEN** a meta de 5 dias é registrada e submetida ao advogado, sem interpretação técnica de dias úteis/corridos
