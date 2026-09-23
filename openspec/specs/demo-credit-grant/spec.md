# Demo Credit Grant

## Purpose

Conceder uma demonstração gratuita única por raiz de CNPJ, com 10 créditos e TTL de 168 horas, substituindo o onboarding contínuo.

## Requirements

### Requirement: Entitlement demo

O sistema SHALL aceitar `benefit_type='demo'` em `freemium_entitlements`, usando a unicidade existente por raiz e ciclo nulo.

#### Scenario: benefit_type demo aceito

- **WHEN** a migration é executada
- **THEN** `demo` é aceito e os tipos históricos permanecem aceitos

#### Scenario: Unicidade por raiz

- **WHEN** dois entitlements `demo` usam o mesmo `root_hash`
- **THEN** o segundo é rejeitado ou no-op por `ON CONFLICT DO NOTHING`

### Requirement: Elegibilidade

`checkDemoEligibility(rootHash)` SHALL retornar true somente sem `onboarding`, `demo` ou `admin_exception`; a loja com exceção anterior também é inelegível.

#### Scenario: Raiz nova é elegível

- **WHEN** não há entitlement na raiz
- **THEN** retorna `true`

#### Scenario: Benefício anterior bloqueia

- **WHEN** existe onboarding, demo ou admin_exception na raiz/loja
- **THEN** retorna `false` e a RPC retorna `admin_exception_consumed` para exceção anterior

### Requirement: RPC grant_demo_credits

O sistema SHALL prover `public.grant_demo_credits(p_store_id UUID, p_root_hash TEXT, p_amount INTEGER, p_demo_grant_enabled BOOLEAN, p_ttl_hours INTEGER DEFAULT 168, p_idempotency_key TEXT DEFAULT NULL, p_granted_by UUID DEFAULT NULL) RETURNS JSONB`, SECURITY DEFINER com `search_path=''`, restrita a service role, com flag obrigatória posicionada antes dos defaults, idempotência, entitlement antes do grant, transação `demo`, TTL, ciclo, auditoria e motivos `disabled`, `amount_invalido`, `onboarding_consumed` e `already_granted`.

#### Scenario: Flag desligada não cria entitlement órfão

- **WHEN** `p_demo_grant_enabled=false`
- **THEN** retorna `disabled` sem entitlement ou transação

#### Scenario: Amount inválido é rejeitado

- **WHEN** `p_amount <= 0`
- **THEN** retorna `amount_invalido`

#### Scenario: Onboarding é verificado antes do INSERT

- **WHEN** a raiz possui onboarding
- **THEN** retorna `onboarding_consumed` sem entitlement demo nem transação

#### Scenario: Auditoria opcional do grant

- **WHEN** `p_granted_by` é informado e o grant ocorre
- **THEN** registra `credit_grant` com `grant_type='demo'`

#### Scenario: Primeira concessão

- **WHEN** raiz elegível recebe 10 créditos com flag ativa
- **THEN** entitlement e transação demo são criados, saldo demo incrementa e expira em 168h

#### Scenario: Retry e concorrência

- **WHEN** a RPC é chamada novamente ou concorrentemente para a mesma raiz
- **THEN** somente uma concessão existe

### Requirement: Substituição do onboarding

`create_store_with_cnpj`, `admin_approve_store_verification` e `update_store_cnpj` SHALL usar a demonstração quando aprovados e elegíveis. `admin_exception_store_verification` permanece bônus admin não expirável.

#### Scenario: Draft aprovado recebe demo

- **WHEN** draft informa CNPJ, torna-se approved e é elegível
- **THEN** recebe a demonstração e a raiz não é bloqueada definitivamente

#### Scenario: Benefício legado bloqueia demo

- **WHEN** a raiz tem onboarding legado
- **THEN** cria apenas marcador legado, sem nova transação demo
