# AI Image Generation

## Purpose

Core image generation pipeline: orchestrates prompt assembly, model invocation, quality review, and correction loops. Defines the service, provider interface, API endpoint, and client-side NDJSON streaming consumer.

> Modified by `fase-34-store-readiness` (ADDED). Added readiness guard in the handler, after ownership/auth and before rate limit/balance check.
> Modified by `fase-39-brief-estruturado-campanha` (MODIFIED). O `ImageGenerationService` passa a consumir o **domínio estruturado** `CampaignBrief` (`brief.product`/`brief.commercial`/`brief.media`/`brief.creativeContext`) em vez do corpo flat (`body.*`). O conjunto de variáveis de prompt permanece **idêntico** para o mesmo input. `buildCommercialRepertoire` decide `validity` por `enabled/displayText` (D8) — sem heurística de string. A ponte `media.primary.dataUrl` → provider/input-validation torna-se explícita (D11).
> Modified by `fase-40-campos-comerciais-avisos-brief` (D6): os 4 prompts do diretor (`campaign-image-director.md`, `-offer.md`, `-spotlight.md`, `-exclusive.md`) perdem a instrução **incondicional** "SEMPRE acrescente ... 'Imagem meramente ilustrativa'" (herança UAT-3) e ganham um **bloco condicional de composição** — o aviso ilustrativo só entra na arte quando houver texto obrigatório/aviso legal informado. O conjunto de variáveis/keys do prompt permanece **idêntico** para o mesmo input (golden `EXPECTED_KEYS = 38`); o texto do prompt muda intencionalmente (D6). O comportamento visual default é preservado (checkbox marcado → aviso na arte como hoje). As superfícies de validade (`buildCommercialRepertoire` → `- Oferta válida:` e template offer/base → `**Validade da oferta:**`) NÃO mudam (D5).
> Modified by `fase-41-midia-de-campanha-mobile` (D2/D6/D7/D9/D10): transporte aditivo `productImages[]` (D2) com `MAX_CAMPAIGN_IMAGES = 4` e invariante exactly-1-primary; `productImageDataUrl` deixa de ser required no Zod (obrigatoriedade passa à regra de exclusividade da rota); provider monta **N `input_image`** (D7); fallback `images.edit` **gated por primary única** (D7); prompt ganha **bloco descritivo 1+N** sem nova variável (D6); revisor recebe a **primary** como referência (D9); limites por item + teto agregado → 413 (D10).

## Requirements

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

All existing prompt variables, assembly rules, and creative behavior SHALL be preserved unchanged. `identityImageUrl` MAY exist among the returned prompt variables — it was already present in the golden baseline (38 keys) before this phase (D11 preserves the pre-F39 behavior). The identity image reference goes only to the provider and SHALL NOT be interpolated into the visual prompt template as textual instruction.

#### Scenario: Service generates campaign image from structured CampaignBrief

- **WHEN** `ImageGenerationService.generateImage()` receives um `CampaignBrief` estruturado (montado pelo mapper da rota)
- **THEN** the service SHALL assemble a marketing-directed prompt using the `campaign-image-director.md` prompt file
- **AND** the service SHALL send the prompt + `media.primary.dataUrl` (produto) + identity image reference to the `ImageProvider`
- **AND** the service SHALL return a generated 1:1 square image as a base64 data URL
- **AND** all existing prompt variables and rules SHALL remain unchanged

#### Scenario: Service produz MESMO prompt para o mesmo payload flat

- **WHEN** o mesmo payload flat de hoje é convertido para `CampaignBrief` e passado ao service
- **THEN** o prompt final é idêntico ao produzido pelo fluxo flat atual (regressão por golden test por intent — D11)

#### Scenario: Service emits phase events via callback

- **WHEN** `onPhaseChange` callback is provided
- **THEN** the service SHALL emit `input_validation` → `prompt_assembly` → `image_generation` → `quality_review` → `done` in order
- **AND** each phase SHALL emit `status: "running"` when starting and `status: "complete"` when done

#### Scenario: Service aborts on signal

- **WHEN** the provided `AbortSignal` fires during image generation
- **THEN** the service SHALL abort the current provider call
- **AND** SHALL NOT attempt further retries
- **AND** SHALL emit a terminal error with `code: "global_timeout"`

### Requirement: ImageProvider interface

The system SHALL define an `ImageProvider` interface at `src/lib/image-generation/providers/types.ts` that abstracts the visual AI model invocation.

The interface SHALL define:
- `name` — `string` (readonly), provider identifier
- `generateImage(input: ImageProviderInput): Promise<ImageProviderOutput>` — method that takes a structured input and returns a generated image

`ImageProviderInput` SHALL contain (updated by F41 D7):
- `prompt` — string, required
- `productImageDataUrl?` — string, optional data URL (e.g., `data:image/jpeg;base64,...`) — **caminho legado (1 imagem)**
- `productImagesDataUrls?` — string[], **NOVO (D7)** — lista ordenada de data URLs (índice 0 = primary); presente quando o payload usa `productImages[]` com auxiliares
- `identityImageUrl?` — string, optional, replaces `logoImageUrl`. Carries the logo or visual signature URL resolved by identity state. When absent, no identity image SHALL be sent.
- `size?` — `"1024x1024" | "2048x2048"`, optional
- `quality?` — `"low" | "medium" | "high" | "auto"`, optional
- `signal?` — `AbortSignal`, optional — when provided, the provider SHALL pass it to the underlying API client for cancellation support
- `attempt?` — `number`, optional — zero-indexed attempt counter (0 = primary, 1+ = retry/fallback)

`ImageProviderOutput` SHALL contain:
- `imageBase64` — string, base64-encoded image data
- `mimeType` — `"image/png" | "image/jpeg" | "image/webp"`
- `model` — string, the model identifier used for generation

#### Scenario: ImageProvider generates image from prompt

- **WHEN** `ImageProvider.generateImage()` is called with a valid prompt
- **THEN** it SHALL return an `ImageProviderOutput` with `imageBase64`, `mimeType`, and `model`
- **AND** the image SHALL be a 1:1 square format

#### Scenario: ImageProvider accepts AbortSignal

- **WHEN** `signal` is provided in `ImageProviderInput`
- **THEN** the provider SHALL pass the signal to the underlying API client
- **AND** if the signal fires, the provider SHALL cancel the request

#### Scenario: Provider name identifies implementation

- **WHEN** inspecting `provider.name`
- **THEN** it SHALL return a non-empty string identifying the provider type (e.g., `"openai"`)

#### Scenario: identityImageUrl sent as input_image

- **WHEN** `identityImageUrl` is provided in `ImageProviderInput`
- **THEN** `OpenAIImageProvider` SHALL include it as an `input_image` reference
- **AND** the `detail` SHALL be set to `"low"`

#### Scenario: productImagesDataUrls envia N input_image (D7)

