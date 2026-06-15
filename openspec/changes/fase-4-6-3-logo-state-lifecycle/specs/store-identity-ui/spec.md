> **Purpose**: Delta spec for store-identity-ui changes in fase 4.6.3 — new visual states for logo active (analysis OK and failed), post-remove UI, and restore modal with drift badge.

## ADDED Requirements

### Requirement: Logo area — `logo` state with analysis OK

When `identity_state = 'logo'` and a synced brand profile exists (analysis succeeded), the Logo area in Step 2 SHALL display:

- A circular preview of the active logo (loaded from the active original asset)
- **Only one button**: "Remover logotipo" (destructive style, red/accent-red)
- The "Enviar logotipo" button SHALL NOT be displayed
- The "Não tenho logo" button SHALL NOT be displayed
- The "Continuar sem logo" link SHALL NOT be displayed
- The "Logotipos anteriores" link SHALL NOT be displayed
- Color pickers (Cor Principal, Cor de Destaque) SHALL be displayed normally
- Extracted colors from logo (`logo_colors_detected`) SHALL be displayed as color swatches below the pickers, with "P" (primary) and "S" (secondary) quick-set buttons
- The drop zone (drag-and-drop area) SHALL NOT be displayed

#### Scenario: Logo active hides upload elements

- **WHEN** `identity_state` is `'logo'`
- **AND** a synced brand profile exists
- **THEN** a logo preview SHALL be displayed
- **AND** only the "Remover logotipo" button SHALL be visible
- **AND** the drop zone, upload button, "Não tenho logo", "Continuar sem logo", and "Logotipos anteriores" SHALL be hidden

#### Scenario: Logo active shows extracted colors

- **WHEN** `identity_state` is `'logo'`
- **AND** the profile has `logo_colors_detected`
- **THEN** extracted color swatches SHALL be displayed below the color pickers
- **AND** each swatch SHALL have "P" and "S" quick-set buttons

### Requirement: Logo area — `logo` state with analysis failed

When `identity_state = 'logo'` and the latest brand profile has `status = 'failed'` (upload succeeded but BrandDirector analysis failed), the Logo area SHALL display:

- A circular preview of the active logo (loaded from the active original asset)
- A warning message below the preview: "Análise de direção visual falhou. A direção anterior está sendo usada." (use `text-accent-amber` color, with `AlertTriangle` or `AlertCircle` icon from lucide-react)
- Only one button: "Remover logotipo"
- All other buttons and links SHALL be hidden (same as analysis OK state)
- Color pickers SHALL display the previous profile's direction (fallback)

#### Scenario: Logo active with failed analysis shows warning

- **WHEN** `identity_state` is `'logo'`
- **AND** the latest profile has `status = 'failed'`
- **THEN** a logo preview SHALL be displayed
- **AND** a warning message SHALL be displayed below the preview
- **AND** only the "Remover logotipo" button SHALL be visible

#### Scenario: Logo active with failed analysis uses fallback colors

- **WHEN** `identity_state` is `'logo'`
- **AND** the latest profile has `status = 'failed'`
- **AND** a previous synced profile exists
- **THEN** color pickers SHALL be pre-filled with the previous synced profile's colors

### Requirement: Logo area — after remove (text_only with profile)

When `identity_state = 'text_only'` and a `synced` brand profile exists (post-remove or after text_only inference), the Logo area SHALL display:

- Drop zone (drag-and-drop or click to upload) — SHALL be displayed
- "Enviar logotipo" button — SHALL be displayed
- "Criar assinatura visual" button — SHALL be displayed
- "Continuar sem logo" link — SHALL NOT be displayed
- "Logotipos anteriores" link — SHALL be displayed IF there are archived logo versions
- Chip "✓ Direção visual definida pelo Vendeo" — SHALL be displayed (showing the preserved direction)
- Color pickers SHALL show the current profile's colors (preserved from before remove)
- Color palette chips (primary, secondary, accent, background) SHALL be displayed below the pickers

#### Scenario: After remove shows upload options with history

- **WHEN** `identity_state` is `'text_only'`
- **AND** a synced profile exists
- **AND** the store has archived logo versions
- **THEN** the drop zone SHALL be displayed
- **AND** "Enviar logotipo" and "Criar assinatura visual" buttons SHALL be displayed
- **AND** "Continuar sem logo" SHALL NOT be displayed
- **AND** "Logotipos anteriores (N)" link SHALL be displayed

#### Scenario: After remove without history

- **WHEN** `identity_state` is `'text_only'`
- **AND** a synced profile exists
- **AND** the store has NO archived logo versions
- **THEN** the "Logotipos anteriores" link SHALL NOT be displayed

#### Scenario: After remove preserves visual direction

- **WHEN** `identity_state` is `'text_only'`
- **AND** a synced profile exists (from previous logo)
- **THEN** the chip "✓ Direção visual definida pelo Vendeo" SHALL be displayed
- **AND** color pickers SHALL show the profile's colors
- **AND** "Logotipos anteriores" SHALL be displayed if archived assets exist

### Requirement: Restore modal

The system SHALL provide a modal component for browsing and restoring historical logo versions. The modal SHALL:

