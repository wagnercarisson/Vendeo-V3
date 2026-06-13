> **Propósito**: Este documento contém as alterações delta da fase 4.6.2 sobre a spec `store-identity-ui`. As seções abaixo listam requirements **adicionados** ou **modificados** em relação à spec base.
>
> Base: `openspec/specs/store-identity-ui/spec.md`
>
> > **Nota de divergência:** Durante implementação via GSD, a UX foi refinada: o banner no mount foi substituído por modal bloqueante no save (D10), navigation guard foi adicionado (D11), e o botão discreto passou a ser exibido para qualquer drift não-nulo (D12). O arquivo `drift-banner.tsx` foi criado mas permanece não utilizado — a implementação real usa `DriftDecisionModal` no save e navegação.

---

## ADDED Requirements

### Requirement: Save-time blocking drift modal

When `driftStatus` is `new` and the user attempts to save the Step 2 form (clicks "Salvar" / "Próximo" / etc.), the system SHALL intercept the save and show a blocking modal. The modal SHALL:

- Use Tailwind CSS dark mode palette (`bg-bg-surface`, `border-border`, `text-primary`, `text-secondary`, `text-muted`, `accent-amber`)
- Display a centered overlay with `bg-black/60` backdrop
- NOT be dismissible via outside click or `X` button (`onPointerDown={(e) => e.preventDefault()}`)
- Title: "Direção visual desatualizada"
- Body message: "Você alterou dados importantes da loja. Deseja realinhar a direção visual ou manter a atual?"
- Have three buttons:
  - **Realinhar direção visual** (full-width, `bg-accent-amber`, white text): triggers re-inference then proceeds with save
  - **Manter direção visual atual** (full-width, outline/border style): persists dismiss (`drift_dismissed_snapshot`) via PATCH metadata, closes modal immediately (no spinner), then proceeds with save
  - **Cancelar** (text link, `text-muted`, underline): closes modal without saving or dismissing

#### Loading state

When "Realinhar" is clicked, the modal SHALL enter loading state:
- Body message changes to: "Aguarde enquanto o Vendeo realinha a direção visual da sua loja..."
- Previous buttons are replaced with centered spinner (`Loader2`, `animate-spin`, `text-accent-amber`) and text "Realinhando direção visual..."
- All buttons are hidden/disabled during loading

#### Error state

If re-inference fails, an error message SHALL appear below the buttons:
- Icon: `AlertCircle` from lucide-react
- Text: "Não foi possível realinhar. Tente novamente mais tarde."
- Color: `text-accent-red`
- The modal remains open so the user can try again (Realinhar) or choose Manter/Cancelar

#### Color hydration after realinhar

After successful re-inference via modal's "Realinhar", the response from `POST /api/store/[id]/brand-profile/infer` SHALL be used to update the following states before proceeding with save:
- `brand_color` (via `setField`): from `profile.safe_color_tokens.primary`
- `accentColor` (via `setAccentColor`): from `profile.brand_colors_chosen[1]` => `profile.safe_color_tokens?.accent` => `profile.inferred_accent_color`
- `brandColorsChosen` (via `setBrandColorsChosen`): from `profile.brand_colors_chosen`

The `realinhar()` hook function SHALL return the full fetch response data for this purpose.

#### Scenario: Modal shown on save with new drift

- **WHEN** `driftStatus` is `new`
- **AND** the user clicks "Salvar" or submits Step 2
- **THEN** a blocking modal SHALL be displayed
- **AND** the save SHALL NOT proceed until the user chooses an action

#### Scenario: Realinhar triggers re-inference, hydrates colors, then saves

- **WHEN** the user clicks "Realinhar direção visual"
- **THEN** the system SHALL call `POST /api/store/[id]/brand-profile/infer`
- **AND** show loading state (spinner + message)
- **AND** on success, update `accentColor`, `brand_color`, and `brandColorsChosen` from response
- **AND** close the modal
- **AND** proceed with the original save operation

#### Scenario: Manter closes modal immediately, persists dismiss, then saves

- **WHEN** the user clicks "Manter direção visual atual"
- **THEN** the modal SHALL close immediately (no spinner)
- **AND** the system SHALL call `PATCH /api/store/[id]/brand-profile/metadata` with `drift_dismissed_snapshot`
- **AND** proceed with the original save operation
- **AND** if the PATCH fails, the save still proceeds (silent failure — drift remains active)

#### Scenario: Cancelar closes modal without saving

- **WHEN** the user clicks "Cancelar"
- **THEN** the modal SHALL close
- **AND** the save SHALL NOT proceed

#### Scenario: Error shown on re-inference failure

- **WHEN** "Realinhar" fails
- **THEN** an inline error message SHALL be displayed in the modal
- **AND** the user SHALL be able to retry, choose "Manter", or "Cancelar"

### Requirement: Navigation guard

When `step === 2` and `driftStatus === 'new'`, the system SHALL intercept three navigation channels:

1. **Click interception (capture phase):**
   - `document.addEventListener('click', handler, true)` SHALL be registered
   - If the click target (or an ancestor) is an `<a>` element with a valid href:
     - `e.preventDefault()` and `e.stopPropagation()` SHALL be called
     - The URL SHALL be stored in `pendingNavUrl` state
     - The drift decision modal SHALL be shown (`driftNavIntercept = true`)
   - Exclusions: `target="_blank"`, `href` starting with `#` or `javascript:`
   - This intercepts Next.js `<Link>` components (which render `<a>` elements)

2. **Popstate interception:**
   - `window.addEventListener('popstate')` SHALL be registered
   - On `popstate`, the current URL SHALL be re-pushed via `history.pushState(null, '', currentUrlRef.current)`
   - The drift decision modal SHALL be shown

