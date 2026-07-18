> Synced from `fase-26-admin-operacional` (ADDED).

## Purpose

Registrar ações administrativas de forma imutável (append-only) na tabela `admin_audit_log`. Toda concessão de crédito, criação de loja e outras ações sensíveis devem ter trilha de auditoria com ator, ação, alvo, motivo e metadados.

## Requirements

### Requirement: admin_audit_log table

O sistema SHALL criar a tabela `public.admin_audit_log` para registrar ações administrativas de forma imutável.

- `id UUID PK DEFAULT gen_random_uuid()`
- `actor_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE`
- `action TEXT NOT NULL` com CHECK constraint: `action IN ('credit_grant', 'credit_adjustment', 'store_create_invite', 'manual_refund')`
- `target_type TEXT NOT NULL` com CHECK constraint: `target_type IN ('store', 'user', 'campaign')`
- `target_id UUID NOT NULL`
- `reason TEXT NOT NULL`
- `operation_id UUID` — gerado pelo client, unique para idempotência
- `metadata JSONB DEFAULT '{}'::jsonb`
- `created_at TIMESTAMPTZ NOT NULL DEFAULT now()`
- RLS habilitado
- GRANT SELECT, INSERT apenas para `service_role`

#### Scenario: Audit log entry created with all required fields

- **WHEN** uma ação administrativa é registrada
- **THEN** a entry contém `actor_id`, `action`, `target_type`, `target_id`, `reason`, `operation_id`, `metadata`, `created_at`

### Requirement: admin_audit_log indexes

O sistema SHALL criar índices para consulta eficiente do audit log.

- `idx_admin_audit_log_actor` — `(actor_id, created_at DESC)`
- `idx_admin_audit_log_target` — `(target_type, target_id, created_at DESC)`
- `idx_admin_audit_log_operation` — UNIQUE index em `(operation_id) WHERE operation_id IS NOT NULL`

#### Scenario: Audit log queryable by actor

- **WHEN** consulta o audit log por `actor_id`
- **THEN** retorna entries ordenadas por `created_at DESC` usando o índice

#### Scenario: Audit log queryable by target

- **WHEN** consulta o audit log por `target_type` + `target_id`
- **THEN** retorna entries ordenadas por `created_at DESC`

#### Scenario: Duplicate operation_id prevented

- **WHEN** INSERT com `operation_id` já existente
- **THEN** viola unique index e retorna erro

### Requirement: Admin audit log is append-only

O sistema SHALL impedir UPDATE e DELETE na tabela `admin_audit_log` via trigger.

- Trigger `trg_admin_audit_log_immutable` BEFORE UPDATE OR DELETE
- Função que lança `RAISE EXCEPTION` impedindo mutações

#### Scenario: UPDATE on audit log raises exception

- **WHEN** tenta fazer UPDATE em `admin_audit_log`
- **THEN** trigger lança exceção e operação é rejeitada

#### Scenario: DELETE on audit log raises exception

- **WHEN** tenta fazer DELETE em `admin_audit_log`
- **THEN** trigger lança exceção e operação é rejeitada

### Requirement: Audit log GET endpoint

O sistema SHALL expor `GET /api/admin/audit-log` para consulta paginada do histórico.

- Requer `requireAdmin()`
- Parâmetros: `page`, `pageSize`, `actorId?`, `action?`, `targetType?`, `targetId?`
- Retorna `{ data: AdminAuditLogEntry[], total, page, pageSize }`
- Ordenação padrão: `created_at DESC`

#### Scenario: Admin fetches audit log paginated

- **WHEN** admin faz GET `/api/admin/audit-log?page=1&pageSize=20`
- **THEN** retorna lista paginada com entries ordenadas por data decrescente

#### Scenario: Unauthorized access to audit log returns 403

- **WHEN** usuário não admin faz GET `/api/admin/audit-log`
- **THEN** retorna 403

### Requirement: Admin audit log page UI

O sistema SHALL exibir `/admin/audit-log` com tabela do histórico de ações.

- Server Component com dados SSR
- Colunas: ator, ação, alvo (tipo + nome), motivo, data
- Paginação client-side
- Filtros por ação e tipo de alvo

#### Scenario: Admin views audit log page

- **WHEN** admin acessa `/admin/audit-log`
- **THEN** exibe tabela com histórico paginado de ações administrativas
