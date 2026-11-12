## ADDED Requirements

### Requirement: Etapa interna com identidade e autorização explícitas

O sistema SHALL expor a composição da base quadrada como um módulo server-only interno, sem rota, UI, orquestrador público ou entrega, que recebe identidade `(storeId, campaignId, operationId)`, contexto de autorização já resolvido no servidor e a tentativa da etapa `base` autorizada pela F60 (`number`, `target`, `reference`).

O módulo SHALL NOT adquirir etapa, iniciar tentativa, contar tentativas, decidir retry/fallback, reservar/confirmar/estornar crédito, alterar `campaigns`, entregar, publicar ou liberar download.

#### Scenario: Contexto autorizado executa a etapa

- **WHEN** o chamador fornece identidade, autorização válida e uma tentativa `base` já autorizada pela F60
- **THEN** o módulo executa a composição da base e devolve um resultado tipado
- **AND** não cria operação, etapa, tentativa, cobrança ou entrega

#### Scenario: Autorização negada não produz efeito

- **WHEN** a autorização não pertence à loja ou o vínculo loja↔campanha diverge
- **THEN** o módulo devolve `authorization_denied`
- **AND** não lê nem escreve artefato, snapshot, copy ou provider

#### Scenario: Chamador tenta substituir decisões internas

- **WHEN** a entrada informa path, bucket, URL, bytes de arte, modelo, qualidade, prompt final, tamanho de imagem ou decisão de retry
- **THEN** o módulo recusa a entrada como `invalid_input`
- **AND** não executa chamada paga

### Requirement: Gate de arte antes de qualquer chamada paga

O módulo SHALL verificar o `square_original` da identidade de destino antes de resolver configuração ou chamar o provider, distinguindo explicitamente a linha persistida do objeto no Storage.

O módulo SHALL reutilizar sem chamada quando a linha, os bytes, a compatibilidade e a evidência durável forem íntegras e compatíveis. Linha existente com objeto desaparecido SHALL bloquear sem regravar. Linha ausente com objeto ausente comprovado SHALL ser o único caminho que autoriza a chamada paga. Objeto órfão íntegro com evidência compatível SHALL ser adotado pela F60.1 sem chamada paga.

#### Scenario: Arte íntegra é reutilizada

- **WHEN** existe `square_original` 1024×1024 JPEG com origem `provider_generation`, sem derivação e com evidência durável compatível
- **THEN** o módulo devolve a arte como `reused`
- **AND** não chama o provider de imagem

#### Scenario: Linha existe e objeto desapareceu

- **WHEN** a linha do `square_original` existe, mas o objeto não está disponível no caminho determinístico
- **THEN** o módulo devolve conflito `row_object_missing`
- **AND** não chama o provider e não regrava o objeto

#### Scenario: Órfão íntegro é adotado

- **WHEN** a linha está ausente, mas o objeto existe no caminho determinístico com JPEG 1024×1024 e evidência durável compatível
- **THEN** a F60.1 adota o objeto e cria a linha
- **AND** o módulo devolve a arte como `reused` sem chamada paga

#### Scenario: Estado indeterminado bloqueia

- **WHEN** a leitura da linha, do objeto, do download ou da evidência é indeterminada
- **THEN** o módulo devolve `blocked`
- **AND** não chama o provider nem apaga/sobrescreve o objeto

#### Scenario: Retomada integral não chama provider

- **WHEN** a arte `square_original` e a copy já estão persistidas e compatíveis
- **THEN** o módulo devolve a arte como `reused` e a copy como `completed` com origem `reused`
- **AND** não chama o provider de imagem nem o de copy

### Requirement: Configuração e conteúdo congelados respeitados na retomada

O módulo SHALL distinguir **primeira composição** de **retomada** pela existência de snapshot/binding/evidência congelados.

Na **primeira composição** (campanha sem snapshot), o módulo SHALL resolver a configuração de imagem uma única vez, compor o prompt com `composeProductPrompt`/políticas atuais, congelar o conteúdo completo da operação (briefing estruturado, contexto de copy, identidade, intenção, direção de fundo, seleções de referência e versões) e persistir snapshot + binding + evidência antes de qualquer chamada paga.

Na **retomada** (snapshot + binding + evidência do mesmo `operationId`), o módulo SHALL NOT resolver a configuração vigente. Ele SHALL usar o snapshot e o conteúdo congelados para prompt e copy, comparar o conteúdo recebido ao fingerprint persistido e recusar divergência antes de qualquer chamada.

Quando o snapshot da campanha já estiver vinculado a **outro `operationId`**, o módulo SHALL devolver conflito explícito sem chamadas. Quando existir snapshot sem binding, ou estado parcial não reparável, o módulo SHALL bloquear como estado não comprovado e SHALL NOT criar segundo binding/evidência nem adotar o snapshot automaticamente.

