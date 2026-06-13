# Tasks — Visual Direction Drift Detection (4.6.2)

> Dependencies: `tasks → specs → design → proposal`
>
> **Status:** Implementation complete via GSD workflow (58/58 plans).
> **Nota de divergência:** Testes unitários/integração especificados abaixo NÃO foram implementados. A verificação foi feita via UAT manual (13 testes documentados em `.planning/phases/4.6.2-visual-direction-drift-detection/4.6.2-UAT.md`). Consulte os artefatos GSD em `.planning/phases/4.6.2-visual-direction-drift-detection/` para detalhes completos.

## Task 1: Snapshot data structures

**Spec**: `visual-direction-drift-detection`
**Description**: Define TypeScript types for `DriftSnapshot`, `DriftStatus`, and the normalized current visual state.

### Steps
- [x] Create `src/lib/drift.ts` with:
  - `SENSITIVE_FIELDS` constant: `['segment', 'subsegment', 'tone_of_voice', 'name', 'brand_color', 'accent_color']`
  - `DriftSnapshot` type: `Record<string, string | null>` with the 6 fields
  - `DriftStatus` type: `'none' | 'new' | 'dismissed'`
  - `currentVisualState(store, profile)` function: normalizes accent_color via `brand_colors_chosen[1]` => `safe_color_tokens.accent` => `inferred_accent_color`, returns a `DriftSnapshot`
  - `computeDriftStatus(current, inputSnapshot, dismissedSnapshot): DriftStatus` — implements detection algorithm
  - `normalizeSnapshotValue(v)` helper: `null`/`undefined` => `''`, hex strings lowercased

### Tests (não implementados — ver UAT manual)
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
- [x] Extend `use-store-form.ts` with:
  - `colorDirtyState: ColorDirtyState` state
  - `initColorDirtyState(primaryInitial, accentInitial)` — sets initial values, resets dirty flags
  - `onPrimaryColorChange(hex)` — sets `primaryDirty = (hex !== primaryInitial)`
  - `onAccentColorChange(hex)` — sets `accentDirty = (hex !== accentInitial)`
- [x] Call `initColorDirtyState` when brand profile loads and on mount

### Tests (não implementados — ver UAT manual)
- [ ] Verify dirty flags are false on mount
- [ ] Verify dirty flags set on color change
- [ ] Verify dirty flags reset on revert to initial value

---

## Task 3: Backend — input_snapshot population

**Spec**: `store-brand-profile` (ADDED + MODIFIED)
**Description**: Populate `metadata.input_snapshot` after successful inference. Clear `drift_dismissed_snapshot` on re-inference.

### Steps
- [x] Update infer route to:
  - After successful inference, set `metadata.input_snapshot` from current visual state (dados da loja + cores normalizadas)
  - If metadata already exists, deep-merge (preserve existing fields) — **nota:** current implementation sets fresh `metadata.input_snapshot` on new insert, no deep-merge needed since it's a new profile
- [x] Update re-inference path (modal "Realinhar") to also clear `drift_dismissed_snapshot` — **feito via novo insert (nova versão do profile), sem carry-over do dismiss anterior**
- [x] Ensure `metadata.input_snapshot` is NOT populated when inference fails

### Tests (não implementados — ver UAT manual)
- [ ] Integration test: successful inference stores `metadata.input_snapshot`
- [ ] Integration test: failed inference does not store snapshot
- [ ] Integration test: re-inference updates snapshot and clears `drift_dismissed_snapshot`

---

## Task 4: Backend — PATCH metadata endpoint

**Spec**: `store-brand-profile` (ADDED)
**Description**: Create `PATCH /api/store/[id]/brand-profile/metadata` endpoint.

### Steps
- [x] Create route: `src/app/api/store/[id]/brand-profile/metadata/route.ts`
  - Accept PATCH with JSON body
  - Validate body has at least one field
  - Look up active (status = 'synced') brand profile by store_id
  - Deep-merge provided fields into existing `metadata` JSONB
  - Persist via Supabase
  - Return 200 on success, 404 on no active profile, 400 on invalid body
- [x] Add request type `PatchBrandProfileMetadataRequest`

### Tests (não implementados — ver UAT manual)
- [ ] Integration test: PATCH updates metadata fields
- [ ] Integration test: PATCH preserves existing metadata fields
- [ ] Integration test: PATCH returns 404 when no synced profile
- [ ] Integration test: PATCH returns 400 on empty body

---

## Task 5: Frontend — drift hook

**Spec**: `visual-direction-drift-detection` + `store-identity-ui`
**Description**: Create `useDriftDetection` hook that runs on Step 2 mount.

