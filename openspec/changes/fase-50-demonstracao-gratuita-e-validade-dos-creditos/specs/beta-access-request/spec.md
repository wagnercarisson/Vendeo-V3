# Beta Access Request

> Capability nova (ADDED) pela `fase-50-demonstracao-gratuita-e-validade-dos-creditos` (D17/D18). Solicitação pública de acesso ao beta fechado: WhatsApp opcional e rotulado, aviso de privacidade versionado, descarte do WhatsApp e preservação de anti-enumeração/idempotência.

## ADDED Requirements

### Requirement: Beta fechado por solicitação/convite

O sistema SHALL manter o beta **fechado**, restrito ao Brasil e limitado a **até 50 participantes**, com entrada via `access_requests` revisada manualmente. `VENDEO_PUBLIC_SIGNUP_ENABLED` SHALL permanecer `false` durante o beta (nenhum convite antes da constituição da PJ).

#### Scenario: Signup fechado durante o beta

- **WHEN** `VENDEO_PUBLIC_SIGNUP_ENABLED=false`
- **THEN** `/signup` permanece fechado e a entrada é via solicitação de acesso revisada

#### Scenario: Limite de participantes registrado (métrica única)

- **WHEN** o beta se aproxima de 50 participantes aprovados
- **THEN** o gate operacional é observado pela métrica canônica **`COUNT DISTINCT email_normalizado` das solicitações `approved`** (não "lojas ativas"), sem plataforma nova de convites

### Requirement: WhatsApp opcional e rotulado

O sistema SHALL exibir o campo WhatsApp como **opcional**, com rótulo explícito e explicação de que será usado **somente para contato sobre a solicitação**, **sem vínculo** ao consentimento de marketing (`commercial_communications`).

#### Scenario: WhatsApp rotulado como opcional

- **WHEN** o formulário de solicitação de acesso é renderizado
- **THEN** o WhatsApp é marcado como opcional e explica a finalidade (contato sobre a solicitação)

#### Scenario: WhatsApp sem consentimento de marketing implícito

- **WHEN** o visitante informa o WhatsApp
- **THEN** nenhum consentimento de marketing é inferido ou vinculado

### Requirement: Aviso de privacidade versionado

O sistema SHALL exibir aviso de privacidade e links para os documentos aplicáveis no formulário, e **registrar de forma auditável a versão do aviso apresentada** (ex.: `privacy_notice_version` em `access_requests`).

#### Scenario: Versão do aviso registrada

- **WHEN** uma solicitação de acesso é criada
- **THEN** `privacy_notice_version` é gravada com a versão exibida

### Requirement: Descarte do WhatsApp

O sistema SHALL **remover/anonimizar o WhatsApp** quando terminar sua necessidade operacional (solicitação concluída/recusada), conforme a retenção definida (D21).

#### Scenario: WhatsApp descartado ao fim da necessidade

- **WHEN** a solicitação é concluída/recusada e a retenção expira
- **THEN** o WhatsApp é removido/anonimizado

### Requirement: Anti-enumeração e idempotência preservadas

O sistema SHALL preservar o índice único `uq_access_requests_email_active` e a resposta idêntica para solicitações novas/duplicadas.

#### Scenario: Duplicata não é revelada

- **WHEN** o mesmo email solicita novamente com status `pending`/`approved`
- **THEN** a resposta é idêntica à de sucesso (não revela existência)
