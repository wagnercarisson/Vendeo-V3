## MODIFIED Requirements

### Requirement: Card único com indicadores de formato para campanha conjunta

A listagem `/campanhas` SHALL exibir no máximo um card por campanha, inclusive quando a campanha for conjunta ou tiver recebido um formato adicional posteriormente. O card SHALL exibir sempre os dois chips informativos `1:1` e `9:16`, com estados independentes (`delivered`, `processing`, `absent`, `unknown` ou `unavailable`), usando o componente compartilhado e a mesma linguagem do dashboard e do detalhe. Os chips SHALL ser compactos: texto visível apenas “Quadrado 1:1”/“Vertical 9:16”; rótulos de estado e badge “Selecionado” NÃO SHALL aparecer no chip. O estado completo SHALL permanecer no nome/descrição acessível. Formato entregue SHALL ter destaque discreto; ausente SHALL permanecer em cinza legível; processamento e indeterminação PODEM usar indicador pequeno, sem frase longa. Estorno conhecido SHALL permanecer distinguível. A ajuda SHALL ser flutuante, fora do fluxo, sem aumentar a altura do card, quebrar a linha dos chips, deslocar a miniatura ou criar overflow horizontal. Os chips NÃO SHALL ser links nem navegar individualmente por formato; cada chip SHALL ser um `<button type="button">` cujo toque abre/fecha apenas a explicação local. NÃO SHALL existir controle “?” separado. A campanha conjunta com os dois formatos solicitados e apenas um entregue SHALL ser apresentada como parcial, sem duplicar o card. Campanha individual NÃO SHALL ser apresentada como parcial, mesmo quando o formato adicional tiver sido entregue posteriormente; o card SHALL refletir o vertical como `delivered` nesse caso, sem modal, custo, geração ou navegação por chip. `status = error` NÃO SHALL ser convertido em ausência sem evidência explícita; nesse caso o formato SHALL ser `unknown`. As ações existentes de abrir campanha e baixar SHALL ser preservadas.

#### Scenario: Campanha aparece uma única vez

- **WHEN** a listagem contém uma campanha conjunta, individual ou legada
- **THEN** exatamente um card SHALL ser renderizado
- **AND** o card SHALL exibir chips para `1:1` e `9:16`
- **AND** SHALL NOT renderizar um card separado por formato

#### Scenario: Chips são botões de explicação e não navegam

- **WHEN** o usuário toca ou aciona um chip de formato no card
- **THEN** o chip `<button type="button">` SHALL abrir/fechar apenas a ajuda local
- **AND** SHALL NOT haver navegação para `/campanhas/[id]?format=...`
- **AND** SHALL NOT iniciar geração, reserva, modal ou chamada ao provider
- **AND** NÃO SHALL existir controle “?” separado

#### Scenario: Formato entregue tem destaque discreto e nome compacto

- **WHEN** um formato da campanha está `delivered`
- **THEN** o chip SHALL exibir apenas o nome do formato como texto visível
- **AND** SHALL aplicar destaque visual discreto de disponibilidade
- **AND** o estado “Disponível” SHALL permanecer no nome/descrição acessível
- **AND** SHALL NOT exibir o rótulo visível “Disponível” nem ícone redundante

#### Scenario: Ajuda flutuante não desloca o card

- **WHEN** a ajuda de um chip é aberta por hover, foco ou toque
- **THEN** a altura do card, a linha dos chips e a posição da miniatura SHALL permanecer inalteradas
- **AND** a ajuda SHALL aparecer em camada flutuante, sem overflow horizontal
- **AND** SHALL fechar no segundo acionamento do chip-botão, clique/toque fora ou `Escape`
- **AND** NÃO SHALL existir controle “?” separado

#### Scenario: Formato em processamento não inicia geração

- **WHEN** um formato está em processamento
- **THEN** o chip SHALL exibir o estado com indicador próprio
- **AND** SHALL NOT iniciar nova geração, reserva ou chamada ao provider

#### Scenario: Formato ausente é compacto e sem ação

- **WHEN** um formato está ausente
- **THEN** o card SHALL exibir o chip compacto em cinza legível, sem `+`
- **AND** SHALL NOT exibir “Não incluído”/“Não entregue” como texto visível no chip
- **AND** a ausência e o motivo SHALL permanecer no nome/descrição acessível
- **AND** SHALL NOT oferecer modal, confirmação, custo ou ação de geração

#### Scenario: Estorno conhecido permanece distinguível

- **WHEN** um formato ausente tem estorno conhecido
- **THEN** o chip SHALL permanecer visualmente distinto de uma ausência simples
- **AND** o crédito devolvido SHALL permanecer no nome/descrição acessível e na ajuda
- **AND** SHALL NOT esconder o estorno como ausência simples

#### Scenario: Indeterminação não vira “Não gerado”

- **WHEN** o estado do formato é `unknown` ou `unavailable`
- **THEN** o chip SHALL indicar informação indisponível
- **AND** SHALL NOT exibir “Não gerado”

#### Scenario: Entrega parcial é identificada sem esconder o entregue

- **WHEN** uma campanha conjunta teve os dois formatos solicitados e exatamente um está entregue
- **THEN** o card SHALL indicar a entrega parcial
- **AND** o formato entregue SHALL permanecer acessível pelas ações existentes
- **AND** as ações “Abrir” e “Baixar” SHALL permanecer disponíveis conforme o estado atual

#### Scenario: Campanha individual não é parcial

- **WHEN** uma campanha individual está pronta com seu formato persistido entregue
- **THEN** o card SHALL exibir o formato entregue e o outro como não incluído
- **AND** SHALL NOT indicar entrega parcial

#### Scenario: Vertical adicionado posteriormente é refletido

- **WHEN** uma campanha individual ou legada `1:1` recebeu um vertical `9:16` entregue
- **THEN** o card SHALL manter um único card
- **AND** o chip `9:16` SHALL ser `delivered`
- **AND** o chip `1:1` SHALL permanecer `delivered`
- **AND** o card SHALL NOT ser apresentado como parcial
- **AND** SHALL NOT oferecer modal, custo, geração ou navegação por chip

#### Scenario: Adição em processamento ou com estorno

- **WHEN** a adição de uma campanha individual está em processamento ou terminou em estorno conhecido
- **THEN** o chip `9:16` SHALL refletir `processing` ou `absent` com estorno
- **AND** o chip `1:1` SHALL permanecer `delivered`
- **AND** o chip SHALL NOT iniciar geração nem abrir modal

#### Scenario: Erro da campanha não vira ausência

- **WHEN** uma campanha individual ou legada está com `status = error` e não há evidência explícita de estorno
- **THEN** o chip do formato persistido SHALL exibir `unknown`
- **AND** SHALL NOT exibir `absent/not_delivered` nem “Não gerado”

#### Scenario: Mesmos nomes e vocabulário do dashboard e detalhe

- **WHEN** a mesma campanha é exibida na listagem, no dashboard e no detalhe
- **THEN** os nomes dos formatos e o vocabulário dos estados SHALL ser os mesmos nas três superfícies
- **AND** um estado `unknown` causado por menor evidência SHALL usar o mesmo rótulo, mesmo que o detalhe tenha mais informação
