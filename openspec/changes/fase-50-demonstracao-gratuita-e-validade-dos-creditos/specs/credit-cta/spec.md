# Credit CTA

> Delta spec para `fase-50-demonstracao-gratuita-e-validade-dos-creditos` (D12/D14). Remove o SLA de 24h, registra a solicitação de créditos de forma **durável e idempotente** com auto-ack, e mantém a telemetria best-effort separada.

## MODIFIED Requirements

### Requirement: CreditCta opens modal with instructions

O sistema SHALL remover a promessa "O time do Vendeo responderá em até 24h"/"Responderemos em até 24h" do modal, orientando o contato com o suporte sem prazo prometido. O `mailto:` pode permanecer como canal complementar.

#### Scenario: Sem SLA de 24h

- **WHEN** o modal de solicitação é aberto
- **THEN** o texto NÃO promete resposta em 24 horas

### Requirement: Solicitação durável e idempotente com auto-ack

O sistema SHALL criar `POST /api/support/credit-request` como **solicitação durável e idempotente** (por `operationId`), que grava a solicitação em **`support_credit_requests`** (fonte canônica), o `support_ack` (ao usuário) e o `support_notice` (aviso ao suporte) **atomicamente na mesma transação** — cumprindo a cláusula 12.3 dos Termos. **Se o sistema não conseguir gravar de forma durável, o endpoint SHALL falhar explicitamente** (não afirma ter recebido). A **telemetria** `support_credit_request` é **best-effort e separada**. O `mailto:` é apenas canal complementar.

#### Scenario: Solicitação, auto-ack e aviso ao suporte são atômicos

- **WHEN** o usuário aciona "Solicitar créditos" (com `operationId` único)
- **THEN** `POST /api/support/credit-request` grava `support_credit_requests` + `support_ack` + `support_notice` na mesma transação
- **AND** repetição com o mesmo `operationId` não duplica nada

#### Scenario: Falha ao gravar falha explicitamente

- **WHEN** o sistema não consegue gravar solicitação + auto-ack + aviso de forma durável
- **THEN** o endpoint retorna erro explícito
- **AND** NÃO afirma ao usuário que a solicitação foi recebida

#### Scenario: Suporte consome a solicitação canônica

- **WHEN** a solicitação é registrada
- **THEN** ela está disponível na superfície admin (`GET /api/admin/support-credit-requests`) para o time de suporte
- **AND** o usuário só recebe confirmação se a demanda está durável (nunca confirmação sem demanda registrada)

#### Scenario: Auto-ack não depende de mailto nem da flag de email

- **WHEN** a solicitação é registrada
- **THEN** o `support_ack` é gravado de forma durável, independentemente do `mailto:` e **nunca suprimido pela flag de email** (permanece `pending`/retry)

#### Scenario: Telemetria é best-effort e separada

- **WHEN** a solicitação é registrada
- **THEN** o evento `support_credit_request` é registrado de forma best-effort
- **AND** falha na telemetria NÃO bloqueia a solicitação, o auto-ack ou o aviso
