> **Purpose**: Delta spec for Phase 4.3. The CampaignRenderer is no longer the primary output path for agency-grade campaign art. It remains available as a legacy/fallback renderer. No code is removed or invalidated.

## ADDED Requirements

### Requirement: CampaignRenderer as legacy fallback

The `CampaignRenderer` SHALL remain available as a legacy/fallback renderer in Phase 4.3. It SHALL NOT be the primary output path for AI-native campaign generation. No existing code SHALL be removed, refactored, or invalidated.

The component SHALL continue to function exactly as specified in the main spec when called directly. The deprecation is at the architectural level, not the component level.

#### Scenario: CampaignRenderer still renders on demand

- **WHEN** `CampaignRenderer` is called with valid props (e.g., from the legacy toggle in preview)
- **THEN** it SHALL render the `produto-oferta-comercial` template exactly as in Phase 4.2
- **AND** no functionality SHALL be removed

#### Scenario: CampaignRenderer is not the default

- **WHEN** a campaign has an AI-generated image available
- **THEN** the preview page SHALL NOT use `CampaignRenderer` as the default rendering mode
