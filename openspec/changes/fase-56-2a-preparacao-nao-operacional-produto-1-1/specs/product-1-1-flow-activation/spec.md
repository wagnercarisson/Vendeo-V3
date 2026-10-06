# Product 1:1 Flow Activation

> F56.2a — estrutura e decisão **inativas**. O roteamento real e a ativação efetiva pertencem à F56.2b1.

## ADDED Requirements

### Requirement: Estrutura das duas chaves de ativação, desligadas por padrão

O sistema SHALL registrar em `feature_flags` **duas** chaves de ativação do novo fluxo Produto 1:1: uma para lojas com `stores.is_test_store = true` e outra para todas as lojas. Ambas SHALL começar **desligadas** e SHALL ser alteráveis pela RPC administrativa auditada existente.

#### Scenario: Chaves desligadas mantêm o fluxo legado

- **WHEN** as duas chaves estão desligadas
- **THEN** a decisão de fluxo resulta no fluxo legado
- **AND** o novo fluxo não é selecionado

#### Scenario: Chave de lojas de teste é representável

- **WHEN** a chave de lojas de teste está ligada e a chave geral está desligada
- **THEN** a decisão identifica lojas com `is_test_store = true` como elegíveis ao novo fluxo
- **AND** lojas com `is_test_store = false` permanecem no legado

#### Scenario: Chave geral é representável

- **WHEN** a chave geral está ligada
- **THEN** a decisão identifica todas as lojas elegíveis como elegíveis ao novo fluxo
- **AND** a loja de teste também é elegível

### Requirement: Decisão server-side pura e fail-closed

A função de decisão SHALL ser server-side e testável isoladamente. Chave ausente, desligada ou com falha de leitura SHALL resultar no fluxo legado; nenhum parâmetro do cliente SHALL forçar o novo fluxo.

#### Scenario: Falha de leitura mantém o legado

- **WHEN** a leitura das chaves falha
- **THEN** a decisão resulta no fluxo legado
- **AND** o novo fluxo não é ativado por omissão

#### Scenario: Cliente não decide o fluxo

- **WHEN** a decisão é calculada
- **THEN** ela deriva exclusivamente de estado server-side
- **AND** nenhum dado do cliente altera o resultado

### Requirement: Precedência determinística entre as chaves

Quando ambas as chaves estiverem ligadas, a chave **geral** SHALL prevalecer (superconjunto), de forma determinística e documentada.

#### Scenario: Chave geral prevalece

- **WHEN** a chave geral e a chave de lojas de teste estão ligadas
- **THEN** a decisão segue a chave geral
- **AND** o resultado é o mesmo em todas as avaliações

### Requirement: Barreira de não-ativação nesta fatia

A F56.2a SHALL NOT habilitar rota de geração real, chamada ao provider, reserva de crédito, entrega ou download pelo novo fluxo. A chave SHALL NOT conseguir encaminhar campanhas reais nesta fatia e os componentes SHALL NOT ser montados no fluxo produtivo do lojista.

#### Scenario: Chave não encaminha campanhas reais

- **WHEN** uma chave estiver ligada nesta fatia
- **THEN** nenhuma campanha real é encaminhada ao novo fluxo
- **AND** o fluxo produtivo permanece o legado

#### Scenario: Componentes não expostos ao lojista

- **WHEN** o fluxo produtivo do lojista é renderizado
- **THEN** os componentes do novo fluxo não são montados nele
- **AND** o lojista não acessa um caminho incompleto
