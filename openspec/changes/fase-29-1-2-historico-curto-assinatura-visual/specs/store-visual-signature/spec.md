## ADDED Requirements

### Requirement: HistoryModal — lista curta de VS aplicáveis

The VisualSignatureHistoryModal SHALL display a paginated list of applicable visual signatures for the store.

The component SHALL accept these props:
- `isOpen: boolean` — controls modal visibility
- `onClose: () => void` — called when modal is dismissed
- `storeId: string` — store identifier for API calls
- `identityState: string | null` — current identity state (`'text_only'`, `'visual_signature'`, `'logo'`, or null)
- `onApplied?: () => void` — called after successfully applying a VS

The component SHALL load signatures via `GET /api/store/[id]/visual-signature` with pagination parameters.

#### Scenario: Loading state shows spinner

- **WHEN** the modal opens
- **THEN** the component SHALL display a loading spinner
- **AND** SHALL call GET /visual-signature?limit=6&offset=0

#### Scenario: Error state shows error message

- **WHEN** the API call fails
- **THEN** the component SHALL display an error state with a descriptive message

#### Scenario: Empty state shows "Nenhuma assinatura anterior"

- **WHEN** the API returns zero applicable signatures
- **THEN** the component SHALL display "Nenhuma assinatura anterior"

### Requirement: HistoryModal — filtro client-side de aplicabilidade

The component SHALL filter the API response client-side before rendering. Only signatures where `restore_eligibility.reason === "ok"` SHALL appear in the list.

| `restore_eligibility.reason` | Aparece na lista? |
|---|---|
| `ok` | Sim |
| `critical_drift` | Não — oculto |
| `missing_metadata` | Não — oculto |

The component SHALL display only the count of visible applicable signatures loaded so far. It SHALL NOT claim to know the total applicable signatures across all pages — the raw API total may include ineligible records that the client only discovers when loading each batch.

#### Scenario: Filters out critical_drift signatures

- **WHEN** API returns 8 signatures (6 ok, 2 critical_drift)
- **THEN** the list SHALL display 6 signatures
- **AND** the critical_drift signatures SHALL NOT appear

#### Scenario: All ok signatures displayed

- **WHEN** API returns 8 signatures (all ok)
- **THEN** the list SHALL display all 8 signatures

### Requirement: HistoryModal — grid de 3 colunas com badge de status

The component SHALL display signatures in a 3-column grid layout (same layout as the review phase in ApprovalModal).

Each grid card SHALL show:
- The visual signature preview image
- A status badge: "Ativa" for `active`, "Arquivada" for `archived`, "Rascunho" for `draft`
- An action button or info indicator

#### Scenario: Card shows preview, badge, and action

- **WHEN** a signature is rendered in the grid
- **THEN** the card SHALL display the preview image
- **AND** a status badge SHALL be visible
- **AND** an action button or info indicator SHALL be present

### Requirement: HistoryModal — ações condicionais ao identity_state

The action available for each signature SHALL depend on the store's `identity_state` prop.

If `identityState === "text_only"`:
- `archived` signatures SHALL show an enabled "Aplicar" button
- `draft` signatures SHALL show an enabled "Aplicar" button
- `active` signatures SHALL NOT show an action — only badge "Ativa" (this state should not occur under text_only, but handled for consistency)

If `identityState !== "text_only"` (including `"visual_signature"`, `"logo"`, `null`):
- `archived` and `draft` signatures SHALL show a disabled "Indisponível" button with a tooltip
- The tooltip SHALL be contextual:
  - `"visual_signature"`: "Remova a assinatura ativa antes de aplicar outra versão"
  - `"logo"`: "Remova o logotipo ativo antes de aplicar uma assinatura visual"
  - `null` or other: "Aguarde o carregamento da identidade da loja"
- `active` signatures SHALL NOT show an action — only badge "Ativa"

The action logic SHALL use:
```typescript
function canApply(identityState: string | null): boolean {
  return identityState === "text_only";
}
```

#### Scenario: text_only shows enabled Aplicar for archived

- **WHEN** `identityState` is `'text_only'`
- **AND** the signature status is `'archived'`
- **THEN** an enabled "Aplicar" button SHALL be displayed

#### Scenario: text_only shows enabled Aplicar for draft

- **WHEN** `identityState` is `'text_only'`
- **AND** the signature status is `'draft'`
- **THEN** an enabled "Aplicar" button SHALL be displayed

#### Scenario: visual_signature blocks with tooltip

- **WHEN** `identityState` is `'visual_signature'`
- **THEN** the action button SHALL be disabled
- **AND** the tooltip SHALL read "Remova a assinatura ativa antes de aplicar outra versão"

