## ADDED Requirements

### Requirement: Versioned safe-area policy for 9:16

The system SHALL define a versioned safe-area policy for vertical campaigns (`safe-area-9-16-v1`). The policy MUST express protected margins as percentages and as canonical pixels for the delivered 1080 × 1920 canvas:

- top: 14% of height (≈ 269 px);
- bottom: 35% of height (672 px);
- sides: 6% of width (≈ 65 px each);
- additional bottom-right control protection: a conservative rectangle of 30% of width × 40% of height (324 × 768 px) anchored to the bottom-right corner.

The policy MUST classify each value as **documented guidance**, **Vendeo conservative recommendation**, or **pending validation**. The percentage basis MUST be Meta's unified Stories/Reels 9:16 guidance as reported in its help material; the exact numbers and the bottom-right rectangle MUST remain marked pending until validated with real platform overlays in homolog.

#### Scenario: Policy exposes percentages and pixels

- **WHEN** the vertical policy is read by the prompt or verification layer
- **THEN** it SHALL return the top, bottom, side and bottom-right values together with the policy version
- **AND** the pixel values SHALL be derived from a 1080 × 1920 canvas

#### Scenario: Provenance is explicit

- **WHEN** the policy is documented or reviewed
- **THEN** each value SHALL indicate whether it is documented guidance, Vendeo conservative recommendation or pending validation
- **AND** the implementation MUST NOT present pending values as platform guarantees

#### Scenario: Policy version is frozen with the campaign

- **WHEN** a vertical campaign is created
- **THEN** its frozen evidence `policy_versions` SHALL include the safe-area policy version
- **AND** later policy changes MUST NOT retroactively alter an existing campaign

### Requirement: Background fills the vertical canvas

The vertical composition SHALL fill the entire 1080 × 1920 canvas with background, ambient scene or product context. The delivered art MUST NOT contain letterboxing, empty bands, white borders, safe-area guides or placeholder zones. Recreated backgrounds MUST be instructed to extend to all edges; original-background campaigns MUST preserve the supplied context while filling the frame.

#### Scenario: No empty bands or guides

- **WHEN** a vertical art is delivered
- **THEN** every edge SHALL be covered by background or scene content
- **AND** no safe-area guideline, crop mark or empty reserved band SHALL be visible

#### Scenario: Background direction still applies

- **WHEN** the vertical campaign uses `studio`, `ambient` or `original`
- **THEN** the selected direction SHALL be reflected in the vertical prompt
- **AND** `original` SHALL still require exactly one product image, as in `1:1`

### Requirement: Essential elements remain protected

Texts, store identity, obligatory information, call to action and essential product attributes MUST be composed inside the protected area, outside the top 14%, bottom 35%, side 6% and the bottom-right control rectangle. Non-essential decorative elements MAY occupy the excluded zones. The piece MUST communicate the offer, product and identity without depending on an external caption.

#### Scenario: Essential content avoids excluded zones

- **WHEN** a vertical art is reviewed against the safe-area overlay
- **THEN** product name, price, badge, validity, mandatory text, CTA and store identity SHALL be fully inside the protected area
- **AND** none of them SHALL be hidden by the top, bottom, side or bottom-right overlays

#### Scenario: Essential message survives without caption

- **WHEN** the art is viewed alone, without the publication caption
- **THEN** the product, the commercial offer and the store identity SHALL remain understandable

### Requirement: Copy Director is reused unchanged

The vertical path SHALL reuse the existing `CopyDirectorService`, its prompts, schema, retry policy and delivery contract without modification. The vertical format MUST NOT introduce a new Copy Director, format-specific copy prompts or platform-specific copy.

#### Scenario: Copy contract is identical

- **WHEN** the vertical path requests copy
- **THEN** it SHALL use the same `CopyDirectorInput` and `CopyDirectorResult` contract as the new Product flow
- **AND** the copy prompt files SHALL NOT be modified

#### Scenario: Copy failure does not block art delivery

- **WHEN** copy generation fails or remains pending
- **THEN** the vertical art SHALL still be delivered under the existing rules
- **AND** the copy recovery rules SHALL remain those of the current new flow

#### Scenario: Copy timing matches the current new flow

- **WHEN** the vertical image generation starts
- **THEN** the copy attempt SHALL start after the execution attempt is acquired and before the image response
- **AND** the vertical path MUST NOT delay copy until after the art is delivered

### Requirement: Vertical prompt derives from the approved 1:1 baseline

The vertical prompt SHALL reuse the approved Product `1:1` base and commercial/visual policies, changing only what is necessary for the 9:16 format and safe areas. The prompt MUST state the vertical format, the canvas proportions, the safe-area policy and the requirement to fill the frame without guides or empty bands, while preserving creative freedom of composition. The change MUST be versioned and MUST NOT alter the `1:1` prompt contract.

#### Scenario: Only format and safe-area guidance change

- **WHEN** the vertical and `1:1` prompt compositions are compared for the same briefing
- **THEN** identity, product fidelity, commercial matrix, intent and mandatory-text rules SHALL be equivalent
- **AND** the vertical prompt SHALL differ only in format, canvas and safe-area guidance

#### Scenario: Prompt versions are recorded

- **WHEN** a vertical prompt is composed
- **THEN** its composer version, base version, format policy version and safe-area policy version SHALL be recorded
- **AND** the `1:1` composer and policy versions SHALL remain unchanged
