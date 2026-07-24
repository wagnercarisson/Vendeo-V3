---
id: 260724-hzz
type: quick
wave: 1
autonomous: false
files_modified:
  - src/components/legal/privacy-gate.tsx (CREATE)
  - src/app/(app)/layout.tsx (MODIFY)
must_haves:
  truths:
    - "User without valid privacy acknowledgement sees PrivacyAcknowledgeModal blocking access after login"
    - "User who confirms (checkbox + Confirmar ciência) is no longer shown the gate on subsequent pages"
    - "User who cancels (close/backdrop/Cancelar) is redirected to /conta?privacy=pending"
    - "User already at /conta?privacy=pending does NOT see the modal again (avoids loop)"
    - "Pre-Fase 30 users, admin-invited users, and users with outdated privacy_policy version are all covered"
    - "Privacy policy does NOT enter requireLegalClearance — content_generation guard unchanged"
  artifacts:
    - path: src/components/legal/privacy-gate.tsx
      provides: "Client component that conditionally renders PrivacyAcknowledgeModal based on acknowledgement status"
      min_lines: 50
    - path: src/app/(app)/layout.tsx
      provides: "Server-side hasValidPrivacyAcknowledgement check + PrivacyGate rendering inside AppShell"
      exports: ["AppLayout"]
  key_links:
    - from: src/app/(app)/layout.tsx
      to: src/lib/legal/privacy.ts
      via: "import { hasValidPrivacyAcknowledgement }"
    - from: src/app/(app)/layout.tsx
      to: src/components/legal/privacy-gate.tsx
      via: "import { PrivacyGate }"
    - from: src/components/legal/privacy-gate.tsx
      to: src/components/legal/privacy-acknowledge-modal.tsx
      via: "import { PrivacyAcknowledgeModal }"
    - from: src/components/legal/privacy-gate.tsx
      to: /api/legal/acknowledge-privacy
      via: "fetch POST in handleConfirm"
---

# Quick Plan: Privacy Gate pós-login — ciência de Política de Privacidade

## Objective

Implement post-login privacy policy acceptance gate that shows `PrivacyAcknowledgeModal` for users who lack valid privacy acknowledgement of the current `privacy_policy` version.

**Purpose:** Catch users who missed privacy acknowledgement during signup — pre-Fase 30 users, admin-invited users, users with outdated `privacy_policy` version, and any user without a `privacy_acknowledgements` record. The gate runs server-side in `(app)/layout.tsx` so it applies on every authenticated page load.

**Non-goals (explicitly excluded):**
- Do NOT alter `requireLegalClearance` or `CAPABILITY_DOCUMENTS`
- Do NOT alter middleware
- Do NOT add new API routes or database tables
- Do NOT add `privacy_policy` to `content_generation` guard

## Context

@src/app/(app)/layout.tsx
@src/components/legal/privacy-acknowledge-modal.tsx
@src/lib/legal/privacy.ts
@src/app/api/legal/acknowledge-privacy/route.ts

### Existing interfaces (no exploration needed)

From `src/components/legal/privacy-acknowledge-modal.tsx`:
```tsx
interface PrivacyAcknowledgeModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => Promise<boolean>;
  policyVersion?: string;
}
```
- `onConfirm`: called when user checks the box and clicks "Confirmar ciência". Returns `true` on success → modal auto-closes via `onOpenChange(false)`.
- `onOpenChange(false)`: called on Cancel button, backdrop click, and AFTER successful confirm.

From `src/app/api/legal/acknowledge-privacy/route.ts`:
- `POST /api/legal/acknowledge-privacy` — accepts `{}` (or `{ communicationsOptIn }`). Returns `{ ok: true }` on success, `{ ok: false }` on error. Requires authenticated user (uses `requireApiUser`).

From `src/lib/legal/privacy.ts`:
```tsx
export async function hasValidPrivacyAcknowledgement(userId: string): Promise<boolean>
```
- Returns `true` if user's `privacy_acknowledgements.privacy_policy_version` matches the current published `privacy_policy` version. `false` if no record or version mismatch.

## Execution

```bash
# Ensure working directory
cd $WORKSPACE_ROOT
```

## Tasks

### Task 1: Create PrivacyGate client component

**File:** `src/components/legal/privacy-gate.tsx`

**Type:** `auto`

**Action:**

Create a `"use client"` component with the following structure:

```tsx
"use client";

import { useCallback, useRef } from "react";
import { usePathname, useSearchParams, useRouter } from "next/navigation";
import { PrivacyAcknowledgeModal } from "./privacy-acknowledge-modal";

interface PrivacyGateProps {
  acknowledged: boolean;
}
```

**Behavior:**

1. **Early return null** if `acknowledged === true` → user already has valid acknowledgement, no gate needed.

