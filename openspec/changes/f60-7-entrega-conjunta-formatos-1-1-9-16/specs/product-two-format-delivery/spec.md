## ADDED Requirements

### Requirement: Duas entregas visuais na mesma campanha

A campanha conjunta SHALL entregar exatamente dois artefatos visuais: `square_original` 1024×1024 JPEG como `1:1` e `vertical` 1080×1920 JPEG como `9:16`, ambos persistidos no bucket interno de composição. A copy SHALL acompanhar a campanha uma única vez e ser compartilhada pelos dois formatos. O sistema SHALL NOT entregar `square_prepared` 1152×1152, artefato bruto de provider, metadados internos ou uma segunda cópia do quadrado.

#### Scenario: Dois formatos entregues

- **WHEN** a campanha conjunta está totalmente entregue
- **THEN** exatamente um artefato `square_original` e um `vertical` SHALL estar acessíveis
- **AND** a copy SHALL estar disponível uma única vez para os dois formatos
- **AND** `square_prepared` SHALL permanecer inacessível ao lojista

#### Scenario: Preparado interno não é entregue

- **WHEN** a UI ou o download resolve a campanha conjunta
- **THEN** somente os papéis `square_original` e `vertical` SHALL ser considerados entrega
- **AND** o preparado 1152 SHALL NOT ser assinado, baixado ou exibido como arte final

#### Scenario: Sem segunda cópia do quadrado

- **WHEN** a entrega quadrada é confirmada
- **THEN** o objeto canônico `square_original` SHALL permanecer único no bucket interno
- **AND** nenhuma cópia dos mesmos bytes SHALL ser criada em `campaign-images` como entrega

### Requirement: Projeção da campanha prefere o quadrado e não é a autoridade

Após uma entrega confirmada, o sistema SHALL projetar a campanha de forma idempotente: `status = ready`, erro limpo e `storage_path` apontando para `square_original` quando o quadrado estiver entregue; caso apenas o vertical esteja entregue, `storage_path` SHALL apontar para o vertical. Se nenhum formato estiver entregue e ambos estiverem terminais com estorno, a campanha SHALL ser projetada como `error` somente se ainda não estiver `ready`. A projeção SHALL NOT rebaixar campanha `ready` por evento tardio. A autoridade de leitura conjunta SHALL ser o vínculo de entrega + crédito + artefato, não `storage_path`.

#### Scenario: Quadrado entregue é a projeção preferida

- **WHEN** o quadrado está entregue e o vertical está em processamento, ausente ou estornado
- **THEN** a campanha SHALL permanecer `ready`
- **AND** `storage_path` SHALL apontar para o artefato quadrado
- **AND** a UI SHALL informar a situação do vertical separadamente

#### Scenario: Somente vertical entregue

- **WHEN** apenas o vertical está entregue
- **THEN** `storage_path` SHALL apontar para o vertical
- **AND** o formato quadrado SHALL permanecer ausente sem ser inferido pelo path

#### Scenario: Evento tardio não rebaixa entrega

- **WHEN** um estorno tardio do vertical chega após o quadrado ter deixado a campanha `ready`
- **THEN** a campanha SHALL permanecer `ready`
- **AND** o quadrado SHALL continuar disponível

#### Scenario: Projeção repetida é idempotente

- **WHEN** a projeção é executada novamente sobre o mesmo estado persistido
- **THEN** ela SHALL retornar o estado já projetado
- **AND** SHALL NOT duplicar entrega, cobrança ou auditoria

#### Scenario: Projeções concorrentes serializam pela campanha

- **WHEN** entregas ou estornos dos dois formatos tentam projetar a mesma campanha concorrentemente
- **THEN** as RPCs conjuntas SHALL adquirir o lock da campanha antes dos locks específicos de vínculo/crédito
- **AND** a projeção SHALL ler as duas entregas sob esse lock comum
- **AND** uma gravação atrasada SHALL NOT substituir a preferência quadrada

