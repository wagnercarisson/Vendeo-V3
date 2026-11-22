## MODIFIED Requirements

### Requirement: Campanha conjunta elegível no dashboard sem duplicar card

O dashboard SHALL considerar elegível a campanha conjunta com pelo menos um formato entregue e `status = ready`. A campanha conjunta SHALL aparecer no máximo uma vez entre as campanhas recentes, sem criar uma linha por formato. Toda campanha disponível no dashboard — conjunta, individual ou legada — SHALL exibir sempre os dois chips informativos `1:1` e `9:16`, com os mesmos nomes, vocabulário e semântica de estados da listagem e do detalhe. Os chips SHALL ser compactos: texto visível apenas “Quadrado 1:1”/“Vertical 9:16”; rótulos de estado e badge “Selecionado” NÃO SHALL aparecer no chip. O estado completo SHALL permanecer no nome/descrição acessível. A ajuda SHALL ser flutuante, fora do fluxo, sem aumentar a altura da linha, deslocar miniatura/ações ou criar overflow horizontal. Cada chip SHALL ser um `<button type="button">` que abre/fecha apenas a explicação local; NÃO SHALL existir controle “?” separado. O dashboard PODE ter menos evidência que o detalhe e exibir `unknown` onde o detalhe exibe `absent` + `refunded`, sem adicionar consulta. Os chips NÃO SHALL iniciar geração, abrir modal, produzir efeito financeiro ou navegar individualmente por formato nesta fatia. A contagem de campanhas disponíveis SHALL contar a campanha uma única vez. A miniatura SHALL ser derivada, com preferência para o quadrado quando entregue. A ação de abertura SHALL permanecer disponível mesmo quando apenas um formato estiver entregue ou a miniatura estiver indisponível. A apresentação dos chips SHALL usar somente os dados já carregados, sem nova consulta por card.

#### Scenario: Campanha conjunta parcial aparece uma vez

- **WHEN** a campanha conjunta está `ready` com o quadrado entregue e o vertical ausente
- **THEN** o dashboard SHALL exibir uma única linha para a campanha
- **AND** SHALL indicar os dois formatos
- **AND** a contagem SHALL incrementar uma única vez

#### Scenario: Campanha individual ou legada também mostra os dois formatos

- **WHEN** o dashboard exibe uma campanha individual ou legada disponível
- **THEN** a linha SHALL exibir chips para `1:1` e `9:16`
- **AND** o formato não incluído SHALL aparecer em cinza, sem `+` e sem promessa de geração
- **AND** a campanha individual pronta NÃO SHALL ser apresentada como parcial

#### Scenario: Chips compactos e ajuda flutuante

- **WHEN** a linha do dashboard exibe os chips
- **THEN** o texto visível SHALL ser apenas o nome do formato
- **AND** rótulos de estado/badge NÃO SHALL aparecer no chip
- **AND** cada chip SHALL ser um `<button type="button">` que abre/fecha apenas a ajuda local
- **AND** a ajuda SHALL abrir em camada flutuante sem alterar a altura da linha, a miniatura ou as ações
- **AND** SHALL fechar no segundo acionamento, clique/toque fora ou `Escape`
- **AND** NÃO SHALL existir controle “?” separado

#### Scenario: Chips são informativos e não navegam

- **WHEN** o usuário aciona um chip de formato no dashboard
- **THEN** SHALL NOT haver navegação para `/campanhas/[id]?format=...`
- **AND** SHALL NOT iniciar geração, reserva, modal ou chamada ao provider

#### Scenario: Estorno e indeterminação permanecem visíveis

- **WHEN** um formato está ausente com estorno conhecido ou tem estado `unknown`/`unavailable`
- **THEN** o chip SHALL informar o crédito devolvido ou a indisponibilidade de informação
- **AND** SHALL NOT exibir “Não gerado” para estados indeterminados

#### Scenario: Nomes e vocabulário são os mesmos da listagem e do detalhe

- **WHEN** a mesma campanha é exibida no dashboard, na listagem e no detalhe
- **THEN** os nomes dos formatos e o vocabulário dos estados SHALL ser os mesmos nas três superfícies
- **AND** um estado `unknown` causado por menor evidência no dashboard SHALL usar o mesmo rótulo do detalhe
- **AND** em `es-419` os textos SHALL vir do catálogo compartilhado em espanhol

#### Scenario: Miniatura quadrada é preferida no dashboard

- **WHEN** o quadrado está entregue e possui miniatura derivada
- **THEN** o dashboard SHALL exibir a miniatura do quadrado
- **AND** SHALL NOT usar o original como fallback

#### Scenario: Abertura permanece disponível sem miniatura

- **WHEN** a miniatura está indisponível
- **THEN** o dashboard SHALL exibir o fallback visual
- **AND** a ação “Abrir campanha” SHALL permanecer disponível

#### Scenario: Campanha sem formato entregue não entra no dashboard

- **WHEN** a campanha conjunta não possui nenhum formato entregue
- **THEN** o dashboard SHALL NOT exibi-la entre as campanhas elegíveis
