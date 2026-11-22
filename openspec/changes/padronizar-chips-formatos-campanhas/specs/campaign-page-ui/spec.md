## MODIFIED Requirements

### Requirement: Localização da interface da campanha pronta (pt-BR/es-419)

O sistema SHALL localizar os textos fixos da **entrega pronta** da campanha em `/campanhas/[id]` para `pt-BR` e `es-419`, reutilizando `getUiRenderContext` e `SupportedUiLocale` sem criar resolvedor concorrente nem alterar o timeout central. Os textos SHALL vir de um namespace próprio e isolado da rota, não reexportado pelo catálogo global do shell. Os chips de formato SHALL ser localizados em todos os estados da página pelo catálogo compartilhado, sem exigir a localização do restante da interface fora da entrega pronta.

- A localização SHALL derivar das **mesmas condições** que decidem qual view é renderizada. `ReadyView` (legado `ready`, inclusive `pending` sem `candidateImageUrl`/`candidateVersionId`) e `NewFlowDeliveredView` (`newFlow.state === "delivered"`) SHALL ser localizados; `CampaignApprovalView` (`pending` com candidata) e `RegeneratingView` NÃO SHALL ser localizados, exceto pelos chips de formato.
- O contêiner que inclui header/breadcrumb e a view pronta SHALL declarar `lang="es-419"` quando o locale da interface for `es-419`, de modo que header e breadcrumb traduzidos também estejam cobertos.
- Os chips de formato e suas explicações SHALL declarar `lang="es-419"` na própria região quando o locale for `es-419`, inclusive em `generating`, `stale`, `error`, `running`, `refunded`, `unknown`, `regenerating` e aprovação com candidata. Esses estados NÃO SHALL receber um wrapper `lang="es-419"` novo no restante da página.
- Nome do produto, caption, hashtags, CTA, título da copy, data, imagem e arquivo SHALL NOT ser traduzidos, regenerados ou recalculados. Conteúdo persistido SHALL receber `lang=""` para não herdar o idioma da interface.
- Textos de interface que permanecem em português (modo de edição do Kit, recuperação de copy e feedback de falha/cancelamento da copy) SHALL NOT ser traduzidos nesta entrega e SHALL receber `lang="pt-BR"` quando exibidos sob interface `es-419`. O `confirm()` nativo do navegador não é marcável.
- O rótulo de criação SHALL ser traduzido, mas a data SHALL manter o formato atual `dd/mm/aaaa`.
- A ação de copiar SHALL continuar escrevendo exatamente o conteúdo original no clipboard, com feedback `Copiado!` em pt-BR e `¡Copiado!` em es-419; a ação de baixar SHALL continuar usando `downloadUrl` e entregando o mesmo arquivo.
- Estados fora do recorte (`generating`, `stale`, `error`, `running`, `refunded`, `unknown`, `regenerating`, aprovação com candidata) NÃO SHALL ter os demais textos traduzidos nesta entrega; somente os chips de formato e suas explicações usam o catálogo localizado.

#### Scenario: es-419 na entrega pronta

- **WHEN** um usuário com `uiLocale=es-419` abre uma campanha que renderiza `ReadyView` ou `NewFlowDeliveredView`
- **THEN** breadcrumb, título de fallback, rótulo de criação, Kit de Publicación, badge, aviso fixo, ação de copiar, chips de formato e `Descargar original` aparecem em espanhol neutro LATAM
- **AND** o contêiner da página declara `lang="es-419"`

#### Scenario: pt-BR preservado

- **WHEN** um usuário com `uiLocale=pt-BR` abre a mesma entrega pronta
- **THEN** os textos fixos existentes são exatamente os anteriores
- **AND** os novos nomes e estados dos chips de formato seguem o catálogo aprovado desta change
- **AND** nenhum `lang="es-419"` é declarado

#### Scenario: pending sem candidata continua em ReadyView e é localizado

- **WHEN** uma campanha legada `ready` tem aprovação `pending` sem `candidateImageUrl`/`candidateVersionId`
- **THEN** a página continua renderizando `ReadyView`
- **AND** a interface da entrega é localizada conforme o locale

#### Scenario: chips são localizados em estados fora da entrega pronta

