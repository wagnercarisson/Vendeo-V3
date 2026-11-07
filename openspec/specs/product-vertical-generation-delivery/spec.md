# product-vertical-generation-delivery Specification

## Purpose
TBD - created by archiving change fase-59-campanhas-produto-vertical-9-16. Update Purpose after archive.
## Requirements
### Requirement: Requested provider size and delivered size are distinguished

The vertical path SHALL request a 9:16 image from the production adapter through `openai.images.edit`, using **1152 × 2048** as the v1 generation size. The system MUST record the requested size separately from the size actually returned by the provider and from the final delivered size. The implementation MUST NOT assume Responses API behavior: the production adapter in use is `images.edit`.

The local SDK contract allows arbitrary `WIDTHxHEIGHT` strings whose width and height are divisible by 16, with ratio between 1:3 and 3:1 and a maximum of 3840 × 2160. `1152 × 2048` satisfies those conditions (1152 = 72 × 16, 2048 = 128 × 16, ratio 9:16). `1080 × 1920` does **not** satisfy the divisibility rule for width (1080 / 16 = 67.5) and therefore MUST NOT be sent as the provider request size.

#### Scenario: Vertical request uses 1152 × 2048

- **WHEN** the vertical path calls the production image adapter
- **THEN** it SHALL send `size: "1152x2048"`
- **AND** it SHALL send the configured model and quality without omitting quality

#### Scenario: Provider output size is verified

- **WHEN** the provider returns image bytes
- **THEN** the system SHALL decode the bytes and verify the real dimensions
- **AND** SHALL record requested size, provider-returned size and final delivered size separately

#### Scenario: Unexpected provider size fails closed

- **WHEN** the provider returns bytes whose real dimensions are not 1152 × 2048
- **THEN** the vertical pipeline SHALL NOT upscale, crop, pad or silently accept them
- **AND** SHALL follow the normal failure/unknown-result policy without a blind retry or automatic refund

### Requirement: Final artifact is JPEG sRGB 1080 × 1920 quality 90

The delivered vertical art SHALL be a JPEG in sRGB at exactly **1080 × 1920**, initially with quality 90. The reduction from 1152 × 2048 MUST be proportional, with no distortion, content crop or added bands. The system MUST verify the final bytes by full decode, not only by metadata or file extension.

#### Scenario: Final dimensions are exact

- **WHEN** the vertical artifact is produced
- **THEN** a full decode SHALL report `jpeg`, width 1080 and height 1920
- **AND** the produced file SHALL be `image/jpeg`

#### Scenario: Downscale is proportional

- **WHEN** the 1152 × 2048 provider image is reduced
- **THEN** width and height SHALL be scaled by the same factor (0.9375)
- **AND** no crop, letterbox, border or distortion SHALL be introduced

#### Scenario: Invalid final bytes are rejected

- **WHEN** the produced bytes are truncated, non-JPEG or have dimensions other than 1080 × 1920
- **THEN** the artifact SHALL be classified as invalid
- **AND** SHALL NOT be published as delivered art

### Requirement: Vertical artifacts use dedicated paths and real metadata

The vertical artifact SHALL be stored in the private `campaign-images` bucket at:

`{storeId}/{campaignId}/product-9-16/{operationId}/art-1080x1920.jpg`

The upload MUST be immutable (`upsert: false`). The system SHALL persist the real decoded width, height and MIME type in `product_1_1_campaign_artifacts`, reusing the existing table and its operation identity (`campaign_id`, `operation_id`). No database migration is planned. Existing `1:1` paths (`product-1-1/{operationId}/art-1024.jpg`) MUST remain unchanged and MUST NOT be used for vertical artifacts.

#### Scenario: Vertical path is deterministic

- **WHEN** a vertical artifact is stored for a campaign and operation
- **THEN** its path SHALL match the dedicated vertical pattern
- **AND** the upload SHALL NOT overwrite an existing object

#### Scenario: Metadata comes from decoded bytes

- **WHEN** the artifact row is persisted
- **THEN** `width` SHALL be 1080 and `height` SHALL be 1920, decoded from the bytes
- **AND** `mime_type` SHALL be `image/jpeg`

#### Scenario: Existing 1:1 artifacts are untouched

- **WHEN** the vertical path runs
- **THEN** it SHALL NOT read, overwrite or delete `art-1024.jpg` objects or their rows

### Requirement: Vertical thumbnail is derived and best-effort

The system SHALL generate a lightweight WebP thumbnail from the final vertical art, preserving the 9:16 aspect ratio (maximum edge 288 px, no crop, no upscale), at the deterministic sibling path `<original>.thumb-v1.webp`, in the private bucket and with `upsert: false`. Thumbnail generation MUST NOT block delivery, credit confirmation or download. The thumbnail path recognition mechanism MUST accept the new vertical pattern while continuing to reject inputs, logos, signatures, bench and lab paths.

