## ADDED Requirements

### Requirement: CampaignRenderer renders a fixed 1080×1080 reference composition

The system SHALL provide a `CampaignRenderer` React component that renders a fixed 1080×1080 reference composition from a `CampaignSpec` + `StoreIdentitySnapshot` + `productImageUrl`. The composition SHALL follow the zone layout, typography scale, color palette, and safe area rules defined in `CAMPAIGN_VISUAL_SYSTEM.md`.

The component SHALL be pure (no side effects, no state, no API calls). It SHALL receive all data via props and render solely based on those props.

The component SHALL scale responsively in the browser while preserving the square aspect ratio, zone hierarchy, and visual balance.

#### Scenario: Renders complete composition from valid props

- **WHEN** `CampaignRenderer` receives a valid `CampaignSpec`, `StoreIdentitySnapshot`, and `productImageUrl`
- **THEN** the component SHALL render a square composition with: product image zone, badge, product name, original price (strikethrough if present), discounted price, description, CTA pill button, and store identity

#### Scenario: Responsive scaling preserves aspect ratio

- **WHEN** the browser viewport is narrower than 1080px
- **THEN** the composition SHALL scale down responsively
- **AND** the aspect ratio SHALL remain 1:1
- **AND** all content SHALL remain within safe zones

#### Scenario: Missing product image shows explicit error

- **WHEN** `productImageUrl` is null or the image fails to load
- **THEN** the component SHALL render an error state indicating the product image is unavailable
- **AND** no placeholder or empty image zone SHALL be rendered

### Requirement: Product image zone

The product image SHALL occupy approximately 55% of the composition height (594px at 1080×1080). The image SHALL use `object-fit: cover` centered on the image content. A subtle gradient overlay SHALL transition from the image zone to the text zone below.

#### Scenario: Product image fills the image zone

- **WHEN** a valid product image URL is provided
- **THEN** the image SHALL fill the top ~55% of the composition
- **AND** the image SHALL be centered and cropped to fill the area without distortion

#### Scenario: Gradient overlay separates image from text

- **WHEN** the composition is rendered
- **THEN** a linear gradient overlay SHALL transition from transparent at the top to semi-transparent dark at the bottom of the image zone

### Requirement: Badge zone

A promotional badge SHALL render in the top-right corner of the composition, following `CAMPAIGN_VISUAL_SYSTEM.md` §3.3. The badge SHALL use the accent color from the visual parameters or segment palette. If no badge text is provided, the badge zone SHALL be omitted (no empty space).

#### Scenario: Badge renders in top-right corner

- **WHEN** `offer.badge_text` is provided
- **THEN** a pill-shaped badge SHALL appear in the top-right corner
- **AND** the badge SHALL display the badge text in Poppins 700, white, on the accent color background

#### Scenario: No badge text omits badge

- **WHEN** `offer.badge_text` is empty or null
- **THEN** no badge SHALL be rendered
- **AND** no empty space SHALL replace the badge

### Requirement: Product name zone

The product name SHALL render centered below the image zone, following `CAMPAIGN_VISUAL_SYSTEM.md` §3.4 typography rules. The name SHALL use Poppins 700, slate-800 color, center-aligned, max 2 lines. If the name exceeds 40 characters, font size SHALL reduce.

#### Scenario: Short product name renders at base size

- **WHEN** `offer.product_name` is 40 characters or fewer
- **THEN** the product name SHALL render at 42px, Poppins 700, center-aligned

#### Scenario: Long product name reduces font size

- **WHEN** `offer.product_name` exceeds 40 characters
- **THEN** the font size SHALL reduce to 36px

### Requirement: Price zone

The discounted price SHALL render as the most visually prominent text element, using Poppins 700 at 52px. The price color SHALL use the resolved accent color from `visual_parameters`, segment palette, or store brand color. Fallback: `#22C55E`. If an original price is provided, it SHALL appear above the discounted price as strikethrough text in slate-400 at 28px.

#### Scenario: Both prices render with strikethrough

- **WHEN** `offer.original_price_display` is provided
- **THEN** the original price SHALL render above the discounted price with line-through decoration

#### Scenario: Only discounted price renders larger

- **WHEN** `offer.original_price_display` is null
- **THEN** only the discounted price SHALL render
- **AND** it SHALL render at 44px

### Requirement: Description zone

The description text SHALL render below the price zone, centered, in Open Sans 400 at 24px, slate-600, max 2 lines. If no description is provided, this zone SHALL be hidden and the CTA zone SHALL shift up by approximately 50px.

#### Scenario: Description renders below price

- **WHEN** `commercial_copy.subtitle` is provided
- **THEN** the description SHALL render centered below the price, in Open Sans 400, max 2 lines

#### Scenario: Empty description hides zone

- **WHEN** `commercial_copy.subtitle` is empty or null
- **THEN** the description zone SHALL be hidden
- **AND** the CTA zone SHALL shift up by approximately 50px

### Requirement: CTA button zone

A CTA pill button SHALL render centered below the description or price zone. The button SHALL follow `CAMPAIGN_VISUAL_SYSTEM.md` §3.7: pill shape, white text, Poppins 700 at 22px, subtle drop shadow. The CTA background color SHALL use the resolved accent color from `visual_parameters`, segment palette, or store brand color. Fallback: `#22C55E`.

The CTA text SHALL come from `commercial_copy.cta`. Default fallback if missing: "Aproveite Agora!".

#### Scenario: CTA renders as pill button

- **WHEN** `commercial_copy.cta` is provided
- **THEN** a pill-shaped button SHALL render centered with the CTA text in white on the accent color background
- **AND** the button SHALL have a subtle drop shadow

#### Scenario: Missing CTA uses fallback

- **WHEN** `commercial_copy.cta` is empty or null
- **THEN** the CTA button SHALL render with "Aproveite Agora!"

### Requirement: Store identity zone

The store identity SHALL render at the bottom center of the composition, following `CAMPAIGN_VISUAL_SYSTEM.md` §3.8. If a `logoUrl` is provided, a circular 40×40px logo SHALL appear above the store name. If no logo URL is provided, a circular fallback with the first 2 characters of the store name SHALL render using the brand color.

#### Scenario: Store identity renders with logo

- **WHEN** `storeIdentity.logoUrl` is provided
- **THEN** a circular 40×40px logo SHALL render above the store name
- **AND** the store name SHALL render in Open Sans 500, 18px, slate-500

#### Scenario: Store identity renders with initials fallback

- **WHEN** `storeIdentity.logoUrl` is null
- **THEN** a circular fallback SHALL render with the first 2 characters of the store name
- **AND** the fallback SHALL use the brand color as background with white text

#### Scenario: Logo image fails to load

- **WHEN** `storeIdentity.logoUrl` is provided but the image fails to load
- **THEN** the initials fallback SHALL render using the brand color
