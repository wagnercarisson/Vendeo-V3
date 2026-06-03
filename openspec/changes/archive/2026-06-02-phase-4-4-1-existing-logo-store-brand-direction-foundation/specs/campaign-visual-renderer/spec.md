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