O módulo SHALL NOT alterar prompt, compositor, políticas, modelo ou qualidade vigentes. A base de prompt SHALL ser sempre `PRODUCT_1_1_PROMPT_BASE`; substituição para teste SHALL viver em dependência de teste, nunca no contrato do chamador.

#### Scenario: Primeira execução congela antes da imagem

- **WHEN** a campanha não tem snapshot e a arte está ausente
- **THEN** o módulo resolve a configuração e persiste snapshot + binding + evidência com o conteúdo completo antes da chamada de imagem
- **AND** o gateway usa o par congelado do snapshot

#### Scenario: Retomada usa o snapshot congelado

- **WHEN** já existe snapshot/evidência completos para a operação
- **THEN** o módulo não resolve a configuração vigente
- **AND** usa o par e o conteúdo congelados, mesmo que a configuração atual tenha mudado

#### Scenario: Snapshot vinculado a outra operação conflita

- **WHEN** a campanha já tem snapshot e o binding/evidência pertencem a outro `operationId`
- **THEN** o módulo devolve `frozen_state_conflict` com `bound_to_other_operation`
- **AND** não cria segundo binding/evidência, não reatribui o snapshot e não chama provider

#### Scenario: Snapshot sem binding bloqueia

- **WHEN** existe snapshot para a campanha, mas não existe binding para ele
- **THEN** o módulo devolve `frozen_state_conflict` com `unproven`
- **AND** não adota o snapshot automaticamente, não cria vínculo e não chama provider

#### Scenario: Conteúdo divergente é recusado

- **WHEN** o briefing, o contexto de copy, as referências/imagens, a identidade, a intenção, a direção de fundo ou as versões recebidos divergem do conteúdo congelado
- **THEN** o módulo devolve `content_divergence`
- **AND** não chama provider de imagem ou copy e não reutiliza arte com o conteúdo novo

#### Scenario: Arte existe e falta copy

- **WHEN** a arte já existe e a copy ainda falta
- **THEN** a copy usa o briefing/preço/contexto congelados
- **AND** um payload recebido com preço/briefing/contexto diferente é recusado antes da chamada

#### Scenario: Retomada sem reenviar contexto de copy

- **WHEN** o conteúdo congelado contém contexto de copy e o reenvio o omite
- **THEN** o módulo preenche a comparação e a copy com o contexto congelado
- **AND** não inventa nem aceita um contexto novo

#### Scenario: Imagem diferente é recusada

- **WHEN** um data URL de produto ou identidade recebido tem hash/papel/ordem diferente das seleções congeladas
- **THEN** o módulo devolve `content_divergence`
- **AND** não chama provider nem reutiliza arte

#### Scenario: Arte sem estado congelado bloqueia

- **WHEN** a arte existe, mas não há snapshot/evidência congelados que comprovem o conteúdo original
- **THEN** o módulo devolve `artifact_without_frozen_state`
- **AND** não reutiliza a arte nem gera copy com conteúdo novo

#### Scenario: Snapshot corrompido ou ilegível bloqueia

- **WHEN** o snapshot existe sem binding ou a leitura do estado congelado falha
- **THEN** o módulo devolve bloqueio tipado
- **AND** não presume ausência, não troca de configuração e não chama provider

#### Scenario: Pricing do par congelado é validado

- **WHEN** a retomada vai executar uma chamada de imagem
- **THEN** o módulo valida elegibilidade e pricing do par congelado sem resolver a configuração atual
- **AND** pricing incompleto bloqueia antes do provider

### Requirement: Uma chamada de imagem por invocação, com alvo explícito

O módulo SHALL executar no máximo uma chamada de imagem por invocação, usando o alvo (`primary` ou `fallback`) e o número da tentativa informados pela F60, `size` 1024×1024 e a qualidade/modelo do snapshot.

O módulo SHALL NOT executar retry, fallback automático, segunda chamada, espera entre tentativas ou retry HTTP oculto do SDK. Falhas SHALL ser classificadas com a política da F60 e devolvidas ao chamador, que decide a próxima tentativa.

#### Scenario: Chamada única com alvo explícito

- **WHEN** a entrada autoriza a tentativa `primary` e o gate permite prosseguir
- **THEN** o módulo executa exatamente uma chamada de imagem com o alvo `primary`
- **AND** não executa fallback nem segunda chamada

#### Scenario: Falha transitória não repete

- **WHEN** a chamada falha com rate limit ou indisponibilidade
- **THEN** o módulo devolve falha transitória com a evidência da chamada
- **AND** não repete a chamada nem decide a próxima tentativa

#### Scenario: Timeout após possível envio é desconhecido

- **WHEN** a chamada sofre timeout, abort ou perda de comunicação após possível envio
- **THEN** o módulo devolve `unknown_result`
- **AND** não persiste arte, não grava falha definitiva e não repete

