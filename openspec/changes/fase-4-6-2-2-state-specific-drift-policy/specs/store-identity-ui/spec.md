## MODIFIED Requirements

### Requirement: Drift detection hook

The system SHALL run drift detection logic on every mount of Step 2 (both create and edit modes, but skip comparison for create). The detection SHALL read the current store data, the brand profile metadata, and compute the DriftStatus.

The useDriftDetection hook SHALL return:
- driftStatus: DriftStatus -- current drift state ('none' | 'new' | 'dismissed')
- currentSnapshot: DriftSnapshot | null -- normalized current visual state
- realinhar: () => Promise<void | Record<string, unknown>> -- triggers re-inference, returns response data for color hydration
- ignorar: () => Promise<void> -- persists drift_dismissed_snapshot via PATCH metadata
- isRealinhando: boolean -- loading state
- driftCategory: DriftCategory -- ADDED: 'critical' | 'sensitive' | 'none'
- activeVsSummary: { id: string, status: string,     critical_drift: { status: 'none' | 'new' | 'dismissed', fields: string[], reason: 'ok' | 'critical_drift' | 'missing_metadata' } | null } | null -- ADDED (null when no active VS)

The hook SHALL consume GET /visual-signature to obtain activeVsSummary.critical_drift. The sensitive drift calculation remains local (compares input_snapshot vs currentVisualState using getDriftPolicy(state).sensitive).

#### Scenario: Drift detection runs on edit mode mount

- WHEN the user navigates to Step 2
- AND a store_id exists and was loaded
- AND a synced brand profile exists with input_snapshot
- THEN drift detection SHALL execute
- AND the resulting driftStatus SHALL drive the modal/button behavior

#### Scenario: Drift detection does not run on create mode mount

- WHEN the user is in create mode (no store_id)
- THEN drift detection SHALL NOT execute
- AND driftStatus SHALL be none

### Requirement: Save-time blocking drift modal

When criticalStatus === 'new' OR sensitiveStatus === 'new' (effectiveStatus === 'new') and the user attempts to save the Step 2 form (clicks "Salvar" / "Proximo" / etc.), the system SHALL intercept the save and show a blocking modal. The modal SHALL:

- Use Tailwind CSS dark mode palette (bg-bg-surface, border-border, text-primary, text-secondary, text-muted, accent-amber)
- Display a centered overlay with bg-black/60 backdrop
- NOT be dismissible via outside click or X button (onPointerDown={(e) => e.preventDefault()})
- Title: "Direcao visual desatualizada"
- Body message: "Voce alterou dados importantes da loja. Deseja realinhar a direcao visual ou manter a atual?"

The interception SHALL bifurcate based on driftCategory:

if (criticalStatus === 'new') -> DriftCriticalModal
else if (sensitiveStatus === 'new') -> DriftDecisionModal (current behavior, expanded)
else -> proceed with save

Precedence: criticalStatus 'new' always opens DriftCriticalModal, even if sensitive drift also exists. If criticalStatus is 'dismissed' and sensitiveStatus is 'new', opens DriftDecisionModal (sensitive).

For the sensitive flow (DriftDecisionModal), the modal SHALL have three buttons:
- **Realinhar direcao visual** (full-width, bg-accent-amber, white text): triggers re-inference via POST /api/store/[id]/brand-profile/realign then proceeds with save
- **Manter direcao visual atual** (full-width, outline/border style): persists dismiss (drift_dismissed_snapshot) via PATCH metadata, closes modal immediately (no spinner), then proceeds with save
- **Cancelar** (text link, text-muted, underline): closes modal without saving or dismissing

For the critical flow (DriftCriticalModal), see the ADDED requirement "DriftCriticalModal".

#### Loading state

When "Realinhar" is clicked, the modal SHALL enter loading state:
- Body message changes to: "Aguarde enquanto o Vendeo realinha a direcao visual da sua loja..."
- Previous buttons are replaced with centered spinner (Loader2, animate-spin, text-accent-amber) and text "Realinhando direcao visual..."
- All buttons are hidden/disabled during loading

#### Error state

If re-inference fails, an error message SHALL appear below the buttons:
- Icon: AlertCircle from lucide-react
- Text: "Nao foi possivel realinhar. Tente novamente mais tarde."
- Color: text-accent-red
- The modal remains open so the user can try again (Realinhar / Tentar novamente) or choose Manter/Cancelar

#### Color hydration after realinhar

After successful re-inference via modal's "Realinhar", the response from POST /api/store/[id]/brand-profile/realign SHALL be used to update the following states:
- brandColorsChosen (via setBrandColorsChosen): from profile.brand_colors_chosen (may contain null)
- When brandColorsChosen has at least one valid HEX: brand_color from brandColorsChosen[0], accentColor from brandColorsChosen[1] (empty if null)
- When brandColorsChosen is []: brand_color from profile.safe_color_tokens.primary, accentColor from profile.safe_color_tokens.accent or profile.inferred_accent_color

