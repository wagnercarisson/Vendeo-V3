> **Purpose**: Delta spec for store-identity-ui capability — remove restore modal, history link, and restore button. Adjust post-removal state and decision matrix.

## REMOVED Requirements

### Requirement: Restore modal

**Reason**: Logo restore is no longer supported. Excluir = irreversível. The modal that listed archived logos with restore functionality is removed entirely.

**Migration**: Remove the `LogoRestoreModal` component, its imports, and any state controlling its visibility. Archived logos remain in the database but are no longer accessible through the UI.

### Requirement: Restore button triggers POST /logo/restore

**Reason**: The restore endpoint is removed. The "Restaurar" and "Restaurar c/ realinh" buttons that triggered `POST /logo/restore` no longer exist.

**Migration**: Remove the `handleRestore` logic and all associated UI elements.

### Requirement: Visual signature history modal (separate from logo restore)

**Reason**: The reference to `logo-restore-modal.tsx` is no longer valid — the component is being removed. The visual signature history modal is a separate concern and its canonical requirement must not reference the removed component.

**Migration**: The canonical requirement is renamed to "Visual signature history modal" without the parenthetical "(separate from logo restore)". All VS restore behavior is preserved.

## ADDED Requirements

### Requirement: Visual signature history modal

The system SHALL provide a modal component for browsing and restoring archived visual signatures.

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

## MODIFIED Requirements

### Requirement: UX decision matrix for logo area

The logo area visibility in Step 2 SHALL follow this updated decision matrix:

| Estado | Drop zone / Preview | Botões | "Continuar sem logo" | "Logotipos anteriores" |
|--------|-------------------|--------|---------------------|----------------------|
| Novo (sem store) | Upload vazio | Upload + Assinatura | ✅ | ❌ |
| `text_only` sem profile | Upload vazio | Upload + Assinatura | ❌ | ❌ |
| `text_only` com profile | Upload vazio | Upload + Assinatura | ❌ | ❌ |
| `logo` com perfil `synced` | Preview ativo | Remover | ❌ | ❌ |
| `logo` com perfil `failed` | Preview ativo | Remover + Tentar novamente | ❌ | ❌ |
| `visual_signature` | Assinatura ativa | Alterar / Remover | ❌ | Assinaturas anteriores |

**Change:** 
- `text_only` with profile row no longer shows "Logotipos anteriores"
- `logo` state split into two rows: synced (only Remover) vs failed (Remover + Tentar novamente)

#### Scenario: Matrix drives logo area rendering

- **WHEN** the component renders based on `identity_state`, profile status, and logo assets
- **THEN** the visible elements SHALL match the updated UX decision matrix
- **AND** "Logotipos anteriores" SHALL NOT appear in any state

### Requirement: Remove logo button behavior

When the user clicks "Remover logotipo" in the `logo` state, the system SHALL:

1. Call `DELETE /api/store/[id]/logo`
2. After successful response, update local state:
   - Set `identity_state` to `'text_only'`
   - Set `logo_status` to `'explicit_none'`
   - Clear `logoPreview` (remove preview from UI)
   - Show drop zone, upload/assinatura buttons
3. On error: show a dismissible error banner

**Change:** Removed step "Show 'Logotipos anteriores' link if archived versions exist" — this link no longer exists.

#### Scenario: Remove logo updates UI

- **WHEN** the user clicks "Remover logotipo" and the DELETE succeeds
- **THEN** the logo preview SHALL be removed
- **AND** the drop zone SHALL appear
- **AND** "Enviar logotipo" and "Criar assinatura visual" buttons SHALL appear
- **AND** "Logotipos anteriores" SHALL NOT appear
- **AND** color pickers SHALL retain their values (direction preserved)

### Requirement: Logo area — `logo` state with analysis failed

When `identity_state = 'logo'` and the latest brand profile has `status = 'failed'` (upload succeeded but BrandDirector analysis failed), the Logo area SHALL display:

- A circular preview of the active logo (loaded from the active original asset)
- A warning message below the preview: "Análise de direção visual falhou. A direção anterior está sendo usada."
- Two buttons: "Remover logotipo" and "Tentar novamente"
- All other buttons and links SHALL be hidden
- Color pickers SHALL display the previous profile's direction (fallback)

**Change:** Added "Tentar novamente" button alongside "Remover logotipo" — triggers the retry endpoint.

#### Scenario: Logo active with failed analysis shows warning and retry

- **WHEN** `identity_state` is `'logo'`
- **AND** the latest profile has `status = 'failed'`
- **THEN** a logo preview SHALL be displayed
- **AND** a warning message SHALL be displayed below the preview
- **AND** "Remover logotipo" and "Tentar novamente" buttons SHALL be visible

### Requirement: Logo area — after remove (text_only with profile)

When `identity_state = 'text_only'` and a `synced` brand profile exists (post-remove or after text_only inference), the Logo area SHALL display:

- Drop zone (drag-and-drop or click to upload) — SHALL be displayed
- "Enviar logotipo" button — SHALL be displayed
- "Criar assinatura visual" button — SHALL be displayed
- "Continuar sem logo" link — SHALL NOT be displayed
- Chip "✓ Direção visual definida pelo Vendeo" — SHALL be displayed (showing the preserved direction)
- Color pickers SHALL show the current profile's colors (preserved from before remove)
- Color palette chips (primary, secondary, accent, background) SHALL be displayed below the pickers

**Change:** Removed "Logotipos anteriores" link and all references to archived logo versions. Archived logos are no longer accessible through the UI.

#### Scenario: After remove shows upload options

- **WHEN** `identity_state` is `'text_only'`
- **AND** a synced profile exists
- **THEN** the drop zone SHALL be displayed
- **AND** "Enviar logotipo" and "Criar assinatura visual" buttons SHALL be displayed
- **AND** "Continuar sem logo" SHALL NOT be displayed
- **AND** "Logotipos anteriores" SHALL NOT be displayed

#### Scenario: After remove preserves visual direction

- **WHEN** `identity_state` is `'text_only'`
- **AND** a synced profile exists (from previous logo)
- **THEN** the chip "✓ Direção visual definida pelo Vendeo" SHALL be displayed
- **AND** color pickers SHALL show the profile's colors