#### Scenario: active signature shows no action

- **WHEN** the signature status is `'active'`
- **THEN** no action button SHALL be displayed
- **AND** a badge "Ativa" SHALL indicate it is in use

### Requirement: HistoryModal — ação "Aplicar" via POST /approve

When the user clicks "Aplicar" on an archived or draft signature, the component SHALL call `POST /api/store/[id]/visual-signature/approve` with `{ signatureId: "uuid" }`.

This call SHALL NOT reserve or consume credit (`reserveCredit` SHALL NOT be called).

On success (`{ success: true }`), the component SHALL call `onApplied()` (if provided) and may close or show a success state.

On drift error (`{ error, drift: { critical: true } }`), the component SHALL display the drift error message returned by the API.

#### Scenario: Apply archived calls POST /approve

- **WHEN** user clicks "Aplicar" on an archived signature
- **THEN** POST /approve SHALL be called with the signature's ID
- **AND** no credit SHALL be reserved or consumed

#### Scenario: Apply draft calls POST /approve

- **WHEN** user clicks "Aplicar" on a draft signature
- **THEN** POST /approve SHALL be called with the signature's ID
- **AND** no credit SHALL be reserved or consumed

#### Scenario: Apply success calls onApplied

- **WHEN** POST /approve returns success
- **THEN** `onApplied()` SHALL be called

#### Scenario: Apply drift error shows error

- **WHEN** POST /approve returns drift error
- **THEN** the drift error message SHALL be displayed

### Requirement: HistoryModal — paginação simples "Ver versões anteriores"

The component SHALL paginate with a simple "Ver versões anteriores" pattern using the raw API total (not the filtered count) as trigger.

Carga inicial: `limit=6`, `offset=0`. The component SHALL load up to 6 raw signatures from the API, then filter client-side to show only applicable ones.

A single button "Ver versões anteriores" SHALL appear below the grid when **both** conditions are true:
1. `apiTotal > rawSignaturesLoaded` — there are more records in the API
2. The second batch has not been loaded yet (at most one pagination step)

When clicked, the component SHALL load the next batch (`limit=6`, `offset=6`), filter client-side (removing ineligible signatures), and append to the current list. After loading the second batch (total maximum 12 raw signatures loaded), the button SHALL disappear permanently — even if the raw API total exceeds 12.

The component SHALL display the count of visible applicable signatures loaded so far (e.g., "6 de 12" or "4 assinaturas"). It SHALL NOT compute or display a global filtered total.

If the second batch contains no applicable signatures (all filtered out), the button SHALL disappear without adding visible items. No additional feedback is required in this phase.

#### Scenario: apiTotal = 6, first batch loads all — no button

- **WHEN** `apiTotal` is 6
- **AND** the first batch loads 6 raw signatures
- **THEN** no "Ver versões anteriores" button SHALL appear

#### Scenario: apiTotal = 20, first batch loads 6 raw — button visible

- **WHEN** `apiTotal` is 20
- **AND** 6 raw signatures have been loaded (first batch)
- **THEN** "Ver versões anteriores" SHALL be visible

#### Scenario: Click loads second batch, button disappears

- **WHEN** user clicks "Ver versões anteriores"
- **THEN** the second batch SHALL be loaded (6 more raw signatures)
- **AND** after loading, the button SHALL disappear (maximum 12 raw reached)

#### Scenario: apiTotal = 20 — max 12 raw loaded, button gone

- **WHEN** `apiTotal` is 20
- **AND** user clicks "Ver versões anteriores"
- **THEN** at most 12 raw signatures SHALL be loaded total
- **AND** the button SHALL disappear (no further loading)

#### Scenario: Second batch all filtered out — button disappears

- **WHEN** user clicks "Ver versões anteriores"
- **AND** the second batch's raw signatures are all ineligible (critical_drift or missing_metadata)
- **THEN** no new visible items SHALL be added
- **AND** the button SHALL disappear

### Requirement: HistoryModal — sem consumo de crédito

Viewing or reactivating a previous visual signature SHALL never consume credit. Credit SHALL only be consumed by `POST /generate-without-logo` (new generation). The POST /approve flow for archived or draft signatures SHALL NOT call `reserveCredit`, `refundCredit`, or any credit-related function.

Drift validation SHALL use `validateDrift()` — a local calculation with no AI cost.

#### Scenario: Apply does not consume credit

- **WHEN** a signature is applied via HistoryModal
- **THEN** no credit SHALL be consumed
- **AND** no `reserveCredit` SHALL be called
