# Product 1:1 Controlled Real Test Authorization

> B2.3 — autorização **temporária e ESTREITA** para o **teste real controlado isolado**. Não remove a barreira global que hoje recusa estágios habilitadores; atende ao recorte autorizado (instância e lojas), com expiração, auditoria e revogação. A autorização é separada das feature flags e revalidada a cada decisão.

## ADDED Requirements

### Requirement: Autorização temporária estreita

O sistema SHALL permitir uma autorização **temporária e estreita** para o **teste real controlado isolado**, restrita a uma **instância autorizada** e ao **escopo de lojas de teste**, com **auditoria** (concessor, motivo, `operation_id`, escopo, instância) e **revogação**. A concessão SHALL ocorrer por **admin autenticado** via RPC auditada. **Expiração:** a existente é **respeitada quando informada**; **não** se implementa **nova expiração obrigatória** — a janela é controlada pela **flag** e pela **revogação**.

#### Scenario: Autorização restrita a instância e lojas

- **WHEN** a autorização temporária é concedida
- **THEN** ela é restrita à instância autorizada e ao **escopo de lojas de teste** (`test_stores`)
- **AND** nenhuma outra instância ou loja é habilitada

#### Scenario: Concessão auditada

- **WHEN** a autorização é concedida
- **THEN** ficam registrados o concessor, o motivo, o `operation_id`, o escopo e a instância
- **AND** a concessão é auditável

#### Scenario: Expiração existente respeitada (quando informada)

- **WHEN** a autorização é concedida **com** expiração
- **THEN** após o vencimento ela deixa de permitir o recorte
- **AND** o estado retorna a não autorizado
- **AND** quando **sem** expiração informada, a janela é delimitada pela **flag** e pela **revogação**

### Requirement: Revogação e revalidação server-side

A autorização SHALL ser **revogável** e **revalidada a cada decisão**, com leitura server-side. A autorização SHALL NOT decorrer de alegação do cliente.

#### Scenario: Revogação encerra o recorte

- **WHEN** a autorização é revogada
- **THEN** o recorte autorizado deixa de ser permitido
- **AND** a decisão passa a negar

#### Scenario: Autorização nunca vem do cliente

- **WHEN** uma decisão de elegibilidade é tomada
- **THEN** ela deriva exclusivamente do estado server-side
- **AND** nenhum parâmetro do cliente altera o resultado

### Requirement: Barreira global preservada

A autorização temporária estreita SHALL NOT remover a **barreira global** de recusa de estágios habilitadores de escopo geral. Fora do recorte autorizado, o comportamento existente de recusa SHALL permanecer.

#### Scenario: Escopo geral continua recusado

- **WHEN** se tenta habilitar o escopo geral
- **THEN** a recusa de estágios habilitadores permanece
- **AND** apenas o recorte temporário autorizado é permitido

### Requirement: Autorização não antecipa F56.3

A autorização temporária SHALL NOT habilitar aprovação, reprovação ou correção de arte, que permanecem na F56.3.

#### Scenario: F56.3 permanece fora

- **WHEN** a autorização temporária está vigente
- **THEN** aprovação/reprovação/correção continuam indisponíveis
- **AND** a decisão de aprovação permanece reservada à F56.3

### Requirement: Via estreita e testes negativos

A autorização habilitadora SHALL ocorrer **somente** pela via **`isolated_pilot` + `test_stores` + `isolated`** (ajuste **mínimo** da barreira existente). **`all_stores` SHALL permanecer sempre recusado**. A **janela** SHALL ser controlada por **`product_1_1_test_stores_enabled`**; **não** haverá autorização/expiração/allowlist **por loja**. Os controles existentes (instância, autorização, auditoria, revogação) SHALL ser **reaproveitados**, sem novo subsistema.

#### Scenario: Via estreita é a única permitida

- **WHEN** a autorização habilitadora é concedida
- **THEN** ela é `isolated_pilot` + `test_stores` + `isolated`
- **AND** `all_stores` permanece recusado

#### Scenario: Ambas as lojas de teste validam

- **WHEN** Adega ou NovaTek (`is_test_store=true`) usa o fluxo novo sob a autorização vigente
- **THEN** a validação é permitida no recorte de lojas de teste

#### Scenario: Flag desligada nega

- **WHEN** `product_1_1_test_stores_enabled` está `false`
- **THEN** a decisão nega o fluxo novo

#### Scenario: Loja não-test nega

- **WHEN** a loja não é de teste (`is_test_store=false`)
- **THEN** o novo fluxo é negado

#### Scenario: Instância ou ambiente não autorizado nega

- **WHEN** a instância canônica não corresponde ou o ambiente não é `isolated`
- **THEN** a decisão nega

#### Scenario: Escopo geral recusado

- **WHEN** se tenta o escopo geral (`all_stores`)
- **THEN** a recusa é preservada
- **AND** a produção permanece intocada
