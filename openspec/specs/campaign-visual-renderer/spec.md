> **Purpose**: This spec defines the CampaignRenderer component that visually composes a CampaignSpec into a fixed 1080×1080 reference layout for browser preview. Phase 4.2 rewrote the renderer to implement the `produto-oferta-comercial` template per the 4.2.0 Commercial Art Direction contract. Phase 4.3 designated the CampaignRenderer as legacy/fallback — it is no longer the primary output path for agency-grade campaign art.

## Requirements

### Requirement: CampaignRenderer renders a fixed 1080×1080 reference composition

The system SHALL provide a `CampaignRenderer` React component that renders a fixed 1080×1080 reference composition from a `CampaignSpec` + `StoreIdentitySnapshot` + `productImageUrl`. The composition SHALL follow the zone layout, hierarchy, image treatment, price block, CTA styling, and store identity rules defined in the 4.2.0 Commercial Art Direction contract, which takes precedence over general `CAMPAIGN_VISUAL_SYSTEM.md` rules where specified.

The component SHALL be pure (no side effects, no state beyond logo onError, no API calls). It SHALL receive all data via props and render solely based on those props.

The component SHALL scale responsively in the browser while preserving the square aspect ratio, zone hierarchy, and visual balance.

#### Scenario: Renders commercial composition from valid props

- **WHEN** `CampaignRenderer` receives a valid `CampaignSpec`, `StoreIdentitySnapshot`, and `productImageUrl`
- **THEN** the component SHALL render the `produto-oferta-comercial` template composition
- **AND** the composition SHALL include: product image zone with professional treatment, hook text, badge, product name, original price (strikethrough if present), discounted price as visual hero, CTA as campaign element, and store identity
- **AND** the composition SHALL NOT use the Phase 4.1 stacked layout

#### Scenario: Responsive scaling preserves aspect ratio

- **WHEN** the browser viewport is narrower than 1080px
- **THEN** the composition SHALL scale down responsively
- **AND** the aspect ratio SHALL remain 1:1
- **AND** all content SHALL remain within safe zones

#### Scenario: Missing product image shows explicit error

- **WHEN** `productImageUrl` is null or the image fails to load (PreviewPage detects failure upstream)
- **THEN** the component SHALL render an explicit error state indicating the product image is unavailable
- **AND** no placeholder or fallback image SHALL be rendered
- **AND** the campaign SHALL NOT be considered publishable

### Requirement: Product image zone

The product image SHALL be integrated into the composition with professional visual treatment as defined in the 4.2.0 contract. The image SHALL use `object-fit: contain` by default, with `cover` reserved for lifestyle/contextual images. No gradient overlay at the image→text transition — replaced by a subtle shadow divider.

#### Scenario: Product image with professional treatment

- **WHEN** a valid product image URL is provided
- **THEN** the image SHALL render with `object-fit: contain` (default)
- **AND** the image SHALL be centered and not distorted

#### Scenario: Missing product image shows explicit error

- **WHEN** `productImageUrl` is null
- **THEN** the component SHALL render an error state indicating the product image is unavailable
- **AND** no placeholder or fallback image SHALL be rendered

### Requirement: Badge zone

A promotional badge SHALL render in the top-right corner of the composition. Styling follows the 4.2.0 contract. If no badge text is provided, the badge zone SHALL be omitted (no empty space).

#### Scenario: Badge renders in top-right corner

- **WHEN** `offer.badge_text` is provided
- **THEN** a pill-shaped badge SHALL appear in the top-right corner
- **AND** the badge SHALL display the badge text in white on the accent color background

#### Scenario: No badge text omits badge

- **WHEN** `offer.badge_text` is empty or null
- **THEN** no badge SHALL be rendered
- **AND** no empty space SHALL replace the badge

### Requirement: Product name zone

The product name SHALL render centered in the composition, following `CAMPAIGN_VISUAL_SYSTEM.md` §3.4 typography rules: Poppins 700, slate-800 color, center-aligned, max 2 lines. If the name exceeds 40 characters, font size SHALL reduce from 42px to 36px.

#### Scenario: Short product name renders at base size

- **WHEN** `offer.product_name` is 40 characters or fewer
- **THEN** the product name SHALL render at 42px, Poppins 700, center-aligned

