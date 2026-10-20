## ADDED Requirements

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

## MODIFIED Requirements

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
