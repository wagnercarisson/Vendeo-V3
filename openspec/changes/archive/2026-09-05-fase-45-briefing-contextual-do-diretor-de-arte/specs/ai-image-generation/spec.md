# AI Image Generation

> Delta spec for `fase-45-briefing-contextual-do-diretor-de-arte`. Reorganiza a montagem do prompt do diretor de imagem em **briefing contextual por blocos** (ver capability `art-director-contextual-briefing`), removendo requisitos supersedidos de paridade/reframe textual.

## MODIFIED Requirements

### Requirement: ImageGenerationService orchestrates AI-native image generation

The system SHALL provide an `ImageGenerationService` that orchestrates the full image generation lifecycle: prompt assembly from the structured `CampaignBrief` domain, pre-generation validation, image model invocation, post-generation quality review, and finite correction loops.

> Modified by `fase-39-brief-estruturado-campanha` (D11): prompt assembly passa a consumir o `CampaignBrief` de **domínio estruturado** (blocos `product`/`commercial`/`media`) em vez de ler o corpo flat `brief.campaignInput`.
> Modified by `fase-45-briefing-contextual-do-diretor-de-arte`: a montagem do prompt do diretor passa a ser **contextual por blocos** (ver capability `art-director-contextual-briefing`). O texto interno do prompt do diretor e o conjunto de chaves de montagem **mudam intencionalmente** (D5 do design); a **superfície externa** permanece inalterada (contrato HTTP/schema/snapshot/domínio, revisor, Copy Director e o comportamento percebido pelo lojista). A preservação da **intenção/qualidade visual** é alvo da fase (regras de conteúdo + UAT humano comparativo), não uma garantia formal de resultado visual idêntico.

The service SHALL NOT persist any generated images, prompts, or review results. All data exists only in request/session/client scope during this phase.

The service SHALL reuse existing store and campaign forms — no separate demo-only flow SHALL be created.

The service SHALL report progress through named phases via an optional `onPhaseChange` callback: `input_validation`, `prompt_assembly`, `image_generation`, `quality_review`, `done`. Each phase SHALL emit a `GenerationPhaseEvent` when starting, completing, or failing.

The service SHALL accept an optional `AbortSignal` to support global timeout cancellation. When the signal fires, the service SHALL abort any in-flight provider call and emit a terminal `global_timeout` error.

From the structured `CampaignBrief` (domínio), the service SHALL:
- Use `brief.product` for product fields (`name`, `description?`, `brand?`, `sizeOrVariant?`)
- Use `brief.commercial` for campaign/commercial fields (`intent`, preços, `badgeText`, `validity`, `legalNotice`, `availabilityNotes`, `campaignDetails`, `additionalDetails`)
- Use `brief.creativeContext` for `preserveImageContext`/`themeId`
- Use `brief.media.images` (imagem `primary`) para a ponte `media.primary.dataUrl` → provider/input-validation (D11)
- Use `ResolvedCampaignContext.identity.directive` to inject into prompt variables as `identityDirective`
- Use `ResolvedCampaignContext.identity.imageUrl` to pass to the `ImageProvider` as the identity image reference
- Use `ResolvedCampaignContext.brandProfile` for brand creative direction

A montagem do prompt do diretor SHALL ser **contextual**: `buildPromptVariables` delega a composição dos blocos de seção a um helper puro dedicado (`art-director-briefing`), que retorna apenas os blocos relevantes ao caso real (campos ausentes não produzem texto no prompt final; nenhuma seção vazia ou linha de tabela em branco é enviada). A montagem SHALL ser **determinística** (mesmo input → mesmo texto de prompt). A mudança textual interna é intencional (objetivo da F45); a **superfície externa** permanece inalterada e a **intenção/qualidade visual** é preservada por regras de conteúdo + UAT humano comparativo (não se promete paridade de resultado visual pixel a pixel). `identityImageUrl` permanece **provider-only** — a referência vai ao provider e SHALL NOT ser interpolada no template visual como instrução textual (comportamento existente, mantido como regressão).

#### Scenario: Service generates campaign image from structured CampaignBrief

- **WHEN** `ImageGenerationService.generateImage()` recebe um `CampaignBrief` estruturado (montado pelo mapper da rota)
- **THEN** the service SHALL assemble a marketing-directed prompt using the per-intent `campaign-image-director-${intent}.md` prompt file through the contextual builder
- **AND** the service SHALL send the prompt + `media.primary.dataUrl` (produto) + identity image reference to the `ImageProvider`
- **AND** the service SHALL return a generated 1:1 square image as a base64 data URL
- **AND** the prompt final não contém seções vazias, linhas de tabela em branco ou placeholders não resolvidos para campos ausentes

#### Scenario: Service produz MESMO prompt para o mesmo payload

- **WHEN** o mesmo payload é convertido para `CampaignBrief` e passado ao service duas vezes
- **THEN** o prompt final do diretor é **idêntico** nas duas execuções (montagem determinística por blocos)

#### Scenario: Service emits phase events via callback

- **WHEN** `onPhaseChange` callback is provided
- **THEN** the service SHALL emit `input_validation` → `prompt_assembly` → `image_generation` → `quality_review` → `done` in order
- **AND** each phase SHALL emit `status: "running"` when starting and `status: "complete"` when done

#### Scenario: Service aborts on signal

