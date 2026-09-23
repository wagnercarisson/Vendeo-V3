# Beta Access Request

## Purpose

Controlar a solicitação pública de acesso ao beta fechado, com revisão manual, privacidade e proteção contra enumeração.

## Requirements

### Requirement: Beta fechado por solicitação/convite

O sistema SHALL manter o beta fechado, restrito ao Brasil e limitado a até 50 participantes, com entrada via `access_requests` revisada manualmente. `VENDEO_PUBLIC_SIGNUP_ENABLED` permanece `false` durante o beta e nenhum convite ocorre antes da constituição da PJ.

#### Scenario: Signup fechado

- **WHEN** `VENDEO_PUBLIC_SIGNUP_ENABLED=false`
- **THEN** `/signup` permanece fechado e a entrada ocorre por solicitação revisada

#### Scenario: Limite de participantes

- **WHEN** o beta se aproxima de 50 aprovados
- **THEN** o gate observa `COUNT DISTINCT email_normalizado` das solicitações `approved`

#### Scenario: Capacidade não usa lojas ativas

- **WHEN** o limite do beta é calculado
- **THEN** usa somente a métrica canônica de emails normalizados aprovados, sem plataforma nova de convites

### Requirement: WhatsApp opcional e rotulado

O sistema SHALL exibir WhatsApp como opcional, explicar que serve somente para contato sobre a solicitação e não vinculá-lo a `commercial_communications`.

#### Scenario: WhatsApp rotulado como opcional

- **WHEN** o formulário é renderizado
- **THEN** WhatsApp aparece como opcional e com a finalidade de contato sobre a solicitação

#### Scenario: WhatsApp não implica marketing

- **WHEN** o visitante informa WhatsApp
- **THEN** nenhum consentimento de marketing é inferido

### Requirement: Aviso de privacidade versionado

O sistema SHALL exibir aviso e links legais e registrar auditavelmente a versão apresentada, por exemplo em `privacy_notice_version`.

#### Scenario: Versão do aviso registrada

- **WHEN** uma solicitação é criada
- **THEN** `privacy_notice_version` contém a versão exibida

### Requirement: Descarte do WhatsApp

O sistema SHALL remover ou anonimizar WhatsApp quando terminar a necessidade operacional e a retenção expirar.

#### Scenario: WhatsApp descartado

- **WHEN** a solicitação é concluída ou recusada e a retenção expira
- **THEN** WhatsApp é removido ou anonimizado

### Requirement: Anti-enumeração e idempotência

O sistema SHALL preservar `uq_access_requests_email_active` e resposta idêntica para solicitações novas e duplicadas.

#### Scenario: Duplicata não é revelada

- **WHEN** o mesmo email solicita novamente com status `pending` ou `approved`
- **THEN** a resposta é idêntica à de sucesso e não revela existência
