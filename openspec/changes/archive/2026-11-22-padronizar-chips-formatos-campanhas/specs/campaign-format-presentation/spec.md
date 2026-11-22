## ADDED Requirements

### Requirement: Apresentação padronizada dos formatos 1:1 e 9:16

As superfícies de campanha — listagem `/campanhas`, campanhas disponíveis no dashboard e detalhe `/campanhas/[id]` — SHALL apresentar os dois formatos, **Quadrado 1:1** e **Vertical 9:16**, com a mesma linguagem, ordem, vocabulário e semântica de estados. Cada superfície SHALL exibir no máximo um conjunto de chips por campanha, sem duplicar a campanha ou criar uma linha por formato. As superfícies PODEM ter níveis diferentes de evidência: a lista/dashboard pode exibir `unknown` onde o detalhe, com a operação lida, exibe `absent` + `refunded`; o significado e os textos dos estados SHALL permanecer os mesmos.

#### Scenario: Listagem sempre mostra os dois formatos

- **WHEN** a listagem exibe uma campanha legada, uma campanha individual atual ou uma campanha conjunta
- **THEN** o card SHALL exibir chips para `1:1` e `9:16`
- **AND** os dois chips SHALL usar os mesmos nomes e o mesmo vocabulário de estados do componente compartilhado

#### Scenario: Dashboard sempre mostra os dois formatos

- **WHEN** o dashboard exibe uma campanha disponível
- **THEN** a linha SHALL exibir chips para `1:1` e `9:16`
- **AND** SHALL NOT criar uma linha adicional por formato

#### Scenario: Detalhe sempre mostra os dois formatos

- **WHEN** o lojista abre o detalhe de uma campanha em qualquer estado suportado
- **THEN** a página SHALL exibir chips para `1:1` e `9:16`
- **AND** os chips SHALL refletir os estados de entrega já resolvidos pelo servidor

#### Scenario: Superfícies podem ter níveis diferentes de evidência

- **WHEN** a lista/dashboard não possui a leitura de operação que o detalhe possui
- **THEN** a lista/dashboard PODE exibir `unknown` para um formato que o detalhe apresenta como `absent` + `refunded`
- **AND** ambas SHALL usar o mesmo vocabulário e a mesma semântica de `unknown`
- **AND** NÃO SHALL ser adicionada consulta extra para igualar o conhecimento entre as telas

### Requirement: Modelo de apresentação tipado e seguro

O sistema SHALL construir a apresentação a partir de um modelo tipado que recebe somente dados seguros de apresentação, nunca `input_snapshot`, credenciais, paths internos, URLs de Storage ou bytes de artefato. O modelo SHALL distinguir `delivered`, `processing`, `absent`, `unknown` e `unavailable`, SHALL registrar se o fluxo solicitou um ou dois formatos, SHALL carregar a informação de estorno quando conhecida e SHALL indicar o formato ativo apenas no detalhe. Entrega parcial SHALL significar que os dois formatos foram solicitados e apenas um foi entregue; campanha individual não SHALL ser classificada como parcial.

#### Scenario: Modelo recebe apenas dados seguros

- **WHEN** uma superfície monta a apresentação dos formatos
- **THEN** o componente SHALL receber estados, nomes de formato e a marcação de ativo/estorno
- **AND** SHALL NOT receber `input_snapshot`, `storage_path`, credenciais ou o conteúdo da arte

#### Scenario: Formato entregue é representado como disponível

- **WHEN** a autoridade confirma a entrega de um formato
- **THEN** o modelo SHALL representar aquele formato como `delivered`
- **AND** o outro formato SHALL manter o estado próprio da campanha

#### Scenario: Estorno é preservado no modelo

- **WHEN** a autoridade conhece o estorno do crédito de um formato ausente
- **THEN** o modelo SHALL representar o formato como `absent` com `refunded = true`
- **AND** SHALL NOT converter o formato em `delivered` ou `processing`

#### Scenario: Campanha individual não é parcial

- **WHEN** uma campanha individual está pronta com seu formato persistido entregue
- **THEN** o modelo SHALL registrar `flow = "single_format"`
- **AND** `partial` SHALL ser `false`
- **AND** o outro formato SHALL ser `absent/not_requested`, não uma falha de entrega

### Requirement: Semântica visual dos estados de formato

