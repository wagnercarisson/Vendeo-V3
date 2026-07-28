> Synced from `fase-32-freemium-anti-abuso-cnpj` (ADDED).

## Purpose

Exibição de CNPJ mascarado e badge de status freemium na interface admin, além de botão de exceção manual e filtro de status na listagem.

## Requirements

### Requirement: CNPJ mascarado no detalhe da loja

O sistema SHALL exibir CNPJ mascarado (`**.***.***/0001-**`) na página de detalhe do usuário/loja em `/admin/users/[id]`. O CNPJ nunca é exibido cru em nenhuma interface.

#### Scenario: CNPJ exibido mascarado

- **WHEN** admin acessa `/admin/users/[id]`
- **AND** a loja tem CNPJ cadastrado
- **THEN** o CNPJ é exibido no formato `**.***.***/0001-**`

### Requirement: Badge de status freemium

O sistema SHALL exibir um badge de status freemium no detalhe da loja:

- `🟢 Freemium ativo` — raiz com entitlement + saldo > 0
- `🟡 Freemium usado` — raiz já usou onboarding, saldo = 0
- `🔴 Freemium esgotado` — raiz usou onboarding + mensal, teto de bônus atingido
- `⚪ Sem CNPJ` — loja criada antes da F32 (migration pendente)

#### Scenario: Badge mostra status correto

- **WHEN** admin acessa `/admin/users/[id]`
- **THEN** o badge de status freemium é exibido com base no entitlement e saldo

### Requirement: Botão "Conceder exceção" com reason obrigatório

O sistema SHALL prover um botão "Conceder exceção" na página de detalhe que permite grant manual bypassando a verificação de raiz. O reason é obrigatório. A ação é registrada em `admin_audit_log`.

#### Scenario: Admin concede exceção com reason

- **WHEN** admin clica "Conceder exceção"
- **AND** preenche reason obrigatório
- **THEN** o grant manual é concedido
- **AND** registrado em `admin_audit_log`

### Requirement: Filtro de status freemium na listagem

A página de listagem `/admin/users` SHALL ter coluna de CNPJ mascarado e filtro por status freemium ("Sem freemium" / "Freemium usado" / "Freemium ativo").

#### Scenario: Listagem mostra CNPJ mascarado

- **WHEN** admin acessa `/admin/users`
- **THEN** cada linha exibe CNPJ mascarado
- **AND** filtro de status freemium está disponível
