## MODIFIED Requirements

### Requirement: Approval modal

When the lojista clicks "Nao tenho logo" on the Logo e Cores step, the system SHALL present an approval modal/tela showing the generated visual signature.

The modal SHALL display:
- The generated visual signature in preview (~400x400px)
- Current attempt indicator (1/3, 2/3, 3/3)
- Button "Aprovar" (primary green style)
- Button "Nao gostei, gerar outra versao" (outline style, only active when attempts < 3)

At attempt 3/3, the "Nao gostei, gerar outra versao" button SHALL be inactive with tooltip "Limite de 3 versoes atingido".

At attempt 3/3, the system SHALL display all 3 generated signatures for re-evaluation, allowing the lojista to approve any of them or continue without logo.

The modal SHALL accept a mode parameter: 'standard' | 'substitution'.

- 'standard' (current): existing behavior, approves VS normally
- 'substitution': exceptional flow with additional safety measures, triggered by DriftCriticalModal when user opts to substitute VS in critical drift scenario with available credit

In 'substitution' mode, the modal SHALL:
- Start in 'checking' state (not 'generating')
- Call POST /generate-without-logo with mode:'substitution' once
- Historical drafts SHALL NOT block the flow
- After generation, transition to standard approval flow with substitution protocol

#### Scenario: Modal shows at attempt 1/3

- WHEN the first visual signature is generated
- THEN the modal SHALL display the signature preview
- AND show "1/3" attempt indicator
- AND both "Aprovar" and "Nao gostei, gerar outra versao" SHALL be active

#### Scenario: Modal blocks re-generation at 3/3

- WHEN attempt is 3/3
- THEN "Nao gostei, gerar outra versao" SHALL be inactive
- AND a tooltip SHALL read "Limite de 3 versoes atingido"

#### Scenario: Exhausted attempts show all signatures

- WHEN attempt is 3/3
- THEN the modal SHALL display all 3 generated signatures side by side
- AND the lojista SHALL be able to select and approve any of them
- AND a "Continuar sem logo" option SHALL be available

#### Scenario: Modal opens in substitution mode

- WHEN DriftCriticalModal triggers ApprovalModal
- THEN the modal SHALL be in 'substitution' mode
- AND the approval flow SHALL execute the substitution protocol

#### Scenario: Substitution mode starts in checking

- WHEN ApprovalModal opens with mode:'substitution'
- THEN the modal SHALL display a 'checking' state (revalidating drift)
- AND SHALL NOT display a 'generating' state initially
- AND SHALL call /generate-without-logo once after checking passes

#### Scenario: Historical drafts do not block substitution

- WHEN a store has historical draft signatures
- AND ApprovalModal opens with mode:'substitution'
- THEN the substitution flow SHALL proceed normally
- AND historical drafts SHALL NOT block generation or approval

### Requirement: Approval flow

When the lojista clicks "Aprovar", the system SHALL:

1. Set the current visual signature to 'active' in store_visual_signatures
2. Set any previous active signature to 'archived'
3. Set stores.logo_status to 'generated'
4. Reset stores.visual_signature_attempts to 0
5. Set stores.identity_state to 'visual_signature'
6. Update the generation_events record matching asset_id and attempt_number with approved = true
7. **Invoke the Store Brand Profiler with intendedPalette from signature.metadata.artDirectorOutput.intended_palette and previousBrandColors from the last synced profile (if brand_colors_chosen has at least one valid HEX)** -- manual_color_override SHALL NOT be consulted
8. Close the modal
9. Return to the Logo e Cores screen
10. Display the approved visual signature in the store preview
11. Pre-fill primary and accent colors from safe_color_tokens.primary/.accent (or identity art director's suggested colors as fallback)
12. Allow the lojista to edit colors manually before saving
13. **If the brand profiler fails (profile.status = 'failed')**: the visual signature approval SHALL still succeed. The previous synced profile (if any) SHALL remain valid. The UI SHALL use the previous profile's colors or segment fallback.

The endpoint POST /api/store/[id]/visual-signature/approve SHALL accept an optional mode field: 'standard' | 'substitution'.

Payload:
{
  "signatureId": "uuid",
  "mode": "substitution"  // optional, default: 'standard'
}

NOTE: The payload uses signatureId (camelCase), not signature_id (snake_case), to maintain consistency with existing format.

When mode:'substitution', the endpoint SHALL execute in this order:

1. Revalidate critical drift -- against the currently ACTIVE VS, not the new signatureId
2. Verify pending signature exists for approval
3. Archive previous active VS (verify success before proceeding)
4. Activate new signature ('active')
5. If activation fails: restore previous VS to 'active', return error response (previous VS active, new not active, no BP execution)
6. Execute BrandProfilerWithoutLogo (NORMAL flow, NOT mode:'regenerate' -- regenerate is exclusive to sensitive realinhamento)
7. If BP insert fails: restore previous profile to 'synced', return HTTP 200 with warning (new VS active, previous BP as fallback)

#### Scenario: Approval persists signature and profile

- WHEN the lojista clicks "Aprovar"
- THEN the visual signature SHALL become 'active'
- AND logo_status SHALL become 'generated'
- AND identity_state SHALL become 'visual_signature'
- AND visual_signature_attempts SHALL reset to 0
- AND a brand profile SHALL be created with source = 'without_logo' and intendedPalette passed to the profiler

#### Scenario: Colors pre-filled after approval

- WHEN the lojista returns to Logo e Cores after approval
- THEN the primary color input SHALL be pre-filled with safe_color_tokens.primary (or suggested_colors as fallback)
- AND the accent color input SHALL be pre-filled with safe_color_tokens.accent (or suggested_colors as fallback)
- AND the color inputs SHALL be editable by the lojista

#### Scenario: Profile failure does not block signature approval

- WHEN the brand profiler returns status = 'failed'
- THEN the visual signature SHALL still be set to 'active'
- AND stores.logo_status SHALL still be set to 'generated'
- AND the previous synced profile (if exists) SHALL remain unchanged
- AND the UI SHALL show colors from the previous profile or segment fallback

#### Scenario: Approve substitution -- full success

- WHEN POST /approve is called with mode:'substitution'
- AND drift revalidation passes (against active VS, not new signature)
- AND a pending VS exists for approval
- AND the previous active VS is successfully archived
- AND the new VS is successfully activated
- AND BP generation succeeds
- THEN HTTP 200 SHALL be returned
- AND identity_state SHALL remain 'visual_signature'

#### Scenario: Approve substitution -- activation failure restores previous (Tier 1 fail)

- WHEN POST /approve is called with mode:'substitution'
- AND drift revalidation passes
- AND the previous active VS is archived
- AND the new VS activation fails
- THEN the previous active VS SHALL be restored to 'active'
- AND the new VS SHALL NOT be active
- AND BP SHALL NOT be executed
- AND an error response SHALL be returned

#### Scenario: Approve substitution -- BP generation failure compensation (Tier 2 fail)

- WHEN POST /approve is called with mode:'substitution'
- AND the previous active VS is archived
- AND the new VS is successfully activated
- AND BrandProfilerWithoutLogo (normal flow) fails or insert fails
- THEN the previous profile SHALL remain 'synced' as fallback
- AND HTTP 200 SHALL be returned with `bp_status: 'failed'` and the new `visual_signature_id`
- AND the new VS SHALL remain active
- AND the response SHALL include a warning that BP can be retried
- AND the retry SHALL be performed via POST /brand-profile/realign (which triggers mode:'regenerate' Branch C since no BP exists for the new VS)

### Requirement: Guardas do approve mode substitution

The endpoint SHALL validate before executing:

1. signatureId corresponds to a pending VS for the store
2. mode is 'substitution' and is authorized
3. store identity_state is 'visual_signature'
4. Active VS exists
5. Critical drift revalidated server-side -- against the currently ACTIVE VS, NOT against the new signatureId

Guard failure -> 4xx with specific message.

#### Scenario: Approve substitution guard blocks wrong identity_state

- WHEN POST /approve is called with mode:'substitution'
- AND identity_state is not 'visual_signature'
- THEN HTTP 4xx SHALL be returned

#### Scenario: Approve substitution guard blocks no active VS

- WHEN POST /approve is called with mode:'substitution'
- AND no active VS exists
- THEN HTTP 4xx SHALL be returned

#### Scenario: Drift revalidated against active VS, not new signature

- WHEN POST /approve is called with mode:'substitution'
- THEN drift SHALL be revalidated against the currently ACTIVE visual signature
- AND SHALL NOT be revalidated against the new signatureId