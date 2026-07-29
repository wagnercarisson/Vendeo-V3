> Synced from `fase-32-freemium-anti-abuso-cnpj` (ADDED).
> Modified by `fase-34-store-readiness` (MODIFIED + ADDED). Legacy stores blocked from generation instead of just warned. Redirect with returnTo chaining. Context messages for redirect guard.

## Purpose

Atualização cadastral de lojas legadas sem CNPJ — banner, formulário, RPC `update_store_cnpj()` sem concessão de créditos, com entitlement `onboarding` legacy sem grant para marcar raiz consumida.

## Requirements

### Requirement: Lojas legadas sem CNPJ — bloqueio de geração (MODIFIED F34)

> Modified by `fase-34-store-readiness`.

O sistema SHALL bloquear geração para lojas legacy sem cadastro fiscal completo. Quando uma loja legacy sem `cnpj_normalized`, `razao_social` ou `nome_fantasia` tenta acessar `/campanhas/nova` ou chamar a API de geração, o guard de readiness SHALL redirecionar para `/cadastro/cnpj?returnTo=/campanhas/nova`. O banner no dashboard continua sendo exibido.

#### Scenario: Loja legacy bloqueada ao gerar campanha

- **WHEN** loja legacy (sem cadastro fiscal) tenta acessar `/campanhas/nova`
- **THEN** o guard de readiness redireciona para `/cadastro/cnpj?returnTo=/campanhas/nova`
- **AND** banner no dashboard continua sendo exibido

#### Scenario: Banner exibido para loja sem CNPJ

- **WHEN** loja com `cnpj_normalized IS NULL` acessa o dashboard
- **THEN** o banner de atualização cadastral é exibido

### Requirement: Formulário de atualização cadastral com returnTo (MODIFIED F34)

> Modified by `fase-34-store-readiness`.

O formulário de atualização contém apenas CNPJ + razão social + nome fantasia. Não recria loja, não refaz onboarding, não concede créditos.

Após atualização bem-sucedida, o sistema SHALL ler `returnTo` dos query params. Se store também não tem brand profile, SHALL redirecionar para `/loja?required=visual-direction&message=cnpj-updated`. Se store está pronta, SHALL redirecionar para `returnTo`, ou `/dashboard` se ausente.

#### Scenario: Atualização não concede créditos

- **WHEN** loja legacy informa CNPJ via formulário de atualização
- **THEN** `update_store_cnpj()` é chamado
- **AND** NENHUM crédito de onboarding é concedido
- **AND** saldo existente permanece intacto

#### Scenario: Atualização redireciona para brand profile se necessário

- **WHEN** loja legacy completa cadastro fiscal com sucesso
- **AND** store também não tem brand profile synced
- **THEN** redireciona para `/loja?required=visual-direction&message=cnpj-updated`

#### Scenario: Atualização redireciona para returnTo se pronta

- **WHEN** loja legacy completa cadastro fiscal com sucesso
- **AND** store já tem brand profile synced
- **AND** `returnTo` está presente nos query params
- **THEN** redireciona para o valor de `returnTo`

#### Scenario: Atualização sem returnTo vai para dashboard

- **WHEN** loja legacy completa cadastro fiscal com sucesso
- **AND** store já tem brand profile synced
- **AND** `returnTo` não está presente
- **THEN** redireciona para `/dashboard`

### Requirement: Mensagens do redirect de guarda (ADDED F34)

> Added by `fase-34-store-readiness`.

O sistema SHALL exibir mensagens específicas no contexto de redirect de guarda:

| Contexto | Mensagem |
|----------|----------|
| Redirect do guard (cadastro fiscal ausente) | "Sua loja precisa do CNPJ, razão social e nome fantasia para gerar campanhas. Atualize seus dados cadastrais para continuar." |
| Redirect do guard (brand profile ausente) | "Sua loja precisa de uma direção visual para gerar campanhas. Configure agora." |
| Após atualizar cadastro + sem brand profile | "Dados atualizados! Agora configure a direção visual da sua loja." |

As mensagens SHALL ser passadas via query param `message` para o destino do redirect.

#### Scenario: Mensagem de redirect para cadastro fiscal

- **WHEN** usuário é redirecionado para `/cadastro/cnpj?returnTo=/campanhas/nova`
- **THEN** a página de cadastro exibe a mensagem "Sua loja precisa do CNPJ..."

#### Scenario: Mensagem de redirect para direção visual (brand ausente)

- **WHEN** usuário é redirecionado para `/loja?required=visual-direction&message=needs-visual-direction`
- **THEN** a página exibe "Sua loja precisa de uma direção visual para gerar campanhas. Configure agora."

#### Scenario: Mensagem após atualizar cadastro sem brand profile

- **WHEN** usuário completa cadastro fiscal e é redirecionado via `&message=cnpj-updated`
- **THEN** a página exibe "Dados atualizados! Agora configure a direção visual da sua loja."

### Requirement: RPC update_store_cnpj()

O sistema SHALL prover `update_store_cnpj(p_store_id, p_cnpj_normalized, p_cnpj_root_hash, p_razao_social?, p_nome_fantasia?)` que:

- Valida que a loja existe (`store_not_found`)
- Valida que CNPJ não foi sobrescrito (`cnpj_already_set`)
- Recebe `cnpj_root_hash` já calculado pela rota Next.js (nunca recebe do caller)
- Atualiza `stores.cnpj_normalized`, `cnpj_root_hash`, `razao_social`, `nome_fantasia`
- NÃO concede créditos, MAS insere entitlement `onboarding` sem grant para marcar a raiz como já consumida
- Retorna dados atualizados com CNPJ mascarado

**Entitlement para lojas legacy:** A RPC insere em `freemium_entitlements`:
- `benefit_type = 'onboarding'`
- `grant_transaction_id = NULL`
- `reason = 'legacy_pre_f32_onboarding_consumed'`
- Usa `ON CONFLICT DO NOTHING` — se a raiz já tiver entitlement, o INSERT é ignorado

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