### Requirement: Estados parciais são explícitos e não ocultam o formato entregue

O sistema SHALL representar cada formato como `delivered`, `processing`, `absent`, `unknown` ou `unavailable`. A campanha conjunta SHALL poder ser exibida com um formato entregue e o outro em processamento, ausente ou com crédito devolvido. A presença de formato faltante SHALL NOT ocultar, invalidar ou bloquear o acesso ao formato entregue. Formato ausente cujo crédito foi estornado SHALL informar o crédito devolvido quando essa confirmação existir.

#### Scenario: Entrega parcial mantém o quadrado acessível

- **WHEN** o quadrado está entregue e o vertical está ausente com crédito devolvido
- **THEN** o card e o detalhe SHALL exibir o quadrado como entregue
- **AND** SHALL informar o vertical ausente e o crédito devolvido
- **AND** o preview e o download do quadrado SHALL permanecer disponíveis

#### Scenario: Formato em processamento é indicado sem ação

- **WHEN** um formato está em processamento
- **THEN** a UI SHALL indicar o estado
- **AND** SHALL NOT iniciar outra geração a partir do indicador
- **AND** SHALL continuar acompanhando o estado persistido

#### Scenario: Formato ausente não oferece geração nesta fatia

- **WHEN** um formato está ausente
- **THEN** a UI SHALL informar a ausência
- **AND** SHALL NOT oferecer modal, confirmação, custo ou ação de geração nesta fatia

#### Scenario: Leitura indeterminada não vira ausência

- **WHEN** a leitura de crédito, vínculo ou artefato é indeterminada
- **THEN** o formato SHALL ser exibido como indisponível/indeterminado
- **AND** SHALL NOT ser tratado como ausente nem liberar estorno presumido

#### Scenario: Falha de um formato preserva o outro comprovadamente entregue

- **WHEN** a leitura de crédito ou artefato de um formato falha, mas o outro formato está comprovadamente entregue
- **THEN** a leitura SHALL retornar o formato afetado como `unknown`
- **AND** SHALL preservar o outro formato como `delivered`
- **AND** SHALL NOT converter a falha em `absent`, `not_found` ou `not_two_format`

### Requirement: Acesso individual por formato

O detalhe da campanha conjunta SHALL permitir acesso individual ao preview e ao download de cada formato entregue. O preview e o download SHALL usar o artefato original do formato, com autorização de loja/campanha e URL assinada de curta duração para preview. Nenhuma URL, thumbnail ou download SHALL ser produzido antes da confirmação financeira `delivered` do formato e da validação do artefato. A campanha conjunta SHALL aceitar a seleção de formato na URL (`?format=1:1|9:16`) para abrir diretamente o formato escolhido.

#### Scenario: Preview individual do quadrado

- **WHEN** o quadrado está entregue e o lojista abre o formato `1:1`
- **THEN** o preview SHALL usar o `square_original`
- **AND** a moldura SHALL ser 1:1
- **AND** o download SHALL devolver os bytes do `square_original`

#### Scenario: Preview individual do vertical

- **WHEN** o vertical está entregue e o lojista abre o formato `9:16`
- **THEN** o preview SHALL usar o `vertical`
- **AND** a moldura SHALL ser 9:16
- **AND** o download SHALL devolver os bytes do vertical

#### Scenario: Formato não entregue não expõe arte

- **WHEN** o formato está `reserved`, `unknown`, `absent` ou `unavailable`
- **THEN** o sistema SHALL NOT criar URL assinada, thumbnail ou download daquele formato
- **AND** SHALL NOT inferir entrega pela presença de objeto no Storage

#### Scenario: Formato escolhido na URL é respeitado

- **WHEN** o detalhe é aberto com `?format=9:16`
- **THEN** o formato vertical SHALL estar pré-selecionado
- **AND** a campanha e a copy compartilhada SHALL permanecer as mesmas

