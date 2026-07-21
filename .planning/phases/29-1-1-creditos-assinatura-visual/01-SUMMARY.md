---
phase: 29-1-1
plan: 01
name: "Backend Foundation — Types, CreditService, Routes"
subsystem: "visual-signature, credit"
tags: ["backend", "credit-integration", "launch-config"]
key-files:
  - src/lib/visual-signature/types.ts
  - src/lib/credit/types.ts
  - src/app/api/store/[id]/visual-signature/generate-without-logo/route.ts
  - src/app/api/store/[id]/visual-signature/reject/route.ts
  - src/app/api/store/[id]/visual-signature/approve/route.ts
  - src/app/api/store/[id]/visual-signature/route.ts
metrics:
  files-changed: 6
  lines-added: 158
  lines-removed: 196
  commits: 1
---

## Backend Foundation — Créditos na Assinatura Visual

### What was built

1. **`credit_tx_id` in VisualSignatureMetadata** — optional field to track the credit transaction associated with each VS generation
2. **`CreditOperationOptions.campaignId` type updated** to `string | null` so VS can call reserveCredit with `campaignId: null`
3. **Pagination in GET /api/store/[id]/visual-signature** — `?limit=N&offset=0` params with `count: "exact"` for total. Default limit 12, max 100
4. **Credit integration in generate-without-logo** — full flow:
   - `generationPaused` guard at absolute beginning (503)
   - `v15Enabled=false` → skip ALL credit logic
   - `creditsChargingEnabled=false` → skip balance/reserve but generation proceeds
   - Balance check → 402 `{ code: "insufficient_credits" }`
   - `reserveCredit(campaignId: null, metadata: { feature: "visual_signature", ... })` before IA
   - `refundCredit` on technical failure (IA error, storage error, timeout)
   - `credit_tx_id` persisted in signature metadata on success
   - `try/finally` lock cleanup (generationLocks + timeout)
5. **Removed exhausted/3-attempt limit** from generate-without-logo (no more `totalCount >= 3` guard)
6. **Removed exhausted block** from reject route — always returns `{ success: true, rejectionContext }`
7. **Removed `visual_signature_attempts: 0` reset** from approve route

### Deviations

None — implementation follows CONTEXT.md design decisions D1-D7 precisely.

### Self-Check: PASSED

- TypeScript: ✓
- Lint: ✓
- Build: ✓
- All existing tests pass
