> Synced from `fase-32-freemium-anti-abuso-cnpj` (ADDED).

## Purpose

Tabela `freemium_entitlements` com controle de benefício por raiz de CNPJ, idempotência via INSERT ... ON CONFLICT, onboarding e monthly grant condicionados à raiz, histórico de entitlements.

## Requirements

### Requirement: store_id usa ON DELETE SET NULL — antifraude

O sistema SHALL usar `ON DELETE SET NULL` em `freemium_entitlements.store_id`. Se uma loja for deletada, o entitlement permanece como registro histórico — a raiz não pode reivindicar novo onboarding simplesmente por deletar a loja original.

#### Scenario: Loja deletada → entitlement permanece, raiz não recebe novo grant

- **WHEN** uma loja que recebeu onboarding é deletada
- **THEN** `freemium_entitlements.store_id` fica NULL
- **AND** o entitlement `onboarding` com `root_hash` correspondente permanece
- **AND** uma nova loja com mesma raiz de CNPJ NÃO recebe onboarding grant

### Requirement: Tabela freemium_entitlements

O sistema SHALL criar a tabela `public.freemium_entitlements` com:

```sql
id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID REFERENCES public.stores(id) ON DELETE SET NULL,
root_hash TEXT NOT NULL,
benefit_type TEXT NOT NULL CHECK (benefit_type IN ('onboarding', 'monthly', 'admin_exception')),
cycle TEXT,
grant_transaction_id UUID REFERENCES public.credit_transactions(id) ON DELETE SET NULL,
granted_by UUID REFERENCES auth.users(id),
reason TEXT,
created_at TIMESTAMPTZ NOT NULL DEFAULT now()
```

RLS habilitado. Índice único `idx_freemium_entitlements_key (root_hash, benefit_type, COALESCE(cycle, '_nostring_'))` para idempotência.

#### Scenario: Tabela existe com todas as colunas e constraints

- **WHEN** a migration é executada
- **THEN** `freemium_entitlements` existe com colunas, CHECK, FK e índices

### Requirement: Entitlement-first com INSERT ... ON CONFLICT DO NOTHING

O sistema SHALL usar INSERT ... ON CONFLICT DO NOTHING como mecanismo de idempotência. O grant de créditos só acontece se o INSERT do entitlement retornou id.

#### Scenario: INSERT vence → grant concedido

- **WHEN** INSERT em `freemium_entitlements` retorna id (primeira vez da raiz)
- **THEN** `grant_credits` é chamado
- **AND** `grant_transaction_id` é vinculado

#### Scenario: INSERT não vence (raiz já usou) → sem grant

- **WHEN** INSERT em `freemium_entitlements` não retorna id (ON CONFLICT DO NOTHING)
- **THEN** `grant_credits` NÃO é chamado

### Requirement: checkOnboardingEligibility(rootHash)

O sistema SHALL prover `checkOnboardingEligibility(rootHash: string): boolean` que retorna true se a raiz não tem entitlement `onboarding`.

#### Scenario: Raiz nova → elegível

- **WHEN** `checkOnboardingEligibility("hash_nova")` é chamado
- **THEN** retorna true

#### Scenario: Raiz já usou onboarding → não elegível

- **WHEN** `checkOnboardingEligibility("hash_existente")` é chamado
- **AND** existe entitlement `onboarding` para esta raiz
- **THEN** retorna false

### Requirement: grantOnboardingEntitlement(storeId, rootHash, txId?)

O sistema SHALL prover `grantOnboardingEntitlement` que insere entitlement `onboarding` com INSERT ... ON CONFLICT DO NOTHING e retorna o UUID do entitlement ou null se já existia.

#### Scenario: Insert com idempotência

- **WHEN** `grantOnboardingEntitlement` é chamado pela primeira vez
- **THEN** insere e retorna UUID
- **WHEN** chamado novamente com mesmos parâmetros
- **THEN** retorna null (sem duplicação)

### Requirement: checkMonthlyEligibility(rootHash, cycle)

O sistema SHALL prover `checkMonthlyEligibility(rootHash, cycle)` que retorna true se a raiz não tem entitlement `monthly` no ciclo.

#### Scenario: Sem grant no ciclo → elegível

- **WHEN** `checkMonthlyEligibility("hash", "2026-08")` é chamado sem entitlement prévio
- **THEN** retorna true

#### Scenario: Já recebeu no ciclo → não elegível

- **WHEN** `checkMonthlyEligibility("hash", "2026-08")` é chamado com entitlement existente
- **THEN** retorna false

### Requirement: grantMonthlyEntitlement(storeId, rootHash, cycle, txId?)

O sistema SHALL prover `grantMonthlyEntitlement` que insere entitlement `monthly` com INSERT ... ON CONFLICT DO NOTHING.

#### Scenario: Insert mensal com idempotência

- **WHEN** `grantMonthlyEntitlement` é chamado pela primeira vez
- **THEN** insere e retorna UUID
- **WHEN** chamado novamente
- **THEN** retorna null

### Requirement: getHistoryByStore(storeId) e getHistoryByRoot(rootHash)

O sistema SHALL prover funções para consultar histórico de entitlements por loja e por raiz.

#### Scenario: Histórico por loja

- **WHEN** `getHistoryByStore("store-id")` é chamado
- **THEN** retorna todos os entitlements da loja ordenados por `created_at DESC`

#### Scenario: Histórico por raiz

- **WHEN** `getHistoryByRoot("hash")` é chamado
- **THEN** retorna todos os entitlements da raiz, agregando por root_hash
