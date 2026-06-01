## MODIFIED Requirements

### Requirement: Fallback for missing logo

When `logo_url` is `null` or empty, the store identity resolver SHALL check for an active visual signature before falling back to the store name text. The resolution order SHALL be:

1. `logo_url` (if provided)
2. Active visual signature `asset_url` (if exists)
3. Store `name` as textual fallback

#### Scenario: No logo URL checks visual signature first

- **WHEN** the store identity is resolved for a store with `logo_url = null`
- **AND** an active visual signature exists for that store
- **THEN** the resolver SHALL return the visual signature's `asset_url`
- **AND** the `visualSignatureType` SHALL be included in the resolved result

#### Scenario: No logo and no signature returns name fallback

- **WHEN** the store identity is resolved for a store with `logo_url = null`
- **AND** no active visual signature exists
- **THEN** the resolver SHALL return the store `name` as the fallback value
- **AND** no error SHALL be raised

### Requirement: Logo takes priority over visual signature

- **WHEN** `logo_url` is not null
- **THEN** the resolver SHALL return the logo regardless of any active visual signature
