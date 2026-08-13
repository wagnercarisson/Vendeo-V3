# Identity-Aware Campaign Briefing

## RENAMED Requirements

- FROM: `### Requirement: CampaignBrief internal type`
- TO: `### Requirement: ResolvedCampaignContext internal type`

## MODIFIED Requirements

### Requirement: ResolvedCampaignContext internal type

The system SHALL define a `ResolvedCampaignContext` TypeScript interface (no Zod) as the internal contract between identity resolution and image generation. `ResolvedCampaignContext` SHALL be constructed and consumed exclusively in the backend — never serialized to the client.

> Renamed from `CampaignBrief internal type` by `fase-39-brief-estruturado-campanha` (D4). O wrapper de transporte passa a chamar-se `ResolvedCampaignContext`; o nome `CampaignBrief` agora designa **o contrato de domínio estruturado** (`src/lib/campaign/brief.ts`).

`ResolvedCampaignContext` SHALL contain:
- `campaignInput`: transparent transport of ALL current campaign fields from the client request — `productName`, `originalPriceCents`, `discountedPriceCents`, `badgeText`, `description`, `productImageDataUrl`, `inputValidationOverride`, `hook`, `cta`, `objective`, `campaignDetails`, `additionalDetails`, `targetChannel`, `format`, `validity`, `availabilityNotes`, `sensitiveConstraints`. None of these fields SHALL be modified, reinterpreted, or given new defaults during Context construction.
- `store: { name, segment, subsegment, toneOfVoice, positioning, shortDescription, slogan, brandColor }`
- `brandProfile: BrandProfileSnapshot | null`
- `identity: { state: IdentityState, imageUrl: string | null, directive: string }`

The `directive` field SHALL be derived from `(identityState, imageUrl !== null)` according to the 5-scenario table. `ResolvedCampaignContext` SHALL NOT include any fields beyond these four groups.

#### Scenario: ResolvedCampaignContext contains campaignInput as transparent transport

- **WHEN** `buildCampaignBrief()` is called
- **THEN** the returned `ResolvedCampaignContext` SHALL contain `campaignInput` with all original client fields
- **AND** none of the `campaignInput` fields SHALL be modified or reinterpreted

#### Scenario: ResolvedCampaignContext contains identity with directive

- **WHEN** `buildCampaignBrief()` is called with a validated snapshot
- **THEN** `identity.directive` SHALL NOT be empty
- **AND** `identity.state` and `identity.imageUrl` SHALL reflect the validated identity

### MODIFIED Requirement: buildCampaignBrief derives directive

The system SHALL provide `buildCampaignBrief(snapshot: StoreIdentitySnapshot, campaignInput: CampaignInput): ResolvedCampaignContext` that:
1. Receives a snapshot already validated by `validateIdentityReference`
2. Derives `directive` exclusively from `identityState` and `signature.url` presence (5 scenarios)
3. Passes `campaignInput` through as-is (no modification, no reinterpretation)
4. Returns a complete `ResolvedCampaignContext` ready for `ImageGenerationService`

> Modified by `fase-39-brief-estruturado-campanha` (D4): a função `buildCampaignBrief` (`src/lib/store-identity-service.ts`) passa a retornar `ResolvedCampaignContext` (renomeado de `CampaignBrief`), mantendo o shape consumido pelos callers do pipeline.

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

#### Scenario: buildCampaignBrief retorna ResolvedCampaignContext sem quebrar callers

- **WHEN** `buildCampaignBrief` é chamado pelos callers existentes do pipeline
- **THEN** o retorno é `ResolvedCampaignContext` com o mesmo shape de antes (D4)
- **AND** nenhum caller existente é quebrado (mesmo shape, mesmo campo `campaignInput`)
