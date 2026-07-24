---
status: complete
phase: 30-legal-foundation
source: [01-SUMMARY.md, 02-SUMMARY.md, 03-SUMMARY.md, 04-SUMMARY.md, 05-SUMMARY.md, 06-SUMMARY.md]
started: 2026-07-24T16:22:00.000Z
updated: 2026-07-24T16:37:00.000Z
---

## Current Test
<!-- OVERWRITE each test - shows where we are -->

[testing complete]

## Summary

All 12 tests passed. 1 blocker found and fixed during testing:
- Migration 20260724000002: fixed ambiguous column reference in RPC
- Error response format: `error` changed from object to string in 403 responses
- Modal crash: VS approval modal now handles 403 with acceptUrl
- Document viewer: created LegalDocumentViewer, ContractAcceptanceModal, PrivacyAcknowledgeModal with official document fetching

## Tests

### 1. Legal documents served on public pages
expected: /termos, /privacidade, /uso-aceitavel are accessible without auth. Each shows title, version, full content. HTTP 200.
result: pass

### 2. Privacy checkbox required on signup
expected: Signup form shows required checkbox "Declaro ciência da Política de Privacidade" with link /privacidade. Form cannot submit without checking it.
result: pass

### 3. Communications opt-in is optional on signup
expected: Signup form shows optional checkbox "Aceito receber comunicações comerciais do Vendeo." Separate and detachable from privacy checkbox.
result: pass

### 4. Legal acceptance checkbox in store creation
expected: Store identity form (create mode) shows required checkbox "Li e aceito os Termos de Uso e a Política de Uso Aceitável" with links /termos and /uso-aceitavel. Cannot submit without checking it.
result: pass
evidence: "store-identity-form.tsx:1160-1185 renders checkbox, :844-847 blocks without check, use-store-form.ts:199-201 sends acceptedTerms on create"

### 5. Store creation registers legal acceptance
expected: After completing onboarding with accepted terms checked, store is created and GET /api/legal/status returns acceptance: current for both terms_of_service and acceptable_use.
result: pass
fix: "Migration 20260724000002 applied — all local vars renamed to v_ prefix, columns qualified"

### 6. Pipeline guard blocks generation without valid acceptance
expected: Attempting to generate a campaign when legal acceptance is outdated/missing returns 403 with { acceptUrl: "/legal/reaccept", requiredDocuments, reason }. Campaign generation is blocked.
result: pass

### 7. Visual signature guard blocks without valid acceptance
expected: Attempting to generate visual signature when acceptance is outdated returns 403. VS approval modal shows blocking message with re-aceite link.
result: pass
fix: "generate-without-logo/route.ts: error changed from object to string; modal handles 403 + acceptUrl, shows 'Aceitar nova versão' link"

### 8. Re-aceite page shows pending documents
expected: /legal/reaccept detects which contract documents need re-aceite. Shows change summary and "Aceitar nova versão" button. After accepting, GET /api/legal/status shows acceptance: current.
result: pass
note: "Both contract documents shown regardless of pending status. Current documents display '✓ Vigente' badge."

### 9. Account page shows legal status
expected: /conta page shows "Privacidade e Termos" card with privacy status (ciente/não), consent toggle (grant/revoke), acceptance status with re-aceite link.
result: pass

### 10. Admin page shows legal badges
expected: /admin/users/[id] shows "Situação Legal" card with badges: Privacy (✅ Ciente / ❌), Acceptance (✅ Vigente / ⏳ Pendente / ❌), Consent (✅ Ativo / ⏳ Revogado / ❌), plus acceptance history table.
result: pass

### 11. Privacy gate recovers on first authenticated access
expected: After signup without session, first authenticated access checks sessionStorage for privacy pending. POST /api/legal/acknowledge-privacy is called automatically. If pending, system shows notification.
result: pass

### 12. Consent grant/revoke cycle works
expected: On /conta page, communications consent toggle grants consent (POST /api/legal/communications-consent with { consent: true }). Toggling again revokes it (consent: false). Status updates reflect the change.
result: pass

## Summary

total: 12
passed: 12
issues: 0
pending: 0
skipped: 0

## Implementation Log

- LegalDocumentViewer: created
- document-content.ts: helpers for doc info
- GET /api/legal/status: returns documents field
- PrivacyAcknowledgeModal: shows official document via viewer
- ContractAcceptanceModal: shows official documents via viewer
- PrivacyGate: receives policyDocument from layout
- layout.tsx: passes policyDocument to PrivacyGate
- LegalStatusSection: passes documents to modals
- signup-form: uses PrivacyAcknowledgeModal for privacy reading
- store-identity-form: uses ContractAcceptanceModal for terms reading
- /termos, /privacidade, /uso-aceitavel: render via LegalDocumentViewer

## Gaps (Resolved)

- truth: "Store creation API registers legal acceptance and returns 201"
  status: resolved
  reason: "User reported: POST /api/store returns 500 - column reference 'balance' is ambiguous"
  severity: blocker
  test: 5
  root_cause: "SQL function create_store_with_legal_acceptance (migration 20260723000003) declared local variables (store_id, balance) that shadow column names in credit_balances and stores tables. With search_path = '', Postgres cannot disambiguate COALESCE(balance, 0) — balance could be local variable or credit_balances.balance."
  artifacts:
    - path: "supabase/migrations/20260724000002_fix_create_store_with_legal_acceptance_balance.sql"
      issue: "New migration: renamed all local variables to v_ prefix, qualified columns with table alias"
  missing:
    - "Rename store_id → v_store_id in DECLARE and all references"
    - "Rename store_data → v_store_data in DECLARE and all references"
    - "Rename balance → v_balance in DECLARE and all references"
    - "Use COALESCE(cb.balance, 0) with table alias to qualify column"
    - "Use v_ prefix in INSERT RETURNING INTO, PERFORM grant_credits, and JSON output"
    - "Re-apply GRANT EXECUTE TO service_role after CREATE OR REPLACE"
  debug_session: ""
  fixed_by: "Migration 20260724000002 — applied and verified by user"

- truth: "VS approval modal shows clear error message with re-aceite link"
  status: resolved
  reason: "User reported: modal crashed with 'Objects are not valid as a React child' due to error being an object {message} instead of string"
  severity: major
  test: 7
  root_cause: "generate-without-logo route returned error as object { message } instead of string; modal tried to render object as React child"
  artifacts:
    - path: "src/app/api/store/[id]/visual-signature/generate-without-logo/route.ts"
      issue: "error field was object, changed to string"
    - path: "src/app/api/campaign/generate-image/route.ts"
      issue: "same pattern, fixed for consistency"
    - path: "src/components/flow/visual-signature-approval-modal.tsx"
      issue: "added 403 handling with acceptUrl, show 'Aceitar nova versão' link"
  fixed_by: "Route response format fixed + modal handles 403 with link"
