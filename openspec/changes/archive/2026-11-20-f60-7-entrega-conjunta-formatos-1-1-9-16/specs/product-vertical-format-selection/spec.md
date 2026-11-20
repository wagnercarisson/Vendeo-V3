## MODIFIED Requirements

### Requirement: Exactly one format per new-flow campaign

The campaign creation screen for the NEW Product flow SHALL offer exactly one selection per campaign, chosen before generation: `1:1` (Quadrado), `9:16` (Vertical) or the explicit joint delivery `1:1+9:16`. The selector MUST be rendered whenever the store is eligible for the new flow. The `9:16` and `1:1+9:16` options MUST be enabled only when the global vertical flag is enabled (or when a persisted draft of that format is being restored, in which case submission is paused). The default selection SHALL be `1:1`. The client MUST NOT allow zero formats or an arbitrary list of formats; the only multi-format value accepted is the exact joint pair `1:1+9:16`.

#### Scenario: Selector appears for eligible store with vertical enabled

- **WHEN** an eligible store opens `/campanhas/nova`
- **AND** the applicable vertical generation flag is on
- **THEN** the form SHALL render exactly one format selector with the options `1:1`, `9:16` and `1:1+9:16`
- **AND** `1:1` SHALL be selected by default

#### Scenario: Joint option is disabled when vertical is off for a new draft

- **WHEN** the applicable vertical generation flag is off
- **AND** the draft has no persisted vertical or joint format to restore
- **THEN** the form SHALL keep the format selector visible
- **AND** the `9:16` and `1:1+9:16` options SHALL be disabled with an explanation
- **AND** the `1:1` option SHALL remain selected and submittable

#### Scenario: Restored joint draft is not hidden by the flag

- **WHEN** the applicable vertical generation flag is off
- **AND** the draft was restored from a persisted joint campaign
- **THEN** the joint selection SHALL remain visible with an explanation
- **AND** submission SHALL be blocked
- **AND** the system MUST NOT silently switch to `1:1` or `9:16`

#### Scenario: Selector is absent outside the new flow

- **WHEN** the store is not eligible for the new flow
- **THEN** the legacy or current form SHALL render without the format selector
- **AND** no format field SHALL be added to its payload

#### Scenario: Arbitrary multi-format payload is rejected

- **WHEN** a request contains a format list, more than one format outside the exact joint pair or an unsupported value
- **THEN** the server SHALL reject it with HTTP 400 before reservation, provider call or credit movement

#### Scenario: Joint pair is accepted only in the new flow

- **WHEN** a request declares exactly `campaignFormat: "1:1+9:16"` with the joint contract version in the new flow
- **THEN** the server SHALL accept the joint request
- **AND** SHALL route it to the dedicated joint path

### Requirement: Format labels are explicit and non-misleading

The UI SHALL label the options as `Quadrado 1:1 — feed`, `Vertical 9:16 — Stories e Reels (imagem estática)` and `Quadrado 1:1 + Vertical 9:16 — os dois formatos`. The helper text MUST state that the output is a still image, that it does not generate video, and that safe areas follow the Vendeo policy and may vary by platform surface. The joint option MUST state that the delivery consumes 2 credits when both formats are delivered. The UI MUST NOT claim support for every placement or every social network.

#### Scenario: Vertical option communicates scope

- **WHEN** the user views the vertical option
- **THEN** the label and helper text SHALL identify a static 9:16 image
- **AND** SHALL NOT state or imply video generation
- **AND** SHALL NOT claim unrestricted compatibility with all placements

#### Scenario: Joint option communicates two formats and cost

- **WHEN** the user views the joint option
- **THEN** the label SHALL identify both 1:1 and 9:16
- **AND** the helper text SHALL state the delivery of two formats and the 2-credit total
- **AND** SHALL NOT imply video generation

### Requirement: Format is frozen and persisted at creation

For a new-flow campaign, the server SHALL persist the chosen format in `campaigns.input_snapshot` at creation. Vertical campaigns MUST carry `campaignFormat: "9:16"` and the vertical `formatContractVersion`. Joint campaigns MUST carry `campaignFormat: "1:1+9:16"`, the joint `formatContractVersion`, the joint generation origin and its contract version. `1:1` campaigns MUST remain byte-compatible with the current new-flow snapshot and MUST NOT receive new format keys. For new-flow campaigns, absence of `campaignFormat` means `1:1`. A `1:1` campaign is frozen by the existing artifact contract (the `art-1024.jpg` path and 1024 × 1024 dimensions) plus the absence of a format marker; that state is immutable after creation. The persisted format SHALL be treated as the single source of truth for routing, artifact validation, download and display.

#### Scenario: Vertical campaign persists its format

- **WHEN** a vertical campaign is created
- **THEN** `campaigns.input_snapshot.campaignFormat` SHALL equal `"9:16"`
- **AND** `campaigns.input_snapshot.formatContractVersion` SHALL identify the vertical contract version
- **AND** the format SHALL be part of the frozen content fingerprint

#### Scenario: Joint campaign persists its contract

- **WHEN** a joint campaign is created
- **THEN** `campaigns.input_snapshot.campaignFormat` SHALL equal `"1:1+9:16"`
- **AND** the snapshot SHALL contain the recognized joint format and generation contract versions
- **AND** the pair SHALL be part of the frozen content fingerprint

#### Scenario: Square campaign snapshot is unchanged

- **WHEN** a `1:1` campaign is created after this change
- **THEN** its `input_snapshot` SHALL NOT contain `campaignFormat` or `formatContractVersion`
- **AND** its payload, prompt and artifact contract SHALL be the current new-flow `1:1` contract

