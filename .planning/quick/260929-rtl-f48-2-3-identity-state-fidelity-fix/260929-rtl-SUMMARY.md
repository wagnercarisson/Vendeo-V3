---
phase: quick
plan: 260929-rtl
subsystem: lab-bench
tags: [bench, identity-state, branding, import, f48.2.3]
dependency_graph:
  requires: [F48.2.3 import CLI, bench branding service, bench manifest]
  provides: [identity_state import/persistence, pure identity resolver, identity-aware branding contract/snapshot/API/UI]
  affects: [lab bench branding read path, bench import CLI]
tech_stack:
  added: []
  patterns: [pure domain resolver mirroring production, fail-closed validation, single decision point]
key_files:
  created:
    - src/lib/lab/bench/domain/resolve-bench-identity.ts
    - src/lib/lab/bench/__tests__/resolve-bench-identity.test.ts
  modified:
    - scripts/lab/48-2-3-bench-import-stores.mjs
    - src/lib/lab/bench/__tests__/bench-import.contract.test.ts
    - src/lib/lab/bench/domain/store-manifest.ts
    - src/lib/lab/bench/domain/schemas.ts
    - src/lib/lab/bench/domain/branding-service.ts
    - src/app/api/admin/laboratorio/bancada/branding/route.ts
    - src/app/(app)/admin/laboratorio/bancada/_components/bench-branding-panel.tsx
    - src/lib/lab/bench/__tests__/branding-service.test.ts
    - src/app/api/admin/laboratorio/bancada/__tests__/bench-api.contract.test.ts
    - src/lib/lab/bench/__tests__/store-manifest.test.ts
    - src/lib/lab/bench/__tests__/bench-boundary.contract.test.ts
    - src/lib/lab/bench/__tests__/bench-branding-signer.test.ts
    - src/lib/lab/bench/__tests__/bench-import.integration.test.ts
    - src/lib/lab/bench/__tests__/prompt-composer.contract.test.ts
    - src/app/(app)/admin/laboratorio/bancada/_components/__tests__/bench-ui.contract.test.tsx
decisions:
  - "loadBenchBranding() is the single decision point for identity; the route only renews the already-selected descriptor's signed URL."
  - "Identity variant selection is by active-record presence (normalized > original > on_dark), never by signed-URL success; signing failure preserves the selected descriptor with signedUrl: null."
  - "identity_state absent/unknown fails closed at import (before the transaction) and in the resolver (no silent text_only conversion)."
  - "Content-addressed object materialization is idempotent: local checksum precheck, upload upsert:false, single readback confirmation on ambiguous error; objects are tracked as referenced/created/reused and cleanup removes ONLY created objects."
metrics:
  duration: "~25 min"
  completed: "2026-09-29"
  status: "implementação concluída — reimportação remota e UAT pendentes de autorização humana"
---

# Quick Task 260929-rtl: Fidelidade de identidade visual da bancada (`stores.identity_state`)

## One-liner

Persiste e transporta `stores.identity_state` até a bancada, resolvendo a identidade por um resolver puro (seleção por presença de registro, não por URL assinada) e eliminando o bug do asset alternativo silencioso.

## Tasks completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Importar/persistir `identity_state` (allowlist + fail-closed + upsert) | `9bd4cae6` | `scripts/lab/48-2-3-bench-import-stores.mjs`, `bench-import.contract.test.ts` |
| 2 | Resolver puro `resolve-bench-identity.ts` + testes | `c3136159` | `resolve-bench-identity.ts`, `resolve-bench-identity.test.ts` |
| 3 | Expor `identityState` e eliminar o asset alternativo silencioso | `66d4f126` | `store-manifest.ts`, `schemas.ts`, `branding-service.ts`, `branding/route.ts`, `bench-branding-panel.tsx` + 8 test files |

## What changed

