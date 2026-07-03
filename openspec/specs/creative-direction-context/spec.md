# Creative Direction Context

## Purpose

Defines how the system infers product category during input validation, detects category-vs-segment conflicts, extracts commercially actionable repertoire from campaign details, and injects this context into the image generation prompt for more adaptive creative direction.

## Requirements

### Requirement: Input validation infers product category

The system SHALL infer the product category during the pre-generation input validation phase by extending the `campaign-input-visual-check.md` prompt. The vision model SHALL return an `inferredCategory` field in its JSON response alongside the existing classification.

The `InputValidationResult` type SHALL include an optional `inferredCategory?: string` field representing the category of the product as determined from its image (e.g., `"bebidas-energeticos"`, `"calcados-esportivos"`, `"cosmeticos"`).

When the model does not return `inferredCategory` or returns an unrecognizable value, the system SHALL fall back to the store's `storeSegment` value — no error SHALL be raised.

#### Scenario: Category inferred during input validation

- **WHEN** the input validation vision model analyzes the product image
- **THEN** the response SHALL include an `inferredCategory` field alongside the classification
- **AND** the field SHALL be a string describing the product category based on visual analysis

#### Scenario: Missing inferredCategory uses store segment fallback

- **WHEN** the vision model response does not contain `inferredCategory`
- **THEN** the system SHALL use `storeSegment` as the inferred category
- **AND** no error SHALL be raised
- **AND** `hasCategoryConflict` SHALL be `false`

### Requirement: CreativeBrief built during prompt assembly

The system SHALL build a `CreativeBrief` during the prompt assembly phase that considers:
- Store segment (from store identity)
- Inferred product category (from input validation, fallback to store segment)
- Whether the product category differs from the store segment (category conflict)
- Commercial objective
- Store tone of voice
- Additional details parsed as commercially actionable repertoire
- **Identity state** — the resolved `CampaignBrief.identity` block, including `state`, `imageUrl`, and `directive`

The `CreativeBrief` SHALL be assembled as prompt variables interpolated into the `campaign-image-director.md` prompt. No new service or class SHALL be created — the existing `ImageGenerationService.buildPromptVariables()` SHALL be extended.

The identity block SHALL inform the creative brief about which asset type is active and how it should be used. The visual signature is now resolved at the briefing layer, not only at the renderer.

All existing creative brief fields SHALL be preserved. No new mandatory creative rules SHALL be introduced.

#### Scenario: Creative brief includes persona by segment

- **WHEN** the creative brief is built for a store in segment `"alimentacao-bebidas"`
- **THEN** the persona string SHALL be `"Você é um diretor de marketing especializado em alimentação e bebidas."`

#### Scenario: Creative brief includes identity block

- **WHEN** the creative brief is built during prompt assembly
- **THEN** it SHALL include `identity.state`, `identity.imageUrl`, and `identity.directive` from the `CampaignBrief`
- **AND** all existing fields SHALL be preserved

#### Scenario: Category conflict directive is conditional

- **WHEN** the inferred product category matches the store segment
- **THEN** `categoryConflictDirective` SHALL be an empty string
- **AND** no category conflict directive SHALL appear in the prompt

#### Scenario: Category conflict directive is included on mismatch

- **WHEN** the inferred product category differs from the store segment according to `isSameCategory()`
- **THEN** `categoryConflictDirective` SHALL contain explicit instructions to adapt the visual direction to the product's category universe while preserving store identity as signature

### Requirement: Commercial repertoire extracted from additional details

The system SHALL parse the following form fields for commercially actionable arguments:
- `additionalDetails` — free-form text
- `availabilityNotes` — availability information (e.g., "poucas unidades", "cores variadas")
- `validity` — promotion validity period
- `campaignDetails` — additional campaign context

The extracted repertoire SHALL be a single PT-BR string inserted into the prompt as optional creative fuel for the director — NOT as mandatory instructions. The director SHALL use judgment to select what strengthens the visual piece. When no actionable arguments are found, the repertoire string SHALL be empty.

#### Scenario: Commercial repertoire extracted from availability notes

- **WHEN** `availabilityNotes` contains "poucas unidades"
- **THEN** the commercial repertoire SHALL include `"Disponibilidade limitada: poucas unidades"` as an optional visual argument
- **AND** the director MAY choose to display this or not based on visual composition

#### Scenario: Empty commercial repertoire

- **WHEN** no actionable arguments are found in additional details, availability notes, validity, or campaign details
- **THEN** the commercial repertoire string SHALL be empty

### Requirement: Category conflict detection is conservative

The `isSameCategory()` function SHALL NOT compare strings directly. It SHALL use a `CATEGORY_TO_SEGMENT_GROUP` mapping that groups inferred category keywords under known segment identifiers:

```typescript
const CATEGORY_TO_SEGMENT_GROUP: Record<string, string[]> = {
  "alimentacao-bebidas": ["bebidas", "alimentos", "bebida", "energetico", "cafe", "cerveja", "refrigerante", "suco", "agua", "comida", "snack", "doce", "salgado"],
  "moda-vestuario": ["roupa", "calcado", "tenis", "vestuario", "moda", "acessorio", "bolsa", "camiseta", "jeans"],
  // demais segmentos seguem mesmo padrão
};
```

When the inferred category does not match any keyword group, `hasCategoryConflict` SHALL be `false` (conservative — assume alignment by default). A conflict is only flagged when there is a clear match to a segment group different from the store's own segment.

#### Scenario: Clear category conflict detected

- **WHEN** the store segment is `"moda-vestuario"`
- **AND** the inferred category is `"energetico"`
- **AND** `"energetico"` maps to the `"alimentacao-bebidas"` group
- **THEN** `hasCategoryConflict` SHALL be `true`

#### Scenario: Unknown category is conservative

