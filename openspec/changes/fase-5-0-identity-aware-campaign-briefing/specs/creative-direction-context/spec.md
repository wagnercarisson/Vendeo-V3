## MODIFIED Requirements

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
