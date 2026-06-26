## MODIFIED Requirements

### Requirement: brand_colors_chosen isolation on logo upload

The system SHALL NOT populate `brand_colors_chosen` with `logo_colors_detected` during logo upload. The `brand_colors_chosen` field is reserved exclusively for colors explicitly chosen by the user via the color picker. The detected colors SHALL remain in `logo_colors_detected`, and the final campaign palette SHALL be consumed from `safe_color_tokens`.

When a synced brand profile is created from logo upload:
- If the previous synced profile had `brand_colors_chosen` with at least one valid HEX, the new profile SHALL preserve the same value
- If the previous synced profile had `brand_colors_chosen = []`, the new profile SHALL have `brand_colors_chosen = []`
- `manual_color_override` SHALL NOT be consulted for this decision

The logo upload endpoint code SHALL read the previous synced profile's `brand_colors_chosen` before creating the new profile and copy it to the new profile.

#### Scenario: brand_colors_chosen preserved on logo upload

- **WHEN** a synced brand profile is created from logo upload
- **AND** the previous synced profile has `brand_colors_chosen = ["#FF6600", null]`
- **THEN** the new profile SHALL have `brand_colors_chosen = ["#FF6600", null]`
- **AND** `manual_color_override` SHALL NOT be consulted

#### Scenario: brand_colors_chosen empty after upload when no prior choice

- **WHEN** a synced brand profile is created from logo upload
- **AND** the previous synced profile has `brand_colors_chosen = []`
- **THEN** the new profile SHALL have `brand_colors_chosen = []`
- **AND** `logo_colors_detected` SHALL contain the extracted colors
- **AND** `safe_color_tokens` SHALL contain the final palette

### Requirement: Logo upload flow — step 8b (updated)

During logo upload success flow, step 8b SHALL be updated:

**Before:**
```
Insert new profile with status = 'synced', source = 'logo_analysis',
active_logo_asset_id = originalAsset.id, metadata.input_snapshot populated,
brand_colors_chosen = []
```

**After:**
```
Insert new profile with status = 'synced', source = 'logo_analysis',
active_logo_asset_id = originalAsset.id, metadata.input_snapshot populated,
brand_colors_chosen = preserved from previous synced profile (or [] if none)
```

#### Scenario: brand_colors_chosen = [] in new profile for first upload

- **WHEN** a synced brand profile is created from logo upload
- **AND** there is no previous synced profile (first upload)
- **THEN** `brand_colors_chosen` SHALL be `[]`
- **AND** `logo_colors_detected` SHALL contain the extracted colors

#### Scenario: brand_colors_chosen preserved on re-upload

- **WHEN** a synced brand profile is created from logo re-upload
- **AND** the previous profile has `brand_colors_chosen = ["#FF6600", "#E8A040"]`
- **THEN** the new profile SHALL have `brand_colors_chosen = ["#FF6600", "#E8A040"]`
