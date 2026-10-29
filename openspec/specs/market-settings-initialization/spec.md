> Synced from `fase-57-2-persistencia-preferencias-multimercado` (ADDED).

## Purpose

Define a inicialização idempotente de `store_market_settings` nos caminhos de criação e confirmação fiscal, preservando escolhas explícitas, país cadastral, benefícios e demais ramos existentes.

## Requirements

### Requirement: Inicialização idempotente nos caminhos de criação

Os caminhos de criação de loja SHALL inicializar `store_market_settings` na mesma transação da
loja:

- criação draft: país `BR`, fonte `assumed_default`, padrões BR;
- criação com CNPJ: país `BR`, fonte `fiscal_confirmation`, padrões BR;
- criação administrativa: país `BR`, fonte `assumed_default`, padrões BR.

A inicialização SHALL ser idempotente (`ON CONFLICT DO NOTHING`): repetir, retomar ou atualizar o
onboarding SHALL NOT duplicar linhas nem sobrescrever escolhas explícitas.

#### Scenario: Criação draft inicializa configurações

- **WHEN** `create_store_draft` cria a loja
- **THEN** existe uma linha `store_market_settings` com `country = BR`,
  `country_source = assumed_default`, mercado `BR`, `pt-BR`, `BRL` e `America/Sao_Paulo`
- **AND** os aceites legais e a ausência de grant permanecem inalterados

#### Scenario: Criação fiscal inicializa país confirmado

- **WHEN** `create_store_with_cnpj` cria a loja
- **THEN** a linha existe com `country_source = fiscal_confirmation`
- **AND** os padrões BR são aplicados
- **AND** a concessão demo condicional vigente (quando `approved` e habilitada) permanece inalterada

#### Scenario: Criação administrativa inicializa

- **WHEN** `admin_create_store_for_user` cria a loja
- **THEN** a linha existe com os padrões BR e fonte `assumed_default`
- **AND** a loja continua sendo criada com `balance = 0`, sem concessão inicial
- **AND** o audit log permanece inalterado

#### Scenario: Repetição não sobrescreve escolha explícita

- **WHEN** uma loja já possui `defaultCurrency = PYG` explícita e o onboarding é repetido
- **THEN** a moeda explícita é preservada
- **AND** nenhuma linha duplicada é criada

#### Scenario: Falha na inicialização reverte a criação

- **WHEN** a inicialização falha durante a transação de criação
- **THEN** a loja e a linha de configurações não são persistidas
- **AND** aceites e grant também não são efetivados

### Requirement: Confirmação fiscal estabelece país sem apagar escolhas

A confirmação fiscal de loja draft/legada (`update_store_cnpj`) SHALL atualizar
`country_code` para o país fiscal e `country_source` para `fiscal_confirmation`, recomputando
**somente** campos cuja fonte seja `default` ou `legacy_br`. Campos com fonte `explicit` SHALL ser
preservados.

A confirmação SHALL NOT recriar a loja, refazer onboarding ou alterar dados fiscais já
registrados. Ela SHALL NOT introduzir concessões adicionais nem alterar as concessões, condições
e benefícios vigentes.

#### Scenario: Loja legada sem linha recebe país fiscal

- **WHEN** uma loja legada sem `store_market_settings` confirma CNPJ
- **THEN** a linha é criada com país BR e fonte `fiscal_confirmation`
- **AND** os demais campos usam padrões BR

#### Scenario: Escolha explícita sobrevive à confirmação

- **WHEN** a loja possui `defaultContentLocale = "es-PY"` explícito e confirma CNPJ
- **THEN** o idioma explícito é preservado
- **AND** apenas os campos não explícitos são recomputados

#### Scenario: País divergente falha explicitamente

- **WHEN** a confirmação fiscal tenta aplicar país diferente do já registrado como fiscal
- **THEN** a operação falha com erro tipado
- **AND** nenhum campo é sobrescrito

### Requirement: País cadastral não é inferido de contexto fraco

O sistema SHALL NOT usar endereço, cidade, IP, navegador, idioma do aplicativo ou país de
cobrança (`billing_address_country`) para estabelecer o país cadastral da loja. O país SHALL vir
da confirmação fiscal ou de inicialização explicitamente marcada como assumida.

#### Scenario: Endereço de cobrança não define país

- **WHEN** `store_billing_info.billing_address_country = "PY"` e não há confirmação fiscal PY
- **THEN** o país cadastral da loja permanece o determinado pela criação/confirmação fiscal
- **AND** billing não é lido para essa decisão

#### Scenario: Idioma do app não define país

- **WHEN** o usuário prefere `es-419` e a loja é brasileira
- **THEN** o país cadastral continua BR

### Requirement: Paraguai permanece inerte

O modelo SHALL aceitar valores `PY`, mas nenhum caminho de criação/confirmação SHALL criar loja
PY nesta fatia. A existência de perfis ou valores PY SHALL NOT habilitar cadastro, RUC,
elegibilidade, cobrança ou operação no Paraguai.

#### Scenario: Nenhum caminho cria loja PY

- **WHEN** qualquer caminho de criação desta fatia é executado
- **THEN** a loja é criada com país BR
- **AND** nenhum fluxo aceita país PY como entrada operacional

#### Scenario: Perfil PY não é autorização

- **WHEN** o perfil PY existe na biblioteca
- **THEN** nenhuma rota ou RPC o trata como habilitação operacional
- **AND** autorização continua baseada em usuário/loja

### Requirement: Inicialização não cria, remove ou altera benefícios

As inicializações e atualizações desta fatia SHALL NOT criar, remover ou modificar grants,
entitlements ou transações de crédito. Os ramos de crédito vigentes das RPCs recriadas SHALL ser
preservados literalmente, incluindo:

- criação draft e criação administrativa sem concessão;
- criação fiscal com demo condicional quando aprovada/habilitada;
- confirmação fiscal com marcador legado sem grant ou demo condicional, conforme o caso.

#### Scenario: Nenhum benefício novo por preferências

- **WHEN** qualquer caminho de inicialização/atualização de configurações executa
- **THEN** `credit_transactions` e `freemium_entitlements` permanecem iguais ao comportamento vigente
- **AND** nenhum grant é criado ou removido por causa das preferências
