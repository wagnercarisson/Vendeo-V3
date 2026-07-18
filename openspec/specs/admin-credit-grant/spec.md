> Synced from `fase-26-admin-operacional` (ADDED).

## Purpose

Permitir que administradores concedam créditos manuais a lojistas com motivo obrigatório, idempotência via `operationId` e audit trail atômico na mesma transação (RPC `admin_grant_credits`).

## Requirements

### Requirement: admin_grant_credits RPC function

O sistema SHALL criar a SQL function `public.admin_grant_credits(p_actor_id UUID, p_store_id UUID, p_amount INTEGER, p_reason TEXT, p_operation_id UUID, p_metadata JSONB DEFAULT '{}'::jsonb) RETURNS JSONB`.

A função SHALL ser atômica — grant + audit log na mesma transação.

- Passo 1: Idempotência — SELECT `operation_id` existente em `admin_audit_log`. Se encontrado, retorna dados sem executar nada
- Passo 2: Chama `public.grant_credits(p_store_id, p_amount, p_reason, 'admin_grant_' || p_operation_id, p_metadata)` e captura transaction_id
- Passo 3: INSERT em `admin_audit_log` com actor_id, action='credit_grant', target_type='store', target_id=p_store_id, reason=p_reason, operation_id=p_operation_id, metadata={amount, transaction_id}
- Passo 4: Se qualquer passo falhar → ROLLBACK
- SECURITY DEFINER com SET search_path = ''

#### Scenario: admin_grant_credits creates grant + audit log

- **WHEN** `admin_grant_credits` é chamado com parâmetros válidos
- **THEN** executa `grant_credits` que insere transação em `credit_transactions`
- **AND** insere entry em `admin_audit_log` com `action='credit_grant'`
- **AND** retorna JSON com `transaction_id` e `audit_id`

#### Scenario: admin_grant_credits idempotent on retry

- **WHEN** `admin_grant_credits` é chamado duas vezes com mesmo `p_operation_id`
- **THEN** a segunda chamada retorna dados da primeira sem executar grant nem INSERT audit log

#### Scenario: admin_grant_credits rollback on grant failure

- **WHEN** `grant_credits` lança exceção (ex.: store não existe)
- **THEN** nenhum INSERT em `admin_audit_log` é feito (ROLLBACK desfaz tudo)

### Requirement: POST /api/admin/credits/grant

O sistema SHALL expor `POST /api/admin/credits/grant` para concessão manual de créditos.

- Requer `requireAdmin()`
- Valida body com `GrantCreditsRequestSchema` (Zod)
- Chama RPC `admin_grant_credits`
- Retorna `{ transaction_id, audit_id, newBalance }`

#### Scenario: Admin grants credits successfully

- **WHEN** admin POST `/api/admin/credits/grant` com `{ storeId, amount: 50, reason: "Crédito promocional para teste beta", operationId }`
- **THEN** retorna 200 com `{ transaction_id, audit_id, newBalance }`
- **AND** saldo da loja é incrementado em 50
- **AND** audit log registra a ação

#### Scenario: Grant with malformed storeId returns 400

- **WHEN** admin POST `/api/admin/credits/grant` com `storeId` que não é UUID válido
- **THEN** retorna 400 (erro de validação Zod)

#### Scenario: Grant with valid but non-existent storeId returns 404

- **WHEN** admin POST `/api/admin/credits/grant` com `storeId` UUID válido mas loja não existe
- **THEN** retorna 404

#### Scenario: Grant with non-positive amount returns 400

- **WHEN** admin POST `/api/admin/credits/grant` com `amount <= 0`
- **THEN** retorna 400

#### Scenario: Grant with short reason returns 400

- **WHEN** admin POST `/api/admin/credits/grant` com `reason` < 10 caracteres
- **THEN** retorna 400

#### Scenario: Grant without auth returns 401

- **WHEN** usuário não autenticado POST `/api/admin/credits/grant`
- **THEN** retorna 401

#### Scenario: Grant by non-admin returns 403

- **WHEN** usuário não admin POST `/api/admin/credits/grant`
- **THEN** retorna 403

### Requirement: GrantCreditsRequestSchema (Zod)

O sistema SHALL definir e usar o schema `GrantCreditsRequestSchema` para validação do body do grant.

```typescript
export const GrantCreditsRequestSchema = z.object({
  storeId: z.string().uuid(),
  amount: z.number().int().positive("Amount deve ser maior que zero"),
  reason: z.string().min(10, "Motivo deve ter no mínimo 10 caracteres").max(500),
  operationId: z.string().uuid(),
});
```

#### Scenario: Request validation rejects missing fields

- **WHEN** POST `/api/admin/credits/grant` sem campo obrigatório
- **THEN** retorna 400 com erro de validação Zod

### Requirement: Grant form UI

O sistema SHALL exibir formulário de concessão de créditos na página `/admin/users/[id]`.

- Client Component inline
- Campos: storeId (hidden, pré-preenchido com o storeId carregado dos dados da loja do usuário), amount (number input), reason (textarea, min 10 chars)
- operationId gerado automaticamente como UUID no client
- Botão "Conceder créditos" com estado de loading
- Confirmação visual: mostra store name antes de confirmar
- Toast de sucesso com novo saldo após grant
- Se `storeId` for null (usuário sem loja), formulário desabilitado com mensagem "Usuário não possui loja. Crie uma loja primeiro."

#### Scenario: Admin grants credits via UI form

- **WHEN** admin preenche amount + reason e clica em "Conceder créditos"
- **THEN** faz POST para `/api/admin/credits/grant` com `storeId` obtido dos dados da loja do usuário (não da URL)
- **AND** exibe toast de sucesso com novo saldo

#### Scenario: Grant form disabled when user has no store

- **WHEN** admin acessa `/admin/users/[id]` e usuário não possui loja (`storeId = null`)
- **THEN** formulário de grant é exibido desabilitado com mensagem orientativa
- **AND** admin vê botão/badge para criar loja para o usuário
