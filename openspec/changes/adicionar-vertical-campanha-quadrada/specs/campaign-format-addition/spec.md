## ADDED Requirements

### Requirement: Elegibilidade determinada pela fonte entregue

O sistema SHALL permitir a adição do formato `9:16` somente a uma campanha `1:1` cuja fonte entregue satisfaça simultaneamente: acesso do lojista, vínculo campanha/loja, `status = ready`, formato persistido `1:1`, arte JPEG de exatamente 1024×1024, path canônico compatível com a origem, origem reconhecida e integridade recalculada dos bytes no servidor. As origens suportadas SHALL ser `new_flow_1_1` e `legacy_campaign`. Para `legacy_campaign`, o sistema SHALL usar um modo opt-in que aceita 1024×1024 no path histórico canônico e SHALL NOT exigir nem inventar uma operação financeira original. A idade da campanha NÃO SHALL ser critério de elegibilidade. O sistema SHALL NOT converter, redimensionar ou adaptar imagem incompatível, SHALL NOT gerar um novo quadrado e SHALL NOT executar backfill.

#### Scenario: Fonte 1024×1024 do fluxo novo é elegível

- **WHEN** uma campanha `1:1` do fluxo novo está pronta e sua arte entregue é JPEG 1024×1024 com acesso, vínculo, path, origem e checksum válidos
- **THEN** o sistema SHALL classificá-la como elegível para receber o `9:16`
- **AND** SHALL informar o custo de 1 crédito antes de qualquer efeito financeiro

#### Scenario: Fonte 1024×1024 legada é elegível sem operação financeira original

- **WHEN** uma campanha `legacy_campaign` está pronta, sua fonte é JPEG 1024×1024 íntegra no path histórico canônico e o vínculo loja/campanha confere
- **THEN** o sistema SHALL classificá-la como elegível pelo modo opt-in da adição
- **AND** SHALL registrar a procedência como `legacy_campaign`
- **AND** SHALL NOT criar, reabrir ou inventar uma operação financeira original
- **AND** SHALL NOT usar a idade da campanha como critério

#### Scenario: Fonte 1080×1080 bloqueada

- **WHEN** a campanha `1:1` está pronta, mas a arte entregue tem 1080×1080 ou outra dimensão diferente de 1024×1024
- **THEN** o sistema SHALL recusar a adição como incompatibilidade comprovada
- **AND** SHALL NOT iniciar reserva, preparação, expansão ou chamada ao provider
- **AND** SHALL apresentar uma explicação sem prometer adaptação futura

#### Scenario: Bytes inválidos ou formato não JPEG

- **WHEN** a fonte tem bytes truncados, decode inválido, MIME diferente de JPEG ou checksum divergente do recalculado
- **THEN** o sistema SHALL recusar a adição como incompatibilidade comprovada
- **AND** SHALL NOT criar vínculo, reservar crédito ou alterar o artefato original

#### Scenario: Ausência ou leitura indisponível são distintas

- **WHEN** a fonte não existe, o acesso é negado, o path/vínculo diverge ou a leitura de Storage está indisponível
- **THEN** o sistema SHALL distinguir fonte ausente, bloqueio de identidade e indisponibilidade de leitura
- **AND** SHALL NOT apresentar indisponibilidade transitória como incompatibilidade definitiva
- **AND** SHALL NOT reservar crédito ou iniciar geração em nenhum desses casos

#### Scenario: Origem não suportada ou path não canônico

- **WHEN** a campanha se declara `1:1`, mas a origem, o path ou a operação não correspondem a `new_flow_1_1` nem `legacy_campaign`
- **THEN** o sistema SHALL recusar por incompatibilidade de contrato
- **AND** SHALL NOT aceitar o arquivo apenas por dimensão
- **AND** SHALL NOT reservar crédito ou criar vínculo

### Requirement: Operação própria de um crédito vinculada à fonte