- **WHEN** `productImagesDataUrls` contém [primary, reference1, reference2]
- **THEN** `OpenAIImageProvider` SHALL montar **3 blocos `input_image`** no mainline Responses path (posição 0 = primary)
- **AND** a identidade/logo (quando presente) continua `detail: "low"`

#### Scenario: No identityImageUrl sends no extra image

- **WHEN** `identityImageUrl` is `undefined`
- **THEN** `OpenAIImageProvider` SHALL NOT send any identity image
- **AND** SHALL only send `input_text` and the product image(s) present (`productImageDataUrl` OR `productImagesDataUrls`)

### Requirement: GenerateImageRequestSchema with campaignIntent e preserveImageContext

> Modified by `fase-31-2-diretores-por-intencao`. Modified by `fase-41-midia-de-campanha-mobile` (D2/D10): campo aditivo `productImages[]` + `MAX_CAMPAIGN_IMAGES`; `productImageDataUrl` deixa de ser required no Zod (preservação **comportamental** — a obrigatoriedade passa a ser garantida pela regra de exclusividade validada na rota). Modified by `fase-43-revisao-brief-pre-geracao` (D5): `inputValidationOverride.productImageCheck` ganha o literal `"brief_review_confirmed"` (revisão humana explícita do brief) — `.strict()` preservado.

O schema `GenerateImageRequestSchema` em `src/lib/image-generation/schema.ts` SHALL ser modificado para aceitar:

- `campaignIntent` — `z.enum(["offer", "spotlight", "exclusive"]).optional().default("offer")` — ADICIONADO
- `preserveImageContext` — `z.boolean().optional()` — ADICIONADO
- `discountedPriceCents` — `z.number().int().positive().optional()` — MODIFICADO (era required, passou a optional para tolerância por intent)
- `productImages` — `z.array(ProductImageInputSchema).min(1).max(MAX_CAMPAIGN_IMAGES).superRefine(...)` — **ADICIONADO (D2)**, opcional; o item `{ role, source, mimeType, dataUrl }` **NÃO carrega `id`** (a rota gera/normaliza — D5)
- `productImageDataUrl` — passa a **`optional()`** (antes `z.string().min(1)` required) — preservação **comportamental** do legado (D2)
- `inputValidationOverride.productImageCheck` — **MODIFICADO (F43 D5):** de `z.literal("user_confirmed_continue")` para `z.union([z.literal("user_confirmed_continue"), z.literal("brief_review_confirmed")]).optional()` — semântica distinta (ver matriz abaixo)

```ts
export const GenerateImageRequestSchema = z.object({
  // ...campos atuais inalterados...
  inputValidationOverride: z
    .object({
      productImageCheck: z
        .union([
          z.literal("user_confirmed_continue"), // 409 + insistiu (comportamento atual)
          z.literal("brief_review_confirmed"),  // NOVO — revisou o brief e confirmou (D5)
        ])
        .optional(),
    })
    .optional(),
}).strict();
```

**Matriz de semântica do override (documentada no schema e nos testes):**

| Valor | Origem | Comportamento |
|-------|--------|---------------|
| `brief_review_confirmed` | Usuário revisou o brief completo (produto + imagens + preço + validade + avisos) e confirmou | Pula a IA de visão (caminho padrão da F43); fase `input_validation` emitida com **obrigatoriamente** `status: "skipped"` (detail opcional "Brief confirmado pelo usuário") |
| `user_confirmed_continue` | Usuário recebeu 409 de conflito e **insistiu mesmo assim** | Pula a IA de visão (comportamento atual, "continuar mesmo assim"); fase `input_validation` emitida com **obrigatoriamente** `status: "skipped"` (detail opcional "Validação dispensada") |
| (sem override) | Cliente legado / fallback | Validação IA produto×imagem roda como rede de segurança (comportamento atual); fase `input_validation` normal |

O schema SHALL definir `MAX_CAMPAIGN_IMAGES = 4` (1 primary + 3 auxiliares — D10) e `ProductImageInputSchema`:

```ts
export const ProductImageInputSchema = z.object({
  role: z.enum(["primary", "variation", "combo_item", "reference"]),
  source: z.enum(["upload", "camera"]),
  mimeType: z.string(),
  dataUrl: z.string().min(1),          // base64 (transporte); snapshot NUNCA persiste
});
```

O `superRefine` do `productImages[]` SHALL validar que existe **exatamente 1 imagem `role: "primary"`** no array (invariante do domínio agora no transporte — D2).

O schema SHALL usar `.strict()` para rejeitar campos não reconhecidos (preservado — o campo novo é aditivo).

A validação semântica de preço é externalizada: offer exige preço no frontend e no backend, exclusive normaliza para ausente no backend.

#### Scenario: campaignIntent opcional é aceito

- **WHEN** o body inclui `campaignIntent: "spotlight"`
- **THEN** `GenerateImageRequestSchema.safeParse()` retorna `{ success: true, data }`
- **AND** `data.campaignIntent === "spotlight"`

#### Scenario: campaignIntent omitido usa default offer

- **WHEN** o body não inclui `campaignIntent`
- **THEN** `GenerateImageRequestSchema.safeParse()` retorna `{ success: true, data }`
- **AND** `data.campaignIntent` é `"offer"`

#### Scenario: preserveImageContext opcional é aceito

- **WHEN** o body inclui `preserveImageContext: true`
- **THEN** `GenerateImageRequestSchema.safeParse()` retorna `{ success: true, data }`

#### Scenario: discountedPriceCents opcional aceito

> Modified by `fase-31-2-diretores-por-intencao`.

- **WHEN** o body omite `discountedPriceCents` com `campaignIntent: "exclusive"`
- **THEN** `GenerateImageRequestSchema.safeParse()` retorna `{ success: true }`

#### Scenario: productImages aceito com exatamente 1 primary (D2)

- **WHEN** o body inclui `productImages` com 1 `primary` + 2 `reference`
- **THEN** `GenerateImageRequestSchema.safeParse()` retorna `{ success: true, data }`
- **AND** `data.productImages` tem 3 itens com roles/source/mimeType/dataUrl preservados

#### Scenario: productImages sem primary é rejeitado (D2)

- **WHEN** o body inclui `productImages` sem nenhum `primary` (ou com 2+ primaries)
- **THEN** `GenerateImageRequestSchema.safeParse()` retorna `{ success: false }` com issue de "Deve existir exatamente 1 imagem com role primary"

#### Scenario: productImages acima do teto é rejeitado (D10)

- **WHEN** o body inclui `productImages` com mais de `MAX_CAMPAIGN_IMAGES` itens
- **THEN** `GenerateImageRequestSchema.safeParse()` retorna `{ success: false }`

#### Scenario: productImageDataUrl opcional (legado comportamental — D2)

- **WHEN** o body omite `productImageDataUrl` (usa `productImages` em vez)
- **THEN** `GenerateImageRequestSchema.safeParse()` retorna `{ success: true }` — a ausência não é mais erro do Zod
- **AND** a obrigatoriedade da imagem passa a ser garantida pela **regra de exclusividade da rota** (400)

