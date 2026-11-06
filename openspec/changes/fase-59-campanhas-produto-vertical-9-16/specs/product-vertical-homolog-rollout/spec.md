## ADDED Requirements

### Requirement: A single global flag controls vertical exposure

The vertical format SHALL be controlled by exactly one global feature flag, `product_9_16_enabled`, OFF by default. The flag SHALL be read server-side with fail-closed behavior: missing, invalid or unreadable flag means new vertical submissions are unavailable. The flag MUST NOT create store segmentation, coortes, stage authorizations, per-format permissions or a second activation mechanism. When off, the creation screen SHALL not offer vertical for new submissions and the server MUST reject new vertical submissions before reservation or provider call.

The flag SHALL gate **only the start of new vertical generations**. For campaigns already created, turning the flag off MUST NOT block query, download, image recovery, copy recovery, detail/list, or administrative resolution. Generations already in flight SHALL continue to their terminal state (`delivered`, `refunded` or an honest pending state) and MUST NOT be aborted by the flag. The existing new-flow authorization/ownership barriers remain in force for recovery; the vertical flag itself MUST NOT be consulted by those paths.

#### Scenario: Flag off hides and blocks new vertical submissions

- **WHEN** `product_9_16_enabled` is off, missing or unreadable
- **THEN** the UI SHALL NOT offer the vertical option for a new submission
- **AND** a forced new vertical request SHALL be rejected before credit reservation or provider call
- **AND** a restored vertical draft SHALL remain visible and blocked, not silently changed to `1:1`

#### Scenario: Flag on only exposes the choice

- **WHEN** `product_9_16_enabled` is on
- **THEN** eligible new-flow stores SHALL see the format choice
- **AND** existing eligibility rules for the new flow SHALL still apply

#### Scenario: No additional activation mechanism exists

- **WHEN** the vertical rollout is inspected
- **THEN** no per-store, per-stage or per-format authorization SHALL exist for it
- **AND** the single global key SHALL be the only vertical switch

#### Scenario: Flag OFF preserves existing campaign service

- **WHEN** a vertical campaign was created with the flag ON
- **AND** the flag is turned OFF afterwards
- **THEN** query, download, image recovery, copy recovery, detail/list and administrative resolution SHALL remain available
- **AND** the existing new-flow authorization and ownership rules SHALL still apply

#### Scenario: In-flight generation is not aborted by the flag

- **WHEN** a vertical generation is in progress
- **AND** the flag is turned OFF
- **THEN** the generation SHALL continue to a terminal or honest pending state
- **AND** SHALL NOT be aborted solely because of the flag

### Requirement: Flag seed is data-only and auditable

If the global key does not exist in `feature_flags`, a data-only migration SHALL insert it once with `enabled = false` and a descriptive text, using the repository's `INSERT ... ON CONFLICT (key) DO NOTHING` pattern. This migration MUST NOT change schemas, constraints, RPCs, grants or existing rows. The flag SHALL be operated through the existing `admin_update_feature_flag` RPC and admin panel, with the existing reason/audit requirements.

#### Scenario: Seed does not alter structure

- **WHEN** the flag seed migration is applied
- **THEN** it SHALL only insert the missing key with `enabled = false`
- **AND** it SHALL NOT alter tables, columns, constraints, RPCs or grants

#### Scenario: Flag change is audited

- **WHEN** an administrator turns the vertical flag on or off
- **THEN** the change SHALL use the existing audited RPC with a mandatory reason
- **AND** the prior flag state SHALL be recoverable from the audit trail

### Requirement: Provider proof precedes implementation of the generation pipeline

Before consolidating the generation pipeline, the team SHALL prove the production adapter behavior in homolog using the **same effective primary/fallback model configuration and the same pricing source** used by the Product `1:1` flow. The proof SHALL derive the configured pairs and qualities from `image_model_pair_config` (`scope = new_flow`) and resolve `image_unit_usd`, token tariffs and the pricing version from the same current `ai_model_pricing` row used by `1:1`. The system MUST NOT create a `9:16`-specific model catalog, model selection, pricing table, tariff or configuration override. It MUST confirm acceptance of `1152x2048`, the real returned dimensions, latency, failure modes and cost. A `1024x1024` control call per unique configured pair SHALL confirm that the current `1:1` behavior remains unchanged.