- Open when the user clicks "Logotipos anteriores" (or equivalent link)
- Title: "Logotipos anteriores"
- Close button (X) in the top right
- Display each archived version as a card containing:
  - Logo thumbnail (loaded from archived asset's storage path)
  - Date: formatted `created_at` (e.g., "12 jun 2026")
  - Version label: "v{N}" (e.g., "v2")
  - Visual style (from associated profile, e.g., "Moderno e clean")
  - Color palette summary (from safe_color_tokens, e.g., "#C41E3A, #2D2D2D")
  - Drift badge:
    - "✓ Dados inalterados" (no drift — green/accent-green) with "Restaurar" button
    - "⚠ Requer realinhamento" (drift detected — amber/accent-amber) with "Restaurar c/ realinh" button
- "Cancelar" button at the bottom
- Loading state: spinner while fetching history
- Empty state: "Nenhum logotipo anterior encontrado"
- Error state: dismissible error banner "Não foi possível carregar o histórico"

#### Scenario: Modal shows archived versions with drift badges

- **WHEN** the user opens the restore modal
- **AND** the store has 2 archived logo versions
- **THEN** 2 version cards SHALL be displayed, ordered by version descending
- **AND** each card SHALL show the logo thumbnail, date, version, style, and palette
- **AND** each card SHALL have a drift badge indicating whether realignment is needed

#### Scenario: No drift version shows "Restaurar" button

- **WHEN** a version card has no drift (input_snapshot matches current store)
- **THEN** the badge SHALL read "✓ Dados inalterados"
- **AND** a "Restaurar" button SHALL be displayed

#### Scenario: Drift version shows "Restaurar c/ realinh" button

- **WHEN** a version card has drift (input_snapshot differs from current store)
- **THEN** the badge SHALL read "⚠ Requer realinhamento"
- **AND** a "Restaurar c/ realinh" button SHALL be displayed

#### Scenario: Empty state

- **WHEN** the user opens the restore modal
- **AND** no archived versions exist
- **THEN** the modal SHALL display "Nenhum logotipo anterior encontrado"

#### Scenario: Loading state

- **WHEN** the user opens the restore modal
- **AND** the history API request is in flight
- **THEN** a spinner or skeleton SHALL be displayed
- **AND** the version list SHALL NOT be rendered until the API responds

#### Scenario: Error state

- **WHEN** the history API request fails
- **THEN** a dismissible error banner SHALL be displayed: "Não foi possível carregar o histórico"

### Requirement: UX decision matrix for logo area

The logo area visibility in Step 2 SHALL follow this decision matrix:

| Estado | Drop zone / Preview | Botões | "Continuar sem logo" | "Logotipos anteriores" |
|--------|-------------------|--------|---------------------|----------------------|
| Novo (sem store) | Upload vazio | Upload + Assinatura | ✅ | ❌ |
| `text_only` sem profile | Upload vazio | Upload + Assinatura | ❌ | ❌ |
| `text_only` com profile | Upload vazio | Upload + Assinatura | ❌ | ✅ Se houver archived |
| `logo` (qualquer) | Preview ativo | Remover (único) | ❌ | ❌ |
| `visual_signature` | (futuro) | (futuro) | ❌ | ❌ |

#### Scenario: Matrix drives logo area rendering

- **WHEN** the component renders based on `identity_state`, profile status, and logo assets
- **THEN** the visible elements SHALL match the UX decision matrix

### Requirement: Remove logo button behavior

When the user clicks "Remover logotipo" in the `logo` state, the system SHALL:

1. Call `DELETE /api/store/[id]/logo`
2. After successful response, update local state:
   - Set `identity_state` to `'text_only'`
   - Set `logo_status` to `'explicit_none'`
   - Clear `logoPreview` (remove preview from UI)
   - Show drop zone, upload/assinatura buttons
   - Show "Logotipos anteriores" link if archived versions exist
3. On error: show a dismissible error banner

#### Scenario: Remove logo updates UI

- **WHEN** the user clicks "Remover logotipo" and the DELETE succeeds
- **THEN** the logo preview SHALL be removed
- **AND** the drop zone SHALL appear
- **AND** "Enviar logotipo" and "Criar assinatura visual" buttons SHALL appear
- **AND** "Logotipos anteriores" SHALL appear if archived versions exist
- **AND** color pickers SHALL retain their values (direction preserved)

### Requirement: Restore button triggers POST /logo/restore

When the user clicks "Restaurar" or "Restaurar c/ realinh" in the restore modal, the system SHALL:

1. Call `POST /api/store/[id]/logo/restore` with `{ "asset_id": "..." }`
2. Show a loading spinner on the button during the request
3. On success:
   - Close the modal
   - Update UI to reflect the `logo` state (preview + Remover button)
   - Update `identity_state` to `'logo'`
   - Update `logo_status` to `'uploaded'`
4. On error: show an inline error message within the modal

#### Scenario: Successful restore updates UI

- **WHEN** the user clicks "Restaurar" in the modal and the POST succeeds
- **THEN** the modal SHALL close
- **AND** the logo preview SHALL show the restored logo
- **AND** the state SHALL change to `logo` (preview + Remover only)
