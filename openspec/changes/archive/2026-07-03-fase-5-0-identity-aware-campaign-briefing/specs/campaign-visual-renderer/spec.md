## MODIFIED Requirements

### Requirement: Store identity zone

The store identity SHALL render at the bottom center of the composition. Positioning and styling follow the 4.2.0 contract: store name at 16px Open Sans 500.

The priority for the store identity zone SHALL be (updated):
1. **Signature logo** (`signature.type = 'logo'` and `signature.url` present) — renders as circular 40×40px above store name
2. **Visual signature** (`signature.type = 'visual_signature'` and `signature.url` present) — renders the VS asset as the sole identity element; store name text below is OMITTED
3. **Initials fallback** — if `signature.url` is null, show initials circle + store name text

The renderer SHALL read from `storeIdentity.signature.url` and `storeIdentity.signature.type` instead of separate `logoUrl` and `visualSignatureUrl`.

#### Scenario: Store identity renders with logo via signature

- **WHEN** `storeIdentity.signature.type = 'logo'` and `storeIdentity.signature.url` is provided
- **THEN** a circular 40×40px logo SHALL render above the store name
- **AND** the store name SHALL render in Open Sans 500, 16px, slate-500

#### Scenario: Store identity renders with visual signature via signature

- **WHEN** `storeIdentity.signature.type = 'visual_signature'` and `storeIdentity.signature.url` is provided
- **THEN** the visual signature asset SHALL render as the sole identity element
- **AND** the store name text SHALL NOT render below it

#### Scenario: Store identity renders with initials fallback

- **WHEN** `storeIdentity.signature.url` is null
- **THEN** a circular fallback SHALL render with the store initials via `getStoreInitials()`
- **AND** the fallback SHALL use the brand or accent color as background with white text

#### Scenario: Logo image fails to load

- **WHEN** `storeIdentity.signature.type = 'logo'` and `storeIdentity.signature.url` is provided but the image fails to load
- **THEN** the initials fallback SHALL render using the brand color

### Requirement: CampaignRenderer accepts visual signature parameters

The `CampaignRenderer` SHALL use `storeIdentity.signature.url` and `storeIdentity.signature.type` as the unified identity asset fields. The separate `logoUrl`, `visualSignatureUrl`, and `visualSignatureType` props SHALL be replaced.

#### Scenario: Renderer uses signature fields

- **WHEN** `CampaignRenderer` receives a `StoreIdentitySnapshot` with `signature.url` and `signature.type`
- **THEN** the renderer SHALL display the identity asset according to `signature.type`
- **AND** SHALL NOT reference `logoUrl` or `visualSignatureUrl`

### Requirement: Logo variant selection for render

The store identity resolution SHALL select the logo variant via `resolveStoreIdentity` (signature resolution), not at render time. The selection order SHALL be: `normalized` → `original` → `on_dark` (first available active variant wins). The renderer SHALL receive the final asset URL through `StoreIdentitySnapshot.signature.url`. No separate variant selection logic SHALL exist in the renderer.

#### Scenario: Logo variant resolved before render with priority order

- **WHEN** a store has multiple logo variants
- **THEN** `resolveStoreIdentity` SHALL select in order: normalized, original, on_dark
- **AND** the renderer SHALL receive the selected URL via `signature.url`
- **AND** SHALL NOT perform variant selection at render time