#### Scenario: Thumbnail preserves the vertical ratio

- **WHEN** a 1080 × 1920 art is thumbnailed
- **THEN** the result SHALL be WebP with height 288 and width 162
- **AND** it SHALL NOT crop or upscale the art

#### Scenario: Thumbnail failure does not block delivery

- **WHEN** thumbnail generation or upload fails
- **THEN** the campaign SHALL still be delivered and downloadable
- **AND** the failure SHALL be isolated and observable without changing the credit outcome

#### Scenario: Thumbnail mechanism recognizes vertical paths

- **WHEN** the list or dashboard derives a thumbnail from a vertical artifact path
- **THEN** the derived path SHALL be recognized by the thumbnail eligibility rules
- **AND** `1:1`, legacy and correction paths SHALL continue to behave as today

### Requirement: One delivered campaign consumes one credit

The vertical path SHALL follow the current new-flow credit rules: exactly **1 credit per delivered campaign**, regardless of technical attempts, primary/fallback calls or resends. It MUST reuse the existing credit operation table and RPCs, with integration points at: reservation after the snapshot is persisted and before any provider call; `art_uploaded` after artifact metadata persistence; `delivered` only after the publication fence and successful upload; refund only on confirmed failure with proven absence; unknown provider result kept pending without automatic refund.

#### Scenario: Reservation precedes provider call

- **WHEN** a vertical generation starts
- **THEN** the credit operation SHALL be reserved before the first provider attempt
- **AND** no provider call SHALL occur if reservation fails

#### Scenario: Delivery confirms the charge

- **WHEN** the artifact is stored and the delivery gate passes
- **THEN** the operation SHALL transition through `art_uploaded` to `delivered`
- **AND** exactly 1 credit SHALL be consumed

#### Scenario: Confirmed failure refunds once

- **WHEN** a vertical attempt fails with confirmed absence of the artifact
- **THEN** the existing closure path SHALL refund exactly once
- **AND** a late result MUST NOT reopen the operation

#### Scenario: Unknown result does not refund

- **WHEN** the provider or upload result is unknown
- **THEN** the operation SHALL remain pending/limited
- **AND** no automatic refund or blind retry SHALL occur

### Requirement: Pre-call cost estimate is resolution-aware and capped per call

The vertical path SHALL NOT reuse the `1024 × 1024` cost estimate blindly for a `1152 × 2048` request. Before every paid image call — including retries and fallback — the system MUST resolve an explicit vertical estimate, compare it with the remaining budget and block the call when the estimate is missing or the budget is insufficient. The provider proof SHALL compare the pre-call estimate with the provider-reported cost and record the deviation.

The proof budget (US$ 3.00 for the matrix derived from the effective `1:1` primary/fallback configuration) SHALL be separate from the functional UAT budget; retries count against the proof cap and against the planned call matrix. The pre-call estimate SHALL use the real `image_unit_usd` from the same shared pricing source used by `1:1`, with a versioned conservative vertical multiplier; the proof MUST NOT create a `9:16`-specific pricing table or model configuration. Stopping early for budget reasons SHALL be reported as pending, never as proof of the untested combination.

#### Scenario: Missing vertical estimate blocks the call

- **WHEN** no calibrated vertical estimate exists for the selected model/quality
- **THEN** the paid call SHALL be blocked before the provider
- **AND** the operation SHALL NOT silently use the `1024 × 1024` estimate

#### Scenario: Budget is checked before each call

- **WHEN** the remaining proof budget cannot cover the next estimated call
- **THEN** the proof SHALL stop and record the pending combinations
- **AND** no additional paid call SHALL be made

#### Scenario: Retries consume the same budget

- **WHEN** a retry or fallback is about to be called
- **THEN** it SHALL pass through the same estimate and budget gate
- **AND** SHALL count toward the planned call matrix and the cap

### Requirement: Download and preview follow the existing delivery gate

Download of a vertical campaign SHALL be released only when the persisted operation is `delivered` and the artifact probe reports an integral 1080 × 1920 JPEG. The route SHALL return the bytes as an attachment with a safe filename and the content type derived from the bytes. Upload alone MUST NOT release download. The `1:1` and legacy branches MUST remain byte-compatible.

#### Scenario: Delivered vertical campaign downloads

- **WHEN** the owner requests download of a delivered vertical campaign with an integral artifact
- **THEN** the route SHALL return the JPEG bytes as an attachment
- **AND** the filename SHALL use the existing safe naming contract

#### Scenario: Undelivered or invalid vertical art is blocked

- **WHEN** the vertical operation is not `delivered` or the probe is not `integral`
- **THEN** download SHALL be refused with the existing fail-closed status
- **AND** no signed URL or partial bytes SHALL be exposed