#### Scenario: brief_review_confirmed aceito (F43 D5)

- **WHEN** o body inclui `inputValidationOverride.productImageCheck: "brief_review_confirmed"`
- **THEN** `GenerateImageRequestSchema.safeParse()` retorna `{ success: true, data }`
- **AND** `data.inputValidationOverride.productImageCheck === "brief_review_confirmed"`

#### Scenario: user_confirmed_continue continua aceito (F43 D5)

- **WHEN** o body inclui `inputValidationOverride.productImageCheck: "user_confirmed_continue"`
- **THEN** `GenerateImageRequestSchema.safeParse()` retorna `{ success: true, data }`
- **AND** `data.inputValidationOverride.productImageCheck === "user_confirmed_continue"`

#### Scenario: valor desconhecido do override é rejeitado (F43 D5)

- **WHEN** o body inclui `inputValidationOverride.productImageCheck: "valor_desconhecido"`
- **THEN** `GenerateImageRequestSchema.safeParse()` retorna `{ success: false }` (`.strict()`/enum preservado)

### Requirement: POST /api/campaign/generate-image endpoint

The system SHALL expose a POST endpoint at `/api/campaign/generate-image`.

> Modified by `fase-43-revisao-brief-pre-geracao` (D5): a regra pré-stream atual (`if (!parsed.data.inputValidationOverride?.productImageCheck)`) já pula a validação IA para **qualquer** override truthy — o novo literal `brief_review_confirmed` é coberto sem mudança de lógica. Com a flag administrativa `force_brief_vision_check` **ligada**, a rota **normaliza um `effectiveParsedData`/`effectiveCampaignInput`** (remove `brief_review_confirmed` do `inputValidationOverride`) **antes** da checagem pré-stream e **usa o mesmo input normalizado** para a checagem, construir o brief e chamar `imageService.generateImage(...)` — pré-stream e Phase 1 do serviço validam. `user_confirmed_continue` **nunca é removido**.

The endpoint SHALL:
1. Accept POST requests with `Content-Type: application/json`
2. Require `storeId` (UUID) and **uma imagem de produto** — via `productImageDataUrl` OU `productImages[]` (regra de exclusividade/compatibilidade D2) — return 400 (no stream) se ambos ausentes
3. Accept all existing campaign/product fields (`productName`, `originalPriceCents`, `discountedPriceCents`, `badgeText`, `description`, `hook`, `cta`, `objective`, `campaignDetails`, `additionalDetails`, `targetChannel`, `format`, `validity`, `availabilityNotes`, `sensitiveConstraints`, `campaignIntent`, `preserveImageContext`) and `inputValidationOverride`
4. **NOT accept** `storeName`, `storeSegment`, `storeTone`, `brandColor`, `storeLogoUrl`, or `brandProfile` — if present, return 400
5. Call `resolveStoreIdentity(storeId)` → `validateIdentityReference()` → `buildCampaignBrief()` → `ImageGenerationService.generateImage(CampaignBrief)`
6. Run pre-generation input validation (product name vs product image), unless overridden by `inputValidationOverride`
7. Return a streaming NDJSON response (`Content-Type: application/x-ndjson`) with status 200 after validation passes
8. Stream phase events as newline-delimited JSON lines during generation
9. End the stream with a `type: "result"` event on success or a `type: "error"` event on terminal failure
10. Return 400 (no stream) nos casos de imagem: (a) **ambos** `productImageDataUrl` e `productImages` ausentes → "Imagem do produto é obrigatória"; (b) **ambos presentes** → payload ambíguo (regra canônica — mutuamente exclusivos, D2)
11. Return 413 (no stream) quando qualquer `dataUrl` do `productImages[]` exceder o limite por item (`MAX_PRODUCT_IMAGE_BASE64_SIZE`) ou quando a **soma agregada** dos dataUrls exceder o teto agregado do array (D10). O limite legado single permanece para `productImageDataUrl`.

Errors detected before streaming begins SHALL use standard HTTP error codes. Once the stream starts, the HTTP status SHALL remain 200 and all terminal errors SHALL be delivered as NDJSON events.

The endpoint SHALL NOT modify, replace, or deprecate the existing `POST /api/campaign/generate` endpoint.

The `type: "result"` event SHALL include the `storeIdentity` snapshot used during generation:
```json
{ "type": "result", "success": true, "imageDataUrl": "...", "storeIdentity": { ... } }
```

The endpoint SHALL NOT modify, replace, or deprecate the existing `POST /api/campaign/generate` endpoint.

#### Scenario: Valid request returns streaming NDJSON

- **WHEN** POST to `/api/campaign/generate-image` with `storeId` and valid campaign data
- **THEN** the response SHALL have status 200
- **AND** `Content-Type` SHALL be `application/x-ndjson`
- **AND** the body SHALL contain newline-delimited JSON phase events followed by a final `type: "result"` event with `imageDataUrl` and `storeIdentity`

#### Scenario: Stream events have correct structure

- **WHEN** the stream delivers events
- **THEN** each event SHALL be a complete JSON object on its own line
- **AND** the line SHALL end with `\n`
- **AND** event type SHALL be `"phase"`, `"result"`, or `"error"`

#### Scenario: Validation error before stream returns 400

- **WHEN** nem `productImageDataUrl` nem `productImages` estão presentes
- **THEN** the response SHALL have status 400
- **AND** the body SHALL contain JSON with `code: "invalid_data"` and a PT-BR message ("Imagem do produto é obrigatória")
- **AND** no NDJSON stream SHALL be opened

#### Scenario: Payload ambíguo (ambos os campos) retorna 400 (D2)

- **WHEN** o body contém **ambos** `productImageDataUrl` e `productImages`
- **THEN** a resposta é HTTP 400 com mensagem de payload ambíguo (os dois campos são mutuamente exclusivos)
- **AND** no NDJSON stream SHALL be opened

#### Scenario: Teto agregado excedido retorna 413 (D10)

- **WHEN** a soma dos dataUrls do `productImages[]` excede o teto agregado
- **THEN** a resposta é HTTP 413 com mensagem PT-BR indicando o teto agregado
- **AND** no NDJSON stream SHALL be opened

#### Scenario: Item individual acima de 4MB retorna 413 (D10)

- **WHEN** um `dataUrl` de um item do `productImages[]` excede `MAX_PRODUCT_IMAGE_BASE64_SIZE`
- **THEN** a resposta é HTTP 413 com mensagem PT-BR indicando o item e o limite
- **AND** no NDJSON stream SHALL be opened

#### Scenario: Provider failure during stream delivers error event

- **WHEN** the image provider throws an error during generation (after stream started)
- **THEN** the stream SHALL deliver an error event with `code: "provider_error"` and `httpStatus: 502`
- **AND** the HTTP response status SHALL remain 200
- **AND** the raw provider error SHALL NOT appear in the event message