O componente compartilhado SHALL exibir normalmente apenas o nome do formato — **Quadrado 1:1** ou **Vertical 9:16**. Rótulos visíveis de estado (“Disponível”, “Não incluído”, “Não entregue”) e o badge “Selecionado” NÃO SHALL aparecer dentro do chip. Ícones de estado normal NÃO SHALL ser exibidos; estados excepcionais (`processing`, `unknown`, `refunded`) PODEM usar um indicador pequeno, sem frase longa dentro do chip. Formato entregue SHALL ter destaque discreto com **borda mais espessa/preenchimento**; formato ausente SHALL permanecer em cinza legível com borda simples; formato ativo no detalhe SHALL usar borda/fundo distintos, sem badge adicional. A distinção NÃO SHALL depender exclusivamente de cor: peso/estilo de borda, preenchimento e indicador SHALL complementar a matiz. O estado completo SHALL permanecer no modelo e nos nomes/descrições acessíveis. Estados `unknown`/`unavailable` NUNCA SHALL exibir “Não gerado”; estorno conhecido SHALL permanecer distinguível de ausência simples e de indeterminação.

#### Scenario: Formato entregue tem destaque discreto e nome compacto

- **WHEN** um chip representa `delivered`
- **THEN** SHALL exibir apenas o nome do formato como texto visível
- **AND** SHALL aplicar borda mais espessa/preenchimento discreto de disponibilidade
- **AND** o estado “Disponível” SHALL permanecer no nome/descrição acessível
- **AND** SHALL NOT exibir o rótulo visível “Disponível” nem ícone redundante

#### Scenario: Formato ativo é distinto sem badge

- **WHEN** o detalhe exibe um formato entregue selecionado
- **THEN** esse chip SHALL receber borda/fundo distintos de um chip apenas disponível
- **AND** SHALL NOT exibir o badge visível “Selecionado”
- **AND** a seleção SHALL permanecer acessível por `aria-current`/nome acessível
- **AND** SHALL NOT depender exclusivamente de cor

#### Scenario: Formato ausente é cinza legível e sem frase longa

- **WHEN** um chip representa `absent`
- **THEN** SHALL aparecer em cinza legível, com borda simples, sem `+`
- **AND** SHALL NOT exibir “Não incluído”/“Não entregue” como texto visível no chip
- **AND** a ausência e seu motivo SHALL permanecer no nome/descrição acessível
- **AND** SHALL NOT exibir CTA, modal ou promessa de geração
- **AND** a diferença para `delivered` SHALL incluir peso/estilo de borda ou preenchimento, não apenas cor

#### Scenario: Processamento usa indicador pequeno

- **WHEN** um chip representa `processing`
- **THEN** SHALL usar um indicador pequeno próprio de processamento
- **AND** SHALL NOT parecer entregue
- **AND** SHALL NOT exibir frase longa dentro do chip

#### Scenario: Unknown e unavailable usam dúvida discreta

- **WHEN** um chip representa `unknown` ou `unavailable`
- **THEN** SHALL usar indicador pequeno de dúvida/indisponibilidade
- **AND** SHALL manter a informação completa no nome/descrição acessível
- **AND** SHALL NOT exibir “Não gerado” nem frase longa

#### Scenario: Estorno conhecido permanece distinguível

- **WHEN** um formato ausente tem estorno conhecido
- **THEN** o chip SHALL permanecer visualmente distinto de uma ausência simples
- **AND** o crédito devolvido SHALL permanecer no nome/descrição acessível e na ajuda
- **AND** SHALL NOT depender exclusivamente de cor

### Requirement: Explicações acessíveis pelo próprio chip

Cada chip SHALL oferecer uma explicação acessível do estado sem controle “?” separado. Em desktop, a explicação SHALL estar disponível por hover e foco de teclado no próprio chip. Em dispositivos de toque, a semântica do chip SHALL decidir a ação: no detalhe, chip entregue **com `href`** SHALL ser um link `<a>` cujo toque seleciona a arte; chip entregue sem href e chip não entregue/excepcional SHALL ser um `<button type="button">` cujo toque abre/fecha apenas a explicação. Na lista/dashboard, o chip SHALL ser um `<button type="button">` que abre/fecha apenas a explicação. NÃO SHALL existir botão dentro de link, handler duplicado, controle invisível ou detecção de toque baseada apenas na largura da tela. O estado completo SHALL permanecer no nome/descrição acessível.

#### Scenario: Explicação por teclado no próprio chip

- **WHEN** o usuário navega por teclado até um chip
- **THEN** o chip SHALL ser focável e SHALL expor nome acessível com formato e estado
- **AND** o foco SHALL revelar a explicação sem deslocar layout
- **AND** `Escape` SHALL fechar e devolver o foco ao chip sem reabrir imediatamente

#### Scenario: Toque em formato entregue no detalhe seleciona