#### Scenario: Foreign or unknown format is blocked

- **WHEN** the persisted format is malformed
- **OR** the vertical contract version is missing or unsupported
- **OR** the operation cannot be read
- **THEN** the route SHALL fail closed with an explicit unavailable state
- **AND** MUST NOT fall back to the legacy path or to the `1:1` profile

### Requirement: Recovery and resend preserve the frozen vertical format

Resend SHALL be query-only and MUST NOT call the provider, reserve credit or regenerate art. Recovery MUST use a format-aware typed probe for the vertical path and MUST NOT reassign a `1:1` artifact to a vertical campaign (or the inverse). A refunded operation MUST NOT return to `delivered`.

#### Scenario: Resend queries only

- **WHEN** the user resends a vertical campaign
- **THEN** the server SHALL return the persisted operation state
- **AND** SHALL NOT call the image provider or consume credit

#### Scenario: Recovery validates vertical dimensions

- **WHEN** a pending vertical operation is probed
- **THEN** only an integral JPEG at 1080 × 1920 SHALL count as recovered art
- **AND** a 1024 × 1024 object at a vertical path SHALL be classified as invalid

#### Scenario: Refunded vertical operation stays closed

- **WHEN** a late provider result arrives for a refunded vertical operation
- **THEN** the operation SHALL remain refunded
- **AND** the later artifact MUST NOT be exposed as delivery

### Requirement: Recovery and administrative resolution propagate the vertical profile to projection

The vertical format and the expected vertical artifact path SHALL be propagated through the entire recovery chain: the image-recovery route, the recovery service, the pending-operation repository, the administrative resolution path and the final campaign projection. A successful recovery of an integral vertical artifact SHALL complete the financial delivery and project the campaign as `ready` with the vertical path, making it visible in detail and list. Recovery MUST NOT regenerate art or call the provider.

#### Scenario: Image recovery projects the vertical campaign

- **WHEN** the owner requests recovery of a pending vertical operation
- **AND** the probe finds an integral 1080 × 1920 artifact
- **THEN** the service SHALL complete `art_uploaded` → `delivered` under the existing rules
- **AND** SHALL project the campaign as `ready` with the vertical path
- **AND** the detail and list SHALL show the recovered vertical campaign

#### Scenario: Administrative resolution projects the vertical campaign

- **WHEN** an administrator resolves a pending vertical operation with `deliver_existing_art`
- **THEN** the administrative path SHALL use the vertical probe and the vertical expected path
- **AND** SHALL project the campaign as `ready` with the vertical path

#### Scenario: Recovery never regenerates or projects with the 1:1 path

- **WHEN** a vertical recovery completes
- **THEN** no provider call or new artifact SHALL be created
- **AND** the campaign MUST NOT be projected with `art-1024.jpg`
- **AND** the campaign MUST NOT remain stuck in `generating` after confirmed delivery

### Requirement: Campaign projection and persistence reuse current snapshots

The vertical path SHALL persist the same snapshot classes as the new flow (configuration snapshot, frozen evidence, content binding) and SHALL project the campaign to `campaigns.status = 'ready'` with the real vertical artifact path on delivery, or `'error'` after confirmed closure. The persisted format SHALL be readable by list, detail, download and recovery without a new table or migration. Existing tables, constraints and RPCs SHALL be checked before implementation; any structural need MUST return as an explicit decision with evidence.

#### Scenario: Delivered campaign is projected

- **WHEN** the vertical operation is delivered
- **THEN** the campaign SHALL become `ready`
- **AND** `storage_path` SHALL point to `art-1080x1920.jpg`

#### Scenario: Failed campaign is projected after closure

- **WHEN** a confirmed vertical failure is closed
- **THEN** the campaign SHALL become `error`
- **AND** no artifact path SHALL be exposed as deliverable

#### Scenario: No migration is introduced silently

- **WHEN** implementation finds a constraint or RPC that cannot support the vertical path
- **THEN** work SHALL stop at an explicit decision point
- **AND** any structural change SHALL be presented with evidence and justification before coding

### Requirement: Generation is idempotent per campaign and operation

The vertical path SHALL preserve the new-flow identity contract: `campaignId` + `operationId` identify one campaign and one operation. Repeated submissions for the same identity and frozen content MUST return the same operation without a second campaign, second reservation or second provider call. Divergent content or format for the same identity MUST return HTTP 409.

#### Scenario: Repeated submission reuses the operation

- **WHEN** the same vertical submission is repeated with the same identity and content
- **THEN** the server SHALL return the existing operation state
- **AND** SHALL NOT reserve credit or call the provider again

#### Scenario: Concurrent start cannot double-charge

- **WHEN** two vertical requests race for the same identity
- **THEN** only one attempt SHALL acquire the start
- **AND** the other SHALL observe the existing operation
