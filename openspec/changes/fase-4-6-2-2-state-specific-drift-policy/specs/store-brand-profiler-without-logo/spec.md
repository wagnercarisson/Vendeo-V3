## MODIFIED Requirements

### Requirement: Brand profiler inputs

The Store Brand Profiler SHALL consume the following inputs:
1. Store cadastral data: name, segment, subsegment, tone_of_voice, positioning, short_description, slogan, city, state
2. Approved outputs from the Store Identity Art Director:
   - creative_description (textual direction adopted)
   - suggested_colors (array of hex values)
   - visual_direction (e.g., "Moderna e minimalista")
   - elements_used (array of design elements)
   - asset_url (approved visual signature URL)
   - reference_card_url (if generated)
3. **intendedPalette: IntendedPalette | null** -- the declared color palette from signature.metadata.artDirectorOutput.intended_palette. Null for retry or pre-fase-4.6.5 signatures.
4. **previousBrandColors: string[]** -- brand_colors_chosen from the previous synced profile, only when brand_colors_chosen has at least one valid HEX. Empty array otherwise.
5. **mode: 'reuse' | 'regenerate'** -- controls profile cache behavior

The profiler SHALL use creative metadata as the primary source for brand inference.

#### Scenario: All inputs are consumed

- WHEN the brand profiler is invoked
- THEN it SHALL receive store cadastral data AND the Store Identity Art Director's approved outputs
- AND SHALL receive intendedPalette, previousBrandColors, and mode when available
- AND SHALL use creative metadata as primary input

#### Scenario: Without reference card

- WHEN no reference card was generated
- THEN the profiler SHALL proceed with the remaining inputs
- AND the missing reference card SHALL NOT block profile generation

#### Scenario: intendedPalette null for retry or legacy

- WHEN the brand profiler is invoked for a retry (simplified prompt) or pre-fase-4.6.5 signature
- THEN intendedPalette SHALL be null
- AND the profiler SHALL fall back to heuristic classification -- vision called for semantic analysis only (no color arbitration)

#### Scenario: Mode defaults to reuse

- WHEN the brand profiler is invoked without explicit mode
- THEN mode SHALL default to 'reuse'

### Requirement: Brand profiler execution

The brand profiler SHALL execute inline after the lojista approves the visual signature. The flow is:

1. Lojista approves visual signature
2. store_visual_signatures updated to 'active'
3. stores.logo_status set to 'generated'
4. Store Brand Profiler invoked with store data + identity art director outputs
5. Brand profile persisted with source 'without_logo', status 'synced' (or 'failed' on error)
6. Previous brand profile, if any, SHALL be marked as 'outdated' only when the new profile is successfully created with status = 'synced'. If the new profile fails, the previous synced profile SHALL remain unchanged.

The profiler SHALL accept a mode parameter: 'reuse' | 'regenerate'.

- reuse (current, default): searches existing profile by visual_signature_id and returns if found. Current behavior unchanged.
- regenerate: ignores existing profile cache, re-infers all brand fields. Preserves content_used, visual_signature_id, and existing VS metadata in the BP.

The 'regenerate' mode SHALL be used exclusively by VS-sensitive realinhamento (POST /realign when identity_state === 'visual_signature').

Processing SHALL be inline (same request) -- no queue, no polling. Status 'processing' is reserved for future queue-based processing.

#### Scenario: Reuse mode returns existing profile (unchanged)

- WHEN the profiler is invoked with mode:'reuse'
- AND an existing profile exists for the visual_signature_id
- THEN the existing profile SHALL be returned
- AND no new inference SHALL be made

#### Scenario: Regenerate mode re-infers without cache

- WHEN the profiler is invoked with mode:'regenerate'
- AND an existing profile exists for the visual_signature_id
- THEN a new inference SHALL be made
- AND the new profile SHALL replace the existing one

#### Scenario: Regenerate mode preserves VS metadata

- WHEN the profiler is invoked with mode:'regenerate'
- THEN content_used from the existing VS metadata SHALL be preserved
- AND visual_signature_id SHALL be preserved in the new profile

#### Scenario: Profile created as synced on success

- WHEN the brand profiler completes successfully
- THEN a brand profile SHALL be created with source = 'without_logo'
- AND status = 'synced'
- AND active_logo_asset_id = null

#### Scenario: Profile created as failed on error

- WHEN the brand profiler call fails
- THEN a brand profile SHALL be created with status = 'failed'
- AND error details SHALL be recorded in metadata
- AND the approved visual signature SHALL still be persisted (brand profile failure does not roll back the signature)

#### Scenario: Previous profile marked outdated only on success

- WHEN a new brand profile is created with source 'without_logo'
- AND the new brand profile has status = 'synced'
- AND a previous synced profile exists
- THEN the previous profile SHALL have its status changed to 'outdated'

#### Scenario: Previous profile preserved on failure

- WHEN a new brand profile is created with source 'without_logo'
- AND the new brand profile has status = 'failed'
- AND a previous synced profile exists
- THEN the previous profile SHALL remain 'synced'