### Requirement: Miniaturas derivadas com preferência quadrada

Os cards SHALL usar uma miniatura derivada, nunca o original como fallback. Para campanha conjunta, a miniatura preferida SHALL ser a derivada do quadrado quando ele estiver entregue; caso contrário, a derivada do vertical. Campanhas somente verticais SHALL manter o comportamento atual. Se a miniatura não existir ou a assinatura falhar, o card SHALL exibir placeholder sem assinar o original.

#### Scenario: Miniatura quadrada é preferida

- **WHEN** o quadrado está entregue e possui miniatura derivada
- **THEN** o card SHALL usar a miniatura do quadrado
- **AND** SHALL NOT usar a miniatura ou o original do vertical nesse caso

#### Scenario: Miniatura vertical quando não há quadrado entregue

- **WHEN** somente o vertical está entregue
- **THEN** o card SHALL usar a miniatura derivada do vertical
- **AND** campanhas somente verticais SHALL manter o comportamento atual

#### Scenario: Miniatura ausente não cai para o original

- **WHEN** a miniatura derivada não existe ou a assinatura falha
- **THEN** o card SHALL exibir placeholder
- **AND** SHALL NOT assinar ou exibir o artefato original como fallback

### Requirement: Recuperação e replay por formato

A recuperação SHALL reparar projeção e miniatura sem regenerar formato já entregue. Se a confirmação financeira ocorreu e a projeção falhou, o replay SHALL reprojetar. Se a arte está íntegra e a confirmação está pendente, a recuperação SHALL liquidar a entrega existente sem provider. Se o resultado é indeterminado, o sistema SHALL NOT oferecer recuperação de imagem ao lojista; a resolução SHALL ser administrativa e baseada em evidência server-side.

#### Scenario: Projeção ausente é reparada

- **WHEN** a confirmação financeira de um formato ocorreu e a campanha não foi projetada
- **THEN** o replay SHALL reparar a projeção sem novo provider
- **AND** SHALL NOT duplicar confirmação ou cobrança

#### Scenario: Entrega existente é liquidada sem nova imagem

- **WHEN** a arte do formato está íntegra e a confirmação financeira está pendente
- **THEN** a recuperação SHALL confirmar a entrega existente
- **AND** SHALL NOT gerar nova imagem

#### Scenario: Desconhecido não oferece recuperação de imagem

- **WHEN** o formato tem resultado desconhecido
- **THEN** a UI SHALL mostrar verificação/suporte
- **AND** SHALL NOT oferecer recuperação de imagem ou nova geração

#### Scenario: Verificação não executa etapa

- **WHEN** o lojista acionar verificar novamente
- **THEN** o sistema SHALL apenas consultar o estado persistido
- **AND** SHALL NOT adquirir etapa, chamar provider, confirmar ou estornar

### Requirement: Preservação de campanhas individuais e históricas

A entrega conjunta SHALL ser aditiva. Campanhas `1:1`, `9:16` individual e históricas SHALL preservar seus artefatos, dimensões, downloads, previews, miniaturas, copies e estados atuais. O comportamento de campanha somente vertical SHALL permanecer inalterado.

#### Scenario: 1:1 individual permanece atual

- **WHEN** uma campanha 1:1 individual é exibida ou baixada
- **THEN** o sistema SHALL usar o artefato e o caminho atuais
- **AND** SHALL NOT aplicar o modelo de duas entregas

#### Scenario: 9:16 individual permanece atual

- **WHEN** uma campanha 9:16 individual é exibida ou baixada
- **THEN** o sistema SHALL usar o vertical atual
- **AND** SHALL NOT exigir vínculo de entrega conjunta

#### Scenario: Histórico legado permanece atual

- **WHEN** uma campanha histórica é acessada
- **THEN** o sistema SHALL preservar bytes, path e comportamento atuais
- **AND** SHALL NOT reinterpretar a campanha como conjunta
