# Tasks — Visual Direction Drift Detection (4.6.2)

> Dependencies: `tasks → specs → design → proposal`

## Task 1: Snapshot data structures

**Spec**: `visual-direction-drift-detection`
**Description**: Define TypeScript types for `DriftSnapshot`, `DriftStatus`, and the normalized current visual state.

### Steps
- [ ] Create `src/lib/drift.ts` with:
  - `SENSITIVE_FIELDS` constant: `['segment', 'subsegment', 'tone_of_voice', 'name', 'brand_color', 'accent_color']`
  - `DriftSnapshot` type: `Record<string, string | null>` with the 6 fields
  - `DriftStatus` type: `'none' | 'new' | 'dismissed'`
  - `currentVisualState(store, profile)` function: normalizes accent_color via `brand_colors_chosen[1]` → `safe_color_tokens.accent` → `inferred_accent_color`, returns a `DriftSnapshot`
  - `computeDriftStatus(current, inputSnapshot, dismissedSnapshot): DriftStatus` — implements detection algorithm
  - `normalizeSnapshotValue(v)` helper: `null`/`undefined` → `''`, hex strings lowercased

### Tests
- [ ] Unit test: `computeDriftStatus` returns `'none'` when store matches snapshot
- [ ] Unit test: `computeDriftStatus` returns `'new'` when segment differs
- [ ] Unit test: `computeDriftStatus` returns `'new'` when name differs
- [ ] Unit test: `computeDriftStatus` returns `'new'` when brand_color differs (store null, snapshot non-null)
- [ ] Unit test: `computeDriftStatus` returns `'dismissed'` when dismissed snapshot matches current
- [ ] Unit test: `computeDriftStatus` returns `'new'` when dismissed snapshot is stale
- [ ] Unit test: `computeDriftStatus` returns `'none'` when no snapshot exists
- [ ] Unit test: `currentVisualState` resolves `accent_color` from `brand_colors_chosen[1]` first
- [ ] Unit test: `currentVisualState` falls back to `safe_color_tokens.accent`
- [ ] Unit test: `currentVisualState` falls back to `inferred_accent_color`

---

## Task 2: Session-level color dirty tracking

**Spec**: `store-form-alteration-tracking`
**Description**: Add dirty tracking for color pickers in `use-store-form.ts`.

### Steps
- [ ] Extend `use-store-form.ts` with:
  - `colorDirtyState: ColorDirtyState` state
  - `initColorDirtyState(primaryInitial, accentInitial)` — sets initial values, resets dirty flags
  - `onPrimaryColorChange(hex)` — sets `primaryDirty = (hex !== primaryInitial)`
  - `onAccentColorChange(hex)` — sets `accentDirty = (hex !== accentInitial)`
- [ ] Call `initColorDirtyState` when brand profile loads and on mount

### Tests
- [ ] Verify dirty flags are false on mount
- [ ] Verify dirty flags set on color change
- [ ] Verify dirty flags reset on revert to initial value

---

## Task 3: Backend — input_snapshot population

**Spec**: `store-brand-profile` (ADDED + MODIFIED)
**Description**: Populate `metadata.input_snapshot` after successful inference. Clear `drift_dismissed_snapshot` on re-inference.

### Steps
- [ ] Update `BrandTextOnlyInferenceService` (or the caller that persists the profile) to:
  - After successful inference, set `metadata.input_snapshot` from current visual state (dados da loja + cores normalizadas)
  - If metadata already exists, deep-merge (preserve existing fields)
- [ ] Update re-inference path (banner "Realinhar", modal "Realinhar") to also clear `drift_dismissed_snapshot`
- [ ] Ensure `metadata.input_snapshot` is NOT populated when inference fails

### Tests
- [ ] Integration test: successful inference stores `metadata.input_snapshot`
- [ ] Integration test: failed inference does not store snapshot
- [ ] Integration test: re-inference updates snapshot and clears `drift_dismissed_snapshot`

---

## Task 4: Backend — PATCH metadata endpoint

**Spec**: `store-brand-profile` (ADDED)
**Description**: Create `PATCH /api/store/[id]/brand-profile/metadata` endpoint.

### Steps
- [ ] Create route: `src/app/api/store/[id]/brand-profile/metadata/route.ts`
  - Accept PATCH with JSON body
  - Validate body has at least one field
  - Look up active (status = 'synced') brand profile by store_id
  - Deep-merge provided fields into existing `metadata` JSONB
  - Persist via Supabase
  - Return 200 on success, 404 on no active profile, 400 on invalid body
- [ ] Add request type `PatchBrandProfileMetadataRequest`

