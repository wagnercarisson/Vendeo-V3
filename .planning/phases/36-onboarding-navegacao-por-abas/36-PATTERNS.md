# Phase 36: Onboarding — Navegação por Abas — Pattern Map

**Mapped:** 2026-08-01
**Files analyzed:** 20 (7 new + 10 modified + 3 test-groups; `use-drift-detection.ts` PRESERVED — consumed, not modified)
**Analogs found:** 19 / 20 (ARIA tabs container has no direct analog — partial)

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `src/lib/store-onboarding/tabs.ts` (new) | model/utility | transform (pure) | `src/lib/drift.ts` + `src/lib/constants.ts` | exact (pure-fn + const-array) |
| `src/lib/store-onboarding/tab-state.ts` (new) | utility | transform (pure) | `src/lib/drift.ts` (`computeDriftStatus`) | exact |
| `src/lib/store-onboarding/draft-store.ts` (new) | utility | storage (localStorage) | `src/hooks/use-input-preservation.ts` | role-match |
| `src/hooks/use-onboarding-tabs.ts` (new) | hook | event-driven + CRUD | `src/components/flow/use-store-form.ts` + `use-drift-detection.ts` + `src/hooks/use-debounce.ts` | exact (composition) |
| `src/components/flow/store-tabs.tsx` (new) | component | request-response | `src/components/flow/store-preview.tsx` (presentational) | partial (no ARIA tabs exists) |
| `src/components/flow/legal-acceptance-panel.tsx` (new) | component | request-response | `src/components/legal/legal-status-section.tsx` + `src/components/readiness/readiness-banner.tsx` | role-match |
| `src/components/flow/store-identity-form.tsx` (mod) | component | CRUD + event-driven | itself (refactor target) | exact |
| `src/components/flow/store-page-client.tsx` (mod) | component (wrapper) | request-response | itself (26 lines) | exact |
| `src/components/flow/use-store-form.ts` (mod) | hook | CRUD | itself | exact |
| `src/components/flow/use-drift-detection.ts` (preserved) | hook | event-driven | itself + `src/lib/drift.ts` | exact — CONSUMIDO como está (D13); NÃO modificar |
| `src/components/readiness/readiness-banner.tsx` (mod) | component | request-response | itself (`missingToDisplay`) | exact |
| `src/components/legacy/cnpj-update-banner.tsx` (mod) | component | request-response | itself | exact |
| `src/app/(app)/campanhas/nova/page.tsx` (mod) | page (server) | request-response | itself (`redirect` on readiness) | exact |
| `src/app/(app)/cadastro/cnpj/page.tsx` (mod) | page (server) | request-response | itself | exact |
| `src/components/flow/cnpj-update-form.tsx` (mod) | component | CRUD | itself (see note in `cadastro/cnpj/page.tsx`) | role-match |
| `src/app/api/store/route.ts` (mod) | route (controller) | request-response | itself | exact |
| `supabase/migrations/<ts>_f36_create_store_draft.sql` (new) | migration (RPC) | batch/transform | `20260727000001_freemium_anti_abuso_cnpj.sql` | exact |
| `src/lib/store-onboarding/__tests__/` (new) | test | — | `src/lib/__tests__/drift.test.ts` | exact |
| `src/__tests__/api/store-creation-matrix.test.ts` (mod) | test | — | itself | exact |
| `src/__tests__/api/store-ownership-api.test.ts` (mod) | test | — | itself | exact |

---

## Pattern Assignments

### `src/lib/store-onboarding/tabs.ts` (model/utility, transform — pure)

**Analog:** `src/lib/drift.ts` (pure function + policy record) + `src/lib/constants.ts` (const array of `{value,label}`)

**Const array pattern** (`src/lib/constants.ts:1-17`) — for `TAB_ORDER` / `OnboardingTabDef`:
```typescript
export const STORE_SEGMENTS = [
  { value: "moda-calcados-acessorios", label: "Moda, Calçados e Acessórios" },
  ...
] as const;

export type StoreSegment = (typeof STORE_SEGMENTS)[number]["value"];
```

**Pure function + policy-record pattern** (`src/lib/drift.ts:11-41`) — `OnboardingTab` union + `computeTabUnlock` follow this shape:
```typescript
const DRIFT_POLICY: Record<string, { sensitive: readonly string[]; critical: readonly string[] }> = {
  text_only: { sensitive: [...], critical: [] },
  ...
};

export function getDriftPolicy(identityState: string): { sensitive: readonly string[]; critical: readonly string[] } {
  const policy = DRIFT_POLICY[identityState] ?? DRIFT_POLICY['text_only'];
  ...
}
```