2. **Detect `/conta?privacy=pending`** using `usePathname()` and `useSearchParams()`. If `pathname === "/conta"` AND `searchParams.get("privacy") === "pending"`, return null (avoids redirect loop).

3. **`handleConfirm`**: `async () => Promise<boolean>`:
   - `fetch("POST /api/legal/acknowledge-privacy")` with `{ "Content-Type": "application/json" }`, body `{}`.
   - Parse JSON response.
   - If `data.ok === true`: set `didConfirmRef.current = true`, call `router.refresh()`, return `true`.
   - Otherwise: return `false` (modal shows error state).

4. **`handleOpenChange`**: `(open: boolean) => void`:
   - If `open === false` AND `didConfirmRef.current === false` (user cancelled/closed without confirming):
     - `router.push("/conta?privacy=pending")`
   - If `open === false` AND `didConfirmRef.current === true` (user confirmed → modal auto-closed):
     - Do nothing. `router.refresh()` from `handleConfirm` will re-render the server tree with `acknowledged: true`, causing PrivacyGate to return null.

5. **Render**: `<PrivacyAcknowledgeModal open={true} onOpenChange={handleOpenChange} onConfirm={handleConfirm} />`

**Why `didConfirmRef` pattern:** The modal calls `onOpenChange(false)` for both confirm-success and cancel. A ref (not state) lets us distinguish these two paths without causing a re-render race with `router.refresh()`.

**Verify:**
- `<automated>` Component compiles with `npx tsc --noEmit` (typecheck passes)
- `<human-check>` (see checkpoint below)

**Done:**
- `src/components/legal/privacy-gate.tsx` exists with correct exports
- TypeScript compiles clean
- Logic covers: acknowledged=true, unacknowledged, /conta?privacy=pending detection, confirm path, cancel path

---

### Task 2: Modify AppLayout — add server-side check + render gate

**File:** `src/app/(app)/layout.tsx`

**Type:** `auto`

**Action:**

1. Add import for `hasValidPrivacyAcknowledgement` from `@/lib/legal/privacy`
2. Add import for `PrivacyGate` from `@/components/legal/privacy-gate`
3. After `getCurrentStore(user.userId)`, add:
   ```tsx
   const acknowledged = await hasValidPrivacyAcknowledgement(user.userId);
   ```
4. Inside `AppShell`, alongside `<PrivacyRecovery />`, render:
   ```tsx
   <PrivacyGate acknowledged={acknowledged} />
   ```

**Verify:**
- `<automated>` `npx tsc --noEmit` — typecheck passes
- `<human-check>` (see checkpoint below)

**Done:**
- Layout passes `acknowledged` boolean to PrivacyGate
- No changes to middleware, API routes, requireLegalClearance, or content_generation guard
- `PrivacyRecovery` remains unchanged (still handles signup recovery path via sessionStorage)

---

### Task 3 (checkpoint): Visual verification of the full flow

**Type:** `checkpoint:human-verify`

**Gate:** `blocking`

**What was built:**
- `PrivacyGate` client component that conditionally renders `PrivacyAcknowledgeModal`
- Server-side check in `(app)/layout.tsx` that calls `hasValidPrivacyAcknowledgement` and passes result to `PrivacyGate`

**How to verify:**

1. **User without acknowledgement:**
   - Find a user who lacks a `privacy_acknowledgements` record or has an outdated version.
   - Log in → confirm you see the Privacy Policy modal immediately after login.
   - Verify the modal displays the policy summary with checkbox + Confirmar ciência + Cancelar buttons.

2. **Confirm flow:**
   - Check the checkbox.
   - Click "Confirmar ciência".
   - Verify: modal closes, page refreshes, no further privacy gate appears on navigation.

3. **Cancel flow:**
   - Log in as another unacknowledged user (or clear the row).
   - Click Cancelar or the backdrop outside the modal.
   - Verify: you are redirected to `/conta?privacy=pending`.

4. **Loop guard:**
   - While at `/conta?privacy=pending`, verify the modal does NOT reappear.
   - Navigate to another page → modal should reappear (still unacknowledged).

5. **Already-acknowledged user:**
   - Log in as a user with a valid privacy_acknowledgements record.
   - Verify: no privacy gate modal appears, app loads normally.

6. **Non-regression:**
   - Verify that clicking "Gerar campanha" on an unacknowledged account still works (privacy does NOT block content_generation per decision).
   - Verify `/termos`, `/privacidade`, `/uso-aceitavel` public pages are unaffected.

**Resume signal:** Type "approved" to complete, or describe any issues found.

---

## Verification

```bash
# TypeScript
npx tsc --noEmit

# Lint
npx next lint

# Build
npx next build
```