A adição SHALL ser uma operação própria, com identidade financeira distinta da operação primária quando ela existir, vinculada à mesma campanha e ao artefato-fonte validado. No fluxo novo, o vínculo SHALL referenciar a operação `1:1` primária entregue que sustenta a fonte; em campanha legada, SHALL registrar a origem histórica e a identidade sintética da fonte, sem criar operação financeira original. A operação SHALL custar exatamente 1 crédito, reservado na abertura e consumido somente na entrega vertical confirmada. O sistema SHALL NOT reabrir, cobrar novamente, estornar ou alterar a operação original entregue, quando existir. O custo SHALL ser apresentado e confirmado antes do início.

#### Scenario: Custo informado antes da confirmação

- **WHEN** o lojista aciona a adição de uma campanha elegível
- **THEN** o sistema SHALL apresentar o custo de 1 crédito e solicitar confirmação
- **AND** SHALL NOT reservar crédito, preparar imagem ou chamar provider antes da confirmação

#### Scenario: Operação original permanece intacta

- **WHEN** a adição é aberta, entregue, estornada ou consultada em uma campanha do fluxo novo
- **THEN** a operação `1:1` original SHALL permanecer com o mesmo status, valor, identidade, publicação, artefato e checksum
- **AND** NENHUMA RPC da adição SHALL alterar a linha financeira original
- **AND** NENHUM consumidor SHALL interpretar a operação da adição como a operação primária da campanha

#### Scenario: Legado não inventa operação original

- **WHEN** a adição é feita sobre uma campanha legada 1024 elegível
- **THEN** o sistema SHALL registrar a procedência histórica e a identidade sintética da fonte
- **AND** SHALL NOT criar uma linha em `product_1_1_campaign_credit_operations` para representar uma operação original inexistente
- **AND** a única operação financeira nova SHALL ser a da adição

#### Scenario: Um crédito por adição

- **WHEN** a adição é confirmada uma única vez
- **THEN** o sistema SHALL reservar exatamente 1 crédito
- **AND** SHALL consumir esse crédito somente após a entrega vertical confirmada
- **AND** SHALL NOT reservar crédito adicional por tentativa, retry ou reenvio equivalente

### Requirement: Vínculo durável, idempotente e concorrente-seguro

O sistema SHALL persistir um vínculo durável da adição com campanha, loja, operação de controle, origem da fonte, operação-fonte quando existir, identidade de registro da fonte, artefato-fonte, checksum da fonte, formato de origem, formato alvo, estado, `request_id` e parâmetros econômicos congelados. O vínculo SHALL ser a autoridade de estado; o estado da modal, do stream ou da aba NÃO SHALL ser autoridade. O `request_id` SHALL ser emitido pelo servidor em um preflight de confirmação vinculado a campanha, alvo, checksum e custo; o cliente NÃO SHALL escolher a identidade da operação. O token de confirmação SHALL ser opaco, verificável no servidor e de curta duração. O sistema SHALL impedir cobrança ou expansão duplicadas em duplo clique, duas abas, requisições simultâneas, replay ou reload. Repetir o mesmo `request_id` SHALL retornar o estado daquela adição, inclusive após estorno; abrir nova operação após estorno SHALL exigir um novo token de confirmação emitido pelo servidor, novo `request_id` e nova confirmação de custo.

#### Scenario: Duplo clique e duas abas

- **WHEN** duas requisições de abertura chegam simultaneamente para a mesma campanha e o mesmo formato alvo
- **THEN** no máximo uma operação SHALL ser criada e no máximo 1 crédito SHALL ser reservado
- **AND** a segunda requisição SHALL retornar a operação vencedora ou o estado em andamento
- **AND** SHALL NOT iniciar uma segunda expansão paga

#### Scenario: Replay e reload não cobram novamente

- **WHEN** a mesma solicitação é repetida após confirmação, reload ou perda de resposta
- **THEN** o sistema SHALL consultar o vínculo e o estado durável pelo `request_id`
- **AND** SHALL NOT reservar outro crédito nem criar outra operação para o mesmo alvo
- **AND** SHALL retomar ou acompanhar a operação existente

#### Scenario: Replay antigo após estorno não abre nova cobrança