- **WHEN** the inferred category is `"brinquedos"` and no mapping exists for this term
- **THEN** `hasCategoryConflict` SHALL be `false`
- **AND** the store segment SHALL be used as-is for creative direction

#### Scenario: Category matches own segment

- **WHEN** the store segment is `"alimentacao-bebidas"`
- **AND** the inferred category is `"cafe"`
- **AND** `"cafe"` maps to the `"alimentacao-bebidas"` group
- **THEN** `hasCategoryConflict` SHALL be `false`

### Requirement: creativeContextGuidance considers segment and product category

The system SHALL inject an optional `creativeContextGuidance` variable into the director prompt. This variable SHALL provide a tone/approach suggestion that considers:
- Store segment
- Inferred product category (from input validation)
- Whether there is a category conflict or alignment between segment and product

The guidance SHALL be a single short PT-BR sentence. When there is a category conflict, the guidance SHALL balance both universes without polluting the prompt.

Examples:
- Food store selling energy drink: `"Valorize energia e disposição. Preço é oportunidade."`
- Popular/variedades store selling premium electronics: `"Equilibre varejo popular com desejo por tecnologia."`
- Fashion store selling sports shoes: `"Valorize estilo e performance. Preço é investimento."`

#### Scenario: creativeContextGuidance generated from segment and category

- **WHEN** `buildPromptVariables()` is called
- **THEN** the returned record SHALL include `creativeContextGuidance`
- **AND** the value SHALL consider both store segment and inferred category

#### Scenario: Category conflict balanced in guidance

- **WHEN** store segment is `"variedades"` and inferred category is `"eletronicos"`
- **THEN** the guidance SHALL balance popular retail with technology desire
- **AND** SHALL NOT force either universe exclusively

### Requirement: CreativeBrief includes visual signature asset

The `CreativeBrief` SHALL include the store's active visual signature URL and type as fixed assets. These SHALL be passed to the rendering pipeline but SHALL NOT be injected into the AI image generation prompt (the visual signature is a render-time element, not a prompt variable).

#### Scenario: Visual signature passed through brief

- **WHEN** a `CreativeBrief` is built for a store with an active visual signature
- **THEN** the brief SHALL include `visualSignatureUrl` and `visualSignatureType`
- **AND** these SHALL be available for the renderer to use in the store identity zone

#### Scenario: No visual signature leaves fields empty

- **WHEN** a `CreativeBrief` is built for a store without an active visual signature
- **THEN** `visualSignatureUrl` SHALL be undefined
- **AND** the renderer SHALL fall back to existing store identity logic (logo → initials → name)

### Requirement: Brand profile consumed as creative brief context

The `CreativeBrief` SHALL be extended to consume the active store brand profile when available. During prompt assembly, the system SHALL check for a `synced` brand profile for the store. If one exists, the following fields SHALL be injected as additional context variables into the Campaign Director prompt:

- `brandGuidelines`: from `campaign_guidelines` field
- `brandBrief`: from `campaign_brief` field
- `brandPersonality`: from `brand_personality` field
- `brandVisualStyle`: from `visual_style` field
- `brandVisualTone`: from `visual_tone` field
- `brandColors`: resolved via `safe_color_tokens.primary > inferred_primary_color > store.brand_color > SEGMENT_COLOR_FALLBACK[segment]`. `brand_colors_chosen` SHALL NOT be used in the rendering hierarchy — it is used only for UI pre-fill in the color pickers and as input signal to the inference service

These fields SHALL be interpolated as prompt variables — they provide context and creative fuel for the Campaign Director, not mandatory rules. The Campaign Director retains creative judgment on how to use this context.

When no synced brand profile exists, these variables SHALL be empty strings and the existing segment-based fallback logic SHALL apply unchanged.

#### Scenario: Brand profile context injected into prompt

- **WHEN** a campaign is generated for a store with a synced brand profile
- **THEN** the `CreativeBrief` SHALL include brandGuidelines, brandBrief, brandPersonality, brandVisualStyle, brandVisualTone, and brandColors
- **AND** these fields SHALL be available as prompt variables

#### Scenario: No brand profile uses existing fallback

- **WHEN** a campaign is generated for a store without a synced brand profile
- **THEN** the brand profile fields SHALL be empty strings
- **AND** the existing segment-based fallback logic SHALL be used unchanged

#### Scenario: Campaign uses safe_color_tokens color

- **WHEN** a campaign is generated for a store with a synced brand profile
- **AND** the profile has `safe_color_tokens.primary = "#4A6FA5"`
- **THEN** the `brandColors` in the prompt SHALL use `#4A6FA5`
- **AND** `brand_colors_chosen` SHALL NOT override this value

#### Scenario: Campaign falls back through chain

- **WHEN** a campaign is generated for a store with a profile that has no `safe_color_tokens.primary`
- **AND** the profile has `inferred_primary_color = "#22C55E"`
- **THEN** the `brandColors` in the prompt SHALL use `#22C55E`

#### Scenario: No brand profile uses store.brand_color or segment fallback

- **WHEN** a campaign is generated for a store with no synced brand profile
- **AND** `store.brand_color` is set to `#3B82F6`
- **THEN** the `brandColors` in the prompt SHALL use `#3B82F6`

### Requirement: Brief context is directional, not prescriptive

The brand profile context injected into the Campaign Director prompt SHALL be labeled as creative direction context, not as mandatory rules. The prompt SHALL instruct the Campaign Director to use the brand context as creative fuel while preserving its own judgment for visual composition.

#### Scenario: Prompt indicates context is directional

- **WHEN** the Campaign Director prompt is assembled with brand profile data
- **THEN** the brand context SHALL be introduced as optional creative direction
- **AND** no mandatory rule regarding brand compliance SHALL be added
