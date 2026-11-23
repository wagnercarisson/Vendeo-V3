## MODIFIED Requirements

### Requirement: Detalhe de campanha individual e legada com os dois formatos

O detalhe de campanha individual ou legada SHALL exibir os dois chips compartilhados sem inventar um segundo formato entregue. Os chips SHALL ser compactos: texto visível apenas “Quadrado 1:1”/“Vertical 9:16”; rótulos de estado e badge “Selecionado” NÃO SHALL aparecer no chip. O estado completo SHALL permanecer no nome/descrição acessível e na ajuda flutuante. O formato persistido SHALL respeitar o estado e os gates atuais da campanha. Para campanha `1:1`, o chip `9:16` SHALL ser o único ponto de entrada da ação “Adicionar vertical 9:16”, disponível exclusivamente no detalhe; a listagem e o dashboard SHALL permanecer informativos. Antes da confirmação, o detalhe SHALL informar o custo de 1 crédito e SHALL NOT reservar, gerar ou chamar provider. Uma fonte compatível SHALL abrir a confirmação; uma fonte incompatível SHALL abrir uma explicação simples, sem promessa de adaptação futura. Após a confirmação, a modal SHALL acompanhar a operação e, ao concluir, apresentar a mesma campanha com o vertical selecionado, sem retornar ao preenchimento. O vertical entregue SHALL ser um link `<a>` com `href` para `?format=9:16`; o quadrado entregue SHALL ter `href` para `?format=1:1` quando houver adição. Operação em andamento SHALL abrir o acompanhamento existente sem nova cobrança; vertical já entregue SHALL abrir o resultado. Fechar a modal, perder conexão ou recarregar NÃO SHALL cancelar, estornar ou iniciar outra operação. O detalhe SHALL oferecer saída e retomada seguras, sem prender o usuário indefinidamente. Campanhas individuais e legadas SHALL manter seu acesso atual à arte e ao download do formato existente; uma falha da adição NUNCA SHALL ocultar, invalidar ou substituir o quadrado. O detalhe SHALL refletir `processing`, `refunded`, `unknown` e `unavailable` de forma honesta, sem “Não gerado” para indeterminação. `error` e `stale` NÃO SHALL comprovar ausência: sem evidência explícita de estorno, o formato SHALL ser `unknown`. Aprovação `pending` com candidata SHALL manter o formato como `delivered`, sem ativo e com o gate existente; `regenerating` SHALL exibir `processing`, sem ativo. No detalhe, o formato entregue **com `href`** SHALL ser um link `<a>` cujo toque seleciona em um único toque; o formato entregue sem href e o formato não entregue/excepcional SHALL ser um `<button type="button">` cujo toque abre a explicação ou a ação aplicável, sem navegar, gerar, continuar, reservar ou cobrar antes da confirmação. NÃO SHALL existir controle “?” separado. Nenhuma leitura adicional SHALL ser feita para os chips além da leitura de estado já resolvida pelo servidor.

#### Scenario: Legado quadrado pronto

- **WHEN** uma campanha legada tem snapshot objeto sem chaves de formato e está pronta
- **THEN** o chip `1:1` SHALL exibir nome compacto e destaque discreto de disponibilidade
- **AND** o chip `9:16` SHALL permanecer em cinza legível, sem rótulo visível de estado
- **AND** o estado “não incluído” SHALL permanecer acessível na descrição/ajuda
- **AND** o acesso atual à arte e ao download do quadrado SHALL permanecer inalterado

#### Scenario: Vertical individual pronto

- **WHEN** uma campanha individual `9:16` está pronta
- **THEN** o chip `9:16` SHALL exibir nome compacto, destaque discreto e borda/fundo de ativo
- **AND** SHALL NOT exibir badge “Selecionado”
- **AND** o chip `1:1` SHALL permanecer em cinza legível como não incluído
- **AND** SHALL NOT ser oferecida seleção de `1:1`

#### Scenario: Vertical por expansão não promete o quadrado

- **WHEN** uma campanha vertical foi produzida por expansão a partir de uma base quadrada
- **THEN** o chip `9:16` SHALL refletir a entrega vertical
- **AND** o chip `1:1` SHALL permanecer em cinza legível como não incluído
- **AND** a base quadrada NÃO SHALL ser apresentada como formato `1:1` entregue

#### Scenario: Geração em andamento

- **WHEN** a campanha individual está em geração
- **THEN** o chip do formato persistido SHALL usar indicador pequeno de processamento
- **AND** SHALL NOT parecer entregue nem iniciar nova geração
- **AND** o chip `9:16` de uma campanha `1:1` em geração SHALL NOT oferecer a adição

#### Scenario: Estorno conhecido no novo fluxo

- **WHEN** a operação individual persistida está estornada
- **THEN** o chip do formato persistido SHALL permanecer distinguível de ausência simples
- **AND** o crédito devolvido SHALL permanecer na descrição acessível e na ajuda
- **AND** o outro formato SHALL continuar como não incluído

#### Scenario: Erro ou staleness não comprovam ausência

- **WHEN** a campanha individual ou legada está `error` ou `stale` e não há evidência explícita de estorno
- **THEN** o chip do formato persistido SHALL usar indicador pequeno de `unknown`
- **AND** SHALL NOT exibir `absent/not_delivered` nem “Não gerado”
- **AND** SHALL NOT realizar consulta adicional para descobrir o motivo

#### Scenario: Aprovação pendente mantém o gate existente

- **WHEN** a campanha está pronta, mas a aprovação está `pending` com candidata
- **THEN** o chip do formato persistido SHALL permanecer com destaque discreto de disponibilidade
- **AND** NÃO SHALL receber estado ativo nem ação nova
- **AND** preview e download SHALL continuar governados pelo gate de aprovação existente

