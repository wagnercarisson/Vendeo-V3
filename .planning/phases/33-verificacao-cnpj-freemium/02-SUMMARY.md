# Plan 33-02 — Store Route + Grant Conditional

**Status:** ✅ Complete
**Wave:** 2

## Deliverables

- **POST /api/store** modified: executes CnpjVerificationService.resolve() server-side
- not_found → 400 blocking (store not created)
- unavailable → DEFER status (store created without grant)
- resolved → evaluateFreemiumEligibility determines approve/review/reject/defer
- Grant conditional: only when eligibility decision = approve
- rootEligible resolved server-side by querying freemium_entitlements
- Response includes onboardingGranted, verificationStatus, message

**Tests:** 8 store route tests + 5 lookup API tests = 13
