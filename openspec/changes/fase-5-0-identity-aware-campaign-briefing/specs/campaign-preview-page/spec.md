## ADDED Requirements

### Requirement: Preview payload normalization for legacy format

`/campaign/preview` SHALL detect and normalize legacy `PreviewPayload` in sessionStorage. A legacy payload has `storeIdentity` without `identityState` and with `logoUrl`/`visualSignatureUrl` (pre-deploy format). The page SHALL normalize it to the new format by deriving state from available assets:

- If `logoUrl` is present → `identityState = 'logo'`, `signature = { url: logoUrl, type: 'logo' }`
- Else if `visualSignatureUrl` is present → `identityState = 'visual_signature'`, `signature = { url: visualSignatureUrl, type: 'visual_signature' }`
- Else → `identityState = 'text_only'`, `signature = { url: null, type: null }`

The page SHALL NOT crash when encountering a legacy payload. Normalization SHALL be applied silently.

#### Scenario: Legacy payload with logoUrl derives identityState logo

- **WHEN** a `PreviewPayload` in sessionStorage lacks `identityState`
- **AND** has `logoUrl` set
- **THEN** the page SHALL derive `identityState = 'logo'` and `signature = { url: logoUrl, type: 'logo' }`
- **AND** SHALL display the preview without crashing

#### Scenario: Legacy payload with visualSignatureUrl derives identityState visual_signature

- **WHEN** a `PreviewPayload` in sessionStorage lacks `identityState`
- **AND** has `visualSignatureUrl` set but no `logoUrl`
- **THEN** the page SHALL derive `identityState = 'visual_signature'` and `signature = { url: visualSignatureUrl, type: 'visual_signature' }`
- **AND** SHALL display the preview without crashing

#### Scenario: Legacy payload without assets derives identityState text_only

- **WHEN** a `PreviewPayload` in sessionStorage lacks `identityState`
- **AND** has neither `logoUrl` nor `visualSignatureUrl`
- **THEN** the page SHALL derive `identityState = 'text_only'` and `signature = { url: null, type: null }`
- **AND** SHALL display the preview without crashing