#### Scenario: Regeneração indica processamento

- **WHEN** a campanha está em `regenerating`
- **THEN** o chip do formato persistido SHALL usar indicador pequeno de processamento
- **AND** NÃO SHALL receber estado ativo nem ação nova
- **AND** SHALL NOT iniciar nova geração

#### Scenario: Resultado indeterminado

- **WHEN** o resultado da operação individual é desconhecido ou a leitura é indeterminada
- **THEN** o chip do formato persistido SHALL usar indicador pequeno de dúvida
- **AND** SHALL NOT exibir “Não gerado” nem oferecer recuperação de imagem
- **AND** a adição SHALL permanecer em acompanhamento/reconciliação, sem novo estorno ou geração automática

#### Scenario: Ajuda e seleção usam a semântica correta

- **WHEN** o usuário aciona um chip no detalhe
- **THEN** chip entregue (`<a>`) SHALL selecionar o formato em um único toque, sem abrir ajuda no primeiro toque
- **AND** chip não entregue/excepcional (`<button type="button">`) SHALL abrir/fechar a explicação aplicável ou iniciar a ação permitida somente quando a fonte for elegível
- **AND** a ajuda flutuante SHALL abrir/fechar sem deslocar a arte
- **AND** NÃO SHALL existir controle “?” separado

#### Scenario: Snapshot inválido não vira 1:1

- **WHEN** o snapshot é nulo, malformado, contém contrato desconhecido ou par incoerente
- **THEN** os dois chips SHALL indicar indisponibilidade ou indeterminação
- **AND** SHALL NOT aplicar fallback para `1:1`
- **AND** SHALL NOT oferecer a adição

#### Scenario: Campanha 1:1 elegível confirma com custo

- **WHEN** o lojista aciona o chip `9:16` de uma campanha `1:1` pronta com fonte 1024×1024 compatível, inclusive legada 1024 válida
- **THEN** o detalhe SHALL abrir a confirmação da adição com o custo de 1 crédito
- **AND** SHALL NOT reservar crédito, preparar ou chamar provider antes da confirmação
- **AND** SHALL permitir cancelar sem efeito
- **AND** SHALL NOT exigir a existência de uma operação financeira original na campanha legada

#### Scenario: Campanha incompatível explica sem promessa

- **WHEN** o lojista aciona o chip `9:16` de uma campanha `1:1` com fonte 1080×1080, inválida ou de contrato incompatível
- **THEN** o detalhe SHALL apresentar uma explicação simples da incompatibilidade
- **AND** SHALL NOT oferecer confirmação, custo, reserva, geração ou promessa de adaptação futura
- **AND** o quadrado e seu download SHALL permanecer disponíveis

#### Scenario: Confirmação acompanha a geração

- **WHEN** o lojista confirma a adição
- **THEN** a modal SHALL mudar para o acompanhamento da operação
- **AND** SHALL refletir o estado durável do servidor
- **AND** SHALL NOT retornar ao preenchimento da campanha
- **AND** ao concluir SHALL apresentar a mesma campanha com o vertical selecionado

#### Scenario: Operação em andamento abre acompanhamento

- **WHEN** o lojista reabre o detalhe com uma adição em andamento
- **THEN** o chip `9:16` SHALL indicar processamento
- **AND** o acionamento SHALL abrir o acompanhamento existente
- **AND** SHALL NOT reservar novo crédito nem iniciar outra expansão

#### Scenario: Vertical entregue abre o resultado

- **WHEN** o lojista aciona o chip `9:16` de uma campanha com adição entregue
- **THEN** o detalhe SHALL selecionar o vertical com `?format=9:16`
- **AND** SHALL exibir preview e download do vertical
- **AND** SHALL manter o quadrado acessível por `?format=1:1`
- **AND** SHALL NOT abrir modal de confirmação ou cobrança

#### Scenario: Fechar a modal não cancela nem estorna

- **WHEN** o lojista fecha a modal, recarrega a página ou perde a conexão durante a geração
- **THEN** o sistema SHALL NOT cancelar, estornar ou iniciar outra operação
- **AND** o estado durável SHALL permanecer disponível para nova consulta/retomada
- **AND** o quadrado SHALL permanecer acessível

#### Scenario: Falha definitiva preserva o quadrado

- **WHEN** a adição falha definitivamente e o crédito da adição é devolvido
- **THEN** o detalhe SHALL informar a falha e o estorno da adição
- **AND** SHALL manter o quadrado, a copy e o download existentes
- **AND** SHALL oferecer nova tentativa somente após o encerramento confirmado

#### Scenario: Saldo zero após a reserva mantém o acompanhamento

- **WHEN** o lojista confirma a adição com exatamente 1 crédito e o saldo disponível fica zero após a reserva
- **THEN** a modal SHALL continuar acompanhando a operação já reservada
- **AND** SHALL NOT exigir saldo adicional nem oferecer nova cobrança
- **AND** consulta, reconciliação e download SHALL permanecer acessíveis

#### Scenario: Replay antigo após estorno não reabre a ação

- **WHEN** o detalhe é recarregado com o estado `refunded` e uma requisição antiga é repetida
- **THEN** o detalhe SHALL mostrar o estorno conhecido
- **AND** SHALL NOT iniciar nova cobrança automaticamente
- **AND** uma nova tentativa SHALL exigir nova confirmação explícita de custo e um novo token emitido pelo servidor

#### Scenario: Rollback bloqueia nova adição e preserva a entrega

- **WHEN** a flag dedicada de adição está desligada
- **THEN** o detalhe SHALL NOT oferecer nova confirmação de adição
- **AND** SHALL manter preview/download do quadrado e de vertical já entregue
- **AND** SHALL manter o acompanhamento/finalização de operação já aberta
