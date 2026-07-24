## MODIFIED Requirements

### Requirement: CampaignGenerationInput schema

O sistema SHALL definir `CampaignGenerationInputSchema` Zod schema em `src/lib/campaign-intelligence/schema.ts` que valida requisições de geração de campanha.

O schema SHALL incluir campos para:
- `productName` — string, required
- `originalPriceCents` — number (integer), optional (sem mudança)
- `discountedPriceCents` — number (integer), required (sem mudança — compatível com pipeline até F31.2)
- `campaignIntent` — `z.enum(["offer", "spotlight", "exclusive"])`, optional, default `"offer"`
- `description` — string, optional
- `badge` — string, optional
- `storeName` — string, required
- `storeSegment` — string, required
- `brandColor` — string, required hex color
- `city` — string, optional
- `state` — string, optional, 2-letter code when provided

O sistema SHALL exportar `type CampaignGenerationInput = z.infer<typeof CampaignGenerationInputSchema>`.

#### Scenario: campaignIntent omitido usa default offer

- **WHEN** o body não inclui `campaignIntent`
- **THEN** `CampaignGenerationInputSchema.safeParse()` retorna `data.campaignIntent === "offer"`

#### Scenario: campaignIntent válido é aceito

- **WHEN** o body inclui `campaignIntent: "spotlight"`
- **THEN** `CampaignGenerationInputSchema.safeParse()` retorna `{ success: true, data }`

#### Scenario: campaignIntent inválido rejeita

- **WHEN** o body inclui `campaignIntent: "invalid_value"`
- **THEN** `CampaignGenerationInputSchema.safeParse()` retorna `{ success: false, error }`
