> **Purpose**: This spec defines the commercial campaign template — the single `produto-oferta-comercial` layout that replaces the current stacked renderer with a professional, publishable composition.

## Requirements

### Requirement: Single template replaces stacked layout

The system SHALL implement a single `produto-oferta-comercial` template as the only layout for campaign rendering. The template SHALL replace the current stacked/amateur layout with a professional composition defined by the Commercial Art Direction contract (4.2.0).

The template SHALL follow the zone layout, hierarchy, typography scale, color palette, image treatment, price block style, CTA treatment, and store identity rules defined in the 4.2.0 contract, which takes precedence over general `CAMPAIGN_VISUAL_SYSTEM.md` rules where specified.

#### Scenario: Template renders as single composition

- **WHEN** `CampaignRenderer` receives valid props
- **THEN** the component SHALL render using the `produto-oferta-comercial` template
- **AND** no alternative template selection SHALL be available
- **AND** no variation toggle SHALL be rendered

#### Scenario: Stacked layout no longer used

- **WHEN** any campaign is rendered
- **THEN** the composition SHALL NOT use the Phase 4.1 stacked layout (55% image / 45% sequential text zones)
- **AND** the composition SHALL use the hierarchy and zone distribution defined in the 4.2.0 contract

### Requirement: Visual hierarchy follows art direction contract

The template SHALL implement a clear visual hierarchy where:
- The product image is the primary visual anchor
- The discounted price is the most prominent text element
- The hook/benefício is displayed as a secondary highlight
- The CTA reads as a campaign element, not a UI button
- The store identity is present but discreet

#### Scenario: Price is visual hero

- **WHEN** the campaign is rendered
- **THEN** the discounted price SHALL be the most visually prominent text element in the composition
- **AND** the accent color resolution priority SHALL be defined by the 4.2.0 Commercial Art Direction contract

#### Scenario: Hook appears in composition

- **WHEN** `commercial_copy.hook` is provided
- **THEN** the hook text SHALL appear as a visible element in the composition
- **AND** its position and styling SHALL follow the 4.2.0 contract

### Requirement: Background with visual treatment

The composition background SHALL use colors derived from the store segment palette (`SEGMENT_PALETTES`). Visual treatment beyond solid color is deferred to a future phase.

#### Scenario: Segment background

- **WHEN** the campaign is rendered
- **THEN** the background color SHALL be resolved from `resolveCampaignBackgroundColor(storeSegment)`

#### Scenario: Fallback background renders solid

- **WHEN** no segment is matched
- **THEN** the background SHALL fall back to `#FFFFFF`

### Requirement: Product image treatment

The product image SHALL be integrated into the composition with professional treatment: `object-fit: contain` by default, with `cover` reserved for lifestyle/contextual images. No gradient overlay at the image→text transition.

#### Scenario: Image renders with treatment

- **WHEN** a valid `productImageUrl` is provided
- **THEN** the image SHALL be displayed with `object-fit: contain` (default)
- **AND** the image SHALL NOT be distorted or stretched

#### Scenario: Missing image shows explicit error

- **WHEN** `productImageUrl` is null, expired, or fails to load
- **THEN** the image zone SHALL display an explicit error state
- **AND** no placeholder or fallback image SHALL be used
- **AND** the campaign SHALL NOT pass the publishability gate without a real product image

### Requirement: CTA as campaign element

The CTA SHALL render as an integrated campaign element — not as a generic disabled UI button. It SHALL be a visual `<div>` pill, non-interactive, with no cursor/hover/focus states.

#### Scenario: CTA renders with campaign styling

- **WHEN** the campaign is rendered
- **THEN** the CTA SHALL appear as a visual campaign element (pill, integrated into composition)
- **AND** no browser-native button styling SHALL be visible
- **AND** the CTA SHALL be visually distinct from form/interactive UI elements

### Requirement: Store identity with professional presentation

The store identity (logo or initials + store name) SHALL render at the bottom of the composition with professional presentation, integrated into the overall design.

#### Scenario: Logo renders professionally

- **WHEN** `storeIdentity.logoUrl` is provided and loads successfully
- **THEN** the logo SHALL render as a circular element (40×40px) above the store name
- **AND** the presentation SHALL follow the 4.2.0 contract positioning and styling

#### Scenario: No logo renders initials fallback

- **WHEN** `storeIdentity.logoUrl` is null or fails to load
- **THEN** a circular initials fallback SHALL render using the brand color or accent color
- **AND** the initials SHALL follow `getStoreInitials()` rules
- **AND** the presentation SHALL look professional — not like a broken image placeholder

### Requirement: Fallback safety for missing data

The template SHALL handle missing data gracefully without breaking the composition:

| Missing Data | Behavior |
|---|---|
| productImageUrl | Error state in image zone (no publishable art) |
| logoUrl | Initials fallback, brand/accent color |
| brandColor | Segment palette accent → #22C55E |
| original_price_display | Only discounted price renders |
| badge_text | No badge rendered, no empty space |
| subtitle | Not rendered in `produto-oferta-comercial` template |
| cta | "Aproveite Agora!" fallback |
| hook | Hook zone hidden, remaining elements adjust |

#### Scenario: Multiple fallbacks stack gracefully

- **WHEN** multiple data fields are missing
- **THEN** the composition SHALL still render without layout breakage
- **AND** all visible elements SHALL remain within safe zones
- **AND** no overlapping text or broken layout SHALL occur

### Requirement: Renderer preserves 1080x1080 responsive container

The CampaignRenderer SHALL preserve the responsive 1080x1080 container (`w-full max-w-[1080px] aspect-[1/1]`) for browser preview.

#### Scenario: Container scales responsively

- **WHEN** the viewport is narrower than 1080px
- **THEN** the container SHALL scale down while preserving 1:1 aspect ratio
- **AND** no content SHALL overflow the container bounds
