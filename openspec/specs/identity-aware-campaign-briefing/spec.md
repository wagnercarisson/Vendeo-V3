# Identity-Aware Campaign Briefing

## Purpose

Defines the identity-aware campaign briefing layer: `CampaignBrief` internal type, `resolveStoreIdentity` declarative pipeline, `validateIdentityReference` accessibility check, and `buildCampaignBrief` directive derivation. This layer connects store identity resolution to image generation with full awareness of identity state, asset availability, and brand profile context.

## Requirements

### Requirement: CampaignBrief internal type

The system SHALL define a `CampaignBrief` TypeScript interface (no Zod) as the internal contract between identity resolution and image generation. `CampaignBrief` SHALL be constructed and consumed exclusively in the backend — never serialized to the client.

`CampaignBrief` SHALL contain:
- `campaignInput`: transparent transport of ALL current campaign fields from the client request — `productName`, `originalPriceCents`, `discountedPriceCents`, `badgeText`, `description`, `productImageDataUrl`, `inputValidationOverride`, `hook`, `cta`, `objective`, `campaignDetails`, `additionalDetails`, `targetChannel`, `format`, `validity`, `availabilityNotes`, `sensitiveConstraints`. None of these fields SHALL be modified, reinterpreted, or given new defaults during Brief construction.
- `store: { name, segment, subsegment, toneOfVoice, positioning, shortDescription, slogan, brandColor }`
- `brandProfile: BrandProfileSnapshot | null`
- `identity: { state: IdentityState, imageUrl: string | null, directive: string }`

The `directive` field SHALL be derived from `(identityState, imageUrl !== null)` according to the 5-scenario table. `CampaignBrief` SHALL NOT include any fields beyond these four groups.

#### Scenario: CampaignBrief contains campaignInput as transparent transport

- **WHEN** `buildCampaignBrief()` is called
- **THEN** the returned `CampaignBrief` SHALL contain `campaignInput` with all original client fields
- **AND** none of the `campaignInput` fields SHALL be modified or reinterpreted

#### Scenario: CampaignBrief contains identity with directive

- **WHEN** `buildCampaignBrief()` is called with a validated snapshot
- **THEN** `identity.directive` SHALL NOT be empty
- **AND** `identity.state` and `identity.imageUrl` SHALL reflect the validated identity

### Requirement: resolveStoreIdentity declarative pipeline

`resolveStoreIdentity(storeId)` SHALL be a declarative pipeline:
1. Read store row + `identity_state` (canonical source, 1 query)
2. Read brand profile `synced` (1 query, at most one per store per constraint)
3. If `identity_state` expects an asset (`logo` or `visual_signature`), read corresponding asset record
4. If asset record or `storage_path` is absent: `signature.url = null`, log diagnostic, do not alter persisted state
5. If `profile.source` is incompatible with `identity_state`: log diagnostic, do not block
6. Return `StoreIdentitySnapshot` with `identityState`, `signature`, and `brandProfile`

`resolveStoreIdentity` SHALL NOT derive directive — this responsibility belongs to `buildCampaignBrief`.

#### Scenario: text_only store returns no asset

- **WHEN** `resolveStoreIdentity` resolves a store with `identity_state = 'text_only'`
- **THEN** the snapshot SHALL have `identityState = 'text_only'`
- **AND** `signature.url` SHALL be `null`

#### Scenario: logo store with asset returns logo URL

- **WHEN** `resolveStoreIdentity` resolves a store with `identity_state = 'logo'`
- **AND** an active logo asset exists
- **THEN** `identityState` SHALL be `'logo'`
- **AND** `signature.url` SHALL be the logo's public URL

#### Scenario: logo store without asset returns null URL

- **WHEN** `resolveStoreIdentity` resolves a store with `identity_state = 'logo'`
- **AND** no active logo asset is found
- **THEN** `identityState` SHALL be `'logo'`
- **AND** `signature.url` SHALL be `null`
- **AND** a diagnostic SHALL be logged

### Requirement: validateIdentityReference

The system SHALL provide `validateIdentityReference(snapshot: StoreIdentitySnapshot): Promise<StoreIdentitySnapshot>` that validates the accessibility of `signature.url` before the directive is derived.

The function SHALL:
- Perform a HEAD/GET fetch of `signature.url` with a short timeout
- On success: return the snapshot unmodified
- On failure (HTTP error, timeout, network error): return a **copy** of the snapshot with `signature.url = null`
- Log a diagnostic on failure
- NEVER modify the persisted store state

#### Scenario: Valid URL returns snapshot unchanged

- **WHEN** `validateIdentityReference` is called with a snapshot containing a reachable `signature.url`
- **THEN** the returned snapshot SHALL have `signature.url` unchanged
- **AND** the return SHALL be a new object (copy), not the original reference

#### Scenario: Unreachable URL returns nulled copy

- **WHEN** `validateIdentityReference` is called with a snapshot containing an unreachable `signature.url`
- **THEN** the returned snapshot SHALL have `signature.url = null`
- **AND** `identityState` SHALL be preserved (unchanged)
- **AND** a diagnostic SHALL be logged

#### Scenario: Null URL returns copy without fetch

- **WHEN** `validateIdentityReference` is called with a snapshot where `signature.url` is `null`
- **THEN** the function SHALL return a copy immediately without executing an HTTP fetch
- **AND** no diagnostic SHALL be logged

### Requirement: buildCampaignBrief derives directive

The system SHALL provide `buildCampaignBrief(snapshot: StoreIdentitySnapshot, campaignInput: CampaignInput): CampaignBrief` that:
1. Receives a snapshot already validated by `validateIdentityReference`
2. Derives `directive` exclusively from `identityState` and `signature.url` presence (5 scenarios)
3. Passes `campaignInput` through as-is (no modification, no reinterpretation)
4. Returns a complete `CampaignBrief` ready for `ImageGenerationService`

#### Scenario: Directive for logo with asset

- **WHEN** `identityState = 'logo'` and `signature.url` is a valid URL
- **THEN** the derived directive SHALL be "Assinar a campanha com o logotipo da loja. Considerar a direção visual do perfil de marca como contexto direcional, não obrigatório."

#### Scenario: Directive for logo without asset

- **WHEN** `identityState = 'logo'` and `signature.url` is `null`
- **THEN** the derived directive SHALL be "Não inventar logotipo. Usar apenas a direção visual do perfil de marca como contexto direcional, não obrigatório."

#### Scenario: Directive for text_only

- **WHEN** `identityState = 'text_only'`
- **THEN** the derived directive SHALL be "Não colocar logotipo. Não gerar assinatura visual. Considerar a direção visual do perfil de marca como contexto direcional, não obrigatório."

#### Scenario: Directive for VS with asset

- **WHEN** `identityState = 'visual_signature'` and `signature.url` is a valid URL
- **THEN** the derived directive SHALL be "Assinar a campanha com a assinatura visual da loja. Não adicionar logotipo. Considerar a direção visual do perfil de marca como contexto direcional, não obrigatório."

#### Scenario: Directive for VS without asset

- **WHEN** `identityState = 'visual_signature'` and `signature.url` is `null`
- **THEN** the derived directive SHALL be "Não inventar assinatura visual nem logotipo. Considerar apenas a direção visual do perfil de marca como contexto direcional, não obrigatório."
