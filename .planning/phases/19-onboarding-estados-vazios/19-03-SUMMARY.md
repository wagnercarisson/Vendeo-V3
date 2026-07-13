# 19-03: Campanhas + Detalhe sem Loja ✅

## Files Modified
- `src/app/(app)/campanhas/page.tsx` — `redirect("/loja")` → `<EmptyState>` com CTA
- `src/app/(app)/campanhas/[id]/page.tsx` — `redirect("/loja")` → `notFound()`
- `src/app/(app)/campanhas/client.tsx` — texto inline → `CAMPAIGNS_NO_CAMPAIGNS` microcopy
- `src/__tests__/app/minhas-campanhas.test.tsx` — atualizado para esperar empty state
- `src/__tests__/app/minhas-campanhas-client.test.tsx` — atualizado para nova microcopy
- `src/__tests__/api/campaign-page-server.test.tsx` — atualizado para esperar `notFound()`

## Files Created
- `src/__tests__/app/campanhas/campanhas-page.test.tsx` — 4 testes
- `src/__tests__/app/campanhas/campaign-detail-page.test.tsx` — 3 testes

## Key Changes
- `/campanhas` sem loja: mostra `<EmptyState>` com "Configure sua loja" e CTA → `/loja`
- `/campanhas/[id]` sem loja: chama `notFound()` (404), não redireciona
- `/campanhas/nova` sem loja: `redirect("/loja")` mantido (inalterado)
- client.tsx: empty state "Nenhuma campanha ainda" referência microcopy centralizada

## Verification
- ✅ 7/7 novos testes passando
- ✅ 3 testes existentes atualizados
- ✅ TypeScript clean
- ✅ Lint clean
- ✅ Build clean