- **WHEN** o usuário toca no chip entregue no detalhe
- **THEN** o link `<a>` SHALL navegar/selecionar o formato em um único toque
- **AND** o primeiro toque NÃO SHALL ser interceptado para abrir ajuda
- **AND** NÃO SHALL exigir segundo toque, toque longo ou gesto oculto

#### Scenario: Toque em chip não entregue abre somente a explicação

- **WHEN** o usuário toca em chip `absent`, `processing`, `unknown` ou `unavailable` no detalhe
- **THEN** o chip `<button type="button">` SHALL abrir/fechar a explicação
- **AND** SHALL NOT navegar, gerar, continuar, reservar ou cobrar

#### Scenario: Toque na lista/dashboard explica sem navegar

- **WHEN** o usuário toca em um chip da lista ou do dashboard
- **THEN** o chip `<button type="button">` SHALL abrir/fechar apenas a explicação local
- **AND** SHALL NOT navegar por formato, gerar, reservar ou chamar provider

#### Scenario: Sem controle “?” separado

- **WHEN** qualquer superfície renderiza os chips
- **THEN** NÃO SHALL existir botão “?” separado, espaço reservado, borda ou área acionável independente
- **AND** NÃO SHALL existir botão invisível/órfão de foco
- **AND** o próprio chip SHALL ser o único controle de explicação

### Requirement: Ajuda flutuante sem deslocamento de layout

A explicação SHALL ser exibida em uma camada flutuante fora do fluxo do layout, ancorada no próprio chip, sem aumentar a altura do card, quebrar a linha dos chips, deslocar a arte ou criar overflow horizontal. O posicionamento SHALL respeitar a viewport e containers com `overflow`. A ajuda SHALL fechar por acionamento do chip que a abriu (quando botão), clique/toque fora e `Escape`, sem deixar conteúdo invisível focável nem foco perdido. Não SHALL haver dependência nova sem proposta e aprovação separadas; soluções existentes no projeto SHALL ser reutilizadas quando compatíveis.

#### Scenario: Abrir ajuda não desloca o card nem a arte

- **WHEN** a ajuda de qualquer chip é aberta
- **THEN** a altura do card, a linha dos chips, a posição da arte e a largura do contêiner SHALL permanecer inalteradas
- **AND** a ajuda SHALL aparecer fora do fluxo, sem criar overflow horizontal

#### Scenario: Posicionamento respeita viewport e overflow

- **WHEN** o chip está próximo da borda da viewport ou dentro de um container com `overflow`
- **THEN** a ajuda SHALL permanecer visível e dentro da viewport
- **AND** SHALL NOT ser cortada pelo container nem sobrepor ações de forma inutilizável

#### Scenario: Fechamento consistente

- **WHEN** a ajuda está aberta
- **THEN** ela SHALL fechar no acionamento do chip-botão que a abriu, em clique/toque fora e em `Escape`
- **AND** quando aberta por hover/foco, o primeiro clique/toque no chip-botão SHALL apenas fixá-la
- **AND** o foco SHALL permanecer previsível, sem elemento invisível focável

### Requirement: Lista e dashboard exibem chips informativos

Na listagem e no dashboard, os chips SHALL ser exclusivamente informativos. Eles NÃO SHALL iniciar geração, abrir modal, reservar crédito, produzir efeito financeiro ou navegar individualmente por formato nesta fatia. As ações existentes de abrir campanha e baixar SHALL ser preservadas.

#### Scenario: Chip não navega na listagem nem no dashboard

- **WHEN** o usuário aciona um chip de formato na listagem ou no dashboard
- **THEN** SHALL NOT haver navegação para `/campanhas/[id]?format=...`
- **AND** SHALL NOT iniciar geração, reserva ou chamada a provider

#### Scenario: Ações existentes permanecem

- **WHEN** o card ou a linha exibe uma campanha disponível
- **THEN** a ação de abrir campanha SHALL permanecer disponível
- **AND** a ação de baixar SHALL permanecer disponível conforme o estado atual
- **AND** a miniatura, o nome do produto e o layout do card SHALL permanecer funcionais

### Requirement: Apresentação sem efeitos mutáveis ao carregar

A renderização dos chips NÃO SHALL introduzir escrita, server action, RPC, reserva, geração, download de artefato, recuperação ou chamada a provider que não existissem antes. As leituras por RPC, a recuperação legada e o polling já condicionados pelo detalhe SHALL ser preservados como estão; os chips apenas reutilizam os dados já obtidos. A única interação adicional permitida é abrir/fechar a explicação local. Links do detalhe SHALL apenas navegar para a seleção de um formato já entregue.

#### Scenario: Carregar lista ou dashboard não muta estado

