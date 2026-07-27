# Plan 03 — Summary

**Phase:** 32 — Freemium Anti-Abuso CNPJ
**Plan:** 03 — Store Identity Form + Admin CNPJ/Freemium UI
**Wave:** 2
**Status:** ✅ Complete
**Date:** 2026-07-27

## Tasks

### Task 1: Store Identity Form — CNPJ Fields
- `use-store-form.ts`: FormData extended with cnpj, razaoSocial, nomeFantasia; save() sends them in POST body
- `store-identity-form.tsx`: CNPJ field with progressive mask (XX.XXX.XXX/YYYY-ZZ), Razão Social, Nome Fantasia — visible only in create mode (!storeId). Frontend validation on blur

### Task 2: Admin Pages
- `src/lib/admin/schemas.ts`: AdminUserSummary extended with cnpjMasked and freemiumStatus
- Admin user detail: CNPJ mascarado via maskCnpj(), freemium badge (4 variants), entitlement history table, exception button
- Admin user list: CNPJ column (font-mono), freemium filter dropdown (Todos/Sem CNPJ/Freemium ativo/Freemium usado), server-side enrichment

## Files Modified
- `src/components/flow/use-store-form.ts`
- `src/components/flow/store-identity-form.tsx`
- `src/lib/admin/schemas.ts`
- `src/app/(app)/admin/users/[id]/page.tsx`
- `src/app/(app)/admin/users/page.tsx`
