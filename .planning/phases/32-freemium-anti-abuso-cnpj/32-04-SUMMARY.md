# Plan 04 — Summary

**Phase:** 32 — Freemium Anti-Abuso CNPJ
**Plan:** 04 — Legacy Store Update + Legal Documents v1.2/v1.1
**Wave:** 3
**Status:** ✅ Complete
**Date:** 2026-07-27

## Tasks

### Task 1: Legal Documents v1.2 + v1.1
- `terms-of-service-v1-2.md`: Added clauses for mandatory CNPJ (2.5-2.6), Freemium per root (Seção 5), Sanctions (Seção 9), Credit Purchase (Seção 8)
- `privacy-policy-v1-1.md`: Added CNPJ data collection (2.3.1), processing purposes (2.4) with LGPD legal basis
- `document-content.ts`: Updated catalog with v1.2 and v1.1 entries; AUP remains v1.0

### Task 2: Legacy Store Update + Admin Exception
- `cnpj-update-banner.tsx`: Client component — amber alert with link to /cadastro/cnpj, shown only when store has no CNPJ
- Dashboard: Banner integrated for both `has_store_with_campaigns` and `has_store_no_campaigns` states
- `/cadastro/cnpj/page.tsx`: Server component renders CnpjUpdateForm
- `cnpj-update-form.tsx`: Client form with CNPJ mask, validateCnpj(), hashCnpjRoot(), calls update_store_cnpj RPC
- `/api/store/update-cnpj/route.ts`: POST route — validate ownership, call update_store_cnpj RPC
- `POST /api/admin/freemium/exception`: Admin route — calls admin_grant_freemium_exception RPC (Plan 1 migration)

## Files Created/Modified
- `public/docs/legal/terms-of-service-v1-2.md` (new)
- `public/docs/legal/privacy-policy-v1-1.md` (new)
- `src/lib/legal/document-content.ts` (modified)
- `src/components/legacy/cnpj-update-banner.tsx` (new)
- `src/app/(app)/dashboard/page.tsx` (modified)
- `src/app/(app)/cadastro/cnpj/page.tsx` (new)
- `src/app/(app)/cadastro/cnpj/cnpj-update-form.tsx` (new)
- `src/app/api/store/update-cnpj/route.ts` (new)
- `src/app/api/admin/freemium/exception/route.ts` (new)
