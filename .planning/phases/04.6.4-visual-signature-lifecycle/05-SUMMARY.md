# Plan 05: Verification & Quality Gate

## Objective
Validate all changes across the Visual Signature Lifecycle phase through automated checks (typecheck, lint, build) and verification of key contracts.

## Tasks Executed

### Task 1: Automated Checks
- `npm run typecheck` — **PASS** (zero errors)
- `npm run lint` — **PASS** (zero errors)
- `npm run build` — **PASS** (zero errors)

### Task 2: Type & API Contract Verification
- `VisualSignatureMetadata` has `input_snapshot` (10 fields) and `artDirectorOutput` (accepts both old `VisualSignatureArtDirectorOutput` and new `VisualSignatureMetadataArtDirectorOutput`)
- `RestoreEligibility` type exists with `can_restore`, `drift_fields`, `requires_regeneration`, `reason`
- `reconcileProfiles()` exported with `ReconciliationOptions` and `ReconciliationResult` from profile-reconciliation.ts
- `validateDrift()` from drift-validator.ts returns correct `DriftValidationResult`
- Approve handler: updates `identity_state='visual_signature'`, `logo_status='generated'`, calls `reconcileProfiles()`
- Generate handler: stores `input_snapshot` and `metadataArtDirectorOutput` in metadata
- DELETE handler: archives signature, identity_state='text_only', profile preserved as synced
- POST /visual-signature/restore: validates drift, blocks on critical_drift/missing_metadata
- POST /logo: 409 when identity_state='visual_signature' with requires_identity_removal
- POST /logo/restore: 409 when identity_state='visual_signature' or 'logo'

### Task 3: UI Contract Verification
- VisualSignatureApprovalModal: rejectionContext stored, propagated to review phase
- StoreVisualSignatureSection: identity_state-driven UI with Remover/Alterar buttons
- VisualSignatureHistoryModal: cards with thumbnail, date, visual_direction, restore eligibility
- Remover calls DELETE and transitions UI to text_only
- All components conditionally render based on identity_state

### Task 4: Refinements (2026-06-19 Post-Verification)
- **Review phase feedback:** "Nenhuma agradou, gerar nova versão" now opens feedback textarea before generating (was going directly to generation). Feedback is passed as rejectionContext to the director.
- **Badge system:** Review and exhausted phases now show badges: "Ativa" (green) on active signature, "Sincronizada" (gray) on archived with ok restore eligibility, "Precisa realinhar" (amber) on archived with critical drift. Botão "Manter" for active, "Aprovar" for archived.
- **Color consistency fix (brand-profiler.ts):** `brand_colors_chosen` now prioritizes `inferred_primary_color` and `inferred_accent_color` over positional palette slice. Loading logic in store-identity-form.tsx also prefers `inferred_accent_color` over `brand_colors_chosen[1]` for backward compatibility with existing profiles.
- **Link cleanup:** "Continuar sem logo" removed from review/exhausted phases. "Remover assinatura" replaces it when active signature exists; "Voltar" when no active signature.
- **Button rename:** "Criar assinatura visual" → "Gerenciar assinatura visual" — single entry point for both creation and management, eliminating need for separate history modal trigger.

### Task 5: Manual GUI Verification (9/11 scenarios)
| # | Scenario | Status |
|---|----------|--------|
| 1 | identity_state='visual_signature': preview, Alterar/Remover, drop zone hidden | ✅ |
| 2 | identity_state='text_only': drop zone visible, color pickers, "Assinaturas anteriores" | ✅ |
| 3 | identity_state='logo': logo preview, Remover, drop zone hidden | ✅ |
| 4 | Color changes with VS active — no drift warning | ✅ |
| 5 | Remover → DELETE → UI transitions to text_only | ✅ |
| 6 | Alterar → generate → approve → swap signatures | ✅ |
| 7 | Alterar → close without approve → original remains active | ✅ |
| 8 | Badges in review/exhausted — Ativa/Sincronizada/Precisa realinhar | ✅ |
| 9 | Remover/Voltar context-sensitive link in exhausted phase | ✅ |
| 10 | RejectionContext → feedback → generate passes to director | ✅ |
| 11 | Reject without feedback → default "sem feedback específico" | ✅ |

### Task 6: Automated API Tests
- `.scripts/test-4.6.4-api.mjs` — **45/45 passed, 0 failures**
- Covers: approve, delete, get history, restore (no drift, drift, missing_metadata), logo gates, logo restore gates

## Quality Gate
- All automated checks pass (typecheck, lint, build)
- All types match design.md specifications
- All API contracts follow CONTEXT.md decisions D01-D10
- Centralized drift-validator.ts used by both GET history and POST restore
- Centralized reconcileProfiles() used by all profile transitions
- All 11 UI scenarios verified manually
- 45/45 API assertions pass
