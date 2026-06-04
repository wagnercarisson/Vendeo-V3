> **Purpose**: Defines the Store Identity Art Director — a dedicated AI professional responsible exclusively for creating visual signatures for stores without a logo. Separate from campaign concerns. Generates professional visual signatures (PNG), reference cards, and creative metadata.

## Requirements

### Requirement: Store Identity Art Director prompt

The system SHALL have a dedicated prompt file at `prompts/store-identity-art-director.md` for the Store Identity Art Director — a distinct AI professional responsible exclusively for creating visual signatures for stores without a logo.

The prompt SHALL NOT mix roles with campaign generation, CTA, product, or offer creation. The Store Identity Art Director SHALL NOT generate campaign art, promotional copy, or product imagery.

The prompt SHALL receive store cadastral data: name, segment, subsegment, tone_of_voice, positioning, short_description, slogan, city, state.

When a previous version was rejected, the prompt SHALL also receive rejection context: "A versão anterior foi rejeitada porque: [motivo]. Busque uma direção criativa completamente diferente — não apenas uma variação pequena da anterior."

#### Scenario: Prompt file exists

- **WHEN** inspecting `prompts/`
- **THEN** a file `store-identity-art-director.md` SHALL exist
- **AND** the file SHALL contain instructions for visual signature generation only

#### Scenario: Prompt excludes campaign concerns

- **WHEN** the prompt is inspected
- **THEN** it SHALL NOT reference product generation, CTA creation, offer design, or campaign art
- **AND** it SHALL NOT include instructions for pricing, promotional copy, or product imagery

#### Scenario: Rejection context is accepted

- **WHEN** the prompt is inspected
- **THEN** it SHALL define how rejection context from previous attempts is processed
- **AND** it SHALL instruct the AI to seek a completely new creative direction, not a minor variation

### Requirement: Visual signature generation output

The Store Identity Art Director SHALL produce the following outputs per generation:

1. **Visual signature** — PNG image, clean and reusable brand mark, store name as the main element, transparent or simple/solid background, optionally including a symbol or icon
2. **Reference card** — PNG image on neutral background showing the signature in context, to help the Campaign Director interpret the brand identity
3. **Creative metadata** — JSON structure with: `creative_description` (textual direction), `suggested_colors` (array of hex values), `visual_direction` (e.g., "Moderna e minimalista"), `elements_used` (array of design elements)

The generated visual signature SHALL:
- Look professional and publishable
- Use brand color(s) as accent
- NOT contain pricing, products, offers, CTAs, or promotional copy
- NOT be generic "initials in circle"
- NOT be campaign art

#### Scenario: Output includes PNG + reference card + metadata

- **WHEN** the Store Identity Art Director completes a generation
- **THEN** the output SHALL include a PNG signature, a PNG reference card (if generated), and structured creative metadata
- **AND** the metadata SHALL include `creative_description`, `suggested_colors`, `visual_direction`

#### Scenario: Signature avoids generic design

- **WHEN** a visual signature is generated
- **THEN** it SHALL NOT be a simple circle with initials
- **AND** it SHALL contain the store name as the main prominent element

### Requirement: Generation cascade with existing patterns

The Store Identity Art Director SHALL reuse the existing progress/timeout/retry patterns from the project's image generation pipeline.

Cascade:
1. Attempt 1: full generation (signature + reference card + metadata) with configurable timeout
2. If timeout or error: retry once with simplified prompt — using same retry patterns as existing image generation
3. If retry fails: controlled error — no typographic fallback
4. Error message: "Não foi possível criar sua assinatura visual agora. Pode haver instabilidade temporária no serviço de IA, problema de conexão ou servidor. Tente novamente mais tarde."
5. Validation of infra timeout limits (Vercel hobby: 60s) before confirming inline processing

#### Scenario: First attempt succeeds

- **WHEN** the generation completes within timeout
- **THEN** the signature, reference card, and metadata SHALL be returned
- **AND** no retry SHALL be triggered

#### Scenario: Timeout triggers simplified retry

- **WHEN** the first attempt times out
- **THEN** the system SHALL retry once with a simplified prompt
- **AND** the retry SHALL use the existing project retry pattern

#### Scenario: Retry also fails returns controlled error

- **WHEN** the retry also fails
- **THEN** the system SHALL return the controlled error message
- **AND** no typographic fallback SHALL be generated

### Requirement: Image quality criteria

The visual signature SHALL be validated before being presented to the lojista:
- Valid PNG with content
- Store name appears in the image (basic heuristic or LLM-based validation)
- NOT a generic circle+initials design

If validation fails, the system SHALL log the rejection and proceed to the fallback cascade.

#### Scenario: Invalid signature is rejected

- **WHEN** the generated image fails visual validation
- **THEN** the system SHALL NOT present it to the lojista
- **AND** SHALL proceed to retry or error cascade

#### Scenario: Valid signature is presented

- **WHEN** the generated image passes visual validation
- **THEN** the system SHALL present it to the lojista for approval