- **WHEN** a listagem ou o dashboard é carregado com chips de formato
- **THEN** os chips SHALL NOT introduzir escrita, reserva, RPC financeira, geração ou chamada a provider nova
- **AND** a apresentação SHALL ser derivada somente dos dados já carregados

#### Scenario: Chips do detalhe não criam efeitos novos

- **WHEN** o detalhe é carregado em qualquer estado, inclusive com leituras por RPC ou recuperação legada já existentes
- **THEN** os chips SHALL NOT introduzir geração, continuação, recuperação, RPC ou download novo
- **AND** as leituras, RPCs, recuperação e polling existentes SHALL permanecer inalterados

#### Scenario: Abrir a explicação é local

- **WHEN** o usuário abre ou fecha a explicação de um chip
- **THEN** a interação SHALL alterar somente o estado local de exibição
- **AND** SHALL NOT emitir requisição de geração, financeira ou de artefato

### Requirement: Detalhe preserva seleção, acesso e gates

No detalhe, a seleção entre formatos já entregues de campanhas conjuntas SHALL ser preservada. O formato ativo SHALL corresponder ao formato efetivamente exibido. Formato não entregue NÃO SHALL receber link de preview/download nem ação de geração. Campanhas individuais e legadas SHALL manter seu acesso atual ao formato existente. O tratamento estrito de `?format=` SHALL ser preservado: valor inválido, vazio, duplicado ou não entregue NÃO SHALL cair silenciosamente no formato preferido.

#### Scenario: Seleção conjunta é preservada

- **WHEN** uma campanha conjunta tem os dois formatos entregues e o detalhe é aberto com `?format=9:16`
- **THEN** o chip `9:16` SHALL estar ativo
- **AND** o preview e o download SHALL corresponder ao vertical
- **AND** o chip `1:1` SHALL continuar disponível para seleção

#### Scenario: Formato não entregue não recebe acesso

- **WHEN** um formato está `absent`, `processing`, `unknown` ou `unavailable`
- **THEN** o chip SHALL NOT ser link de preview ou download
- **AND** SHALL NOT disparar geração, continuação ou recuperação de imagem

#### Scenario: Individual e legada mantêm o acesso atual

- **WHEN** uma campanha individual ou legada é exibida no detalhe
- **THEN** o formato persistido SHALL manter o acesso atual à arte e ao download
- **AND** o outro formato SHALL aparecer como não incluído
- **AND** SHALL NOT ser criada seleção de um segundo formato não entregue

#### Scenario: Parâmetro de formato inválido falha fechado

- **WHEN** o detalhe conjunto recebe `?format=` inválido, vazio, duplicado ou de formato não entregue
- **THEN** SHALL NOT selecionar o formato preferido silenciosamente
- **AND** SHALL NOT assinar preview ou liberar download do formato não entregue

### Requirement: Autoridade dos dados de formato e entrega

A apresentação SHALL classificar o fluxo conjunto antes do resolvedor individual. Campanhas conjuntas SHALL reutilizar o read model e os estados de entrega existentes. Campanhas individuais e legadas SHALL respeitar o formato persistido, o estado e os gates atuais. Formato solicitado ou identificado NÃO SHALL equivaler a arte entregue. O sistema NÃO SHALL inferir formato por nome de arquivo, `storage_path`, miniatura ou proporção. Snapshot objeto sem chaves de formato PODE seguir o contrato histórico `1:1` já reconhecido pelo resolvedor; snapshot nulo, malformado, contrato desconhecido ou incoerente NÃO SHALL ganhar fallback novo para `1:1`. Dados insuficientes SHALL ser representados como indeterminação honesta.

#### Scenario: Conjunta é classificada antes do individual

- **WHEN** o snapshot declara o contrato conjunto `1:1+9:16`
- **THEN** a apresentação SHALL usar o read model conjunto
- **AND** SHALL NOT tratar o valor conjunto como formato individual não suportado

#### Scenario: Snapshot histórico sem chaves é 1:1

- **WHEN** o snapshot é um objeto sem `campaignFormat` e sem `formatContractVersion`
- **THEN** o formato individual SHALL seguir o contrato histórico `1:1`
- **AND** o outro formato SHALL aparecer como não incluído

#### Scenario: Snapshot nulo ou malformado não vira 1:1

- **WHEN** o snapshot é nulo, malformado, contém contrato desconhecido ou par incoerente
- **THEN** os dois formatos SHALL ser representados como `unavailable` ou `unknown`
- **AND** SHALL NOT aplicar fallback para `1:1`

#### Scenario: Formato identificado não é arte entregue

