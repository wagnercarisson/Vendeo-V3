## ADDED Requirements

### Requirement: Preview page at /campaign/preview

The system SHALL provide a route at `/campaign/preview` that displays the rendered campaign art and a quick adjustments panel. The page SHALL read the preview payload from sessionStorage on mount.

The page SHALL follow the visual and UX rules in `openspec/design-system/pages/campaign-preview.md`.

#### Scenario: Preview route reads payload from sessionStorage

- **WHEN** a user navigates to `/campaign/preview`
- **THEN** the page SHALL read the `PreviewPayload` from sessionStorage
- **AND** render the `CampaignRenderer` with the stored `campaignSpec`, `storeIdentity`, and `productImageUrl`

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

### Requirement: Quick adjustments panel

The adjustments panel SHALL provide constrained fields for local editing:
- **Title**: text input, overrides `commercial_copy.title`
- **Discounted price**: BRL currency input, overrides `offer.discounted_price_display` only — SHALL NOT recalculate numeric price fields
- **Badge text**: text input, max 20 characters, overrides `offer.badge_text`

All adjustments SHALL update the rendered art locally without API calls. No free-form editing of layout, fonts, colors, or element positions SHALL be allowed.

Each adjusted field SHALL have an undo button that resets the field to the original spec value.

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

#### Scenario: Undo resets adjusted field

- **WHEN** the user clicks undo on any adjusted field
- **THEN** that field SHALL revert to the original value from the spec
- **AND** the CampaignRenderer SHALL re-render with the original value
