# Account Retention

## Purpose

Definir o ciclo de vida da conta, a retenção de dados e o atendimento de direitos do titular durante o beta.

## Requirements

### Requirement: Conta permanece ativa sem saldo/atividade

O sistema SHALL manter a conta ativa e não apagar automaticamente produtos, imagens, campanhas, histórico ou downloads por inatividade durante o beta. Cancelamento comercial não equivale a encerramento de conta.

#### Scenario: Sem exclusão automática por inatividade

- **WHEN** uma conta fica inativa ou sem saldo durante o beta
- **THEN** produtos, imagens, campanhas, histórico e downloads permanecem preservados

### Requirement: Registro canônico e auditável de pedidos

O sistema SHALL criar `data_subject_requests` com `id`, `protocol` legível, `operation_id UUID UNIQUE`, tipos `access`, `export`, `correction`, `deletion` e `closure`, `user_id`, `store_id`, `contact`, `details`, status `received`/`in_progress`/`completed`/`cancelled`, `requested_at`, `acknowledged_at`, `due_at`, `completed_at`, `cancelled_at`, `closure_requested_at`, `deletion_due_at`, `deletion_inventory` e `legal_hold`. `due_at` SHALL permanecer nullable até aprovação jurídica. Escrita/leitura são via service role e o owner lê apenas os próprios pedidos. Índices existem em `operation_id`, `user_id` e `store_id`.

#### Scenario: Registro completo e idempotente

- **WHEN** um pedido de titular é registrado
- **THEN** seus dados essenciais são gravados e repetir o `operation_id` não duplica
- **AND** `protocol`, tipo, identidade, contato, detalhes e `requested_at` são persistidos

#### Scenario: due_at nullable até aprovação dos prazos

- **WHEN** os prazos jurídicos ainda não foram aprovados
- **THEN** `due_at` permanece `NULL`

#### Scenario: Evidência do inventário e legal hold

- **WHEN** exclusão ou anonimização é executada
- **THEN** `deletion_inventory` registra a operação e `legal_hold` preserva retenção legal segregada quando aplicável

### Requirement: Superfície administrativa de pedidos de titular

O sistema SHALL prover `GET/POST /api/admin/data-subject-requests`, protegido por `requireAdmin`, com auditoria e runbook manual para exportar, excluir, anonimizar e remover objetos do storage.

#### Scenario: Admin registra e conclui pedidos

- **WHEN** o suporte recebe um pedido por email
- **THEN** registra e conclui o pedido via admin com auditoria

#### Scenario: Owner vê os próprios pedidos

- **WHEN** o titular consulta seus pedidos
- **THEN** vê apenas pedidos próprios via RLS

### Requirement: Encerramento com janela de 30 dias

O sistema SHALL registrar encerramento como `closure`, com janela de 30 dias, inventário, exclusão/anonimização de dados operacionais e objetos de storage, conclusão verificável e retenção legal mínima segregada. A transição `received` para `in_progress` inicia a exclusão; cancelamento só é permitido em `received`, e tentativas são auditadas.

#### Scenario: Cancelamento permitido apenas em received

- **WHEN** o titular cancela o encerramento
- **THEN** é permitido apenas em `received`; após `in_progress` é rejeitado e auditado

#### Scenario: Transição marca início da exclusão

- **WHEN** a exclusão começa
- **THEN** o status passa a `in_progress` e bloqueia cancelamento posterior

#### Scenario: Janela de 30 dias

- **WHEN** o titular solicita encerramento
- **THEN** `closure_requested_at` e `deletion_due_at` são registrados com 30 dias

#### Scenario: Exclusão registrada e concluída

- **WHEN** a janela expira
- **THEN** o runbook executa a exclusão/anonimização e registra `completed_at`

### Requirement: Direitos via suporte com protocolo

O sistema SHALL atender acesso, exportação, correção e exclusão via suporte com protocolo, sem prometer autosserviço completo durante o beta. `support_credit_requests` não é usado para pedidos LGPD/encerramento.

#### Scenario: Sem promessa de autosserviço

- **WHEN** o titular pede exportação, correção ou exclusão
- **THEN** o suporte processa com protocolo

### Requirement: Uploads temporários distintos de ativos salvos

O sistema SHALL diferenciar ativos salvos de uploads temporários/órfãos e documentar limpeza técnica própria que não atinja ativos salvos.

#### Scenario: Órfãos têm limpeza própria

- **WHEN** há uploads temporários ou órfãos
- **THEN** a limpeza técnica documentada não atinge ativos salvos

### Requirement: Minimização, retenção e anonimização

O sistema SHALL definir minimização, retenção e anonimização de `product_events`, `credit_notifications`, `support_credit_requests` e `data_subject_requests`; prazos jurídicos devem ser confirmados pelo advogado.

#### Scenario: Prazos confirmados pelo advogado

- **WHEN** a retenção é definida
- **THEN** os prazos são validados juridicamente antes do go-live
