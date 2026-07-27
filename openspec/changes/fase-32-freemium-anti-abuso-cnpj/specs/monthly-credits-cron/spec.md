## MODIFIED Requirements

### Requirement: RPC grant_monthly_credits entitlement-aware

O cron mensal SHALL verificar entitlement por raiz antes de conceder créditos mensais. Lojas sem `cnpj_root_hash` (vazio ou nulo) são ignoradas.

- Dentro do loop de stores elegíveis, antes de `grant_credits`:
  - Lê `stores.cnpj_root_hash` da store candidata
  - Se vazio/nulo → pula (loja legacy sem CNPJ)
  - Calcula `cycle = TO_CHAR(NOW(), 'YYYY-MM')`
  - Tenta INSERT em `freemium_entitlements (root_hash, benefit_type='monthly', cycle)`
  - Se INSERT retornou id → concede 5 créditos + vincula `grant_transaction_id`
  - Se INSERT não retornou (ON CONFLICT) → raiz já recebeu neste ciclo, pula

#### Scenario: Raiz sem grant no ciclo → concede

- **WHEN** cron executa para store com cnpj_root_hash válido
- **AND** raiz não recebeu monthly neste ciclo
- **THEN** INSERT em freemium_entitlements vence
- **AND** 5 créditos são concedidos

#### Scenario: Raiz já recebeu no ciclo → pula

- **WHEN** cron executa para store cuja raiz já recebeu monthly neste ciclo
- **THEN** INSERT não vence (ON CONFLICT)
- **AND** nenhum crédito é concedido

#### Scenario: Loja sem CNPJ → ignorada

- **WHEN** cron executa para store com `cnpj_root_hash` vazio ou nulo
- **THEN** a store é pulada sem tentativa de INSERT

#### Scenario: Três filiais + matriz = 1 grant mensal

- **WHEN** cron executa para 4 stores da mesma raiz
- **THEN** apenas 1 store recebe grant mensal (a primeira do loop)
- **AND** as outras 3 são puladas (raiz já entitled no ciclo)