- **WHEN** uma adição terminou em estorno e uma requisição atrasada repete o `request_id` original com o token antigo
- **THEN** o sistema SHALL retornar o estado `refunded` daquela adição quando o `request_id` for reconhecível
- **AND** se o token estiver inválido/irreconhecível, SHALL falhar fechado sem nova cobrança
- **AND** SHALL NOT abrir nova operação, reservar crédito, preparar ou expandir
- **AND** SHALL exigir um novo token de confirmação emitido pelo servidor para uma nova tentativa

#### Scenario: Nova tentativa após falha definitiva

- **WHEN** a última adição terminou em falha definitiva com estorno confirmado e o lojista confirma explicitamente uma nova tentativa
- **THEN** o sistema SHALL exigir um novo token de confirmação e um novo `request_id`
- **AND** SHALL apresentar novamente o custo de 1 crédito
- **AND** SHALL preservar o histórico da tentativa anterior
- **AND** SHALL NOT reutilizar a operação estornada

#### Scenario: Vertical já entregue abre o resultado

- **WHEN** a campanha já possui uma adição `delivered` para `9:16`
- **THEN** o sistema SHALL abrir o resultado vertical existente
- **AND** SHALL NOT abrir nova operação, reservar crédito ou chamar provider

#### Scenario: Operação em andamento abre acompanhamento

- **WHEN** a campanha possui uma adição `open`
- **THEN** o sistema SHALL abrir o acompanhamento da operação existente
- **AND** SHALL NOT reservar novo crédito nem iniciar nova expansão

#### Scenario: Fonte legada é registrada sem crédito original

- **WHEN** a adição é de uma campanha `legacy_campaign`
- **THEN** o vínculo SHALL registrar `source_origin`, `source_registration_operation_id`, `source_artifact_id` e checksum
- **AND** `source_operation_id` SHALL ser nulo
- **AND** nenhuma operação financeira original SHALL ser criada ou exigida

### Requirement: Ponte de proveniência sem geração nem alteração do original

O sistema SHALL registrar a fonte quadrada entregue como `square_original` interno, uma única vez por fonte/campanha, por cópia byte-idêntica validada, com origem explícita de reuso de campanha entregue, vínculo à campanha-fonte e proveniência contendo path, dimensão, MIME, tamanho e checksum recalculados. No fluxo novo, a identidade de registro SHALL ser a operação `1:1` primária entregue que sustenta a fonte. Em campanha legada, SHALL ser uma identidade sintética determinística, sem operação financeira. A partir da ponte, a preparação SHALL usar essa identidade como fonte e o `operationId` da adição como destino. A ponte SHALL ser idempotente e SHALL NOT gerar uma nova imagem, transformar o quadrado original ou alterar o artefato `1:1` entregue.

#### Scenario: Ponte criada a partir da fonte entregue

- **WHEN** a fonte `1024×1024` é validada com sucesso
- **THEN** o sistema SHALL persistir (ou reutilizar) o `square_original` interno com identidade estável da fonte
- **AND** os bytes do novo objeto SHALL ser idênticos aos bytes validados da fonte
- **AND** a origem SHALL identificar reuso de campanha entregue, nunca geração por provider
- **AND** o artefato original `1:1` SHALL permanecer inalterado

#### Scenario: Legado usa identidade sintética sem crédito

- **WHEN** a fonte é de uma campanha `legacy_campaign` 1024×1024
- **THEN** o sistema SHALL persistir a ponte com identidade sintética determinística e `source_campaign_id` da campanha
- **AND** SHALL registrar a procedência histórica
- **AND** SHALL NOT criar operação financeira original, reserva ou crédito para a fonte

#### Scenario: Repetição e concorrência reutilizam a ponte

- **WHEN** a ponte já existe com a mesma identidade, bytes e proveniência, ou duas aberturas concorrentes tentam criá-la
- **THEN** o sistema SHALL convergir para uma única ponte
- **AND** SHALL NOT executar segundo upload útil, segundo insert ou transformação
- **AND** SHALL NOT chamar provider

#### Scenario: Proveniência divergente é conflito

