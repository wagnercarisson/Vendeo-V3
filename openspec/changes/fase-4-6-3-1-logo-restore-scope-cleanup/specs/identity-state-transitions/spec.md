> **Purpose**: Delta spec for identity-state-transitions capability — update profile preservation rationale from "future restore" to "visual direction fallback."

## MODIFIED Requirements

### Requirement: Profile preservation on text_only

When transitioning TO `text_only` (via logo removal or VS removal), the system SHALL NOT delete the existing `store_brand_profile`. The synced profile SHALL remain `synced` as a fallback visual direction. It SHALL only be marked `outdated` when a new valid profile replaces it (e.g., new logo upload, new VS approval).

**Change:** 
- Removed "preserving it for future restore" — logo restore is no longer supported
- Clarified that profile stays `synced` on removal, not `outdated`
- `outdated` only happens when a new profile replaces the fallback

#### Scenario: Logo removal preserves profile as synced fallback

- **WHEN** logo is removed (transition to text_only)
- **THEN** the previously synced profile SHALL remain `synced`
- **AND** the profile record SHALL NOT be deleted
- **AND** the profile SHALL serve as a fallback visual direction
