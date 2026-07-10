---
phase: 17-edicao-publication-copy
plan: 02
subsystem: api, ui
tags: patch, csrf, validation, inline-edit, react, testing

requires:
  - phase: 17-edicao-publication-copy (17-01)
    provides: validatePublicationCopy, getEffectivePublicationCopy, CampaignPageProps com campaignId/isPublicationCopyEdited
provides:
  - PATCH route handler for editing publication copy (CSRF, auth, ownership, validation guards)
  - Inline edit mode in /campanha/[id] with Edit/Save/Restore/Cancel
  - "Editado" badge indicating modified publication copy
  - Loading and error states during PATCH operations
  - 17 tests (8 route + 9 UI) for the edit cycle
affects: []

tech-stack:
  added: []
  patterns:
    - Inline edit pattern: view mode <-> edit mode toggle with React state
    - PATCH route guard chain: CSRF -> auth -> UUID validation -> getCampaign -> ownership -> body validation
    - Route testing with vi.hoisted mock factories (following existing pattern)

key-files:
  created:
    - src/app/api/campaign/[id]/publication-copy/route.ts
    - src/__tests__/api/publication-copy-route.test.ts
    - src/__tests__/app/campanha/[id]/client.test.tsx
  modified:
    - src/app/campanha/[id]/client.tsx

requirements-completed:
  - REQ-PATCH-ROUTE
  - REQ-PATCH-CSRF
  - REQ-PATCH-UUID-VALIDATION
  - REQ-PATCH-OWNERSHIP
  - REQ-PATCH-RESTORE
  - REQ-PAGE-NEW-PROPS
  - REQ-UI-EDIT-MODE
  - REQ-UI-SAVE
  - REQ-UI-RESTORE
  - REQ-UI-CANCEL
  - REQ-UI-BADGE
  - REQ-UI-LOADING
  - REQ-UI-ERROR

duration: 2min
completed: 2026-07-10
---

# Phase 17: Edição de Publication Copy — Plan 02 Summary

**PATCH route with CSRF/auth/ownership/validation guards + inline edit mode with Edit/Save/Restore/Cancel + badge "Editado" + loading/error states + 17 tests (8 route + 9 UI)**

## Performance

- **Duration:** 2 min
- **Started:** 2026-07-10T17:06:52Z
- **Completed:** 2026-07-10T17:09:47Z
- **Tasks:** 5
- **Files modified:** 4

## Accomplishments

- PATCH `/api/campaign/[id]/publication-copy` route with full security chain: `requireSameOrigin` (CSRF) → `requireApiUser` → UUID v4 validation → `getCampaign` → `requireOwnership` → `validatePublicationCopy` → Supabase update
- Support for two modes: normal edit (caption/hashtags/cta_post) and restore (resets `publication_copy_current` to null, returns snapshot)
- Inline edit mode in `client.tsx` ReadyView: view mode shows caption/hashtags/cta_post with "✏️ Editar" button; edit mode shows textarea/input controls with "💾 Salvar", "↩️ Restaurar original", and "Cancelar" buttons
- Badge "Editado" appears when `isPublicationCopyEdited` is true (determined by `publication_copy_current !== null`)
- Loading state ("Salvando...") with all buttons disabled during PATCH; error state shows message without exiting edit mode
- 8 route test scenarios (success, validation error, invalid UUID, not found, cross-tenant, restore, CSRF, unauthenticated)
- 9 UI test scenarios (view mode, badge shown/hidden, edit mode entry, PATCH save, restore with confirm, cancel, disabled during saving, error display)

## Task Commits

Each task was committed atomically:

1. **Task 1: Create PATCH route handler** - `60dde25` (feat)
2. **Task 2: Modify page.tsx to pass new props** - No changes needed (`{...props}` spread already passes `campaignId` and `isPublicationCopyEdited`)
3. **Task 3: Modify client.tsx with inline edit mode** - `f5d56bf` (feat)
4. **Task 4: Create publication-copy-route test (8 scenarios)** - `8b91e1a` (test)
5. **Task 5: Create client.test.tsx (9 UI scenarios)** - `db00110` (test)

**Plan metadata commits:** (pending final commit)

## Files Created/Modified
- `src/app/api/campaign/[id]/publication-copy/route.ts` - PATCH route handler with full security chain and restore support
- `src/app/campanha/[id]/client.tsx` - Modified with inline edit mode (states, handlers, view/edit UI)
- `src/__tests__/api/publication-copy-route.test.ts` - 8 route test scenarios using mocked deps
- `src/__tests__/app/campanha/[id]/client.test.tsx` - 9 UI test scenarios with @testing-library/react

## Decisions Made
- Followed existing route handler pattern (`apiHandler` wrapper, `export const dynamic = "force-dynamic"`, UUID v4 regex) from the download route
- test strategy matches the existing pattern in `campaign-download.test.ts`: vi.mock per dependency module, mock factory functions for test-specific behavior
- UI test strategy matches the existing pattern in `minhas-campanhas-client.test.tsx`: @testing-library/react with `// @vitest-environment jsdom`
- page.tsx required no changes — the `{...props}` spread already passes through all `CampaignPageProps` including new `campaignId` and `isPublicationCopyEdited`

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## Verification Results

- `npx vitest run src/__tests__/api/publication-copy-route.test.ts` — 8/8 passing ✓
- `npx vitest run src/__tests__/app/campanha/[id]/client.test.tsx` — 9/9 passing ✓
- `npm run typecheck` — zero errors ✓
- `npm run lint` — zero errors ✓
- `npm run build` — zero errors ✓

## Next Phase Readiness

Phase 17 is complete. All 17 tests pass, TypeScript/lint/build are clean. The lojista can now edit caption, hashtags, and cta_post of any campaign without regenerating the image, and restore the original AI-generated text with one click. Ready for milestone completion.

---

## Self-Check: PASSED

All key files exist and all commits are verified in git history.

---

*Phase: 17-edicao-publication-copy*
*Completed: 2026-07-10*