#### Scenario: Product name conflict returns 409 before stream

- **WHEN** pre-generation validation detects a conflict between the typed product name and the product image
- **AND** `inputValidationOverride.productImageCheck` is NOT set to `"user_confirmed_continue"`
- **THEN** the response SHALL have status 409
- **AND** the body SHALL contain `{ status: "needs_user_action", reason: "product_image_conflict" }`
- **AND** no NDJSON stream SHALL be opened

#### Scenario: Product name conflict after validation override streams generated_product_mismatch

- **WHEN** the user previously confirmed "continue anyway" via `inputValidationOverride`
- **AND** the quality review detects that the generated image displays the wrong product name
- **THEN** the stream SHALL deliver an error event with `code: "generated_product_mismatch"` and `requiresUserAction: false`
- **AND** the HTTP response status SHALL remain 200
        - **AND** the user SHALL be asked to correct the product name or image (cannot "continue anyway")

#### Scenario: Old identity fields in request return 400

- **WHEN** a POST request includes `storeName`, `storeLogoUrl`, or `brandProfile`
- **THEN** the endpoint SHALL return HTTP 400

#### Scenario: Override brief_review_confirmed pula a IA de visão (D5)

- **WHEN** o body carrega `inputValidationOverride.productImageCheck: "brief_review_confirmed"` (flag desligada)
- **THEN** a rota **pula** a validação IA produto×imagem no pré-stream
- **AND** nenhuma chamada vision / nenhum evento `campaign_input_validation` é emitido
- **AND** a geração prossegue para `createCampaign` → `reserveCredit` → stream

#### Scenario: Override user_confirmed_continue pula (comportamento atual preservado — D5)

- **WHEN** o body carrega `inputValidationOverride.productImageCheck: "user_confirmed_continue"`
- **THEN** a rota **pula** a validação IA produto×imagem no pré-stream (comportamento atual preservado)

#### Scenario: Sem override a validação IA roda (rede de segurança — D5)

- **WHEN** o body não carrega `inputValidationOverride` (cliente legado / fallback)
- **THEN** a validação IA produto×imagem roda no pré-stream (comportamento atual)
- **AND** conflitos retornam 409 com `needs_user_action`

#### Scenario: Flag force_brief_vision_check desligada → brief_review_confirmed pula nos dois pontos

- **WHEN** a flag administrativa `force_brief_vision_check` está desligada (default)
- **AND** o body carrega `brief_review_confirmed`
- **THEN** a rota pula o pré-stream (validação vision não roda)
- **AND** o Phase 1 do `ImageGenerationService` pula (override repassado em `campaignInput.inputValidationOverride`)
- **AND** a fase `input_validation` é emitida com **obrigatoriamente** `status: "skipped"` (detail opcional "Brief confirmado pelo usuário")

#### Scenario: Flag force_brief_vision_check ligada → rota normaliza e valida ponta a ponta

- **WHEN** a flag administrativa `force_brief_vision_check` está ligada
- **AND** o body carrega `brief_review_confirmed`
- **THEN** a rota **normaliza** um `effectiveParsedData`/`effectiveCampaignInput` (remove `brief_review_confirmed` do `inputValidationOverride`) **antes** da checagem pré-stream
- **AND** usa o **mesmo input normalizado** para a checagem pré-stream, construir o brief e chamar `imageService.generateImage(...)`
- **AND** o pré-stream da rota E o Phase 1 do serviço executam a validação IA (ponta a ponta)
- **AND** `user_confirmed_continue` **nunca é removido** (caminho "409 + insistiu" sempre pula)

### Requirement: ImageGenerationService emits metrics per run

The system SHALL emit structured metrics for every image generation execution. The `ImageGenerationService.generateImage()` method SHALL accept an optional `onMetricsEvent` callback in addition to the existing `onPhaseChange` callback.

> Modified by `fase-38-1-ai-cost-accounting` (D11).

The `onMetricsEvent` callback SHALL receive a `GenerationMetricsEvent` containing:
- `runId` — unique identifier for the execution
- `phase` — current phase identifier
- `provider` — provider name
- `model` — model identifier
- `elapsedMs` — elapsed time since generation start
- `attempt` — **real attempt number** (1..n from `generateWithRetry`)
- `estimatedCostUsd` — approximate cost (when available)
- `usage` — usage tokens (new, D11)
- `durationMs` — individual call duration (new, D11)

The `onMetricsEvent` callback SHALL NOT be exposed to the UI. It SHALL be consumed only by the metrics recording system.

> **Delta F38.1 (D11):** O `onMetricsEvent` existente é **ampliado** para expor `usage`/custo por tentativa do `generateWithRetry` e o `attempt_number` real. O pipeline (via `AiCostTracker`) registra `campaign_image` e `campaign_image_review` com esses dados — sanando os furos 4 (revisão sumia da contabilidade) e 6 (`attempt_number` sempre 1). `duration_ms` passa a ser por chamada (furo 7).

#### Scenario: Metrics event emitted during generation

- **WHEN** `ImageGenerationService.generateImage()` runs
- **AND** `onMetricsEvent` callback is provided
- **THEN** the service SHALL emit metrics events through the callback
- **AND** the events SHALL include `runId`, `phase`, `provider`, `model`, and `elapsedMs`
- **AND** the events SHALL NOT include prompts, payloads, API keys, or generated images

#### Scenario: usage e attempt_number expostos por tentativa

- **WHEN** a revisão reprova na tentativa 1 e passa na 2
- **THEN** o `onMetricsEvent` emite `attempt: 1` e `attempt: 2` com `usage` de cada chamada (furo 6 sanado)
- **AND** o pipeline registra `campaign_image_review` com `attempt_number` 1..n (furo 4 sanado)

#### Scenario: duration_ms por chamada no evento de metrics

- **WHEN** o `onMetricsEvent` é emitido para image/review
- **THEN** `durationMs` reflete a duração daquela chamada individual (furo 7 sanado)

### Requirement: Image provider selectable via environment variable

The `POST /api/campaign/generate-image` route handler SHALL use `createImageProvider()` factory function instead of directly instantiating `OpenAIImageProvider`. The factory SHALL read the `IMAGE_PROVIDER` environment variable and return the appropriate `ImageProvider` implementation.

The existing `ImageProvider` interface SHALL remain unchanged.

#### Scenario: Route handler uses factory

- **WHEN** a request hits the generate-image endpoint
- **THEN** the route SHALL call `createImageProvider()` to obtain the configured provider
- **AND** SHALL NOT hardcode a specific provider class

### Requirement: Image model configurable via environment variable

The image generation model SHALL be configurable via `IMAGE_GENERATION_RESPONSES_MODEL` in `.env.local`. The existing default (`gpt-5.5`) SHALL be preserved.

The vision review model (`VISION_REVIEW_MODEL`) SHALL remain separately configurable via its existing env var. No provider abstraction is required for the vision model at this stage.

