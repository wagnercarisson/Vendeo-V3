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

The `CreativeBrief` SHALL be assembled as prompt variables interpolated into the `campaign-image-director.md` prompt. No new service or class SHALL be created — the existing `ImageGenerationService.buildPromptVariables()` SHALL be extended.

#### Scenario: Creative brief includes persona by segment

- **WHEN** the creative brief is built for a store in segment `"alimentacao-bebidas"`
- **THEN** the persona string SHALL be `"Você é um diretor de marketing especializado em alimentação e bebidas."`

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

The extracted repertoire SHALL be a single PT-BR string inserted into the prompt as optional creative repertoire for the director — NOT as mandatory instructions. When no actionable arguments are found, the repertoire string SHALL be empty.

#### Scenario: Commercial repertoire extracted from availability notes

- **WHEN** `availabilityNotes` contains "poucas unidades"
- **THEN** the commercial repertoire SHALL include `"Disponibilidade limitada: poucas unidades"` as an optional visual argument

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
