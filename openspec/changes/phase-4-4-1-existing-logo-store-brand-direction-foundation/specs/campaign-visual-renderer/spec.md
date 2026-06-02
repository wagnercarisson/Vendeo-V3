## ADDED Requirements

### Requirement: Brand profile colors as priority for store identity zone

The `CampaignRenderer` SHALL attempt to resolve brand colors from the active brand profile before falling back to segment-based colors. The resolution order SHALL be:

1. `brand_colors_chosen` from active brand profile (highest priority) — use the first color as the accent color
2. `safe_color_tokens` from active brand profile — fallback within profile
3. Store `brand_color` column — legacy fallback
4. Segment-based color from `resolveStoreIdentity` — lowest priority

The brand profile colors SHALL affect the same visual elements as `brand_color` currently does: badges, CTAs, accent details. The background, text, and structural elements SHALL remain unaffected.

**Reason**: The brand profile provides richer, store-specific color context than the simple segment fallback. This is the minimal integration needed to prove the brand profile value in the campaign pipeline.

#### Scenario: Brand profile colors used when available

- **WHEN** the campaign is rendered for a store with a synced brand profile containing brand_colors_chosen
- **THEN** the renderer SHALL use the first color from brand_colors_chosen as the campaign accent color
- **AND** it SHALL NOT use the segment-based fallback

#### Scenario: No brand profile uses segment fallback

- **WHEN** the campaign is rendered for a store without a synced brand profile
- **THEN** the renderer SHALL use the existing fallback chain (brand_color → segment color)

### Requirement: Logo variant selection for render

The `CampaignRenderer` SHALL resolve the logo variant appropriate for the rendering context. For dark theme rendering (default Vendeo theme), the renderer SHALL:

1. Look for active `on_dark` variant in store_brand_assets
2. If unavailable, fall back to `original` variant
3. If unavailable, fall back to `normalized` variant
4. If no logo asset exists, fall back to visual signature or store name text

The resolved logo URL SHALL be passed to the renderer component as the `storeLogoUrl` prop.

#### Scenario: on_dark variant used for dark theme

- **WHEN** the campaign is rendered on dark theme
- **AND** an active on_dark variant exists in store_brand_assets
- **THEN** the renderer SHALL use the on_dark variant URL as storeLogoUrl

#### Scenario: Fallback to original when variant unavailable

- **WHEN** the campaign is rendered on dark theme
- **AND** on_dark variant is not available but original is
- **THEN** the renderer SHALL use the original variant URL as storeLogoUrl
