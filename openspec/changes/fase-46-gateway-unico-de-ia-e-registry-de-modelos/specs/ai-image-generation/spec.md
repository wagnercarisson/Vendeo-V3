# AI Image Generation (delta F46)

> Delta da capability existente `ai-image-generation` pela `fase-46-gateway-unico-de-ia-e-registry-de-modelos`. Substitui a configuração por env-var pela resolução via registry/gateway e adiciona a execução pela camada única, preservando o comportamento de geração.

## MODIFIED Requirements

### Requirement: Image provider selectable via environment variable

O provider de imagem SHALL ser resolvido pelo **registry** a partir da capacidade (`campaign_image`/`visual_signature_image`), e não pela env-var `IMAGE_PROVIDER`. O `POST /api/campaign/generate-image` SHALL obter o provider via gateway, sem instanciar `OpenAIImageProvider` diretamente. A interface `ImageProvider` SHALL permanecer como contrato interno durante a migração.

#### Scenario: Route handler usa o gateway

- **WHEN** uma requisição chega ao endpoint generate-image
- **THEN** a rota executa a geração via gateway/registry
- **AND** não lê `IMAGE_PROVIDER` nem instancia uma classe de provider concreta

#### Scenario: Provider resolvido pelo registry

- **WHEN** a capacidade `campaign_image` é resolvida
- **THEN** o provider é `openai` por padrão (valor atual preservado)
- **AND** a troca de provider passa a ser responsabilidade do registry (Change B: seleção admin)

### Requirement: Image model configurable via environment variable

O modelo de geração de imagem SHALL ser resolvido pelo **registry**, com default `gpt-5.5` (preservado), e o modelo de visão de validação/revisão com default `gpt-4o` (preservado), sem env-vars dedicadas (`IMAGE_GENERATION_RESPONSES_MODEL`, `VISION_REVIEW_MODEL`, `IMAGE_VALIDATION_MODEL`). O fallback de edição usa `gpt-image-2` por padrão (preservado).

#### Scenario: Modelo de imagem resolvido pelo registry

- **WHEN** a capacidade `campaign_image` é resolvida
- **THEN** o modelo é `gpt-5.5` por padrão
- **AND** não depende de `IMAGE_GENERATION_RESPONSES_MODEL`

#### Scenario: Modelo de visão distinto e correto

- **WHEN** `campaign_image_review` e `campaign_input_validation` são resolvidas
- **THEN** o modelo é `gpt-4o` por padrão
- **AND** `visual_signature_validation` mantém `gpt-4o-mini`

## ADDED Requirements

### Requirement: Execução de imagem via gateway com fallback preservado

A geração de imagem SHALL ser executada pela camada única de invocação (gateway), que seleciona o adapter pelo `protocol` da capacidade: `responses` com a tool `image_generation` como caminho primário. O gateway executa **uma tentativa** e **não decide o fallback**: quando há imagem primária e a Responses API falha por motivo de capacidade, o **serviço orquestrador** faz uma **segunda `invoke` explícita** (capacidade `campaign_image_edit`, protocolo `images` → `images.edit`). O comportamento de gating do fallback, o envio determinístico das referências (primary, auxiliares, identidade) e o tamanho/qualidade SHALL ser preservados. Uma falha no Responses seguida de sucesso no Images representa **duas chamadas reais e dois envelopes de telemetria**, nunca um.

#### Scenario: Caminho primário via Responses API

- **WHEN** a geração de imagem é executada sem erro de capacidade
- **THEN** usa o adapter `responses` com a tool `image_generation`
- **AND** o tamanho e a qualidade atuais são preservados

#### Scenario: Fallback images.edit é segunda chamada explícita

- **WHEN** a Responses API falha por capacidade e existe imagem primária
- **THEN** o orquestrador faz uma segunda `invoke` explícita (capacidade `campaign_image_edit`, protocolo `images`) com as referências em ordem determinística
- **AND** o comportamento é equivalente ao atual, com **dois envelopes de telemetria** (falha + fallback)

### Requirement: Telemetria de imagem com modelo real e componente da tool

A execução de imagem SHALL emitir **um envelope de telemetria por tentativa real** com o modelo real usado (mainline `gpt-5.5` no caminho Responses; `gpt-image-2` no fallback de edição) e SHALL marcar o uso da tool `image_generation` para que a **estimativa** inclua o componente da tool quando aplicável — em `campaign_image` **e** `visual_signature_image`.

#### Scenario: Evento de imagem registra o modelo do caminho usado

- **WHEN** a geração usa o caminho Responses (gpt-5.5) ou o fallback de edição (gpt-image-2)
- **THEN** o evento registra o modelo efetivamente usado
- **AND** a estimativa é resolvida com o pricing correspondente

#### Scenario: Fallback produz dois eventos

- **WHEN** a chamada primária falha e o fallback de edição tem sucesso
- **THEN** dois eventos call-level são gravados (falha + sucesso)
- **AND** cada um registra o seu próprio modelo
