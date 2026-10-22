> Synced from `fase-32-freemium-anti-abuso-cnpj` (ADDED).

## Purpose

Exibição de CNPJ mascarado e badge de status freemium na interface admin, além de botão de exceção manual e filtro de status na listagem.
## Requirements
### Requirement: CNPJ mascarado no detalhe da loja

O sistema SHALL exibir CNPJ mascarado (`**.***.***/YYYY-**`) na página de detalhe do usuário/loja em `/admin/users/[id]`. O sufixo `YYYY` corresponde às posições 9–12 e pode conter letras maiúsculas e dígitos. O CNPJ nunca é exibido cru em nenhuma interface. Se o valor armazenado não for canônico, a tela SHALL exibir o placeholder seguro `"CNPJ inválido"`.

#### Scenario: CNPJ numérico exibido mascarado

- **WHEN** admin acessa `/admin/users/[id]`
- **AND** a loja tem CNPJ numérico cadastrado
- **THEN** o CNPJ é exibido no formato `**.***.***/0001-**`

#### Scenario: CNPJ alfanumérico exibido mascarado

- **WHEN** admin acessa `/admin/users/[id]`
- **AND** a loja tem CNPJ `"12ABC34501DE35"`
- **THEN** o CNPJ é exibido como `**.***.***/01DE-**`
- **AND** a raiz `12ABC345` não é exibida

#### Scenario: Valor inesperado não é exibido cru

- **WHEN** admin acessa `/admin/users/[id]`
- **AND** o valor armazenado não casa `^[A-Z0-9]{12}[0-9]{2}$`
- **THEN** a tela exibe `"CNPJ inválido"`
- **AND** o valor integral não é renderizado

### Requirement: Badge de status freemium

O sistema SHALL exibir um badge de status freemium no detalhe da loja:

- `🟢 Freemium ativo` — raiz com entitlement + saldo > 0
- `🟡 Freemium usado` — raiz já usou onboarding, saldo = 0
- `🔴 Freemium esgotado` — raiz usou onboarding + mensal; `bonus_balance` no limiar (`>= monthlyBonusCap`) ou ciclo mensal já concedido
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

### Requirement: Listagens admin mascaram CNPJ alfanumérico

As listagens e telas administrativas que exibem CNPJ SHALL usar a função central `maskCnpj`, preservando o sufixo de 4 caracteres (numérico ou alfanumérico) e ocultando a raiz e os dígitos verificadores.

#### Scenario: Listagem de usuários exibe CNPJ alfanumérico mascarado

- **WHEN** admin acessa `/admin/users`
- **AND** a loja tem CNPJ `"12ABC34501DE35"`
- **THEN** a linha exibe `**.***.***/01DE-**`

#### Scenario: Fila de revisão exibe CNPJ alfanumérico mascarado

- **WHEN** admin acessa `/admin/reviews`
- **AND** a loja tem CNPJ `"12ABC34501DE35"`
- **THEN** a fila exibe `**.***.***/01DE-**`

#### Scenario: Exceção freemium exibe CNPJ alfanumérico mascarado

- **WHEN** admin acessa a tela de exceção freemium de uma loja com CNPJ alfanumérico
- **THEN** o CNPJ é exibido mascarado com o sufixo alfanumérico preservado

