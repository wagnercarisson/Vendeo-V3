---
status: investigating
trigger: "Modal enters review phase instead of generating new VS during reject flow"
created: 2026-06-19T10:00:00Z
updated: 2026-06-19T10:00:00Z
---

## Current Focus

hypothesis: "isOpen toggles during the reject flow because parent showApprovalModal is set to false and then true, causing modal unmount+remount with fresh phase='checking'"
test: "Add console.log to track isOpen prop changes and parent showApprovalModal setState calls"
expecting: "Logs will show showApprovalModal becoming false during handleConfirmReject execution"
next_action: "Report complete analysis to user with findings and recommended fix"

## Symptoms

expected: "User clicks 'Não gostei' → fills feedback → clicks 'Gerar outra versão' → spinner shows → new VS 2 displays"
actual: "After clicking 'Gerar outra versão', the review phase appears showing 'Assinaturas existentes (1/3)'"
errors: "No error messages — just wrong phase transition"
reproduction: "1. Open modal (no existing signatures), 2. Wait for VS 1 generation, 3. Click 'Não gostei', 4. Fill feedback, 5. Click 'Gerar outra versão'"
started: "Unknown — always or recently introduced"

## Eliminated

- hypothesis: "handleConfirmReject has a stale closure or doesn't call generate()"
  evidence: "handleConfirmReject depends on [state, storeId, feedbackText, generate] — all latest values. It's recreated on every render where any dep changes. generate is useCallback([storeId]) which is stable when storeId doesn't change. The function CALLS generate() after the await."
  timestamp: "2026-06-19T10:00:00Z"

- hypothesis: "isGeneratingRef prevents the second generate() call"
  evidence: "isGeneratingRef.current is reset to false in the finally block of the initial generate() call that created VS 1. By the time handleConfirmReject fires, the user has already seen VS 1, clicked 'Não gostei', typed feedback, and clicked 'Gerar outra versão'. The initial generate() completed long before handleConfirmReject runs."
  timestamp: "2026-06-19T10:00:00Z"

- hypothesis: "React Strict Mode double-firing causes duplicate effect runs"
  evidence: "Even in Strict Mode, the second effect invocation would find state.phase='checking' but isGeneratingRef.current is true from first invocation, so duplicate generate() is skipped."
  timestamp: "2026-06-19T10:00:00Z"

- hypothesis: "API response race condition (late response from initial generate interferes)"
  evidence: "The initial generate() fully completes (response parsed, setState called, isGeneratingRef reset) before the user can interact with VS 1. The user MUST see VS 1 before clicking 'Não gostei'. So the initial generate is fully complete before handleConfirmReject fires."
  timestamp: "2026-06-19T10:00:00Z"

- hypothesis: "Form submission from parent store-identity-form.tsx causes navigation/re-render"
  evidence: "Modal is rendered OUTSIDE the <form> element (at top level of component return). All buttons inside modal are type='button'. No event bubbling can trigger form submission."
  timestamp: "2026-06-19T10:00:00Z"

- hypothesis: "Button malfunction/stale event handler"
  evidence: "handleConfirmReject is recreated whenever state, storeId, feedbackText, or generate changes. Since it depends on state (the full object, changing every setState), it's always fresh. The button's onClick uses the latest version from the latest render."
  timestamp: "2026-06-19T10:00:00Z"

- hypothesis: "State update batching in React 18 causes issues"
  evidence: "Both setStoredRejectionContext and setState({ phase: 'generating' }) from generate() are called in the same microtask. React 18 batches them into a single render where state.phase='generating'. The checking effect sees phase!='checking' and does nothing. Correct behavior."
  timestamp: "2026-06-19T10:00:00Z"

## Evidence

- timestamp: "2026-06-19T10:00:00Z"
  checked: "visual-signature-approval-modal.tsx line 173 — sole code path for 'review' phase"
  found: "setState({ phase: 'review', signatures: sigs, canGenerate: true }) is ONLY called from the checking useEffect (line 156-183), when state.phase === 'checking' AND existing signatures found"
  implication: "To reach 'review', state.phase MUST become 'checking' during the reject flow. This is a NON-NEGOTIABLE prerequisite."

- timestamp: "2026-06-19T10:00:00Z"
  checked: "All code paths that set phase to 'checking'"
  found: "EXACTLY TWO PATHS: (1) Line 77: initial useState({ phase: 'checking' }) — only on component mount. (2) Line 188: cleanup useEffect — when isOpen transitions to false. See lines 186-192."
  implication: "The component must either (A) unmount and remount freshly, or (B) receive isOpen=false long enough for cleanup to fire, then isOpen=true again. Both require the parent's showApprovalModal to become false during the reject flow."

- timestamp: "2026-06-19T10:00:00Z"
  checked: "Both parent components that render VisualSignatureApprovalModal"
  found: "TWO PARENTS: store-identity-form.tsx (lines 1587-1605, used by StorePageClient) and store-visual-signature-section.tsx (lines 336-351, not imported anywhere else). Both use conditional rendering: {showApprovalModal && <VisualSignatureApprovalModal .../>}. Both pass isOpen={showApprovalModal} and onClose={() => setShowApprovalModal(false)}."
  implication: "When showApprovalModal is false, the component UNMOUNTS entirely. When true again, it RE-MOUNTS with fresh state {phase:'checking'}. The checking effect then runs, finds VS 1, and sets phase to 'review'. This is the ONLY explanation for the review screen showing 'Assinaturas existentes (1/3)'."