The proof plan SHALL be: 3 generated samples per unique configured pair at `1152x2048` plus 1 control sample per unique pair at `1024x1024`, with the total number of planned calls **derived from the effective configuration** (not a fixed model list). The budget cap SHALL be **US$ 3.00**. The matrix SHALL be conditional on the remaining budget: before each call, the gate MUST check the vertical estimate and the cap; retries and fallback SHALL count toward both the matrix and the cap. If the budget cannot cover the next call, the proof SHALL stop and report the untested combinations as pending.

The estimate SHALL be explicit for `1152x2048` and MUST be defined **before the first paid call**, using the real `image_unit_usd` from the shared pricing source. The proof MUST either demonstrate that the shared `image_unit` applies to the larger size or calibrate a conservative, versioned vertical multiplier; later calibration only confirms or adjusts the pre-defined estimate. The proof SHALL compare the pre-call estimate with the provider-reported cost and record the deviation, together with the model/quality pair, configuration version and pricing version used. The proof budget SHALL be separate from the functional UAT budget, which requires its own approval. No paid call is authorized in the planning phase that produces this spec.

If the effective configuration is absent, incomplete or divergent, or a configured pair lacks applicable pricing, the proof SHALL fail closed and present the evidence without inventing a matrix or price and without changing the configuration. If a configured combination cannot produce `1152x2048`, the proof SHALL stop and present the provider evidence; it MUST NOT silently switch models or configuration.

#### Scenario: Proof matrix is recorded

- **WHEN** the provider proof is executed in homolog
- **THEN** every executed call SHALL be recorded with model, quality, requested size, returned size, latency, estimate, provider-reported cost, calculated usage cost and cost charged
- **AND** the matrix SHALL be derived from the same primary/fallback configuration used by `1:1`
- **AND** the configuration version and pricing version SHALL be recorded
- **AND** any unexecuted combination SHALL be reported as pending, not assumed

#### Scenario: Unsupported vertical dimension stops the proof

- **WHEN** a configured model/quality combination rejects or cannot produce `1152x2048`
- **THEN** the proof SHALL stop and present the provider evidence
- **AND** it MUST NOT replace the model, quality or configuration silently
- **AND** the remaining combinations SHALL be reported as pending

#### Scenario: Proof counts one provider request per call and uses the validated credential

- **WHEN** the proof harness invokes the production adapter
- **THEN** the injected SDK loader SHALL disable automatic retries (`maxRetries: 0`)
- **AND** it SHALL use exactly the credential validated in the preflight
- **AND** the default `1:1` runtime loader SHALL remain unchanged

#### Scenario: Divergent dimension or unverified cost fails the proof

- **WHEN** the returned image dimensions differ from the requested size
- **THEN** the call SHALL be recorded as `dimension_mismatch`, the incurred cost preserved, and the proof SHALL stop without success
- **WHEN** neither provider-reported nor usage-calculated cost is available
- **THEN** the call SHALL be recorded as `cost_unverified`, the conservative estimate charged, reconciliation required, and the proof SHALL stop
- **AND** the multiplier SHALL NOT be confirmed without an actually resolved cost

#### Scenario: Proof criteria are explicit

- **WHEN** the proof is evaluated
- **THEN** acceptance SHALL require: request accepted at 1152 × 2048; returned image decodable; real dimensions recorded; no provider-side crop evidence; cost within the approved cap; fallback behavior observable
- **AND** a configured model/quality that cannot produce the intended 9:16 image SHALL stop the proof with evidence, not be silently replaced
- **AND** the proof SHALL NOT create or switch to a `9:16`-specific model configuration

#### Scenario: Proof stops when the budget cannot cover the next call

- **WHEN** the remaining proof budget is below the vertical estimate for the next planned call
- **THEN** the proof SHALL stop before the call
- **AND** the unexecuted combinations SHALL be reported as pending
- **AND** no fallback to the 1024 × 1024 estimate SHALL occur

#### Scenario: Retries and fallback count against the proof budget

- **WHEN** a retry or fallback call is made during the proof
- **THEN** it SHALL consume the same US$ 3.00 proof cap
- **AND** it SHALL count in the executed-call total
- **AND** the UAT budget SHALL NOT be used to cover it

#### Scenario: Planning does not spend money

- **WHEN** this change is still in proposal/design/tasks
- **THEN** no paid provider call, migration or production operation SHALL be executed

