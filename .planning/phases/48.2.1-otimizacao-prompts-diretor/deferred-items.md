# Deferred Items — Phase 48.2.1

## Out of scope (pre-existing, unrelated to this plan)

- `src/lib/legal/__tests__/legal-document-versions.test.ts` — "keeps pending consolidated documents outside public and the catalog" fails with `ENOENT` for `openspec/changes/fase-50-demonstracao-gratuita-e-validade-dos-creditos/legal-consolidated-pending/terms-of-service-v1-5.md`. The directory does not exist; the test is from the F50 line and was not touched by plan 48-2-1-01. Not fixed here (scope boundary).
