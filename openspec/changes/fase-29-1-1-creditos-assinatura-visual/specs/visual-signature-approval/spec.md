## MODIFIED Requirements

### Requirement: Approval modal

When the lojista clicks "Não tenho logo" on the Logo e Cores step, the system SHALL present an approval modal/tela showing the generated visual signature.

The modal SHALL display:
- The generated visual signature in preview (~400x400px)
- Button "Aprovar" (primary green style)
- Button "Não gostei, gerar outra versão" (outline style, always active if the store has sufficient credits)

The modal SHALL NOT display an attempt indicator (e.g., "Tentativa X/3").

The modal SHALL accept a mode parameter: `'standard' | 'substitution'`.

- `'standard'` (current): existing behavior, approves VS normally
- `'substitution'`: exceptional flow with additional safety measures, triggered by DriftCriticalModal when user opts to substitute VS in critical drift scenario with available credit

In `'substitution'` mode, the modal SHALL:
- Start in `'checking'` state (not `'generating'`)
- Call POST /generate-without-logo with mode:'substitution' once
- Historical drafts SHALL NOT block the flow
- After generation, transition to standard approval flow with substitution protocol

#### Scenario: Modal shows at first generation

- **WHEN** the first visual signature is generated
- **THEN** the modal SHALL display the signature preview
- **AND** both "Aprovar" and "Não gostei, gerar outra versão" SHALL be active

#### Scenario: Modal always allows new generation (if credits available)

- **WHEN** the lojista has generated 1 or more visual signatures
- **AND** the store has sufficient credits
- **THEN** the "Não gostei, gerar outra versão" button SHALL be active
- **AND** SHALL NOT show attempt counters or limit messaging

#### Scenario: Modal opens in substitution mode

- **WHEN** DriftCriticalModal triggers ApprovalModal
- **THEN** the modal SHALL be in 'substitution' mode
- **AND** the approval flow SHALL execute the substitution protocol

#### Scenario: Substitution mode starts in checking

- **WHEN** ApprovalModal opens with mode:'substitution'
- **THEN** the modal SHALL display a 'checking' state (revalidating drift)
- **AND** SHALL NOT display a 'generating' state initially
- **AND** SHALL call /generate-without-logo once after checking passes

#### Scenario: Historical drafts do not block substitution

- **WHEN** a store has historical draft signatures
- **AND** ApprovalModal opens with mode:'substitution'
- **THEN** the substitution flow SHALL proceed normally
- **AND** historical drafts SHALL NOT block generation or approval

### Requirement: Approval flow

When the lojista clicks "Aprovar", the system SHALL:

1. Set the current visual signature to `active` in `store_visual_signatures`
2. Set any previous active signature to `archived`
3. Set `stores.logo_status` to `generated`
4. Set `stores.identity_state` to `'visual_signature'`
5. Update the `generation_events` record matching `asset_id` and `attempt_number` with `approved = true`
6. **Invoke the Store Brand Profiler with `intendedPalette` from `signature.metadata.artDirectorOutput.intended_palette` and `previousBrandColors` from the last synced profile (if `brand_colors_chosen` has at least one valid HEX)** — `manual_color_override` SHALL NOT be consulted
7. Close the modal
8. Return to the Logo e Cores screen
9. Display the approved visual signature in the store preview
10. Pre-fill primary and accent colors from `safe_color_tokens.primary`/`.accent` (or identity art director's suggested colors as fallback)
11. Allow the lojista to edit colors manually before saving
12. **If the brand profiler fails (`profile.status = 'failed'`)**: the visual signature approval SHALL still succeed. The previous synced profile (if any) SHALL remain valid. The UI SHALL use the previous profile's colors or segment fallback.

The endpoint `POST /api/store/[id]/visual-signature/approve` SHALL accept an optional mode field: `'standard' | 'substitution'`.

Payload:
```json
{
  "signatureId": "uuid",
  "mode": "substitution"
}
```

NOTE: The payload uses `signatureId` (camelCase), not `signature_id` (snake_case), to maintain consistency with existing format.

When mode:'substitution', the endpoint SHALL execute in this order:

1. Revalidate critical drift -- against the currently ACTIVE VS, not the new signatureId
2. Verify pending signature exists for approval
3. Archive previous active VS (verify success before proceeding)
4. Activate new signature ('active')
5. If activation fails: restore previous VS to 'active', return error response (previous VS active, new not active, no BP execution)
6. Execute BrandProfilerWithoutLogo (NORMAL flow, NOT mode:'regenerate' -- regenerate is exclusive to sensitive realinhamento)
7. If BP insert fails: restore previous profile to 'synced', return HTTP 200 with warning (new VS active, previous BP as fallback)

#### Scenario: Approval persists signature and profile

- **WHEN** the lojista clicks "Aprovar"
- **THEN** the visual signature SHALL become `active`
- **AND** `logo_status` SHALL become `generated`
- **AND** `identity_state` SHALL become `'visual_signature'`
- **AND** `visual_signature_attempts` SHALL NOT be reset (coluna mantida, não mais alterada)
- **AND** a brand profile SHALL be created with `source = 'without_logo'` and `intendedPalette` passed to the profiler

#### Scenario: Colors pre-filled after approval

- **WHEN** the lojista returns to Logo e Cores after approval
- **THEN** the primary color input SHALL be pre-filled with `safe_color_tokens.primary` (or suggested_colors as fallback)
- **AND** the accent color input SHALL be pre-filled with `safe_color_tokens.accent` (or suggested_colors as fallback)
- **AND** the color inputs SHALL be editable by the lojista

#### Scenario: Profile failure does not block signature approval

- **WHEN** the brand profiler returns `status = 'failed'`
- **THEN** the visual signature SHALL still be set to `active`
- **AND** `stores.logo_status` SHALL still be set to `generated`
- **AND** the previous synced profile (if exists) SHALL remain unchanged
- **AND** the UI SHALL show colors from the previous profile or segment fallback

#### Scenario: Approve substitution -- full success

- **WHEN** POST /approve is called with mode:'substitution'
- **AND** drift revalidation passes (against active VS, not new signature)
- **AND** a pending VS exists for approval
- **AND** the previous active VS is successfully archived
- **AND** the new VS is successfully activated
- **AND** BP generation succeeds
- **THEN** HTTP 200 SHALL be returned
- **AND** identity_state SHALL remain 'visual_signature'

#### Scenario: Approve substitution -- activation failure restores previous (Tier 1 fail)

- **WHEN** POST /approve is called with mode:'substitution'
- **AND** drift revalidation passes
- **AND** the previous active VS is archived
- **AND** the new VS activation fails
- **THEN** the previous active VS SHALL be restored to 'active'
- **AND** the new VS SHALL NOT be active
- **AND** BP SHALL NOT be executed
- **AND** an error response SHALL be returned

#### Scenario: Approve substitution -- BP generation failure compensation (Tier 2 fail)

- **WHEN** POST /approve is called with mode:'substitution'
- **AND** the previous active VS is archived
- **AND** the new VS is successfully activated
- **AND** BrandProfilerWithoutLogo (normal flow) fails or insert fails
- **THEN** the previous profile SHALL remain 'synced' as fallback
- **AND** HTTP 200 SHALL be returned with `bp_status: 'failed'` and the new `visual_signature_id`
- **AND** the new VS SHALL remain active
- **AND** the response SHALL include a warning that BP can be retried
- **AND** the retry SHALL be performed via POST /brand-profile/realign (which triggers mode:'regenerate' Branch C since no BP exists for the new VS)

### Requirement: Rejection flow

When the lojista clicks "Não gostei, gerar outra versão":

1. The current visual signature asset SHALL be marked as `archived` with metadata: `rejected: true`, optional rejection reason, `attempt_number`
2. The `generation_events` record matching `asset_id` and `attempt_number` SHALL be updated with `rejected = true`
3. An optional text field SHALL be presented: "O que você não gostou?"
4. The system SHALL NOT increment `visual_signature_attempts`
5. Rejection context SHALL be structured and sent to the Store Identity Art Director:
   - If feedback provided: include the lojista's text
   - If no feedback: "A versão anterior foi rejeitada sem feedback específico. Busque uma direção criativa completamente diferente."
6. The next generation SHALL proceed if the store has sufficient credits

#### Scenario: Rejection archives current asset

- **WHEN** the lojista clicks "Não gostei, gerar outra versão"
- **THEN** the current draft signature SHALL be set to `archived`
- **AND** metadata SHALL include `rejected: true` and `attempt_number`

#### Scenario: Rejection with feedback

- **WHEN** the lojista provides feedback text
- **THEN** the feedback SHALL be included in the rejection context sent to the AI
- **AND** the metadata SHALL include the rejection reason

#### Scenario: Rejection without feedback

- **WHEN** the lojista does not provide feedback
- **THEN** the rejection context SHALL state "sem feedback específico"
- **AND** SHALL instruct the AI to seek a completely new direction

#### Scenario: Rejection always proceeds to review (no exhausted state)

- **WHEN** the lojista rejects regardless of how many attempts have been made
- **THEN** the modal SHALL transition to the "review" phase
- **AND** SHALL display available historical signatures
- **AND** the "Gerar nova versão" button SHALL be available if the store has sufficient credits

### Requirement: Close modal without decision

If the lojista closes the approval modal without approving or rejecting:

1. The current draft signature SHALL remain as `draft` in `store_visual_signatures`
2. When the lojista revisits the Logo e Cores screen, the system SHALL detect the pending draft
3. The system SHALL offer to resume from where the lojista left off

#### Scenario: Draft persists after modal close

- **WHEN** the lojista closes the modal without deciding
- **THEN** the latest draft signature SHALL remain with `status = 'draft'`
- **AND** the system SHALL resume the flow on next visit

### Requirement: Error phase — secondary button SHALL close modal without mutations

When the approval modal enters the `"error"` phase (regardless of error origin, including generation, timeout, drift validation, or approval failure), the system SHALL display a secondary button labeled "Cancelar" that closes the modal without persisting any identity decision.

The "Cancelar" button SHALL:
- Call `onClose()` to dismiss the modal
- Not initiate any new requests or persist additional identity decisions

The "Cancelar" button SHALL NOT:
- Execute any fetch/PATCH request
- Call `onComplete()` with any `logoStatus` value
- Initiate any new API request

The resulting state after "Cancelar" continues to be the responsibility of operations already initiated prior to the click.

The primary button label in the error phase SHALL adapt to context:
- When `state.drift` is present: "Ajustar assinatura"
- Otherwise: "Tentar novamente"

#### Scenario: Cancelar closes modal without mutations

- **WHEN** the approval modal is in the `"error"` phase
- **AND** the lojista clicks "Cancelar"
- **THEN** the modal SHALL close
- **AND** `onClose()` SHALL be called
- **AND** `onComplete()` SHALL NOT be called
- **AND** no fetch/PATCH request SHALL be initiated by the click
- **AND** Step 2 SHALL return to its state before the modal opened, subject to any mutations already persisted by prior operations

#### Scenario: Cancelar does not interfere with prior generation

- **WHEN** the lojista clicks "Cancelar" after a generation timeout
- **THEN** the button SHALL NOT initiate any new request
- **AND** a prior generation request may still complete server-side (backend timeout exceeds client timeout)
- **AND** the resulting persisted state MAY diverge from what the client expects on next load

### Requirement: identity_state sync on approval

When the lojista approves a visual signature, the system SHALL update the store's `identity_state` to `'visual_signature'` and `logo_status` to `'generated'` in the same operation.

#### Scenario: Approval sets identity_state to visual_signature

- **WHEN** the lojista clicks "Aprovar"
- **THEN** `stores.identity_state` SHALL be set to `'visual_signature'`
- **AND** `stores.logo_status` SHALL be set to `'generated'`
- **AND** both fields SHALL be updated in the same UPDATE statement

### Requirement: Rejection context propagation to review phase

When the lojista provides rejection feedback in the "feedback" phase, the `rejectionContext` SHALL be preserved in the modal state and propagated to `generate()` when the user chooses to generate a new version from the "review" phase.

The modal SHALL store `rejectionContext` as component state across phases. When the user navigates from "feedback" to "review" (by confirming rejection) and then clicks "Gerar nova versão", the stored `rejectionContext` SHALL be passed to the `generate-without-logo` API call.

#### Scenario: Rejection context passed from feedback to review generate

- **WHEN** the lojista provides feedback in the "feedback" phase
- **AND** confirms the rejection
- **AND** the modal transitions to "review" phase (existing signatures listed)
- **AND** the lojista clicks "Gerar nova versão"
- **THEN** the stored `rejectionContext` SHALL be sent to the `generate-without-logo` API
- **AND** the new generation SHALL include the rejection context in the prompt

#### Scenario: Rejection context preserved across phase transitions

- **WHEN** the lojista rejects without feedback
- **AND** the modal transitions to "review" phase
- **AND** the lojista clicks "Gerar nova versão"
- **THEN** the rejection context SHALL state "sem feedback específico"
- **AND** SHALL instruct to seek a completely new direction

### Requirement: Sequential generation (no batching)

The system SHALL generate exactly 1 visual signature per invocation, sequentially. The system SHALL NOT generate 3 versions at once. Each generation requires the lojista's decision (approve or reject) before the next generation begins.

#### Scenario: One generation per invocation

- **WHEN** the lojista clicks "Não tenho logo"
- **THEN** exactly 1 visual signature SHALL be generated
- **AND** the system SHALL wait for lojista decision before generating another

### Requirement: Insufficient credits phase

When the `generate-without-logo` API returns HTTP 402, the modal SHALL transition to the `"insufficient_credits"` phase.

The `"insufficient_credits"` phase SHALL display:
- Alert icon (AlertCircle from lucide-react, accent-amber color)
- Message: "Créditos insuficientes para gerar assinatura visual."
- Sub-message: "Cada geração de assinatura visual consome 1 crédito."
- Primary CTA button: "Ver meus créditos" linking to `/conta`
- Secondary CTA button: "Tentar novamente" that retries generation

#### Scenario: Modal shows insufficient_credits on 402

- **WHEN** `generate()` receives a response with `status === 402`
- **THEN** the modal SHALL set phase to `"insufficient_credits"`
- **AND** SHALL display the message "Créditos insuficientes para gerar assinatura visual."

#### Scenario: CTA "Ver meus créditos" navigates to /conta

- **WHEN** the lojista clicks "Ver meus créditos" in the insufficient_credits phase
- **THEN** the browser SHALL navigate to `/conta`

#### Scenario: CTA "Tentar novamente" retries generation

- **WHEN** the lojista clicks "Tentar novamente" in the insufficient_credits phase
- **THEN** the modal SHALL call `generate()` again

### Requirement: Review phase loads limited history

When the modal enters the `"checking"` phase, the system SHALL load the 6 most recent visual signatures via `GET /api/store/[id]/visual-signature?limit=6`.

If `total > 6`, the review phase SHALL display a non-clickable indicator: "Há mais versões no histórico. Galeria completa em breve."

If the store generates without sufficient credits, the API returns 402 and the modal transitions to `insufficient_credits`. No proactive balance check is performed in the UI.

#### Scenario: Review loads up to 6 signatures

- **WHEN** the modal enters the checking phase
- **THEN** the system SHALL call `GET /api/store/[id]/visual-signature?limit=6`
- **AND** display up to 6 signatures in the review grid

#### Scenario: Indicator shown when more than 6 signatures exist

- **WHEN** `total > 6` is returned by the API
- **THEN** the review phase SHALL display a non-clickable indicator
- **AND** the indicator SHALL read "Há mais versões no histórico. Galeria completa em breve."

#### Scenario: No exhausted state for historical signatures

- **WHEN** the modal loads historical signatures via the checking phase
- **THEN** the modal SHALL NOT transition to an "exhausted" phase
- **AND** SHALL always display the review phase if signatures exist
- **AND** SHALL proceed to generate if no signatures exist and credits are sufficient

### Requirement: Visual signature remains active on profiler failure

When the brand profiler fails (`status = 'failed'`), the approved visual signature SHALL remain `active`. The profile failure is isolated from the signature approval. The system SHALL:
- Keep `store_visual_signatures` status as `active`
- Log the profile failure in the profile's `metadata.color_validation`
- NOT roll back the signature approval
- Keep the previous synced profile (if exists) unchanged
- Allow future retry of profile generation

#### Scenario: Signature active despite profile failure

- **WHEN** the brand profiler returns `status = 'failed'` with `global_status = 'vision_failed'`
- **THEN** the visual signature SHALL remain `active`
- **AND** `store_visual_signatures` SHALL NOT be rolled back
- **AND** the previous synced profile (if exists) SHALL remain `synced`

### Requirement: Guardas do approve mode substitution

The endpoint SHALL validate before executing:

1. signatureId corresponds to a pending VS for the store
2. mode is 'substitution' and is authorized
3. store identity_state is 'visual_signature'
4. Active VS exists
5. Critical drift revalidated server-side -- against the currently ACTIVE VS, NOT against the new signatureId

Guard failure -> 4xx with specific message.

#### Scenario: Approve substitution guard blocks wrong identity_state

- **WHEN** POST /approve is called with mode:'substitution'
- **AND** identity_state is not 'visual_signature'
- **THEN** HTTP 4xx SHALL be returned

#### Scenario: Approve substitution guard blocks no active VS

- **WHEN** POST /approve is called with mode:'substitution'
- **AND** no active VS exists
- **THEN** HTTP 4xx SHALL be returned

#### Scenario: Drift revalidated against active VS, not new signature

- **WHEN** POST /approve is called with mode:'substitution'
- **THEN** drift SHALL be revalidated against the currently ACTIVE visual signature
- **AND** SHALL NOT be revalidated against the new signatureId

## REMOVED Requirements

### Requirement: Rejection at exhausted attempts

**Reason**: Cota fixa de 3 tentativas removida (D1). O usuário pode gerar quantas VS quiser, limitado apenas pelo saldo de créditos. A rejeição sempre permite nova geração.

**Migration**: Remover bloco `currentAttempts >= 3` em `reject/route.ts`. Remover fase `"exhausted"` do `VisualSignatureApprovalModal`. Remover toda a renderização associada (3 cards de reavaliação, "Continuar sem logo", "Limite de 3 versões atingido"). O review agora sempre mostra as signatures disponíveis e permite geração se houver créditos.

### Requirement: Generation attempt tracking

**Reason**: `visual_signature_attempts` deixa de ser autoridade de produto (D7). A coluna é mantida sem migration, mas não é mais incrementada, resetada ou consultada como regra de negócio.

**Migration**: Remover `store.update({ visual_signature_attempts: attemptNumber })` de `generate-without-logo/route.ts`. Remover `store.update({ visual_signature_attempts: 0 })` de `approve/route.ts`. Remover badge "Tentativa X/3" do modal. Remover todo guard baseado em `visual_signature_attempts`.
