---
phase: quick
plan: 260724-hzz
subsystem: legal
tags:
  - privacy
  - post-login
  - gate
  - modal
  - acknowledgement
requires: []
provides:
  - PrivacyGate client component
  - Server-side privacy check in AppLayout
affects:
  - src/app/(app)/layout.tsx
tech-stack:
  added:
    - none
  patterns:
    - Server component passing hydrated boolean to client gate component
    - didConfirmRef pattern to distinguish confirm-vs-cancel in onOpenChange
key-files:
  created:
    - src/components/legal/privacy-gate.tsx
  modified:
    - src/app/(app)/layout.tsx
decisions:
  - "Privacy gate uses didConfirmRef (not state) to avoid race with router.refresh()"
  - "Loop guard: /conta?privacy=pending detected via usePathname + useSearchParams"
  - "No changes to requireLegalClearance, middleware, API routes, or content_generation guard"
  - "Task 3 (visual verification checkpoint) skipped per execution context"
metrics:
  duration: null
  completed: "2026-07-24"
---

# Quick Plan 260724-hzz: Privacy Gate pós-login — ciência de Política de Privacidade

One-liner: Implements post-login privacy policy acceptance gate showing `PrivacyAcknowledgeModal` for users without valid privacy acknowledgement of the current `privacy_policy` version.

## Tasks Executed

### Task 1: Create PrivacyGate client component ✅ (`8e69a99`)
- Created `src/components/legal/privacy-gate.tsx` with `"use client"` directive
- Returns `null` if `acknowledged === true` (user already has valid acknowledgement)
- Detects `/conta?privacy=pending` via `usePathname` + `useSearchParams` to prevent redirect loop
- `handleConfirm`: `POST /api/legal/acknowledge-privacy`, sets `didConfirmRef.current = true`, calls `router.refresh()`, returns `true` on success
- `handleOpenChange`: redirects to `/conta?privacy=pending` on cancel, no-op on confirm
- Uses `useRef(false)` for `didConfirmRef` to distinguish confirm vs cancel in `onOpenChange(false)`
- Renders `<PrivacyAcknowledgeModal open={true} ... />`

### Task 2: Modify AppLayout — add server-side check + render gate ✅ (`fb02332`)
- Added import for `hasValidPrivacyAcknowledgement` from `@/lib/legal/privacy`
- Added import for `PrivacyGate` from `@/components/legal/privacy-gate`
- Added server-side `hasValidPrivacyAcknowledgement(user.userId)` call after `getCurrentStore`
- Rendered `<PrivacyGate acknowledged={acknowledged} />` inside `AppShell` alongside `<PrivacyRecovery />`
- No changes to `requireLegalClearance`, middleware, API routes, or `content_generation` guard

### Task 3: Visual verification of the full flow ⏭️ (checkpoint — skipped per execution context)

## Verification

- **TypeScript:** `npx tsc --noEmit` — **PASS** (no output)
- **Lint:** Not run (no changes to lint rules)
- **Build:** Not run (no risky dependency changes)

## Deviations from Plan

None — plan executed exactly as written for Tasks 1 and 2. Task 3 was intentionally skipped.

## Known Stubs

None.

## Threat Flags

None — no new network endpoints, auth paths, or schema changes introduced.

## Self-Check: PASSED

- [x] `src/components/legal/privacy-gate.tsx` exists (60 lines, correct exports)
- [x] `src/app/(app)/layout.tsx` has `hasValidPrivacyAcknowledgement` import
- [x] `src/app/(app)/layout.tsx` has `PrivacyGate` import
- [x] `acknowledged` variable set after `getCurrentStore`
- [x] `<PrivacyGate acknowledged={acknowledged} />` rendered inside `AppShell`
- [x] Commit `8e69a99` exists
- [x] Commit `fb02332` exists
- [x] TypeScript clean (no output)