#### Scenario: Retry HTTP oculto desligado

- **WHEN** o módulo compõe o transporte de imagem
- **THEN** o loader/adapter é configurado com `maxRetries: 0`
- **AND** resposta sem imagem preserva `usage` para custo conhecido

### Requirement: Conversão e persistência do `square_original` pela F60.1

O módulo SHALL converter o retorno do provider em JPEG 1024×1024 usando o pipeline existente e persistir o `square_original` exclusivamente pela F60.1, com `origin: "provider_generation"` e `source: { kind: "none" }`.

A F60.1 SHALL ser a autoridade de identidade, dimensão, MIME, checksum, evidência, proveniência e imutabilidade. Após a persistência, o módulo SHALL fazer readback e devolver o artefato autoritativo, sem sobrescrever, apagar ou corrigir arte existente.

#### Scenario: Arte criada e lida de volta

- **WHEN** o provider devolve uma imagem válida e a conversão produz JPEG 1024×1024
- **THEN** a F60.1 persiste `square_original`/`provider_generation`
- **AND** o readback devolve o artefato integral
- **AND** o módulo devolve `art.kind = "created"`

#### Scenario: Corrida na persistência converge

- **WHEN** outra invocação persiste a mesma identidade antes desta
- **THEN** a F60.1 devolve `reused` ou conflito explícito
- **AND** o módulo faz readback e devolve `reused` quando compatível, sem sobrescrever

#### Scenario: Falha pós-chamada preserva evidência

- **WHEN** a imagem é gerada, mas a conversão, persistência ou readback falha
- **THEN** o módulo devolve falha tipada com a evidência da chamada, duração, usage e custo
- **AND** não executa segunda chamada paga

### Requirement: Copy independente, resumível, com conteúdo congelado

O módulo SHALL gerar e persistir copy pelo caminho produtivo existente quando o conteúdo congelado tiver contexto de copy, usando aquisição atômica, orçamento próprio e o estado persistido como autoridade.

Na primeira execução, o contexto de copy SHALL ser congelado junto ao briefing antes de a copy começar. Na retomada, a copy SHALL usar o briefing, o preço, o selo, a loja e o tom do conteúdo congelado, nunca o payload recebido.

Copy `completed` SHALL ser reutilizada sem nova chamada. Copy em andamento, aguardando espera ou com limite atingido SHALL ser devolvida com desfecho próprio, sem bloquear a arte. Falha da copy SHALL NOT impedir, reverter ou apagar a arte.

#### Scenario: Copy concluída é reutilizada

- **WHEN** já existe copy `completed` para a operação
- **THEN** o módulo devolve copy `completed` com origem `reused` e o texto/payload persistidos
- **AND** não chama o provider de copy

#### Scenario: Copy usa o conteúdo congelado

- **WHEN** a copy é gerada na primeira execução ou em retomada
- **THEN** o runner recebe o briefing e o contexto de copy congelados
- **AND** nenhum preço, selo, briefing ou tom recebido na retomada substitui o conteúdo original

#### Scenario: Copy falha e arte continua

- **WHEN** a copy falha ou está limitada, mas a imagem pode ser gerada
- **THEN** o módulo devolve o desfecho da copy e prossegue com a arte
- **AND** a arte não é bloqueada pela copy

#### Scenario: Arte falha e copy concluída é preservada

- **WHEN** a copy conclui e a imagem falha na mesma invocação
- **THEN** o resultado preserva a copy `completed`
- **AND** uma retomada reutiliza a copy sem nova chamada e tenta apenas a arte

#### Scenario: Copy não solicitada

- **WHEN** o conteúdo congelado não possui contexto de copy
- **THEN** o módulo devolve copy `not_requested`
- **AND** executa a arte normalmente

### Requirement: Copy com uma única requisição ao provider

O módulo SHALL executar a copy por um invoker próprio que não permita retry HTTP oculto do SDK. Os adapters OpenAI de texto SHALL receber `maxRetries: 0` por opção aditiva; o adapter Gemini SHALL executar uma única `generateContent` no SDK existente, que não possui camada de retry.

O gateway padrão, o registry padrão e o comportamento legado dos adapters SHALL permanecer inalterados quando a opção não for fornecida. Uma execução da copy SHALL NOT produzir mais de uma requisição ao provider.

#### Scenario: Uma requisição por execução

- **WHEN** o módulo gera copy
- **THEN** exatamente uma requisição é enviada ao provider selecionado
- **AND** nenhum retry automático ocorre em falha transitória

#### Scenario: Retry oculto do OpenAI desligado

- **WHEN** o invoker da copy usa o protocolo `chat-completions` ou `responses`
- **THEN** o adapter é construído com `maxRetries: 0`
- **AND** o default sem a opção permanece inalterado

