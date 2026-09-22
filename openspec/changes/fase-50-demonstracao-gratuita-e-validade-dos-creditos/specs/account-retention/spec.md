# Account Retention

> Capability nova (ADDED) pela `fase-50-demonstracao-gratuita-e-validade-dos-creditos` (D21). Ciclo de vida da conta e retenção de dados durante o beta: conta ativa, encerramento com janela de 30 dias, retenção/anonimização e distinção de uploads temporários.

## ADDED Requirements

### Requirement: Conta permanece ativa sem saldo/atividade

O sistema SHALL manter a conta ativa e **não apagar automaticamente** produtos, imagens, campanhas, histórico ou downloads por inatividade durante o beta. Cancelamento comercial (quando existir) **não** equivale a encerramento de conta.

#### Scenario: Sem exclusão automática por inatividade

- **WHEN** uma conta fica inativa ou sem saldo durante o beta
- **THEN** produtos/imagens/campanhas/histórico/downloads permanecem preservados

### Requirement: Registro canônico e auditável de pedidos (data_subject_requests)

O sistema SHALL criar `data_subject_requests` com: `id`, `protocol` (legível), `operation_id UUID UNIQUE` (idempotência), `type` (∈ `access`/`export`/`correction`/`deletion`/`closure`), `user_id`, `store_id`, `contact` (email/telefone do solicitante), `details` (detalhes mínimos do pedido), `status` (∈ `received`/`in_progress`/`completed`/`cancelled`), `requested_at`, `acknowledged_at`, `due_at` (**nullable** até os prazos jurídicos serem aprovados), `completed_at`, `cancelled_at`, `closure_requested_at`, `deletion_due_at`, `deletion_inventory` (evidência do inventário de exclusão), `legal_hold` (bool). RLS/grants: escrita/leitura via service_role; o owner pode ler os próprios pedidos. Índices: `operation_id` (único), `user_id`, `store_id`.

#### Scenario: Registro completo e idempotente

- **WHEN** um pedido de titular é registrado
- **THEN** `operation_id`/`protocol`/`type`/`user_id`/`store_id`/`contact`/`details`/`requested_at` são gravados
- **AND** repetição com o mesmo `operation_id` não duplica

#### Scenario: due_at nullable até aprovação dos prazos

- **WHEN** os prazos jurídicos ainda não foram aprovados
- **THEN** `due_at` permanece `NULL` (não codifica prazo unilateralmente)

#### Scenario: Evidência do inventário de exclusão e legal hold

- **WHEN** a exclusão/anonimização é executada
- **THEN** `deletion_inventory` registra o que foi exportado/excluído/anonimizado
- **AND** `legal_hold` preserva a retenção legal mínima segregada quando aplicável

### Requirement: Superfície administrativa de pedidos de titular

O sistema SHALL prover **página/endpoint admin** (`GET/POST /api/admin/data-subject-requests`, `requireAdmin`) para **registrar e concluir** pedidos recebidos por email, com **auditoria** (`admin_audit_log`), mais um **runbook manual** para a execução (exportar/excluir/anonimizar + objetos do storage).

#### Scenario: Admin registra e conclui pedidos

- **WHEN** o suporte recebe um pedido por email
- **THEN** registra em `data_subject_requests` via admin (com auditoria) e conclui com `completed_at`

#### Scenario: Owner vê os próprios pedidos

- **WHEN** o titular consulta seus pedidos
- **THEN** vê apenas os próprios (`user_id`/`store_id` via RLS)

### Requirement: Encerramento com janela de 30 dias (procedimento verificável)

O sistema SHALL registrar o encerramento solicitado em `data_subject_requests` (tipo `closure`) com `closure_requested_at`, `deletion_due_at` (30 dias), **inventário** do que exportar/excluir/anonimizar, **exclusão dos objetos do storage** e **registro de conclusão**. **Marco de início da exclusão:** para pedidos `closure`/`deletion`, a transição `received → in_progress` **significa que a exclusão começou**. **Cancelamento permitido somente enquanto `status = received`**; após `in_progress`, é **rejeitado**. Toda tentativa de cancelamento e transição é **auditada**. A janela é de **30 dias**; depois, os dados operacionais são excluídos/anonimizados, preservando a retenção legal mínima segregada.

#### Scenario: Cancelamento permitido apenas em received

- **WHEN** o titular solicita o cancelamento do encerramento
- **THEN** é permitido somente enquanto `status = received` (marca `cancelled` + `cancelled_at`)
- **AND** após `in_progress` (exclusão iniciada), a tentativa é **rejeitada e auditada**

#### Scenario: Transição para in_progress marca o início da exclusão

- **WHEN** a exclusão começa
- **THEN** `status` passa a `in_progress` (marco registrado do início da exclusão)
- **AND** cancelamento posterior é bloqueado

#### Scenario: Janela de 30 dias com timestamps registrados

- **WHEN** o titular solicita encerramento
- **THEN** `closure_requested_at` e `deletion_due_at` (30 dias) são registrados
- **AND** há 30 dias para recuperação/exportação, com possibilidade de cancelamento do pedido

#### Scenario: Exclusão registrada e concluída

- **WHEN** a janela expira
- **THEN** o runbook executa a exclusão/anonimização (incluindo objetos do storage) e registra `completed_at` (conclusão verificável)

### Requirement: Direitos via suporte com protocolo

O sistema SHALL atender, durante o beta, pedidos de acesso, exportação, correção e exclusão **via suporte com protocolo**, registrados em `data_subject_requests`, **sem prometer autosserviço**. `support_credit_requests` **não** é usada para pedidos LGPD/encerramento.

#### Scenario: Sem promessa de autosserviço

- **WHEN** o titular pede exportação/correção/exclusão
- **THEN** o suporte processa com protocolo (autosserviço completo é posterior)

### Requirement: Uploads temporários/órfãos distintos de ativos salvos

O sistema SHALL diferenciar **ativos salvos** de **uploads temporários/órfãos**, com limpeza técnica própria e documentada.

#### Scenario: Órfãos têm limpeza própria

- **WHEN** há uploads temporários/órfãos
- **THEN** a limpeza técnica é documentada e não atinge ativos salvos do usuário

### Requirement: Minimização/retenção/anonimização

O sistema SHALL definir minimização, retenção e anonimização de `product_events`, `credit_notifications`, `support_credit_requests` e `data_subject_requests`; os **prazos jurídicos** são confirmados pelo advogado (não codificados unilateralmente).

#### Scenario: Prazos confirmados pelo advogado

- **WHEN** a retenção é definida
- **THEN** os prazos de `product_events`/`credit_notifications`/`support_credit_requests`/`data_subject_requests` são validados juridicamente antes do go-live
