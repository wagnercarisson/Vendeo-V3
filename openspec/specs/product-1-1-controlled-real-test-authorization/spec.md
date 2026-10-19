# Product 1:1 Controlled Real Test Authorization

## Purpose

Autorização **temporária e ESTREITA** para o **teste real controlado isolado** do Produto 1:1. Não remove a barreira global que recusa estágios habilitadores; atende ao recorte autorizado (instância e lojas de teste), com expiração (quando informada), auditoria e revogação. A autorização é separada das feature flags e revalidada a cada decisão, sempre server-side.

## Requirements

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

### Requirement: Via estreita e testes negativos

A autorização habilitadora SHALL ocorrer **somente** por vias **estreitas**: (i) **`isolated_pilot` + `test_stores` + `isolated`** (via **inalterada**, usada na validação local); **ou** (ii) **`test_stores` + `test_stores` + `operational`** (novo piloto hospedado restrito a lojas de teste). **`all_stores` SHALL permanecer sempre recusado**. A **janela** SHALL ser controlada por **`product_1_1_test_stores_enabled`**; **não** haverá autorização/expiração/allowlist **por loja**. Os controles existentes (instância, autorização, auditoria, revogação) SHALL ser **reaproveitados**, sem novo subsistema.

#### Scenario: Vias estreitas são as únicas permitidas
- **WHEN** a autorização habilitadora é concedida
- **THEN** ela é `isolated_pilot` + `test_stores` + `isolated` **ou** `test_stores` + `test_stores` + `operational`
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

## Pilot Scope and Deferred Items

The operational `test_stores` authorization is scoped to the **N=1 hosted pilot** and does not authorize general stores. Items **5.3** (hosted refund path) and **5.7** (post-redeploy replay) are **deferred by responsible decision, not executed**, and remain required before any general opening. D13 is accepted **only** for the N=1 monitored pilot; the real platform kill remains **INCONCLUSIVE**; `all_stores` remains refused. Durable pointer: `openspec/changes/archive/2026-10-19-fase-56-2b2d-piloto-hospedado-produto-1-1-test-stores/DEFERRED.md`.
