# Plan 04: UI — Rejection Propagation, Step 2 identity_state, Remover, History Modal

## Objective
Implement all user-facing changes: propagate rejectionContext from feedback to review phase in the approval modal, add Remover button to VS section, and create the VS history/restore modal.

## Tasks Executed

### Task 1: VisualSignatureApprovalModal — RejectionContext propagation
- Added `storedRejectionContext` state to preserve rejection feedback across phases
- Modified `handleConfirmReject` to navigate to "review" phase (instead of immediate generate)
- Stores rejectionContext with default "sem feedback específico" when no feedback provided
- "Gerar nova versão" in review phase passes stored rejectionContext to generate API
- storedRejectionContext resets on modal close

### Task 2: StoreVisualSignatureSection — identity_state as primary source + Remover/Alterar
- Refactored to use `identity_state` as primary state driver
- identity_state='visual_signature': shows VS preview + Alterar/Remover buttons
- Remover calls DELETE /visual-signature, transitions UI to text_only state
- Dismissible error banner on remove failure
- identity_state='text_only': shows Criar button + link to archived signatures
- Color pickers remain editable in all states

### Task 3: VisualSignatureHistoryModal — New component
- Created `visual-signature-history-modal.tsx` (separate from logo restore modal)
- Title: "Assinaturas anteriores", close button (X) top right
- Fetches GET /api/store/[id]/visual-signature on mount
- Cards show thumbnail, date, visual direction, status badge
- Restore button enabled only when restore_eligibility.reason='ok'
- Disabled with tooltip for 'critical_drift' and 'missing_metadata'
- Loading, empty, error states handled
- "Cancelar" button at bottom

## Quality Gate
- `npm run typecheck` PASSES with zero errors
- Rejection context flows end-to-end from feedback → review → generate
- History modal is independent from logo restore modal
- Remover safely transitions UI back to text_only
