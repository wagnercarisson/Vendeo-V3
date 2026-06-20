## MODIFIED Requirements

### Requirement: Visual signature section behavior (visual_signature state)

The `StoreVisualSignatureSection` SHALL reflect the `visual_signature` state based on `identity_state`:

- Currently active states are: `generated`, `explicit_none`, `failed`, `exhausted` (existing)
- **NEW**: When `identity_state = 'visual_signature'`:
  - Show approved signature preview (full width, rounded container)
  - Show "Alterar" button — opens modal with new generation flow
  - Show "Remover" button — triggers DELETE /visual-signature
  - Drop zone SHALL NOT be displayed
  - "Não tenho logo" SHALL NOT be displayed
  - "Continuar sem logo" SHALL NOT be displayed

#### Scenario: visual_signature state shows preview with Alterar/Remover

- **WHEN** `identity_state` is `'visual_signature'`
- **THEN** the signature preview SHALL be displayed
- **AND** "Alterar" and "Remover" buttons SHALL be displayed
- **AND** the drop zone, "Não tenho logo", and "Continuar sem logo" SHALL be hidden

### Requirement: Colors do not invalidate visual signature

Changes to `brand_colors_chosen` (via color picker) are permitted when `identity_state = 'visual_signature'`. Color changes SHALL NOT:
- Trigger drift detection
- Require regeneration of the visual signature
- Alter the visual signature's `content_used` or `input_snapshot`

Colors SHALL be treated as campaign-level context, not signature-level composition.

#### Scenario: Color changes allowed with active VS

- **WHEN** `identity_state` is `'visual_signature'`
- **AND** the user edits colors in Step 2
- **THEN** the color values SHALL be saved normally
- **AND** no drift warning SHALL be shown
- **AND** the visual signature SHALL remain unchanged

### Requirement: UX decision matrix for logo area (visual_signature row)

The UX decision matrix for the logo area SHALL replace the `"(futuro)"` entry for `visual_signature`:

| Estado | Drop zone / Preview | Ação principal | Drop zone | "Não tenho logo" | "Continuar sem logo" | Histórico |
|--------|-------------------|----------------|-----------|-----------------|---------------------|-----------|
| `text_only` | Direção visual | Enviar logo / Criar assinatura | Sim | Sim / Criar assinatura | Não, se direção já existe | "Assinaturas anteriores", se houver |
| `logo` | Logo ativo | Remover logo | Não | Não | Não | Logos anteriores |
| `visual_signature` | **Assinatura ativa** | **Alterar / Remover** | **Não** | **Não** | **Não** | **Assinaturas anteriores** |

#### Scenario: Matrix drives visual_signature logo area rendering

- **WHEN** `identity_state` is `'visual_signature'`
- **THEN** the drop zone SHALL NOT be displayed
- **AND** "Não tenho logo" SHALL NOT be displayed
- **AND** "Continuar sem logo" SHALL NOT be displayed
- **AND** the "Alterar" and "Remover" buttons SHALL be displayed

### Requirement: Remove visual signature button behavior

When the user clicks "Remover" in the `visual_signature` state, the system SHALL:

1. Call `DELETE /api/store/[id]/visual-signature`
2. After successful response, update local state:
   - Set `identity_state` to `'text_only'`
   - Set `logo_status` to `'explicit_none'`
   - Remove signature preview
   - Show drop zone, "Enviar logotipo", "Criar assinatura visual"
   - Show "Assinaturas anteriores" link if archived signatures exist
3. On error: show a dismissible error banner

#### Scenario: Remove VS updates UI to text_only

- **WHEN** the user clicks "Remover" and the DELETE succeeds
- **THEN** the signature preview SHALL be removed
- **AND** the drop zone SHALL appear
- **AND** "Enviar logotipo" and "Criar assinatura visual" buttons SHALL appear
- **AND** color pickers SHALL retain their values (direction preserved)

## ADDED Requirements

### Requirement: Visual signature history modal (separate from logo restore)

The system SHALL provide a modal component for browsing and restoring archived visual signatures. This modal SHALL be separate from the `logo-restore-modal.tsx` (which handles store_brand_assets).

The modal SHALL:
- Title: "Assinaturas anteriores"
- Close button (X) in top right
- Display each archived visual signature as a card containing:
  - Signature thumbnail (loaded from `asset_url`)
  - Date: formatted `created_at`
  - Visual direction (from `artDirectorOutput.visual_direction`)
  - Color palette summary
  - Status: "Assinatura ativa" for current active, "Anterior" for archived
  - "Restaurar" button for archived signatures
- "Cancelar" button at the bottom
- Loading state: spinner while fetching history
- Empty state: "Nenhuma assinatura anterior encontrada"
- Error state: dismissible error banner

The UI SHALL use the `restore_eligibility` field from `GET /api/store/[id]/visual-signature` to determine button state:
- `reason === 'ok'` → "Restaurar" button enabled
- `reason === 'critical_drift'` → button disabled with tooltip: "Os dados da loja mudaram desde esta assinatura. Gere uma nova versão."
- `reason === 'missing_metadata'` → button disabled with tooltip: "Assinatura antiga não pode ser restaurada. Gere uma nova versão."

#### Scenario: Modal shows archived signatures with restore

- **WHEN** the user opens the VS history modal
- **AND** the store has 2 archived visual signatures
- **THEN** 2 signature cards SHALL be displayed, ordered by created_at descending
- **AND** each card SHALL show the thumbnail, date, visual direction, and palette
- **AND** each archived card SHALL have a "Restaurar" button if `reason === 'ok'`

#### Scenario: Drift blocks restore in modal with critical_drift

- **WHEN** a visual signature has `reason === 'critical_drift'`
- **THEN** the "Restaurar" button SHALL be disabled
- **AND** a tooltip SHALL read: "Os dados da loja mudaram desde esta assinatura. Gere uma nova versão."

#### Scenario: Pre-feature signature blocks restore with missing_metadata

- **WHEN** a visual signature has `reason === 'missing_metadata'`
- **THEN** the "Restaurar" button SHALL be disabled
- **AND** a tooltip SHALL read: "Assinatura antiga não pode ser restaurada. Gere uma nova versão."

### Requirement: Flow "Alterar" — new generation from visual_signature state

When the user clicks "Alterar" in the `visual_signature` state, the system SHALL:

1. Call `generate-without-logo` to create a new signature with `status = 'draft'`
2. Open the `VisualSignatureApprovalModal` with the new draft
3. If the user approves: archive the current active signature, set the new one as `active`
4. If the user closes without approving: the draft remains preserved, the original active signature remains unchanged

#### Scenario: Alterar triggers new generation

- **WHEN** the user clicks "Alterar"
- **THEN** a new visual signature SHALL be generated with `status = 'draft'`
- **AND** the approval modal SHALL open

#### Scenario: Approve from Alterar swaps signatures

- **WHEN** the user approves a new signature from "Alterar"
- **THEN** the previous active signature SHALL become `archived`
- **AND** the new signature SHALL become `active`
- **AND** `visual_signature_attempts` SHALL be affected by the new generation count

#### Scenario: Close without approve preserves original

- **WHEN** the user closes the approval modal without approving from "Alterar"
- **THEN** the original active signature SHALL remain `active`
- **AND** the new draft SHALL remain as `draft`
