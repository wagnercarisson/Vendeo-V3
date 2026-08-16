# AI Image Generation

> Delta spec for `fase-41-midia-de-campanha-mobile` (D2/D6/D7/D9/D10).

## MODIFIED Requirements

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

O schema `GenerateImageRequestSchema` em `src/lib/image-generation/schema.ts` SHALL ser modificado para aceitar:

> Modified by `fase-31-2-diretores-por-intencao`. Modified by `fase-41-midia-de-campanha-mobile` (D2/D10): campo aditivo `productImages[]` + `MAX_CAMPAIGN_IMAGES`; `productImageDataUrl` deixa de ser required no Zod (preservação **comportamental** — a obrigatoriedade passa a ser garantida pela regra de exclusividade validada na rota).

- `campaignIntent` — `z.enum(["offer", "spotlight", "exclusive"]).optional().default("offer")` — ADICIONADO
- `preserveImageContext` — `z.boolean().optional()` — ADICIONADO
- `discountedPriceCents` — `z.number().int().positive().optional()` — MODIFICADO (era required, passou a optional para tolerância por intent)
- `productImages` — `z.array(ProductImageInputSchema).min(1).max(MAX_CAMPAIGN_IMAGES).superRefine(...)` — **ADICIONADO (D2)**, opcional; o item `{ role, source, mimeType, dataUrl }` **NÃO carrega `id`** (a rota gera/normaliza — D5)
- `productImageDataUrl` — passa a **`optional()`** (antes `z.string().min(1)` required) — preservação **comportamental** do legado (D2)

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

### Requirement: POST /api/campaign/generate-image endpoint

The system SHALL expose a POST endpoint at `/api/campaign/generate-image`.

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

- **WHEN** pre-generation validation detects a conflict between the typed product name and the product image (primary)
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

- **WHEN** o mesmo payload flat de hoje é processado com os novos campos preenchidos (checkbox marcado default + validade preenchida + multi-imagem)
- **THEN** o conjunto de variáveis/keys do prompt final é **idêntico** ao baseline (golden `EXPECTED_KEYS = 38`)
- **AND** o texto do prompt muda apenas na instrução do aviso ilustrativo (bloco condicional — D6 F40) e no bloco descritivo 1+N referências (D6 F41)

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

## ADDED Requirements

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
