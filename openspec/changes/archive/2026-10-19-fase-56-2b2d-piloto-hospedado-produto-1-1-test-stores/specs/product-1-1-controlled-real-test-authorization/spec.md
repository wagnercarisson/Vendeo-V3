# Product 1:1 Controlled Real Test Authorization — Delta (piloto hospedado em lojas de teste)

## ADDED Requirements

### Requirement: Autorização operacional estreita para lojas de teste

A autorização habilitadora SHALL admitir uma **segunda via estreita**, além de `isolated_pilot`: o estágio `test_stores` com escopo `test_stores` no **ambiente operacional**, concedido por **admin autenticado** via **RPC auditada**, restrito à **instância canônica**, com **auditoria** e **revogação**. O escopo geral SHALL permanecer **recusado**.

#### Scenario: Concessão test_stores auditada
- **WHEN** o admin concede `test_stores` + `test_stores`
- **THEN** a RPC registra concessor, motivo, `operation_id`, escopo e instância
- **AND** a concessão é `granted` e auditável

#### Scenario: Escopo geral recusado
- **WHEN** se tenta conceder `all_stores` ou escopo `all_stores`
- **THEN** a RPC recusa e registra a recusa
- **AND** nenhum estágio de escopo geral é habilitado

#### Scenario: Revogação encerra a via operacional
- **WHEN** a autorização `test_stores` é revogada
- **THEN** o recorte operacional deixa de ser permitido
- **AND** a decisão passa a negar

## MODIFIED Requirements

### Requirement: Via estreita e testes negativos

A autorização habilitadora SHALL ocorrer **somente** por vias **estreitas**: (i) **`isolated_pilot` + `test_stores` + `isolated`** (via **inalterada**, usada na validação local); **ou** (ii) **`test_stores` + `test_stores` + `operational`** (novo piloto hospedado restrito a lojas de teste). **`all_stores` SHALL permanecer sempre recusado**. A **janela** SHALL ser controlada por **`product_1_1_test_stores_enabled`**; **não** haverá autorização/expiração/allowlist **por loja**. Os controles existentes (instância, autorização, auditoria, revogação) SHALL ser **reaproveitados**, sem novo subsistema.

#### Scenario: Vias estreitas são as únicas permitidas
- **WHEN** a autorização habilitadora é concedida
- **THEN** ela é `isolated_pilot`+`test_stores`+`isolated` **ou** `test_stores`+`test_stores`+`operational`
- **AND** `all_stores` permanece recusado

#### Scenario: Ambas as lojas de teste validam
- **WHEN** Adega ou NovaTek (`is_test_store=true`) usa o fluxo novo sob a autorização vigente
- **THEN** a validação é permitida no recorte de lojas de teste
- **AND** nenhuma loja não-test é habilitada

#### Scenario: Flag desligada nega
- **WHEN** `product_1_1_test_stores_enabled` está `false`
- **THEN** a decisão nega o fluxo novo

#### Scenario: Loja não-test nega
- **WHEN** a loja não é de teste (`is_test_store=false`)
- **THEN** o novo fluxo é negado

#### Scenario: Instância ou combinação não autorizada nega
- **WHEN** a instância canônica não corresponde **ou** a combinação estágio×ambiente×escopo é incompatível
- **THEN** a decisão nega

#### Scenario: Escopo geral recusado
- **WHEN** se tenta o escopo geral (`all_stores`)
- **THEN** a recusa é preservada
- **AND** a produção permanece intocada