**Contract to implement** (from spec `store-onboarding-tabs`):
```typescript
export type OnboardingTab = "dados" | "posicionamento" | "direcao-visual";
export const TAB_ORDER: OnboardingTab[] = ["dados", "posicionamento", "direcao-visual"];
export type TabBlockReason = "needs_legal_acceptance" | "needs_tone_of_voice" | "needs_store_created" | "fiscal_pending";
export interface OnboardingTabDef { id: OnboardingTab; label: string; labelMobile: string; }
export function computeTabUnlock(tab: OnboardingTab, ctx: { name: string; segment: string; legalAccepted: boolean; storeId: string | null; toneOfVoice: string; hasVisualDirection: boolean }): { unlocked: boolean; reason?: TabBlockReason }
```
**Unlock rules (D1/D8/D9):** `dados` → always `{unlocked:true}`. `posicionamento` → needs name+segment+legalAccepted+storeId (`needs_legal_acceptance` if no legal; `needs_store_created` if no storeId). `direcao-visual` → needs storeId+toneOfVoice (`needs_tone_of_voice` if missing; `hasVisualDirection:true` bypasses). CNPJ never blocks.

**`labelMobile` is display-only (D10):** the `id` stays `posicionamento`/`direcao-visual` — never a second vocabulary.

---

### `src/lib/store-onboarding/tab-state.ts` (utility, transform — pure)

**Analog:** `src/lib/drift.ts:100-126` (`computeDriftStatus`) — pure state machine with priority fallthrough.

**Pattern** — pure function, early-return, final `return`:
```typescript
export function computeDriftStatus(current, inputSnapshot, dismissedSnapshot, fields): DriftStatus {
  if (inputSnapshot == null) return 'none'
  const hasDrift = fields.some(f => { ... });
  if (!hasDrift) return 'none'
  if (dismissedSnapshot != null) { ...; if (matchesDismissed) return 'dismissed' }
  return 'new'
}
```

**Contract to implement** (spec `store-onboarding-autosave`):
```typescript
export type TabState = "blocked" | "draft" | "saved" | "ready" | "pending_generation";
export function computeTabState(tab: OnboardingTab, ctx: {
  hasLocalEdits: boolean; isPersisted: boolean; unlocked: boolean;
  readiness: StoreReadiness;  // from @/lib/store-readiness
}): { state: TabState; reason?: TabBlockReason }
```
**Priority:** `pending_generation` > `blocked` > `draft` > `ready` > `saved` (D7). Readiness `ready:false` + `missing:["cadastro_fiscal"]` → `{state:"pending_generation", reason:"fiscal_pending"}`.

---

### `src/lib/store-onboarding/draft-store.ts` (utility, storage)

**Analog:** `src/hooks/use-input-preservation.ts` (full file, 36 lines) — storage wrapper with try/catch.

**Storage wrapper pattern** (lines 7-35):
```typescript
export function useInputPreservation<T extends object>() {
  const saveFormState = useCallback((state: T) => {
    try { sessionStorage.setItem(DRAFT_KEY, JSON.stringify(state)); }
    catch { console.warn("Failed to save form state to sessionStorage"); }
  }, []);
  const restoreFormState = useCallback((): T | null => {
    try {
      const raw = sessionStorage.getItem(DRAFT_KEY);
      if (!raw) return null;
      return JSON.parse(raw) as T;
    } catch { ...; return null; }
  }, []);
  const clearFormState = useCallback(() => { try { sessionStorage.removeItem(DRAFT_KEY); } catch {} }, []);
  return { saveFormState, restoreFormState, clearFormState };
}
```

**Contract to implement** (spec `store-onboarding-draft`) — module-level functions (not a hook), `localStorage` instead of `sessionStorage` (documented in code: survives tab-close/app-switch; TTL 24h):
```typescript
export const DRAFT_TTL_MS = 24 * 60 * 60 * 1000;
export interface StoreDraft { userId: string; storeId: string | null; fields: Partial<FormData>; updatedAt: number; }  // FormData from @/components/flow/use-store-form
export function draftKey(userId: string, storeId: string | null): string  // `vendeo:store_draft:${userId}:new` | `:${storeId}`
export function saveDraft(draft: StoreDraft): void                          // updatedAt = Date.now()
export function restoreDraft(userId: string, storeId: string | null): StoreDraft | null  // expired → null + removeItem
export function clearDraft(userId: string, storeId?: string): void
```
**Note:** spec says `Partial<StoreFormData>` but no `StoreFormData` type exists — the exported form type is `FormData` in `use-store-form.ts:13-27`. Use `FormData` (or export an alias).

---

### `src/hooks/use-onboarding-tabs.ts` (hook, event-driven + CRUD orchestration)

**Analogs:** `use-store-form.ts` (state+callbacks shape), `use-drift-detection.ts` (ref-guarded effects), `use-debounce.ts` (timer effect), `use-input-preservation.ts` (storage).

**Hook state+callback shape** (`use-store-form.ts:119-161`):
```typescript
export function useStoreForm({ initialStore }: { initialStore?: Store | null } = {}): UseStoreFormReturn {
  const [formData, setFormData] = useState<FormData>(() => { ... });
  const [mode, setMode] = useState<FormMode>(initialStore ? "edit" : "create");
  ...
  const setField = useCallback((field: keyof FormData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    ...
  }, []);
```

**Ref-guard + effect pattern for event interception** (`use-drift-detection.ts:55-57, 100-142`) — use `useRef` to avoid redundant re-renders:
```typescript
const prevStatusRef = useRef<DriftStatus>('none');
...
if (status !== prevStatusRef.current) { setDriftStatus(status); prevStatusRef.current = status; }
```

