## ADDED Requirements

### Requirement: Confirmação fiscal inicializa ou atualiza configurações de mercado

A RPC `update_store_cnpj` SHALL estabelecer o país cadastral na confirmação fiscal e
inicializar/atualizar `store_market_settings` na mesma transação:

- loja sem linha: cria com país do país fiscal confirmado e fonte `fiscal_confirmation`,
  aplicando os padrões do perfil;
- loja com linha: atualiza `country_code`/`country_source` para o país fiscal e recomputa
  **somente** campos com fonte `default` ou `legacy_br`.

Campos com fonte `explicit` SHALL ser preservados. A RPC SHALL NOT recriar a loja, refazer
onboarding ou sobrescrever dados fiscais já registrados.

#### Scenario: Loja draft com escolha explícita confirma CNPJ

- **WHEN** uma loja draft possui `defaultCurrency = "PYG"` explícita e confirma CNPJ
- **THEN** a moeda explícita é preservada
- **AND** país e demais campos não explícitos são atualizados para o padrão fiscal

#### Scenario: Mercado explícito mantém idioma e moeda derivados

- **WHEN** uma loja BR tem `defaultCampaignMarket = "PY"` explícito, idioma/moeda com fonte
  `default` e confirma CNPJ
- **THEN** o mercado padrão continua PY
- **AND** idioma/moeda continuam `es-PY`/`PYG` (derivados do mercado, não do país)
- **AND** `time_zone` continua `America/Sao_Paulo` e `country_code` passa a BR com fonte
  `fiscal_confirmation`

#### Scenario: Loja legada sem configurações confirma CNPJ

- **WHEN** uma loja legada sem linha confirma CNPJ
- **THEN** a linha é criada com fonte `fiscal_confirmation`
- **AND** os padrões BR são aplicados

#### Scenario: País divergente falha explicitamente

- **WHEN** a confirmação fiscal tenta aplicar país diferente do já registrado como fiscal
- **THEN** a operação falha com erro tipado
- **AND** nenhum campo é sobrescrito

### Requirement: Benefícios existentes permanecem exatamente como estão

A confirmação fiscal SHALL preservar o comportamento vigente de créditos:

- loja com benefício anterior (`bonus_onboarding` ou entitlement `onboarding` na raiz) SHALL
  registrar o marcador legado `legacy_pre_f32_onboarding_consumed`, sem grant;
- loja sem benefício anterior e com `verification_status = 'approved'` SHALL manter a concessão
  demo condicional existente (`grant_demo_credits` com a flag vigente);
- nenhuma preferência de mercado SHALL criar, remover ou modificar benefícios.

#### Scenario: Loja com benefício anterior mantém marcador sem grant

- **WHEN** a loja/raiz já consumiu benefício de onboarding e confirma CNPJ
- **THEN** o marcador legado é registrado
- **AND** nenhum novo crédito é concedido pela confirmação

#### Scenario: Loja aprovada mantém a concessão condicional vigente

- **WHEN** a loja não tem benefício anterior, a verificação resulta `approved` e a flag vigente
  permite a demonstração
- **THEN** a concessão demo ocorre exatamente como hoje
- **AND** a inicialização de preferências não altera o resultado do grant

#### Scenario: Preferências não criam nem removem benefícios

- **WHEN** a confirmação fiscal inicializa/atualiza configurações
- **THEN** transações de crédito e entitlements permanecem idênticos ao comportamento vigente
- **AND** nenhum benefício é criado, removido ou reinterpretado por causa das preferências

### Requirement: Confirmação fiscal participa do controle de versão

A confirmação fiscal SHALL travar a linha de `store_market_settings` (`FOR UPDATE`), aplicar a
recomposição e incrementar `settings_version` na mesma transação.

#### Scenario: PATCH concorrente não sobrescreve a confirmação

- **WHEN** um PATCH de preferências parte de uma versão anterior enquanto a confirmação fiscal
  incrementa a versão
- **THEN** o PATCH recebe `409 settings_version_conflict`
- **AND** a confirmação e as escolhas explícitas permanecem íntegras