- **WHEN** a identidade da ponte já existe com bytes, checksum, campanha-fonte ou proveniência divergentes, ou a fonte entregue mudou desde o registro
- **THEN** o sistema SHALL falhar fechado com conflito de conteúdo/proveniência
- **AND** SHALL NOT sobrescrever o objeto ou a linha existente
- **AND** SHALL NOT reutilizar silenciosamente a ponte antiga
- **AND** SHALL NOT abrir reserva ou chamada paga

### Requirement: Configuração e parâmetros econômicos congelados

Na abertura da adição, o sistema SHALL congelar a seleção de expansão (modelo, qualidade e versão de configuração) e os parâmetros econômicos aplicáveis à chamada paga. Retomadas, retries e continuações da mesma operação SHALL usar os valores congelados e SHALL NOT reler a configuração ou o pricing vigente para substituí-los. Configuração ou economia congelada ausente, malformada ou incompatível SHALL bloquear antes de chamada paga. Em campanha `legacy_campaign`, a seleção congelada SHALL ser a configuração de expansão **atual** (`configured`, com versão válida); a origem histórica da campanha NÃO SHALL ser usada como origem da seleção nem exigir operação financeira original.

#### Scenario: Abertura grava a seleção e a economia

- **WHEN** a adição é aberta com configuração e pricing válidos
- **THEN** o vínculo SHALL registrar a seleção e os parâmetros econômicos usados
- **AND** a reserva de 1 crédito SHALL ocorrer somente após a validação desses valores

#### Scenario: Retomada preserva os valores congelados

- **WHEN** a operação é retomada após nova requisição, reload ou falha transitória
- **THEN** a expansão SHALL usar a seleção e a economia gravadas na abertura
- **AND** SHALL NOT trocar modelo, qualidade, versão de configuração ou pricing por valores vigentes

#### Scenario: Configuração congelada inválida bloqueia

- **WHEN** a seleção ou a economia congelada está ausente, malformada ou incompatível com a operação
- **THEN** o sistema SHALL bloquear a chamada paga
- **AND** SHALL NOT inventar valores, chamar provider ou consumir tentativa paga
- **AND** SHALL manter o estado recuperável para revisão

#### Scenario: Campanha legada usa a seleção atual configurada

- **WHEN** a adição é de uma campanha `legacy_campaign` elegível
- **THEN** a seleção congelada SHALL ser a configuração de expansão atual (`configured`) com versão válida
- **AND** SHALL NOT usar `legacy`/`legacy_sunburst_low` como origem da nova seleção
- **AND** SHALL NOT exigir operação financeira original

### Requirement: Orquestração reutiliza o motor existente sem o fluxo conjunto

O sistema SHALL executar a adição com uma operação de controle `9_16_two_stage` de formato único, reutilizando preparação determinística 1024→1152, expansão, sondas, claims, limites de tentativa, prazo, fence de publicação, outcomes e retomada existentes. A etapa base SHALL ser marcada como reutilizada a partir da fonte entregue, sem geração de base. A preparação SHALL usar a identidade estável de registro da fonte como origem e o `operationId` da adição como destino. O sistema SHALL NOT chamar o orquestrador conjunto, SHALL NOT reservar dois formatos e SHALL NOT executar o fluxo de nova campanha vertical.

#### Scenario: Base reutilizada, expansão executada

- **WHEN** a operação de adição é aberta
- **THEN** o sistema SHALL criar a operação de controle com as duas etapas
- **AND** SHALL marcar a etapa base como concluída por reuso da fonte, sem chamada de geração
- **AND** SHALL executar preparação e expansão somente para o vertical

#### Scenario: Legado reutiliza a fonte sem crédito original

- **WHEN** a adição é de uma campanha `legacy_campaign` com fonte 1024 válida
- **THEN** a preparação SHALL usar a identidade sintética da fonte e o `operationId` da adição
- **AND** SHALL NOT depender de operação financeira original
- **AND** SHALL NOT gerar base nem chamar provider para a fonte

#### Scenario: Fluxo conjunto não é chamado

- **WHEN** a adição é executada
- **THEN** o sistema SHALL NOT usar o contrato `1:1+9:16`
- **AND** SHALL NOT abrir duas reservas
- **AND** SHALL NOT exigir snapshot conjunto
- **AND** SHALL NOT chamar `product_two_format_open_delivery`

