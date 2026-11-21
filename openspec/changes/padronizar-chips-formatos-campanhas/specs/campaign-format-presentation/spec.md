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

O componente compartilhado SHALL comunicar o estado por texto e forma, não apenas por cor. Formato entregue SHALL ter aparência de disponível. No detalhe, o formato ativo SHALL ter destaque distinto de um formato apenas disponível. Formato ausente SHALL aparecer em cinza, sem `+` e sem promessa de geração. Processamento SHALL ter indicador próprio e não SHALL parecer entregue. Estados `unknown`/`unavailable` SHALL indicar informação indisponível e NUNCA exibir “Não gerado”. Estorno conhecido SHALL permanecer visível, não escondido como ausência simples.

#### Scenario: Formato entregue tem aparência de disponível

- **WHEN** um chip representa `delivered`
- **THEN** SHALL exibir o nome do formato e o rótulo de disponibilidade
- **AND** SHALL usar ícone e texto além do token de cor

#### Scenario: Formato ativo é distinto no detalhe

- **WHEN** o detalhe exibe um formato entregue selecionado
- **THEN** esse chip SHALL receber destaque visual e semântico de seleção
- **AND** o destaque SHALL ser distinto de um chip apenas disponível
- **AND** SHALL NOT depender exclusivamente de cor

#### Scenario: Formato ausente é cinza e sem promessa de geração

- **WHEN** um chip representa `absent`
- **THEN** SHALL aparecer em cinza, com ícone neutro e sem `+`
- **AND** SHALL NOT exibir CTA, modal ou promessa de geração

#### Scenario: Processamento não parece entrega

- **WHEN** um chip representa `processing`
- **THEN** SHALL exibir um indicador próprio de processamento
- **AND** SHALL NOT usar a aparência de disponível

#### Scenario: Unknown e unavailable não são “Não gerado”

- **WHEN** um chip representa `unknown` ou `unavailable`
- **THEN** SHALL indicar que a informação não está disponível
- **AND** SHALL NOT exibir “Não gerado”

#### Scenario: Estorno conhecido não é escondido

- **WHEN** um formato ausente tem estorno conhecido
- **THEN** o chip SHALL exibir o estado de ausência e a informação de crédito devolvido
- **AND** a explicação SHALL mencionar o estorno

### Requirement: Explicações acessíveis por hover, foco e toque

Cada chip SHALL oferecer uma explicação acessível do estado. A explicação SHALL estar disponível por hover e foco em desktop e por acionamento explícito em dispositivos de toque. O controle de explicação NÃO SHALL ser um botão desabilitado nem depender de um elemento não focável.

#### Scenario: Explicação por teclado

- **WHEN** o usuário navega por teclado até o controle de informação de um chip
- **THEN** o controle SHALL ser focável e SHALL expor nome acessível
- **AND** a ativação SHALL revelar a explicação do estado

#### Scenario: Explicação por toque

- **WHEN** o usuário toca no controle de informação em um dispositivo sem hover
- **THEN** a explicação SHALL ser revelada
- **AND** o alvo de toque SHALL ter no mínimo 44×44 px

#### Scenario: Explicação por hover e foco

- **WHEN** o usuário posiciona o ponteiro ou o foco sobre um chip com explicação
- **THEN** a explicação SHALL ficar acessível sem exigir clique
- **AND** o conteúdo SHALL permanecer legível no tema dark

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
