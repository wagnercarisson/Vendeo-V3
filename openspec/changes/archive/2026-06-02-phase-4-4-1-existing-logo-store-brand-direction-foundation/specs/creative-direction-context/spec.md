## ADDED Requirements

### Requirement: Brand profile consumed as creative brief context

The `CreativeBrief` SHALL be extended to consume the active store brand profile when available. During prompt assembly, the system SHALL check for a `synced` brand profile for the store. If one exists, the following fields SHALL be injected as additional context variables into the Campaign Director prompt:

- `brandGuidelines`: from `campaign_guidelines` field
- `brandBrief`: from `campaign_brief` field
- `brandPersonality`: from `brand_personality` field
- `brandVisualStyle`: from `visual_style` field
- `brandVisualTone`: from `visual_tone` field
- `brandColors`: from `brand_colors_chosen` (or `safe_color_tokens` if chosen not set)

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

### Requirement: Brief context is directional, not prescriptive

The brand profile context injected into the Campaign Director prompt SHALL be labeled as creative direction context, not as mandatory rules. The prompt SHALL instruct the Campaign Director to use the brand context as creative fuel while preserving its own judgment for visual composition.

#### Scenario: Prompt indicates context is directional

- **WHEN** the Campaign Director prompt is assembled with brand profile data
- **THEN** the brand context SHALL be introduced as optional creative direction
- **AND** no mandatory rule regarding brand compliance SHALL be added
