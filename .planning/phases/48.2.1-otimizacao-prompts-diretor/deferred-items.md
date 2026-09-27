# Deferred Items — Phase 48.2.1

## Out of scope (pre-existing, unrelated to this plan)

- `src/lib/legal/__tests__/legal-document-versions.test.ts` — "keeps pending consolidated documents outside public and the catalog" fails with `ENOENT` for `openspec/changes/fase-50-demonstracao-gratuita-e-validade-dos-creditos/legal-consolidated-pending/terms-of-service-v1-5.md`. The directory does not exist; the test is from the F50 line and was not touched by plan 48-2-1-01. Not fixed here (scope boundary).

## Fixed by human authorization (test-only, Plan 48-2-1-09)

- `src/components/flow/__tests__/use-campaign-form-validity.test.ts` — 3 date-dependent tests failed on 2026-09-26+ because they hardcoded `validityStartDate`/`validityEndDate` = `2026-09-25` as a *future/valid* date, which the validator `src/components/flow/use-campaign-form.ts:267` (`if (fields.validityEndDate < todayISO) return "Data final não pode ser anterior à data de hoje"`) rejected as past. Pre-existing and unrelated to F48.2.1 (last modified `d6e2e76d`, 2026-08-20, `quick-260820-p3u`; no F48.2.1 commit touched `src/components/flow`).
  - **Resolution (authorized test-only):** the `describe("D2/D5: validação de datas no submit (frontend, antes do fetch)")` block now freezes the clock in its `beforeEach` (`vi.useFakeTimers({ toFake: ["Date"] })` + `vi.setSystemTime(new Date("2026-08-20T12:00:00"))`) and restores it in `afterEach` (`vi.useRealTimers()`), mirroring the existing `Q-P3U` block of the same file. No productive code changed; original dates and expectations preserved; behavior is now independent of the real execution date.
  - Isolated run: `npx vitest run src/components/flow/__tests__/use-campaign-form-validity.test.ts` → **27 passed (exit 0)**.
  - Commit: `test(48-2-1-09): freeze clock in D2/D5 validity block (date-robust, authorized)`.

## UX improvements (non-blocking) — observed during UAT (Plan 48-2-1-09)

Not implemented now; recorded for a future bench-UX slice.

- Explain, in the experiment detail, that the candidate is inserted **only during creation** and then **frozen** (the detail does not allow editing the candidate).
- Make the **linked scenarios** more evident (show clearly which scenarios belong to the experiment).
- Explain the estimate formula **`cenários × 2 variantes × repetições`** in the UI (why `× 2` and how repetitions apply).
- Consider allowing the user to **view the full candidate snapshot content**, not just the name/hash.
