> **Purpose**: Defines the visual signature approval flow for stores without a logo — the modal/tela presented to the lojista after generation, including approval, rejection with re-generation, review of historical versions, and insufficient credits handling.
>
> > Modified by `fase-38-credit-operation-costs` (MODIFIED). `Insufficient credits phase` sub-message shows dynamic cost of `visual_signature_generation` via `useOperationCosts` with correct plural; no presumed "1 crédito" on 503.

## Requirements

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

**O guard legal é aplicado em duas camadas:**

**Camada 1 — API Route (autoritativa, server-side):**
A API `POST .../generate-without-logo` SHALL call `requireLegalClearance({ storeId, userId, capability: "content_generation" })` at the start of the handler, BEFORE any generation operation. If clearance fails, the API SHALL return HTTP 403 with JSON `{ error: { message, reason, requiredDocuments, acceptUrl: "/legal/reaccept" } }`.

**Camada 2 — Client (UX):**
The modal (`visual-signature-approval-modal.tsx`, `"use client"`) SHALL consult `GET /api/legal/status` before starting the generation flow. If `acceptanceStatus !== "current"`, the modal SHALL display a blocking message with a link to `/legal/reaccept` and SHALL NOT proceed with generation. If clearance passes, the modal SHALL proceed with the normal VS generation flow.

All existing behavior ('standard' and 'substitution' modes, approval, re-generation, historical versions, credit handling) SHALL remain unchanged when clearance passes.

#### Scenario: VS generation blocked by legal clearance (API layer)

- **WHEN** a user submits a VS generation request to the API
- **AND** legal clearance fails
- **THEN** the API SHALL return HTTP 403
- **AND** no generation operation SHALL be performed
- **AND** the response SHALL include `acceptUrl: "/legal/reaccept"`

#### Scenario: VS generation blocked by legal clearance (client layer)

- **WHEN** a user tries to generate a visual signature via the modal
- **AND** `GET /api/legal/status` returns `acceptanceStatus !== "current"`
- **THEN** the modal SHALL display a blocking message
- **AND** SHALL NOT call the generation API
- **AND** SHALL link to `/legal/reaccept`

#### Scenario: VS generation proceeds when clearance passes

- **WHEN** both API and client clearance checks pass
- **THEN** the modal SHALL proceed with the normal VS generation flow
- **AND** the API SHALL execute the generation operation

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
  "mode": "substitution"  // optional, default: 'standard'
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

When the lojista approves a visual signature, the system SHALL update the store's `identity_state` to `'visual_signature'` and `logo_status` to `'generated'` in the same operation. This ensures the UI (Step 2) reflects the active visual signature state.

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

### Requirement: Approval route — brand profiler invocation (updated)

When invoking the Store Brand Profiler during visual signature approval, the system SHALL:

1. Load `signature.metadata.artDirectorOutput.intended_palette` from the approved visual signature
2. Re-apply `normalizeIntendedPalette()` (idempotent)
3. If `intended_palette` is missing or normalization returns `null`, set `intendedPalette = null`
4. Load `previousBrandColors` from the last synced brand profile — only if that profile has `brand_colors_chosen` with at least one valid HEX, otherwise `previousBrandColors = []`
5. Pass both as `BrandProfilerInput.intendedPalette` and `BrandProfilerInput.previousBrandColors`

`manual_color_override.enabled` SHALL NOT be consulted for this decision.

#### Scenario: previousBrandColors loaded from brand_colors_chosen

- **WHEN** the last synced profile has `brand_colors_chosen = ["#FF6600", null]`
- **THEN** `previousBrandColors = ["#FF6600", null]` SHALL be passed to the profiler

#### Scenario: previousBrandColors empty when no user choice

- **WHEN** the last synced profile has `brand_colors_chosen = []`
- **THEN** `previousBrandColors = []` SHALL be passed to the profiler

#### Scenario: manual_color_override not consulted

- **WHEN** the last synced profile has `manual_color_override.enabled = false` but `brand_colors_chosen = ["#FF6600", null]`
- **THEN** `previousBrandColors = ["#FF6600", null]` SHALL be passed to the profiler
- **AND** `manual_color_override` SHALL NOT be checked

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

### Requirement: Insufficient credits phase

> **Delta F38 (D11):** A sub-message "Cada geração de assinatura visual consome 1 crédito." SHALL passar a exibir o custo **dinâmico** de `visual_signature_generation` via hook `useOperationCosts()`, com plural correto. Se o custo estiver indisponível (`503 operation_cost_unavailable`), o modal NÃO mostra "1 crédito" presumido.

When the `generate-without-logo` API returns HTTP 402, the modal SHALL transition to the `"insufficient_credits"` phase.

The `"insufficient_credits"` phase SHALL display:
- Alert icon (AlertCircle from lucide-react, accent-amber color)
- Message: "Créditos insuficientes para gerar assinatura visual."
- Sub-message: "Cada geração de assinatura visual consome {cost} crédito(s)." (custo dinâmico de `visual_signature_generation`)
- Primary CTA button: "Ver meus créditos" linking to `/conta`
- Secondary CTA button: "Tentar novamente" that retries generation

#### Scenario: Modal shows insufficient_credits on 402

- **WHEN** `generate()` receives a response with `status === 402`
- **THEN** the modal SHALL set phase to `"insufficient_credits"`
- **AND** SHALL display the message "Créditos insuficientes para gerar assinatura visual."

