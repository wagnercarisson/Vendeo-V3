> Synced from `fase-26-admin-operacional` (ADDED), then `fase-29-3-creditos-mensais-automaticos` (MODIFIED). `admin_grant_credits` agora chama `grant_credits` com `p_type = 'admin_grant'` (direciona ao `bonus_balance`). Audit log metadata inclui `grant_type: 'admin_grant'`. Response `newBalance` reflete `balance` total (soma dos buckets).

## Purpose

Permitir que administradores concedam créditos manuais a lojistas com motivo obrigatório, idempotência via `operationId` e audit trail atômico na mesma transação (RPC `admin_grant_credits`). Créditos concedidos via admin direcionam ao `bonus_balance` e **contam para o limiar de elegibilidade do grant mensal** (a raiz recebe grant integral enquanto `bonus_balance < monthlyBonusCap`; em ou acima, não recebe no ciclo).

## Requirements

### Requirement: admin_grant_credits RPC function (MODIFIED F29.3)

**F29.3 Changes**: `admin_grant_credits` agora chama `grant_credits` com `p_type = 'admin_grant'` (explícito). O grant direciona para `bonus_balance` e **conta para o limiar de elegibilidade do grant mensal** (`bonus_balance < monthlyBonusCap`). O parâmetro `p_type` default no `grant_credits` já é `'admin_grant'`, então chamadores existentes continuam funcionando sem alteração.

O sistema SHALL manter a SQL function `public.admin_grant_credits(p_actor_id UUID, p_store_id UUID, p_amount INTEGER, p_reason TEXT, p_operation_id UUID, p_metadata JSONB DEFAULT '{}'::jsonb) RETURNS JSONB`.

- Passo 1: Idempotência — SELECT `operation_id` existente em `admin_audit_log`. Se encontrado, retorna dados sem executar nada
- Passo 2: Chama `public.grant_credits(p_store_id, p_amount, p_reason, 'admin_grant_' || p_operation_id, p_metadata)` — o `p_type` default (`admin_grant`) direciona ao `bonus_balance`
- Passo 3: INSERT em `admin_audit_log` com `action='credit_grant'`, metadata incluindo `amount, transaction_id, grant_type: 'admin_grant'`
- Passo 4: Se qualquer passo falhar → ROLLBACK
- SECURITY DEFINER com SET search_path = ''

#### Scenario: admin_grant_credits increments bonus_balance

- **WHEN** `admin_grant_credits` é chamado com parâmetros válidos
- **THEN** executa `grant_credits` com `p_type = 'admin_grant'`
- **AND** incrementa `bonus_balance` (não `purchased_balance`)
- **AND** insere entry em `admin_audit_log` com `action='credit_grant'`
- **AND** retorna JSON com `transaction_id` e `audit_id`

#### Scenario: admin_grant_credits idempotent on retry

- **WHEN** `admin_grant_credits` é chamado duas vezes com mesmo `p_operation_id`
- **THEN** a segunda chamada retorna dados da primeira sem executar grant nem INSERT audit log

#### Scenario: admin_grant_credits rollback on grant failure

- **WHEN** `grant_credits` lança exceção (ex.: store não existe)
- **THEN** nenhum INSERT em `admin_audit_log` é feito (ROLLBACK desfaz tudo)

### Requirement: POST /api/admin/credits/grant (MODIFIED F29.3)

**F29.3 Changes**: O handler continua chamando `admin_grant_credits` sem alteração na API. O response `newBalance` agora reflete o `balance` total (soma dos buckets), consistente com o comportamento existente.

O sistema SHALL manter a rota `POST /api/admin/credits/grant` com a mesma assinatura de request. O `newBalance` retornado SHALL refletir o `balance` total (`bonus_balance + purchased_balance`).

- Requer `requireAdmin()`
- Valida body com `GrantCreditsRequestSchema` (Zod)
- Chama RPC `admin_grant_credits`
- Retorna `{ transaction_id, audit_id, idempotent, newBalance }`

#### Scenario: Admin grant reflects in total balance

- **WHEN** admin POST `/api/admin/credits/grant` com `{ storeId, amount: 50, reason: "Crédito promocional", operationId }`
- **THEN** retorna 200 com `{ transaction_id, audit_id, newBalance }`
- **AND** `bonus_balance` da loja é incrementado em 50
- **AND** `balance` total reflete `bonus_balance + purchased_balance`
- **AND** audit log registra a ação com `grant_type: 'admin_grant'`

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

### Requirement: Admin monthly credit grant button (ADDED F29.3)

O sistema SHALL prover um botão "Executar concessão mensal" na página de admin, protegido por `requireAdmin`, que chama `POST /api/admin/monthly-credits/grant` para execução manual da RPC `grant_monthly_credits`.

#### Scenario: Admin can manually trigger monthly grant

- **WHEN** admin autenticado clica em "Executar concessão mensal"
- **THEN** faz POST para `/api/admin/monthly-credits/grant`
- **AND** executa `grant_monthly_credits` com parâmetros do Launch Config
- **AND** retorna resultado com contagens `{ eligible, granted, skipped, errors }`

#### Scenario: Non-admin cannot trigger monthly grant

- **WHEN** usuário não admin tenta POST `/api/admin/monthly-credits/grant`
- **THEN** retorna 403