- timestamp: "2026-06-19T10:00:00Z"
  checked: "store-identity-form.tsx — all setShowApprovalModal(false) calls"
  found: "ONLY setShowApprovalModal(false) at line 443, inside handleApprovalComplete callback. This is called from the modal's onComplete prop. In the modal, onComplete is called from: (1) handleApprove (approval button in 'display' phase), (2) handleContinueWithoutLogo ('Continuar sem logo' in 'error' phase). Neither fires during the reject flow (feedback→generating→display)."
  implication: "The explicit setShowApprovalModal(false) call is not the trigger. But the parent's inline onClose={() => setShowApprovalModal(false)} could fire if the modal's handleClose is somehow triggered. handleClose is only called from the X button (visible during feedback phase but not expected to be clicked)."

- timestamp: "2026-06-19T10:00:00Z"
  checked: "store-identity-form.tsx — all other effects and handlers for potential side effects"
  found: "Drift detection click handler (lines 175-213) intercepts document clicks during step 2 with driftStatus='new'. Uses capture phase (true). Only intercepts clicks on <a> elements. The modal's buttons are <button> elements. Should not interfere."
  implication: "No documented side effect in the parent can set showApprovalModal to false during the reject flow."

- timestamp: "2026-06-19T10:00:00Z"
  checked: "The generate() function's behavior when called from handleConfirmReject"
  found: "generate() is useCallback with [storeId] dependency. It sets isGeneratingRef.current=true, then calls setState({phase:'generating'}), then fetches POST /api/store/${storeId}/visual-signature/generate-without-logo. On success, sets state to {phase:'display', ...}. On error, sets {phase:'error'}. On exhausted, sets {phase:'exhausted'}. It NEVER sets {phase:'checking'} or {phase:'review'}."
  implication: "The generate() function itself is correct. The bug is NOT inside generate()."

- timestamp: "2026-06-19T10:00:00Z"
  checked: "handleConfirmReject's async execution and the guarding useEffect at line 186"
  found: "handleConfirmReject is async. After the await fetch(/reject), it calls setStoredRejectionContext and generate() in sequence. Both are in the same microtask after the promise resolves. The cleanup effect (line 186-192) only sets phase='checking' when isOpen becomes false. There is no code path where isOpen becomes false inside handleConfirmReject."
  implication: "The isOpen toggle MUST come from OUTSIDE the modal — something in the parent's render cycle."

## Resolution

root_cause: "INFERRED BUT UNCONFIRMED: The modal's isOpen prop toggles during the handleConfirmReject async flow. The parent sets showApprovalModal to false (either via onClose, onComplete, or some unrecognized mechanism), causing the modal to unmount with cleanup effect setting phase='checking'. When showApprovalModal returns to true, the modal remounts fresh. The checking useEffect fires, finds VS 1 (now stored in DB), and sets phase='review' showing 'Assinaturas existentes (1/3)'. The exact trigger for the showApprovalModal toggle could not be identified through code analysis alone — it may be a parent re-render, event handler race, or timing issue."
fix: "TBD — see recommended fix below"
verification: ""
files_changed: []

## Recommended Fix

### Defensive Guard (Primary)
Add a guard in the checking effect to prevent it from running when the reject flow is active. The cleanest approach: use a ref to track whether the component is mid-flow (i.e., already generated a VS and is in feedback/generating/display cycle):

```typescript
// Add this ref:
const hasEverGeneratedRef = useRef(false);

// Set it when generate succeeds:
// In generate(), after successful creation, add:
// hasEverGeneratedRef.current = true;

// Guard the checking useEffect:
useEffect(() => {
    if (!isOpen) return;
    if (state.phase === "checking" && !hasEverGeneratedRef.current) {
        // Only actually check when we've never generated before
        // ...
    }
}, [isOpen, state.phase, storeId, generate, hasEverGeneratedRef]);
```

This prevents the checking effect from running after the component has already generated at least one VS, even if phase somehow resets to "checking".

### OR: Eliminate the cleanup effect's state reset
Change the cleanup effect to only clear local state but NOT reset the phase:
```typescript
useEffect(() => {
    if (!isOpen) {
        // Don't set phase to "checking" — this causes the remount problem
        setFeedbackText("");
        setStoredRejectionContext(null);
    }
}, [isOpen]);
```
But this alone doesn't fix the root cause because the component unmounts/remounts anyway.

### OR: Prevent remount by making isOpen always true while component is mounted
Change the parent rendering to not conditionally mount/unmount:
```tsx
// Instead of {showApprovalModal && <Modal isOpen={showApprovalModal} />}
// Use: <Modal isOpen={showApprovalModal} />
// And have the modal's return null handle the visibility
```

### Diagnostic Logging (Recommended Before Any Fix)
Add logging to identify the exact trigger:
```typescript
// In the parent, wrap setShowApprovalModal:
const setShowApprovalModal = useCallback((value: boolean) => {
    console.log('[StoreIdentityForm] setShowApprovalModal', value, 'at phase', state.phase, new Error().stack);
    _setShowApprovalModal(value);
}, []);

// In the modal, log isOpen changes:
useEffect(() => {
    console.log('[Modal] isOpen changed to', isOpen, 'phase was', state.phase);
}, [isOpen]);
```