#### Scenario: Modal shows dynamic cost in sub-message

- **WHEN** o custo de `visual_signature_generation` é 2
- **THEN** a sub-message exibe "Cada geração de assinatura visual consome 2 créditos."

#### Scenario: Modal shows plural correctly for cost 1

- **WHEN** o custo de `visual_signature_generation` é 1
- **THEN** a sub-message exibe "Cada geração de assinatura visual consome 1 crédito."

#### Scenario: Modal does not show presumed cost when unavailable

- **WHEN** `GET /api/operation-costs` responde `503 operation_cost_unavailable`
- **THEN** o modal NÃO exibe "consome 1 crédito" presumido na sub-message

#### Scenario: CTA "Ver meus créditos" navigates to /conta

- **WHEN** the lojista clicks "Ver meus créditos" in the insufficient_credits phase
- **THEN** the browser SHALL navigate to `/conta`

#### Scenario: CTA "Tentar novamente" retries generation

- **WHEN** the lojista clicks "Tentar novamente" in the insufficient_credits phase
- **THEN** the modal SHALL call `generate()` again

### Requirement: Drift validation on approve covers draft

The POST /api/store/[id]/visual-signature/approve endpoint SHALL validate drift for both `draft` and `archived` signatures before activating.

The endpoint SHALL compare the current store data against `input_snapshot` captured at generation time. The drift validation guard condition SHALL check `signature.status !== 'active'` (instead of the previous `signature.status === 'archived'`), ensuring both `archived` and `draft` signatures undergo drift validation before approval.

If the signature has status `draft` and was just generated (input_snapshot matches current store data), the drift validation SHALL pass without blocking — the snapshot was captured at generation time with identical values.

If the signature has status `draft` and was generated with a previous store snapshot that differs from current data (drift detected), the endpoint SHALL block the approval with the same drift response as for archived signatures.

If the signature has status `active`, the endpoint SHALL skip drift validation entirely (active signatures are already in use).

#### Scenario: Draft without drift passes approval

- **WHEN** POST /approve is called with a `draft` signature
- **AND** `input_snapshot` matches current store data
- **THEN** drift validation SHALL pass
- **AND** the signature SHALL be activated

#### Scenario: Draft with drift blocks approval

- **WHEN** POST /approve is called with a `draft` signature
- **AND** `input_snapshot` differs from current store data
- **THEN** drift validation SHALL block with critical_drift response

#### Scenario: Draft without input_snapshot blocks approval

- **WHEN** POST /approve is called with a `draft` signature
- **AND** metadata has no `input_snapshot`
- **THEN** drift validation SHALL block with missing_metadata response

#### Scenario: Active signature skips drift validation

- **WHEN** POST /approve is called with an `active` signature
- **THEN** drift validation SHALL be skipped entirely

### Requirement: Review phase loads limited history

When the modal enters the `"checking"` phase, the system SHALL load the 6 most recent visual signatures via `GET /api/store/[id]/visual-signature?limit=6`.

If the store generates without sufficient credits, the API returns 402 and the modal transitions to `insufficient_credits`. No proactive balance check is performed in the UI.

#### Scenario: Review loads up to 6 signatures

- **WHEN** the modal enters the checking phase
- **THEN** the system SHALL call `GET /api/store/[id]/visual-signature?limit=6`
- **AND** display up to 6 signatures in the review grid

#### Scenario: No exhausted state for historical signatures

- **WHEN** the modal loads historical signatures via the checking phase
- **THEN** the modal SHALL NOT transition to an "exhausted" phase
- **AND** SHALL always display the review phase if signatures exist
- **AND** SHALL proceed to generate if no signatures exist and credits are sufficient

### Requirement: Gallery link in review phase

The VisualSignatureApprovalModal SHALL accept an optional prop `onOpenGallery?: () => void`.

When `onOpenGallery` is provided AND `totalSignatures > 6`, the review phase SHALL display a clickable link "Ver versões recentes" (instead of the previous non-clickable placeholder).

When `onOpenGallery` is NOT provided, the review phase SHALL display the existing non-clickable indicator "Há mais versões no histórico. Galeria completa em breve." — maintaining backward compatibility.

When `totalSignatures <= 6`, neither the link nor the placeholder SHALL be displayed.

The link SHALL:
- Use `text-accent-blue` color, `hover:text-accent-blue/80`, underline, `font-body`, `transition-colors duration-200`
- Call `onOpenGallery()` when clicked
- Be rendered as a `<button type="button">` element

#### Scenario: onOpenGallery provided + total > 6 shows link

- **WHEN** `onOpenGallery` is a function
- **AND** `totalSignatures > 6`
- **THEN** the review phase SHALL display "Ver versões recentes" as a clickable link
- **AND** clicking the link SHALL call `onOpenGallery()`

#### Scenario: onOpenGallery not provided shows non-clickable indicator

- **WHEN** `onOpenGallery` is undefined
- **AND** `totalSignatures > 6`
- **THEN** the review phase SHALL display the non-clickable indicator "Há mais versões no histórico. Galeria completa em breve."

#### Scenario: total <= 6 hides both link and indicator

- **WHEN** `totalSignatures <= 6`
- **THEN** neither the link nor the indicator SHALL be displayed