#### Scenario: Controles existentes são preservados

- **WHEN** a expansão é executada ou retomada
- **THEN** o sistema SHALL respeitar deadline, recheck, sonda pré-chamada, claim único, limite de tentativas e timeout do motor existente
- **AND** SHALL registrar outcome `unknown` ou `failed` conforme o contrato existente

### Requirement: Entrega adicional sem substituir o quadrado

A entrega do vertical SHALL confirmar o crédito da adição somente após o artefato vertical canônico 1080×1920 JPEG estar persistido e validado. A entrega SHALL atualizar o vínculo da adição e o crédito da adição, SHALL gerar a miniatura vertical em melhor esforço e SHALL NOT alterar `campaigns.storage_path`, `campaigns.status`, `campaigns.error_message` ou o artefato `1:1`. A campanha SHALL continuar sendo uma única campanha, com o quadrado como referência principal.

#### Scenario: Vertical entregue sem repontar a campanha

- **WHEN** o artefato vertical é validado e a entrega é confirmada
- **THEN** o vínculo SHALL ficar `delivered` e o crédito da adição SHALL ser consumido uma única vez
- **AND** `campaigns.storage_path` SHALL permanecer no artefato quadrado original
- **AND** o status da campanha SHALL permanecer `ready`
- **AND** a miniatura vertical SHALL ser gerada sem invalidar a entrega em caso de falha

#### Scenario: Entrega idempotente

- **WHEN** a confirmação é repetida após resposta perdida
- **THEN** o sistema SHALL reconhecer o crédito `delivered` e o vínculo entregue
- **AND** SHALL NOT consumir outro crédito, duplicar artefato ou alterar o quadrado

#### Scenario: Falha da miniatura não desfaz a entrega

- **WHEN** a miniatura vertical falha após a confirmação do crédito e do vínculo
- **THEN** o vertical SHALL permanecer entregue
- **AND** a campanha quadrada SHALL permanecer acessível
- **AND** a falha SHALL ser registrada como melhor esforço, sem estorno automático

### Requirement: Falha definitiva, resultado incerto e recuperação segura

O sistema SHALL preservar sempre o quadrado, a copy e o acesso/download existentes. Em falha definitiva comprovada, o sistema SHALL devolver somente o crédito da adição, de forma idempotente, após comprovar ausência de artefato, ausência de claim ativo e outcome `failed`. Em resultado incerto, o sistema SHALL consultar/reconciliar o estado e o artefato antes de permitir nova geração ou estorno, e SHALL NOT apresentar falha de acompanhamento como falha definitiva. Artefato persistido com confirmação incompleta SHALL poder ser confirmado sem nova chamada paga.

#### Scenario: Falha definitiva estorna apenas a adição

- **WHEN** a expansão falha definitivamente, não há artefato vertical e não há claim ativo
- **THEN** o sistema SHALL registrar o outcome `failed` e devolver exatamente 1 crédito da adição
- **AND** SHALL marcar o vínculo como `refunded`
- **AND** SHALL NOT alterar o crédito, o artefato ou o status da operação `1:1`
- **AND** o quadrado e a copy SHALL continuar disponíveis

#### Scenario: Resultado incerto não estorna nem regenera

- **WHEN** o resultado da expansão é desconhecido ou a resposta é ambígua
- **THEN** o sistema SHALL registrar `unknown` e manter o acompanhamento
- **AND** SHALL NOT estornar automaticamente
- **AND** SHALL NOT iniciar nova expansão paga
- **AND** SHALL reconciliar artefato/outcome antes de qualquer decisão terminal

#### Scenario: Artefato íntegro é recuperado sem nova chamada paga

- **WHEN** o artefato vertical já está persistido e íntegro, mas a confirmação anterior não foi concluída
- **THEN** o sistema SHALL sondar o artefato, adquirir o fence de publicação e confirmar a entrega existente
- **AND** SHALL NOT chamar o provider de expansão novamente
- **AND** SHALL reutilizar a mesma identidade financeira

#### Scenario: Falha de acompanhamento não é falha definitiva