#### Scenario: Gemini é single-shot

- **WHEN** o invoker da copy usa o protocolo `gemini`
- **THEN** o adapter executa uma única `generateContent`
- **AND** não há segunda tentativa no módulo

### Requirement: Resultados distinguíveis com falhas tipadas

O módulo SHALL devolver uma união fechada de resultados que distingue o desfecho da copy do desfecho da arte, incluindo arte `created`/`reused`, copy `completed` (gerada/reutilizada), `failed`, `in_progress`, `waiting`, `unavailable` e `not_requested`, e falhas tipadas de entrada, autorização, estado congelado (`frozen_state_conflict`/`blocked`), `content_divergence`, gate, snapshot, provider, saída, persistência e readback.

Toda falha após uma chamada de imagem SHALL incluir a evidência da chamada, mesmo quando a arte não foi persistida.

#### Scenario: Copy e arte distinguíveis

- **WHEN** a copy é gerada e a arte é criada
- **THEN** o resultado contém os dois desfechos separadamente
- **AND** cada um informa se foi gerado agora ou reutilizado

#### Scenario: Divergência de conteúdo é explícita

- **WHEN** o conteúdo recebido diverge do congelado
- **THEN** o resultado é `content_divergence` com o aspecto divergente
- **AND** não há arte, copy, chamada ou reutilização silenciosa

#### Scenario: Falha da arte carrega a chamada

- **WHEN** a arte falha após a chamada de imagem
- **THEN** o resultado inclui `callId`, tentativa, alvo, modelo/qualidade, duração, resultado, usage e custo
- **AND** o desfecho da copy permanece disponível

#### Scenario: Custo desconhecido não vira zero

- **WHEN** usage ou tarifa não permitem calcular o custo
- **THEN** a evidência da chamada informa custo desconhecido (`null`/`not_available`)
- **AND** nenhum valor fixo é inventado

### Requirement: Telemetria existente para todas as chamadas

O módulo SHALL registrar todas as chamadas reais de copy e imagem pela telemetria existente, sem criar sink, tabela ou escrita direta em `generation_events`.

A chamada de imagem SHALL usar o contexto/sink único com `operationId` correlacionável, `callId` por chamada, número da tentativa, alvo, modelo, qualidade, duração, usage, resultado e custo com origem. A chamada de copy SHALL usar o contexto do runner existente.

#### Scenario: Uma chamada real gera um evento

- **WHEN** o módulo executa uma chamada de imagem
- **THEN** exatamente um envelope real é emitido pelo gateway e persistido pelo sink único
- **AND** o evento contém a identidade da operação, chamada, tentativa, modelo/qualidade e custo

#### Scenario: Base e expansão correlacionáveis

- **WHEN** a base e uma expansão posterior usam a mesma operação
- **THEN** os eventos compartilham o mesmo `operation_run_id`
- **AND** cada chamada mantém seu próprio `callId`

#### Scenario: Falha de telemetria não gera nova chamada

- **WHEN** o sink de telemetria falha
- **THEN** a falha é best-effort e não altera o resultado nem dispara nova geração paga

### Requirement: Fronteiras proibidas e reutilização sem infraestrutura paralela

O módulo SHALL NOT reservar, confirmar ou estornar crédito; escrever em `campaigns`; criar artefato em `campaign-images`/`product_1_1_campaign_artifacts`; emitir URL assinada/pública; entregar, publicar ou liberar download; criar migration, tabela, bucket, coluna, policy, RPC ou índice.

O módulo SHALL reutilizar a F60.1, o snapshot/copy existentes e a telemetria existente, mantendo o fluxo 1:1 atual intocado.

#### Scenario: Nenhum efeito financeiro ou de entrega

- **WHEN** o módulo executa qualquer caminho
- **THEN** não há RPC/chamada de crédito, escrita em `campaigns`, URL assinada, download público ou entrega
- **AND** o status e o caminho de entrega da campanha permanecem inalterados

#### Scenario: Nenhuma infraestrutura paralela

- **WHEN** o módulo persiste a arte
- **THEN** usa `campaign_composition_artifacts`/`campaign-internal-artifacts` da F60.1
- **AND** não cria tabela, bucket, path ou evidência paralela

#### Scenario: Fluxo 1:1 preservado

- **WHEN** o módulo é adicionado ao código
- **THEN** `runProductOneToOneGeneration`, seus efeitos e seus contratos permanecem inalterados
- **AND** nenhuma rota, UI, flag ou ativação é criada

#### Scenario: Adapter textual legado preservado

- **WHEN** um adapter OpenAI de texto é construído sem a opção explícita
- **THEN** o cliente é criado exatamente como antes
- **AND** somente o invoker de copy do módulo usa `maxRetries: 0`