**Navigation interception pattern** (`store-identity-form.tsx:231-269`) — event capture on `document` + `popstate` + `beforeunload`:
```typescript
useEffect(() => {
  if (step === 2 && driftStatus === 'new') {
    currentUrlRef.current = window.location.href;
    const handleClick = (e: MouseEvent) => {
      const anchor = (e.target as HTMLElement).closest('a');
      if (!anchor || !anchor.href) return;
      if (anchor.target === '_blank') return;
      const href = anchor.getAttribute('href');
      if (!href || href.startsWith('#') || href.startsWith('javascript:')) return;
      e.preventDefault(); e.stopPropagation();
      setPendingNavUrl(href); setDriftNavIntercept(true);
    };
    const handlePopState = () => { history.pushState(null, '', currentUrlRef.current); setDriftNavIntercept(true); };
    const handleBeforeUnload = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ''; };
    document.addEventListener('click', handleClick, true);
    window.addEventListener('popstate', handlePopState);
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => { document.removeEventListener('click', handleClick, true); ... };
  }
}, [step, driftStatus, ...]);
```

**Debounce pattern** (`use-debounce.ts:5-18`) for draft writes (400ms):
```typescript
export function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debouncedValue;
}
```

**Contract to implement** (spec `store-onboarding-autosave` + `store-onboarding-draft`):
```typescript
// DIRECTION: hook RECEIVES drift callbacks via options; RETURNS only public handlers.
export function useOnboardingTabs(
  deps: {...},
  options?: {
    onDriftNavigate?: () => void;   // drift callback registered by 36-04 (opens modal)
    onDriftLeave?: () => void;      // drift callback registered by 36-04 (opens modal)
  },
): {
  activeTab: OnboardingTab;
  setActiveTab: (next: OnboardingTab) => Promise<void>;   // autoSave() BEFORE navigating (awaited)
  tabStates: Record<OnboardingTab, { state: TabState; reason?: TabBlockReason }>;  // via computeTabState
  saveStatus: "idle" | "saving" | "saved" | "error";
  handleInternalNavigation: (e: MouseEvent) => void;       // intercept internal links, autoSave before leaving
  handlePageHide: () => void;                              // sync draft write + best-effort PATCH
  handleVisibilityChange: () => void;                      // when document.visibilityState === 'hidden'
  // NO onNavigate/onLeave in return — those are INPUT callbacks (options). Flags
  // pendingNavUrl/driftSaveIntercept/driftNavIntercept stay in StoreIdentityForm (orchestrator).
}
```
The hook calls `options.onDriftNavigate()`/`options.onDriftLeave()` when it detects an exit with drift `new` in snapshot fields; 36-04 passes them at mount. `setActiveTab`/`handleInternalNavigation`/`handlePageHide`/`handleVisibilityChange` are the PUBLIC handlers the orchestrator binds to the DOM.
**Save serialization:** simple queue + ref/seq guard (ignore stale responses). PATCH failure → `saveStatus:"error"` but does NOT block navigation. POST (create) failure → stays on Dados, next tab stays `needs_store_created`.

---

### `src/components/flow/store-tabs.tsx` (component, ARIA tabs)

**Analog:** `src/components/flow/store-preview.tsx` — presentational client component with typed props interface (lines 1-38). No ARIA tabs component exists in the codebase yet — this is new territory; follow the WAI-ARIA Tabs pattern from the spec.

**Presentational component props pattern** (`store-preview.tsx:16-38`):
```typescript
"use client";
interface StorePreviewProps { name: string; segment: string; ...; driftStatus?: DriftStatus; }
export function StorePreview({ name, segment, ... }: StorePreviewProps) { ... }
```

**Contract to implement** (spec `store-onboarding-tabs`):
```typescript
export function StoreTabs({
  tabs,            // OnboardingTabDef[] from tabs.ts
  activeTab,
  states,          // Record<OnboardingTab, { state: TabState; reason?: TabBlockReason }>
  onTabChange,     // (tab: OnboardingTab) => void — drives setActiveTab
  variant,         // "desktop" | "mobile-compact"
}: StoreTabsProps)
```
- `role="tablist"` / `role="tab"` / `role="tabpanel"` + `aria-selected` + `aria-controls` (D11)
- Roving tabindex: active tab `tabIndex={0}`, others `-1`; ArrowLeft/ArrowRight + Home/End move focus
- `aria-describedby` on blocked tab → block-reason text in active panel
- State exposed via `aria-label` (never color-only)
- `aria-live` region for state change announcements
- Mobile: short labels (Dados/Perfil/Visual), small dot/icon badge, reason ONLY in active panel, fixed bottom "Continuar" button, touch targets ≥ 44px (F22 — reuse `min-h-[44px]`/`min-w-[44px]` class convention from `store-identity-form.tsx:1806, 1818, 1921`)

---

### `src/components/flow/legal-acceptance-panel.tsx` (component, legal status column)

**Analog:** `src/components/legal/legal-status-section.tsx` (F30 — status + ContractAcceptanceModal wiring) + `readiness-banner.tsx` (banner/column UI).

