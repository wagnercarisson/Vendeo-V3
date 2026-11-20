# product-two-format-campaign-orchestration Specification

## Purpose

TBD - created by archiving change f60-7-entrega-conjunta-formatos-1-1-9-16. Update Purpose after archive.

## Requirements

### Requirement: Requisição conjunta explícita e isolada

O sistema SHALL aceitar uma solicitação de entrega conjunta somente quando o formato declarado for exatamente `1:1+9:16` com a versão de contrato conjunta reconhecida, no fluxo novo e com a geração vertical habilitada. A solicitação conjunta SHALL originar uma única campanha, um único briefing congelado e uma única copy compartilhada. O sistema SHALL NOT aceitar lista arbitrária de formatos, formato conjunto fora do fluxo novo ou campanha conjunta sem a versão reconhecida. Os pedidos `1:1` e `9:16` individuais SHALL permanecer nos caminhos atuais.

#### Scenario: Entrega conjunta aceita uma única vez

- **WHEN** uma solicitação do fluxo novo declara `campaignFormat: "1:1+9:16"` e a versão de contrato conjunta reconhecida
- **THEN** o sistema SHALL criar ou reutilizar uma única campanha
- **AND** SHALL persistir um único briefing congelado
- **AND** SHALL usar uma única copy compartilhada

#### Scenario: Lista arbitrária de formatos é recusada

- **WHEN** uma solicitação tenta declarar uma lista de formatos, dois formatos fora do contrato conjunto ou um par incoerente
- **THEN** o sistema SHALL recusar antes de reservar crédito, criar operação ou chamar provider

#### Scenario: Fluxos individuais permanecem isolados

- **WHEN** uma solicitação declara `1:1` ou `9:16` individual
- **THEN** o sistema SHALL usar o caminho individual correspondente
- **AND** SHALL NOT abrir operação conjunta nem reservar o segundo crédito

### Requirement: Base quadrada gerada uma única vez e reutilizada

O sistema SHALL executar a etapa `base` uma única vez na operação conjunta. A arte `square_original` 1024×1024 SHALL ser a entrega 1:1 e a fonte canônica da preparação e da expansão vertical. O sistema SHALL NOT gerar uma segunda arte quadrada para entrega, SHALL NOT duplicar a imagem em outro bucket e SHALL NOT entregar `square_prepared` 1152×1152. A copy SHALL ser gerada ou reutilizada uma única vez por operação.

#### Scenario: Uma chamada de base para os dois formatos

- **WHEN** uma operação conjunta nova executa a etapa `base`
- **THEN** no máximo uma chamada paga de imagem quadrada SHALL ocorrer
- **AND** a arte `square_original` resultante SHALL ser usada pela entrega 1:1 e pela preparação vertical
- **AND** nenhuma segunda arte quadrada SHALL ser gerada para entrega

#### Scenario: Copy compartilhada é reutilizada

- **WHEN** a copy da operação conjunta já está concluída
- **THEN** uma nova invocação SHALL reutilizar o texto persistido
- **AND** SHALL NOT gerar outra copy, outra imagem ou outro crédito

#### Scenario: Preparado interno não é entregue

- **WHEN** a entrega conjunta expõe as artes ao lojista
- **THEN** somente `square_original` e `vertical` SHALL ser acessíveis como entrega
- **AND** `square_prepared` SHALL permanecer interno

### Requirement: Publicação financeira usa o artefato canônico já persistido

A publicação financeira de cada formato SHALL ocorrer somente depois de o artefato canônico daquele formato estar persistido e verificado. A ordem SHALL ser: artefato persistido e verificado → aquisição do token de publicação → confirmação financeira + projeção. O token SHALL proteger a publicação financeira do artefato existente e SHALL NOT exigir novo upload, nova geração, nova cópia ou duplicação da imagem. `mark_art_uploaded` SHALL ser tratado como transição de estado financeiro, não como novo envio ao Storage.

#### Scenario: Quadrado já persistido é publicado sem novo upload

- **WHEN** a base terminou e o `square_original` está persistido e verificado
- **THEN** o sistema SHALL adquirir o token de publicação para a identidade financeira do quadrado
- **AND** SHALL confirmar a entrega e projetar a campanha usando o artefato existente
- **AND** SHALL NOT reenviar, recriar ou duplicar a imagem

#### Scenario: Vertical já persistido é publicado sem novo upload

- **WHEN** a expansão terminou e o `vertical` está persistido e verificado
- **THEN** o sistema SHALL adquirir o token de publicação para a identidade financeira do vertical
- **AND** SHALL confirmar a entrega e projetar a campanha usando o artefato existente
- **AND** SHALL NOT reenviar, recriar ou duplicar a imagem

#### Scenario: Falha do token não altera o artefato

- **WHEN** a aquisição do token de publicação falha ou fica indeterminada
- **THEN** o artefato canônico SHALL permanecer persistido e íntegro
- **AND** SHALL NOT haver confirmação financeira, novo upload, nova geração ou estorno presumido

### Requirement: Relação canônica entre campanha, operação conjunta, etapas e entregas

O sistema SHALL identificar a requisição conjunta por `(campaign_id, operation_id)` e SHALL vincular explicitamente cada entrega de formato à sua operação financeira própria. A operação conjunta SHALL possuir exatamente duas entregas: `1:1` com papel `square_original` e `9:16` com papel `vertical`. A operação de controle de etapas SHALL permanecer vinculada à requisição conjunta e à entrega vertical. O sistema SHALL NOT inferir formato ou entrega por `campaigns.storage_path`, por presença de objeto ou por nome de arquivo.

#### Scenario: Duas entregas vinculadas à mesma requisição

