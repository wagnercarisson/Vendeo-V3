# 29-01: Componentes Base + Loading States + Error Boundaries ✅

## Tasks
- **29-01-01:** Skeleton extendido com prop `variant` (card, table, form, preview, stats) e subcomponentes internos
- **29-01-02:** Shimmer dark mode com `@keyframes skeleton-shimmer` (opacidade 0.05→0.15)
- **29-01-03:** `loading-skeleton.tsx` wrapper com exports nomeados (CardSkeleton, TableSkeleton, etc.)
- **29-01-04:** `error-state.tsx` com role configurável (alert/status) e suporte a action (onClick/href)
- **29-01-05:** 12 loading.tsx criados nas rotas críticas (dashboard, campanhas, nova, [id], conta, loja, admin + 6 admin)
- **29-01-06:** 2 error.tsx — (app)/error.tsx e admin/error.tsx, ambos Client Components com "Tentar novamente"

## Commits
- `e8981b8` — feat(29-01): Skeleton variants + 12 loading.tsx + 2 error.tsx + error-state.tsx

## Verification
- ✅ TypeScript compile pass
- ✅ Lint pass
- ✅ 889 tests pass (no regression)
