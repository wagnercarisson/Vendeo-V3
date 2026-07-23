## MODIFIED Requirements

### Requirement: admin_grant_credits RPC function

**Changes**: `admin_grant_credits` agora chama `grant_credits` com `p_type = 'admin_grant'` (explícito). O grant direciona para `bonus_balance` e conta para o `monthlyBonusCap`. O parâmetro `p_type` default no `grant_credits` já é `'admin_grant'`, então chamadores existentes continuam funcionando sem alteração.

O sistema SHALL manter a SQL function `public.admin_grant_credits(p_actor_id UUID, p_store_id UUID, p_amount INTEGER, p_reason TEXT, p_operation_id UUID, p_metadata JSONB DEFAULT '{}'::jsonb) RETURNS JSONB`.

- Passo 1: Idempotência — SELECT `operation_id` existente em `admin_audit_log`. Se encontrado, retorna dados sem executar nada
- Passo 2: Chama `public.grant_credits(p_store_id, p_amount, p_reason, 'admin_grant_' || p_operation_id, p_metadata)` — o `p_type` default (`admin_grant`) direciona ao `bonus_balance`
- Passo 3: INSERT em `admin_audit_log` com `action='credit_grant'`, metadata incluindo `amount, transaction_id, grant_type: 'admin_grant'`
- SECURITY DEFINER com SET search_path = ''

#### Scenario: admin_grant_credits increments bonus_balance

- **WHEN** `admin_grant_credits` é chamado com parâmetros válidos
- **THEN** executa `grant_credits` com `p_type = 'admin_grant'`
- **AND** incrementa `bonus_balance` (não `purchased_balance`)
- **AND** insere entry em `admin_audit_log` com `action='credit_grant'`
- **AND** retorna JSON com `transaction_id` e `audit_id`

### Requirement: POST /api/admin/credits/grant

**Changes**: O handler continua chamando `admin_grant_credits` sem alteração na API. O response `newBalance` agora reflete o `balance` total (soma dos buckets), consistente com o comportamento existente.

O sistema SHALL manter a rota `POST /api/admin/credits/grant` com a mesma assinatura de request. O `newBalance` retornado SHALL refletir o `balance` total (`bonus_balance + purchased_balance`).

#### Scenario: Admin grant reflects in total balance

- **WHEN** admin POST `/api/admin/credits/grant` com `{ storeId, amount: 50, reason: "Crédito promocional para teste beta", operationId }`
- **THEN** retorna 200 com `{ transaction_id, audit_id, newBalance }`
- **AND** `bonus_balance` da loja é incrementado em 50
- **AND** `balance` total reflete `bonus_balance + purchased_balance`
- **AND** audit log registra a ação com `grant_type: 'admin_grant'`