#### Scenario: Legacy new-flow campaign without format reads as 1:1

- **WHEN** a new-flow campaign created before this change is read
- **AND** `input_snapshot.campaignFormat` is absent
- **THEN** the system SHALL treat it as `1:1`

#### Scenario: Malformed format fails closed

- **WHEN** a persisted `campaignFormat` is present but is not `"1:1"`, `"9:16"` or the exact joint pair
- **THEN** download, preview and recovery SHALL fail closed
- **AND** the system MUST NOT silently reinterpret the campaign as another format

### Requirement: Format and contract version are validated as a pair

The system SHALL validate `campaignFormat` together with `formatContractVersion` at every read boundary. Absence of both keys in a new-flow campaign SHALL select the historical `1:1` contract. A vertical campaign MUST have the recognized vertical version (`f59-vertical-9-16-v1`). A joint campaign MUST have the recognized joint version (`f60.7-two-format-v1`). A missing, malformed or unsupported version MUST make the campaign explicitly unavailable for generation-dependent operations, without falling back to the current `1:1` profile. A version that belongs to a different format MUST be rejected as incoherent.

#### Scenario: Historical 1:1 has no version keys

- **WHEN** a new-flow campaign has neither `campaignFormat` nor `formatContractVersion`
- **THEN** the system SHALL use the historical `1:1` contract
- **AND** SHALL NOT treat the absence as an unknown vertical or joint contract

#### Scenario: Vertical requires a recognized version

- **WHEN** a campaign has `campaignFormat: "9:16"`
- **AND** `formatContractVersion` is `f59-vertical-9-16-v1`
- **THEN** the vertical contract SHALL be available

#### Scenario: Joint requires a recognized version

- **WHEN** a campaign has `campaignFormat: "1:1+9:16"`
- **AND** `formatContractVersion` is `f60.7-two-format-v1`
- **THEN** the joint contract SHALL be available

#### Scenario: Unknown version is unavailable

- **WHEN** a campaign has `campaignFormat: "9:16"` or `"1:1+9:16"`
- **AND** `formatContractVersion` is missing, malformed or not recognized
- **THEN** download, preview, recovery, pending resolution and restore SHALL fail closed with an explicit unavailable state
- **AND** the system MUST NOT fall back to the `1:1` profile, dimensions or path

#### Scenario: Incoherent format/version pair is rejected

- **WHEN** `campaignFormat` and `formatContractVersion` refer to different contracts
- **THEN** the campaign SHALL be treated as unavailable
- **AND** no artifact SHALL be signed, downloaded or projected as delivered

### Requirement: Restored draft preserves the chosen format

The server-side form restore SHALL carry the persisted format (and its contract version) from the campaign snapshot into `CampaignFormRestore`. The draft, review and a new attempt after failure/refund MUST preserve the original format, including the joint format. If the vertical flag is OFF at restore time, the UI SHALL keep the vertical or joint selection visible, explain that new vertical/joint submissions are paused, and block submission — it MUST NOT silently switch the draft to `1:1`.

#### Scenario: Vertical form restores as vertical

- **WHEN** a vertical campaign is restored for a new attempt
- **THEN** `CampaignFormRestore` SHALL contain the vertical format
- **AND** the draft and review SHALL display the vertical selection
- **AND** the restored submission SHALL keep the vertical format

#### Scenario: Joint form restores as joint

- **WHEN** a joint campaign is restored for a new attempt
- **THEN** `CampaignFormRestore` SHALL contain the joint format and contract version
- **AND** the draft and review SHALL display both formats
- **AND** the restored submission SHALL keep the joint format

#### Scenario: Flag OFF at restore does not switch to 1:1

- **WHEN** a vertical or joint campaign is restored while the applicable vertical generation flag is OFF
- **THEN** the UI SHALL display the original selection as restored
- **AND** SHALL block the new vertical/joint submission with a clear explanation
- **AND** MUST NOT silently select or submit `1:1`

### Requirement: Vertical format uses its own server path

The server SHALL dispatch a vertical submission to a dedicated vertical generation path, derived from the new Product flow and isolated from the `1:1` orchestrator. The server SHALL dispatch a joint submission to a dedicated joint delivery path, isolated from both individual paths. The dispatch MUST occur after eligibility, ownership, identity binding and frozen-content validation, and before credit reservation. A submission whose persisted format differs from the requested format MUST be rejected with HTTP 409 without a second campaign, credit movement or provider call.

#### Scenario: Vertical submission reaches the vertical path

- **WHEN** an eligible vertical submission reaches the generate-image route
- **THEN** the server SHALL validate it with a vertical-specific strict schema
- **AND** SHALL delegate to the vertical orchestrator
- **AND** MUST NOT call the `1:1` artifact pipeline or the joint orchestrator

#### Scenario: Joint submission reaches the joint path

- **WHEN** an eligible joint submission reaches the generate-image route
- **THEN** the server SHALL validate it with the joint-specific strict schema
- **AND** SHALL delegate to the dedicated joint orchestrator
- **AND** MUST NOT call the single-format `1:1` or `9:16` orchestrator as the owner of the request

#### Scenario: Format mismatch is a conflict

- **WHEN** an existing campaign was created as `9:16`, `1:1` or joint
- **AND** a request for the same campaign identity asks for a different format contract
- **THEN** the server SHALL return HTTP 409
- **AND** MUST NOT reserve credit, call the provider or overwrite the campaign