- **WHEN** a requisição conjunta é aberta
- **THEN** SHALL existir exatamente um vínculo para `1:1` e um vínculo para `9:16`
- **AND** cada vínculo SHALL apontar para uma operação financeira própria
- **AND** a operação de controle SHALL permanecer vinculada à requisição

#### Scenario: Vínculo ausente ou incoerente falha fechado

- **WHEN** a leitura encontra vínculo ausente, duplicado, com formato desconhecido ou papel incompatível
- **THEN** a entrega daquele formato SHALL ser indisponível
- **AND** o sistema SHALL NOT iniciar geração, confirmação, estorno, preview ou download por inferência

### Requirement: Preflight e abertura antes de qualquer chamada paga

Antes da abertura conjunta e de qualquer chamada paga, o sistema SHALL resolver a seleção administrativa da expansão em modo estrito e executar o preflight read-only de catálogo, modelo e cobertura de pricing, reutilizando o contrato existente. A seleção resolvida SHALL ser congelada na abertura da operação conjunta. O sistema SHALL NOT abrir a operação, reservar crédito ou chamar provider quando a configuração estiver comprovadamente ausente/inválida ou a leitura for indeterminada, conforme o estágio.

#### Scenario: Configuração válida é congelada na abertura

- **WHEN** a configuração, o catálogo e o pricing da expansão são válidos
- **THEN** a seleção SHALL ser congelada na abertura conjunta
- **AND** a base e a expansão SHALL usar essa seleção
- **AND** nenhuma leitura da configuração administrativa vigente SHALL alterar a operação já aberta

#### Scenario: Configuração comprovadamente inválida impede a abertura

- **WHEN** a configuração da expansão está ausente ou inválida antes da abertura conjunta
- **THEN** o sistema SHALL NOT reservar os dois créditos, abrir operação ou chamar provider

#### Scenario: Leitura indeterminada não inventa ausência

- **WHEN** o preflight não consegue confirmar configuração, catálogo ou pricing por erro de leitura
- **THEN** o sistema SHALL NOT abrir a operação nem reservar crédito
- **AND** SHALL reportar indisponibilidade recuperável sem classificar como configuração ausente

### Requirement: Processamento e continuidade preservam a operação conjunta

O sistema SHALL reutilizar a tela de processamento e o comportamento de copy existentes, adaptando o necessário para indicar os dois formatos. A operação conjunta SHALL continuar entre requisições usando a mesma identidade, snapshot congelado e seleção congelada. Reenvio equivalente SHALL ser consulta ou continuação da mesma operação e SHALL NOT criar nova campanha, nova operação ou nova reserva.

#### Scenario: Reenvio equivalente não duplica a operação

- **WHEN** o mesmo pedido conjunto é reenviado com a mesma identidade e o mesmo conteúdo
- **THEN** o sistema SHALL resolver a operação existente
- **AND** SHALL NOT criar outra campanha, operação, etapa ou reserva

#### Scenario: Continuação usa o conteúdo congelado

- **WHEN** a operação conjunta é continuada após reload ou interrupção
- **THEN** o sistema SHALL reconstruir o conteúdo a partir do snapshot/arquivos duráveis
- **AND** SHALL NOT aceitar briefing novo do navegador
- **AND** SHALL usar a seleção de expansão congelada

#### Scenario: Processamento não inicia geração pelo card

- **WHEN** a interface exibe um formato em processamento
- **THEN** a exibição SHALL apenas refletir o estado persistido
- **AND** SHALL NOT iniciar nova geração a partir do indicador

### Requirement: Recuperação atua somente sobre o formato faltante

A continuação SHALL verificar o estado de cada formato antes de executar etapas. Formato entregue SHALL NOT ser regenerado, re-reservado ou reconfirmado; formato com reserva existente SHALL ser tratado como continuação; formato com estorno comprovado SHALL permanecer terminal e SHALL NOT ser reaberto automaticamente nesta fatia. Quando o quadrado já estiver entregue, a continuação SHALL executar somente as etapas necessárias ao vertical.

#### Scenario: Quadrado entregue não refaz a base

- **WHEN** a campanha conjunta tem o quadrado entregue e o vertical pendente
- **THEN** a continuação SHALL NOT executar a base, reutilizar provider de imagem quadrada ou criar nova reserva do quadrado
- **AND** SHALL executar somente preparação, expansão e entrega vertical conforme o estado

#### Scenario: Vertical estornado não é recriado

- **WHEN** o vertical está terminal com crédito devolvido e o quadrado está entregue
- **THEN** a continuação SHALL retornar entrega parcial
- **AND** SHALL NOT iniciar nova geração vertical nem nova cobrança

#### Scenario: Quadrado entregue com confirmação pendente é liquidado sem provider

- **WHEN** o artefato quadrado está íntegro e a confirmação financeira do quadrado está pendente
- **THEN** a recuperação SHALL liquidar a entrega existente sem chamar provider de imagem

### Requirement: Preservação dos fluxos individuais e históricos

A entrega conjunta SHALL ser aditiva. Os fluxos `1:1`, `9:16` individual e as campanhas históricas SHALL manter entrada, resposta, reserva, artefato, entrega, preview, download, copy e miniatura atuais. O sistema SHALL NOT converter campanha existente, adicionar formato a campanha existente ou reutilizar a operação individual para a entrega conjunta.

#### Scenario: Campanha histórica permanece no caminho atual

- **WHEN** uma campanha 1:1 ou 9:16 histórica é lida, baixada ou recuperada
- **THEN** o sistema SHALL usar o caminho atual correspondente
- **AND** SHALL NOT abrir operação conjunta nem alterar seus artefatos

#### Scenario: Nenhuma conversão nesta fatia

- **WHEN** uma campanha existente tem apenas um formato
- **THEN** a interface SHALL NOT oferecer conversão, adição do outro formato ou modal de geração nesta fatia