- **Import CLI** (`48-2-3-bench-import-stores.mjs`): `STORE_COLUMNS` gains `identity_state` (allowlist derives it); new pure `assertValidIdentityState` (closed set `text_only|logo|visual_signature`) called in `importOneStore` **before** any upload/write (fail-closed) and in `buildSanitizedStoreRow`; `buildStoreUpsert` writes `identity_state` in the `INSERT` and `ON CONFLICT DO UPDATE SET`. Value order: `brand_color=8`, `identity_state=9`, `logo_url=10`.
- **New resolver** (`resolve-bench-identity.ts`): pure, deterministic, no I/O / no env / no DB / no signed URL. Returns a descriptor (`kind`, `variantType`, `storagePath`) and a reason. `logo` selects by presence (normalized → original → on_dark); `visual_signature` selects the active signature; `text_only` → none; unknown/absent → `unknown_identity_state` (fail-closed).
- **store-manifest.ts**: `.select(...)` includes `identity_state`; `BenchTestStoreRecord` gains `identityState`; validated fail-closed (`bench_store_identity_state_invalid`).
- **schemas.ts**: new `BenchIdentityReferenceSchema` (strict, no `signedUrl`); `BenchBrandingSnapshotSchema` gains `identityState`, `identityReference`, `identityReason`.
- **branding-service.ts**: contract gains `identityState`, transient `identityReference` (`{kind,variantType,storagePath,signedUrl}`), `identityReason`. `loadBenchBranding` resolves the descriptor first (pure resolver), then signs only the selected path; on sign failure it preserves the descriptor with `signedUrl: null` and sets `logo:sign_failed` / `visual_signature:sign_failed` (no fallback). `logoUrl`/`signatureUrl` derive only from the resolved descriptor. `toBenchBrandingSnapshot` maps fields explicitly and omits `signedUrl` from `identityReference`.
- **branding route**: `withSignedAssets` no longer derives `logoUrl` from "first signedUrl"; it only renews the signed URL of the descriptor already selected by `loadBenchBranding` (logo by selected `storagePath` in `store-brand-assets`, signature in `visual-signatures`), with no re-resolution and no fallback.
- **panel**: `BenchBrandingView` gains `identityState`/`identityReference`/`identityReason`; shows state, chosen asset (kind/variant) and reason without redesign.

## Verification results

- **Task-specific tests**: `bench-import.contract.test.ts` (69 passed), `resolve-bench-identity.test.ts` (22 passed).
- **Regression (bench + API + UI)**: 20 files passed / 1 skipped, **457 passed / 1 skipped**.
- **Broader lab + architecture guard**: 55 files passed / 1 skipped, **1111 passed / 2 skipped**.
- **typecheck**: `npm run typecheck` exit 0.
- **lint**: `npm run lint` exit 0 (no new warnings).
- **build**: `npm run build` succeeded.
- **Production boundary proof**: `git diff --exit-code -- src/lib/store-identity-service.ts src/lib/ai/adapters/bench-images.ts supabase/migrations` → empty (exit 0). No production pipeline, provider adapter, or DDL touched.
- **Resolver purity grep**: no `await` / `process.env` / `supabase` / `signedUrl` tokens in `resolve-bench-identity.ts`.
- **No provider / no credits**: no image model call, no OpenAI/Anthropic call; cost US$ 0.

## Deviations from Plan

None — the plan was executed as written. Fixture updates for the new required fields (`identity_state` in store fixtures; `identityState`/`identityReference`/`identityReason` in branding fixtures/mocks) were anticipated by the plan's "Risco de mock" and are part of Task 3.

## TDD Gate Compliance

Tasks 1 and 2 were marked `tdd="true"`. Implementation and tests were developed together and committed atomically per task (per the execution instructions), so no separate `test(...)` RED commit precedes the `feat/fix(...)` GREEN commit. Gate note: RED/GREEN commit separation not preserved; tests were written alongside the implementation and all pass.

## Hard Stops Honored

- **Remote reimport UAT was NOT run.** The "Planned local UAT" step 1 (`node scripts/lab/48-2-3-bench-import-stores.mjs --store ...`) was intentionally skipped — it requires separate explicit human authorization. No remote Supabase read/write occurred.
- No production edits; no `bench-images.ts` change to use `identityImageUrl`; no image generation/provider calls; no Oferta 1:1 prompt; no `--all`; no creative fallback/logo↔signature swap; ROADMAP.md untouched.