The realinhar() hook function SHALL return the full fetch response data for this purpose.

#### Scenario: Modal shown on save with new drift

- WHEN criticalStatus === 'new' OR sensitiveStatus === 'new'
- AND the user clicks "Salvar" or submits Step 2
- THEN a blocking modal SHALL be displayed
- AND the save SHALL NOT proceed until the user chooses an action

#### Scenario: Save triggers DriftCriticalModal for new critical drift

- WHEN user clicks Salvar
- AND criticalStatus === 'new' (regardless of sensitiveStatus)
- THEN DriftCriticalModal SHALL be displayed
- AND DriftDecisionModal SHALL NOT be shown

#### Scenario: Save triggers DriftDecisionModal for sensitive-only drift

- WHEN user clicks Salvar
- AND criticalStatus !== 'new' (none, dismissed, or null)
- AND sensitiveStatus === 'new'
- THEN DriftDecisionModal SHALL be displayed

#### Scenario: Save proceeds directly when no drift

- WHEN user clicks Salvar
- AND criticalStatus !== 'new'
- AND sensitiveStatus !== 'new'
- THEN save SHALL proceed without any modal

#### Scenario: Realinhar triggers re-inference, hydrates colors, then saves

- WHEN the user clicks "Realinhar direcao visual"
- THEN the system SHALL call POST /api/store/[id]/brand-profile/realign
- AND show loading state (spinner + message)
- AND on success, update accentColor, brand_color, and brandColorsChosen from response
- AND close the modal
- AND proceed with the original save operation

#### Scenario: Manter closes modal immediately, persists dismiss, then saves

- WHEN the user clicks "Manter direcao visual atual"
- THEN the modal SHALL close immediately (no spinner)
- AND the system SHALL call PATCH /api/store/[id]/brand-profile/metadata with drift_dismissed_snapshot
- AND proceed with the original save operation
- AND if the PATCH fails, the save still proceeds (silent failure -- drift remains active)

#### Scenario: Cancelar closes modal without saving

- WHEN the user clicks "Cancelar"
- THEN the modal SHALL close
- AND the save SHALL NOT proceed

#### Scenario: Error shown on re-inference failure

- WHEN "Realinhar" fails
- THEN an inline error message SHALL be displayed in the modal
- AND the user SHALL be able to retry, choose "Manter", or "Cancelar"

## ADDED Requirements

### Requirement: Tier 2 BP retry após aprovação substitution

When POST /approve returns with `bp_status: 'failed'` (Tier 2 BP generation failure), the approval modal SHALL display a warning:
- Message: "O perfil de marca não pôde ser gerado. Você pode tentar novamente."
- Button "Tentar novamente" — SHALL call POST /brand-profile/realign (no body, server decides strategy by identity_state)
- Button "Continuar" — closes modal without retrying. Previous BP remains as fallback.
- The POST /realign retry SHALL use profiler mode:'regenerate' with Branch C persistence (INSERT new BP, mark fallback outdated if exists)

#### Scenario: Post-approval BP failure shows retry option

- WHEN POST /approve returns bp_status:'failed'
- THEN the approval modal SHALL show a warning with "Tentar novamente"
- AND "Tentar novamente" SHALL call POST /brand-profile/realign
- AND on success, the new BP replaces the fallback

#### Scenario: Post-approval BP failure "Continuar" skips retry

- WHEN POST /approve returns bp_status:'failed'
- AND user clicks "Continuar"
- THEN the modal SHALL close
- AND no retry SHALL be made
- AND the previous BP SHALL remain as fallback

### Requirement: hasCriticalDrift removed

The boolean property hasCriticalDrift SHALL be replaced by driftCategory. The frontend MUST use driftCategory === 'critical' for critical drift decisions.

#### Scenario: Frontend uses driftCategory === 'critical'

- WHEN any component previously used hasCriticalDrift
- THEN it SHALL use driftCategory === 'critical'
- AND hasCriticalDrift SHALL be removed from the hook's return type

### Requirement: DriftDecisionModal error/retry state

The DriftDecisionModal (sensitive scenario) SHALL be updated to display error and retry states:

- Normal state: buttons "Manter e salvar" / "Realinhar"
  - "Manter e salvar": persists dismiss (saves + dismisses drift)
- Error state (inference failure): "Realinhar" replaced by "Tentar novamente"
  - "Continuar por agora": saves WITHOUT persisting dismiss (drift badge remains)
  - "Manter e salvar": always enabled (save always possible, persists dismiss)
- After successful retry: reloads store data and closes modal

#### Scenario: Manter e salvar persists dismiss

- WHEN user clicks "Manter e salvar" in normal state
- THEN dismiss SHALL be persisted
- AND the store SHALL be saved
- AND the modal SHALL close

#### Scenario: Tentar novamente enabled on inference error

- WHEN BrandDirector call fails in realinhamento flow
- THEN a "Tentar novamente" button SHALL be shown
- AND "Continuar por agora" SHALL be shown (saves without dismiss)
- AND "Manter e salvar" SHALL remain enabled