**Modal wiring pattern to replicate** (`store-identity-form.tsx:2491-2514`):
```typescript
{contractDocuments && (
  <ContractAcceptanceModal
    open={showContractModal}
    onOpenChange={setShowContractModal}
    onConfirm={async () => {
      if (storeId) {
        try {
          const res = await fetch("/api/legal/accept", { method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ storeId, source: "onboarding" }) });
          const data = await res.json();
          if (!data.ok) return false;
        } catch { return false; }
      }
      setAcceptedTerms(true);
      return true;
    }}
    contractDocuments={contractDocuments}
  />
)}
```
`ContractAcceptanceModalProps` (`contract-acceptance-modal.tsx:13-18`): `{ open: boolean; onOpenChange: (open:boolean)=>void; onConfirm: ()=>Promise<boolean>; contractDocuments: ContractDocumentInfo[] }`.

**Status derivation (D3):** from F30 `getAcceptanceStatus` (`src/lib/legal/acceptance-service.ts:43-62`) — returns `"current" | "outdated" | "never"` (types at `src/lib/legal/types.ts:11`). Map to `LegalAcceptanceState`: `current`→`accepted`, `outdated`→`needs_reacceptance`, `never`→`pending`.

**Contract to implement** (spec `legal-acceptance-panel`):
```typescript
export type LegalAcceptanceState = "pending" | "accepted" | "needs_reacceptance";
export function LegalAcceptancePanel({ acceptance, onOpenModal, variant }: {
  acceptance: LegalAcceptanceState;
  onOpenModal: () => void;
  variant: "desktop-sticky-column" | "mobile-compact";
})
```
- Desktop: `lg:sticky top-*` column inside the grid (participates in layout — see the `grid grid-cols-1 lg:grid-cols-5` pattern at `store-identity-form.tsx:1815`)
- Mobile: compact block above the tab panel or before CTA — no sticky
- CTA "Revisar e aceitar" only for `pending`/`needs_reacceptance`; `aria-expanded`/`aria-pressed` on trigger
- Blocks Posicionamento when not `accepted` (reason `falta aceite legal` → TabBlockReason `needs_legal_acceptance`)

---

### `src/components/flow/store-identity-form.tsx` (MODIFIED — central refactor)

**Analog:** itself. The wizard 2-step refactors to a 3-tab panel. Preserve these existing blocks verbatim:

**Step state → tab state** (line 80): `const [step, setStep] = useState<1 | 2>(initialStep === 2 ? 2 : 1);` becomes `useOnboardingTabs` driven state with `?tab=` URL sync (D6). `initialStep` prop → `initialTab`/`?tab=` parsing done in `store-page-client.tsx`.

**Drift save-bifurcation (MUST preserve — D13):** `handleStep2Submit` at lines 1093-1112:
```typescript
const handleStep2Submit = async (e: React.FormEvent) => {
  e.preventDefault();
  if (!storeId) return;
  if (driftCategory === 'critical' && criticalDrift?.status === 'new') { setShowDriftCriticalModal(true); return; }
  if (driftCategory === 'sensitive') { setShowDriftDecisionModal(true); return; }
  try { await executeStep2Save(); } catch { setFeedbackOverlay({ message: 'Erro ao salvar. Tente novamente.', type: 'error' }); }
};
```
**`handleStep1Submit` save+readiness flow (lines 971-991)** — POST → `storeId` → readiness check → step 2 (F36: becomes auto-save in tab switch; readiness `cadastro_fiscal` missing no longer blocks *navigation*, only *generation*):
```typescript
const saved = await save(acceptedTerms || undefined);
if (saved && "storeId" in saved) {
  const savedStoreId = saved.storeId;
  const readinessRes = await fetch("/api/store/check-readiness", { method: "POST", headers: {...}, body: JSON.stringify({ storeId: savedStoreId }) });
  const readiness = await readinessRes.json();
  if (readiness.missing?.some((m) => m.item === "cadastro_fiscal")) { ... } else { setStep(2); ... }
}
```

**Step indicator → tab bar** (lines 1138-1159) — the "Necessário" badge logic (line 1155-1157: `{!inferredProfile && (<span ...>Necessário</span>)}`) stays on the Direção Visual tab (D7).

**Drift modal wiring (lines 2312-2457)** — `DriftDecisionModal` props (`drift-decision-modal.tsx:5-12`): `{ onRealinhar: ()=>Promise<void>; onIgnorar: ()=>Promise<void>; onCancel: ()=>void; isLoading: boolean; error: string|null; onContinueWithoutDismiss?: ()=>Promise<void> }`. `DriftCriticalModal` props (`drift-critical-modal.tsx:6-16`): `{ open; onOpenChange; storeId; identityState; canGenerateNewSignature; onDismissAndSave; onRemoveVs; onOpenApproval; onCancel }`. These blocks stay intact in the orchestrator component (`StoreIdentityForm`) — only the *interception moment* broadens (tab switch + internal nav, not just `step===2`), orchestrated by `useOnboardingTabs`, NOT inside `use-drift-detection.ts` (D13, hook preserved).

