## ADDED Requirements

### Requirement: Lojas legadas sem CNPJ — banner de atualização cadastral

Lojas existentes (criadas antes da F32) sem CNPJ vêem banner no dashboard: "Atualize seus dados cadastrais para continuar usando o Vendeo" com link para formulário de atualização.

#### Scenario: Banner exibido para loja sem CNPJ

- **WHEN** loja com `cnpj_normalized IS NULL` acessa o dashboard
- **THEN** o banner de atualização cadastral é exibido

### Requirement: Formulário de atualização cadastral

O formulário de atualização contém apenas CNPJ + razão social + nome fantasia. Não recria loja, não refaz onboarding, não concede créditos.

#### Scenario: Atualização não concede créditos

- **WHEN** loja legacy informa CNPJ via formulário de atualização
- **THEN** `update_store_cnpj()` é chamado
- **AND** NENHUM crédito de onboarding é concedido
- **AND** saldo existente permanece intacto

### Requirement: RPC update_store_cnpj()

O sistema SHALL prover `update_store_cnpj(p_store_id, p_cnpj_normalized, p_razao_social?, p_nome_fantasia?)` que:

- Valida que a loja existe (`store_not_found`)
- Valida que CNPJ não foi sobrescrito (`cnpj_already_set`)
- Calcula `cnpj_root_hash` internamente via HMAC-SHA256 (nunca recebe hash do caller)
- Atualiza `stores.cnpj_normalized`, `cnpj_root_hash`, `razao_social`, `nome_fantasia`
- NÃO concede créditos, MAS insere entitlement `onboarding` sem grant para marcar a raiz como já consumida
- Retorna dados atualizados com CNPJ mascarado

**Entitlement para lojas legacy:** A RPC insere em `freemium_entitlements`:
- `benefit_type = 'onboarding'`
- `grant_transaction_id = NULL`
- `reason = 'legacy_pre_f32_onboarding_consumed'`
- Usa `ON CONFLICT DO NOTHING` — se a raiz já tiver entitlement (por já ter sido registrada por outra loja), o INSERT é ignorado

#### Scenario: Atualização bem-sucedida

- **WHEN** `update_store_cnpj` é chamado com dados válidos
- **THEN** CNPJ é salvo na loja
- **AND** saldo permanece intacto
- **AND** entitlement `onboarding` com `grant_transaction_id = NULL` e `reason = 'legacy_pre_f32_onboarding_consumed'` é inserido (ou ignorado via ON CONFLICT se raiz já registrada)
- **AND** retorna dados com CNPJ mascarado

#### Scenario: Mesma raiz em lojas legacy diferentes

- **WHEN** duas lojas legacy da mesma raiz atualizam CNPJ
- **THEN** a primeira inserção do entitlement `onboarding` vence (ON CONFLICT não bloqueia)
- **AND** a segunda é ignorada pelo ON CONFLICT DO NOTHING
- **AND** nenhuma das duas recebe créditos

#### Scenario: Tentativa de sobrescrever CNPJ existente

- **WHEN** `update_store_cnpj` é chamado para loja que já tem CNPJ
- **THEN** retorna erro `cnpj_already_set`

### Requirement: Cron mensal ignora lojas sem CNPJ

O cron mensal (`grant_monthly_credits`) SHALL ignorar lojas com `cnpj_root_hash` vazio ou nulo. Lojas legacy sem CNPJ não recebem bônus mensal.

#### Scenario: Loja sem CNPJ não recebe bônus mensal

- **WHEN** o cron mensal executa
- **AND** loja tem `cnpj_root_hash = ''` ou `NULL`
- **THEN** a loja é pulada (não recebe grant mensal)

### Requirement: Admin pode conceder exceção "isenta de CNPJ"

Admin pode marcar loja legacy como "isenta de CNPJ" com reason obrigatório + registro em `admin_audit_log`.

#### Scenario: Admin isenta loja de CNPJ

- **WHEN** admin marca loja como isenta de CNPJ
- **AND** reason é fornecido
- **THEN** a loja é marcada como exceção
- **AND** registro é criado em `admin_audit_log`