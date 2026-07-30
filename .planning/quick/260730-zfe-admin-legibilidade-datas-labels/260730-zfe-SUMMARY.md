---
status: complete
quick_id: 260730-zfe
description: Admin Legibilidade — Datas e Labels
---

## Summary

Centralized date formatting with `America/Sao_Paulo` timezone and humanized labels across admin pages.

### Files created
- `src/lib/labels.ts` — `getLabel()`, `humanizeLabel()` helpers
- `src/lib/admin/labels.ts` — `AUDIT_ACTION_LABELS` (9), `TARGET_TYPE_LABELS`, `BENEFIT_TYPE_LABELS`, `VERIFICATION_REASON_LABELS`, `DOCUMENT_TYPE_LABELS`, `CAMPAIGN_STATUS_LABELS`
- `src/lib/credit/labels.ts` — `CREDIT_TYPE_LABELS` (7 tipos), `CREDIT_TYPE_BADGE`
- `src/lib/__tests__/labels.test.ts` — 10 tests
- `src/lib/__tests__/formatters.test.ts` — 5 tests
- `src/lib/admin/__tests__/labels.test.ts` — 30 tests
- `src/lib/credit/__tests__/labels.test.ts` — 18 tests

### Files modified
- `src/lib/formatters.ts` — added `formatDateBR`, `formatDateTimeBR`, `formatDateTimeFullBR` with `timeZone: "America/Sao_Paulo"`
- `src/app/(app)/admin/audit-log/page.tsx` — removed local `ACTION_LABELS`/`TARGET_LABELS`, uses central, dates fixed
- `src/app/(app)/admin/page.tsx` — removed local `ACTION_LABELS`, uses central, dates fixed
- `src/app/(app)/admin/users/[id]/page.tsx` — removed local `REASON_LABELS`, humanized benefit_type, document_type, tx.type, campaign status; dates fixed
- `src/app/(app)/admin/users/page.tsx` — dates fixed
- `src/app/(app)/admin/reviews/page.tsx` — removed local `REASON_LABELS`, uses central, dates fixed
- `src/app/(app)/admin/campaigns/errors/page.tsx` — dates fixed
- `src/components/credit/transaction-history.tsx` — imports from `@/lib/credit/labels`, dates fixed

### Verification
- TypeScript: clean
- Lint: clean
- Tests: 1299 passing (63 novos), 7 pre-existing failures unrelated
- Build: OK

### Acceptance criteria
- [x] Datas admin exibem horário Brasília (UTC-3)
- [x] Todo label raw do banco tem versão humanizada PT-BR
- [x] Fallback seguro para valores desconhecidos (não quebra, exibe fallback humanizado)
- [x] Nenhuma label map duplicado (tudo centralizado)
- [x] Mobile também reflete as correções
- [x] Nenhuma regra de negócio alterada
- [x] TypeScript/lint/build clean