**Contract (D4/D13):** `setActiveTab` runs `autoSave()` before navigating. Auto-save is selective: fields in `SNAPSHOT_FIELDS` (from `@/lib/snapshot.ts:15-18`: `segment, subsegment, tone_of_voice, name, positioning, short_description, slogan`) with pending drift → PATCH deferred until drift decision; non-snapshot fields (fiscal/billing/visual) auto-save normally.

---

### `src/components/flow/store-page-client.tsx` (MODIFIED — `?tab=` parsing)

**Analog:** itself (26 lines). Current pattern (lines 7-11):
```typescript
"use client";
import { useSearchParams } from "next/navigation";
export function StorePageClient({ initialStore }: { initialStore: Store | null }) {
  const searchParams = useSearchParams();
  const required = searchParams.get("required");
  const message = searchParams.get("message");
  const initialStep = required === "visual-direction" ? 2 : undefined;
```
**Delta (D6/D12):** add `const tab = searchParams.get("tab")`; `initialTab` resolution order: `?tab=` → `required=visual-direction`→`direcao-visual` / `required=cadastro-fiscal`→`dados` (compat) → default `dados`. Keep reading `message=` and add `fiscal` (`fiscal=pending`) → banner on Dados tab. Pass to `StoreIdentityForm` as `initialTab` + `redirectMessage` + `fiscalPending`.

---

### `src/components/flow/use-store-form.ts` (MODIFIED — `autoSave()`)

**Analog:** itself. Reuse the `save()` body-building + fetch routing (lines 191-298).