3. **Beforeunload interception (browser refresh/close):**
   - `window.addEventListener('beforeunload')` SHALL be registered
   - `e.preventDefault()` and `e.returnValue = ''` SHALL be called
   - This prevents accidental page close without resolving drift

#### Modal behavior in navigation context

The same `DriftDecisionModal` component is used, but with different handlers:
- **Realinhar:** Re-inference + color hydration => close modal => navigate to `pendingNavUrl`
- **Manter:** Persist dismiss => close modal => navigate to `pendingNavUrl`
- **Cancelar:** Close modal => stay on Step 2 (discard `pendingNavUrl`)

All event listeners SHALL be cleaned up on unmount or when conditions no longer apply.

#### Scenario: Click on <a> intercepts and shows modal

- **WHEN** the user clicks a link on Step 2
- **AND** `driftStatus === 'new'`
- **THEN** navigation SHALL be prevented
- **AND** a drift decision modal SHALL be shown
- **AND** after resolving, navigation SHALL proceed

#### Scenario: Browser back shows modal

- **WHEN** the user presses browser back on Step 2
- **AND** `driftStatus === 'new'`
- **THEN** the current URL SHALL be re-pushed
- **AND** a drift decision modal SHALL be shown

#### Scenario: Browser refresh/close triggers beforeunload

- **WHEN** the user tries to refresh or close the browser on Step 2
- **AND** `driftStatus === 'new'`
- **THEN** `beforeunload` SHALL show the browser's native confirmation dialog

### Requirement: Discreet drift button

When `driftStatus` is not `'none'` (i.e., `'new'` or `'dismissed'`), the system SHALL render a discreet button below the form title and above the form fields. The discreet button SHALL:

- Display as a small text link: "Direção visual pode estar desatualizada - realinhar agora"
- Use `text-text-muted` color with underline, hover transitions to `text-text-primary`
- Be inline-flex with optional loading spinner (`Loader2`, `w-3 h-3`, `animate-spin`)
- During loading: text changes to "Realinhando...", button is disabled (`opacity-50`, `cursor-not-allowed`)
- On click, trigger the same `realinhar()` flow
- After successful re-inference, the button disappears (driftStatus => `none`)
- NOT be rendered when `driftSaveIntercept` or `driftNavIntercept` is active (modal already open)

#### Scenario: Discreet button shown for any drift

- **WHEN** `driftStatus` is `'new'` or `'dismissed'`
- **THEN** a discreet text link SHALL be displayed below the form title
- **AND** it SHALL read "Direção visual pode estar desatualizada - realinhar agora"

#### Scenario: Discreet button hidden when no drift

- **WHEN** `driftStatus` is `'none'`
- **THEN** no discreet button SHALL be displayed

#### Scenario: Discreet button opens re-inference

- **WHEN** the user clicks the discreet button
- **THEN** the `realinhar()` function SHALL be called
- **AND** the button SHALL show "Realinhando..." with spinner during processing
- **AND** the button SHALL be disabled during processing
- **AND** after successful re-inference, the button SHALL disappear

---

## MODIFIED Requirements

### Requirement: beforeunload behavior (modified)

> Replaces the original beforeunload requirement. Drift now triggers beforeunload as part of the navigation guard.

The navigation guard SHALL register a `beforeunload` handler when `step === 2 && driftStatus === 'new'`. This is in ADDITION to the existing data-unsaved beforeunload (which fires regardless of drift state when form data is dirty).

The drift-triggered beforeunload SHALL be cleaned up when navigation guard is removed (step change or drift resolution).

#### Scenario: beforeunload triggered by drift

- **WHEN** the user has no unsaved form data
- **AND** `step === 2`
- **AND** `driftStatus === 'new'`
- **THEN** `beforeunload` SHALL fire on browser refresh/close

### Requirement: Drift hook on Step 2 mount (modified)

> Extends store-identity-form.tsx behavior.

The system SHALL run drift detection logic on every mount of Step 2 (both create and edit modes, but skip comparison for create). The detection SHALL read the current store data, the brand profile metadata, and compute the `DriftStatus`.

The `useDriftDetection` hook SHALL return:
- `driftStatus: DriftStatus` — current drift state
- `currentSnapshot: DriftSnapshot | null` — normalized current visual state
- `realinhar: () => Promise<void | Record<string, unknown>>` — triggers re-inference, returns response data for color hydration
- `ignorar: () => Promise<void>` — persists `drift_dismissed_snapshot` via PATCH metadata
- `isRealinhando: boolean` — loading state

#### Scenario: Drift detection runs on edit mode mount

- **WHEN** the user navigates to Step 2
- **AND** a `store_id` exists and was loaded
- **AND** a synced brand profile exists with input_snapshot
- **THEN** drift detection SHALL execute
- **AND** the resulting `driftStatus` SHALL drive the modal/button behavior

#### Scenario: Drift detection does not run on create mode mount

- **WHEN** the user is in create mode (no store_id)
- **THEN** drift detection SHALL NOT execute
- **AND** `driftStatus` SHALL be `none`

### Requirement: Campaign generation not affected (modified)

> Clarifies that campaign generation is intentionally not modified by this phase.

The drift detection system SHALL NOT modify the campaign generation flow. Campaign generation uses the active brand profile visual direction regardless of drift state. A dismissed drift is a persisted user choice.

#### Scenario: Campaign generation unaffected by drift

- **WHEN** the user clicks "Gerar Campanha"
- **AND** `driftStatus` is `new` or `dismissed`
- **THEN** campaign generation SHALL proceed normally
- **AND** no drift modal, warning, or delay SHALL be shown