#### Scenario: Continuar por agora saves without dismiss

- WHEN user clicks "Continuar por agora" after an error
- THEN the store SHALL be saved
- AND dismiss SHALL NOT be persisted (drift badge remains)

#### Scenario: Tentar novamente retry succeeds reloads data

- WHEN user clicks "Tentar novamente" after a failure
- AND the retry succeeds
- THEN the store data SHALL be reloaded (fresh GET)
- AND the modal SHALL close

### Requirement: DriftCriticalModal

The system SHALL provide a new modal component for critical drift scenarios. The modal SHALL be displayed when driftCategory === 'critical'.

Textos alinhados:
- Title: "Assinatura visual desatualizada"
- Message explaining that critical data (name, segment) changed since VS creation
- Primary CTA: "Atualizar assinatura visual" (with credit) or unavailable (without credit)
- Secondary CTA: "Manter direcao atual" -- dismiss + save (persists dismiss of critical fields)
- Tertiary: "Cancelar"
- Without credit: "Remover mesmo assim" -- opens VS removal confirmation (changes to text_only)
- Without credit: "Comprar creditos -- Em breve" -- disabled, informational tooltip

NOTE: "Manter direcao atual" saves the user's NEW store data, not the old values. The dismiss persists the current snapshot of critical fields, but the store values are the new ones the user just edited.

**With credit (signatures < 3):**
- Primary CTA: "Atualizar assinatura visual" -- opens ApprovalModal with mode:'substitution'
- Secondary CTA: "Manter direcao atual" -- executes dismiss + save
- Tertiary: "Cancelar"

**Without credit (signatures >= 3):**
- Alert: signature limit reached
- Button "Manter direcao atual" -- dismiss + save
- Button "Remover mesmo assim" -- opens VS removal confirmation (changes to text_only)
- Button "Comprar creditos -- Em breve" -- disabled, informational tooltip
- Button "Cancelar"

In both scenarios, dismiss + save SHALL:
1. Call POST /dismiss-critical-drift
2. Save store normally
3. Reload data

#### Scenario: Critical modal with credit opens approval

- WHEN user has < 3 successful signatures
- AND user clicks "Atualizar assinatura visual"
- THEN ApprovalModal SHALL open with mode:'substitution'
- AND the flow proceeds to signature generation and approval

#### Scenario: Critical modal without credit shows options

- WHEN user has >= 3 successful signatures
- THEN "Atualizar assinatura visual" SHALL NOT be available
- AND "Manter direcao atual" SHALL dismiss + save
- AND "Remover mesmo assim" SHALL show confirmation dialog

#### Scenario: Critical modal dismiss + save flow

- WHEN user clicks "Manter direcao atual"
- THEN POST /dismiss-critical-drift SHALL be called
- AND store save SHALL proceed (with the NEW store values, not old ones)
- AND data SHALL be reloaded

### Requirement: Drift badge on store preview

The system SHALL display a "Desalinhado" badge in the store preview card when effectiveStatus indicates drift. This is in ADDITION to the existing preview behavior.

effectiveStatus calculation:
- Se criticalStatus === 'new' -> badge "Desalinhado" exibido
- Se sensitiveStatus === 'new' (e criticalStatus !== 'new') -> badge "Desalinhado" exibido
- Se dismissed ou none -> nenhum badge

#### Scenario: Badge shown for new critical drift

- WHEN criticalStatus === 'new'
- THEN store-preview SHALL display a "Desalinhado" badge

#### Scenario: Badge shown for new sensitive drift

- WHEN sensitiveStatus === 'new' AND criticalStatus !== 'new'
- THEN store-preview SHALL display a "Desalinhado" badge

#### Scenario: No badge when dismissed

- WHEN driftStatus === 'dismissed' (regardless of critical or sensitive)
- THEN store-preview SHALL NOT display any drift badge

#### Scenario: No badge when no drift

- WHEN driftStatus === 'none'
- THEN store-preview SHALL NOT display any drift badge

### Requirement: Non-blocking save guarantee

The system SHALL NOT block saving store information under any drift scenario. All drift modals SHALL be informational/guidance, not blocking:

- If user chooses "Manter e salvar" or "Manter direcao atual", save proceeds unconditionally
- If user chooses "Cancelar", save does not happen (user choice)
- "Continuar por agora" saves without persisting dismiss (badge remains)
- On dismiss or save error, error messages SHALL be displayed
- "Remover mesmo assim" in no-credit scenario can be triggered

#### Scenario: User can always save with dismiss

- WHEN a drift modal is displayed
- AND the user chooses the dismiss+save option
- THEN the save SHALL proceed unconditionally
- AND the dismiss SHALL be persisted

#### Scenario: User can always save only

- WHEN a drift modal error state is displayed
- AND the user chooses "Continuar por agora"
- THEN the save SHALL proceed unconditionally
- AND the dismiss SHALL NOT be persisted