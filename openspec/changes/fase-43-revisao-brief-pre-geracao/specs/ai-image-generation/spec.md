# AI Image Generation

## Purpose

Delta F43 (D5): o `GenerateImageRequestSchema.inputValidationOverride.productImageCheck` ganha o novo literal `"brief_review_confirmed"` (revisão humana do brief, semântica distinta de `user_confirmed_continue`); a rota pré-stream continua pulando a validação IA produto×imagem para qualquer override truthy, e passa a **normalizar o input** (remover `brief_review_confirmed`) quando a flag administrativa `force_brief_vision_check` está **ligada** — validando ponta a ponta (pré-stream + Phase 1 do serviço). `user_confirmed_continue` nunca é removido. Capacidade `InputValidationService` preservada.

## MODIFIED Requirements

### Requirement: GenerateImageRequestSchema with campaignIntent e preserveImageContext

O sistema SHALL modificar o schema `GenerateImageRequestSchema` para aceitar o novo literal `brief_review_confirmed` no override produto×imagem, mantendo todos os demais campos aditivos existentes e o `.strict()` para rejeitar campos não reconhecidos.

> Modified by `fase-31-2-diretores-por-intencao`. Modified by `fase-41-midia-de-campanha-mobile` (D2/D10): campo aditivo `productImages[]` + `MAX_CAMPAIGN_IMAGES`; `productImageDataUrl` deixa de ser required no Zod (preservação **comportamental** — a obrigatoriedade passa a ser garantida pela regra de exclusividade validada na rota). Modified by `fase-43-revisao-brief-pre-geracao` (D5): `inputValidationOverride.productImageCheck` ganha o literal `"brief_review_confirmed"` (revisão humana explícita do brief) — `.strict()` preservado.

O schema `GenerateImageRequestSchema` em `src/lib/image-generation/schema.ts` SHALL aceitar:

- `campaignIntent` — `z.enum(["offer", "spotlight", "exclusive"]).optional().default("offer")` — ADICIONADO
- `preserveImageContext` — `z.boolean().optional()` — ADICIONADO
- `discountedPriceCents` — `z.number().int().positive().optional()` — MODIFICADO (era required, passou a optional para tolerância por intent)
- `productImages` — `z.array(ProductImageInputSchema).min(1).max(MAX_CAMPAIGN_IMAGES).superRefine(...)` — ADICIONADO (D2), opcional; o item `{ role, source, mimeType, dataUrl }` **NÃO carrega `id`** (a rota gera/normaliza — D5)
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

O `superRefine` do `productImages[]` SHALL validar que existe **exatamente 1 imagem `role: "primary"`** no array (invariante do domínio agora no transporte — D2).

O schema SHALL usar `.strict()` para rejeitar campos não reconhecidos (preservado — o campo novo é aditivo).

**Matriz de semântica do override (documentada no schema e nos testes):**

| Valor | Origem | Comportamento |
|-------|--------|---------------|
| `brief_review_confirmed` | Usuário revisou o brief completo (produto + imagens + preço + validade + avisos) e confirmou | Pula a IA de visão (caminho padrão da F43); fase `input_validation` emitida com **obrigatoriamente** `status: "skipped"` (detail opcional "Brief confirmado pelo usuário") |
| `user_confirmed_continue` | Usuário recebeu 409 de conflito e **insistiu mesmo assim** | Pula a IA de visão (comportamento atual, "continuar mesmo assim"); fase `input_validation` emitida com **obrigatoriamente** `status: "skipped"` (detail opcional "Validação dispensada") |
| (sem override) | Cliente legado / fallback | Validação IA produto×imagem roda como rede de segurança (comportamento atual); fase `input_validation` normal |

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

O sistema SHALL expor um endpoint POST em `/api/campaign/generate-image` que respeita o override `inputValidationOverride` para pular a validação IA produto×imagem e, quando a flag administrativa `force_brief_vision_check` estiver ligada, normaliza o input removendo `brief_review_confirmed` antes da checagem pré-stream.

