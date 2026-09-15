# F47 Verification — Catálogo e Seleção de Modelos Admin

**Status:** PARTIAL — automated evidence complete; human UAT and remote release checkpoints pending
**Goal:** Catálogo persistido por capacidade e seleção administrativa auditada, consumidos por resolver fail-open sem alterar o gateway ou contratos de geração.

## Goal-Backward Matrix

| Requirement | Implementation/evidence | Automated status | Human/release status |
|---|---|---|---|
| `ai-model-catalog`: tables, RLS, exact matrix, idempotent seeds | `20260914000001_f47_ai_model_catalog_selection.sql`; local verifier; catalog parity tests | PASS | Local human UAT pending |
| `ai-model-catalog`: read-only UI and catalog authority | admin form has active-only selectors; RPC validates active tuple; catalog has no UI mutation | PASS | UAT pending |
| `ai-model-selection`: primary/fallback semantics | migration CHECKs/RPCs; resolver tests; admin route/form tests | PASS | UAT pending |
| `ai-model-selection`: set/reset audit and idempotency | `admin_set_ai_model_selection`/`admin_reset_ai_model_selection`; local verifier 23/23; route tests | PASS | Remote schema pending |
| `ai-model-selection`: bulk cache TTL/invalidation | selection/catalog services; race tests; resolver fail-open tests | PASS | UAT pending |
| `ai-model-selection`: generation flow unchanged | gateway untouched; frozen guard; full regression | PASS | Release order pending |
| `ai-model-registry` delta: catalog-approved model and runtime tuple | `PersistedModelResolver`; parity and invalid tuple tests | PASS | UAT pending |
| `ai-model-pricing` delta: capacity-aware warnings | `model-capability-pricing.ts`; 40 pricing/cost tests; composer/UI integration | PASS | UAT pricing pending |
| `admin-ai-model-selection`: API authorization and contracts | strict Zod, requireAdmin, GET/PUT/DELETE route tests | PASS | UAT pending |
| `admin-ai-model-selection`: grouped UI, reset, operationId | page/form/nav; 6 UI tests; typecheck/lint/build | PASS | UAT pending |
| Proposal: local-first migration order | local reset/lint/verifier complete; no remote action | PASS locally | Remote migration BLOCKED |
| Proposal: migration before deploy | not yet executed by design | NOT APPLICABLE YET | BLOCKING checkpoint |

## Gates

- [x] Vitest full local regression: 287 files / 2782 tests.
- [x] TypeScript typecheck.
- [x] ESLint.
- [x] Next build.
- [x] Local Supabase migration reset/lint and F47 verifier.
- [x] Frozen contract verifier: 51 paths / 0 violations.
- [ ] Human UAT approved.
- [ ] Remote migration applied and verified.
- [ ] Deploy completed after remote migration.

## Release Controls

- Remote `npx supabase db push` has not been run.
- No Vercel/deploy command has been run.
- No remote env var was created, removed or changed.
- Do not mark this document `passed` until UAT, remote migration and deploy evidence exist in order.
