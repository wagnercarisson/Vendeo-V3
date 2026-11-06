## ADDED Requirements

### Requirement: Versioned safe-area policy for 9:16

The system SHALL define a versioned safe-area policy for vertical campaigns (`safe-area-9-16-v1`). The policy MUST express protected margins as percentages and as canonical pixels for the delivered 1080 × 1920 canvas:

- top: 14% of height (≈ 269 px);
- bottom: 35% of height (672 px);
- sides: 6% of width (≈ 65 px each);
- additional bottom-right control protection: a conservative rectangle of 30% of width × 40% of height (324 × 768 px) anchored to the bottom-right corner.

The policy MUST classify each value as **documented guidance**, **Vendeo conservative recommendation**, or **pending validation**. The percentage basis MUST be Meta's unified Stories/Reels 9:16 guidance as reported in its help material; the exact numbers and the bottom-right rectangle MUST remain marked pending until validated with real platform overlays in homolog.

This policy remains the FROZEN HISTORICAL contract (`safe-area-9-16-v1`). New vertical compositions use the experimental Instagram bands policy below; this requirement MUST NOT be retroactively changed for existing campaigns.

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

### Requirement: Experimental Instagram protected bands for new vertical compositions

The new vertical composition SHALL use the experimental Vendeo policy `safe-area-9-16-experimental-v3`, based on the responsible's manual observation, with two protected information bands:

- top: 5% of height;
- bottom: 20% of height.

The earlier `safe-area-9-16-experimental-v2` (bottom 20% only) and `safe-area-9-16-experimental-v1` (15% top + 20% bottom) remain historical for campaigns composed with them. There MUST be no lateral margin mask and no specific bottom-right cutout. The policy MUST NOT be presented as official Instagram guidance or a universal guarantee. The prompt SHALL express the policy as a single visual block, without pixel coordinates; the numeric calculations for the generation canvas `1152 × 2048` and the delivery canvas `1080 × 1920` SHALL remain in code for validation and analysis overlays.

#### Scenario: Prompt uses one visual block without old geometry

- **WHEN** a new vertical prompt is composed
- **THEN** it SHALL contain one `[COMPOSIÇÃO PARA INSTAGRAM]` block
- **AND** the block SHALL mention the 5% top and 20% bottom bands
- **AND** it MUST NOT contain the 15% top band, pixel coordinates, lateral masks or the 30% × 40% bottom-right cutout

#### Scenario: Product may extend into the bands

- **WHEN** the product, packaging or complements extend into the 5% top or 20% bottom band
- **THEN** the art SHALL NOT be rejected solely for that extension
- **AND** the product SHALL remain recognizable and its essential identifying information uncompromised
- **AND** texts, price, badge, CTA, store asset, mandatory notices and validity MUST remain outside both bands

#### Scenario: Analysis overlay uses the current bands

- **WHEN** an analyst overlays the new policy on the delivered image
- **THEN** the top 5% and bottom 20% bands SHALL be marked
- **AND** no lateral mask or additional bottom-right mask SHALL be applied
- **AND** the top band SHALL NOT be presented as a full 15% upper safe area

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

For the new vertical composition, texts, price, offer, badge, CTA when present, commercial conditions, mandatory notices, validity and store identity MUST remain outside the top 5% and bottom 20% bands. Product, packaging and complements MAY extend into those bands, provided they remain recognizable and no essential identifying information is compromised. Non-essential decorative elements MAY occupy any area. The piece MUST communicate the offer, product and identity without depending on an external caption.

#### Scenario: Commercial information avoids the protected bands

- **WHEN** a vertical art is reviewed against the experimental top/bottom overlay
- **THEN** texts, price, offer, badge, CTA, commercial conditions, mandatory notices, validity and store identity SHALL be outside the top 5% and bottom 20%
- **AND** the product MAY extend into those bands without automatic rejection

#### Scenario: Product remains identifiable

- **WHEN** product, packaging or complements occupy part of a protected band
- **THEN** the product SHALL remain recognizable
- **AND** essential identifying information MUST NOT be compromised

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

### Requirement: Vertical prompt is an editorial restatement of the approved 1:1 policies