### Steps
- [x] Create `src/components/flow/use-drift-detection.ts`:
  - `useDriftDetection(store, profile)` hook
  - Returns `{ driftStatus: DriftStatus, currentSnapshot: DriftSnapshot, realinhar: () => Promise<Record<string, unknown> | void>, ignorar: () => Promise<void>, isRealinhando: boolean }` — **nota:** `realinhar` retorna dados da resposta para color hydration (ver D13), divergindo do spec original que declarava `Promise<void>`
  - On mount: reads store, profile, computes drift status (com ref comparison guards para evitar loop infinito)
  - `realinhar()`: calls inference endpoint, on success updates profile + clears drift, **returns response data**
  - `ignorar()`: calls PATCH metadata endpoint with `drift_dismissed_snapshot`
  - Skip detection when store has no `id` (create mode), no synced profile, or no `input_snapshot`

### Tests (não implementados — ver UAT manual)
- [ ] Verify hook returns correct `driftStatus` based on store vs snapshot
- [ ] Verify hook skips detection when store has no `id` (create mode)
- [ ] Verify `realinhar()` calls inference and updates state
- [ ] Verify `ignorar()` calls PATCH metadata and updates state

---

## Task 6: Frontend — drift modal + discreet button

**Spec**: `store-identity-ui` (ADDED)
**Description**: Implement drift decision modal and discreet button for Step 2.

### Steps
- [x] Create `src/components/flow/drift-decision-modal.tsx`:
  - Renders when `driftSaveIntercept` or `driftNavIntercept` is true
  - Title: "Direção visual desatualizada"
  - Body: "Você alterou dados importantes da loja. Deseja realinhar a direção visual ou manter a atual?"
  - Three buttons: "Realinhar direção visual" (primary/amber), "Manter direção visual atual" (outline), "Cancelar" (text link)
  - Loading state on realinhar (spinner + "Realinhando direção visual...")
  - Error state: inline error message "Não foi possível realinhar. Tente novamente mais tarde."
  - No outside click, no X, no escape
- [x] Create `src/components/flow/drift-discreet-button.tsx`:
  - Renders when `driftStatus !== 'none'` (tanto 'new' quanto 'dismissed') — **divergência:** spec original dizia apenas 'dismissed' (ver D12)
  - Text: "Direção visual pode estar desatualizada - realinhar agora" com loading "Realinhando..."
  - `text-text-muted` color, underline, hover `text-text-primary`
  - On click: triggers `realinhar()` flow
- [x] Integrate both into `store-identity-form.tsx`:
  - Modal intercepta save (handleStep2Submit) quando `driftStatus === 'new'` — **divergência:** spec original usava banner no mount; implementação real usa modal no save (ver D10)
  - Modal também intercepta navegação (click capture + popstate + beforeunload) — **novo:** não previsto no spec original (ver D11)
  - Discreet button abaixo do título do formulário, acima dos campos
  - Use `useDriftDetection` hook
  - Color hydration após realinhar (ver D13) — **novo:** não previsto no spec original

**Nota:** O componente `drift-banner.tsx` foi criado durante implementação inicial mas NÃO é utilizado — a UX final substituiu banner por modal. Mantido para referência.

### Tests (não implementados — ver UAT manual)
- [ ] Verify modal renders on save with new drift
- [ ] Verify modal hidden when no drift
- [ ] Verify discreet button renders when drift exists
- [ ] Verify "Realinhar" triggers re-inference + color hydration + save
- [ ] Verify "Manter" persists dismiss + closes modal immediately + saves
- [ ] Verify "Cancelar" closes modal without saving
- [ ] Verify discreet button click triggers re-inference
- [ ] Verify navigation guard intercepts `<a>` clicks
- [ ] Verify navigation guard intercepts browser back
- [ ] Verify navigation guard triggers beforeunload

---

## Task 7: E2E verification

**Description**: Run full TypeScript check, lint, and manual verification of all flows.

### Steps
- [x] `npm run typecheck` — no errors
- [x] `npm run lint` — no errors
- [x] Manual flow: create store => save => change segment => Step 2 shows drift => modal on save => dismiss => discreet button => realign
- [x] Manual flow: change segment => modal => realinhar => colors synced => modal gone
- [x] Manual flow: navigation guard — click link, browser back, refresh
- [x] Manual flow: Gerar Campanha with drift => proceeds without modal (campaign flow unchanged)
- [x] Manual flow: new store (create mode) => no drift detection
- [x] **UAT:** 13 testes documentados, 12 passaram diretamente, 1 found/fixed during testing
