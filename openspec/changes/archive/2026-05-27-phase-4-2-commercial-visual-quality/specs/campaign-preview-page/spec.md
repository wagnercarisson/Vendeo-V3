> **Purpose**: Delta spec for the campaign preview page — the adjustments panel gains hook and CTA fields. Layout, navigation, and state handling remain unchanged.

## ADDED Requirements

### Requirement: Hook field in adjustments panel

The adjustments panel SHALL include a text field for editing the hook/benefício text. The field SHALL follow the same pattern as existing adjustment fields: label, input, original value display, undo button, local-only updates.

#### Scenario: Hook field renders with label

- **WHEN** the adjustments panel is displayed
- **THEN** a text input labeled "Texto do Benefício" SHALL be visible
- **AND** the input SHALL be pre-filled with the original or adjusted hook value
- **AND** the original value SHALL appear below the input

#### Scenario: Hook field supports undo

- **WHEN** the user edits the hook field
- **THEN** an undo button SHALL appear beside the input
- **AND** clicking undo SHALL reset the hook to the original `commercial_copy.hook` value
- **AND** the renderer SHALL update immediately

### Requirement: CTA field in adjustments panel

The adjustments panel SHALL include a text field for editing the CTA text. The field SHALL follow the same pattern as existing adjustment fields.

#### Scenario: CTA field renders with label

- **WHEN** the adjustments panel is displayed
- **THEN** a text input labeled "Chamada para Ação" SHALL be visible
- **AND** the input SHALL be pre-filled with the original or adjusted CTA value
- **AND** the original value SHALL appear below the input

#### Scenario: CTA field supports undo

- **WHEN** the user edits the CTA field
- **THEN** an undo button SHALL appear beside the input
- **AND** clicking undo SHALL reset the CTA to the original `commercial_copy.cta` value
- **AND** the renderer SHALL update immediately

### Requirement: Adjustments merge includes hook and CTA

The PreviewPage SHALL expand the `mergedSpec` computation to merge hook and CTA adjustments into the spec before passing to CampaignRenderer.

#### Scenario: Hook adjustment merges into spec

- **WHEN** the hook field has an adjustment value
- **THEN** `mergedSpec.commercial_copy.hook` SHALL equal the adjusted value
- **AND** the CampaignRenderer SHALL receive the merged spec

#### Scenario: CTA adjustment merges into spec

- **WHEN** the CTA field has an adjustment value
- **THEN** `mergedSpec.commercial_copy.cta` SHALL equal the adjusted value
- **AND** the CampaignRenderer SHALL receive the merged spec

### Requirement: CampaignAdjustments type expanded

The `CampaignAdjustments` interface SHALL include `hook` and `cta` optional string fields, following the same pattern as `title`, `discountedPriceDisplay`, and `badgeText`.

#### Scenario: CampaignAdjustments includes hook and cta

- **WHEN** inspecting `CampaignAdjustments`
- **THEN** the type SHALL include `hook?: string` and `cta?: string`
- **AND** existing fields SHALL remain unchanged