> Delta F43 (D5): a regra pré-stream atual (`if (!parsed.data.inputValidationOverride?.productImageCheck)`, `route.ts:338`) já pula a validação IA para **qualquer** override truthy — o novo literal `brief_review_confirmed` é coberto sem mudança de lógica. Com a flag administrativa `force_brief_vision_check` **ligada**, a rota **normaliza um `effectiveParsedData`/`effectiveCampaignInput`** (remove `brief_review_confirmed` do `inputValidationOverride`) **antes** da checagem pré-stream e **usa o mesmo input normalizado** para a checagem, construir o brief e chamar `imageService.generateImage(...)` — pré-stream e Phase 1 do serviço validam. `user_confirmed_continue` **nunca é removido**.

O endpoint SHALL:
1. Aceitar POST requests com `Content-Type: application/json`
2. Exigir `storeId` (UUID) e **uma imagem de produto** — via `productImageDataUrl` OU `productImages[]` (regra de exclusividade/compatibilidade D2) — retornar 400 (no stream) se ambos ausentes
3. Aceitar todos os campos existentes de campanha/produto (`productName`, `originalPriceCents`, `discountedPriceCents`, `badgeText`, `description`, `hook`, `cta`, `objective`, `campaignDetails`, `additionalDetails`, `targetChannel`, `format`, `validity`, `availabilityNotes`, `sensitiveConstraints`, `campaignIntent`, `preserveImageContext`) e `inputValidationOverride`
4. **NÃO aceitar** `storeName`, `storeSegment`, `storeTone`, `brandColor`, `storeLogoUrl` ou `brandProfile` — se presente, retornar 400
5. Chamar `resolveStoreIdentity(storeId)` → `validateIdentityReference()` → `buildCampaignBrief()` → `ImageGenerationService.generateImage(CampaignBrief)`
6. Rodar a validação pré-geração (nome do produto vs imagem), **a menos que override** em `inputValidationOverride` (`brief_review_confirmed` OU `user_confirmed_continue`) — F43 D5
7. Retornar uma resposta streaming NDJSON (`Content-Type: application/x-ndjson`) com status 200 após a validação passar
8. Transmitir eventos de fase como linhas JSON delimitadas por nova linha durante a geração
9. Encerrar o stream com um evento `type: "result"` no sucesso ou `type: "error"` na falha terminal
10. Retornar 400 (no stream) nos casos de imagem: (a) **ambos** `productImageDataUrl` e `productImages` ausentes → "Imagem do produto é obrigatória"; (b) **ambos presentes** → payload ambíguo (regra canônica — mutuamente exclusivos, D2)
11. Retornar 413 (no stream) quando qualquer `dataUrl` do `productImages[]` exceder o limite por item (`MAX_PRODUCT_IMAGE_BASE64_SIZE`) ou quando a **soma agregada** dos dataUrls exceder o teto agregado do array (D10). O limite legado single permanece para `productImageDataUrl`.

Erros detectados antes de iniciar o streaming SHALL usar códigos HTTP padrão. Uma vez iniciado o stream, o status HTTP SHALL permanecer 200 e todos os erros terminais SHALL ser entregues como eventos NDJSON.

O endpoint SHALL NÃO modificar, substituir ou deprecar o endpoint existente `POST /api/campaign/generate`.

O evento `type: "result"` SHALL incluir o snapshot `storeIdentity` usado durante a geração.

#### Scenario: Requisição válida retorna streaming NDJSON

- **WHEN** POST para `/api/campaign/generate-image` com `storeId` e dados de campanha válidos
- **THEN** a resposta SHALL ter status 200
- **AND** `Content-Type` SHALL ser `application/x-ndjson`
- **AND** o body SHALL conter eventos de fase NDJSON seguidos de um evento final `type: "result"`

#### Scenario: Override brief_review_confirmed pula a IA de visão (D5)

- **WHEN** o body carrega `inputValidationOverride.productImageCheck: "brief_review_confirmed"` (flag desligada)
- **THEN** a rota **pula** a validação IA produto×imagem no pré-stream (`route.ts:338`)
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
- **THEN** a rota **normaliza** um `effectiveParsedData`/`effectiveCampaignInput` (remove `brief_review_confirmed` do `inputValidationOverride`) **antes** da checagem pré-stream (`route.ts:338`)
- **AND** usa o **mesmo input normalizado** para a checagem pré-stream, construir o brief e chamar `imageService.generateImage(...)`
- **AND** o pré-stream da rota E o Phase 1 do serviço executam a validação IA (ponta a ponta)
- **AND** `user_confirmed_continue` **nunca é removido** (caminho "409 + insistiu" sempre pula)