# Copy Director

> Modified by `fase-31-2-diretores-por-intencao`.

## MODIFIED Requirements

### Requirement: CopyDirectorInput inclui campaignIntent e commercialFrame

O sistema SHALL substituir `offer (string, obrigatório)` por `commercialFrame (string, obrigatório)` e adicionar `campaignIntent (enum, opcional, default "offer")` no `CopyDirectorInputSchema`:

```typescript
export const CopyDirectorInputSchema = z.object({
  productName: z.string().min(1, "productName é obrigatório"),
  description: z.string().optional(),
  commercialFrame: z.string().min(1, "commercialFrame é obrigatório"),           // ← substitui offer (sempre presente)
  storeName: z.string().min(1, "storeName é obrigatório"),
  segment: z.string().min(1, "segment é obrigatório"),
  campaignIntent: z                    // ← NOVO
    .enum(["offer", "spotlight", "exclusive"])
    .optional()
    .default("offer"),
  toneOfVoice: z.string().optional(),
  positioning: z.string().optional(),
  shortDescription: z.string().optional(),
  slogan: z.string().optional(),
  brandPersonality: z.string().optional(),
  campaignGuidelines: z.string().optional(),
});
```

#### Scenario: CopyDirectorInput aceita commercialFrame

- **WHEN** `CopyDirectorInput` é validado com `commercialFrame` em vez de `offer`
- **THEN** a validação passa

#### Scenario: CopyDirectorInput aceita campaignIntent

- **WHEN** `CopyDirectorInput` é validado com `campaignIntent: "spotlight"`
- **THEN** a validação passa

#### Scenario: CopyDirectorInput sem campaignIntent usa default offer

- **WHEN** `campaignIntent` está ausente
- **THEN** `CopyDirectorInputSchema` aplica default `"offer"`

### Requirement: generateCopy carrega prompt por campaignIntent

O sistema SHALL carregar o template `campaign-copy-director-${input.campaignIntent}` via `PromptLoader.load()`. Sem fallback silencioso — se o prompt não existir para intent válida, o erro é propagado.

#### Scenario: generateCopy carrega campaign-copy-director-spotlight

- **WHEN** `generateCopy` é chamado com `campaignIntent: "spotlight"`
- **THEN** `PromptLoader.load("campaign-copy-director-spotlight", { ... })` é chamado

### Requirement: generateCopy interpola commercialFrame nas variáveis

O sistema SHALL interpolar `commercialFrame` nas variáveis do prompt, no lugar de `offer`. As demais variáveis permanecem inalteradas.

#### Scenario: commercialFrame presente nas variáveis

- **WHEN** `generateCopy` monta as variáveis para interpolação
- **THEN** `commercialFrame` está presente com o valor do input validado
- **AND** `offer` NÃO está presente nas variáveis

## ADDED Requirements

### Requirement: mapBriefToCopyDirectorInput monta commercialFrame por intent

O sistema SHALL adaptar `mapBriefToCopyDirectorInput` para:

- offer: `commercialFrame = buildCommercialFrame("Promoção: de R$ X por R$ Y")`
- spotlight: `commercialFrame = "Destaque — R$ X"` ou `"Destaque do produto"` (se sem preço)
- exclusive: `commercialFrame = "Produto exclusivo — sem divulgação de preço"`

O mapper SHALL propagar `campaignIntent` do brief para o `CopyDirectorInput`.

#### Scenario: mapBriefToCopyDirectorInput monta commercialFrame para offer

- **WHEN** o brief tem `campaignIntent: "offer"` com preço
- **THEN** `commercialFrame` contém "Promoção: de R$ X por R$ Y" (formato BRL)

#### Scenario: mapBriefToCopyDirectorInput monta commercialFrame para exclusive

- **WHEN** o brief tem `campaignIntent: "exclusive"`
- **THEN** `commercialFrame` contém "Produto exclusivo — sem divulgação de preço"
- **AND** não contém preço ou desconto

### Requirement: buildCommercialFrame substitui buildOfferText

O sistema SHALL substituir `buildOfferText` por `buildCommercialFrame(campaignIntent, input)` que retorna o texto comercial apropriado para cada intent.

A função `buildOfferText` pode ser mantida internamente para o caso `offer` (regressão), mas a interface pública passa a ser `buildCommercialFrame`.

#### Scenario: buildCommercialFrame para offer retorna mesmo resultado

- **WHEN** `buildCommercialFrame("offer", { discountedPriceCents: 4990, badgeText: "Promoção" })` é chamado
- **THEN** retorna `"Promoção: Apenas R$ 49,90"` (formato igual ao `buildOfferText` anterior)
