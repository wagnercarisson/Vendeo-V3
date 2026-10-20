# Product 1:1 Controlled Real Test Authorization

## Purpose

Autorização **temporária e ESTREITA** para o **teste real controlado** do Produto 1:1. Atende ao recorte autorizado (instância, lojas de teste e, após checkpoint, todas as lojas), com expiração (quando informada), auditoria e revogação. A autorização é separada das feature flags e revalidada a cada decisão, sempre server-side.

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

A autorização temporária estreita SHALL NOT remover a **barreira global** de recusa de estágios habilitadores fora das vias válidas. A via `all_stores` + `all_stores` SHALL ser admitida pela RPC; a aprovação humana da abertura geral SHALL ser registrada no checkpoint e a ativação SHALL exigir o comando administrativo autenticado. O código **não** consulta documentos para verificar aprovação; a barreira técnica vale para combinações inválidas.

#### Scenario: Escopo geral é aceito pela via válida
- **WHEN** a concessão é `all_stores` + `all_stores` com instância e ator válidos
- **THEN** a concessão é registrada e auditada
- **AND** a ativação depende da chave e do comando administrativo

#### Scenario: Combinação inválida continua recusada
- **WHEN** estágio, escopo, instância ou ambiente são incompatíveis
- **THEN** a recusa é registrada
- **AND** nenhuma loja é habilitada

#### Scenario: Aprovação é processo, não validação documental
- **WHEN** a RPC de ativação é executada
- **THEN** ela não lê specs, evidências ou arquivos de checkpoint
- **AND** o registro do checkpoint permanece a autorização operacional humana

### Requirement: Autorização não antecipa F56.3

A autorização temporária SHALL NOT habilitar aprovação, reprovação ou correção de arte, que permanecem na F56.3.

#### Scenario: F56.3 permanece fora
- **WHEN** a autorização temporária está vigente
- **THEN** aprovação/reprovação/correção continuam indisponíveis
- **AND** a decisão de aprovação permanece reservada à F56.3

### Requirement: Autorização operacional estreita para lojas de teste

A autorização habilitadora SHALL admitir a via `test_stores` + `test_stores` no **ambiente operacional**, concedida por **admin autenticado** via **RPC auditada**, restrita à **instância canônica**, com **auditoria** e **revogação**. O sistema SHALL também admitir a via `all_stores` + `all_stores` no ambiente operacional, acionada pelo comando administrativo após o checkpoint de abertura geral. A via `isolated_pilot` SHALL permanecer inalterada.

#### Scenario: Concessão test_stores auditada
- **WHEN** o admin concede `test_stores` + `test_stores`
- **THEN** a RPC registra concessor, motivo, `operation_id`, escopo e instância
- **AND** a concessão é `granted` e auditável

#### Scenario: Concessão all_stores auditada
- **WHEN** o admin concede `all_stores` + `all_stores` pelo comando após o checkpoint
- **THEN** a RPC registra concessor, motivo, `operation_id`, escopo e instância
- **AND** a concessão é `granted` e auditável

#### Scenario: Escopo geral exige comando explícito
- **WHEN** não há comando administrativo autenticado para `all_stores`
- **THEN** nenhum estágio de escopo geral é concedido
- **AND** a autorização não é criada por omissão

#### Scenario: Revogação encerra a via operacional
- **WHEN** a autorização `test_stores` ou `all_stores` é revogada
- **THEN** o recorte correspondente deixa de ser permitido
- **AND** a decisão passa a negar

### Requirement: Via estreita e testes negativos

A autorização habilitadora SHALL ocorrer **somente** por vias **estreitas**: (i) **`isolated_pilot` + `test_stores` + `isolated`** (via **inalterada**, usada na validação local); (ii) **`test_stores` + `test_stores` + `operational`** (piloto hospedado restrito a lojas de teste); ou (iii) **`all_stores` + `all_stores` + `operational`**, acionada pelo comando administrativo após o checkpoint de abertura geral. **`all_stores` SHALL NOT ser concedido por outra via**. A **janela** de lojas de teste SHALL ser controlada por **`product_1_1_test_stores_enabled`**; a abertura geral, por **`product_1_1_all_stores_enabled`**; **não** haverá autorização/expiração/allowlist **por loja**. Os controles existentes (instância, autorização, auditoria, revogação) SHALL ser **reaproveitados**, sem novo subsistema.

