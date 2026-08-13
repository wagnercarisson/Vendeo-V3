# AI Image Generation

> Modified by `fase-39-brief-estruturado-campanha` (D11): o `ImageGenerationService` passa a consumir o **domínio estruturado** `CampaignBrief` (`brief.product`/`brief.commercial`/`brief.media`) em vez do corpo flat (`body.*`). O conjunto de variáveis de prompt permanece **idêntico** para o mesmo input. `buildCommercialRepertoire` decide `validity` por `enabled/displayText` (D8) — sem heurística de string. A ponte `media.primary.dataUrl` → provider/input-validation torna-se explícita (D11).

## MODIFIED Requirements

### Requirement: ImageGenerationService orchestrates AI-native image generation

The system SHALL provide an `ImageGenerationService` that orchestrates the full image generation lifecycle: prompt assembly from the structured `CampaignBrief` domain, pre-generation validation, image model invocation, post-generation quality review, and finite correction loops.

> Modified by `fase-39-brief-estruturado-campanha` (D11): prompt assembly passa a consumir o `CampaignBrief` de **domínio estruturado** (blocos `product`/`commercial`/`media`) em vez de ler o corpo flat `brief.campaignInput`.

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

All existing prompt variables, assembly rules, and creative behavior SHALL be preserved unchanged. `buildPromptVariables()` SHALL NOT gain `identityImageUrl` — the identity image reference goes only to the provider, not to the prompt template.

#### Scenario: Service generates campaign image from structured CampaignBrief

- **WHEN** `ImageGenerationService.generateImage()` receives um `CampaignBrief` estruturado (montado pelo mapper da rota)
- **THEN** the service SHALL assemble a marketing-directed prompt using the `campaign-image-director.md` prompt file
- **AND** the service SHALL send the prompt + `media.primary.dataUrl` (produto) + identity image reference to the `ImageProvider`
- **AND** the service SHALL return a generated 1:1 square image as a base64 data URL
- **AND** all existing prompt variables and rules SHALL remain unchanged

#### Scenario: Service produz MESMO prompt para o mesmo payload flat

- **WHEN** o mesmo payload flat de hoje é convertido para `CampaignBrief` e passado ao service
- **THEN** o prompt final é idêntico ao produzido pelo fluxo flat atual (regressão por golden test por intent — D11)

### Requirement: buildPromptVariables includes creative direction context and intent variables

The `ImageGenerationService.buildPromptVariables()` method SHALL accept the structured `CampaignBrief` (domínio) and return the following new variables:

> Modified by `fase-31-2-diretores-por-intencao`. Modified by `fase-39-brief-estruturado-campanha` (D11): a fonte dos dados passa a ser o domínio estruturado — as variáveis e regras **não mudam**.

- `identityDirective` — string, derived from `ResolvedCampaignContext.identity.directive`
- `campaignIntent` — string, valor da intent (`brief.commercial.intent`)
- `preserveImageDirective` — string, instrução condicional (vazia para offer, `"NÃO recortar..."` para spotlight/exclusive com preserveImageContext=true)
- `commercialFrame` — string, texto comercial por intent (oferta/destaque/exclusivo)
- `discountedPrice` e `originalPrice` condicionais por intent (vazio quando não aplicável)

All existing variables SHALL be preserved unchanged. The following existing variables remain:
- `creativePersona` — segment-based persona string
- `inferredCategory` — product category (inferred or store segment fallback)
- `hasCategoryConflict` — `"sim"` or `"nao"` based on `isSameCategory()` comparison
- `categoryConflictDirective` — conditional directive string (empty when no conflict)
- `commercialRepertoire` — output of `buildCommercialRepertoire()`
- `inputValidationSummary` — output of `buildValidationSummary()`
- `creativeContextGuidance` — output of `buildCreativeContextGuidance()`

`buildPromptVariables()` SHALL NOT receive or return `identityImageUrl`. The identity image reference is passed directly to the `ImageProvider`, not interpolated into the prompt text.

#### Scenario: identityDirective present in buildPromptVariables output

- **WHEN** `buildPromptVariables()` is called with a structured `CampaignBrief` + `ResolvedCampaignContext`
- **THEN** the returned record SHALL include `identityDirective` with the directive string
- **AND** SHALL NOT include `identityImageUrl`

#### Scenario: New variables present alongside existing ones

- **WHEN** `buildPromptVariables()` is called
- **THEN** the returned record SHALL include all existing variables
- **AND** SHALL include `identityDirective`

#### Scenario: buildPromptVariables inclui commercialFrame

- **WHEN** `buildPromptVariables()` é chamado com brief de `commercial.intent: "spotlight"`
- **THEN** as variáveis incluem `commercialFrame` com texto de destaque

### Requirement: buildCommercialRepertoire adaptado por intent

The system SHALL implement `ImageGenerationService.buildCommercialRepertoire(brief: CampaignBrief): string` that analyzes the following domains for commercially actionable content, filtrado por intent:

> Modified by `fase-31-2-diretores-por-intencao`. Modified by `fase-39-brief-estruturado-campanha` (D8/D11): a decisão de validade passa a ser **semântica** (`validity.enabled` + `displayText`), eliminando a heurística de string (`/`, `até`, `válida`).

| Funcionalidade | offer | spotlight | exclusive |
|---------------|-------|-----------|-----------|
| Escassez ("poucas unidades") | sim | não | sim (se aplicável) |
| Validade (`validity.displayText` quando `enabled`) | sim | não | não |
| Detalhes da campanha | sim | sim | sim |
| Detalhes adicionais | sim | sim | sim |
| Benefícios do produto | contextual | sim | sim |
| Caráter exclusivo | não | não | sim |

- `validity` SHALL entrar no repertório **somente quando** `brief.commercial.validity?.enabled === true`, usando `validity.displayText` (D8).
- A decisão SHALL NOT depender de heurística de string (`/`, `até`, `válida`).

#### Scenario: buildCommercialRepertoire para spotlight omite escassez

- **WHEN** `buildCommercialRepertoire()` é chamado com `commercial.intent: "spotlight"` e `commercial.availabilityNotes: "poucas unidades"`
- **THEN** o retorno NÃO contém a nota de escassez

#### Scenario: validade entra no repertório por enabled/displayText

- **WHEN** `brief.commercial.validity = { enabled: true, displayText: "válida até 30/09" }` com intent `offer`
- **THEN** o retorno contém o texto da validade (sem depender de heurística de string — D8)

#### Scenario: validade desabilitada não entra no repertório

- **WHEN** `brief.commercial.validity` está ausente ou `enabled === false`
- **THEN** o retorno NÃO contém texto de validade