The vertical prompt SHALL be produced by a vertical-only serializer that restates the approved Product `1:1` commercial and visual rules in a short editorial structure: campaign objective and format, references in real attachment order, campaign data, composition rules and the single `[COMPOSIÇÃO PARA INSTAGRAM]` block. The restatement MUST preserve every functional requirement (intent, background direction, product fidelity, store-asset identity, optional description, mandatory text and language integrity) while emitting each orientation only once and omitting empty fields or rules about absent elements. The serializer MUST NOT modify the `1:1` prompt, its composer, its policies or the shared policy registry. The new vertical composition records `safe-area-9-16-experimental-v3`; the historical `safe-area-9-16-experimental-v2`, `safe-area-9-16-experimental-v1` and `safe-area-9-16-v1` remain frozen for prior campaigns.

#### Scenario: Only the vertical composition changes

- **WHEN** the vertical and `1:1` prompt compositions are compared for the same briefing
- **THEN** the `1:1` prompt SHALL remain byte-identical to its frozen baseline
- **AND** shared policies SHALL remain unmodified
- **AND** the vertical prompt SHALL preserve the same intent, product fidelity, commercial and mandatory-text rules in condensed form

#### Scenario: Editorial structure separates data from instructions

- **WHEN** a vertical prompt is composed
- **THEN** campaign values SHALL be delimited as data without embedded instructions
- **AND** each composition rule SHALL appear once and only when its element exists
- **AND** reference images SHALL be numbered according to the real adapter order

#### Scenario: Prompt versions are recorded

- **WHEN** a vertical prompt is composed
- **THEN** its composer version, base version, format policy version and safe-area policy version SHALL be recorded
- **AND** the `1:1` composer and policy versions SHALL remain unchanged

### Requirement: Creative freedom and optional notice orientation

The vertical prompt SHALL include, once in the general composition block, a creative-freedom instruction covering framing, lighting, depth and visual hierarchy. This freedom MUST NOT authorize inventing commercial information, changing the product appearance or expanding the current store-asset application permissions. When the mandatory artwork text contains the exact phrase `Imagem meramente ilustrativa`, the prompt SHALL include once an optional orientation allowing the notice to be applied horizontally or rotated 90°, preserving the full phrase, legibility, contrast and the protected area, and without stacking letters. The orientation MUST NOT be emitted when the phrase is absent, MUST NOT extend to the rest of the mandatory-text field, and MUST NOT be presented as artwork text.

#### Scenario: Creative freedom appears once

- **WHEN** a vertical prompt is composed
- **THEN** the creative-freedom instruction SHALL appear exactly once in the composition block
- **AND** it MUST NOT appear in the Instagram composition block or in the campaign data

#### Scenario: Notice orientation is conditional

- **WHEN** the mandatory artwork text contains `Imagem meramente ilustrativa`
- **THEN** the optional orientation SHALL appear exactly once
- **AND** the notice SHALL remain in the campaign data and be preserved in full
- **WHEN** the phrase is absent
- **THEN** the orientation MUST NOT be emitted
- **AND** other mandatory texts SHALL remain intact

#### Scenario: Other mandatory texts are not broadened

- **WHEN** the mandatory-text field contains the notice and additional texts
- **THEN** only the notice SHALL receive the rotation permission
- **AND** the additional texts MUST remain integral and must not be treated as a footer

### Requirement: Monetary expressions preserve the informed value

The vertical prompt SHALL include, once in the general composition block, an instruction treating each price as a single monetary expression: exactly one comma between the integer part and the cents when cents exist, even when they use different sizes or alignments; no repeated comma when separating reais and centavos visually. The instruction SHALL apply to the original and sale prices, MUST preserve the exact informed value, MUST NOT add cents to values without cents, and MUST NOT confuse a thousands separator with a decimal separator. The production prompt MUST NOT include fixed price examples.

#### Scenario: Price rule appears once

- **WHEN** a vertical prompt is composed
- **THEN** the monetary-expression instruction SHALL appear exactly once in the composition block
- **AND** it MUST NOT appear in the campaign data or in the Instagram composition block

#### Scenario: Prices are not reformatted

- **WHEN** the briefing contains a sale price, an original price, a value without cents or a value with a thousands separator
- **THEN** the campaign data SHALL preserve the exact informed strings
- **AND** the prompt MUST NOT add cents, remove separators or reformat the values

#### Scenario: Visual separation does not duplicate the comma

- **WHEN** reais and centavos are rendered with different sizes or alignments
- **THEN** the instruction SHALL require exactly one comma
- **AND** it MUST NOT repeat the comma to create the visual separation
