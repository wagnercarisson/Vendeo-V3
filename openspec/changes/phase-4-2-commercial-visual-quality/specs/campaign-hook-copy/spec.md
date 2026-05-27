> **Purpose**: This spec defines the hook/benefício capability — ensuring the AI generates useful hook copy, rendering it in the campaign art, and allowing the lojista to edit it via the adjustments panel.

## ADDED Requirements

### Requirement: Hook rendered in campaign composition

The system SHALL render `commercial_copy.hook` from the `CampaignSpec` as a visible text element in the campaign composition. The hook SHALL appear as a secondary highlight — less prominent than the price but more prominent than the description.

#### Scenario: Hook appears in rendered art

- **WHEN** a `CampaignSpec` with a non-empty `commercial_copy.hook` is rendered
- **THEN** the hook text SHALL appear in the campaign composition
- **AND** its position, font size, and styling SHALL follow the 4.2.0 Commercial Art Direction contract

#### Scenario: Empty hook hides hook zone

- **WHEN** `commercial_copy.hook` is empty or null
- **THEN** no hook zone SHALL be rendered
- **AND** no empty space SHALL replace the hook zone
- **AND** the elements below SHALL adjust naturally

### Requirement: Hook editable in adjustments panel

The `CampaignAdjustmentsPanel` SHALL include a text input field for editing the hook/benefício text. Editing the hook SHALL update the rendered art locally without API calls.

#### Scenario: Hook field renders in adjustments panel

- **WHEN** the adjustments panel is displayed
- **THEN** a text input with label "Texto do Benefício" SHALL be visible
- **AND** the input SHALL be pre-filled with the original `commercial_copy.hook` value
- **AND** the original value SHALL be displayed below the input

#### Scenario: Hook override re-renders locally

- **WHEN** the user edits the hook field
- **THEN** the CampaignRenderer SHALL re-render with the new hook text
- **AND** no API call SHALL be made

#### Scenario: Hook undo resets to original

- **WHEN** the user clicks undo on the hook field
- **THEN** the hook SHALL revert to the original `commercial_copy.hook` value
- **AND** the CampaignRenderer SHALL re-render with the original value

#### Scenario: Hook field max length

- **WHEN** the user types in the hook field
- **THEN** the input SHALL accept a maximum of 120 characters
- **AND** a character counter SHALL display the current length

### Requirement: MockProvider generates useful hooks

The `MockProvider` SHALL generate hook text that is useful for validating the visual composition — contextually relevant, varied in length, and realistic for the store segment.

#### Scenario: MockProvider returns contextual hooks

- **WHEN** `MockProvider.generate()` receives input with `storeSegment: "alimentacao-bebidas"`
- **THEN** the generated `commercial_copy.hook` SHALL be contextually relevant to food/beverages
- **AND** SHALL NOT return generic text like "Aproveite esta oferta"

#### Scenario: MockProvider hooks vary per segment

- **WHEN** `MockProvider.generate()` is called with different store segments
- **THEN** the generated hook SHALL vary based on the segment context
- **AND** no two segments SHALL receive the identical default hook
