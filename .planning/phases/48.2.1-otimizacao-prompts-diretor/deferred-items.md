# Deferred Items — Phase 48.2.1

## Out of scope (pre-existing, unrelated to this plan)

- `src/lib/legal/__tests__/legal-document-versions.test.ts` — "keeps pending consolidated documents outside public and the catalog" fails with `ENOENT` for `openspec/changes/fase-50-demonstracao-gratuita-e-validade-dos-creditos/legal-consolidated-pending/terms-of-service-v1-5.md`. The directory does not exist; the test is from the F50 line and was not touched by plan 48-2-1-01. Not fixed here (scope boundary).

- `src/components/flow/__tests__/use-campaign-form-validity.test.ts` — 3 date-dependent tests fail on 2026-09-26+ because they hardcode `validityStartDate`/`validityEndDate` = `2026-09-25` as a *future/valid* date. The validator `src/components/flow/use-campaign-form.ts:267` (`if (fields.validityEndDate < todayISO) return "Data final não pode ser anterior à data de hoje"`) now rejects it. This is a pre-existing time-bomb, unrelated to F48.2.1:
  - Last modified `d6e2e76d` (2026-08-20, `quick-260820-p3u`) — before F48.2.1 began.
  - No F48.2.1 commit (`git log --grep="48-2-1"`) touched `src/components/flow`.
  - Discovered while running the full suite for Plan `48-2-1-09` Task 1; the strict fail-closed gate (`Test Files 1 failed` / `Tests 1 failed`) is **not** satisfied because of this extra failure. Not fixed here (scope boundary — pre-existing, unrelated). Escalated to the user.
