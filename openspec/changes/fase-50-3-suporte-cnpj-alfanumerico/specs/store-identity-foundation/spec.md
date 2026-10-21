## ADDED Requirements

### Requirement: Criação de loja aceita CNPJ alfanumérico canônico

O endpoint `POST /api/store` SHALL aceitar CNPJs numéricos e alfanuméricos válidos. A entrada SHALL ser normalizada antes de validação, cálculo de raiz, verificação de duplicidade, consulta cadastral e persistência. O valor persistido em `stores.cnpj_normalized` SHALL ser exatamente o canônico de 14 caracteres, com letras maiúsculas e sem pontuação. CNPJs numéricos existentes SHALL manter o mesmo valor e o mesmo `cnpj_root_hash`.

#### Scenario: Loja criada com CNPJ alfanumérico válido

- **WHEN** `POST /api/store` recebe `cnpj = "12.abc.345/01de-35"` e os demais campos válidos
- **THEN** o CNPJ é normalizado para `"12ABC34501DE35"`
- **AND** a raiz usada para o hash é `"12ABC345"`
- **AND** `stores.cnpj_normalized` recebe `"12ABC34501DE35"`
- **AND** a resposta da API não expõe o CNPJ cru

#### Scenario: Loja criada com CNPJ numérico mantém comportamento atual

- **WHEN** `POST /api/store` recebe `cnpj = "12.345.678/0001-95"`
- **THEN** o CNPJ é normalizado para `"12345678000195"`
- **AND** o `cnpj_root_hash` é idêntico ao calculado antes desta mudança
- **AND** o fluxo de verificação, grant e resposta permanece inalterado

#### Scenario: CNPJ alfanumérico inválido bloqueia a criação

- **WHEN** `POST /api/store` recebe `cnpj = "12.ABC.345/01DE-34"`
- **THEN** responde `400` com `{ "error": "CNPJ inválido" }`
- **AND** nenhuma loja é criada

#### Scenario: Caractere desconhecido bloqueia a criação

- **WHEN** `POST /api/store` recebe `cnpj = "12.ABC.345/01DE-35😀"` ou `"12.ÁBC.345/01DE-35"`
- **THEN** responde `400` com `{ "error": "CNPJ inválido" }`
- **AND** o caractere não é removido para produzir um CNPJ válido

#### Scenario: Provedor ainda não suporta o formato

- **WHEN** `POST /api/store` recebe um CNPJ alfanumérico localmente válido
- **AND** todos os provedores rejeitam explicitamente o formato (`unsupported_format`)
- **THEN** a loja é criada com `verification_status = 'defer'`
- **AND** `verification_reasons` contém `api_unsupported_format`
- **AND** nenhum crédito de onboarding é concedido
- **AND** não há tratamento como `not_found`

#### Scenario: Formato não suportado misturado com indisponibilidade

- **WHEN** um provedor rejeita o formato e outro está indisponível
- **THEN** a loja segue o caminho de indisponibilidade (`defer` / `api_unavailable`)
- **AND** não há `not_found`

#### Scenario: Duplicidade compara valores canônicos

- **WHEN** já existe uma loja com `cnpj_normalized = "12ABC34501DE35"`
- **AND** uma nova criação envia `"12.abc.345/01de-35"`
- **THEN** a verificação de duplicidade encontra a loja existente
- **AND** responde com o erro de CNPJ já cadastrado

### Requirement: Constraint atômica do banco aceita os dois formatos

A constraint `chk_stores_cnpj_atomic` SHALL aceitar CNPJ canônico com 12 caracteres `[A-Z0-9]` seguidos de 2 dígitos `[0-9]`, mantendo a atomicidade entre `cnpj_normalized`, `cnpj_root_hash`, `razao_social` e `nome_fantasia`.

A migration SHALL ser fail-closed: SHALL abortar se encontrar CNPJ não nulo fora do novo padrão, CNPJ sem `cnpj_root_hash` ou dados fiscais sem CNPJ. A migration SHALL NOT reescrever `cnpj_normalized`, `cnpj_root_hash` ou qualquer dado existente.

#### Scenario: Constraint aceita CNPJ numérico existente

- **WHEN** a migration é aplicada em uma base com `cnpj_normalized = "12345678000195"` e `cnpj_root_hash` preenchido
- **THEN** a constraint é validada com sucesso
- **AND** o valor permanece exatamente `"12345678000195"`

#### Scenario: Constraint aceita CNPJ alfanumérico

- **WHEN** uma loja é inserida com `cnpj_normalized = "12ABC34501DE35"` e `cnpj_root_hash` preenchido
- **THEN** a constraint aceita o registro

#### Scenario: Constraint rejeita CNPJ alfanumérico fora do padrão

- **WHEN** uma loja tenta ser inserida com `cnpj_normalized = "12abc34501de35"`, `"12ABC34501DE3A"` ou `"12ABC34501DE3"`
- **THEN** a constraint rejeita o registro

#### Scenario: Constraint preserva atomicidade

- **WHEN** uma loja tenta ser inserida com `cnpj_normalized` não nulo e `cnpj_root_hash = ''`
- **THEN** a constraint rejeita o registro
- **AND** o mesmo vale para `razao_social`/`nome_fantasia` sem `cnpj_normalized`

#### Scenario: Migration aborta com dado legado incompatível

- **WHEN** existe qualquer `cnpj_normalized` não nulo que não casa `^[A-Z0-9]{12}[0-9]{2}$`
- **THEN** a migration aborta antes de alterar a constraint
- **AND** nenhuma linha é modificada

#### Scenario: Migration não altera CNPJs existentes

- **WHEN** a migration é aplicada
- **THEN** nenhum `UPDATE` é executado em `stores.cnpj_normalized` ou `stores.cnpj_root_hash`
- **AND** a contagem e os valores dos CNPJs existentes permanecem iguais

#### Scenario: Unicidade global é preservada

- **WHEN** duas lojas tentam usar o mesmo CNPJ canônico alfanumérico
- **THEN** o índice `idx_stores_cnpj_normalized` rejeita a segunda
- **AND** o comportamento de unicidade global existente é mantido

### Requirement: Raiz e hash usam a forma canônica

O sistema SHALL calcular `cnpj_root_hash` exclusivamente a partir dos 8 primeiros caracteres canônicos do CNPJ, após normalização e validação. Nenhuma rota SHALL calcular a raiz a partir da entrada crua com pontuação ou minúsculas.

#### Scenario: Raiz alfanumérica canônica

- **WHEN** o CNPJ de entrada é `"12.abc.345/01de-35"`
- **THEN** a raiz usada é `"12ABC345"`
- **AND** o hash é o mesmo de uma entrada já canônica `"12ABC34501DE35"`

#### Scenario: Raiz numérica inalterada

- **WHEN** o CNPJ de entrada é `"12.345.678/0001-95"`
- **THEN** a raiz usada é `"12345678"`
- **AND** o hash é idêntico ao comportamento anterior