#### Scenario: Image model changed via env var

- **WHEN** `IMAGE_GENERATION_RESPONSES_MODEL=gpt-5.5-preview`
- **THEN** the image generation SHALL use the specified model
- **AND** the vision review SHALL continue using `VISION_REVIEW_MODEL`

### Requirement: Client consumes NDJSON stream with line buffering

The client-side consumer (in `useCampaignForm` or equivalent) SHALL read the NDJSON stream using the Fetch API's `response.body.getReader()`. The consumer SHALL implement a line buffer to handle chunk boundaries:

1. Accumulate incoming chunk bytes
2. Split the accumulated buffer by `\n`
3. Process complete lines as JSON events
4. Keep any partial trailing line in the buffer for the next chunk

Each event SHALL be type-dispatched:
- `type: "phase"` → update `GenerationProgress` state
- `type: "result"` → extract `imageDataUrl` and `storeIdentity`, build `PreviewPayload`, navigate to preview
- `type: "error"` → set error state, display message, stop generation

The POST body SHALL include `storeId` + campaign/product fields — no identity fields. All identity data is resolved server-side.

#### Scenario: Client processes phase events in real-time

- **WHEN** a `type: "phase"` event is received from the stream
- **THEN** the client SHALL update the `GenerationProgress` component state
- **AND** the UI SHALL reflect the new phase status immediately

#### Scenario: Client handles result event with storeIdentity

- **WHEN** a `type: "result"` event is received with `success: true`, `imageDataUrl`, and `storeIdentity`
- **THEN** the client SHALL build the `PreviewPayload` using the returned `storeIdentity`
- **AND** SHALL navigate to `/campaign/preview`

#### Scenario: Client handles error event

- **WHEN** a `type: "error"` event is received
- **THEN** the client SHALL stop the generation flow
- **AND** SHALL display the `message` field from the event
- **AND** if `requiresUserAction` is `true`, SHALL show the appropriate user prompt (e.g., confirm product name)

#### Scenario: Client POST body uses storeId

- **WHEN** the consumer builds the request body
- **THEN** the body SHALL contain `storeId`
- **AND** SHALL NOT contain `storeName`, `storeSegment`, `storeTone`, `brandColor`, `storeLogoUrl`, or `brandProfile`

### Requirement: originalPrice is optional

The `originalPrice` field in the campaign input schema SHALL be `string | undefined`. When absent, the rendered campaign SHALL NOT display a "De: R$ X" line. The badge and discounted price SHALL still render normally.

#### Scenario: Campaign renders without original price

- **WHEN** a campaign is generated without `originalPrice`
- **THEN** the rendered image SHALL show the discounted price and badge
- **AND** SHALL NOT show a strikethrough original price or "De:" prefix

#### Scenario: Campaign renders with original price

- **WHEN** a campaign is generated with `originalPrice`
- **THEN** the rendered image SHALL show both the original (strikethrough) and discounted price

### Requirement: buildPromptVariables includes creative direction context and intent variables

> Modified by `fase-31-2-diretores-por-intencao`. Modified by `fase-39-brief-estruturado-campanha` (D11): a fonte dos dados passa a ser o domínio estruturado — as variáveis e regras **não mudam**.

The `ImageGenerationService.buildPromptVariables()` method SHALL accept the structured `CampaignBrief` (domínio) and return the following new variables:

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

`buildPromptVariables()` SHALL NOT interpolate `identityImageUrl` into the prompt text — the identity image reference is passed directly to the `ImageProvider`. The key MAY remain in the returned record (golden baseline of 38 keys preserved for regression), but the prompt templates MUST NOT reference `{{identityImageUrl}}`.

#### Scenario: identityDirective present in buildPromptVariables output

- **WHEN** `buildPromptVariables()` is called with a structured `CampaignBrief` + `ResolvedCampaignContext`
- **THEN** the returned record SHALL include `identityDirective` with the directive string
- **AND** `identityImageUrl` MAY be present in the record but SHALL NOT be interpolated into the visual template (provider-only reference)

#### Scenario: New variables present alongside existing ones

- **WHEN** `buildPromptVariables()` is called
- **THEN** the returned record SHALL include all existing variables
- **AND** SHALL include `identityDirective`

#### Scenario: buildPromptVariables inclui commercialFrame

> Added by `fase-31-2-diretores-por-intencao`.

- **WHEN** `buildPromptVariables()` é chamado com brief de `campaignIntent: "spotlight"`
- **THEN** as variáveis incluem `commercialFrame` com texto de destaque

### Requirement: buildCommercialRepertoire adaptado por intent

> Modified by `fase-31-2-diretores-por-intencao`. Modified by `fase-39-brief-estruturado-campanha` (D8/D11): a decisão de validade passa a ser **semântica** (`validity.enabled` + `displayText`), eliminando a heurística de string (`/`, `até`, `válida`).

The system SHALL implement `ImageGenerationService.buildCommercialRepertoire(brief: CampaignBrief): string` that analyzes the following domains for commercially actionable content, filtrado por intent:

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

> Added by `fase-31-2-diretores-por-intencao`.

- **WHEN** `buildCommercialRepertoire()` é chamado com `campaignIntent: "spotlight"` e `availabilityNotes: "poucas unidades"`
- **THEN** o retorno NÃO contém a nota de escassez

#### Scenario: validade entra no repertório por enabled/displayText

- **WHEN** `brief.commercial.validity = { enabled: true, displayText: "válida até 30/09" }` com intent `offer`
- **THEN** o retorno contém o texto da validade (sem depender de heurística de string — D8)

#### Scenario: validade desabilitada não entra no repertório

- **WHEN** `brief.commercial.validity` está ausente ou `enabled === false`
- **THEN** o retorno NÃO contém texto de validade

### Requirement: buildValidationSummary generates sanitized summary

The system SHALL implement `ImageGenerationService.buildValidationSummary(body: GenerateImageRequest, effectiveProductName: string): string` that generates a sanitized summary of the input validation phase.

The summary SHALL include:
- Whether the product name was corrected (original → corrected, with reason)
- Whether the user confirmed an override for product-image conflict

The summary SHALL be in PT-BR and SHALL NOT expose raw model output, API keys, or internal error details.

#### Scenario: Validation summary includes correction info

- **WHEN** the product name was corrected from `"neskau"` to `"Nescau"` with reason `"O texto na imagem é 'Nescau'"`
- **THEN** the summary SHALL include `"Nome corrigido automaticamente de 'neskau' para 'Nescau'"`

### Requirement: assemblePrompt selects template by campaignIntent

> Modified by `fase-31-2-diretores-por-intencao`.

The `ImageGenerationService.assemblePrompt()` method SHALL load the `campaign-image-director-${campaignIntent}` prompt (e.g., `campaign-image-director-offer`, `campaign-image-director-spotlight`, `campaign-image-director-exclusive`) and interpolate all existing plus new creative direction variables.