- **WHEN** o formato persistido é conhecido, mas a entrega não está confirmada
- **THEN** o chip SHALL refletir o estado de entrega (`processing`, `absent`, `unknown` ou `unavailable`)
- **AND** SHALL NOT exibir disponibilidade apenas pelo formato identificado

#### Scenario: Erro da campanha não comprova ausência

- **WHEN** a campanha está com erro e não há evidência explícita de estorno ou de entrega do formato
- **THEN** o chip SHALL representar o formato como `unknown`
- **AND** SHALL NOT converter o erro em `absent/not_delivered`
- **AND** o detalhe PODE exibir `absent` + `refunded` somente quando a operação persistida fornecer essa evidência sem consulta adicional

#### Scenario: Caminho ou miniatura não inferem formato

- **WHEN** existe `storage_path`, nome de arquivo, miniatura ou proporção de imagem
- **THEN** a apresentação SHALL ignorar esses dados para determinar formato ou entrega
- **AND** SHALL usar apenas as autoridades de formato e entrega existentes

### Requirement: Elegibilidade futura fora da apresentação

Esta apresentação NÃO SHALL determinar, prometer ou negar elegibilidade de uma campanha para receber outro formato. O sistema NÃO SHALL adicionar consultas de artefatos, sondas ou downloads de bytes para descobrir elegibilidade. A ausência de um formato NÃO SHALL ser apresentada como incompatibilidade definitiva com base apenas na idade da campanha ou em uma falha temporária de leitura.

#### Scenario: Apresentação não sonda artefatos

- **WHEN** a listagem, o dashboard ou o detalhe montam os chips
- **THEN** SHALL NOT consultar artefatos, baixar bytes ou reconstruir base quadrada
- **AND** SHALL NOT prometer geração futura de outro formato

#### Scenario: Falha temporária não vira incompatibilidade definitiva

- **WHEN** a leitura de um formato é temporariamente indeterminada
- **THEN** o chip SHALL indicar informação indisponível
- **AND** SHALL NOT declarar que a campanha nunca poderá receber aquele formato

#### Scenario: Idade da campanha não decide elegibilidade

- **WHEN** uma campanha é legada ou antiga
- **THEN** a apresentação SHALL NOT usar a idade como prova de incompatibilidade
- **AND** SHALL limitar-se ao formato e ao estado persistidos

### Requirement: Leitura em lote e sem N+1

A apresentação SHALL reutilizar a leitura conjunta em lote já existente e priorizar dados já disponíveis. Os chips NÃO SHALL adicionar consultas de banco, Storage, RPC, recuperação ou artefato por card. A prova de desempenho SHALL comparar a mesma página antes/depois dos chips para o mesmo conjunto de campanhas e exigir zero chamadas adicionais causadas pela apresentação. A assinatura de miniaturas legadas já pode variar com a quantidade de campanhas e NÃO SHALL ser usada como baseline constante da página inteira. Se algum estado exigir consulta adicional, o design SHALL justificar, limitar o escopo e definir prova de contagem antes da implementação.

#### Scenario: Chips não adicionam consulta por card

- **WHEN** a mesma listagem ou o mesmo dashboard é renderizado antes e depois da apresentação dos chips
- **THEN** os chips SHALL causar zero chamadas adicionais de banco/Storage/RPC
- **AND** os chips SHALL ser derivados dos dados já retornados

#### Scenario: Leitura conjunta permanece em lote

- **WHEN** existem várias campanhas conjuntas na página
- **THEN** os estados conjuntos SHALL ser lidos em lote
- **AND** SHALL NOT existir uma consulta por campanha ou por formato causada pelos chips

### Requirement: Localização e responsividade dos chips

Os nomes dos formatos, rótulos de estado e explicações SHALL ser localizados em `pt-BR` e `es-419`, usando o mesmo catálogo compartilhado nas três superfícies. O layout SHALL ser responsivo e NÃO SHALL prejudicar nomes de produto, ações ou miniaturas.

#### Scenario: Mesmos nomes e vocabulário nas três superfícies

- **WHEN** a interface está em `pt-BR` ou `es-419`
- **THEN** listagem, dashboard e detalhe SHALL exibir os mesmos nomes de formato e o mesmo vocabulário de estados
- **AND** os textos SHALL vir do catálogo compartilhado
- **AND** um estado diferente por falta de evidência SHALL usar o mesmo rótulo de `unknown`, não um texto alternativo

#### Scenario: Layout responsivo preserva o card

- **WHEN** a tela é estreita ou os chips quebram para outra linha
- **THEN** nome do produto, miniatura e ações SHALL permanecer legíveis e acionáveis
- **AND** SHALL NOT haver overflow horizontal causado pelos chips
