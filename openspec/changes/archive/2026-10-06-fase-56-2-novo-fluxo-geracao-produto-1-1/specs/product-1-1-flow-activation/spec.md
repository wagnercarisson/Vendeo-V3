# Product 1:1 Flow Activation

## ADDED Requirements

### Requirement: Duas chaves de ativação auditáveis, desligadas por padrão

O sistema SHALL manter **duas** chaves administrativas auditáveis para ativar o novo fluxo de geração Produto 1:1: uma para lojas cadastradas com `stores.is_test_store = true` e outra para todas as lojas. Ambas SHALL estar **desligadas por padrão** e SHALL ser gravadas por caminho auditável (autor, motivo e `operation_id`).

#### Scenario: Chaves desligadas mantêm o fluxo legado

- **WHEN** as duas chaves estão desligadas
- **THEN** uma geração de campanha Produto usa o fluxo legado
- **AND** o novo fluxo não é acionado

#### Scenario: Chave de lojas de teste ativa somente lojas de teste

- **WHEN** a chave de lojas de teste está ligada e a chave geral está desligada
- **THEN** uma loja com `is_test_store = true` usa o novo fluxo
- **AND** uma loja com `is_test_store = false` permanece no fluxo legado

#### Scenario: Chave geral ativa todas as lojas elegíveis

- **WHEN** a chave geral está ligada
- **THEN** toda loja elegível usa o novo fluxo
- **AND** a loja de teste também usa o novo fluxo

### Requirement: Roteamento obrigatoriamente server-side e fail-closed

A decisão de qual fluxo usar SHALL ser tomada exclusivamente no servidor, antes de qualquer ramo de geração. Chave ausente, desligada ou cuja leitura falhe SHALL manter o fluxo legado; nunca SHALL ativar o novo fluxo por omissão ou por decisão do cliente.

#### Scenario: Falha de leitura mantém o legado

- **WHEN** a leitura das chaves falha
- **THEN** o fluxo legado é mantido
- **AND** o novo fluxo não é ativado

#### Scenario: Cliente não decide o fluxo

- **WHEN** uma requisição de geração é processada
- **THEN** a decisão de fluxo é derivada de estado server-side
- **AND** nenhum parâmetro do cliente pode forçar o novo fluxo

### Requirement: Precedência determinística entre as chaves

Quando ambas as chaves estiverem ligadas, o sistema SHALL aplicar uma precedência determinística e documentada, de modo que a chave geral (superconjunto) prevaleça sobre a chave de lojas de teste.

#### Scenario: Chave geral prevalece

- **WHEN** a chave geral e a chave de lojas de teste estão ligadas
- **THEN** toda loja elegível usa o novo fluxo segundo a chave geral
- **AND** a precedência é a mesma em todas as requisições

### Requirement: Rollback e comportamento de campanhas já criadas

Desligar uma chave SHALL impedir apenas **novas** campanhas no caminho novo. Campanhas já criadas SHALL manter o fluxo em que nasceram: as criadas no novo fluxo permanecem no novo fluxo (com snapshot congelado) e as criadas no legado permanecem no legado.

#### Scenario: Desligar chave não migra campanha existente

- **WHEN** a chave é desligada após uma campanha ter nascido no novo fluxo
- **THEN** essa campanha continua no novo fluxo
- **AND** campanhas nascidas no legado permanecem no legado

#### Scenario: Desligar chave impede novas campanhas no fluxo novo

- **WHEN** a chave é desligada
- **THEN** novas campanhas deixam de ser admitidas no novo fluxo
- **AND** novas campanhas voltam ao fluxo legado
