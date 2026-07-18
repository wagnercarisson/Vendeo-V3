# Summary: 26-01 — Fundação — Migration, Gate, Middleware e Layout Admin

**Status:** ✅ Complete

## Files Created

- `supabase/migrations/20260718000001_create_admin_tables.sql` — Migration com admin_users, admin_audit_log, RPCs admin_grant_credits, admin_create_store_for_user, admin_get_users_summary, trigger append-only, índices
- `src/lib/admin/require-admin.ts` — requireAdmin() combinando requireApiUser + SELECT admin_users via supabaseAdmin
- `src/app/(app)/admin/layout.tsx` — Layout admin com requireAdmin() gate + navegação entre páginas admin

## Files Modified

- `src/middleware.ts` — Adicionado `/admin/:path*` ao matcher (proteção de sessão apenas, sem consulta admin_users)

## Key Decisions

- D1: Admin gate via `admin_users` table (não flag em `auth.users`)
- D3: Dupla proteção: middleware (sessão) + server component/API (admin_users)
- D4: admin_audit_log append-only com trigger BEFORE UPDATE/DELETE
- D5: admin_grant_credits RPC atômica com idempotência via operationId
- D9: admin_create_store_for_user RPC atômica com verificação + store + audit log
- admin_get_users_summary RPC SECURITY DEFINER acessa auth.users diretamente com LEFT JOIN para stores, credit_balances, campaigns

## Verification

- `npm run typecheck` — clean
- `npm run lint` — clean