- **WHEN** the provided `AbortSignal` fires during image generation
- **THEN** the service SHALL abort the current provider call
- **AND** SHALL NOT attempt further retries
- **AND** SHALL emit a terminal error with `code: "global_timeout"`

### Requirement: legalNotice desabilitado SHALL resultar em prompt e revisor sem texto obrigatório

O sistema SHALL garantir que, quando `legalNotice.enabled === false` (checkbox desmarcado + sem texto livre → `mandatoryArtworkText` ausente):

- o prompt do diretor SHALL NOT montar a seção de texto obrigatório (`requiredArtworkTextSection` ausente — sem heading vazio e sem placeholder);
- o revisor SHALL receber `mandatoryArtworkTextSection` vazio (nenhum texto obrigatório a verificar).

Quando `validity.enabled === true` + `displayText` (offer), o sistema SHALL montar `validityTextSection` no revisor com o `displayText`; quando ausente → `validityTextSection` vazio. O diretor SHALL exibir a validade **uma única vez** (bloco de fatos da campanha) quando `offer` + `validity.enabled`.

> Added by `fase-40-campos-comerciais-avisos-brief`. Modified by `fase-45-briefing-contextual-do-diretor-de-arte`: no diretor, a ausência de texto obrigatório passa a significar **bloco `requiredArtworkTextSection` ausente** (nada renderizado); o revisor permanece com `mandatoryArtworkTextSection` vazio (inalterado).

#### Scenario: legalNotice desabilitado gera prompt e revisor vazios

- **WHEN** o checkbox está desmarcado e não há texto livre (`mandatoryArtworkText` ausente → `legalNotice.enabled=false`)
- **THEN** o prompt do diretor não contém seção de texto obrigatório (nada é renderizado)
- **AND** `mandatoryArtworkTextSection` do revisor é vazio (nada a verificar)

#### Scenario: Validade habilitada monta seção no revisor e linha única no diretor

- **WHEN** `validity.enabled === true` com `displayText = "até 30/09"` e intent `offer`
- **THEN** o revisor monta `validityTextSection` contendo "até 30/09"
- **AND** o prompt do diretor contém a validade **uma única vez** no bloco de fatos da campanha
- **AND** sem validade → `validityTextSection` do revisor é vazio e o diretor não menciona validade

## REMOVED Requirements

### Requirement: Preservação comportamental — nenhuma variável criativa alterada

**Reason**: Requisito supersedido pela F45. O bloqueio de "mesmo conjunto de variáveis/keys para o mesmo input" e "mudanças textuais limitadas do prompt" (F40 D6/F41 D6, com `EXPECTED_KEYS`) impedia exatamente a reorganização contextual que é o objetivo desta fase. O novo contrato (superfície externa inalterada + montagem determinística + intenção/qualidade visual preservada por regras e UAT humano comparativo) está definido na capability `art-director-contextual-briefing`.

**Migration**: Substituir os golden tests de conjunto exato de keys (39) por invariantes (placeholders dos templates ⊆ chaves fornecidas; determinismo; presente/ausente por bloco; contrato externo inalterado) conforme o design da F45.

### Requirement: buildPromptVariables includes creative direction context and intent variables

**Reason**: Requisito supersedido pela F45. `buildPromptVariables` deixa de expor um mapa fixo de chaves (incluindo chaves mortas como `commercialFrame`/`hasCategoryConflict`/`brandColorsChosen`) e passa a delegar a composição dos blocos ao helper `art-director-briefing`, retornando apenas as chaves realmente consumidas pelos templates + chaves de orquestração (`campaignIntent`; `identityImageUrl` permanece provider-only).

**Migration**: As variáveis de contexto/direção criativa passam a existir **dentro dos blocos montados** (ver capability `art-director-contextual-briefing`). Testes que ancoravam o mapa de 39 keys são co-migrados para invariantes de montagem.

### Requirement: Prompt reframe — bloco condicional de composição (D6)

**Reason**: Requisito supersedido pela F45. O "bloco condicional de composição" do aviso/texto obrigatório (F40 D6) e a linha condicional do texto obrigatório são substituídos por **seções próprias** (`illustrativeNoticeSection`/`requiredArtworkTextSection`), montadas apenas quando o conteúdo existe, com instruções simples e separadas (ver capability `art-director-contextual-briefing`).

**Migration**: A reescrita dos 4 prompts do diretor em estrutura editorial + blocos contextuais absorve a semântica do reframe de F40 (texto obrigatório → seção própria; aviso → seção própria com orientação de posicionamento lateral/minúsculo/legível/discreto). Âncoras do `prompt-reframe.test.ts` são atualizadas.

### Requirement: Prompt com bloco descritivo de 1+N referências (D6)

**Reason**: Requisito supersedido pela F45. O bloco descritivo hardcoded "1+N" (F41 D6, "sem nova variável") é absorvido pela **seção de produto/referências** (`productReferenceSection`), que hierarquiza primary (referência factual forte) × auxiliares (apoio sem competir) e incorpora `preserveImageDirective` quando aplicável (ver capability `art-director-contextual-briefing`).

**Migration**: A orientação de hierarquia entre a imagem principal e as auxiliares permanece presente no prompt final, agora como bloco contextual (pode variar conforme a quantidade de imagens e `preserveImageContext`), sem duplicação com outras seções.
