# Product 1:1 Controlled Real Test Authorization

> B2.3 — autorização **temporária e ESTREITA** para o **teste real controlado isolado**. Não remove a barreira global que hoje recusa estágios habilitadores; atende ao recorte autorizado (instância e lojas), com expiração, auditoria e revogação. A autorização é separada das feature flags e revalidada a cada decisão.

## ADDED Requirements

### Requirement: Autorização temporária estreita

O sistema SHALL permitir uma autorização **temporária e estreita** para o **teste real controlado isolado**, restrita a uma **instância autorizada** e a **lojas autorizadas**, com **expiração**, **auditoria** (concessor, motivo, `operation_id`, escopo, instância) e **revogação**. A concessão SHALL ocorrer por **admin autenticado** via RPC auditada.

#### Scenario: Autorização restrita a instância e lojas

- **WHEN** a autorização temporária é concedida
- **THEN** ela é restrita à instância autorizada e às lojas autorizadas
- **AND** nenhuma outra instância ou loja é habilitada

#### Scenario: Concessão auditada

- **WHEN** a autorização é concedida
- **THEN** ficam registrados o concessor, o motivo, o `operation_id`, o escopo e a instância
- **AND** a concessão é auditável

#### Scenario: Autorização com expiração

- **WHEN** a autorização é concedida com expiração
- **THEN** após o vencimento ela deixa de permitir o recorte
- **AND** o estado retorna a não autorizado

### Requirement: Revogação e revalidação server-side

A autorização SHALL ser **revogável** e **revalidada a cada decisão**, com leitura server-side. A autorização SHALL NOT decorrer de alegação do cliente.

#### Scenario: Revogação encerra o recorte

- **WHEN** a autorização é revogada
- **THEN** o recorte autorizado deixa de ser permitido
- **AND** a decisão passa a negar

#### Scenario: Autorização nunca vem do cliente

- **WHEN** uma decisão de elegibilidade é tomada
- **THEN** ela deriva exclusivamente do estado server-side
- **AND** nenhum parâmetro do cliente altera o resultado

### Requirement: Barreira global preservada

A autorização temporária estreita SHALL NOT remover a **barreira global** de recusa de estágios habilitadores de escopo geral. Fora do recorte autorizado, o comportamento existente de recusa SHALL permanecer.

#### Scenario: Escopo geral continua recusado

- **WHEN** se tenta habilitar o escopo geral
- **THEN** a recusa de estágios habilitadores permanece
- **AND** apenas o recorte temporário autorizado é permitido

### Requirement: Autorização não antecipa F56.3

A autorização temporária SHALL NOT habilitar aprovação, reprovação ou correção de arte, que permanecem na F56.3.

#### Scenario: F56.3 permanece fora

- **WHEN** a autorização temporária está vigente
- **THEN** aprovação/reprovação/correção continuam indisponíveis
- **AND** a decisão de aprovação permanece reservada à F56.3
