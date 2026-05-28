> **Purpose**: This spec defines the preview page at `/campaign/preview` that displays the rendered campaign art and quick adjustments panel. Phase 4.3 adapted the preview to display AI-generated flat campaign images as primary output, with the CSS renderer available as a legacy fallback option.

## Requirements

### Requirement: Preview page at /campaign/preview (MODIFIED Phase 4.3)

The system SHALL provide a route at `/campaign/preview` that displays the rendered campaign art. When `generatedImageDataUrl` is present, the primary rendering mode SHALL be the AI-generated flat image. When absent, the existing `CampaignRenderer` SHALL be used as fallback. The page SHALL read the preview payload from sessionStorage on mount.

The page SHALL follow the visual and UX rules in `openspec/design-system/pages/campaign-preview.md`.

#### Scenario: Preview route reads payload from sessionStorage (MODIFIED Phase 4.3)

- **WHEN** a user navigates to `/campaign/preview`
- **THEN** the page SHALL read the `PreviewPayload` from sessionStorage
- **AND** if `generatedImageDataUrl` is present, render the AI-generated image as primary
- **AND** otherwise render the `CampaignRenderer` with the stored `campaignSpec`, `storeIdentity`, and `productImageUrl`

#### Scenario: No payload redirects to empty state

- **WHEN** a user navigates to `/campaign/preview`
- **AND** no valid `PreviewPayload` exists in sessionStorage
- **THEN** the page SHALL display an empty state with message "Nenhuma campanha encontrada"
- **AND** a button SHALL navigate the user to the campaign input route

#### Scenario: Invalid payload shows error state

- **WHEN** a user navigates to `/campaign/preview`
- **AND** the sessionStorage payload is malformed or fails to parse
- **THEN** the page SHALL display an error state with a retry/back button

### Requirement: Desktop layout with art and adjustments panel

On desktop viewports, the preview page SHALL display a two-column layout:
- Left column: the rendered campaign art at maximum visible size
- Right column: a quick adjustments panel with constrained edit fields

The art preview SHALL be rendered at the largest size that fits the viewport while preserving the 1:1 aspect ratio.

#### Scenario: Desktop shows art and panel side by side

- **WHEN** the viewport is 768px or wider
- **THEN** the campaign art SHALL render on the left and the adjustments panel on the right
- **AND** the art SHALL scale to fill available space while maintaining 1:1 aspect ratio

#### Scenario: Mobile stacks art above adjustments

- **WHEN** the viewport is narrower than 768px
- **THEN** the campaign art SHALL render at full width
- **AND** the adjustments panel SHALL collapse below the art

### Requirement: Preview payload supports generated image (ADDED Phase 4.3)

The `PreviewPayload` interface SHALL include an optional `generatedImageDataUrl?: string` field that carries the AI-generated campaign image as a base64 data URL. When `generatedImageDataUrl` is present, the preview page SHALL display it as the primary campaign art and SHALL NOT use the CSS renderer as default.

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

### Requirement: Preview layout adapts for generated images (ADDED Phase 4.3)

When displaying an AI-generated image, the preview page MAY simplify the right panel. The CSS adjustments panel MAY be hidden or reduced since the generated image is flat and non-editable. A legacy toggle to switch back to the CSS renderer SHALL be available (only when `campaignSpec` with valid `commercial_copy` exists).

#### Scenario: Generated image view hides adjustments

- **WHEN** `generatedImageDataUrl` is present
- **THEN** the adjustments panel MAY be hidden or reduced
- **AND** a toggle/button SHALL allow switching to the legacy CSS renderer view

#### Scenario: Legacy toggle shows CSS renderer

- **WHEN** the user clicks the legacy toggle
- **THEN** the CSS `CampaignRenderer` SHALL render with the spec data from the payload
- **AND** the adjustments panel SHALL reappear

### Requirement: Quick adjustments panel

The adjustments panel SHALL provide constrained fields for local editing:
- **Title**: text input, overrides `commercial_copy.title`
- **Discounted price**: BRL currency input, overrides `offer.discounted_price_display` only — SHALL NOT recalculate numeric price fields
- **Badge text**: text input, max 20 characters, overrides `offer.badge_text`
- **Hook**: text input, max 120 characters, label "Texto do Benefício", overrides `commercial_copy.hook`
- **CTA**: text input, max 60 characters, label "Chamada para Ação", overrides `commercial_copy.cta`

All adjustments SHALL update the rendered art locally without API calls. No free-form editing of layout, fonts, colors, or element positions SHALL be allowed.

Each adjusted field SHALL have an undo button that resets the field to the original spec value. Hook and CTA fields SHALL display a character counter showing the current length.

#### Scenario: Title adjustment re-renders locally

- **WHEN** the user edits the title field
- **THEN** the CampaignRenderer SHALL re-render with the new title
- **AND** no API call SHALL be made

#### Scenario: Price adjustment re-renders locally

- **WHEN** the user edits the discounted price field
- **THEN** the CampaignRenderer SHALL re-render with the new price display
- **AND** no API call SHALL be made

#### Scenario: Badge adjustment re-renders locally

- **WHEN** the user edits the badge text field
- **THEN** the CampaignRenderer SHALL re-render with the new badge text
- **AND** no API call SHALL be made

#### Scenario: Hook adjustment re-renders locally

- **WHEN** the user edits the hook field
- **THEN** the CampaignRenderer SHALL re-render with the new hook text
- **AND** no API call SHALL be made
- **AND** the character counter SHALL update to reflect the current length

#### Scenario: CTA adjustment re-renders locally

- **WHEN** the user edits the CTA field
- **THEN** the CampaignRenderer SHALL re-render with the new CTA text
- **AND** no API call SHALL be made
- **AND** the character counter SHALL update to reflect the current length

#### Scenario: Undo resets adjusted field

- **WHEN** the user clicks undo on any adjusted field
- **THEN** that field SHALL revert to the original value from the spec
- **AND** the CampaignRenderer SHALL re-render with the original value

### Requirement: CampaignAdjustments type expanded

The `CampaignAdjustments` interface SHALL include `hook` and `cta` optional string fields, following the same pattern as `title`, `discountedPriceDisplay`, and `badgeText`.

#### Scenario: CampaignAdjustments includes hook and cta

- **WHEN** inspecting `CampaignAdjustments`
- **THEN** the type SHALL include `hook?: string` and `cta?: string`
- **AND** existing fields SHALL remain unchanged