### Requirement: Homolog validation uses test stores and real overlays

Functional acceptance SHALL happen first in homolog with test stores (`is_test_store = true`), never in production. It MUST include: vertical generation for each supported intent/background combination used in the acceptance sample; artifact dimensions and format checks; download; recovery; credit behavior; thumbnail; list/detail projection; and a visual review with the overlay of the policy version recorded for the campaign.

For campaigns composed with the new vertical version, the visual review MUST verify that texts, price, offer, CTA, commercial conditions and store identity stay outside the experimental top 15% and bottom 20% bands; product, packaging and complements MAY extend into those bands if recognizable. The review MUST also verify that no empty band or guide is visible, that the background fills the canvas, and that the piece is understandable without the external caption. Historical `safe-area-9-16-v1` campaigns retain their original overlay contract.

#### Scenario: Homolog acceptance covers the vertical path

- **WHEN** the homolog acceptance runs
- **THEN** it SHALL use test stores and a controlled credit balance
- **AND** it SHALL produce evidence for dimensions, download, recovery, credit and thumbnail
- **AND** it SHALL include at least one visual review with the overlay of the campaign's recorded policy version

#### Scenario: Vertical recovery reaches detail and list

- **WHEN** a pending vertical operation is recovered in homolog
- **THEN** the campaign SHALL be delivered and projected with the vertical path
- **AND** detail and list SHALL show the campaign
- **AND** no new provider call or credit SHALL occur

#### Scenario: Flag OFF after creation preserves service

- **WHEN** a vertical campaign is created with the flag ON
- **AND** the flag is turned OFF
- **THEN** query, download, recovery and administrative resolution SHALL remain available
- **AND** a new vertical submission SHALL be rejected before reservation/provider

#### Scenario: Production is not touched

- **WHEN** homolog validation runs
- **THEN** no production campaign, credit, storage object or flag SHALL be altered
- **AND** all operations SHALL be identified as homolog/test-store operations

### Requirement: 1:1 regression is a release gate

The rollout SHALL include a regression gate proving that the Product `1:1` path is unchanged: payload, prompt, provider request, artifact dimensions/path, credit, recovery, download and thumbnail. The gate MUST run the focused existing suites and a manual `1:1` generation in homolog with a test store before vertical can be considered ready.

#### Scenario: Automated 1:1 regression passes

- **WHEN** the focused regression suite runs
- **THEN** existing `1:1` tests SHALL pass without expectation changes
- **AND** a failure SHALL block the vertical release

#### Scenario: Manual 1:1 generation still works

- **WHEN** a test store generates a `1:1` campaign after the vertical changes
- **THEN** the campaign SHALL be delivered as 1024 × 1024 at the existing path
- **AND** download and thumbnail SHALL behave as before

### Requirement: Production is a separate, later gate

Homolog acceptance MUST NOT be presented as production approval. Production enablement SHALL require a separate authorization with its own deployment, flag activation and smoke plan. Until that gate, `product_9_16_enabled` SHALL remain OFF in production and no production data SHALL be migrated or converted.

#### Scenario: Homolog success does not activate production

- **WHEN** homolog acceptance is complete
- **THEN** the production flag SHALL remain OFF
- **AND** the result SHALL be reported as homolog-ready, not production-approved

#### Scenario: Production activation has its own evidence

- **WHEN** production activation is eventually authorized
- **THEN** it SHALL have a deployment record, flag activation record, smoke evidence and rollback path
- **AND** it SHALL NOT rely on this phase's homolog evidence alone

### Requirement: Vertical observability identifies format without exposing sensitive data

Telemetry and diagnostics for the vertical path SHALL identify the format `9:16`, the requested and delivered dimensions, model, quality, attempt target, operation identity and outcome. They MUST NOT persist prompts, API keys, image bytes or user-identifying content beyond the existing campaign references.

#### Scenario: Format is observable

- **WHEN** a vertical generation attempt is recorded
- **THEN** the event SHALL identify format `9:16` and the dimension pair used
- **AND** it SHALL be correlated with the campaign and operation

#### Scenario: Sensitive data is not logged

- **WHEN** vertical diagnostics are inspected
- **THEN** prompts, keys and image bytes SHALL be absent
- **AND** the existing support-reference rules SHALL apply