- **WHEN** a leitura de status ou o stream de acompanhamento falha
- **THEN** o sistema SHALL informar indisponibilidade de acompanhamento
- **AND** SHALL NOT converter o estado em `failed`, `refunded` ou `absent`
- **AND** SHALL permitir nova consulta/retomada sem cobrança

### Requirement: Gates de autorização, saldo e rollback

A **abertura de nova adição** SHALL revalidar propriedade, vínculo campanha/loja, flag dedicada `campaign_format_addition_enabled`, flag do motor `product_9_16_two_stage_enabled`, autorização do fluxo de produto aplicável à loja/instância, legal clearance, readiness da loja, rate limit e saldo ≥ 1. A **continuação de operação já aberta** SHALL validar a reserva da própria operação (`reserved`/`art_uploaded`), sua identidade e os gates aplicáveis, mas SHALL NOT exigir saldo disponível adicional nem reservar outro crédito. Consulta, reconciliação, recuperação e download NÃO SHALL depender de saldo disponível. O sistema SHALL falhar fechado em erro de leitura de gate. A elegibilidade da fonte SHALL ser revalidada antes da reserva e novamente antes da chamada paga. A flag dedicada SHALL bloquear somente novas adições; operações abertas SHALL continuar consultáveis, retomáveis e finalizáveis, preservando o vertical individual, o conjunto e o `1:1`. O sistema SHALL NOT criar novo pricing ou novo modelo de autorização para esta ação.

#### Scenario: Flag dedicada desligada bloqueia novas adições

- **WHEN** `campaign_format_addition_enabled` está desligada
- **THEN** o sistema SHALL recusar a abertura de nova adição
- **AND** SHALL NOT abrir operação, reservar crédito ou chamar provider
- **AND** SHALL manter consulta, download e finalização de adições já abertas
- **AND** SHALL NOT desligar o vertical individual, o conjunto ou o `1:1`

#### Scenario: Flag do motor desligada bloqueia nova cobrança

- **WHEN** `product_9_16_two_stage_enabled` está desligada
- **THEN** o sistema SHALL bloquear nova abertura e novas chamadas pagas
- **AND** SHALL NOT iniciar reserva ou provider
- **AND** SHALL preservar consulta, reconciliação e download do que já existe

#### Scenario: Gate indisponível falha fechado

- **WHEN** a leitura de autorização, legal, readiness, rate limit, saldo, reserva ou flag falha
- **THEN** o sistema SHALL bloquear a ação correspondente
- **AND** SHALL NOT interpretar a falha como autorização

#### Scenario: Fonte alterada entre consulta e confirmação

- **WHEN** a fonte ou sua integridade muda entre a consulta de elegibilidade e a confirmação
- **THEN** o sistema SHALL revalidar antes da reserva e recusar se o contrato deixou de ser satisfeito
- **AND** SHALL NOT reservar crédito, preparar ou expandir com a fonte divergente

#### Scenario: Saldo insuficiente na abertura

- **WHEN** o saldo da loja é menor que 1 crédito antes da abertura
- **THEN** o sistema SHALL informar a insuficiência
- **AND** SHALL NOT reservar crédito nem chamar o provider

#### Scenario: Último crédito reservado não bloqueia a continuação

- **WHEN** o lojista tem exatamente 1 crédito, a abertura reserva esse crédito e o saldo disponível fica zero
- **THEN** a preparação, a expansão e a entrega SHALL continuar usando a reserva da própria operação
- **AND** o sistema SHALL NOT exigir outro crédito nem recusar a continuação por saldo zero
- **AND** consulta, reconciliação e download SHALL permanecer disponíveis

#### Scenario: Rollback preserva operações abertas

- **WHEN** a flag dedicada é desligada durante uma operação já aberta
- **THEN** a operação SHALL continuar consultável, retomável e finalizável com segurança
- **AND** SHALL NOT ser estornada automaticamente apenas por causa da flag
- **AND** nenhuma nova adição SHALL ser iniciada

#### Scenario: Gate de piloto armado limita a chamada paga

