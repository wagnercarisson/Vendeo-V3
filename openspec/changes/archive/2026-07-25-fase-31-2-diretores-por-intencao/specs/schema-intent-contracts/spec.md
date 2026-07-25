# Schema Intent Contracts

> Added by `fase-31-2-diretores-por-intencao`.

## Purpose

Define os contratos de schema adaptados por intenção comercial: `discountedPriceCents` opcional, `CampaignSpecSchema` com campos nullable, `InputSnapshot` adaptado, e normalização de exclusive com preço indevido.

## ADDED Requirements

### Requirement: discountedPriceCents opcional no GenerateImageRequestSchema

O sistema SHALL tornar `discountedPriceCents` opcional em `GenerateImageRequestSchema` (`src/lib/image-generation/schema.ts`):

```typescript
discountedPriceCents: z.number().int().positive().optional()
```

A validação semântica é externalizada: offer exige preço no frontend e no backend, exclusive normaliza para ausente no backend.

#### Scenario: GenerateImageRequestSchema aceita spotlight sem discountedPriceCents

- **WHEN** o body inclui `campaignIntent: "spotlight"` sem `discountedPriceCents`
- **THEN** `GenerateImageRequestSchema.safeParse()` retorna `{ success: true, data }`

#### Scenario: GenerateImageRequestSchema aceita exclusive sem discountedPriceCents

- **WHEN** o body inclui `campaignIntent: "exclusive"` sem `discountedPriceCents`
- **THEN** `GenerateImageRequestSchema.safeParse()` retorna `{ success: true, data }`

### Requirement: discountedPriceCents opcional no CampaignGenerationInputSchema

O sistema SHALL tornar `discountedPriceCents` opcional em `CampaignGenerationInputSchema` (`src/lib/campaign-intelligence/schema.ts`):

```typescript
discountedPriceCents: z.number().int().positive().optional()
```

#### Scenario: CampaignGenerationInputSchema aceita exclusive sem preço

- **WHEN** o input omite `discountedPriceCents` com `campaignIntent: "exclusive"`
- **THEN** `CampaignGenerationInputSchema.safeParse()` retorna `{ success: true, data }`

### Requirement: InputSnapshot com discountedPriceCents opcional

O sistema SHALL tornar `discountedPriceCents` opcional em `InputSnapshot` (`src/lib/campaign/types.ts`):

```typescript
export interface InputSnapshot {
  // ...
  discountedPriceCents?: number;
  // ...
}
```

#### Scenario: InputSnapshot aceita exclusive sem discountedPriceCents

- **WHEN** `InputSnapshot` é populado para exclusive
- **THEN** `discountedPriceCents` está ausente ou é `undefined`

### Requirement: CampaignSpecSchema com campos nullable

O sistema SHALL modificar `CampaignSpecSchema` (`src/lib/campaign-intelligence/schema.ts`) para tornar `discounted_price_display` e `badge_text` nullable:

```typescript
offer: z.object({
  product_name: z.string().min(1),
  original_price_display: z.string().nullable(),
  discounted_price_display: z.string().nullable(),  // era min(1)
  badge_text: z.string().nullable(),                 // era min(1)
})
```

#### Scenario: CampaignSpecSchema aceita discounted_price_display null para exclusive

- **WHEN** o provedor retorna `discounted_price_display: null` para exclusive
- **THEN** `CampaignSpecSchema.safeParse()` retorna `{ success: true, data }`

#### Scenario: CampaignSpecSchema aceita badge_text null para spotlight

- **WHEN** o provedor retorna `badge_text: null` para spotlight sem badge
- **THEN** `CampaignSpecSchema.safeParse()` retorna `{ success: true, data }`

#### Scenario: CampaignSpecSchema mantém validação de campos obrigatórios

- **WHEN** o provedor retorna `product_name` vazio
- **THEN** `CampaignSpecSchema.safeParse()` retorna `{ success: false, error }`

### Requirement: Validação backend de offer sem discountedPriceCents

O sistema SHALL validar no backend, após auth/ownership/legal e antes de montar `campaignInput`, que `campaignIntent === "offer"` exige `discountedPriceCents` presente e positivo. Se ausente ou zero, o endpoint SHALL retornar HTTP 400 com mensagem controlada.

Esta validação protege o contrato de offer no backend, independente da validação do frontend.

#### Scenario: offer sem preço retorna 400 no backend

- **WHEN** uma requisição chega com `campaignIntent: "offer"` sem `discountedPriceCents`
- **THEN** o endpoint retorna HTTP 400
- **AND** a mensagem de erro é "Preço com desconto é obrigatório para ofertas"

#### Scenario: offer com preço válido prossegue

- **WHEN** uma requisição chega com `campaignIntent: "offer"` e `discountedPriceCents: 4990`
- **THEN** o endpoint prossegue sem erro de validação

### Requirement: Normalização de exclusive com preço indevido

O sistema SHALL normalizar `discountedPriceCents` para `undefined` quando `campaignIntent === "exclusive"` e `discountedPriceCents` estiver presente, logo após o parse do body e depois do guard de legal/auth/ownership, antes de montar `campaignInput`.

A normalização SHALL incluir log de warning (sem dados sensíveis se antes de ownership).

#### Scenario: exclusive com preço normaliza para ausente

- **WHEN** o body chega com `campaignIntent: "exclusive"` e `discountedPriceCents: 5000`
- **THEN** o pipeline normaliza `discountedPriceCents` para `undefined`
- **AND** registra log de warning: `"[generate-image] exclusive com discountedPriceCents presente — normalizando para ausente."`

### Requirement: Semântica de preço por intent (validação externalizada)

A validação semântica de preço SHALL ser feita no serviço, não no schema:

| Intent | discountedPriceCents | Comportamento |
|--------|---------------------|---------------|
| offer | obrigatório | Inferência F31.1 sempre gera offer quando DE+POR. Exibido como "de R$ X por R$ Y". |
| spotlight | normalmente presente | Inferência gera spotlight por ter preço único. Schema aceita opcional por tolerância. |
| exclusive | sempre omitido | Inferência gera exclusive por ausência de preço. Normalizado para ausente se presente. |

#### Scenario: Form frontend valida preço obrigatório para offer

- **WHEN** `campaignIntent === "offer"` e `discountedPriceCents` é undefined/0
- **THEN** `validateDiscountedPrice` retorna erro: "Preço com desconto é obrigatório para ofertas"

#### Scenario: Backend não valida schema para preço ausente em exclusive

- **WHEN** `campaignIntent === "exclusive"` sem `discountedPriceCents`
- **THEN** o schema aceita, sem erro de validação