Sem fallback silencioso: se o prompt não existir para intent válida, o sistema SHALL falhar no preflight como `invalid_prompt`. O arquivo `campaign-image-director.md` original não é fallback.

The evolved prompt SHALL include the new sections for creative persona, category context, commercial repertoire, and validation summary.

#### Scenario: Evolved prompt includes creative direction

- **WHEN** `assemblePrompt()` is called with variables that include creative direction context
- **THEN** the returned prompt string SHALL contain the interpolated creative direction sections

#### Scenario: assemblePrompt carrega template por intent

> Added by `fase-31-2-diretores-por-intencao`.

- **WHEN** `assemblePrompt()` é chamado com `campaignIntent: "exclusive"`
- **THEN** carrega `campaign-image-director-exclusive.md`

### Requirement: Pipeline emits sanitized technical detail events

The `ImageGenerationService` SHALL emit `detail` (sanitized technical info) in `GenerationPhaseEvent` at the following points:

| Phase | When | Detail content |
|-------|------|----------------|
| `input_validation` | After validation completes | `"classificação: {classification}, nome corrigido: '{from}' → '{to}'"` (if applicable) |
| `prompt_assembly` | After prompt assembly | `"briefing com persona de {segment}, categoria inferida: {category}"` |
| `image_generation` | At start of each attempt | `"tentativa {n}/{max}, modelo: {model}, tempo decorrido: {t}s"` |
| `quality_review` | After review completes | `"issues: {n} ({critical} críticas, {minor} menores), failureType: {type}"` |
| `done` | On completion | `"geração concluída em {t}s, {attempts} tentativas, {corrections} correções"` |

The pipeline SHALL emit `detail` strings that are safe-by-construction — containing only summarized technical metadata (phase name, classification, attempt count, model name, elapsed time). `GenerationProgress` SHALL continue applying `sanitizeDetail()` before display as a defense-in-depth measure.

#### Scenario: detail emitted for prompt_assembly phase

- **WHEN** the prompt assembly phase completes
- **THEN** the phase event SHALL include `detail` with the segment persona and inferred category
- **AND** the `detail` SHALL NOT contain raw model output or API keys

#### Scenario: detail emitted for each generation attempt

- **WHEN** a retry attempt begins during `image_generation`
- **THEN** the phase event SHALL include `detail` with the attempt number, model name, and elapsed time
- **AND** the `detail` SHALL NOT include estimated budget remaining unless the pipeline has reliable timeout tracking

### Requirement: validationContext passed to ImageReviewService

The `ImageGenerationService` SHALL construct a `ValidationContext` from the input validation results and pass it to `ImageReviewService` via the extended `ImageReviewInput`.

The `ValidationContext` SHALL include:
- `inputCorrection` — when the product name was corrected by validation
- `allowedConflicts` — when the user approved specific conflicts
- `overrides` — when the user confirmed "continue anyway"

#### Scenario: Validation context flows to review

- **WHEN** input validation corrected the product name
- **THEN** `validationContext.inputCorrection` SHALL be populated
- **AND** `ImageReviewInput.validationContext` SHALL contain the context
- **AND** the review SHALL use `effectiveProductName` as reference

### Requirement: applyValidationContextToReviewResult called after review

The `ImageGenerationService.generateImage()` method SHALL call `applyValidationContextToReviewResult()` immediately after `await this.imageReview.review(...)` returns, before evaluating `reviewResult.passed` and deciding the next state machine transition.

```typescript
reviewResult = await this.imageReview.review(imageDataUrl, reviewInput);
reviewResult = applyValidationContextToReviewResult(reviewResult, validationContext);
```

#### Scenario: Alignment applied before state machine decision

- **WHEN** the review completes with issues that include user-approved conflicts
- **THEN** `applyValidationContextToReviewResult()` SHALL remove only the approved conflict issues
- **AND** the state machine SHALL evaluate the filtered result

### Requirement: buildCreativeContextGuidance adaptado por intent

> Modified by `fase-31-2-diretores-por-intencao`.

O sistema SHALL modificar `buildCreativeContextGuidance()` para usar framing adequado:

- **offer**: manter "Preço é oportunidade/vantagem" (comportamento atual)
- **spotlight**: substituir "Preço é..." por "Benefício é..." ou "Diferencial é..."
- **exclusive**: substituir framing de preço por framing de valor percebido

#### Scenario: buildCreativeContextGuidance para spotlight evita framing de preço

- **WHEN** `buildCreativeContextGuidance()` é chamado com segmento e categoria para spotlight
- **THEN** o texto NÃO contém "Preço é"
- **AND** contém framing de benefício ou descoberta

### Requirement: Validação backend de offer sem preço

> Added by `fase-31-2-diretores-por-intencao`.

O sistema SHALL validar no endpoint, após parse e auth/ownership/legal e antes de montar `campaignInput`, que `campaignIntent === "offer"` requer `discountedPriceCents` presente e positivo. Se ausente ou zero, retornar HTTP 400 com mensagem "Preço com desconto é obrigatório para ofertas".

#### Scenario: offer sem discountedPriceCents retorna 400

- **WHEN** POST para `/api/campaign/generate-image` com `campaignIntent: "offer"` e sem `discountedPriceCents`
- **THEN** retorna HTTP 400 com mensagem "Preço com desconto é obrigatório para ofertas"
- **AND** sem stream

### Requirement: validatePrompts valida director por intent

> Added by `fase-31-2-diretores-por-intencao`.

O sistema SHALL validar o template `campaign-image-director-${campaignIntent}` em `validatePrompts()`. Se o prompt não existir, retorna `{ valid: false, errors: [...] }`.

O `discountedPrice` passado ao revisor (`campaign-image-reviewer`) SHALL ser vazio quando `campaignIntent === "exclusive"`.

#### Scenario: validatePrompts valida exclusive director

- **WHEN** `validatePrompts()` é chamado para intent `"exclusive"`
- **THEN** valida `campaign-image-director-exclusive.md`
- **AND** valida `campaign-image-reviewer.md` com `discountedPrice` vazio

### Requirement: POST /api/campaign/generate-image sem guard de intent

> Added by `fase-31-2-diretores-por-intencao`.

O endpoint SHALL NÃO bloquear requisições com `campaignIntent !== "offer"`. O guard HTTP 400 adicionado na F31.1 SHALL ser removido. A validação de offer sem preço é mantida (HTTP 400).

#### Scenario: Spotlight passa pelo endpoint

- **WHEN** POST para `/api/campaign/generate-image` com `campaignIntent: "spotlight"`
- **THEN** o endpoint NÃO retorna HTTP 400
- **AND** o fluxo prossegue normalmente

### Requirement: Fallback determinístico buildDeterministicCopy

> Added by `fase-31-2-diretores-por-intencao`.

O sistema SHALL implementar `buildDeterministicCopy(campaignIntent, params)` para o fallback do Copy Director quando desligado:

- offer: `"{{productName}} — {{badgeText}}: de R$ X por R$ Y"`
- spotlight: `"{{productName}} — Novo na {{storeName}}!"` (com preço se disponível)
- exclusive: `"{{productName}} — Exclusivo na {{storeName}}!"` (sem preço, sem badge promocional)

#### Scenario: Fallback para exclusive não menciona preço

- **WHEN** `buildDeterministicCopy("exclusive", { productName: "Produto X", storeName: "Loja Y" })` é chamado
- **THEN** retorna texto sem preço ou badge promocional

### Requirement: Preservação comportamental — nenhuma variável criativa alterada

`buildPromptVariables()` SHALL preserve all existing variables and their rules. The following SHALL remain unchanged:
- `creativePersona`, `inferredCategory`, `hasCategoryConflict`, `categoryConflictDirective`
- `commercialRepertoire`, `inputValidationSummary`, `creativeContextGuidance`
- `campaignDetails`, `additionalDetails`, `hook`, `cta`, `objective`
- `targetChannel`, `format`, `validity`, `availabilityNotes`, `sensitiveConstraints`

> Modified by `fase-40-campos-comerciais-avisos-brief` (D6): o conjunto de variáveis/keys do prompt permanece **idêntico** para o mesmo input (golden `EXPECTED_KEYS = 38`). O **texto do prompt muda intencionalmente**: a instrução incondicional do aviso ilustrativo (herança UAT-3) é substituída pelo **bloco condicional de composição**. Não há novas variáveis; apenas a instrução textual é reframada. O comportamento visual default é preservado (checkbox marcado).
> Modified by `fase-41-midia-de-campanha-mobile` (D6): as imagens entram como **input multimodal** — o prompt ganha um **bloco descritivo** (1 imagem principal + N auxiliares de referência) **sem nova variável** (`EXPECTED_KEYS = 38` por intent permanece). As referências (primary como herói visual, auxiliares como contexto) são descritas no texto; o conteúdo das imagens é fornecido ao provider, não ao template textual.

No new creative rules, composition directives, or mandatory requirements SHALL be added to the prompt. Subsegment, positioning, shortDescription, and slogan SHALL NOT be injected into prompt variables in this phase. As mudanças **textuais** do prompt SHALL ser limitadas a: `{{identityDirective}}` substituindo a instrução fixa de logo (F5.0), o bloco condicional de composição do aviso ilustrativo (F40 D6) e o **bloco descritivo 1+N referências** (F41 D6) — **nenhuma delas introduz variável nova** (golden `EXPECTED_KEYS = 38` preservado por intent). `identityImageUrl` continua **provider-only** (referência passada ao provider, nunca interpolada no template visual como instrução textual).

#### Scenario: Regression parity — conjunto de variáveis idêntico

- **WHEN** o mesmo payload flat de hoje é processado com os novos campos preenchidos (checkbox marcado default + validade preenchida)
- **THEN** o conjunto de variáveis/keys do prompt final é **idêntico** ao baseline (golden `EXPECTED_KEYS = 38`)
- **AND** o texto do prompt muda apenas na instrução do aviso ilustrativo (bloco condicional substitui a instrução incondicional — D6)

#### Scenario: Regression parity — comportamento visual default preservado

- **WHEN** o checkbox está marcado (default) e `mandatoryArtworkText = ILLUSTRATIVE_NOTICE_TEXT`
- **THEN** o prompt instrui a exibição do aviso com a mesma inteligência visual do UAT-3 (tipografia mínima, visível/legível, posição lateral)
- **AND** o comportamento visual resultante é o mesmo de hoje (aviso presente na arte)

#### Scenario: Regression parity for logo store

- **WHEN** the same store (`identity_state = 'logo'`) and campaign input are processed before and after this change
- **THEN** the generated prompt SHALL be equivalent in all fields, rules, and creative context
- **AND** the only differences SHALL be: `{{identityDirective}}` replaces the fixed logo instruction, and the `logoVariantUrl` line SHALL be removed from the `brandProfileSection`

#### Scenario: Regression parity for text_only store

- **WHEN** the same store (`identity_state = 'text_only'`) and campaign input are processed before and after this change
- **THEN** the generated prompt SHALL be equivalent in all fields, rules, and creative context
- **AND** the only difference SHALL be `{{identityDirective}}` replacing the fixed logo instruction
- **AND** no identity image URL SHALL be sent to the provider

#### Scenario: Regression parity for VS store

- **WHEN** the same store (`identity_state = 'visual_signature'`) and campaign input are processed before and after this change
- **THEN** the generated prompt SHALL be equivalent in all fields, rules, and creative context
- **AND** the only differences SHALL be: `{{identityDirective}}` replaces the fixed logo instruction, and the VS URL SHALL be sent as the identity image reference (was not sent before)

### Requirement: Guarda de readiness no handler generate-image (ADDED F34)

> Added by `fase-34-store-readiness`.

O sistema SHALL adicionar uma guarda de readiness no início do handler `POST /api/campaign/generate-image/route.ts`, após a validação de ownership/autenticação e antes do rate limit e saldo check.

Se `getStoreReadiness(storeId)` retornar `ready: false`, o handler SHALL retornar HTTP 412 com `{ error: { message, reasons, missing } }`.

#### Scenario: Store sem cadastro fiscal — API retorna 412

- **WHEN** requisição POST chega ao handler
- **AND** `getStoreReadiness(storeId)` retorna `missing: ["cadastro_fiscal"]`
- **THEN** retorna HTTP 412 com `error.missing` contendo `["cadastro_fiscal"]`
- **AND** a geração NÃO é executada

#### Scenario: Store sem brand profile — API retorna 412

- **WHEN** `getStoreReadiness(storeId)` retorna `missing: ["brand_profile"]`
- **THEN** retorna HTTP 412 com `error.missing` contendo `["brand_profile"]`

#### Scenario: Store pronta — pipeline prossegue

- **WHEN** `getStoreReadiness(storeId)` retorna `ready: true`
- **THEN** o pipeline de geração prossegue normalmente

#### Scenario: Readiness verificada antes de rate limit

- **WHEN** requisição chega ao handler
- **THEN** readiness check é executado antes de rate limit e saldo check

### Requirement: Prompt reframe — bloco condicional de composição (D6)

> Added by `fase-40-campos-comerciais-avisos-brief` (D6).

Os 4 prompts do diretor SHALL **NÃO** conter a instrução incondicional "SEMPRE acrescente a arte o seguinte texto ... : 'Imagem meramente ilustrativa'" (herança UAT-3).

No lugar da instrução incondicional, os 4 prompts SHALL conter o **bloco condicional de composição**:

```
Quando houver texto obrigatório/aviso legal informado, exiba exatamente esse texto na arte.
Se o aviso for "Imagem meramente ilustrativa", posicione-o com tipografia mínima, mas visível e legível, em área lateral horizontal ou vertical, sem competir com oferta, produto e preço.
```