### Tests
- [ ] Integration test: PATCH updates metadata fields
- [ ] Integration test: PATCH preserves existing metadata fields
- [ ] Integration test: PATCH returns 404 when no synced profile
- [ ] Integration test: PATCH returns 400 on empty body

---

## Task 5: Frontend — drift hook

**Spec**: `visual-direction-drift-detection` + `store-identity-ui`
**Description**: Create `useDriftDetection` hook that runs on Step 2 mount.

### Steps
- [ ] Create `src/components/flow/use-drift-detection.ts`:
  - `useDriftDetection(store, profile)` hook
  - Returns `{ driftStatus: DriftStatus, currentSnapshot: DriftSnapshot, realinhar: () => Promise<void>, ignorar: () => Promise<void> }`
  - On mount: reads store, profile, computes drift status
  - `realinhar()`: calls inference endpoint, on success updates profile + clears drift
  - `ignorar()`: calls PATCH metadata endpoint with `drift_dismissed_snapshot`
  - Skip detection when store has no `id` (create mode), no synced profile, or no `input_snapshot`

### Tests
- [ ] Verify hook returns correct `driftStatus` based on store vs snapshot
- [ ] Verify hook skips detection when store has no `id` (create mode)
- [ ] Verify `realinhar()` calls inference and updates state
- [ ] Verify `ignorar()` calls PATCH metadata and updates state

---

## Task 6: Frontend — drift banner + discreet button

**Spec**: `store-identity-ui` (ADDED)
**Description**: Implement drift banner and discreet button components for Step 2.

### Steps
- [ ] Create `src/components/flow/drift-banner.tsx`:
  - Renders when `driftStatus === 'new'`
  - Message: "A direção visual da sua loja pode estar desatualizada. Você alterou dados importantes depois da última análise."
  - Two buttons: "Realinhar direção visual" (primary/amber) and "Manter direção visual atual" (outline)
  - Loading state on realinhar (spinner, buttons disabled)
  - Error state on failure (toast)
- [ ] Create `src/components/flow/drift-discreet-button.tsx`:
  - Renders when `driftStatus === 'dismissed'`
  - Small text link: "Direção visual pode estar desatualizada"
  - `text-muted` color, subtle underline
  - On click: triggers `realinhar()` flow (no dismiss option)
- [ ] Integrate both into `store-identity-form.tsx`:
  - Position banner at top of form, above field groups
  - Position discreet button below form title, above fields
  - Use `useDriftDetection` hook

### Tests
- [ ] Verify banner renders when drift is new
- [ ] Verify banner hidden when no drift
- [ ] Verify discreet button renders when drift dismissed
- [ ] Verify "Realinhar" triggers re-inference
- [ ] Verify "Manter" persists dismiss
- [ ] Verify discreet button click triggers re-inference

---

## Task 7: Frontend — Gerar Campanha drift modal

**Spec**: `store-identity-ui` (ADDED)
**Description**: Implement drift modal that blocks campaign generation when drift exists.

### Steps
- [ ] Create `src/components/flow/drift-campaign-modal.tsx`:
  - Full-screen overlay with semi-transparent dark backdrop
  - Title: "A direção visual da sua loja foi alterada desde a última campanha. Deseja atualizar antes de gerar?"
  - Two buttons: "Realinhar direção visual" (amber primary) and "Gerar campanha mesmo assim" (outline)
  - No close button, no backdrop dismiss
  - Loading state on realinhar
- [ ] Integrate into `campaign-page-client.tsx`:
  - Before triggering campaign generation, check `driftStatus`
  - If `new` or `dismissed`, show modal
  - If `none`, proceed directly
  - On "Gerar campanha mesmo assim", proceed
  - On "Realinhar" + success, proceed
  - On "Realinhar" + failure, stay in modal with error toast

### Tests
- [ ] Verify modal appears when drift exists
- [ ] Verify modal not shown when no drift
- [ ] Verify "Gerar campanha mesmo assim" proceeds
- [ ] Verify "Realinhar" + success proceeds
- [ ] Verify "Realinhar" + failure stays in modal

---

## Task 8: E2E verification

**Description**: Run full TypeScript check, lint, and manual verification of all flows.

### Steps
- [ ] `npm run typecheck` — no errors
- [ ] `npm run lint` — no errors
- [ ] Manual flow: create store → save → change segment → Step 2 shows banner → dismiss → refresh → discreet button → realign → banner gone
- [ ] Manual flow: change segment → banner → realign → change name → banner reappears
- [ ] Manual flow: Gerar Campanha with drift → modal shows → "Gerar campanha mesmo assim" proceeds
- [ ] Manual flow: Gerar Campanha with drift → modal shows → "Realinhar" proceeds after success
- [ ] Manual flow: new store (create mode) → no drift detection