- **WHEN** o gate de piloto retorna `armed`
- **THEN** a chamada paga de expansão SHALL adquirir o gate antes do provider e encerrá-lo ou marcá-lo como desconhecido conforme o resultado
- **AND** o teto existente SHALL NOT ser ampliado nem contornado

#### Scenario: Gate de piloto bloqueado ou inativo

- **WHEN** o gate de piloto retorna `blocked` ou `inactive`
- **THEN** `blocked` SHALL impedir a chamada ao provider
- **AND** `inactive` SHALL seguir sem gate fictício
- **AND** NENHUM estado do gate SHALL criar crédito, operação ou teto novo

### Requirement: Leitura e apresentação segura da adição

O sistema SHALL expor o estado da adição por um modelo tipado e sanitizado, sem `input_snapshot`, credenciais, paths internos, URLs de Storage ou bytes. A leitura por campanha SHALL distinguir `delivered`, `processing`, `absent`, `unknown` e `unavailable`, além de incompatibilidade e indisponibilidade de leitura. A listagem e o dashboard SHALL usar leitura em lote por página, sem consulta por card. A adição SHALL continuar sendo a mesma campanha, com um único card/linha e a miniatura quadrada preferida.

#### Scenario: Modelo não expõe dados internos

- **WHEN** qualquer superfície monta o estado da adição
- **THEN** o modelo SHALL receber apenas estados, formato, custo e marcas seguras de apresentação
- **AND** SHALL NOT receber snapshot, path, credencial, URL de Storage ou bytes

#### Scenario: Lista e dashboard sem N+1

- **WHEN** a listagem ou o dashboard exibe uma página de campanhas com e sem adição
- **THEN** o sistema SHALL ler as adições em lote
- **AND** SHALL NOT executar consulta por card
- **AND** a contagem de campanhas SHALL permanecer a mesma
- **AND** a miniatura quadrada SHALL continuar preferida quando o quadrado estiver entregue

#### Scenario: Estado desconhecido não vira ausência

- **WHEN** a leitura da adição é indisponível ou o resultado é incerto
- **THEN** o sistema SHALL apresentar `unknown`/`unavailable`
- **AND** SHALL NOT apresentar “não incluído”, “não entregue” ou “não gerado”
- **AND** SHALL NOT oferecer nova geração como se a operação não existisse

#### Scenario: Incompatibilidade é explicada sem promessa

- **WHEN** a campanha é inelegível por dimensão, MIME, integridade ou contrato de origem
- **THEN** o sistema SHALL explicar, em linguagem simples, por que o vertical não pode ser adicionado
- **AND** SHALL NOT prometer adaptação, conversão ou backfill futuro
- **AND** o quadrado, a copy e o download existentes SHALL permanecer disponíveis

### Requirement: Rastreabilidade para suporte sem crédito em duplicidade

O sistema SHALL permitir que o suporte identifique uma adição presa de forma somente-leitura por campanha, operação, origem da fonte, artefato e estado durável, sem criar uma operação administrativa nova e sem conceder crédito em duplicidade. A reconciliação/estorno, quando necessária, SHALL ocorrer somente pela operação da própria adição, com idempotência e o mecanismo de auditoria aplicável. O painel administrativo novo permanece fora do escopo; o procedimento documental SHALL cobrir identificação, diagnóstico e encerramento seguro.

#### Scenario: Suporte identifica a operação presa

- **WHEN** a adição está `open`, `unknown` ou com crédito reservado
- **THEN** o suporte SHALL conseguir localizar a campanha, a operação da adição, a origem da fonte, o artefato e o estado do crédito
- **AND** SHALL distinguir resultado incerto de falha definitiva
- **AND** SHALL NOT criar outra reserva, outro vínculo ou outro crédito para “resolver”

#### Scenario: Reconciliação não duplica crédito

- **WHEN** o suporte reconcilia ou estorna uma adição
- **THEN** a ação SHALL usar a identidade da própria adição e o mecanismo de auditoria aplicável
- **AND** SHALL ser idempotente
- **AND** SHALL NOT devolver crédito além das 1 unidade da adição
- **AND** SHALL preservar a operação original e o quadrado
