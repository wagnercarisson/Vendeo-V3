## MODIFIED Requirements

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

### Requirement: CampaignRenderer accepts visual signature parameters

The `CampaignRenderer` SHALL accept `visualSignatureUrl` and `visualSignatureType` as optional fields in its input props.

#### Scenario: Visual signature passed to renderer

- **WHEN** `CampaignRenderer` receives `visualSignatureUrl` in its props
- **AND** `storeIdentity.logoUrl` is null
- **THEN** the renderer SHALL display the visual signature in the store identity zone