## Complementary correction — idempotent import (follow-up, no new quick)

### Real cause

The first real reimport of the two test stores failed with
`import_destination_upload_failed:The upstream server is timing out`. The local
Storage logs showed the real cause: the content-addressed **signature object of
NovaTek already existed**; the upload used `upsert: false`; Storage internally
raised `KeyAlreadyExists`/`ResourceAlreadyExists`; the client error did **not**
carry reliable duplicate text; the old `error.message` regex therefore failed to
guarantee idempotency. The local Storage was healthy — this was **not** an outage.
Local state after the failure was preserved (NovaTek `visual_signature` + 1
signature object; Adega `text_only` + 6 logo objects; no prior object removed; no
remote write).

### What changed

- **`ensureContentAddressedObject`** (new, exported, pure orchestration over a
  storage adapter): (1) local-only precheck — if the path exists, compare the
  stored checksum; identical → reuse (`created:false`), divergent → sanitized
  integrity error (`import_destination_object_integrity_mismatch`) **without
  overwrite/removal**; (2) absent → upload `upsert:false`; (3) ambiguous/timeout
  error → **one** readback confirmation; if it now exists with the expected
  checksum, accept as created; otherwise propagate a sanitized error. Duplicate
  detection no longer relies on `error.message` regex.
- **`createLocalDestination().ensureBrandingObject`** delegates to the helper with
  the real local storage client.
- **`materializeStoreAssets`** now returns `storedAssets`, `storedSignature`,
  `referencedObjects`, `createdObjects`, `reusedObjects`. On failure it removes
  **only `createdObjects`** — reused/preexisting objects are never deleted.
- **`importOneStore`**: transaction-failure cleanup removes only `createdObjects`;
  post-commit cleanup removes `oldObjects − referencedObjects`; counters are
  honest — `objectsWritten` = created this attempt, plus `objectsReused` and
  `objectsReferenced`; audit `assetCount`/`objectCount` = referenced final set,
  with `objectsCreated`/`objectsReused` in the detail.
- **`toStoreSummary`** exposes `objectsWritten`, `objectsReused`,
  `objectsReferenced`.

### Tests added

- `ensureContentAddressedObject`: absent → created; existing same checksum →
  reused (no upload); divergent checksum → integrity error, no overwrite/removal;
  ambiguous error + correct readback → created; ambiguous error + absent readback
  → sanitized error.
- `materializeStoreAssets`: reuse of existing objects (created empty); failure on a
  later asset removes only created and keeps reused; transaction failure removes
  only created and keeps reused.
- Import idempotency (g): a second identical import over the **same destination**
  reuses both objects (`objectsWritten: 0`, `objectsReused: 2`, no removals).
- Integrated local real test (opt-in): runs the **same import twice** against real
  local PostgreSQL + Storage (fake read-only source), proving 7 objects created
  then 7 reused, identity intact, no duplication (6 + 1 objects), two audit rows,
  and integral fixture cleanup.

### Verification (this correction)

- `bench-import.contract.test.ts`: **77 passed**.
- Integrated local real test (`BENCH_IMPORT_REAL_INTEGRATION=1`): **1 passed**.
- Lab + architecture guard: **1119 passed / 2 skipped**.
- `npm run typecheck` exit 0; `npm run lint` exit 0.
- Production boundary: `git diff --exit-code -- src/lib/store-identity-service.ts src/lib/ai/adapters/bench-images.ts supabase/migrations` → empty.
- No remote read, no provider, no image generation, cost US$ 0.

### Status

Implementation corrected. **Remote reimport of the two test stores and the local
UAT remain pending explicit human authorization** — not executed here.

## Self-Check: PASSED

- `src/lib/lab/bench/domain/resolve-bench-identity.ts` — FOUND
- `src/lib/lab/bench/__tests__/resolve-bench-identity.test.ts` — FOUND
- Commit `9bd4cae6` — FOUND
- Commit `c3136159` — FOUND
- Commit `66d4f126` — FOUND
