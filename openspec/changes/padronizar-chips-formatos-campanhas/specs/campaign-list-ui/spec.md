## MODIFIED Requirements

### Requirement: Localização da listagem (pt-BR e es-419)

A listagem de campanhas SHALL exibir os textos fixos no idioma da interface resolvido no servidor pela fundação existente (`getUiRenderContext` + `SupportedUiLocale`), sem criar seletor, detector, preferência ou resolvedor paralelo. A página SHALL passar ao Client Component apenas o namespace de textos da listagem, e esse namespace NÃO SHALL ser incorporado ao catálogo global do shell nem ao payload de outras rotas.

O namespace SHALL cobrir título, busca (placeholder e nome acessível), filtros de status e período (rótulos e nomes acessíveis), ordenação (rótulos e nome acessível), estados sem loja, sem campanhas e sem resultados de busca, rótulos de status do card, ações Abrir/Baixar, rótulos e explicações dos formatos `1:1` e `9:16`, rótulos da paginação e formatação de datas.

Identificadores de status, valores de parâmetros de URL, critérios de filtragem, ordenação, contagens, debounce, redirect de página vazia e regras de elegibilidade NÃO SHALL ser traduzidos ou alterados. Apenas os rótulos apresentados são localizados.

Nomes de produto, dados persistidos de campanha, textos comerciais e artes NÃO SHALL ser traduzidos. A região traduzida SHALL declarar `lang="es-419"` quando o idioma da interface for `es-419`; o nome do produto e o texto alternativo da miniatura SHALL usar `lang=""` para não herdar espanhol.

#### Scenario: Listagem em es-419 mantém as mesmas campanhas e ações

- **WHEN** um usuário com `uiLocale = "es-419"` acessa `/campanhas`
- **THEN** título, busca, filtros, ordenação, estados vazios, status, formatos, ações e paginação SHALL ser exibidos em `es-419`
- **AND** a mesma loja SHALL ver as mesmas campanhas, na mesma ordem e com as mesmas contagens do que em `pt-BR`
- **AND** os valores de URL, os filtros e o redirect de página vazia SHALL permanecer idênticos

#### Scenario: Listagem em pt-BR preserva textos e comportamento

- **WHEN** um usuário com `uiLocale = "pt-BR"` acessa `/campanhas`
- **THEN** os textos fixos existentes SHALL permanecer exatamente como antes
- **AND** os novos nomes e estados dos chips de formato SHALL seguir o catálogo aprovado desta change
- **AND** nenhuma região SHALL declarar `lang="es-419"`

#### Scenario: Status continuam distintos e com os mesmos critérios

- **WHEN** a listagem é exibida em qualquer um dos idiomas
- **THEN** `ready` SHALL exibir o rótulo de campanha pronta, campanha `error` do novo fluxo encerrada SHALL exibir o rótulo neutro de não concluída, e demais `error` SHALL exibir o rótulo de erro
- **AND** as cores e a regra de exibição SHALL permanecer inalteradas

#### Scenario: Chips de formato são localizados

- **WHEN** a listagem é exibida em `es-419`
- **THEN** os nomes dos formatos, rótulos de estado e explicações SHALL vir do catálogo compartilhado em espanhol neutro LATAM
- **AND** os mesmos estados e regras SHALL permanecer idênticos aos de `pt-BR`

#### Scenario: Nome do produto não herda o idioma da interface

- **WHEN** a listagem é exibida em `es-419`
- **THEN** o nome do produto e o texto alternativo da miniatura SHALL permanecer exatamente como persistidos
- **AND** ambos SHALL declarar `lang=""`

#### Scenario: Datas seguem o idioma sem nova política de fuso

- **WHEN** a listagem é exibida em `pt-BR` ou `es-419`
- **THEN** a data SHALL ser formatada no idioma da interface
- **AND** a política de fuso existente NÃO SHALL ser alterada por esta localização

### Requirement: Card único com indicadores de formato para campanha conjunta

A listagem `/campanhas` SHALL exibir no máximo um card por campanha, inclusive quando a campanha for conjunta. O card SHALL exibir sempre os dois chips informativos `1:1` e `9:16`, com estados independentes (`delivered`, `processing`, `absent`, `unknown` ou `unavailable`), usando o componente compartilhado e a mesma linguagem do dashboard e do detalhe. Os chips SHALL ser compactos: texto visível apenas “Quadrado 1:1”/“Vertical 9:16”; rótulos de estado e badge “Selecionado” NÃO SHALL aparecer no chip. O estado completo SHALL permanecer no nome/descrição acessível. Formato entregue SHALL ter destaque discreto; ausente SHALL permanecer em cinza legível; processamento e indeterminação PODEM usar indicador pequeno, sem frase longa. Estorno conhecido SHALL permanecer distinguível. A ajuda SHALL ser flutuante, fora do fluxo, sem aumentar a altura do card, quebrar a linha dos chips, deslocar a miniatura ou criar overflow horizontal. Os chips NÃO SHALL ser links nem navegar individualmente por formato. A campanha conjunta com os dois formatos solicitados e apenas um entregue SHALL ser apresentada como parcial, sem duplicar o card. Campanha individual NÃO SHALL ser apresentada como parcial: o outro formato é não incluído. `status = error` NÃO SHALL ser convertido em ausência sem evidência explícita; nesse caso o formato SHALL ser `unknown`. As ações existentes de abrir campanha e baixar SHALL ser preservadas.

#### Scenario: Campanha aparece uma única vez

- **WHEN** a listagem contém uma campanha conjunta, individual ou legada
- **THEN** exatamente um card SHALL ser renderizado
- **AND** o card SHALL exibir chips para `1:1` e `9:16`
- **AND** SHALL NOT renderizar um card separado por formato

#### Scenario: Chips são informativos e não navegam

- **WHEN** o usuário aciona um chip de formato no card
- **THEN** SHALL NOT haver navegação para `/campanhas/[id]?format=...`
- **AND** SHALL NOT iniciar geração, reserva, modal ou chamada ao provider

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
- **AND** SHALL fechar no segundo acionamento, clique/toque fora ou `Escape`

#### Scenario: Formato em processamento não inicia geração

- **WHEN** um formato está em processamento
- **THEN** o chip SHALL exibir o estado com indicador próprio
- **AND** SHALL NOT iniciar nova geração, reserva ou chamada ao provider

#### Scenario: Formato ausente é compacto e sem ação

- **WHEN** um formato está ausente
- **THEN** o card SHALL exibir o chip compacto em cinza legível, sem `+`
- **AND** SHALL NOT exibir “Não incluído”/“Não entregue” como texto visível no chip
- **AND** a ausência e o motivo SHALL permanecer no nome/descrição acessível
- **AND** SHALL NOT oferecer modal, confirmação, custo ou ação de geração nesta fatia

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

#### Scenario: Erro da campanha não vira ausência

- **WHEN** uma campanha individual ou legada está com `status = error` e não há evidência explícita de estorno
- **THEN** o chip do formato persistido SHALL exibir `unknown`
- **AND** SHALL NOT exibir `absent/not_delivered` nem “Não gerado”

#### Scenario: Mesmos nomes e vocabulário do dashboard e detalhe

- **WHEN** a mesma campanha é exibida na listagem, no dashboard e no detalhe
- **THEN** os nomes dos formatos e o vocabulário dos estados SHALL ser os mesmos nas três superfícies
- **AND** um estado `unknown` causado por menor evidência SHALL usar o mesmo rótulo, mesmo que o detalhe tenha mais informação
