## MODIFIED Requirements

### Requirement: GenerateImageRequestSchema

O schema `GenerateImageRequestSchema` em `src/lib/image-generation/schema.ts` SHALL ser modificado para aceitar:

- `campaignIntent` — `z.enum(["offer", "spotlight", "exclusive"]).optional().default("offer")` — ADICIONADO
- `preserveImageContext` — `z.boolean().optional()` — ADICIONADO
- `discountedPriceCents` — mantém `z.number().int().positive()` (required, sem mudança — compatível com pipeline até F31.2)

O schema SHALL usar `.strict()` para rejeitar campos não reconhecidos.

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

#### Scenario: discountedPriceCents mantém-se required

- **WHEN** o body omite `discountedPriceCents`
- **THEN** `GenerateImageRequestSchema.safeParse()` retorna `{ success: false, error }`
