## MODIFIED Requirements

### Requirement: Uma solicitação escolhe um único formato

O sistema SHALL associar cada solicitação ao formato escolhido pelo lojista. O formato `1:1` SHALL permanecer no caminho atual, sem mudança funcional de entrada, resposta, crédito ou entrega. O formato `9:16` SHALL usar o orquestrador de duas etapas. A entrega conjunta `1:1+9:16` SHALL usar um orquestrador dedicado e SHALL ser a única exceção autorizada a dois formatos na mesma solicitação inicial. Uma campanha `1:1` já entregue — do fluxo novo ou legada com fonte 1024 compatível — PODE adquirir o `9:16` posteriormente por um orquestrador dedicado de formato adicional, com operação própria; essa aquisição posterior SHALL NOT ser tratada como solicitação conjunta nem como pedido de nova campanha. O sistema SHALL NOT gerar dois formatos fora do contrato conjunto, SHALL NOT adquirir outros formatos fora do contrato de adição posterior e SHALL NOT converter uma campanha existente de um formato para outro.

#### Scenario: 1:1 permanece no caminho atual

- **WHEN** uma solicitação é enviada com formato `1:1`
- **THEN** o sistema SHALL usar o orquestrador atual do Produto 1:1
- **AND** SHALL NOT abrir operação `9_16_two_stage`, reservar crédito vertical ou carregar o módulo de expansão

#### Scenario: 9:16 usa o orquestrador novo

- **WHEN** uma solicitação é enviada com formato `9:16` e o novo caminho está habilitado
- **THEN** o sistema SHALL abrir uma operação `9_16_two_stage`
- **AND** SHALL executar base, preparação, expansão e entrega vertical
- **AND** SHALL NOT chamar o orquestrador completo 1:1 para gerar a base

#### Scenario: Entrega conjunta usa o orquestrador dedicado

- **WHEN** uma solicitação é enviada com o contrato `1:1+9:16` e a geração vertical está habilitada
- **THEN** o sistema SHALL usar o orquestrador dedicado da entrega conjunta
- **AND** SHALL gerar a base quadrada uma única vez e reutilizá-la no 1:1 e no 9:16
- **AND** SHALL NOT tratar a solicitação como um pedido 9:16 individual

#### Scenario: Adição posterior usa o orquestrador de formato adicional

- **WHEN** uma campanha `1:1` já entregue recebe uma adição `9:16` por ação explícita do lojista
- **THEN** o sistema SHALL usar o orquestrador dedicado de formato adicional
- **AND** SHALL abrir uma única operação `9_16_two_stage` com 1 crédito próprio
- **AND** SHALL reutilizar a fonte quadrada entregue, sem gerar outra base
- **AND** SHALL NOT usar o contrato conjunto nem reservar dois formatos

#### Scenario: Adição posterior em campanha legada 1024

- **WHEN** uma campanha legada com fonte 1024 compatível recebe uma adição `9:16`
- **THEN** o sistema SHALL usar o mesmo orquestrador de formato adicional
- **AND** SHALL registrar a origem histórica e a identidade sintética da fonte
- **AND** SHALL NOT exigir operação financeira original
- **AND** SHALL NOT converter o formato da campanha

#### Scenario: Dois formatos fora do contrato são recusados

- **WHEN** uma solicitação tenta declarar ou adquirir mais de um formato fora do contrato conjunto exato ou do contrato de adição posterior
- **THEN** o sistema SHALL recusar sem abrir operação, reservar crédito ou chamar provider

#### Scenario: Conversão continua proibida

- **WHEN** uma campanha existente `9:16` tenta adquirir o `1:1` ou uma campanha histórica tenta converter seu formato
- **THEN** o sistema SHALL recusar
- **AND** SHALL NOT criar operação, reservar crédito ou alterar o snapshot
