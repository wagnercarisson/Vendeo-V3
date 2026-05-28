> **Purpose**: Delta spec for Phase 4.3 changes to the campaign preview page. The preview page is adapted to display AI-generated flat campaign images as primary output, with the CSS renderer available as a legacy fallback option.

## ADDED Requirements

### Requirement: Preview payload supports generated image

The `PreviewPayload` interface SHALL include an optional `generatedImageDataUrl?: string` field that carries the AI-generated campaign image as a base64 data URL.

When `generatedImageDataUrl` is present, the preview page SHALL display it as the primary campaign art. The CSS renderer SHALL NOT be the default rendering mode in this case.

The data URL is temporary and exists only within the session — no definitive persistence.

#### Scenario: Preview displays generated image when available

- **WHEN** a `PreviewPayload` contains `generatedImageDataUrl`
- **THEN** the preview page SHALL display the AI-generated image as the primary campaign art
- **AND** the image SHALL render as a full-width flat image in the left panel
- **AND** no CSS-based rendering SHALL be used by default

#### Scenario: Preview falls back to CSS renderer

- **WHEN** a `PreviewPayload` does NOT contain `generatedImageDataUrl`
- **THEN** the preview page SHALL fall back to the `CampaignRenderer` (CSS-based) as before
- **AND** the page SHALL behave identically to Phase 4.2

#### Scenario: Large base64 images are acceptable for spike

- **WHEN** `generatedImageDataUrl` is a large base64 string in sessionStorage
- **THEN** the page SHALL attempt to display it
- **AND** if sessionStorage quota is exceeded, the page SHALL handle gracefully (degrade to fallback or show error)

### Requirement: Preview layout adapts for generated images

When displaying an AI-generated image, the preview page MAY simplify the right panel. The CSS adjustments panel (copy editing fields) MAY be hidden or reduced since the generated image is flat and non-editable. The legacy toggle to switch back to the CSS renderer SHALL be available.

#### Scenario: Generated image view hides adjustments

- **WHEN** `generatedImageDataUrl` is present
- **THEN** the adjustments panel MAY be hidden or reduced
- **AND** a toggle/button SHALL allow switching to the legacy CSS renderer view

#### Scenario: Legacy toggle shows CSS renderer

- **WHEN** the user clicks the legacy toggle
- **THEN** the CSS `CampaignRenderer` SHALL render with the spec data from the payload
- **AND** the adjustments panel SHALL reappear (if hidden)

## MODIFIED Requirements

### Requirement: Preview page at /campaign/preview

**MODIFIED** — The system SHALL provide a route at `/campaign/preview` that displays the rendered campaign art. When a `generatedImageDataUrl` is present, the primary rendering mode SHALL be the AI-generated flat image. When absent, the existing `CampaignRenderer` SHALL be used as fallback. The page SHALL read the preview payload from sessionStorage on mount.

#### Scenario: Preview route reads payload from sessionStorage

**MODIFIED** — WHEN a user navigates to `/campaign/preview`, THEN the page SHALL read the `PreviewPayload` from sessionStorage, AND if `generatedImageDataUrl` is present, render the AI-generated image as primary; otherwise render the `CampaignRenderer` with the stored `campaignSpec`, `storeIdentity`, and `productImageUrl`.

#### Scenario: No payload redirects to empty state

- **WHEN** a user navigates to `/campaign/preview`
- **AND** no valid `PreviewPayload` exists in sessionStorage
- **THEN** the page SHALL display an empty state with message "Nenhuma campanha encontrada"
- **AND** a button SHALL navigate the user to the campaign input route

#### Scenario: Invalid payload shows error state

- **WHEN** a user navigates to `/campaign/preview`
- **AND** the sessionStorage payload is malformed or fails to parse
- **THEN** the page SHALL display an error state with a retry/back button
