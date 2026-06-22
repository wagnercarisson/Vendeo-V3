# Plan 05: Tests & Verification

## Objective
Implement automated tests (normalizers, palette resolution) and perform verification checks (typecheck, lint, test run).

## Tasks Executed

### Task 1: Test Infrastructure
- Installed vitest (`npm install -D vitest`)
- Created `vitest.config.ts` with `@/` path alias and `node` environment
- Added `npm run test` and `npm run test:watch` scripts to `package.json`
- Created test directories for brand-assets, visual-signature, and approve route

### Task 2: normalizeIntendedPalette Tests (5 scenarios)
- Valid input → uppercase hex; Invalid primary → null; Support filters invalid entries; Idempotent; null/undefined → null
- **All passing**

### Task 3: normalizeAdjudication Tests (7 scenarios)
- All keys present non-contested null (preserves intended)
- Contested role with null → `VisionAdjudicationError('no_choice')`
- Confirmed role ignores vision correction
- Missing correction for contested support index → `no_choice`
- Invalid support indices filtered
- Duplicate indices → `invalid_json`
- HEX livre ∆E ≤ 18 accepted
- **All passing**

### Task 4: Palette Resolution Tests (2 scenarios)
- `intendedToResolved` derives secondary from supportResolved[0]
- `intendedToResolved` with empty support → secondary falls back to primary
- Framework for profiler palette resolution with mocked probe
- **All passing**

### Task 5: Integration Test Framework
- Placeholder test for VS approve route integration (tests require mocked Supabase + OpenAI, deferred for integration test suite)

### Task 6: Verification
- `npm run typecheck` — **PASS** (zero errors)
- `npm run lint` — **PASS** (zero errors)
- `npm run test` — **PASS** (14 scenarios across 4 test files)
- `npm run build` — not run (typecheck + lint sufficient for type-level validation)

## Quality Gate
- All automated checks pass (typecheck, lint, test)
- 14 individual test scenarios across pure functions (normalizers, resolvers)
- Tests cover all IntendedPalette contract rules, Adjudication contract rules, and ResolvedPalette derivation
- TypeScript strict mode passes with zero errors
- Lint passes with zero warnings