A linha condicional do texto obrigatório já existente ("Se o campo 'Texto obrigatório na arte' estiver preenchido ({{mandatoryArtworkText}})... Não o repita na legenda.") SHALL ser mantida em todos os 4 prompts.

#### Scenario: Prompts sem instrução incondicional do aviso

- **WHEN** `campaign-image-director.md`, `campaign-image-director-offer.md`, `campaign-image-director-spotlight.md` e `campaign-image-director-exclusive.md` são inspecionados
- **THEN** NENHUM deles contém "SEMPRE acrescente a arte o seguinte texto" referente ao aviso ilustrativo

#### Scenario: Prompts com bloco condicional de composição

- **WHEN** os 4 prompts do diretor são inspecionados
- **THEN** cada um contém o bloco condicional de composição (texto obrigatório informado → exibir exatamente; tipografia mínima/visível/legível; posição lateral; sem competir com oferta/produto/preço)

#### Scenario: Linha condicional do texto obrigatório mantida

- **WHEN** os 4 prompts do diretor são inspecionados
- **THEN** a linha "Se o campo 'Texto obrigatório na arte' estiver preenchido ({{mandatoryArtworkText}})... Não o repita na legenda." é mantida

### Requirement: legalNotice desabilitado SHALL resultar em prompt e revisor sem texto obrigatório

> Added by `fase-40-campos-comerciais-avisos-brief`.

O sistema SHALL garantir que, quando `legalNotice.enabled === false` (checkbox desmarcado + sem texto livre → `mandatoryArtworkText` ausente):

- o prompt do diretor receba `mandatoryArtworkText` vazio;
- o revisor receba `mandatoryArtworkTextSection` vazio (nenhum texto obrigatório a verificar).

Quando `validity.enabled === true` + `displayText` (offer), o sistema SHALL montar `validityTextSection` no revisor com o `displayText`; quando ausente → `validityTextSection` vazio.

#### Scenario: legalNotice desabilitado gera prompt e revisor vazios

- **WHEN** o checkbox está desmarcado e não há texto livre (`mandatoryArtworkText` ausente → `legalNotice.enabled=false`)
- **THEN** o prompt do diretor recebe `mandatoryArtworkText` vazio
- **AND** `mandatoryArtworkTextSection` do revisor é vazio (nada a verificar)

#### Scenario: Validade habilitada monta seção no revisor

- **WHEN** `validity.enabled === true` com `displayText = "até 30/09"` e intent `offer`
- **THEN** o revisor monta `validityTextSection` contendo "até 30/09"
- **AND** sem validade → `validityTextSection` é vazio

### Requirement: Prompt com bloco descritivo de 1+N referências (D6)

Os 4 prompts do diretor (`campaign-image-director.md`, `-offer.md`, `-spotlight.md`, `-exclusive.md`) SHALL conter um **bloco descritivo** — hardcoded, **sem placeholder/variável** — descrevendo a presença de **1 imagem principal + N imagens auxiliares de referência**:

- A imagem principal SHALL ser usada como **herói visual** da peça;
- As imagens auxiliares SHALL ser usadas como **contexto** (ângulos/variações/combos/referências);
- O diretor SHALL **NÃO inventar conteúdo** dos produtos que não esteja nas imagens.

**Sem nova variável de prompt** → o golden `EXPECTED_KEYS = 38` (por intent) **permanece idêntico** (D6). O texto do prompt muda intencionalmente; as imagens entram como **input multimodal**, não como variável textual.

#### Scenario: Bloco descritivo 1+N presente nos 4 prompts

- **WHEN** `campaign-image-director.md`, `-offer.md`, `-spotlight.md` e `-exclusive.md` são inspecionados
- **THEN** cada um contém o bloco descrevendo 1 imagem principal (herói visual) + N auxiliares (contexto, sem inventar conteúdo)

#### Scenario: Sem nova variável no bloco (golden 38 keys)

- **WHEN** o golden test por intent roda com multi-imagem
- **THEN** o conjunto de variáveis/keys do prompt é o **mesmo** do baseline (`EXPECTED_KEYS = 38`)
- **AND** o texto do prompt muda apenas no bloco descritivo (D6)

### Requirement: Fallback images.edit gated por primary única (D7)

O sistema SHALL **NÃO** usar o fallback `images.edit` (Image API) quando houver **imagens auxiliares** (`productImagesDataUrls` com 2+ itens) — o `images.edit` aceita apenas **1 base image** (limitação documentada em `openai.ts:282-287`).

- **Só com a primary única** (1 imagem, legado ou `productImages` de 1 elemento): fallback `images.edit` permanece como hoje.
- **Com auxiliares** (2+ imagens): retries permanecem no **Responses path**; se o Responses estiver indisponível → **erro explícito** (sem degradar a fidelidade descartando imagens).
- A regra vira **política de negócio**: com auxiliares, o fallback não mente sobre o que consegue fazer.

#### Scenario: Edit NÃO é usado com auxiliares

- **WHEN** `productImagesDataUrls` tem 2+ itens e o mainline Responses falha com erro retryable
- **THEN** o retry permanece no Responses path
- **AND** o fallback `images.edit` NÃO é invocado

#### Scenario: Edit usado apenas com primary única

- **WHEN** `productImagesDataUrls` tem 1 item (ou só `productImageDataUrl` legado) e o Responses falha com erro retryable
- **THEN** o fallback `images.edit` é permitido (comportamento atual preservado)

#### Scenario: Erro explícito com auxiliares e Responses indisponível

- **WHEN** há auxiliares e o Responses path esgota os retries
- **THEN** o sistema emite **erro explícito** (terminal) — não degrada a fidelidade descartando imagens

### Requirement: Review recebe a primary como referência (D9)

O sistema SHALL passar, **opcionalmente**, a **dataUrl da imagem principal** ao `ImageReviewService.review(generatedImage, input)` — enviada junto ao prompt `campaign-image-reviewer` (bloco de imagem + texto). O revisor SHALL verificar a **fidelidade do produto na arte gerada** (o produto da referência é o produto da peça).

- **Sem nova variável de prompt do revisor** — a imagem entra como input multimodal; o texto do prompt pode ganhar uma linha fixa "Compare o produto da arte com a imagem de referência".
- **Retrocompatível:** sem `productImagesDataUrls`/sem primary → o revisor se comporta como hoje (nenhuma mudança para o caminho legado).

#### Scenario: Revisor recebe a primary como referência

- **WHEN** o brief tem uma imagem primary (dataUrl)
- **THEN** o `ImageReviewService.review` recebe a dataUrl da primary
- **AND** o prompt `campaign-image-reviewer` recebe o bloco de imagem + a linha "Compare o produto da arte com a imagem de referência"

#### Scenario: Sem primary o revisor se comporta como hoje

- **WHEN** não há imagem primary disponível (caminho legado sem referência)
- **THEN** o revisor não recebe imagem de referência
- **AND** o comportamento é idêntico ao atual (retrocompatível — D9)
