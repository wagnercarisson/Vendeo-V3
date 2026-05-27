> **Purpose**: This spec defines the CTA editing capability — allowing the lojista to edit the call-to-action text locally via the adjustments panel, with undo support.

## ADDED Requirements

### Requirement: CTA editable in adjustments panel

The `CampaignAdjustmentsPanel` SHALL include a text input field for editing the call-to-action text. Editing the CTA SHALL update the rendered art locally without API calls.

#### Scenario: CTA field renders in adjustments panel

- **WHEN** the adjustments panel is displayed
- **THEN** a text input with label "Chamada para Ação" SHALL be visible
- **AND** the input SHALL be pre-filled with the original `commercial_copy.cta` value
- **AND** the original value SHALL be displayed below the input

#### Scenario: CTA override re-renders locally

- **WHEN** the user edits the CTA field
- **THEN** the CampaignRenderer SHALL re-render with the new CTA text
- **AND** no API call SHALL be made

#### Scenario: CTA undo resets to original

- **WHEN** the user clicks undo on the CTA field
- **THEN** the CTA SHALL revert to the original `commercial_copy.cta` value
- **AND** the CampaignRenderer SHALL re-render with the original value

#### Scenario: CTA field max length

- **WHEN** the user types in the CTA field
- **THEN** the input SHALL accept a maximum of 60 characters
- **AND** a character counter SHALL display the current length

### Requirement: CTA adjustment merged into rendered spec

The PreviewPage SHALL merge CTA adjustments into the spec before passing to CampaignRenderer, following the same pattern as existing adjustments (title, price, badge).

#### Scenario: CTA adjustment appears in merged spec

- **WHEN** the user edits the CTA field
- **THEN** the `mergedSpec.commercial_copy.cta` SHALL reflect the edited value
- **AND** the CampaignRenderer SHALL receive the merged spec with the edited CTA

#### Scenario: Default CTA fallback preserved

- **WHEN** `commercial_copy.cta` is empty in the original spec
- **AND** the user has not edited the CTA field
- **THEN** the CampaignRenderer SHALL display the default fallback "Aproveite Agora!"
