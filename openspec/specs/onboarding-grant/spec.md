# Onboarding Grant

> Synced from `fase-25-integracao-transacional-pipeline` (ADDED).

## Purpose

Concessão automática de 10 créditos no onboarding (criação da loja), com atomicidade transacional e idempotência.

## Requirements

### Requirement: Onboarding grant condicionado à raiz do CNPJ (MODIFICADO F32)

O sistema SHALL substituir `bonus_onboarding` por demonstração `type='demo'` de 10 créditos e TTL 168h nos pontos aprovados (`create_store_with_cnpj`, `admin_approve_store_verification` e `update_store_cnpj`), condicionada a ausência de `onboarding`, `demo` e `admin_exception` e à flag de demonstração. `admin_exception_store_verification` permanece bônus admin não-expirável.

- A RPC `create_store_with_cnpj()` substitui `create_store_with_legal_acceptance()`
- O `cnpj_root_hash` é calculado na rota Next.js via `hashCnpjRoot(cnpj_normalized[:8])` com `process.env.CNPJ_PEPPER` — nunca exposto ao client
- A RPC recebe `p_cnpj_root_hash` já calculado (não calcula hash internamente)
- O grant é condicionado a `v_entitlement_id IS NOT NULL` após INSERT ... ON CONFLICT DO NOTHING
- Lojas legadas (atualização cadastral) NÃO recebem grant
- A resposta inclui `onboardingGranted: boolean` para o frontend informar o lojista

#### Scenario: Store criada com raiz nova → 10 créditos

- **WHEN** loja é criada com CNPJ cuja raiz nunca usou freemium
- **THEN** `freemium_entitlements` recebe `onboarding` para a raiz
- **AND** 10 créditos são concedidos via `grant_credits`
- **AND** `onboardingGranted` é `true`

#### Scenario: Store criada com raiz já usada → 0 créditos

- **WHEN** loja é criada com CNPJ cuja raiz já tem entitlement `onboarding`
- **THEN** NENHUM crédito é concedido
- **AND** `onboardingGranted` é `false`

#### Scenario: Loja draft aprovada recebe demonstração

- **WHEN** `update_store_cnpj` aprova loja draft elegível com flag ativa
- **THEN** concede demo e não bloqueia definitivamente a raiz

#### Scenario: Benefício legado bloqueia demonstração

- **WHEN** a raiz possui transação `bonus_onboarding` ou entitlement `onboarding`
- **THEN** cria marcador legado sem grant demo

#### Scenario: Raiz já usada não recebe demonstração

- **WHEN** loja é criada com raiz que possui onboarding ou demo
- **THEN** não concede demonstração e `onboardingGranted` é false
