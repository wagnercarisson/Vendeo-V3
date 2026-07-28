# Onboarding Grant

> Synced from `fase-25-integracao-transacional-pipeline` (ADDED).

## Purpose

Concessão automática de 10 créditos no onboarding (criação da loja), com atomicidade transacional e idempotência.

## Requirements

### Requirement: Onboarding grant condicionado à raiz do CNPJ (MODIFICADO F32)

O sistema SHALL conceder 10 créditos de onboarding APENAS se a raiz do CNPJ nunca recebeu onboarding antes. O fluxo é entitlement-first: primeiro tenta inserir em `freemium_entitlements`, e só concede créditos se o INSERT venceu.

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
