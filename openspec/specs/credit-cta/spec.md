> **Propósito**: Componente `CreditCta` — Client Component com modal interativo para solicitação de créditos, com suporte a mailto via `SUPPORT_EMAIL` e fallback sem email.
>
> > Added by `fase-27-conta-saldo-extrato` (ADDED).

## Requirements

### Requirement: CreditCta component

O sistema SHALL implementar `CreditCta` em `src/components/credit/credit-cta.tsx` como Client Component (`"use client"`) que exibe o CTA "Solicitar créditos".

Props:
- `variant: "zero" | "low" | "normal"` — estado que determina o texto e comportamento
- `supportEmail?: string` — email de suporte configurável via env `SUPPORT_EMAIL`

#### Scenario: CreditCta renders with zero variant

- **WHEN** `CreditCta` é renderizado com `variant: "zero"`
- **THEN** exibe botão "Solicitar créditos" com destaque visual

#### Scenario: CreditCta renders with low variant

- **WHEN** `CreditCta` é renderizado com `variant: "low"`
- **THEN** exibe CTA "Solicitar créditos" com alerta discreto

#### Scenario: CreditCta renders nothing for normal variant

- **WHEN** `CreditCta` é renderizado com `variant: "normal"`
- **THEN** não exibe nada (retorna null)

### Requirement: CreditCta opens modal with instructions

Quando o usuário clica no CTA, o sistema SHALL abrir um modal com instruções de contato. Se `supportEmail` estiver configurado, o modal SHALL exibir link `mailto:`.

#### Scenario: CreditCta opens modal with mailto when email is configured

- **WHEN** usuário clica em "Solicitar créditos" com `supportEmail: "suporte@vendeo.app"`
- **THEN** abre modal com link `mailto:suporte@vendeo.app`
- **AND** exibe texto sem promessa de resposta em 24 horas

#### Scenario: CreditCta opens modal without mailto when email is not configured

- **WHEN** usuário clica em "Solicitar créditos" sem `supportEmail`
- **THEN** abre modal com mensagem explicativa sem link de envio automático

### Requirement: CreditCta closes modal on close action

O modal SHALL ter um botão de fechar e suportar fechamento via clique fora do modal.

#### Scenario: CreditCta modal closes on button click

- **WHEN** usuário clica no botão de fechar do modal
- **THEN** o modal é fechado

### Requirement: Solicitação durável e idempotente com auto-ack

O sistema SHALL prover `POST /api/support/credit-request` como solicitação durável e idempotente por `operationId`, gravando `support_credit_requests`, `support_ack` e `support_notice` atomicamente. Falha de gravação SHALL retornar erro explícito sem afirmar recebimento; telemetria é best-effort e separada.

#### Scenario: Solicitação e confirmações são atômicas

- **WHEN** o usuário solicita créditos com `operationId` único
- **THEN** solicitação, auto-ack e aviso ao suporte são gravados na mesma transação
- **AND** repetição não duplica

#### Scenario: Falha durável não confirma

- **WHEN** a gravação durável falha
- **THEN** o endpoint retorna erro e não afirma recebimento

#### Scenario: Suporte consome solicitação canônica

- **WHEN** a solicitação é registrada
- **THEN** fica disponível em `GET /api/admin/support-credit-requests` e confirmação só ocorre após persistência durável

#### Scenario: Auto-ack independe de mailto e flag

- **WHEN** solicitação é registrada
- **THEN** `support_ack` permanece durável pending/retry, sem depender de mailto ou flag de email

#### Scenario: Telemetria é best-effort

- **WHEN** telemetria `support_credit_request` falha
- **THEN** solicitação, ack e notice não são bloqueados
