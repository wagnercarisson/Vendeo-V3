## MODIFIED Requirements

### Requirement: Detect absence of logo on store save

After a store is saved (created or updated), the system SHALL check for active store_brand_assets before offering visual signature creation. If `store_brand_assets` has at least one active record with asset_type `logo`, the system SHALL NOT offer visual signature creation.

If there are no active store_brand_assets and no active visual signature, the system SHALL offer the option to create a visual signature.

**Reason**: With the introduction of store_brand_assets, logo existence is now determined by checking the dedicated assets table rather than the deprecated `logo_url` column. This ensures visual signature is only offered when the store genuinely has no logo.

#### Scenario: Logo in brand assets skips offer

- **WHEN** a store is saved with active store_brand_assets records
- **THEN** the system SHALL NOT offer visual signature creation
- **AND** no modal SHALL appear

#### Scenario: No brand assets and no signature triggers offer

- **WHEN** a store is saved without active store_brand_assets
- **AND** no active visual signature exists
- **THEN** the system SHALL present an option to create a visual signature

## ADDED Requirements

### Requirement: Resolution priority with store_brand_assets

The visual signature resolution logic SHALL be updated to consider store_brand_assets as the primary source. When a store has active store_brand_assets with variant_type `original`, the system SHALL use that asset and SHALL NOT generate, suggest, or reference visual signature creation in this phase.

This phase does NOT generate visual signatures — it only adjusts the priority chain to recognize logo assets as the highest priority.

#### Scenario: Logo assets suppress visual signature

- **WHEN** a store has active store_brand_assets
- **THEN** the resolution chain SHALL return the logo asset
- **AND** no visual signature operation SHALL be triggered

#### Scenario: No logo assets fall through to existing logic

- **WHEN** a store has no active store_brand_assets
- **THEN** the existing resolution chain (visual signature → name text) SHALL apply unchanged
