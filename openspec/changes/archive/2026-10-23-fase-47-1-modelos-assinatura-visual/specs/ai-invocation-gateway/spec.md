## ADDED Requirements

### Requirement: Contrato de request aditivo para imagem, reasoning e metadata

O contrato de invocação SHALL aceitar, de forma aditiva, `imageGenerationModel`,
`reasoningEffort` e `metadata`. O adapter `responses` SHALL traduzir
`imageGenerationModel` para o `model` da tool e `reasoningEffort` para
`params.reasoning.effort`. O `metadata` SHALL ser propagado ao envelope de
telemetria.

#### Scenario: Campos aditivos
- **WHEN** a Assinatura Visual usa configuração dedicada
- **THEN** o request contém modelo da tool, reasoning e metadata
- **AND** os campos existentes permanecem inalterados

#### Scenario: Compatibilidade
- **WHEN** os campos aditivos estão ausentes
- **THEN** o adapter mantém o payload legado
- **AND** nenhum campo é inventado

### Requirement: Resultado e envelope separam modelos e qualidade

O resultado e o envelope de telemetria SHALL registrar separadamente o modelo
Responses, o modelo da tool, a qualidade e os metadados de configuração. O
`model` do resultado SHALL continuar sendo o modelo Responses para
compatibilidade.

#### Scenario: Envelope com dois modelos
- **WHEN** a tool usa `gpt-image-2.5-sunburst` e o orquestrador `gpt-6-luna`
- **THEN** o envelope registra `responsesModel='gpt-6-luna'`
- **AND** registra `imageGenerationModel='gpt-image-2.5-sunburst'`
- **AND** registra `quality='medium'`

#### Scenario: Metadata de configuração
- **WHEN** a chamada carrega `config_version_id` e preset
- **THEN** esses campos chegam ao metadata persistido
- **AND** não podem ser forjados por campos canônicos do sink

#### Scenario: Usage da tool separado
- **WHEN** o provider expõe usage próprio da tool
- **THEN** o adapter preserva `imageToolUsage` e sua fonte no `usageMeta`
- **AND** o sink encaminha esse usage ao estimador sem combiná-lo com o usage principal

#### Scenario: Usage da tool ausente
- **WHEN** o provider não expõe usage separado da tool
- **THEN** `imageToolUsage` permanece ausente
- **AND** nenhum usage é inventado

### Requirement: Resolvedor de chave injetável no adapter Responses

O adapter `responses` SHALL aceitar um resolvedor de chave por construtor,
mantendo `getApiKey` como default. O gateway de validação da Assinatura Visual
SHALL usar uma instância com resolvedor dedicado, que lê somente a credencial
de validação local e falha se ela estiver ausente.

#### Scenario: Default preservado
- **WHEN** o adapter é criado sem resolvedor
- **THEN** ele usa `getApiKey`
- **AND** o comportamento existente permanece

#### Scenario: Credencial dedicada
- **WHEN** o gateway de validação é criado
- **THEN** ele usa a credencial de validação
- **AND** não usa a credencial de produção

#### Scenario: Credencial ausente
- **WHEN** a credencial de validação não existe
- **THEN** a chamada falha antes do provider
- **AND** não há fallback silencioso para `OPENAI_API_KEY`

### Requirement: Enriquecimento pós-chamada preserva um único evento

O gateway SHALL continuar emitindo exatamente um envelope por tentativa real. O
fluxo da Assinatura Visual SHALL usar um sink de buffering **por tentativa/
lote**, que permita enriquecer o envelope da imagem com os campos de parsing
antes do flush. A idempotência SHALL ser por instância/lote, nunca uma flag
global reutilizada entre imagens sequenciais. O enriquecimento SHALL NOT criar
um segundo evento, um evento sintético ou um update de evento já persistido.

#### Scenario: Enriquecimento antes do flush
- **WHEN** o Diretor de Arte faz o parsing após a resposta da imagem
- **THEN** ele enriquece o envelope bufferizado de `visual_signature_image`
- **AND** o flush persiste uma única vez com os campos `creative_intent_*`

#### Scenario: Parsing não executado
- **WHEN** a operação falha antes do parsing
- **THEN** o envelope é persistido uma única vez com `creative_intent_parse_status='not_attempted'`
- **AND** nenhum evento adicional é criado

#### Scenario: Variações sequenciais
- **WHEN** `generateVariations` gera imagens em sequência
- **THEN** cada imagem tem seu próprio sink/envelope enriquecido antes do flush correspondente
- **AND** não há mistura de metadados nem descarte da imagem seguinte
- **AND** falha do handler não é declarada como ausência de perda

### Requirement: Retries do SDK explícitos no gateway de validação

O gateway de validação local SHALL configurar `maxRetries` explicitamente no
adapter Responses. O valor SHALL ser `0` para que o limite efetivo seja o das
tentativas de aplicação e não haja chamada paga oculta. O adapter
default/produção SHALL permanecer inalterado.

#### Scenario: Sem retry oculto
- **WHEN** o gateway de validação executa uma tentativa
- **THEN** o adapter usa `maxRetries=0`
- **AND** uma falha não dispara retry interno do SDK

#### Scenario: Limite efetivo declarado
- **WHEN** a operação usa até 2 tentativas de aplicação
- **THEN** o máximo é 2 chamadas de imagem e 2 validações
- **AND** esse limite é registrado no UAT

#### Scenario: Default inalterado
- **WHEN** o gateway padrão é usado
- **THEN** sua configuração de retry permanece a existente
- **AND** o caminho de produção não é alterado
