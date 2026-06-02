## ADDED Requirements

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