#### Scenario: Long product name reduces font size

- **WHEN** `offer.product_name` exceeds 40 characters
- **THEN** the font size SHALL reduce to 36px

### Requirement: Price zone

The discounted price SHALL render as the most visually prominent text element, using Poppins 800 (extra-bold) at 56px. The price color SHALL use the resolved accent color. Font size supersedes the Phase 4.1 rules (52px with original, 44px without) — the 4.2.0 contract defines a single hero size.

If an original price is provided, it SHALL appear above the discounted price as strikethrough text in slate-400 at 24px italic.

#### Scenario: Both prices render with strikethrough

- **WHEN** `offer.original_price_display` is provided
- **THEN** the original price SHALL render above the discounted price with line-through decoration

#### Scenario: Only discounted price renders

- **WHEN** `offer.original_price_display` is null
- **THEN** only the discounted price SHALL render at 56px (hero size)

### Requirement: Hook zone (NEW)

The hook/benefício text from `commercial_copy.hook` SHALL render as a secondary highlight in the composition. Its position, size, and styling SHALL follow the 4.2.0 contract — italic 24px Open Sans, less prominent than the price.

#### Scenario: Hook renders as secondary highlight

- **WHEN** `commercial_copy.hook` is provided
- **THEN** the hook SHALL render in a position and style defined by the 4.2.0 contract
- **AND** the hook SHALL be less prominent than the price but visible as a distinct element

#### Scenario: Empty hook hides zone

- **WHEN** `commercial_copy.hook` is empty or null
- **THEN** no hook zone SHALL be rendered
- **AND** remaining elements SHALL adjust without empty space

### Requirement: Description zone

Description/subtitle is NOT rendered in the `produto-oferta-comercial` template. The hook/benefício serves as the primary persuasive text below the price. Reserved for future templates.

### Requirement: CTA zone

A CTA element SHALL render as an integrated campaign element — not as a generic UI button. It SHALL be a visual `<div>` pill with `rounded-full`, white text, Poppins 700 at 22px, background using the resolved accent color. The CTA SHALL NOT be interactive: no `cursor-pointer`, no hover effects, no focus ring, no `disabled` attribute.

The CTA text SHALL come from `commercial_copy.cta`. Default fallback if missing: "Aproveite Agora!".

#### Scenario: CTA renders as campaign element

- **WHEN** `commercial_copy.cta` is provided
- **THEN** the CTA SHALL render as a campaign element (pill shape, integrated into composition)
- **AND** the CTA SHALL NOT render as a browser-native interactive button
- **AND** the styling SHALL follow the 4.2.0 contract

#### Scenario: Missing CTA uses fallback

- **WHEN** `commercial_copy.cta` is empty or null
- **THEN** the CTA SHALL render with "Aproveite Agora!"

### Requirement: Store identity zone

The store identity SHALL render at the bottom center of the composition. Positioning and styling follow the 4.2.0 contract: store name at 16px Open Sans 500.

The priority for the store identity zone SHALL be:
1. **Logo** (`storeIdentity.logoUrl`) — if provided, renders as circular 40×40px above store name
2. **Visual signature** (`storeIdentity.visualSignatureUrl`) — if no logo but visual signature exists, renders the visual signature asset as the sole identity element; the store name text below is OMITTED because the visual signature already contains the store name
3. **Initials fallback** — if neither logo nor visual signature available, show initials circle + store name text

#### Scenario: Store identity renders with logo (unchanged)

- **WHEN** `storeIdentity.logoUrl` is provided and loads successfully
- **THEN** a circular 40×40px logo SHALL render above the store name
- **AND** the store name SHALL render in Open Sans 500, 16px, slate-500

#### Scenario: Store identity renders with visual signature

- **WHEN** `storeIdentity.logoUrl` is null
- **AND** `storeIdentity.visualSignatureUrl` is provided
- **THEN** the visual signature asset SHALL render as the sole identity element
- **AND** the store name text SHALL NOT render below it (avoids duplication)

#### Scenario: Store identity renders with initials fallback (unchanged)

- **WHEN** `storeIdentity.logoUrl` is null
- **AND** `storeIdentity.visualSignatureUrl` is null
- **THEN** a circular fallback SHALL render with the store initials via `getStoreInitials()`
- **AND** the fallback SHALL use the brand or accent color as background with white text

