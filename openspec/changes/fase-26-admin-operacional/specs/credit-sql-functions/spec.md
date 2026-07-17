## ADDED Requirements

### Requirement: admin_grant_credits SQL function

O sistema SHALL criar a SQL function `public.admin_grant_credits(p_actor_id UUID, p_store_id UUID, p_amount INTEGER, p_reason TEXT, p_operation_id UUID, p_metadata JSONB DEFAULT '{}'::jsonb) RETURNS JSONB`.

- Combina `grant_credits` + INSERT em `admin_audit_log` na mesma transação
- Idempotência via `operation_id`: SELECT existente → se encontrado, retorna sem executar
- IdempotencyKey do grant: `'admin_grant_' || p_operation_id`
- SECURITY DEFINER com SET search_path = ''
- Se qualquer passo falhar → ROLLBACK (atomicidade real)

#### Scenario: admin_grant_credits creates transaction and audit entry

- **WHEN** `admin_grant_credits(uuid, uuid, 10, 'crédito beta', gen_random_uuid())` é chamado
- **THEN** executa `grant_credits` criando transação em `credit_transactions`
- **AND** insere entry em `admin_audit_log` com `action='credit_grant'`
- **AND** retorna JSON com `{ transaction_id, audit_id }`

#### Scenario: admin_grant_credits returns existing data on duplicate operation_id

- **WHEN** `admin_grant_credits` é chamado duas vezes com mesmo `p_operation_id`
- **THEN** segunda chamada retorna mesmo `transaction_id` e `audit_id`
- **AND** não executa novo grant nem INSERT

#### Scenario: admin_grant_credits rollback on failure

- **WHEN** `grant_credits` falha (ex.: store inexistente)
- **THEN** nenhuma entry em `admin_audit_log` é criada
- **AND** exceção é propagada
