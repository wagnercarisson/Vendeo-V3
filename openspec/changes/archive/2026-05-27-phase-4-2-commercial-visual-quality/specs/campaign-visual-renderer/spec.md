> **Purpose**: Delta spec for the CampaignRenderer — the component is rewritten to implement the `produto-oferta-comercial` template, replacing the stacked layout with a professional commercial composition while preserving the public interface.

## MODIFIED Requirements

### Requirement: CampaignRenderer renders a fixed 1080×1080 reference composition

The system SHALL provide a `CampaignRenderer` React component that renders a fixed 1080×1080 reference composition from a `CampaignSpec` + `StoreIdentitySnapshot` + `productImageUrl`. The composition SHALL follow the zone layout, hierarchy, image treatment, price block, CTA styling, and store identity rules defined in the 4.2.0 Commercial Art Direction contract.

The component SHALL be pure (no side effects, no state beyond logo onError, no API calls). It SHALL receive all data via props and render solely based on those props.

The component SHALL scale responsively in the browser while preserving the square aspect ratio, zone hierarchy, and visual balance.

#### Scenario: Renders commercial composition from valid props

- **WHEN** `CampaignRenderer` receives a valid `CampaignSpec`, `StoreIdentitySnapshot`, and `productImageUrl`
- **THEN** the component SHALL render the `produto-oferta-comercial` template composition
- **AND** the composition SHALL include: product image zone with professional treatment, hook text, badge, product name, original price (strikethrough if present), discounted price as visual hero, description, CTA as campaign element, and store identity
- **AND** the composition SHALL NOT use the Phase 4.1 stacked layout

### Requirement: Product image zone

The product image SHALL be integrated into the composition with professional visual treatment as defined in the 4.2.0 contract. The image zone dimensions and treatment (contain, crop, overlay, shadow, vignette) SHALL follow the 4.2.0 contract rather than the fixed 55% height rule.

#### Scenario: Product image with professional treatment

- **WHEN** a valid product image URL is provided
- **THEN** the image SHALL render with the treatment defined in the 4.2.0 contract
- **AND** the image SHALL be centered and not distorted

#### Scenario: Missing product image shows explicit error

- **WHEN** `productImageUrl` is null (PreviewPage detected load failure upstream)
- **THEN** the component SHALL render an error state indicating the product image is unavailable
- **AND** no placeholder or fallback image SHALL be rendered
- **AND** the campaign SHALL NOT be considered publishable

### Requirement: Badge zone

Badge behavior remains unchanged, but positioning and visual styling SHALL follow the 4.2.0 Commercial Art Direction contract.

### Requirement: Product name zone

Product name behavior remains unchanged, but positioning and visual styling SHALL follow the 4.2.0 Commercial Art Direction contract.

### Requirement: Price zone

The discounted price SHALL render as the most visually prominent text element, using Poppins 700. The price color SHALL use the resolved accent color. The price block presentation (size, styling, background treatment, positioning) SHALL follow the 4.2.0 contract.

If an original price is provided, it SHALL appear as strikethrough text. The phase 4.1 font size rules (52px with original, 44px without) are superseded by the 4.2.0 contract sizes.

#### Scenario: Price is visual hero of composition

- **WHEN** the composition is rendered
- **THEN** the discounted price SHALL be the most visually prominent text element
- **AND** the price SHALL render with the styling defined in the 4.2.0 contract

### Requirement: Hook zone (NEW)

The hook/benefício text from `commercial_copy.hook` SHALL render as a secondary highlight in the composition. Its position, size, and styling SHALL follow the 4.2.0 contract.

#### Scenario: Hook renders as secondary highlight

- **WHEN** `commercial_copy.hook` is provided
- **THEN** the hook SHALL render in a position and style defined by the 4.2.0 contract
- **AND** the hook SHALL be less prominent than the price but visible as a distinct element

#### Scenario: Empty hook hides zone

- **WHEN** `commercial_copy.hook` is empty or null
- **THEN** no hook zone SHALL be rendered
- **AND** remaining elements SHALL adjust without empty space

### Requirement: Description zone

Description behavior remains unchanged, but positioning and visual styling SHALL follow the 4.2.0 Commercial Art Direction contract.

### Requirement: CTA button zone

A CTA element SHALL render as an integrated campaign element (not a generic UI button). Its styling, position, and visual weight SHALL follow the 4.2.0 contract. The CTA background color SHALL use the resolved accent color. Fallback: `#22C55E`.

The CTA text SHALL come from `commercial_copy.cta`. Default fallback if missing: "Aproveite Agora!".

#### Scenario: CTA renders as campaign element

- **WHEN** `commercial_copy.cta` is provided
- **THEN** the CTA SHALL render as a campaign element (pill shape, integrated into composition)
- **AND** the CTA SHALL NOT render as a browser-native interactive button
- **AND** the styling SHALL follow the 4.2.0 contract

### Requirement: Store identity zone

Store identity behavior remains unchanged, but positioning and visual styling SHALL follow the 4.2.0 Commercial Art Direction contract.

### Requirement: Unsupported layout_preset fallback

Unchanged from Phase 4.1 — unsupported presets fall back to the default template.

## REMOVED Requirements

### Requirement: Gradient overlay separates image from text

**Reason**: The gradient overlay at the image → text transition is replaced by the professional image treatment defined in the 4.2.0 contract. The new template handles the image→text transition differently (overlay, shadow, or contained treatment).

### Requirement: CTA button zone uses disabled button element

**Reason**: The CTA is no longer rendered as a `<button disabled>` element. It becomes a visual campaign element. The "disabled" UI state is irrelevant for a display-only component.

## ADDED Requirements

### Requirement: All renderer specs frozen during 4.2.0

The CampaignRenderer implementation SHALL NOT begin before the 4.2.0 Commercial Art Direction contract is completed and approved. The contract output SHALL define the exact zone layout, hierarchy, image treatment, price block, CTA treatment, and store identity positioning that the renderer implements.

#### Scenario: Implementation blocked on 4.2.0

- **WHEN** the 4.2.0 contract is not yet complete
- **THEN** no changes SHALL be made to `campaign-renderer.tsx`
- **AND** only content/adjustment changes (4.2.1) MAY proceed
