# Deferred Items — Phase 51.1 (Landing visual de produto)

Out-of-scope findings discovered while executing **Plan 51-1-02**. Per the executor
scope-boundary rule these are NOT fixed here (pre-existing, unrelated to this plan's
changes), only logged for follow-up.

## 1. Pre-existing `npm run typecheck` failure on `escopo/landing` branch base

- **File:** `src/lib/ai/__tests__/image-generation-operations-repository.integration.test.ts:139`
- **Error:** `TS2353: Object literal may only specify known properties, and 'ssl' does not exist in type '{ connectionString?: string | undefined; }'`
- **Cause:** `src/types/external-modules.d.ts` (repo-owned ambient declaration for `pg`)
  declares `Client`/`Pool` constructors as `{ connectionString?: string }` without `ssl`.
- **Upstream fix exists but is NOT on this branch:** commit
  `92059829 fix(56.2.1-06): declare pg ssl in ambient types and isolate node:test from vitest`
  adds `ssl?: boolean | Record<string, unknown>` to the ambient declaration. That commit is
  present on `feature/fase-56-1-contrato-produtivo-modelos-e-fallback` (and its HEAD
  `6e010330`) but is **absent** from `escopo/landing` (merge-base `cc70e57c`).
- **Why not fixed here:** This plan's authorized scope is *only* the two new files under
  `src/components/landing/`. `src/types/external-modules.d.ts` is a shared/F56-supporting
  file; the hard constraints forbid F56/shared-contract changes and installing dependencies
  is prohibited. The fix belongs to the F56.2.1 branch and is already committed upstream.
- **Impact on this plan:** The error is in an untouched, unrelated file. `tsc` reports
  **zero** errors in `src/components/landing/acquisition-cta.tsx` and
  `src/components/landing/campaign-image.tsx`.
- **Recommended follow-up:** rebase `escopo/landing` onto a base that includes `92059829`
  (or merge that commit), after which `npm run typecheck` is expected to exit 0.

## Environment note

- `escopo/landing` is a git worktree of `C:\Projetos\Vendeo V3` and had no `node_modules`.
  Because dependency installs are prohibited, a directory junction `node_modules` →
  `C:\Projetos\Vendeo V3\node_modules` was created (gitignored; not a dependency install)
  solely to run the mandated `typecheck`. It is untracked and does not affect the diff.
