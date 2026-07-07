## MODIFIED Requirements

### Requirement: Client-side storage cleanup before logout

**MODIFIED**: The `localStorage.removeItem("store_id")` call is removed from the logout cleanup. The remaining cleanup SHALL cover only sessionStorage keys.

- MUST remove `sessionStorage` keys: `campaign_draft`, `campaign_draft_image`, `campaign_preview`
- SHALL NOT remove `localStorage("store_id")` — store is no longer stored in localStorage
- SHALL NOT use `clear()` — removal is scoped to known keys only
- SHALL proceed with form submission even if cleanup encounters errors (best-effort)

#### Scenario: Logout cleans sessionStorage keys only

- **WHEN** user clicks "Sair"
- **THEN** `sessionStorage.removeItem("campaign_draft")` is called
- **AND** `sessionStorage.removeItem("campaign_draft_image")` is called
- **AND** `sessionStorage.removeItem("campaign_preview")` is called
- **AND** `localStorage.removeItem("store_id")` is NOT called

#### Scenario: Logout does not clear unknown keys

- **WHEN** user clicks "Sair"
- **THEN** other keys in localStorage and sessionStorage are preserved