**`save()` endpoint routing pattern (lines 214-258)** — this is exactly what `autoSave(fields)` will reuse:
```typescript
let res: Response;
if (storeId) {
  const cnpjDigits = formData.cnpj.replace(/\D/g, "");
  if (!hasExistingCnpj && cnpjDigits.length === 14) {
    res = await fetch("/api/store/update-cnpj", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ storeId, cnpjNormalized: cnpjDigits, razaoSocial: formData.razaoSocial, nomeFantasia: formData.nomeFantasia || formData.razaoSocial }) });
  } else {
    res = await fetch(`/api/store/${storeId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  }
} else {
  if (formData.cnpj) body.cnpj = formData.cnpj.replace(/\D/g, "");   // ← F36: cnpj now OPTIONAL
  res = await fetch("/api/store", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
}
```

**Contract (spec `store-onboarding-autosave` + `store-identity-ui`):**
```typescript
autoSave(fields: Partial<FormData>): Promise<{ ok: boolean }>
```
- Silent PATCH (valid fields only; invalid ignored)
- No `storeId` + minimum valid (name+segment+acceptedTerms) → POST `/api/store` in DRAFT mode (no CNPJ) → creates store, clears `:new` draft key
- No `storeId` + minimum invalid → no POST, `{ ok:false }`, draft stays in localStorage
- Add `saveStatus` to `UseStoreFormReturn` (line 31-49 interface). Note current `save()` requires CNPJ in create mode (line 246-248) — F36 makes it conditional so create-without-CNPJ reaches the draft branch of the route.

---

### `src/components/flow/use-drift-detection.ts` (PRESERVED — consumed, not modified)

**Analog:** itself + `src/lib/drift.ts`.

**Preserved drift logic (do NOT touch):**
- `SNAPSHOT_FIELDS` applicable to `identityState` — `getDriftPolicy(identityState).sensitive` (`drift.ts:29-41`): text_only = name/segment/subsegment/tone_of_voice/positioning/short_description/slogan; visual_signature critical = name/segment + slogan/city/state only per `contentUsed`
- `computeDriftStatus` (`drift.ts:100-126`), `evaluateCriticalDrift` (55-76), `evaluateSensitiveDrift` (78-98)
- Endpoints (lines 144-192): `realinhar()` → **POST** `/api/store/{id}/brand-profile/realign`; `ignorar()` → **PATCH** `/api/store/{id}/brand-profile/metadata` `{ drift_dismissed_snapshot: currentSnapshot }`; `dismissCriticalDrift()` → **POST** `/api/store/{id}/visual-signature/dismiss-critical-drift`

**Delta (D13):** `use-drift-detection.ts` permanece a fonte de DETECÇÃO e AÇÕES de drift — export type/params/retorno INTACTOS. NÃO migrar interceptação nem callbacks (`onDriftNavigate`/`onDriftLeave`/`pendingNavUrl`/`driftSaveIntercept`/`driftNavIntercept`) para dentro do hook. A ORQUESTRAÇÃO de saída de contexto (troca de aba, navegação interna, back/forward, saída da página) fica no `useOnboardingTabs` (hook orquestrador) e/ou `StoreIdentityForm` (componente), que CONSUMEM `driftStatus`/`driftCategory`/`realinhar`/`ignorar`/`dismissCriticalDrift` já expostos. O bloco de modais em `store-identity-form.tsx:2312-2457` é reutilizado como está; as flags de interceptação (`driftSaveIntercept`, `driftNavIntercept`, `pendingNavUrl` em linhas 113-115) e o `executeStep2Save` pós-decisão (dismiss/`metadata`, linhas 1070-1090) permanecem no componente orquestrador.

---

### `src/components/readiness/readiness-banner.tsx` (MODIFIED — `?tab=` links)

**Analog:** itself. The href-mapping function is the single point of change (lines 4-9):
```typescript
function missingToDisplay(item: MissingItem): { label: string; href: string } {
  if (item.item === "cadastro_fiscal") {
    return { label: "CNPJ cadastral", href: "/loja?required=cadastro-fiscal&returnTo=/dashboard" };
  }
  return { label: "Direção visual", href: "/loja?required=visual-direction" };
}
```
**Delta (D12):** `cadastro_fiscal` → `/loja?tab=dados&fiscal=pending&returnTo=/dashboard`; `brand_profile` → `/loja?tab=direcao-visual&message=needs-visual-direction`. Same for `cnpj-update-banner.tsx:27` (`href="/loja?required=cadastro-fiscal&returnTo=/dashboard"` → `?tab=dados&fiscal=pending&returnTo=/dashboard`).

---

### `src/app/(app)/campanhas/nova/page.tsx` (MODIFIED — redirect targets)

**Analog:** itself. Redirect block (lines 20-28):
```typescript
const readiness = await getStoreReadiness(store.id);
if (!readiness.ready) {
  const firstMissing = readiness.missing[0].item;
  if (firstMissing === "cadastro_fiscal") {
    redirect(`/loja?required=cadastro-fiscal&returnTo=${encodeURIComponent("/campanhas/nova")}`);
  } else {
    redirect(`/loja?required=visual-direction&message=needs-visual-direction`);
  }
}
```
**Delta (D12):** → `/loja?tab=dados&fiscal=pending&returnTo=/campanhas/nova` and `/loja?tab=direcao-visual&message=needs-visual-direction&returnTo=/campanhas/nova`. `getStoreReadiness` import (`@/lib/store-readiness`, line 10) unchanged.

---

### `src/app/(app)/cadastro/cnpj/page.tsx` (MODIFIED — redirect target)

**Analog:** itself (11 lines). Line 10:
```typescript
redirect(`/loja?required=cadastro-fiscal&returnTo=${encodeURIComponent(returnTo)}`);
```
**Delta (D12):** → `/loja?tab=dados&fiscal=pending&returnTo=${...}`. Also update `cnpj-update-form.tsx` post-update redirect: no CNPJ pending → `/loja?tab=dados&fiscal=pending`; no brand profile → `/loja?tab=direcao-visual&message=cnpj-updated`.

---

### `src/app/api/store/route.ts` (MODIFIED — two creation modes)

**Analog:** itself. Preserve the full validation/IP-UA/rpc-return skeleton; branch on `cnpj`.

**Skeleton to preserve (lines 41-77, 211-254):**
```typescript
export const POST = apiHandler(async (request: NextRequest) => {
  requireSameOrigin(request);
  try {
    const user = await requireUser();
    const body = await request.json().catch(() => null);
    if (!body) return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    const { name, segment, ..., cnpj, razaoSocial, nomeFantasia } = body;
    if (!acceptedTerms) return 400 "Você precisa aceitar os Termos de Uso...";
    if (!name || ... length < 2 || > 60) return 400;
    if (!segment || !validSegmentValues.includes(segment)) return 400;
    // F36 DELTA: remove the `if (!cnpj || typeof cnpj !== "string")` 400 block at lines 74-76
    // and branch: if cnpj present → existing verified path (lines 78-292); else → draft path (below)
    const ipAddress = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
      ?? request.headers.get("x-real-ip") ?? "unknown";
    const userAgent = request.headers.get("user-agent") ?? "unknown";
    const { data, error } = await supabase.rpc("create_store_with_cnpj", { p_cnpj_normalized: ..., ... });
```

**Draft branch (D15)** — replicate the same validations (name/segment/subsegment/acceptedTerms reuse lines 52-72 and 182-209), resolve versions via `getCurrentVersion` (lines 211-219), then:
```typescript
const { data, error } = await supabase.rpc("create_store_draft", {
  p_user_id: user.userId, p_name: (name as string).trim(), p_segment: segment as string,
  p_city: ..., p_state: ..., p_accepted_by_user_id: user.userId,
  p_terms_version: termsVersion.version, p_acceptable_use_version: aupVersion.version,
  p_ip_address: ipAddress, p_user_agent: userAgent,
  p_brand_color: ..., p_logo_url: ..., p_subsegment: effectiveSubsegment,
  p_tone_of_voice: ..., p_positioning: ..., p_short_description: ..., p_slogan: ...,
});
// error handling: same 23505 → 409 "Usuário já possui uma loja" (lines 256-268)
// response: same rpcStore unwrap (lines 272-282), but:
return NextResponse.json({ ...rpcStore, onboardingGranted: rpcData.onboardingGranted ?? false }, { status: 201 });
```
Response contract: 201 `{ ...store, onboardingGranted: false }`; 400 invalid (name/segment/acceptance/subsegment); 409 duplicate store/CNPJ; 401 UnauthorizedError (lines 293-298). `create_store_draft` returns `jsonb_build_object('store', v_store_data, 'onboardingGranted', false)`.

---

### `supabase/migrations/<timestamp>_f36_create_store_draft.sql` (NEW — RPC `create_store_draft`)

**Timestamp convention:** follow existing `20260731000004_publish_legal_beta_freemium_versions.sql` → use `20260801000001_f36_create_store_draft.sql`.

**Analog:** `20260727000001_freemium_anti_abuso_cnpj.sql` lines 202-277 (`create_store_with_cnpj`) — the exact RPC template, minus CNPJ params and minus the grant.

**RPC skeleton to replicate (from lines 202-277):**
```sql
CREATE OR REPLACE FUNCTION public.create_store_draft(
  p_user_id UUID, p_name TEXT, p_segment TEXT, p_city TEXT, p_state TEXT,
  p_accepted_by_user_id UUID, p_terms_version TEXT, p_acceptable_use_version TEXT,
  p_ip_address TEXT, p_user_agent TEXT, p_brand_color TEXT, p_logo_url TEXT,
  p_subsegment TEXT, p_tone_of_voice TEXT, p_positioning TEXT,
  p_short_description TEXT, p_slogan TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_store_id UUID;
  v_store_data JSONB;
BEGIN
  INSERT INTO public.stores (
    name, segment, user_id, city, state, brand_color, logo_url,
    subsegment, tone_of_voice, positioning, short_description, slogan
    -- cnpj_normalized/cnpj_root_hash/razao_social/nome_fantasia stay NULL (nullable)
  ) VALUES (
    p_name, p_segment, p_user_id, p_city, p_state, p_brand_color, p_logo_url,
    p_subsegment, p_tone_of_voice, p_positioning, p_short_description, p_slogan
  )
  RETURNING id INTO v_store_id;

  INSERT INTO public.legal_acceptances (store_id, accepted_by_user_id, document_type, document_version, ip_address, user_agent, acceptance_source)
  VALUES
    (v_store_id, p_accepted_by_user_id, 'terms_of_service', p_terms_version, p_ip_address, p_user_agent, 'onboarding'),
    (v_store_id, p_accepted_by_user_id, 'acceptable_use', p_acceptable_use_version, p_ip_address, p_user_agent, 'onboarding');

  -- no grant freemium na criação draft (D15); loja draft não recebe crédito
  -- até cadastro fiscal válido (NÃO citar nomes de funções grant aqui —
  -- o verify do 36-01 usa grep dessas strings no arquivo SQL)

  SELECT jsonb_agg(row_to_json(s)) INTO v_store_data
  FROM (SELECT * FROM public.stores WHERE id = v_store_id) s;

  RETURN jsonb_build_object('store', v_store_data, 'onboardingGranted', false);
END;
$$;
```
**Grants — service_role only** (pattern from `20260723000005_create_legal_helpers.sql:26-27, 52-53`):
```sql
REVOKE EXECUTE ON FUNCTION public.create_store_draft(...) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_store_draft(...) TO service_role;
```
**Header comment style** — section banner with `-- ====` blocks (see migration lines 14-31). No column ALTERs needed (`stores.cnpj_normalized` already nullable). Include REVERT comment block.

---

## Shared Patterns

### Authentication / Route wrapping
**Source:** `src/app/api/store/route.ts:41-44, 293-298`
**Apply to:** `POST /api/store` draft branch
```typescript
export const POST = apiHandler(async (request: NextRequest) => {
  requireSameOrigin(request);
  try {
    const user = await requireUser();
    ...
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    throw error;
  }
});
```

### Server component store resolution + redirects
**Source:** `src/app/(app)/loja/page.tsx:6-15` + `src/app/(app)/campanhas/nova/page.tsx:12-28`
**Apply to:** `campanhas/nova/page.tsx`, `cadastro/cnpj/page.tsx` (redirect targets)
```typescript
const user = await requirePageUser();
const store = await getCurrentStore(user.userId);
if (!store) redirect("/loja");
const readiness = await getStoreReadiness(store.id);
if (!readiness.ready) {
  const firstMissing = readiness.missing[0].item;
  if (firstMissing === "cadastro_fiscal") redirect(`/loja?tab=dados&fiscal=pending&returnTo=${...}`);
  else redirect(`/loja?tab=direcao-visual&message=needs-visual-direction&returnTo=${...}`);
}
```

### Readiness (F34) — no logic change for draft stores
**Source:** `src/lib/store-readiness.ts:15-41`
**Apply to:** `tab-state.ts` (context), readiness specs
```typescript
export async function getStoreReadiness(storeId: string): Promise<StoreReadinessResult> {
  try {
    const { data, error } = await supabaseAdmin.rpc("check_store_readiness", { p_store_id: storeId });
    if (error) { console.error(...); return fallbackResult(error.message); }
    ...
  } catch (err) { ... return fallbackResult(message); }
}
```
A draft store (NULL fiscal fields) already falls into `missing: ["cadastro_fiscal", ...]` via the F34 RPC (`20260729000001_f34_store_readiness.sql:96-127`) — no RPC change. `MissingItem.item` type is `"cadastro_fiscal" | "brand_profile"` (`store-readiness.ts:5-8`).

### Save status feedback (badge "Não salvo" + toast)
**Source:** `store-identity-form.tsx:1171-1190` (error/success banners) + `FeedbackOverlay` (`feedback-overlay.tsx:13`, wired at 2515-2520)
**Apply to:** `useOnboardingTabs` `saveStatus` rendering, `legal-acceptance-panel` CTA states
```typescript
{error && !suppressErrorBanner && (
  <div className="mb-6 flex items-start gap-3 bg-red-900/20 border border-red-700/30 rounded-lg px-4 py-3">
    <AlertCircle className="w-5 h-5 text-accent-red shrink-0 mt-0.5" />
    <p className="text-accent-red text-sm font-body flex-1">{error}</p>
  </div>
)}
```

### Touch targets ≥ 44px (F22)
**Source:** `store-identity-form.tsx:1806, 1818, 1921` (buttons use `min-h-[44px]`/`min-w-[44px]`)
**Apply to:** `store-tabs.tsx` (tab buttons, "Continuar" CTA), `legal-acceptance-panel.tsx` (CTA)

### Drift integration (D13) — save deferred until decision
**Source:** `store-identity-form.tsx:1093-1112` (bifurcation), `2312-2457` (modals), `use-drift-detection.ts:144-192` (endpoints)
**Apply to:** `use-onboarding-tabs.ts` (orquestração de saída: `options.onDriftNavigate`/`options.onDriftLeave` callbacks de entrada + flags `pendingNavUrl`/`driftSaveIntercept`/`driftNavIntercept` no componente), `StoreIdentityForm` (componente orquestrador — monta modais e consome `useDriftDetection`). `use-drift-detection.ts` NÃO é alterado (apenas consumido).
Flow: drift `critical`+`new` → DriftCriticalModal → `dismissCriticalDrift()` (POST dismiss) → then PATCH snapshot fields. Drift `sensitive` → DriftDecisionModal → `realinhar()` (POST realign) or `ignorar()` (PATCH metadata with `{ drift_dismissed_snapshot: currentSnapshot }`) → then PATCH + navigate. Cancel → stay in context, snapshot fields NOT persisted. Non-snapshot fields (fiscal/billing/visual) save normally.

---

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `src/components/flow/store-tabs.tsx` | component | request-response | No ARIA tabs (tablist/roving tabindex) exists anywhere in the codebase. Use `store-preview.tsx` for the presentational-props convention, but the ARIA keyboard/tabindex mechanics come from the WAI-ARIA spec (`store-onboarding-tabs` spec D11) and the 44px class convention from F22 |
| `src/lib/store-onboarding/draft-store.ts` | utility | storage | `use-input-preservation.ts` uses `sessionStorage` without TTL; draft-store extends to `localStorage` + TTL 24h + scoped keys — the TTL/expiry logic is new (model it on `restoreDraft` spec scenarios: expired → null + removeItem) |

## Test Pattern Notes

### Pure lib tests (for `tabs.ts` / `tab-state.ts` / `draft-store.ts`)
**Source:** `src/lib/__tests__/drift.test.ts:1-61`
```typescript
import { describe, it, expect } from 'vitest';
import { computeDriftStatus, ... } from '@/lib/drift';
describe('getDriftPolicy', () => {
  it('text_only returns 7 sensitive fields and 0 critical', () => {
    const policy = getDriftPolicy('text_only');
    expect(policy.sensitive).toEqual([...]);
  });
});
```

### Hook shape tests (for `use-onboarding-tabs`)
**Source:** `src/components/flow/__tests__/use-drift-detection.test.ts:1-55` — verifies export type, param count, return-key shape (no React render needed).

### Redirect-message tests (to migrate to `?tab=`)
**Source:** `src/components/flow/__tests__/store-identity-form.redirect-messages.test.ts:16-35` — URLSearchParams extraction assertions; update targets from `required=visual-direction` to `?tab=` variants.

### Readiness banner tests (update hrefs)
**Source:** `src/components/readiness/__tests__/readiness-banner.test.tsx:17-24` — `expect(html).toContain('/loja?required=cadastro-fiscal')` → assert `?tab=dados&fiscal=pending`.

### API endpoint tests (add draft-mode coverage)
**Source:** `src/__tests__/api/store-creation-matrix.test.ts:1-80` (mock pattern: `vi.hoisted` + `mockSupabaseRpc`) and `src/__tests__/api/store-ownership-api.test.ts:156-202` (`POST` returns 201/401/409, ignores body `user_id`). Add: POST without CNPJ → 201 `onboardingGranted:false`; with CNPJ → verified path; duplicate → 409; invalid CNPJ → 400; no `acceptedTerms` → 400; unauthenticated → 401.

---

## Metadata

**Analog search scope:** `src/components/flow/*`, `src/lib/*.ts`, `src/hooks/*.ts`, `src/app/api/store/*`, `src/app/(app)/{loja,campanhas/nova,cadastro/cnpj}/*`, `src/components/{readiness,legacy,legal}/*`, `supabase/migrations/*.sql`, `src/**/__tests__/*`, `src/__tests__/api/*`
**Files scanned:** ~30 (20 classified, 3-5 analog reads per class)
**Pattern extraction date:** 2026-08-01
