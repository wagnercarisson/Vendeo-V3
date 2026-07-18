# Summary: 26-02 — API Routes e Páginas Admin

**Status:** ✅ Complete

## Files Created

### API Routes (6)
- `src/app/api/admin/credits/grant/route.ts` — POST atômico com idempotência + audit log
- `src/app/api/admin/stores/route.ts` — POST criação de loja para usuário sem loja
- `src/app/api/admin/users/route.ts` — GET listagem paginada com busca
- `src/app/api/admin/users/[id]/route.ts` — GET detalhe consolidado (store, balance, history, campaigns)
- `src/app/api/admin/campaigns/errors/route.ts` — GET campanhas com erro paginadas
- `src/app/api/admin/audit-log/route.ts` — GET audit log paginado com filtros
- `src/lib/admin/schemas.ts` — Zod schemas + TypeScript interfaces compartilhadas

### Admin Pages (5)
- `src/app/(app)/admin/page.tsx` — Dashboard operacional com cards de visão geral
- `src/app/(app)/admin/users/page.tsx` — Diretório com busca SSR + paginação
- `src/app/(app)/admin/users/[id]/page.tsx` — Detalhe com saldo, extrato, grant form, store creation, campanhas
- `src/app/(app)/admin/campaigns/errors/page.tsx` — Lista paginada com destaque vermelho
- `src/app/(app)/admin/audit-log/page.tsx` — Histórico paginado com filtros por ação/target

## Key Decisions

- D8: Admin pages como Server Components com dados SSR
- D6: Rotas admin usam supabaseAdmin (service role) — proteção via requireAdmin()
- D7: Convite beta MVP: admin cria loja + concede créditos via interface
- Todas as rotas usam apiHandler para tratamento consistente de erros (401/403)

## Verification

- `npm run typecheck` — clean
- `npm run lint` — clean