#### Scenario: Logo image fails to load (unchanged)

- **WHEN** `storeIdentity.logoUrl` is provided but the image fails to load
- **THEN** the initials fallback SHALL render using the brand color

### Requirement: CampaignRenderer accepts visual signature parameters

The `CampaignRenderer` SHALL accept `visualSignatureUrl` and `visualSignatureType` as optional fields in its input props.

#### Scenario: Visual signature passed to renderer

- **WHEN** `CampaignRenderer` receives `visualSignatureUrl` in its props
- **AND** `storeIdentity.logoUrl` is null
- **THEN** the renderer SHALL display the visual signature in the store identity zone

### Requirement: Unsupported layout_preset fallback

Unchanged from Phase 4.1 — unsupported presets fall back to the default template. The `produto-oferta-comercial` layout_preset is the only supported value in Phase 4.2.

### Requirement: CampaignRenderer as legacy fallback (ADDED Phase 4.3)

The `CampaignRenderer` SHALL remain available as a legacy/fallback renderer in Phase 4.3. It SHALL NOT be the primary output path for AI-native campaign generation. No existing code SHALL be removed, refactored, or invalidated.

The component SHALL continue to function exactly as specified when called directly. The deprecation is at the architectural level, not the component level.

#### Scenario: CampaignRenderer still renders on demand

- **WHEN** `CampaignRenderer` is called with valid props (e.g., from the legacy toggle in preview)
- **THEN** it SHALL render the `produto-oferta-comercial` template exactly as in Phase 4.2
- **AND** no functionality SHALL be removed

#### Scenario: CampaignRenderer is not the default

- **WHEN** a campaign has an AI-generated image available
- **THEN** the preview page SHALL NOT use `CampaignRenderer` as the default rendering mode

### Requirement: Brand profile colors as priority for store identity zone

The `CampaignRenderer` SHALL attempt to resolve brand colors from the active brand profile before falling back to segment-based colors. The resolution order SHALL be:

1. `brand_colors_chosen` from active brand profile (highest priority) — use the first color as the accent color
2. `safe_color_tokens` from active brand profile — fallback within profile
3. Store `brand_color` column — legacy fallback
4. Segment-based color from `resolveStoreIdentity` — lowest priority

The brand profile colors SHALL affect the same visual elements as `brand_color` currently does: badges, CTAs, accent details. The background, text, and structural elements SHALL remain unaffected.

#### Scenario: Brand profile colors used when available

- **WHEN** the campaign is rendered for a store with a synced brand profile containing brand_colors_chosen
- **THEN** the renderer SHALL use the first color from brand_colors_chosen as the campaign accent color
- **AND** it SHALL NOT use the segment-based fallback

#### Scenario: No brand profile uses segment fallback

- **WHEN** the campaign is rendered for a store without a synced brand profile
- **THEN** the renderer SHALL use the existing fallback chain (brand_color → segment color)

### Requirement: Logo variant selection for render

The system SHALL resolve the logo variant at the `StoreIdentitySnapshot` level via `resolveStoreIdentity`, preferring the most faithful representation of the original logo. The resolution order SHALL be:

1. `normalized` — transparent canvas, most faithful to original, preferred for all render contexts
2. `original` — fallback when normalized unavailable
3. `on_dark` — secondary fallback when original unavailable
4. If no logo asset exists, fall back to visual signature or store name text

The resolved logo URL SHALL be passed to the renderer as the `logoVariantUrl` within the brand profile snapshot.

The `normalized` variant is preferred over `on_dark` because:
- It preserves the logo with transparency, suitable for any canvas background
- `on_dark` adds a dark background box that conflicts with the renderer's own dark theme background
- The Campaign Director receives the real logo as an image reference and can position it intelligently

#### Scenario: normalized variant used as primary

- **WHEN** the campaign identity is resolved for a store with active brand assets
- **AND** an active normalized variant exists
- **THEN** the system SHALL use the normalized variant URL as the primary logo

#### Scenario: Fallback chain works correctly

- **WHEN** the campaign identity is resolved
- **AND** normalized variant is not available
- **THEN** the system SHALL fall back to original
- **AND** if original is also unavailable, SHALL use on_dark
- **AND** if no logo exists, SHALL fall through to visual signature or store name text
