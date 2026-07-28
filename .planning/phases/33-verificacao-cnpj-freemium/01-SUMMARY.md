# Plan 33-01 — Migration + Core Libraries + Services + Tests

**Status:** ✅ Complete
**Wave:** 1

## Deliverables

- **Migration SQL** (`20260728000001_f33_cnpj_verification.sql`): verification columns in stores, cnpj_lookup_cache table, 7 RPCs (update_store_verification, admin_approve_store_verification, admin_reject_store_verification, admin_create_test_store, admin_exception_store_verification, create_store_with_cnpj modificada, admin_get_users_summary modificada)
- **CnpjLookupProvider** interface + BrasilApiProvider + CnpjaProvider implementations (timeout 5s, retry 1x)
- **CnpjVerificationService** with cache orchestration (cache → BrasilAPI → CNPJá)
- **GET /api/cnpj/lookup** endpoint for client-side onBlur lookup
- **evaluateFreemiumEligibility** pure synchronous function with 4 decisions (approve/review/reject/defer)
- **33 tests**: lookup providers (12), verification service (8), risk service (13)

**Tests:** 33 passing