- **WHEN** a interface está em `es-419` e a página exibe `generating`, `running`, `refunded`, `unknown`, `regenerating` ou aprovação com candidata
- **THEN** nomes, estados e explicações dos chips de formato SHALL aparecer em espanhol neutro LATAM
- **AND** o restante desses estados SHALL permanecer em português como antes
- **AND** nenhum wrapper `lang="es-419"` novo SHALL ser aplicado fora da região dos chips

#### Scenario: conteúdo persistido não é traduzido nem herda espanhol

- **WHEN** a interface está em `es-419`
- **THEN** nome do produto, caption, hashtags, CTA e título da copy permanecem idênticos
- **AND** esses valores são marcados com `lang=""`
- **AND** copiar entrega o texto exato e baixar entrega o mesmo arquivo

#### Scenario: interface não traduzida sob es-419

- **WHEN** a interface está em `es-419` e a entrega pronta exibe modo de edição, recuperação de copy ou feedback de falha/cancelamento
- **THEN** esses textos permanecem em português
- **AND** são marcados com `lang="pt-BR"`

#### Scenario: estados fora do recorte mantêm o restante como antes

- **WHEN** a página exibe `generating`, `stale`, `error`, `running`, `refunded`, `unknown`, `regenerating` ou aprovação com candidata
- **THEN** os textos e o comportamento desses estados permanecem como antes, exceto pelos chips de formato
- **AND** nenhum wrapper `lang="es-419"` novo é aplicado ao restante da página

### Requirement: Detalhe da campanha conjunta com acesso individual por formato

O detalhe `/campanhas/[id]` SHALL reconhecer a campanha conjunta e exibir os formatos `1:1` e `9:16` por meio dos chips compartilhados, sempre presentes, com estados independentes e seleção por `?format=1:1|9:16`. Os chips SHALL ser compactos: texto visível apenas “Quadrado 1:1”/“Vertical 9:16”; rótulos de estado e badge “Selecionado” NÃO SHALL aparecer no chip. O estado completo SHALL permanecer no nome/descrição acessível e na ajuda. O formato ativo SHALL ter borda/fundo distintos de um formato apenas disponível, sem badge adicional. Cada formato entregue SHALL oferecer preview e download próprios. A copy SHALL ser exibida uma única vez e compartilhada pelos dois formatos. O formato em processamento SHALL usar indicador pequeno e manter o acompanhamento do servidor sem iniciar geração. O formato ausente SHALL permanecer em cinza legível; quando o crédito estiver comprovadamente devolvido, o estorno SHALL permanecer distinguível na descrição acessível/ajuda. O formato desconhecido SHALL usar indicador pequeno de dúvida e exibir verificação/suporte, sem recuperação de imagem e sem “Não gerado”. A ajuda SHALL ser flutuante, fora do fluxo, sem deslocar a arte ou criar overflow; o espaçamento entre chips e arte SHALL ser consistente. Formato não entregue NÃO SHALL receber link de preview/download nem ação de geração. O tratamento estrito de `?format=` SHALL ser preservado: inválido, vazio, duplicado ou não entregue NÃO SHALL cair silenciosamente no preferido.

#### Scenario: Detalhe conjunto mostra os dois chips

- **WHEN** o lojista abre o detalhe de uma campanha conjunta
- **THEN** o detalhe SHALL exibir chips para `1:1` e `9:16`
- **AND** a copy compartilhada SHALL aparecer uma única vez
- **AND** cada formato entregue SHALL ter preview e download individuais

#### Scenario: Formato escolhido na URL é pré-selecionado e destacado

- **WHEN** o detalhe é aberto com `?format=1:1` ou `?format=9:16`
- **THEN** o formato correspondente SHALL estar selecionado e ativo
- **AND** o chip ativo SHALL ter borda/fundo distintos de um chip apenas disponível
- **AND** SHALL NOT exibir badge visível “Selecionado”
- **AND** a seleção SHALL permanecer acessível
- **AND** o outro formato entregue SHALL continuar disponível para seleção

#### Scenario: Chips compactos e ajuda flutuante no detalhe

