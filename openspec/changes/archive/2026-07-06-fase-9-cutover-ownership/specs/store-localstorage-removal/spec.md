## ADDED Requirements

### Requirement: No localStorage("store_id") in any source file

The system SHALL remove all references to `localStorage` store identity from every file in `src/`.

- No file in `src/components/flow/` or `src/components/auth/` SHALL contain `localStorage` in any context (catches both `localStorage("store_id")` and `localStorage.getItem(STORAGE_KEY)` patterns)
- No file SHALL define `STORAGE_KEY = "store_id"` or similar constant
- Affected files (confirmed clean):
  - `src/components/flow/campaign-page-client.tsx`
  - `src/components/flow/store-page-client.tsx`
  - `src/components/flow/use-store-form.ts`
  - `src/components/auth/logout-button.tsx`
- The sessionStorage keys (`campaign_draft`, `campaign_draft_image`, `campaign_preview`) SHALL remain in logout cleanup

#### Scenario: No localStorage references in affected files

- **WHEN** running `rg "localStorage" src/components/flow/ src/components/auth/`
- **THEN** zero results are returned (from these directories)

#### Scenario: Logout still cleans sessionStorage keys

- **WHEN** user clicks "Sair"
- **THEN** `sessionStorage.removeItem("campaign_draft")` is called
- **AND** `sessionStorage.removeItem("campaign_draft_image")` is called
- **AND** `sessionStorage.removeItem("campaign_preview")` is called
- **AND** `localStorage.removeItem("store_id")` is NOT called (no longer exists)