#### Scenario: Vias estreitas são as únicas permitidas
- **WHEN** a autorização habilitadora é concedida
- **THEN** ela é `isolated_pilot` + `test_stores` + `isolated`, `test_stores` + `test_stores` + `operational` ou `all_stores` + `all_stores` + `operational`
- **AND** qualquer outra combinação é recusada

#### Scenario: all_stores exige a via e o comando
- **WHEN** se tenta `all_stores` por outra via ou sem comando autenticado
- **THEN** nenhuma loja geral é habilitada
- **AND** a ativação não é reportada como concluída

#### Scenario: Ambas as lojas de teste validam
- **WHEN** Adega ou NovaTek (`is_test_store=true`) usa o fluxo novo sob a autorização `test_stores` vigente
- **THEN** a validação é permitida no recorte de lojas de teste
- **AND** nenhuma loja não-test é habilitada

#### Scenario: Flag desligada nega
- **WHEN** a chave aplicável está `false`
- **THEN** a decisão nega o fluxo novo

#### Scenario: Loja não-test no estado de teste nega
- **WHEN** a loja não é de teste (`is_test_store=false`) e apenas o estado de lojas de teste está ativo
- **THEN** o novo fluxo é negado

#### Scenario: Instância ou combinação não autorizada nega
- **WHEN** a instância canônica não corresponde **ou** a combinação estágio×ambiente×escopo é incompatível
- **THEN** a decisão nega

#### Scenario: Escopo geral sem autorização ou chave
- **WHEN** se tenta o escopo geral (`all_stores`) sem autorização vigente ou sem a chave geral
- **THEN** a decisão nega o novo fluxo
- **AND** a produção permanece intocada

### Requirement: Autorização de abertura geral com dois escopos

Quando o estado for **todas as lojas**, a autorização habilitadora SHALL conter, na mesma instância canônica, uma autorização `all_stores` + `all_stores` e uma autorização `test_stores` + `test_stores` vigentes. A autorização `all_stores` SHALL cobrir apenas lojas com `is_test_store=false`; a loja de teste SHALL continuar usando a autorização `test_stores`. Nenhuma das duas autorizações SHALL substituir a chave aplicável.

#### Scenario: Abertura geral com as duas autorizações
- **WHEN** o estado de todas as lojas é ativado
- **THEN** `all_stores` e `test_stores` estão vigentes na instância canônica
- **AND** lojas gerais e lojas de teste são elegíveis

#### Scenario: Falta da autorização de teste
- **WHEN** apenas `all_stores` está vigente e uma loja de teste solicita o fluxo
- **THEN** a loja de teste é negada
- **AND** nenhuma ampliação implícita de escopo é aplicada

#### Scenario: Autorização não substitui a chave
- **WHEN** as duas autorizações estão vigentes e `product_1_1_all_stores_enabled=false`
- **THEN** o novo fluxo é negado
- **AND** a ativação continua exigindo a chave aplicável

## Pilot Scope and Deferred Items

The operational `test_stores` authorization was scoped to the **N=1 hosted pilot** in
56.2.6. Items **5.3** (hosted refund path) and **5.7** (post-redeploy replay) were
**deferred by responsible decision and not executed** at that time; that historical
record and the `DEFERRED.md` pointer are preserved in the archived 56.2.6 change.

In 56.2.7, **5.3 and 5.7 were executed and proven in the hosted environment**:
5.3 passed with a single refund and idempotent replay; 5.7 passed with a `delivered`
operation replayed after redeploy, unchanged artifact hash and no new generation,
upload, provider, event or credit transaction.

The general opening was authorized in 56.2.7. `all_stores` is active under the
**7-day monitoring transferred on 2026-10-19 and still in progress**; the flow is not
automatically shut down. D13 remains accepted only for the monitored opening; the real
platform kill remains **INCONCLUSIVE**. The 56.2.6 evidence and its deferral are not
rewritten.

Durable monitoring pointer: `.planning/phases/56.2.7-abertura-gradual-produto-1-1-luna/56.2.7-MONITORING-TRANSFER.md`.

Durable 56.2.6 deferral pointer: `openspec/changes/archive/2026-10-19-fase-56-2b2d-piloto-hospedado-produto-1-1-test-stores/DEFERRED.md`.