- **WHEN** o detalhe exibe os chips e a ajuda é aberta
- **THEN** o texto visível SHALL ser apenas o nome do formato
- **AND** a altura/posição da arte e dos chips SHALL permanecer inalterada
- **AND** a ajuda SHALL aparecer fora do fluxo, sem overflow e respeitando a viewport
- **AND** SHALL fechar no segundo acionamento, clique/toque fora ou `Escape`
- **AND** o espaçamento entre chips e arte SHALL ser consistente

#### Scenario: Parâmetro inválido falha fechado

- **WHEN** o detalhe é aberto com `?format=` inválido, vazio, duplicado ou de formato não entregue
- **THEN** SHALL NOT selecionar o formato preferido silenciosamente
- **AND** SHALL NOT assinar arte nem liberar preview/download do formato não entregue

#### Scenario: Entrega parcial não esconde o formato entregue

- **WHEN** o quadrado está entregue e o vertical está ausente com crédito devolvido
- **THEN** o detalhe SHALL exibir o quadrado com preview e download
- **AND** SHALL manter o vertical ausente e o crédito devolvido na descrição acessível e na ajuda
- **AND** SHALL NOT ocultar ou invalidar o quadrado

#### Scenario: Formato em processamento mantém acompanhamento

- **WHEN** um formato está em processamento
- **THEN** o chip SHALL usar indicador pequeno próprio de processamento
- **AND** o detalhe SHALL continuar acompanhando o estado persistido
- **AND** SHALL NOT iniciar nova geração

#### Scenario: Formato desconhecido não oferece recuperação de imagem

- **WHEN** um formato tem resultado desconhecido ou indisponível
- **THEN** o chip SHALL usar indicador pequeno de dúvida
- **AND** o detalhe SHALL exibir verificação/suporte
- **AND** SHALL NOT oferecer recuperação de imagem, nova geração ou o texto “Não gerado”

#### Scenario: Formato ausente não oferece geração nesta fatia

- **WHEN** um formato está ausente
- **THEN** o detalhe SHALL exibir chip compacto cinza legível, sem `+`
- **AND** SHALL NOT exibir “Não entregue”/“Não incluído” como texto visível no chip
- **AND** SHALL NOT oferecer modal, confirmação, custo ou ação de geração nesta fatia
- **AND** SHALL NOT receber link de preview ou download

## ADDED Requirements

### Requirement: Detalhe de campanha individual e legada com os dois formatos

O detalhe de campanha individual ou legada SHALL exibir os dois chips compartilhados sem inventar um segundo formato entregue. Os chips SHALL ser compactos: texto visível apenas “Quadrado 1:1”/“Vertical 9:16”; rótulos de estado e badge “Selecionado” NÃO SHALL aparecer no chip. O estado completo SHALL permanecer no nome/descrição acessível e na ajuda flutuante. O formato persistido SHALL respeitar o estado e os gates atuais da campanha. O outro formato SHALL permanecer em cinza legível como não incluído, sem `+`, sem promessa de geração e sem link de preview/download. Campanhas individuais e legadas SHALL manter seu acesso atual à arte e ao download do formato existente. O detalhe SHALL refletir `processing`, `refunded`, `unknown` e `unavailable` de forma honesta, sem “Não gerado” para indeterminação. `error` e `stale` NÃO SHALL comprovar ausência: sem evidência explícita de estorno, o formato SHALL ser `unknown`. Aprovação `pending` com candidata SHALL manter o formato como `delivered`, sem ativo e com o gate existente; `regenerating` SHALL exibir `processing`, sem ativo. Ajuda e seleção SHALL ser independentes: acionar “?” NÃO SHALL navegar nem alternar o formato. Nenhuma leitura adicional SHALL ser feita para os chips.

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

#### Scenario: Ajuda e seleção são independentes

- **WHEN** o usuário aciona o “?” de um formato no detalhe
- **THEN** SHALL NOT navegar nem alternar o formato selecionado
- **AND** a ajuda flutuante SHALL abrir/fechar sem deslocar a arte
- **AND** o link de seleção do formato entregue SHALL permanecer inalterado

#### Scenario: Snapshot inválido não vira 1:1

- **WHEN** o snapshot é nulo, malformado, contém contrato desconhecido ou par incoerente
- **THEN** os dois chips SHALL indicar indisponibilidade ou indeterminação
- **AND** SHALL NOT aplicar fallback para `1:1`
