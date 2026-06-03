## ADDED Requirements

### Requirement: Store Brand Profiler (without logo) prompt

The system SHALL have a dedicated prompt file at `prompts/store-brand-profiler.md` for inferring a complete brand profile for stores without a logo.

The prompt SHALL be separate from:
- The Store Identity Art Director (creates visual signatures)
- The Campaign Image Director (creates campaign images)
- The Store Brand Director with Logo (analyzes real logos)

The prompt SHALL be executed AFTER the lojista approves a visual signature.

#### Scenario: Prompt file exists

- **WHEN** inspecting `prompts/`
- **THEN** a file `store-brand-profiler.md` SHALL exist
- **AND** the file SHALL contain instructions for brand profile inference without logo analysis

#### Scenario: Prompt is separate from other roles

- **WHEN** the prompt is inspected
- **THEN** it SHALL NOT contain instructions for visual signature creation
- **AND** it SHALL NOT contain instructions for campaign generation

### Requirement: Brand profiler inputs

The Store Brand Profiler SHALL consume the following inputs:
1. Store cadastral data: name, segment, subsegment, tone_of_voice, positioning, short_description, slogan, city, state
2. Approved outputs from the Store Identity Art Director:
   - `creative_description` (textual direction adopted)
   - `suggested_colors` (array of hex values)
   - `visual_direction` (e.g., "Moderna e minimalista")
   - `elements_used` (array of design elements)
   - `asset_url` (approved visual signature URL)
   - `reference_card_url` (if generated)

The profiler SHALL NOT perform heavy image analysis but SHALL NOT ignore the approved visual signature. It SHALL use creative metadata as the primary source for brand inference.

#### Scenario: All inputs are consumed

- **WHEN** the brand profiler is invoked
- **THEN** it SHALL receive store cadastral data AND the Store Identity Art Director's approved outputs
- **AND** SHALL use creative metadata as primary input

#### Scenario: Without reference card

- **WHEN** no reference card was generated
- **THEN** the profiler SHALL proceed with the remaining inputs
- **AND** the missing reference card SHALL NOT block profile generation

### Requirement: Brand profiler output

The Store Brand Profiler SHALL produce a structured JSON output matching the same format as the existing Store Brand Director with Logo:

```json
{
  "logo_colors_detected": ["#HEX1", "#HEX2"],
  "safe_color_tokens": { "primary": "#HEX", "secondary": "#HEX", "accent": "#HEX", "background": "#HEX" },
  "visual_style": "descrição",
  "visual_tone": "descrição",
  "typography_direction": "descrição",
  "brand_personality": "descrição",
  "campaign_guidelines": "diretrizes criativas para campanhas",
  "campaign_brief": "brief conciso para o diretor de campanha",
  "inferred_primary_color": "#HEX",
  "inferred_accent_color": "#HEX",
  "confidence_score": 0.85
}
```

The `logo_colors_detected` field SHALL be populated from `suggested_colors` (since no real logo exists to analyze).

The `inferred_primary_color` and `inferred_accent_color` fields are specific to the without-logo flow and represent the AI's best guess for brand colors based on the visual signature.

#### Scenario: Output matches expected format

- **WHEN** the brand profiler completes successfully
- **THEN** the output SHALL contain all listed fields
- **AND** `logo_colors_detected` SHALL reflect the suggested colors from the identity art director

#### Scenario: Inferred colors populated

- **WHEN** the brand profiler completes
- **THEN** `inferred_primary_color` SHALL contain a hex value
- **AND** `inferred_accent_color` SHALL contain a hex value

### Requirement: Brand profiler execution

The brand profiler SHALL execute inline after the lojista approves the visual signature. The flow is:

1. Lojista approves visual signature
2. `store_visual_signatures` updated to `active`
3. `stores.logo_status` set to `generated`
4. Store Brand Profiler invoked with store data + identity art director outputs
5. Brand profile persisted with source `without_logo`, status `synced` (or `failed` on error)
6. Previous brand profile, if any, SHALL be marked as `outdated` only when the new profile is successfully created with status = `synced`. If the new profile fails, the previous `synced` profile SHALL remain unchanged.

Processing SHALL be inline (same request) — no queue, no polling. Status `processing` is reserved for future queue-based processing.

#### Scenario: Profile created as synced on success

- **WHEN** the brand profiler completes successfully
- **THEN** a brand profile SHALL be created with `source = 'without_logo'`
- **AND** `status = 'synced'`
- **AND** `active_logo_asset_id = null`

#### Scenario: Profile created as failed on error

- **WHEN** the brand profiler call fails
- **THEN** a brand profile SHALL be created with `status = 'failed'`
- **AND** error details SHALL be recorded in metadata
- **AND** the approved visual signature SHALL still be persisted (brand profile failure does not roll back the signature)

#### Scenario: Previous profile marked outdated only on success

- **WHEN** a new brand profile is created with source `without_logo`
- **AND** the new brand profile has `status = 'synced'`
- **AND** a previous `synced` profile exists
- **THEN** the previous profile SHALL have its status changed to `outdated`

#### Scenario: Previous profile preserved on failure

- **WHEN** a new brand profile is created with source `without_logo`
- **AND** the new brand profile has `status = 'failed'`
- **AND** a previous `synced` profile exists
- **THEN** the previous profile SHALL remain `synced`
