# Product 1:1 Flow Activation

> F56.2b1 — integração operacional sobre a estrutura da F56.2a.

## ADDED Requirements

### Requirement: Roteamento server-side efetivo

O handler de geração SHALL consultar a decisão server-side (F56.2a) e encaminhar para o novo fluxo apenas quando habilitado. Chave geral prevalece; chave ausente, desligada ou com falha de leitura SHALL manter o fluxo legado.

#### Scenario: Chaves desligadas mantêm o fluxo legado

- **WHEN** as duas chaves estão desligadas
- **THEN** a campanha Produto é gerada pelo fluxo legado
- **AND** o novo fluxo não é acionado

#### Scenario: Chave de lojas de teste ativa somente lojas de teste

- **WHEN** a chave de lojas de teste está ligada e a geral desligada
- **THEN** uma loja com `is_test_store = true` usa o novo fluxo
- **AND** uma loja com `is_test_store = false` permanece no legado

#### Scenario: Chave geral ativa todas as lojas elegíveis

- **WHEN** a chave geral está ligada
- **THEN** toda loja elegível usa o novo fluxo
- **AND** a loja de teste também usa o novo fluxo

#### Scenario: Falha de leitura mantém o legado

- **WHEN** a leitura das chaves falha
- **THEN** o fluxo legado é mantido
- **AND** o novo fluxo não é ativado por omissão

### Requirement: Controles administrativos auditados de ativação

A ativação e a desativação das chaves SHALL ser feitas por controle administrativo auditado (autor, motivo, `operation_id`), sem deploy, e SHALL ser lidas em tempo de execução pelo backend.

#### Scenario: Alteração registrada e efetiva sem deploy

- **WHEN** um admin altera uma chave de ativação com motivo
- **THEN** a alteração é registrada em auditoria
- **AND** a execução seguinte observa o novo estado sem deploy

### Requirement: Trava verificável contra ativação fora dos testes isolados

A ativação efetiva do novo fluxo SHALL exigir, além da chave, uma **autorização verificável de escopo**, server-side e testável. Distinguem-se dois escopos: **autorização temporária de piloto**, restrita ao ambiente isolado e à geração paga aprovada; e **autorização de lojas de teste**, concedida somente **após** a validação do piloto. Sem qualquer autorização aplicável, a habilitação SHALL ser recusada e, mesmo que uma chave esteja ligada, o roteamento SHALL permanecer no legado. ("Deixar desligado" é decisão operacional, não proteção técnica.)

#### Scenario: Autorização temporária habilita apenas o piloto isolado

- **WHEN** existe autorização temporária de piloto
- **THEN** o fluxo pode executar no ambiente isolado para a geração paga aprovada
- **AND** lojas de teste não são habilitadas para uso real

#### Scenario: Ativação recusada antes do piloto

- **WHEN** um admin tenta habilitar uma chave antes da validação do piloto, fora do ambiente isolado autorizado
- **THEN** a habilitação é recusada
- **AND** o fluxo legado permanece

#### Scenario: Chave ligada sem autorização não ativa

- **WHEN** uma chave está ligada sem qualquer autorização aplicável
- **THEN** o roteamento permanece no legado
- **AND** nenhuma campanha real entra no novo fluxo

### Requirement: Rollback e comportamento de campanhas já criadas

Desligar uma chave SHALL impedir apenas **novas** campanhas no caminho novo. Campanhas já criadas SHALL preservar o fluxo em que nasceram.

#### Scenario: Desligar chave não migra campanha existente

- **WHEN** a chave é desligada após uma campanha ter nascido no novo fluxo
- **THEN** essa campanha continua no novo fluxo
- **AND** campanhas nascidas no legado permanecem no legado

#### Scenario: Desligar chave impede novas campanhas no fluxo novo

- **WHEN** a chave é desligada
- **THEN** novas campanhas deixam de ser admitidas no novo fluxo
- **AND** novas campanhas voltam ao fluxo legado

### Requirement: Download pelo fluxo persistido e não reinterpretação de campos novos

O download SHALL ser decidido pelo **fluxo persistido** da campanha. Em falha de leitura das chaves, o sistema SHALL manter o legado **sem** reinterpretar campos exclusivos do novo formulário (intenção/fundo) como campos legados.

#### Scenario: Download segue o fluxo da campanha

- **WHEN** uma campanha é baixada
- **THEN** as regras de download correspondem ao fluxo em que a campanha nasceu
- **AND** o estado atual da flag não altera essas regras

#### Scenario: Campos novos não viram legados na falha de leitura

- **WHEN** a leitura das chaves falha e o formulário traz intenção/fundo explícitos
- **THEN** esses campos não são reinterpretados como campos legados
- **AND** o legado não é acionado com semântica trocada
